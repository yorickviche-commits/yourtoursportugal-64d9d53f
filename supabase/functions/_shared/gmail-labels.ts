import {gmailGet, MAILBOX_KEY_RE} from './gmail.ts';
import {withDerivedDates,workbenchSide} from './workbenchScope.ts';
export const LABEL_STAGES = [
 ['SALES - New Lead','● SALES · New Lead'],['SALES - - Budgeting & Fine-Tuning','● SALES · Budgeting'],['SALES - Final Negotiation & Ready to Book','● SALES · Negotiation'],['SALES - Archive','● SALES · Archive'],
 ['OPERATIONS - Deposit/Payment Received','● OPS · Deposit Received'],['OPERATIONS - Suppliers Bookings & Confirmations','● OPS · Fornecedores'],['OPERATIONS - Technical Briefing (Internal & Suppliers Final Validations)','● OPS · Briefing'],['OPERATIONS - Trip Ready / In Execution','● OPS · In Execution'],['OPERATIONS - Post-Trip Loop / Feedback','● OPS · Post-Trip'],['OPERATIONS - Deferred / Postponed Trip','● OPS · Deferred'],['OPERATIONS - Archive','● OPS · Archive'],
] as const;
type Row=Record<string,any>;
export function labelSpec(lead:Row){
 const side=workbenchSide(lead),stage=LABEL_STAGES.find(([key])=>key===lead.nethunt_stage)||LABEL_STAGES[side==='ops'?4:0];
 const muted=/Archive|Deferred/.test(stage[1]);
 const color=muted?{backgroundColor:'#cccccc',textColor:'#000000'}:side==='ops'?{backgroundColor:'#4a86e8',textColor:'#ffffff'}:{backgroundColor:'#ffad47',textColor:'#000000'};
 const date=withDerivedDates(lead).trip_start?.slice(0,10);
 return {stage:stage[0],color,name:`${lead.yt_id||lead.lead_code}${date?` · ${date.slice(8,10)}/${date.slice(5,7)}`:''}`};
}
export function threadDelta(current:string[],fileId:string|null,stageId:string|null,owned:string[],otherFiles:string[]=[]){
 const desired=[fileId,stageId].filter((x):x is string=>!!x);
 return {addLabelIds:desired.filter(x=>!current.includes(x)),removeLabelIds:owned.filter(x=>current.includes(x)&&!desired.includes(x)&&!otherFiles.includes(x))};
}
async function request(key:string,method:string,path:string,body:unknown){
 const api=Deno.env.get('LOVABLE_API_KEY'),credential=Deno.env.get(key);
 if(!api||!credential)throw new Error('Ligação Gmail indisponível');
 const r=await fetch(`https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me${path}`,{method,headers:{Authorization:`Bearer ${api}`,'X-Connection-Api-Key':credential,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const text=await r.text();if(!r.ok){console.error('Gmail labels',r.status,text);throw new Error(`[${r.status}]: ${text}`)}
 return text?JSON.parse(text):{};
}
function checked(r:any){if(r.error)throw r.error;return r.data||[]}
export class GmailLabels {
 private labels:Row[]=[];private stages:Row[]=[];private files=new Map<string,Row>();private leads=new Map<string,Row>();
 constructor(private db:any,private mailbox:string,private key:string){}
 async init(){
  if(!MAILBOX_KEY_RE.test(this.key))throw new Error('Ligação Gmail inválida');
  const profile=await gmailGet(this.key,'/profile');if(profile.status!==200)throw new Error(`[${profile.status}]: ${JSON.stringify(profile.body)}`);
  if(String(profile.body.emailAddress).toLowerCase()!==this.mailbox)throw new Error('Ligação Gmail corresponde a outra caixa');
  const result=await gmailGet(this.key,'/labels');if(result.status!==200)throw new Error(`[${result.status}]: ${JSON.stringify(result.body)}`);this.labels=result.body.labels||[];
  this.stages=checked(await this.db.from('gmail_stage_labels').select('*').eq('mailbox',this.mailbox));
  // Only ids registered as ours may ever be edited. Name collisions are not ownership.
  for(const [stage_key,name] of LABEL_STAGES){
   const spec=labelSpec({nethunt_stage:stage_key});
   const old=this.stages.find(s=>s.stage_key===stage_key);
   if(old&&this.labels.some(l=>l.id===old.label_id))continue;
   if(this.labels.some(l=>l.name===name))throw new Error(`Etiqueta existente não gerida pelo TCC: ${name}`);
   const label=await request(this.key,'POST','/labels',{name,labelListVisibility:'labelShow',messageListVisibility:'show',color:spec.color});
   checked(await this.db.from('gmail_stage_labels').upsert({mailbox:this.mailbox,stage_key,label_id:label.id,name},{onConflict:'mailbox,stage_key'}));
   this.labels.push(label);this.stages=this.stages.filter(s=>s.stage_key!==stage_key);this.stages.push({stage_key,label_id:label.id,name});
  }
 }
 private async file(leadId:string,create:boolean){
  let lead=this.leads.get(leadId);if(!lead){const r=await this.db.from('leads').select('id,yt_id,lead_code,nethunt_stage,status,trip_start,travel_dates').eq('id',leadId).single();if(r.error)throw r.error;lead=r.data;this.leads.set(leadId,lead as Row)}
  const spec=labelSpec(lead as Row);
  let file=this.files.get(leadId);
  if(!file){const r=await this.db.from('gmail_lead_labels').select('*').eq('mailbox',this.mailbox).eq('lead_id',leadId).maybeSingle();if(r.error)throw r.error;file=r.data||undefined;}
  if(file&&!this.labels.some(l=>l.id===file?.label_id))file=undefined;
  if(!file&&create){
   if(this.labels.some(l=>l.name===spec.name))throw new Error(`Etiqueta existente não gerida pelo TCC: ${spec.name}`);
   const label=await request(this.key,'POST','/labels',{name:spec.name,labelListVisibility:'labelHide',messageListVisibility:'show',color:spec.color});
   file={mailbox:this.mailbox,lead_id:leadId,label_id:label.id,name:spec.name};
   checked(await this.db.from('gmail_lead_labels').upsert(file,{onConflict:'mailbox,lead_id'}));this.labels.push(label);
  }else if(file&&create){
   await request(this.key,'PATCH',`/labels/${encodeURIComponent(file.label_id)}`,{name:spec.name,labelListVisibility:'labelHide',messageListVisibility:'show',color:spec.color});
   if(file.name!==spec.name){checked(await this.db.from('gmail_lead_labels').update({name:spec.name}).eq('mailbox',this.mailbox).eq('lead_id',leadId));file.name=spec.name}
  }
  if(file)this.files.set(leadId,file);
  return {file,spec};
 }
 async apply(threadId:string,leadId:string){
  const links=checked(await this.db.from('email_links').select('lead_id').eq('mailbox',this.mailbox).eq('gmail_thread_id',threadId).eq('unlinked',false));
  const active=links.some((l:Row)=>l.lead_id===leadId);
  const {file,spec}=await this.file(leadId,active);
  const otherIds=[...new Set(links.map((l:Row)=>l.lead_id))].filter(x=>x!==leadId) as string[];
  const otherFiles:string[]=[];for(const other of otherIds){const r=await this.file(other,true);if(r.file)otherFiles.push(r.file.label_id);const s=this.stages.find(s=>s.stage_key===r.spec.stage);if(s)otherFiles.push(s.label_id)}
  const stageId=this.stages.find(s=>s.stage_key===spec.stage)?.label_id;
  const before=await gmailGet(this.key,`/threads/${encodeURIComponent(threadId)}?format=minimal`);
  if(before.status===404)return {missing:true,modified:false};
  if(before.status!==200)throw new Error(`[${before.status}]: ${JSON.stringify(before.body)}`);
  const owned=[...(file?[file.label_id]:[]),...this.stages.map(s=>s.label_id)];
  const current=[...new Set((before.body.messages||[]).flatMap((m:Row)=>m.labelIds||[]))] as string[];
  const delta=threadDelta(current,active?file?.label_id||null:null,active?stageId||null:null,owned,otherFiles);
  // Apply to every message, even when only part of a thread already has the desired labels.
  if(active){delta.addLabelIds=[file?.label_id,stageId].filter((x):x is string=>!!x)}
  if(!delta.addLabelIds.length&&!delta.removeLabelIds.length)return {modified:false,preserved:true};
  await request(this.key,'POST',`/threads/${encodeURIComponent(threadId)}/modify`,delta);
  const after=await gmailGet(this.key,`/threads/${encodeURIComponent(threadId)}?format=minimal`);
  if(after.status!==200)throw new Error(`Verificação Gmail [${after.status}]`);
  const fingerprint=(t:Row)=>(t.messages||[]).map((m:Row)=>({id:m.id,labels:(m.labelIds||[]).filter((l:string)=>!owned.includes(l)).sort()})).sort((a:Row,b:Row)=>a.id.localeCompare(b.id));
  const preserved=JSON.stringify(fingerprint(before.body))===JSON.stringify(fingerprint(after.body));
  if(!preserved)throw new Error('As etiquetas não geridas mudaram durante a verificação; rever concorrência na caixa');
  return {modified:true,preserved,file_label:file?.name,stage_label:this.stages.find(s=>s.label_id===stageId)?.name};
 }
}
export async function runLabelBatch(db:any,mailbox:string,key:string,options:{test?:{thread_id:string;lead_id:string};lead_id?:string;limit?:number;backfill?:boolean}={}){
 const registry=await db.from('gmail_label_mailboxes').select('*').eq('mailbox',mailbox).maybeSingle();if(registry.error)throw registry.error;
 if(!options.test&&!registry.data?.enabled)return {mailbox,skipped:'Etiquetas ainda não ativadas'};
 if(options.test&&!registry.data)checked(await db.from('gmail_label_mailboxes').insert({mailbox,enabled:false}));
 const lock=await db.rpc('gmail_labels_lock',{p_mailbox:mailbox});if(lock.error)throw lock.error;if(!lock.data)return {mailbox,skipped:'Lote em curso'};
 try{
  let jobs:Row[];
  if(options.test){
   const r=await db.from('email_links').select('lead_id').eq('mailbox',mailbox).eq('gmail_thread_id',options.test.thread_id).eq('lead_id',options.test.lead_id).eq('unlinked',false).limit(1);if(!checked(r).length)throw new Error('Thread não ligada à file');jobs=[{...options.test}];
  }else{
   if(options.backfill&&!registry.data?.backfill_done)checked(await db.rpc('gmail_labels_seed',{p_mailbox:mailbox}));
   let q=db.from('gmail_label_queue').select('*').eq('mailbox',mailbox).eq('done',false).lte('next_attempt_at',new Date().toISOString()).order('requested_at').limit(options.limit||10);if(options.lead_id)q=q.eq('lead_id',options.lead_id);jobs=checked(await q);
  }
  if(!jobs.length)return {mailbox,threads:0};
  const client=new GmailLabels(db,mailbox,key);await client.init();let threads=0;const results=[];
  for(const job of jobs){
   try{const result=await client.apply(job.thread_id,job.lead_id);results.push(result);if(result.modified)threads++;
    if(!options.test)checked(await db.from('gmail_label_queue').update({done:true,last_error:null}).eq('mailbox',mailbox).eq('thread_id',job.thread_id).eq('lead_id',job.lead_id).eq('requested_at',job.requested_at));
   }catch(e){if(!options.test)checked(await db.from('gmail_label_queue').update({last_error:String(e),next_attempt_at:new Date(Date.now()+15*60000).toISOString()}).eq('mailbox',mailbox).eq('thread_id',job.thread_id).eq('lead_id',job.lead_id));throw e}
   await new Promise(resolve=>setTimeout(resolve,150));
  }
  return {mailbox,threads,results};
 }catch(e){const message=e instanceof Error?e.message:String(e);console.error('Gmail labels',mailbox,message);await db.from('mailbox_sync_state').update({last_error:`Gmail labels: ${message}`}).eq('mailbox',mailbox);return {mailbox,error:message};
 }finally{await db.from('gmail_label_mailboxes').update({lock_until:null}).eq('mailbox',mailbox)}
}
export async function refreshLeadLabels(db:any,leadId:string){
 const rows=checked(await db.from('gmail_label_queue').select('mailbox').eq('lead_id',leadId).eq('done',false));
 for(const mailbox of [...new Set(rows.map((r:Row)=>r.mailbox))]){
  const state=await db.from('mailbox_sync_state').select('secret_name').eq('mailbox',mailbox).maybeSingle();
  if(state.data?.secret_name)await runLabelBatch(db,mailbox as string,state.data.secret_name,{lead_id:leadId,limit:10});
 }
}