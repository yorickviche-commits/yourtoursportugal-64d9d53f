import {NavLink, useLocation} from 'react-router-dom';
import {useEffect, useState} from 'react';
import {LayoutDashboard, FolderOpen, CalendarDays, CheckCheck, Menu} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {usePagePermissions} from '@/hooks/usePagePermissions';
import {useAiQueue} from '@/components/ai-approvals/AiApprovalsList';
import {cn} from '@/lib/utils';

export default function MobileNavigation({onMore}: {onMore:()=>void}) {
 const {canAccess}=usePagePermissions();const location=useLocation();
 const {data:queue=[]}=useAiQueue();const pending=queue.filter(i=>['pending','failed','approved'].includes(i.status)).length;
 const [urgent,setUrgent]=useState(0);
 useEffect(()=>{const update=(e:Event)=>setUrgent((e as CustomEvent<number>).detail);window.addEventListener('cockpit-urgent-count',update);return()=>window.removeEventListener('cockpit-urgent-count',update)},[]);
 const tabs=[
  {to:'/cockpit',label:'Cockpit',icon:LayoutDashboard,allowed:canAccess('workbench'),badge:urgent,active:location.pathname==='/cockpit'&&!location.search.includes('calendar')},
  {to:'/leads',label:'Files',icon:FolderOpen,allowed:canAccess('leads'),badge:0,active:location.pathname.startsWith('/leads')||location.pathname.startsWith('/bookings')},
  {to:'/cockpit?view=calendar',label:'Calendário',icon:CalendarDays,allowed:canAccess('workbench'),badge:0,active:location.pathname==='/cockpit'&&location.search.includes('calendar')},
  {to:'/approvals/ai',label:'Aprovações',icon:CheckCheck,allowed:canAccess('agents'),badge:pending,active:location.pathname.startsWith('/approvals')},
 ];
 return <>
  <header className="mobile-app-header fixed inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md flex items-center justify-between px-4">
   <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold" aria-hidden="true">YT</span><span className="text-sm font-semibold">Your Tours</span><Button size="icon" variant="ghost" aria-label="Abrir menu" onClick={onMore}><Menu className="h-5 w-5"/></Button>
  </header>
  <nav aria-label="Navegação principal móvel" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md flex items-start justify-around px-1">
   {tabs.filter(t=>t.allowed).map(t=><Button key={t.label} variant="ghost" asChild className={cn('relative flex-1 h-16 flex-col gap-1 px-0 text-[10px] rounded-none',t.active?'text-primary':'text-muted-foreground')}><NavLink to={t.to} aria-current={t.active?'page':undefined}><t.icon className="h-5 w-5"/>{t.label}{t.badge>0&&<span className="absolute top-1 right-1/4 bg-destructive text-destructive-foreground rounded-full min-w-4 px-1 text-[10px] font-semibold">{t.badge>99?'99+':t.badge}</span>}</NavLink></Button>)}
   <Button variant="ghost" className="flex-1 h-16 flex-col gap-1 px-0 text-[10px] text-muted-foreground rounded-none" onClick={onMore}><Menu className="h-5 w-5"/>Mais</Button>
  </nav>
 </>;
}