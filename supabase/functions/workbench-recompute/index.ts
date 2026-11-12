import {workbenchUser,corsHeaders,json} from '../_shared/workbench.ts';
import {workbenchScope,workbenchSide,lisbonToday,withDerivedDates} from '../_shared/workbenchScope.ts';
const ITEMS={ops:[['guide','Guia'],['transport','Transporte'],['pickup','Pick-up'],['contact','Contacto do cliente'],['suppliers','Fornecedores'],['payment','Pagamento'],['briefing','Briefing']],sales:[['file','File criada'],['plan','Travel plan'],['costing','Costing'],['proposal','Proposta enviada'],['followup','Follow-up'],['payment_link','Link de pagamento']]};
type Row=Record<string,any>;
// Paginated, column-limited loads (Data API caps each request at 1000 rows).
async function all(db:any,table:string,cols:string,ids?:string[],build?:(q:any)=>any):Promise<Row[]>{
 const out:Row[]=[];const chunks=ids?Array.from({length:Math.ceil(ids.length/150)},(_,i)=>ids.slice(i*150,i*150+150)):[null];
 for(const chunk of chunks){for(let from=0;;from+=1000){let q=db.from(table).select(cols).range(from,from+999);if(chunk)q=q.in('lead_id',chunk);if(build)q=build(q);const r=await q;if(r.error)throw new Error(`${table}: ${r.error.message}`);out.push(...(r.data||[]));if((r.data||[]).length<1000)break}}
 return out;
}
const by=(rows:Row[])=>{const m=new Map<string,Row[]>();for(const r of rows){const a=m.get(r.lead_id)||[];a.push(r);m.set(r.lead_id,a)}return (id:string)=>m.get(id)||[]};
// Business hours elapsed (Mon–Fri, 09:00–18:00 Lisboa ~ UTC) between t and now.
function businessHours(t:number){let h=0;for(let x=t;x<Date.now();x+=3600000){const d=new Date(x);const wd=d.getUTCDay(),hr=d.getUTCHours();if(wd>0&&wd<6&&hr>=9&&hr<18)h++}return h}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 try{
 const {db}=await workbenchUser(req);
 const today=lisbonToday();
 const everyLead=(await all(db,'leads','id,yt_id,status,nethunt_stage,active_version,phone,email,trip_start,trip_finish,travel_dates,travel_end_date,trip_briefing,pvp_override,client_type')).map(withDerivedDates);
 const leads=everyLead.filter(l=>workbenchScope(l,today).active);
 // Existing refresh closes stale alerts; no scheduled work or lead-stage writes.
 const inactiveIds=everyLead.filter(l=>!workbenchScope(l,today).active).map(l=>l.id);
 let closedAlerts=0;
 for(let i=0;i<inactiveIds.length;i+=150){const r=await db.from('workbench_alerts').update({status:'handled',handled_at:new Date().toISOString()}).in('lead_id',inactiveIds.slice(i,i+150)).neq('status','handled').select('id');if(r.error)throw r.error;closedAlerts+=(r.data||[]).length;}
 const ids=leads.map(l=>l.id);
 const [plans,costs,operations,days,payments,links,versions,tasks,settings,checks,alerts,travelPlans,threads]=await Promise.all([
  all(db,'lead_planner_data','lead_id,version',ids),all(db,'lead_costing_data','lead_id,version,items',ids),
  all(db,'lead_operations','lead_id,activity_title,booking_status,net_value,real_cost,updated_at',ids),all(db,'lead_day_ops','lead_id,pickup_time,pickup_location',ids),
  all(db,'lead_payments','lead_id,amount',ids),all(db,'payment_links','lead_id,is_active,expires_at,installments',ids),
  all(db,'lead_versions','lead_id,version,pvp_override,general_data',ids),all(db,'tasks','lead_id,completed,due_date',ids),
  all(db,'workbench_settings','key,value'),all(db,'workbench_checklist','lead_id,item_key,status,source',ids),
  all(db,'workbench_alerts','lead_id,side,reason,status',ids,q=>q.neq('status','handled')),all(db,'travel_plans','lead_id,version',ids),
  all(db,'workbench_threads','id,lead_id,mailbox,ball,last_message_at',undefined,q=>q.eq('in_inbox',true))]);
 const S=(k:string,d:number)=>Number(settings.find(s=>s.key===k)?.value??d);
 const H={trip:S('trip_missing_hours',72),deadline:S('deadline_hours',48),supplier:S('supplier_change_days',14),wait:S('client_wait_business_hours',4)};
 const P=by(plans),C=by(costs),O=by(operations),D=by(days),PAY=by(payments),LINK=by(links),V=by(versions),T=by(tasks),CH=by(checks),TP=by(travelPlans);
 const updates:Row[]=[];const newAlerts:Row[]=[];const alertLeads=new Set<string>();
 const alert=(l:Row,side:string,reason:string,next:string)=>{alertLeads.add(l.id);if(!alerts.some(a=>a.lead_id===l.id&&a.side===side&&a.reason===reason)&&!newAlerts.some(a=>a.lead_id===l.id&&a.reason===reason))newAlerts.push({lead_id:l.id,side,title:l.yt_id||'File',reason,next_step:next})};
 for(const a of alerts)alertLeads.add(a.lead_id);
 for(const l of leads){
 const side=workbenchSide(l);
 const ver=l.active_version||0;const v=V(l.id).find(x=>x.version===ver);const c=C(l.id).filter(x=>x.version===ver);const o=O(l.id);const d=D(l.id);
 const total=Number(v?.pvp_override??l.pvp_override??c.flatMap(x=>x.items||[]).filter((x:Row)=>!['opcionais','eliminar'].includes(x.status)).reduce((a:number,x:Row)=>a+(Number(x.pvpTotal)||0),0));
 const paid=PAY(l.id).reduce((a,x)=>a+Number(x.amount||0),0);
 const booking=(rows:Row[])=>!rows.length?'pending':rows.every(x=>['booked','confirmed'].includes(x.booking_status))?'ok':rows.some(x=>['sent','requested'].includes(x.booking_status))?'pending':'missing';
 const guide=o.filter(x=>/guia|guide/i.test(x.activity_title||''));const transport=o.filter(x=>/transporte|transport|transfer|ve[ií]culo|driver|motorista/i.test(x.activity_title||''));
 const noField=!guide.length&&!transport.length; // hotel-only or service not provided by us
 const b=(l.trip_briefing&&typeof l.trip_briefing==='object')?l.trip_briefing:{};const g=(v?.general_data&&typeof v.general_data==='object')?v.general_data:{};
 const pickupOk=(d.length&&d.every(x=>x.pickup_time&&x.pickup_location))||(b.pickup_time&&b.pickup_hotel)||((g.pickup_time||g.pickupTime)&&(g.pickup_location||g.pickupLocation||g.pickup_hotel));
 const proposalSent=['proposal_sent','negotiation','won'].includes(l.status)||/Negotiation|Ready to Book/i.test(l.nethunt_stage||'');
 const states:Record<string,string>={file:'ok',plan:P(l.id).some(x=>x.version===ver)||TP(l.id).some(x=>x.version===ver)?'ok':'missing',costing:c.length?'ok':'missing',proposal:proposalSent?'ok':'pending',
  followup:!proposalSent?'na':T(l.id).some(x=>!x.completed&&x.due_date)?'ok':'pending',payment_link:l.client_type==='B2B'?'na':LINK(l.id).some(x=>x.is_active)?'ok':'pending',
  guide:noField?'na':guide.length?booking(guide):'pending',transport:noField?'na':transport.length?booking(transport):'pending',pickup:noField?'na':pickupOk?'ok':'pending',
  contact:l.phone||l.email?'ok':'missing',suppliers:booking(o),payment:total>0&&paid>=total-0.01?'ok':paid>0?'pending':'missing',briefing:noField?'na':Object.keys(b).filter(k=>k!=='updated_at').length?'ok':'pending'};
 for(const [key,label]of ITEMS[side])updates.push({lead_id:l.id,item_key:key,label,status:states[key]});
 const actual=ITEMS[side].map(([key])=>{const m=CH(l.id).find(x=>x.item_key===key);return m?.source==='manual'?m.status:states[key]});
 const hoursAway=l.trip_start?(Date.parse(`${l.trip_start}T00:00:00Z`)-Date.now())/3600000:Infinity;
 // (1) trip soon with missing checklist (manual values included)
 if(side==='ops'&&hoursAway>=0&&hoursAway<=H.trip&&actual.includes('missing'))alert(l,side,`Viagem nas próximas ${H.trip} horas com itens em falta`,'Completar checklist');
 // (2) deadlines: active payment link expiry / installment due date while money is owed
 if(paid<total-0.01)for(const k of LINK(l.id).filter(x=>x.is_active)){const dates=[k.expires_at,...(Array.isArray(k.installments)?k.installments.map((i:Row)=>i.dueDate||i.due_date||i.date):[])].filter(Boolean);
  if(dates.some((x:string)=>{const t=(Date.parse(x)-Date.now())/3600000;return t>=0&&t<=H.deadline}))alert(l,side,`Prazo de pagamento nas próximas ${H.deadline} horas`,'Confirmar pagamento com o cliente');}
 // (3) operations line changed/not confirmed recently with trip close
 if(hoursAway>=0&&hoursAway<=H.supplier*24&&o.some(x=>!['booked','confirmed'].includes(x.booking_status)&&Date.now()-Date.parse(x.updated_at)<48*3600000))alert(l,side,`Fornecedor alterado ou por confirmar a menos de ${H.supplier} dias`,'Rever linha em Operações');
 // (4) client waiting for our reply
 if(/Final Negotiation|Ready to Book/i.test(l.nethunt_stage||'')&&threads.some(t=>t.lead_id===l.id&&t.mailbox==='sales'&&t.ball==='ours'&&t.last_message_at&&businessHours(Date.parse(t.last_message_at))>H.wait))alert(l,'sales',`Cliente pronto à espera há mais de ${H.wait} horas úteis`,'Responder ao cliente');
 // (5) money differences
 if(total>0&&paid>total+0.01)alert(l,side,'Pagamentos registados acima do valor devido','Verificar pagamentos');
 if(o.some(x=>Number(x.real_cost)>0&&Number(x.net_value)>0&&Math.round(Number(x.real_cost)*100)>Math.round(Number(x.net_value)*100)))alert(l,side,'Real (€) acima do NET orçado','Rever custos em Operações');
 }
 const batch=await db.rpc('workbench_apply_auto_checklist',{p_rows:updates});if(batch.error)throw batch.error;
 if(newAlerts.length){const r=await db.from('workbench_alerts').insert(newAlerts);if(r.error&&r.error.code!=='23505')throw r.error}
 // Thread urgency follows open alerts; otherwise today (our turn) / week.
 const groups:Record<string,string[]>={urgent:[],today:[],week:[]};
 for(const t of threads)groups[t.lead_id&&alertLeads.has(t.lead_id)?'urgent':t.ball==='ours'?'today':'week'].push(t.id);
 for(const [u,list] of Object.entries(groups))for(let i=0;i<list.length;i+=150){const r=await db.from('workbench_threads').update({urgency:u}).in('id',list.slice(i,i+150));if(r.error)throw r.error}
 return json({ok:true,items:updates.length,alerts:newAlerts.length,closed_alerts:closedAlerts,counts:Object.fromEntries(['sales','ops'].map(side=>[side,{active:leads.filter(l=>workbenchSide(l)===side).length,archive:everyLead.filter(l=>workbenchSide(l)===side&&workbenchScope(l,today).archived).length,excluded:everyLead.filter(l=>workbenchSide(l)===side&&!workbenchScope(l,today).active&&!workbenchScope(l,today).archived).length}]))});
 }catch(e){const message=e instanceof Error?e.message:String(e);return json({error:message},message.startsWith('401')?401:message.startsWith('403')?403:500)}
});
