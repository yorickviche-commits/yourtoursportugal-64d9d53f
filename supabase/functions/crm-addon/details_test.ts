import { emailParty, supplierEmails, excerpt, eventDetails, hydrateEvents } from './details.ts';
import { handle, directCandidates, emailContext, linkCurrent } from './index.ts';
function assert(v: unknown, m = 'Assertion failed'): asserts v { if (!v) throw new Error(m); }
const id = '17ef2e99-3def-43e4-962e-72a3ae60f465';
const actor = { email: 'test@yourtours.pt', label: 'test', userId: null };
function fakeDB(tables: Record<string, any[]>, calls: any[] = []) {
  return { from(table: string) {
    const state: any = { table, filters: [], op: 'read' }; calls.push(state);
    const q: any = {
      select(c: string) { state.cols = c; return q; }, order() { return q; }, limit(n: number) { state.limit = n; return q; }, range() { return q; },
      eq(k: string, v: any) { state.filters.push(['eq',k,v]); return q; }, neq() { return q; }, lt() { return q; },
      in(k: string, v: any[]) { state.filters.push(['in',k,v]); return q; }, ilike(k: string,v: string) { state.filters.push(['ilike',k,v]); return q; }, or(v: string) { state.or = v; return q; },
      maybeSingle() { state.single = true; return q; },
      upsert(row: any, opts: any) { state.op='upsert';state.row=row;state.opts=opts;return q; },
      insert(row: any) { state.op='insert';state.row=row;return q; }, update(row: any) { state.op='update';state.row=row;return q; },
      then(resolve: any, reject: any) {
        let rows = (tables[table] || []).filter(r => state.filters.every(([op,k,v]: any[]) => op==='eq' ? r[k]===v : op==='in' ? v.includes(r[k]) : String(r[k]||'').toLowerCase().endsWith(v.toLowerCase().replace(/^%/,''))));
        if (state.or) rows=rows.filter(r=>state.or.split(',').some((f:string)=>{const [k,,...v]=f.split('.');const term=v.join('.').replace(/%/g,'').toLowerCase();return String(r[k]||'').toLowerCase().includes(term)}));
        if (state.limit) rows=rows.slice(0,state.limit);
        return Promise.resolve({ data: state.single ? rows[0] || null : rows, error: null }).then(resolve,reject);
      },
    }; return q;
  } };
}
Deno.test('party exact normalized client, supplier primary precedence, internal and other', () => {
  const emails = supplierEmails(' INFO@OGOTOURS.COM; second@example.com third@example.com, info@ogotours.com');
  assert(emails.length===3 && emails[0]==='info@ogotours.com');
  const map=new Map([['info@ogotours.com',{name:'OgoTours Madrid'}]]), lead={email:' CLIENT@EXAMPLE.COM ',client_name:'YT5148 - John'};
  assert(emailParty({from_email:'client@example.com',to_emails:['reservas@yourtours.pt'],direction:'in'},lead,map).party==='client');
  const fse=emailParty({from_email:'INFO@OGOTOURS.COM',to_emails:['client@example.com'],direction:'in'},lead,map);
  assert(fse.party==='fse'&&fse.party_name==='OgoTours Madrid');
  assert(emailParty({from_email:'reservas@yourtours.pt',to_emails:['info@ogotours.com','client@example.com'],direction:'out'},lead,map).party==='fse');
  assert(emailParty({from_email:'reservas@yourtours.pt',to_emails:['operations@yourtours.pt'],direction:'out'},lead,map).party==='internal');
  assert(emailParty({from_email:'unknown@example.com',to_emails:[],direction:'in'},lead,map).party==='other');
});
Deno.test('body and description limited to 1500; Calendar ISO time/location/link and no HTML', () => {
  assert(excerpt('x'.repeat(1600)).length===1500);
  const e=eventDetails({summary:'Madrid',start:{dateTime:'2027-01-02T09:00:00+01:00'},end:{date:'2027-01-03'},location:'Plaza Mayor',description:'<p>Tour &amp; tapas</p>'+ 'x'.repeat(1600),htmlLink:'https://calendar.google.com/event?eid=example'});
  assert(e.title==='Madrid'&&e.start_at==='2027-01-02T09:00:00+01:00'&&e.end_at==='2027-01-03T00:00:00Z');
  assert(e.location==='Plaza Mayor'&&e.html_link?.includes('calendar.google.com')&&e.description.startsWith('Tour & tapas\n')&&e.description.length===1500);
});
Deno.test('linked current email reopens with zero Gmail/network calls or message writes', async () => {
  const calls: any[]=[], sb=fakeDB({leads:[{id,yt_id:'YT5148',client_name:'John',email:'john@example.com'}],email_links:[{lead_id:id,mailbox:'reservas@yourtours.pt',gmail_message_id:'m1',gmail_thread_id:'t1',link_source:'manual',unlinked:false,sent_at:'2026-11-24T10:00:00Z'}]},calls);
  const old=globalThis.fetch;let network=0;globalThis.fetch=(()=>{network++;throw new Error('Network prohibited')}) as typeof fetch;
  try { const r=await emailContext(sb,{mailbox:'reservas@yourtours.pt',gmail_message_id:'m1',gmail_thread_id:'t1',subject:'',from:'john@example.com',to:'reservas@yourtours.pt',cc:'',body_excerpt:''},actor); assert(r.linked?.yt_id==='YT5148');assert(network===0);assert(!calls.some(c=>c.op!=='read')); } finally { globalThis.fetch=old; }
});
Deno.test('known thread adds only current message without Gmail calls and preserves manual unlink on race', async () => {
  const calls:any[]=[], sb=fakeDB({},calls);let network=0;const old=globalThis.fetch;globalThis.fetch=(()=>{network++;throw new Error('No Gmail')}) as typeof fetch;
  try {await linkCurrent(sb,{mailbox:'reservas@yourtours.pt',gmail_message_id:'new',subject:'',from:'john@example.com',to:'reservas@yourtours.pt',cc:'',body_excerpt:''},id,'thread',actor,false,false);await new Promise(r=>setTimeout(r,0));assert(network===0);const writes=calls.filter(c=>c.table==='email_links'&&c.op==='upsert');assert(writes.length===1&&writes[0].row.gmail_message_id==='new'&&writes[0].opts.ignoreDuplicates===true);}finally{globalThis.fetch=old;}
});
Deno.test('direct candidates query YT/Bokun/email/domain without full lead index', async () => {
  const calls:any[]=[],sb=fakeDB({leads:[{id,yt_id:'YT5148',email:'john@example.com',bokun_confirmation_code:'AB-12345'}]},calls);
  const refs=await directCandidates(sb,'YT5148 AB-12345',['JOHN@EXAMPLE.COM']);assert(refs.refIds[0]===id);
  assert(calls.some(c=>c.filters.some((f:any)=>f[1]==='yt_id'&&f[2].includes('YT5148'))));
  assert(calls.some(c=>c.filters.some((f:any)=>f[1]==='bokun_confirmation_code'&&f[2].includes('AB-12345'))));
  assert(calls.every(c=>c.cols==='id'&&c.limit===10));
  const domainCalls:any[]=[],domain=fakeDB({leads:[{id,email:'another@agency.com'}]},domainCalls);
  const match=await directCandidates(domain,'',['person@agency.com']);assert(match.ids[0]===id);
  assert(domainCalls.some(c=>c.filters.some((f:any)=>f[0]==='ilike'&&f[2]==='%@agency.com')));
});
Deno.test('search YT exact first uses one lightweight query and no card joins', async () => {
  const calls:any[]=[],sb=fakeDB({leads:[{id,yt_id:'YT5148',client_name:'YT5148 - John'}]},calls);
  const r=await handle(sb,'search',{q:'yt 5148'},actor);assert('results' in r&&r.results[0].yt_id==='YT5148'&&r.results[0].lightweight===true);
  assert(calls.length===1&&calls[0].filters[0][1]==='yt_id'&&calls[0].filters[0][2]==='YT5148');
});
Deno.test('Calendar cached row makes no call, stale row enriches and stores only details; failure falls back', async () => {
  const calls:any[]=[],sb=fakeDB({integration_settings:[{name:'google_calendar',config:{calendar_id:'reservas'}}]},calls);
  const old=globalThis.fetch;let network=0;
  globalThis.fetch=(async()=>{network++;return new Response(JSON.stringify({summary:'Tour real',start:{dateTime:'2027-01-02T09:00:00Z'},end:{dateTime:'2027-01-02T13:00:00Z'},location:'Madrid',description:'<b>Guia Javier</b>',htmlLink:'https://calendar.google.com/event'}),{status:200})}) as typeof fetch;
  const oldKey=Deno.env.get('GOOGLE_CALENDAR_API_KEY'),oldApi=Deno.env.get('LOVABLE_API_KEY');Deno.env.set('GOOGLE_CALENDAR_API_KEY','test');Deno.env.set('LOVABLE_API_KEY','test');
  try {
    const make=(fresh:boolean)=>({type:'event',at:'2027-01-02T09:00:00Z',title:'Fallback',url:null,_table:'calendar_events',_row:{id:'cache',google_event_id:'e',title:'Cached',description:'Cached description',details_synced_at:fresh?new Date().toISOString():null}});
    const cached=await hydrateEvents(sb,[make(true)]);assert(network===0&&cached[0].title==='Cached');
    const fresh=await hydrateEvents(sb,[make(false)]);assert(Number(network)===1&&fresh[0].title==='Tour real'&&fresh[0].location==='Madrid'&&fresh[0].description==='Guia Javier'&&fresh[0].end==='2027-01-02T13:00:00Z');
    const patch=calls.find(c=>c.op==='update').row;assert(patch.details_synced_at&&Object.keys(patch).length===7&&!('last_synced_at' in patch));
    await hydrateEvents(sb,[make(false)]);assert(Number(network)===1,'Warm isolate must reuse details');
    globalThis.fetch=(async()=>new Response('Unavailable',{status:503})) as typeof fetch;
    const stale=make(false);stale._row.google_event_id='failure';stale._row.details_synced_at=new Date(Date.now()-7*3600000).toISOString();
    const fallback=await hydrateEvents(sb,[stale]);assert(fallback[0].title==='Cached'&&fallback[0].description==='Cached description');
  } finally {globalThis.fetch=old;for(const [k,v]of [['GOOGLE_CALENDAR_API_KEY',oldKey],['LOVABLE_API_KEY',oldApi]])v===undefined?Deno.env.delete(k as string):Deno.env.set(k as string,v);}
});