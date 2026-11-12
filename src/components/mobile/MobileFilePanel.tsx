import {ReactNode} from 'react';
import {ArrowLeft} from 'lucide-react';
import {useIsMobile} from '@/hooks/use-mobile';
import {Button} from '@/components/ui/button';
import {Drawer,DrawerContent,DrawerTitle,DrawerDescription} from '@/components/ui/drawer';

export default function MobileFilePanel({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:ReactNode}){
 const mobile=useIsMobile();
 if(!mobile)return <div className="space-y-3 min-w-0">{children}</div>;
 return <Drawer open={open} onOpenChange={v=>{if(!v)onClose()}} shouldScaleBackground={false}>
  <DrawerContent className="mobile-file-sheet h-[96dvh] max-h-[96dvh]">
   <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0"><Button variant="ghost" size="icon" aria-label="Voltar ao Cockpit" onClick={onClose}><ArrowLeft className="h-5 w-5"/></Button><DrawerTitle className="text-base truncate">{title}</DrawerTitle></div>
   <DrawerDescription className="sr-only">Contexto da file e ações do dia a dia</DrawerDescription>
   <div className="mobile-file-scroll flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">{children}</div>
  </DrawerContent>
 </Drawer>;
}