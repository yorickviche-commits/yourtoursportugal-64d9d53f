export type Status = 'ok' | 'pending' | 'missing' | 'na';
export const ITEMS = {
  ops: [['guide','Guia'],['transport','Transporte'],['pickup','Pick-up'],['contact','Contacto do cliente'],['suppliers','Fornecedores'],['payment','Pagamento'],['briefing','Briefing']],
  sales: [['file','File criada'],['plan','Travel plan'],['costing','Costing'],['proposal','Proposta enviada'],['followup','Follow-up'],['payment_link','Link de pagamento']],
} as const;
export function readiness(rows: {status:string}[]) {
  const applicable = rows.filter(r=>r.status !== 'na');
  return applicable.length ? Math.round(100 * applicable.filter(r=>r.status==='ok').length/applicable.length) : 0;
}
const actions: Record<string,string> = {guide:'Confirmar guia',transport:'Confirmar transporte',pickup:'Confirmar pick-up',contact:'Completar contacto do cliente',suppliers:'Confirmar fornecedores',payment:'Confirmar pagamento',briefing:'Completar briefing',file:'Criar file',plan:'Preparar Travel plan',costing:'Completar Costing',proposal:'Enviar proposta',followup:'Fazer follow-up',payment_link:'Preparar link de pagamento'};
export function addonChecklist(side: 'sales'|'ops', rows: {item_key:string;status:Status;source:'auto'|'manual';note?:string|null}[], tasks: {title:string}[]) {
  const items = ITEMS[side].map(([key,label])=>{
    const row=rows.find(r=>r.item_key===key);
    return {key,label,status:row?.status??'pending',source:row?.source??'auto',note:row?.note??null};
  });
  const missing=items.filter(i=>i.status==='missing'||i.status==='pending');
  const priority=[...missing].sort((a,b)=>Number(b.status==='missing')-Number(a.status==='missing'));
  return {side,pct:readiness(items),items,missing:missing.map(i=>i.label),next_steps:[...priority.map(i=>actions[i.key]),...tasks.map(t=>t.title)].slice(0,5)};
}