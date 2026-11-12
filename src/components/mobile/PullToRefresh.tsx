import {ReactNode,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {useIsMobile} from '@/hooks/use-mobile';

export default function PullToRefresh({children,onRefresh,busy=false}:{children:ReactNode;onRefresh:()=>Promise<unknown>;busy?:boolean}){
 const mobile=useIsMobile();const start=useRef<number|null>(null);const [ready,setReady]=useState(false);
 return <div onTouchStart={e=>{start.current=mobile&&window.scrollY<=0&&!busy?e.touches[0]?.clientY??null:null}} onTouchMove={e=>{if(start.current!==null)setReady((e.touches[0]?.clientY??0)-start.current>80)}} onTouchEnd={()=>{if(ready&&!busy)void onRefresh();start.current=null;setReady(false)}}>
  {ready&&<div role="status" className="flex items-center justify-center gap-2 py-3 text-sm text-primary"><RefreshCw className="h-4 w-4"/>Solta para atualizar</div>}{children}
 </div>;
}