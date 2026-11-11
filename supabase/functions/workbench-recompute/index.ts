import {workbenchUser,corsHeaders,json} from '../_shared/workbench.ts';
const ITEMS={ops:[['guide','Guia'],['transport','Transporte'],['pickup','Pick-up'],['contact','Contacto do cliente'],['suppliers','Fornecedores'],['payment','Pagamento'],['briefing','Briefing']],sales:[['file','File criada'],['plan','Travel plan'],['costing','Costing'],['proposal','Proposta enviada'],['followup','Follow-up'],['payment_link','Link de pagamento']]};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 try{
 const {db}=await workbenchUser(req);
 const {data:leads,error}=await db.from('leads').select('id,yt_id,status,nethunt_stage,active_version,phone,email,trip_start,trip_briefing,pvp_override').neq('status','lost');if(error)throw error;
 const sources=['lead_planner_data','lead_costing_data','lead_operations','lead_day_ops','lead_payments','payment_links','lead_versions','tasks','workbench_settings','workbench_checklist','workbench_alerts','travel_plans'];
 const loaded=await Promise.all(sources.map(async t=>{const r=await db.from(t).select('*');if(r.error)throw new Error(`${t}: ${r.error.message}`);return r.data||[]}));
 const [plans,costs,operations,days,payments,links,versions,tasks,settings,existingChecks,existingAlerts,travelPlans]=loaded;
 const hours=Number(settings.find(s=>s.key==='trip_missing_hours')?.value ?? 72);
 const updates:any[]=[];const newAlerts:any[]=[];
 for(const l of leads||[]){
 if(/archive/i.test(l.nethunt_stage||''))continue;
 const side=(l.nethunt_stage?.startsWith('OPERATIONS')||(!l.nethunt_stage&&l.status==='won'))?'ops':'sales';
 const p=plans.filter(x=>x.lead_id===l.id&&x.version===(l.active_version||0));
 const c=costs.filter(x=>x.lead_id===l.id&&x.version===(l.active_version||0));
 const o=operations.filter(x=>x.lead_id===l.id);const d=days.filter(x=>x.lead_id===l.id);
 const v=versions.find(x=>x.lead_id===l.id&&x.version===(l.active_version||0));
 const total=Number(v?.pvp_override??l.pvp_override??c.flatMap(x=>x.items||[]).filter(x=>!['opcionais','eliminar'].includes(x.status)).reduce((a,x)=>a+(Number(x.pvpTotal)||0),0));
 const paid=payments.filter(x=>x.lead_id===l.id).reduce((a,x)=>a+Number(x.amount||0),0);
 const booking=(rows:any[])=>!rows.length?'pending':rows.every(x=>['booked','confirmed'].includes(x.booking_status))?'ok':rows.some(x=>['sent','requested'].includes(x.booking_status))?'pending':'missing';
 const guide=o.filter(x=>/guia|guide/i.test(x.activity_title||''));const transport=o.filter(x=>/transporte|transport|transfer|ve[ií]culo/i.test(x.activity_title||''));
 const states:Record<string,string>={file:'ok',plan:p.length||travelPlans.some(x=>x.lead_id===l.id&&x.version===(l.active_version||0))?'ok':'missing',costing:c.length?'ok':'missing',proposal:l.status==='proposal_sent'||l.status==='negotiation'?'ok':'pending',followup:tasks.some(x=>x.lead_id===l.id&&!x.completed&&x.due_date)?'ok':'pending',payment_link:links.some(x=>x.lead_id===l.id&&x.is_active)?'ok':'pending',guide:guide.length?booking(guide):'pending',transport:transport.length?booking(transport):'pending',pickup:d.length&&d.every(x=>x.pickup_time&&x.pickup_location)?'ok':'pending',contact:l.phone||l.email?'ok':'missing',suppliers:booking(o),payment:total>0&&paid>=total?'ok':paid>0?'pending':'missing',briefing:l.trip_briefing&&Object.keys(l.trip_briefing).length?'ok':'pending'};
 for(const [key,label]of ITEMS[side])updates.push({lead_id:l.id,item_key:key,label,status:states[key]});
 const actual=ITEMS[side].map(([key])=>{const c=existingChecks.find(x=>x.lead_id===l.id&&x.item_key===key);return c?.source==='manual'?c.status:states[key]});
 const distance=l.trip_start?(Date.parse(`${l.trip_start}T00:00:00Z`)-Date.now())/3600000:Infinity;
 if(side==='ops'&&distance>=0&&distance<=hours&&actual.includes('missing')){
 const reason=`Viagem nas próximas ${hours} horas com itens em falta`;
 if(!existingAlerts.some(a=>a.lead_id===l.id&&a.side===side&&a.reason===reason&&a.status!=='handled'))newAlerts.push({lead_id:l.id,side,title:l.yt_id||'Viagem urgente',reason,next_step:'Completar checklist'});
 }
 }
 const batch=await db.rpc('workbench_apply_auto_checklist',{p_rows:updates});if(batch.error)throw batch.error;
 if(newAlerts.length){const result=await db.from('workbench_alerts').insert(newAlerts);if(result.error&&result.error.code!=='23505')throw result.error}
 return json({ok:true,items:updates.length});
 }catch(e){const message=e instanceof Error?e.message:String(e);return json({error:message},message.startsWith('401')?401:message.startsWith('403')?403:500)}
});
