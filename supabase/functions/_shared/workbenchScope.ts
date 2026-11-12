// Pure shared view rules: no writes, timers, provider calls or runtime dependencies.
export type WorkbenchSide = 'sales' | 'ops';
export type ScopeLead = {id?:string;nethunt_stage?:string|null;status?:string|null;trip_start?:string|null;trip_finish?:string|null;travel_dates?:string|null;travel_end_date?:string|null;date_estimated?:boolean;updated_at?:string|null;nethunt_updated_at?:string|null};
export const lisbonToday = (now=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const workbenchSide = (l:ScopeLead):WorkbenchSide => /^OPERATIONS/i.test(l.nethunt_stage||'') || (!/^SALES/i.test(l.nethunt_stage||'') && l.status==='won') ? 'ops' : 'sales';
const MONTHS:Record<string,number>={jan:1,january:1,janeiro:1,enero:1,feb:2,february:2,fevereiro:2,febrero:2,mar:3,march:3,marco:3,marzo:3,apr:4,april:4,abril:4,may:5,maio:5,mayo:5,jun:6,june:6,junho:6,junio:6,jul:7,july:7,julho:7,julio:7,aug:8,august:8,agosto:8,sep:9,sept:9,september:9,setembro:9,septiembre:9,oct:10,october:10,outubro:10,octubre:10,nov:11,november:11,novembro:11,noviembre:11,dec:12,december:12,dezembro:12,diciembre:12};
const pad=(n:number)=>String(n).padStart(2,'0');
const validIso=(y:number,m:number,d:number)=>{const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?`${y}-${pad(m)}-${pad(d)}`:null;};
/** Parses a free-text travel date: exact ISO, or an estimated first day of month/day text. */
export function parseTravelDate(raw?:string|null):{date:string;estimated:boolean}|null{
 const t=(raw||'').trim();if(!t)return null;
 let m=t.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);if(m){const d=validIso(+m[1],+m[2],+m[3]);return d?{date:d,estimated:false}:null;}
 m=t.match(/^(\d{4})-(\d{2})$/);if(m){const d=validIso(+m[1],+m[2],1);return d?{date:d,estimated:true}:null;}
 const n=t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const year=n.match(/\b(20\d{2})\b/);if(!year)return null;
 const mon=Object.keys(MONTHS).sort((a,b)=>b.length-a.length).find(k=>new RegExp(`\\b${k}\\b`).test(n));if(!mon)return null;
 const month=MONTHS[mon];
 if(/\b(ultima|last)\s+(semana|week)\b/.test(n)){const d=validIso(+year[1],month,24);return d?{date:d,estimated:true}:null;}
 const day=n.replace(year[1],'').match(/\b([0-3]?\d)(?:st|nd|rd|th)?\b/);
 const d=validIso(+year[1],month,day?+day[1]:1);return d?{date:d,estimated:true}:null;
}
/** In-memory only: fills empty trip dates from Dados Gerais text. Never persisted. */
export function withDerivedDates<T extends ScopeLead>(l:T):T{
 if(l.trip_start&&l.trip_finish)return l;
 const s=l.trip_start?null:parseTravelDate(l.travel_dates);
 const fRaw=l.trip_finish?null:parseTravelDate(l.travel_end_date);
 const f=fRaw&&!fRaw.estimated?fRaw:null;
 return {...l,trip_start:l.trip_start||s?.date||null,trip_finish:l.trip_finish||f?.date||null,date_estimated:!!(s?.estimated)};
}
export function workbenchScope(l0:ScopeLead,today=lisbonToday()) {
 const l=withDerivedDates(l0);
 const side=workbenchSide(l),stage=l.nethunt_stage||'',start=l.trip_start?.slice(0,10)||null;
 const date=side==='ops'?(l.trip_finish?.slice(0,10)||start):start;
 const reason=/archive/i.test(stage)?'arquivada':/lost|cancelled|canceled/i.test(l.status||'')||/cancelled|canceled/i.test(stage)?'perdida-cancelada':date&&date<today?'data passada':null;
 const deferred=/deferred|postponed/i.test(stage);
 const eligible=side==='ops'?(l.status==='won'||/^OPERATIONS/i.test(stage)):(stage?/New Lead|Budgeting\s*&\s*Fine-Tuning|Final Negotiation\s*&\s*Ready to Book/i.test(stage):['new','contacted','qualified','proposal_sent','negotiation'].includes(l.status||'new'));
 return {side,date,reason,archived:!!reason,active:!reason&&!deferred&&eligible&&(side==='sales'||!!date),undated:!start,estimated:!!l.date_estimated,deferred};
}
// A date-based archive begins at Lisbon midnight after the final applicable day.
// Stage/loss archives use the existing change timestamp (no new archive field).
export function archiveCutoff(l:ScopeLead,today=lisbonToday()) {
 const s=workbenchScope(l,today);
 if(s.reason==='data passada'&&s.date){const next=new Date(`${s.date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);const key=next.toISOString().slice(0,10);const utc=Date.parse(`${key}T00:00:00Z`);return lisbonToday(new Date(utc-3600000))===key?utc-3600000:utc;}
 return Date.parse(l.nethunt_updated_at||l.updated_at||'')||Infinity;
}
export function activeWorkbenchThread(t:{lead_id?:string|null;last_message_at?:string|null;from_email?:string|null},lead:ScopeLead|undefined,today=lisbonToday()) {
 if(!t.lead_id)return true;
 if(!lead)return false;
 const s=workbenchScope(lead,today);
 if(s.active)return true;
 // Outgoing messages must not resurrect an archived file in the active inbox.
 return s.archived&&!/^(reservas|operations)@yourtours\.pt$/i.test(t.from_email||'')&&Date.parse(t.last_message_at||'')>=archiveCutoff(lead,today);
}
export function hasOutstandingOperations(ops:{booking_status?:string|null;payment_status?:string|null;invoice_status?:string|null}[],paid:number,total:number,checks:{status:string}[]=[]) {
 return total>0&&Math.round(paid*100)<Math.round(total*100)||ops.some(o=>!['booked','confirmed','cancelled','canceled','na'].includes(o.booking_status||'')||['pending','to_pay','unpaid','backoffice_pending','not_paid','partially_paid','guide_to_pay','monthly_account'].includes(o.payment_status||'')||['pending','missing','requested','not_received','invoice_requested'].includes(o.invoice_status||''))||checks.some(c=>['pending','missing'].includes(c.status));
}