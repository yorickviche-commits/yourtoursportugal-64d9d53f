import {z} from 'npm:zod@3';
import {workbenchUser,gateway,corsHeaders,json} from '../_shared/workbench.ts';
const addresses={sales:'reservas@yourtours.pt',ops:'operations@yourtours.pt'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 try{
 const {db}=await workbenchUser(req);
 const {side}=z.object({side:z.enum(['sales','ops'])}).parse(await req.json());
 const settings=await db.from('workbench_settings').select('value').eq('key',`mailbox_${side}`).maybeSingle();if(settings.error)throw settings.error;
 const keyName=(settings.data?.value as {secret_name?:string}|null)?.secret_name;
 if(!keyName)return json({connected:false,error:`Ligar caixa: falta configurar a caixa ${addresses[side]}`});
 if(!Deno.env.get(keyName))return json({connected:false,error:`Ligar caixa: liga a conta Gmail ${addresses[side]} nos conectores (Gmail) do workspace e associa-a a este projeto.`});
 if(!/^GOOGLE_MAIL_API_KEY(?:_\d+)?$/.test(keyName))throw new Error('Ligação inválida');
 const profile=await (await gateway('google_mail',keyName,'/gmail/v1/users/me/profile')).json();
 if(profile.emailAddress?.toLowerCase()!==addresses[side])return json({connected:false,error:`Ligar caixa: a ligação atual não corresponde a ${addresses[side]}`});
 const leads={data:[] as {id:string;yt_id:string|null;email:string|null;bokun_confirmation_code:string|null}[]};
 for(let f=0;;f+=1000){const r=await db.from('leads').select('id,yt_id,email,bokun_confirmation_code').range(f,f+999);if(r.error)throw r.error;leads.data.push(...(r.data||[]));if((r.data||[]).length<1000)break}
 const norm=(x:string)=>x.toUpperCase().replace(/[\s-]/g,'');
 const seen:string[]=[];let pageToken='';
 do{
 const list=await (await gateway('google_mail',keyName,`/gmail/v1/users/me/threads?labelIds=INBOX&maxResults=50${pageToken?`&pageToken=${encodeURIComponent(pageToken)}`:''}`)).json();
 const ids=(list.threads||[]).map((x:{id:string})=>x.id);seen.push(...ids);
 if(ids.length){
 const boundary='workbench_batch';
 const body=ids.map((id:string)=>`--${boundary}\r\nContent-Type: application/http\r\nContent-ID: <${id}>\r\n\r\nGET /gmail/v1/users/me/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject HTTP/1.1\r\n\r\n`).join('')+`--${boundary}--\r\n`;
 const api=Deno.env.get('LOVABLE_API_KEY'),key=Deno.env.get(keyName);if(!api||!key)throw new Error('Ligar caixa');
 const r=await fetch('https://connector-gateway.lovable.dev/google_mail/batch/gmail/v1',{method:'POST',headers:{Authorization:`Bearer ${api}`,'X-Connection-Api-Key':key,'Content-Type':`multipart/mixed; boundary=${boundary}`},body});
 if(!r.ok)throw new Error(`[${r.status}]: ${await r.text()}`);
 const ct=r.headers.get('Content-Type')||'';const responseBoundary=ct.match(/boundary="?([^";\s]+)/i)?.[1];
 if(!ct.includes('multipart/mixed')||!responseBoundary)throw new Error('Resposta Gmail inesperada');
 const parts=(await r.text()).split(`--${responseBoundary}`).filter(x=>x.includes('HTTP/1.1'));
 if(parts.length!==ids.length)throw new Error('Resposta Gmail incompleta');
 for(const part of parts){const http=part.slice(part.indexOf('HTTP/1.1'));const status=Number(http.match(/^HTTP\/1\.1 (\d+)/)?.[1]);const sep=http.indexOf('\r\n\r\n');if(status<200||status>=300)throw new Error(`Gmail [${status}]: ${http.slice(sep+4)}`);
 const t=JSON.parse(http.slice(sep+4).trim());const messages=t.messages||[];const m=[...messages].sort((a,b)=>Number(b.internalDate)-Number(a.internalDate))[0];if(!m)continue;
 const header=(name:string)=>m.payload?.headers?.find((h:{name:string})=>h.name.toLowerCase()===name.toLowerCase())?.value||'';
 const from=header('From');const email=(from.match(/<([^>]+)>/)?.[1]||from).trim();const subject=header('Subject');
 const text=`${subject} ${messages.map((x:{snippet?:string})=>x.snippet||'').join(' ')}`;
 const refs=[...(text.match(/\bYT[\s-]*\d{4}(?:[\s-]*\d{3,})?\b/gi)||[]),...(text.match(/\b[A-Z]{2,5}-\d{5,}\b/g)||[])].map(norm);
 const refMatches=leads.data.filter(l=>(l.yt_id&&refs.includes(norm(l.yt_id)))||(l.bokun_confirmation_code&&refs.includes(norm(l.bokun_confirmation_code))));
 const emailMatches=leads.data.filter(l=>l.email?.toLowerCase()===email.toLowerCase())||[];
 const lead=refMatches.length===1?refMatches[0]:refMatches.length===0&&emailMatches.length===1?emailMatches[0]:null;
 const up=await db.from('workbench_threads').upsert({mailbox:side,gmail_thread_id:t.id,subject,from_email:email,from_name:from.replace(/<[^>]+>/,'').replace(/"/g,'').trim(),snippet:m.snippet||t.snippet,message_count:messages.length,last_message_at:new Date(Number(m.internalDate)).toISOString(),in_inbox:messages.some(x=>x.labelIds?.includes('INBOX')),lead_id:lead?.id||null,yt_ref:lead?.yt_id||refs[0]||null,updated_at:new Date().toISOString()},{onConflict:'mailbox,gmail_thread_id'});if(up.error)throw up.error;
 }
 }
 pageToken=list.nextPageToken||'';
 }while(pageToken);
 // Only reconcile after a completely successful mailbox read.
 const existing=await db.from('workbench_threads').select('id,gmail_thread_id').eq('mailbox',side).eq('in_inbox',true);if(existing.error)throw existing.error;
 const gone=existing.data?.filter(x=>!seen.includes(x.gmail_thread_id)).map(x=>x.id)||[];
 if(gone.length){const r=await db.from('workbench_threads').update({in_inbox:false,updated_at:new Date().toISOString()}).in('id',gone);if(r.error)throw r.error}
 return json({connected:true,threads:seen.length});
 }catch(e){const message=e instanceof Error?e.message:String(e);return json({connected:false,error:message},message.startsWith('401')?401:message.startsWith('403')?403:502)}
});
