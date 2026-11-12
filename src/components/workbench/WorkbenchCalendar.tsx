import {useEffect,useMemo,useState} from 'react';
import {useIsMobile} from '@/hooks/use-mobile';
import MobileFilePanel from '@/components/mobile/MobileFilePanel';
import {Link} from 'react-router-dom';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Switch} from '@/components/ui/switch';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {workbenchInvoke} from '@/hooks/useWorkbench';
import {findRefs,normRef,workbenchScope,workbenchSide,lisbonToday,type Side} from '@/lib/workbench/rules';
import {cn} from '@/lib/utils';
type Row=Record<string,any>;
type Tone='sales'|'pre'|'ops'|'confirmed'|'waiting'|'hotel';
type Ev={id:string;ref:string;title:string;start:string;end:string;tone:Tone;leadId?:string;note?:string;link?:string|null};
const dayKey=(d:Date)=>d.toISOString().slice(0,10);
const tones:Record<Tone,string>={sales:'bg-info/15 text-info border-info',pre:'bg-warning-muted text-warning-foreground border-warning',ops:'bg-muted text-muted-foreground border-border',confirmed:'bg-success-muted text-success border-success',waiting:'bg-warning-muted text-warning-foreground border-warning',hotel:'bg-primary/10 text-primary border-primary'};
const label:Record<Tone,string>={sales:'Oferta',pre:'PRÉ-RESERVA',ops:'Reserva confirmada',confirmed:'Confirmado',waiting:'A aguardar confirmação',hotel:'Hotel'};
// Read-only: this calendar never writes to Google Calendar.
export default function WorkbenchCalendar({side,leads,operations,payments,total,onOpen}:{side:Side;leads:Row[];operations:Row[];payments:Row[];total:(id:string)=>number;onOpen:(id:string)=>void}){
 const mobile=useIsMobile();const todayKey=lisbonToday();const [showPast,setShowPast]=useState(false);
 const [view,setView]=useState<'day'|'week'|'month'>(()=>window.matchMedia('(max-width: 767px)').matches?'day':'week');const [cursor,setCursor]=useState(()=>new Date(`${lisbonToday()}T12:00:00Z`));const [overlay,setOverlay]=useState(false);
 const [gcal,setGcal]=useState<Row[]|null>(null);const [gError,setGError]=useState('');const [open,setOpen]=useState<Ev|null>(null);
 const range=useMemo(()=>{const s=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth(),cursor.getUTCDate()));if(view==='week')s.setUTCDate(s.getUTCDate()-((s.getUTCDay()+6)%7));if(view==='month')s.setUTCDate(1);const e=new Date(s);if(view==='day')e.setUTCDate(e.getUTCDate()+1);else if(view==='week')e.setUTCDate(e.getUTCDate()+7);else e.setUTCMonth(e.getUTCMonth()+1);return {s,e}},[cursor,view]);
 useEffect(()=>{if(side!=='ops')return;let off=false;setGError('');workbenchInvoke('workbench-calendar',{from:range.s.toISOString(),to:range.e.toISOString()}).then(r=>{if(!off)setGcal(r.events||[])}).catch(e=>{if(!off){setGcal(null);setGError(e instanceof Error?e.message:String(e))}});return()=>{off=true}},[side,range.s.getTime(),range.e.getTime()]);
 const byRef=useMemo(()=>{const m=new Map<string,Row>();for(const l of leads){if(l.yt_id)m.set(normRef(l.yt_id),l);if(l.bokun_confirmation_code)m.set(normRef(l.bokun_confirmation_code),l)}return m},[leads]);
 const events:Ev[]=useMemo(()=>{
  const tccOps=(l:Row):Ev=>({id:`tcc-${l.id}`,ref:l.yt_id||l.lead_code,title:l.client_name||'',start:l.trip_start,end:l.trip_finish||l.trip_start,tone:'ops',leadId:l.id});
  const opsLeads=leads.filter(l=>workbenchSide(l)==='ops'&&l.trip_start&&(showPast||workbenchScope(l,todayKey).active));
  if(side==='sales'){const paid=(id:string)=>payments.filter(p=>p.lead_id===id).reduce((a,p)=>a+Number(p.amount||0),0);
   const list:Ev[]=leads.filter(l=>workbenchSide(l)==='sales'&&l.trip_start&&(showPast||workbenchScope(l,todayKey).active)).map(l=>({id:l.id,ref:l.yt_id||l.lead_code,title:l.client_name||'',start:l.trip_start,end:l.trip_finish||l.trip_start,leadId:l.id,tone:(/Ready to Book/i.test(l.nethunt_stage)||l.status==='won')&&paid(l.id)<total(l.id)?'pre':'sales'}));
   return overlay?[...list,...opsLeads.map(tccOps)]:list}
  if(gcal)return gcal.map(e=>{const t=`${e.title} ${e.description}`;const l=findRefs(t).map(r=>byRef.get(r)).find(Boolean);
   return {id:e.id,ref:l?.yt_id||'Sem file',title:e.title,start:e.start,end:e.end,leadId:l?.id,note:e.description,link:e.link,tone:/hotel|alojamento/i.test(t)?'hotel':/por confirmar|aguarda|pending/i.test(t)||e.colorId==='5'?'waiting':'confirmed'} as Ev}).filter(e=>!e.leadId||showPast||workbenchScope(leads.find(l=>l.id===e.leadId)||{},todayKey).active);
  return opsLeads.map(tccOps)},[side,leads,payments,overlay,gcal,byRef,total,showPast,todayKey]);
 const days:Date[]=[];for(let d=new Date(range.s);d<range.e;d.setUTCDate(d.getUTCDate()+1))if(showPast||dayKey(d)>=todayKey)days.push(new Date(d));
 const on=(d:Date)=>{const k=dayKey(d);return events.filter(e=>{const s=(e.start||'').slice(0,10),en=(e.end||e.start||'').slice(0,10);return s===k||(s<k&&k<en)||(s<k&&k===en&&e.start?.length<=10&&e.end===e.start)})};
 const move=(n:number)=>{setShowPast(true);const c=new Date(cursor);if(view==='day')c.setUTCDate(c.getUTCDate()+n);else if(view==='week')c.setUTCDate(c.getUTCDate()+7*n);else c.setUTCMonth(c.getUTCMonth()+n);setCursor(c)};
 const lead=open?.leadId?leads.find(l=>l.id===open.leadId):null;const ops=lead?operations.filter(o=>o.lead_id===lead.id):[];
 return <div className="space-y-3">
  <div className="flex flex-wrap gap-2 items-center"><div className="flex gap-1">{(['day','week','month'] as const).map(v=><Button key={v} size="sm" variant={view===v?'default':'outline'} onClick={()=>setView(v)}>{v==='day'?(mobile?'Agenda / Dia':'Dia'):v==='week'?'Semana':'Mês'}</Button>)}</div>
  <Button size="sm" variant="outline" aria-label="Anterior" onClick={()=>move(-1)}>‹</Button><Button size="sm" variant="outline" onClick={()=>{setShowPast(false);setCursor(new Date(`${todayKey}T12:00:00Z`))}}>Hoje</Button><Button size="sm" variant="outline" aria-label="Seguinte" onClick={()=>move(1)}>›</Button>
  <span className="text-sm font-medium">{range.s.toLocaleDateString('pt-PT',{month:'long',year:'numeric',timeZone:'UTC'})}</span>
  {side==='sales'&&<label className="flex gap-2 items-center text-sm ml-auto"><Switch checked={overlay} onCheckedChange={setOverlay}/>Mostrar reservas confirmadas</label>}</div>
  {side==='ops'&&gError&&<p className="text-sm">Não foi possível ler o calendário Reservas YT. A mostrar as viagens em Operações do TCC. <span className="text-muted-foreground break-words">({gError.slice(0,140)})</span></p>}
  <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
  <div className={cn('grid gap-1',view==='day'?'grid-cols-1':'grid-cols-1 sm:grid-cols-7')}>{days.map(d=><div key={d.toISOString()} className={cn('border border-border rounded-md p-1 min-h-20 min-w-0',dayKey(d)===dayKey(new Date())&&'border-primary')}><div className="text-xs text-muted-foreground">{d.toLocaleDateString('pt-PT',{weekday:'short',day:'numeric',timeZone:'UTC'})}</div>{on(d).slice(0,view==='month'?4:20).map(e=><Button variant="ghost" key={e.id+dayKey(d)} onClick={()=>setOpen(e)} className={cn('w-full text-left text-xs border rounded px-1 py-0.5 mt-1 truncate',tones[e.tone],dayKey(d)<todayKey&&'opacity-40','h-auto justify-start')}>{e.tone==='pre'&&<strong>PRÉ-RESERVA · </strong>}{e.ref} {e.title}</Button>)}{view==='month'&&on(d).length>4&&<small>+{on(d).length-4}</small>}</div>)}</div>
  <MobileFilePanel open={!!open} onClose={()=>setOpen(null)} title={open?.ref||'Evento'}>{open?<Card><CardHeader><CardTitle className="text-base flex justify-between gap-2">{open.ref}<Button size="sm" variant="ghost" onClick={()=>setOpen(null)}>Fechar</Button></CardTitle></CardHeader><CardContent className="text-sm space-y-1">
   <p className="font-medium break-words">{open.title}</p><Badge className={tones[open.tone]}>{label[open.tone]}</Badge>
   <p>{new Date(open.start).toLocaleDateString('pt-PT')}{open.start?.length>10?` · ${new Date(open.start).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Lisbon'})}`:''}</p>
   {lead&&<><p>{lead.pax??'?'} pax</p><p>Guia: {ops.filter(o=>/guia|guide/i.test(o.activity_title||'')).map(o=>o.supplier).filter(Boolean).join(', ')||'Por atribuir'}</p><p>Fornecedores confirmados: {ops.filter(o=>['booked','confirmed'].includes(o.booking_status)).length} de {ops.length}</p><p>Estado: {lead.nethunt_stage||lead.status}</p></>}
   {open.note&&<p className="text-muted-foreground line-clamp-4 break-words">{open.note}</p>}
   <div className="flex flex-wrap gap-2 pt-2">{lead&&<Button size="sm" onClick={()=>onOpen(lead.id)}>Abrir file</Button>}{lead&&<Button size="sm" variant="outline" asChild><Link to={`/leads/${lead.id}`}>File TCC</Link></Button>}{open.link&&<Button size="sm" variant="outline" asChild><a href={open.link} target="_blank" rel="noreferrer">Ver no Calendar</a></Button>}</div>
  </CardContent></Card>:<p className="text-sm text-muted-foreground">Clica num evento para ver os detalhes.</p>}</MobileFilePanel>
  </div></div>;
}
