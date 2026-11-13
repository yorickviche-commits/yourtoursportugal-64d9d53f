import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, leadCard } from './index.ts';
import { SetChecklist, CompleteTask, UpdateLead, eventWindow } from './contracts.ts';
import { addonChecklist, ITEMS } from '../_shared/workbenchChecklist.ts';
function assert(value:unknown,message='Assertion failed'):asserts value {if(!value)throw new Error(message)}
const id='0e1e673c-428f-4213-be5a-64e971d9a2cf';
Deno.test('pct excludes N/A and rounds ok / applicable',()=>{
 const result=addonChecklist('ops',ITEMS.ops.map(([item_key],i)=>({item_key,status:i===0?'ok':i===1?'pending':'na',source:'auto'})),[]);
 assert(result.pct===50);
});
Deno.test('missing precedes pending, checklist precedes tasks, limit five',()=>{
 const result=addonChecklist('ops',[{item_key:'transport',status:'missing',source:'manual'}],[{title:'Tarefa'}]);
 assert(result.next_steps[0]==='Confirmar transporte');assert(result.next_steps.length===5);assert(!result.next_steps.includes('Tarefa'));
});
Deno.test('missing rows use current side defaults and manual note survives',()=>{
 const result=addonChecklist('sales',[{item_key:'plan',status:'ok',source:'manual',note:'Revisto'}],[]);
 assert(result.items.length===6);assert(result.items[0].status==='pending');assert(result.items[1].source==='manual'&&result.items[1].note==='Revisto');
});
Deno.test('checklist accepts four statuses only',()=>{
 for(const status of ['ok','pending','missing','na'])assert(SetChecklist.safeParse({lead_id:id,item_key:'guide',status}).success);
 assert(!SetChecklist.safeParse({lead_id:id,item_key:'guide',status:'done'}).success);
});
Deno.test('complete_task requires UUID',()=>assert(!CompleteTask.safeParse({task_id:'invalid'}).success));
Deno.test('lead fields whitelist strips unknown fields, no stages or ids',()=>{
 const d=UpdateLead.parse({lead_id:id,fields:{phone:'123',status:'won',yt_id:'YT9999',active_version:99}});
 assert(Object.keys(d.fields).join(',')==='phone');
});
Deno.test('lead validates dates, client type and numeric override',()=>{
 for(const fields of [{trip_start:'2026-02-30'},{client_type:'B2X'},{pvp_override:'100'},{pax:-1}])assert(!UpdateLead.safeParse({lead_id:id,fields}).success);
 assert(UpdateLead.safeParse({lead_id:id,fields:{pvp_override:null,client_type:'B2B',trip_finish:'2026-11-02'}}).success);
});
Deno.test('calendar dates include full last day plus two, search -90/+365, no dates 30',()=>{
 const now=new Date('2026-11-13T12:00:00Z');
 const w=eventWindow({trip_start:'2026-10-25',trip_finish:'2026-11-02'},undefined,now);
 assert(w.from==='2026-10-23T00:00:00.000Z'&&w.to==='2026-11-05T00:00:00.000Z');
 const search=eventWindow({},'YT5057',now);assert((Date.parse(search.to)-+now)/86400000===365&&(+now-Date.parse(search.from))/86400000===90);
 assert((Date.parse(eventWindow({},undefined,now).to)-+now)/86400000===30);
});
Deno.test({name:'YT5057 internal real reads and mutation errors without any writes',ignore:!Deno.env.get('LOVABLE_BROWSER_SUPABASE_SESSION_JSON'),sanitizeResources:false,sanitizeOps:false,fn:async()=>{
 const session=JSON.parse(Deno.env.get('LOVABLE_BROWSER_SUPABASE_SESSION_JSON')||'{}');
 const sb=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{Authorization:`Bearer ${session.access_token}`}},auth:{persistSession:false}});
 const readonly={from:(table:string)=>new Proxy(sb.from(table),{get(target,key){if(['insert','update','upsert','delete'].includes(String(key)))throw new Error('Write attempted during read-only test');const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v}}),rpc:()=>{throw new Error('RPC prohibited during test')}};
 const actor={email:'internal-test@yourtours.pt',label:'Internal read-only test',userId:null};
 const card=await leadCard(readonly,id);assert(card?.yt_id==='YT5057');assert(card.checklist.side==='ops');assert(card.open_tasks.length<=10);
 const rows=await sb.from('workbench_checklist').select('item_key,status,source,note').eq('lead_id',id);assert(!rows.error);
 assert(JSON.stringify(card.checklist)===JSON.stringify(addonChecklist('ops',rows.data||[],card.open_tasks)));
 for(const action of ['set_checklist','complete_task','update_lead']){
  let failed=false;try{await handle(readonly,action,{lead_id:id},actor)}catch{failed=true}assert(failed,`${action} must reject invalid input`);
 }
 const invalidItem=await handle(readonly,'set_checklist',{lead_id:id,item_key:'not_an_item',status:'ok'},actor);assert(invalidItem.ok===false);
 const absentTask=await handle(readonly,'complete_task',{task_id:'00000000-0000-4000-8000-000000000000'},actor);assert(absentTask.ok===false);
 const invalidDates=await handle(readonly,'update_lead',{lead_id:id,fields:{trip_start:'2026-11-03',trip_finish:'2026-11-02'}},actor);assert(invalidDates.ok===false);
 for(const data of [{lead_id:id},{lead_id:id,q:'YT5057'}]){const result=await handle(readonly,'list_events',data,actor);assert(result.ok&&'events' in result);assert(result.events!==undefined);assert(result.events.length<=20);for(const e of result.events)assert(typeof e.linked_to_this==='boolean'&&'linked_yt' in e)}
}});