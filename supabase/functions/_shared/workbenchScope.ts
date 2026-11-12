// Pure shared view rules: no writes, timers, provider calls or runtime dependencies.
export type WorkbenchSide = 'sales' | 'ops';
export type ScopeLead = {id?:string;nethunt_stage?:string|null;status?:string|null;trip_start?:string|null;trip_finish?:string|null;updated_at?:string|null;nethunt_updated_at?:string|null};
export const lisbonToday = (now=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const workbenchSide = (l:ScopeLead):WorkbenchSide => /^OPERATIONS/i.test(l.nethunt_stage||'') || (!/^SALES/i.test(l.nethunt_stage||'') && l.status==='won') ? 'ops' : 'sales';
export function workbenchScope(l:ScopeLead,today=lisbonToday()) {
 const side=workbenchSide(l),stage=l.nethunt_stage||'',start=l.trip_start?.slice(0,10)||null;
 const date=side==='ops'?(l.trip_finish?.slice(0,10)||start):start;
 const reason=/archive/i.test(stage)?'arquivada':/lost|cancelled|canceled/i.test(l.status||'')||/cancelled|canceled/i.test(stage)?'perdida-cancelada':date&&date<today?'data passada':null;
 const deferred=/deferred|postponed/i.test(stage);
 const eligible=side==='ops'?(l.status==='won'||/^OPERATIONS/i.test(stage)):(stage?/New Lead|Budgeting\s*&\s*Fine-Tuning|Final Negotiation\s*&\s*Ready to Book/i.test(stage):['new','contacted','qualified','proposal_sent','negotiation'].includes(l.status||'new'));
 return {side,date,reason,archived:!!reason,active:!reason&&!deferred&&eligible&&(side==='sales'||!!date),undated:!start,deferred};
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