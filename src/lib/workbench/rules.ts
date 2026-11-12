export type Side = 'sales' | 'ops';
export type Status = 'ok' | 'pending' | 'missing' | 'na';
export const ITEMS = {
  ops: [['guide','Guia'],['transport','Transporte'],['pickup','Pick-up'],['contact','Contacto do cliente'],['suppliers','Fornecedores'],['payment','Pagamento'],['briefing','Briefing']],
  sales: [['file','File criada'],['plan','Travel plan'],['costing','Costing'],['proposal','Proposta enviada'],['followup','Follow-up'],['payment_link','Link de pagamento']],
} as const;
export const statusText: Record<Status,string> = {ok:'OK',pending:'Pendente',missing:'Em falta',na:'N/A'};
export const nextStatus = (status: Status): Status => ({ok:'pending',pending:'missing',missing:'na',na:'ok'} as const)[status];
export function readiness(rows: {status:string}[]) {
  const applicable = rows.filter(r=>r.status !== 'na');
  return applicable.length ? Math.round(100 * applicable.filter(r=>r.status==='ok').length/applicable.length) : 0;
}
export function belongsToSide(lead: {nethunt_stage?:string|null;status?:string|null}, side:Side) {
  if (/archive/i.test(lead.nethunt_stage||'') || lead.status==='lost') return false;
  if (lead.nethunt_stage) return lead.nethunt_stage.startsWith(side==='ops'?'OPERATIONS':'SALES');
  return side==='ops' ? lead.status==='won' : lead.status!=='won';
}
export const normRef=(x:string)=>x.toUpperCase().replace(/[\s-]/g,'');
export const findRefs=(text:string)=>[...(text.match(/\bYT[\s-]*\d{4}(?:[\s-]*\d{3,})?\b/gi)||[]),...(text.match(/\b[A-Z]{2,5}-\d{5,}\b/g)||[])].map(normRef);
export function matchThread(text:string,email:string,leads:{id:string;yt_id?:string|null;email?:string|null;bokun_confirmation_code?:string|null}[]) {
  const refs=findRefs(text);
  const byRef=leads.filter(l=>(l.yt_id && refs.includes(normRef(l.yt_id)))||(l.bokun_confirmation_code&&refs.includes(normRef(l.bokun_confirmation_code))));
  if(byRef.length===1)return byRef[0];
  if(byRef.length>1)return null;
  const byEmail=leads.filter(l=>email && l.email?.trim().toLowerCase()===email.toLowerCase());
  return byEmail.length===1?byEmail[0]:null;
}
