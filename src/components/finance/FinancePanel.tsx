import {useState} from 'react';
import {Skeleton} from '@/components/ui/skeleton';
import {Link} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/hooks/useAuth';
import {useLeadsCostingSummary} from '@/hooks/useLeadsCostingSummary';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Input} from '@/components/ui/input';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {toast} from 'sonner';
import {cn} from '@/lib/utils';
import {workbenchScope,lisbonToday} from '@/lib/workbench/rules';

export const STEPS=['requested','paid_channel','invoiced','bank_received','receipt_issued','reconciled'] as const;
const STEP_LABEL:Record<string,string>={requested:'Pedido',paid_channel:'Pago no canal',invoiced:'Faturado',bank_received:'No banco',receipt_issued:'Recibo',reconciled:'Conciliado',exception:'Exceção'};
const ACTION_LABEL:Record<string,string>={issue_proforma:'Emitir proforma',issue_fa:'Emitir FA',issue_rc:'Emitir RC',register_payment:'Registar pagamento',mark_exception:'Marcar exceção'};
const money=(n:number)=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(n||0);
/** Pagamentos com estado >= paid_channel contam como recebidos (exceção não conta). */
export const paidAmount=(rows:{status:string;amount_gross:number;payment_type?:string}[])=>rows.filter(r=>STEPS.indexOf(r.status as typeof STEPS[number])>=1).reduce((n,r)=>n+(r.payment_type==='refund'?-1:1)*Number(r.amount_gross||0),0);
/** Cor de cada ponto: cinzento n/a, amarelo em curso, verde feito, vermelho exceção. */
export const dotColors=(rows:{status:string}[])=>STEPS.map((_,i)=>{if(!rows.length)return 'bg-muted';if(rows.some(r=>r.status==='exception'))return i===0?'bg-destructive':'bg-muted';const min=Math.min(...rows.map(r=>STEPS.indexOf(r.status as typeof STEPS[number])));const max=Math.max(...rows.map(r=>STEPS.indexOf(r.status as typeof STEPS[number])));return i<=min?'bg-success':i<=max?'bg-warning':'bg-muted'});
const Dots=({rows}:{rows:{status:string}[]})=><div className="flex gap-1" aria-label="Estado dos pagamentos">{dotColors(rows).map((c,i)=><span key={i} title={STEP_LABEL[STEPS[i]]} className={cn('h-3 w-3 rounded-full',c)}/>)}</div>;

export default function FinancePanel({leads}:{leads:Record<string,any>[]}){
 const {user}=useAuth();const qc=useQueryClient();const today=lisbonToday();
 const [note,setNote]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);
 const batch=useQuery({queryKey:['finance_batch',today],queryFn:async()=>{const {data,error}=await supabase.from('finance_batch_items').select('*').or(`validation_status.eq.pending,and(batch_date.eq.${today}),executed_at.gte.${today}`).order('created_at');if(error)throw error;return data}});
 const ledger=useQuery({queryKey:['payments_ledger_all'],queryFn:async()=>{const {data,error}=await supabase.from('payments_ledger').select('*').order('created_at',{ascending:false}).limit(2000);if(error)throw error;return data}});
 const minus30=new Date(Date.parse(today)-30*86400000).toISOString().slice(0,10);
 const files=leads.filter(l=>{const d=workbenchScope(l,today).date;return d&&d>=minus30&&(l.nethunt_stage?.startsWith('OPERATIONS')||l.status==='won')}).sort((a,b)=>String(workbenchScope(a,today).date).localeCompare(String(workbenchScope(b,today).date)));
 const costing=useLeadsCostingSummary(files.map(l=>l.id));
 const leadRef=(id:string|null,ref:string|null)=>{const l=leads.find(x=>x.id===id);return l?<Link className="underline font-semibold" to={`/leads/${l.id}`}>{l.yt_id||l.lead_code}</Link>:<strong>{ref||'—'}</strong>};
 const validate=async(ids:string[],status:'approved'|'rejected')=>{if(status==='rejected'&&ids.some(id=>!note[id]?.trim())){toast.error('Escreve uma nota para rejeitar.');return}setBusy(true);try{for(const id of ids){const {error}=await supabase.from('finance_batch_items').update({validation_status:status,validated_by:user?.email,rejection_note:status==='rejected'?note[id]:null}).eq('id',id).eq('validation_status','pending');if(error)throw error}toast.success(status==='approved'?`${ids.length} aprovado(s). O Tesoureiro emite depois.`:'Rejeitado.');await qc.invalidateQueries({queryKey:['finance_batch']})}catch(e){toast.error(e instanceof Error?e.message:'Erro a validar')}finally{setBusy(false)}};
 const items=batch.data||[];const pending=items.filter(i=>i.validation_status==='pending');const standard=pending.filter(i=>(i.proposed_payload as any)?.standard===true);
 const done=items.filter(i=>['executed','failed'].includes(i.validation_status)&&String(i.executed_at||'').slice(0,10)===today);
 const exceptions=(ledger.data||[]).filter(p=>p.status==='exception');
 const err=(q:{error:unknown})=>q.error?<p className="text-sm text-destructive">Erro: {(q.error as Error).message}</p>:null;
 return <div className="finance-panel space-y-5">
  <Card><CardHeader className="flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Lote do dia — a validar ({pending.length})</CardTitle><Button className="finance-standard-action" disabled={busy||!standard.length} onClick={()=>validate(standard.map(i=>i.id),'approved')}>Aprovar todos os padrão ({standard.length})</Button></CardHeader><CardContent className="space-y-3">{err(batch)}{batch.isLoading?<Skeleton className="h-32 w-full"/>:!pending.length?<p className="text-sm text-muted-foreground">Nada por validar.</p>:pending.map(i=>{const p=(i.proposed_payload||{}) as Record<string,any>;return <div key={i.id} className="border border-border rounded-md p-3 space-y-2"><div className="flex flex-wrap gap-2 items-center">{leadRef(i.lead_id,i.yt_ref)}<Badge variant="secondary">{ACTION_LABEL[i.action]}</Badge>{p.standard&&<Badge variant="outline">padrão</Badge>}<strong className="ml-auto">{money(Number(p.amount??p.valor??0))}</strong></div><p className="text-sm">Data proposta: {p.document_date||p.date||'—'} · Regra: {p.rule||p.regra||'—'}{p.client||p.cliente?` · ${p.client||p.cliente}`:''}{p.nif?` · NIF ${p.nif}`:''}</p><div className="flex flex-wrap gap-2">{(i.evidence_urls||[]).map((u:string,k:number)=><Button key={u} size="sm" variant="outline" asChild><a href={u} target="_blank" rel="noreferrer">Prova {k+1}</a></Button>)}</div><div className="finance-validate flex flex-wrap gap-2"><Button className="h-11 flex-1" disabled={busy} onClick={()=>validate([i.id],'approved')}>✅ Aprovar</Button><Input className="h-11 flex-1 min-w-40" placeholder="Nota de rejeição" value={note[i.id]||''} onChange={e=>setNote(n=>({...n,[i.id]:e.target.value}))}/><Button className="h-11" variant="destructive" disabled={busy} onClick={()=>validate([i.id],'rejected')}>❌ Rejeitar</Button></div></div>})}</CardContent></Card>
  <Card><CardHeader><CardTitle className="text-base">Exceções ({exceptions.length})</CardTitle></CardHeader><CardContent className="space-y-2">{err(ledger)}{!exceptions.length?<p className="text-sm text-muted-foreground">Sem exceções.</p>:exceptions.map(p=><div key={p.id} className="border-l-4 border-destructive pl-3 py-1 text-sm">{leadRef(p.lead_id,p.yt_ref)} · {p.channel} · {money(Number(p.amount_gross))}<p>{p.exception_reason||'Sem motivo'}</p></div>)}</CardContent></Card>
  <Card><CardHeader><CardTitle className="text-base">Feito hoje ({done.length})</CardTitle></CardHeader><CardContent className="space-y-2">{!done.length?<p className="text-sm text-muted-foreground">Nada executado hoje.</p>:done.map(i=><div key={i.id} className="text-sm flex flex-wrap gap-2 items-center">{leadRef(i.lead_id,i.yt_ref)}<Badge variant={i.validation_status==='failed'?'destructive':'secondary'}>{i.validation_status==='failed'?'Falhou':'Executado'}</Badge>{ACTION_LABEL[i.action]} · {i.execution_ref||'—'}</div>)}</CardContent></Card>
  <Card><CardHeader><CardTitle className="text-base">Semáforo por file</CardTitle></CardHeader><CardContent className="space-y-1"><p className="text-xs text-muted-foreground">{STEPS.map(s=>STEP_LABEL[s]).join(' → ')}</p>{!files.length?<p className="text-sm text-muted-foreground">Sem files nesta janela.</p>:files.map(l=>{const rows=(ledger.data||[]).filter(p=>p.lead_id===l.id);const d=String(workbenchScope(l,today).date);const due=(costing.data?.[l.id]?.pvp||0)-paidAmount(rows as any);const soon=d>=today&&Date.parse(d)-Date.parse(today)<=15*86400000;return <div key={l.id} className={cn('flex flex-wrap gap-3 items-center border-b border-border py-2 text-sm',due>0.005&&soon&&'bg-destructive/10')}><Link className="underline font-semibold w-24" to={`/leads/${l.id}`}>{l.yt_id||l.lead_code}</Link><span className="flex-1 min-w-24 truncate">{l.client_name}</span><span>{new Date(d).toLocaleDateString('pt-PT')}</span><Dots rows={rows}/><span className={cn('w-28 text-right',due>0.005&&soon?'text-destructive font-semibold':due>0.005?'':'text-success')}>{due>0.005?`Falta ${money(due)}`:'Saldo OK'}</span></div>})}</CardContent></Card>
 </div>;
}

export function LeadPaymentsCard({leadId}:{leadId:string}){
 const {data,error,isLoading}=useQuery({queryKey:['payments_ledger',leadId],queryFn:async()=>{const {data,error}=await supabase.from('payments_ledger').select('*').eq('lead_id',leadId).order('created_at');if(error)throw error;return data}});
 if(error&&/permission|row-level/i.test((error as Error).message))return null;
 return <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pagamentos</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">{error?<p className="text-destructive">Erro: {(error as Error).message}</p>:isLoading?<p className="text-muted-foreground">A carregar…</p>:!data?.length?<p className="text-muted-foreground">Sem pagamentos registados.</p>:data.map(p=><div key={p.id} className="flex flex-wrap gap-2 items-center border-b border-border py-1"><Badge variant={p.status==='exception'?'destructive':'secondary'}>{STEP_LABEL[p.status]}</Badge><span>{p.channel}</span><span>{p.payment_type}</span><strong className="ml-auto">{money(Number(p.amount_gross))}</strong>{p.fa_number&&<span>FA {p.fa_number}</span>}{p.rc_number&&<span>RC {p.rc_number}</span>}</div>)}</CardContent></Card>;
}
