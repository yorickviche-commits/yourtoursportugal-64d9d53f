import {useQueries,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {FunctionsHttpError} from '@supabase/supabase-js';
import {useState} from 'react';
import type {Side} from '@/lib/workbench/rules';
import {useAuth} from './useAuth';
export async function workbenchInvoke(name:string,body:object){
 const {data,error}=await supabase.functions.invoke(name,{body});
 if(error){const detail=error instanceof FunctionsHttpError?await error.context.text():error.message; console.error(name,detail);if(/401|credential|UNAUTHENTICATED/i.test(detail))throw new Error('A ligação Gmail precisa de nova autorização. Usa Ligar caixa.');throw new Error(detail);}
 if(data?.error)throw new Error(data.error);
 return data;
}
export function useWorkbench(side:Side){
 const {user,isAdmin,roles}=useAuth();
 const enabled=!!user&&(isAdmin||roles.includes('sales_agent')||roles.includes('operations_agent'));
 const qc=useQueryClient();const [syncError,setSyncError]=useState('');const [busy,setBusy]=useState(false);
 const tables=['leads','workbench_threads','workbench_checklist','workbench_alerts','workbench_auto_log','ai_action_queue','sales_agent_items','lead_costing_data','lead_versions','lead_payments','tasks'] as const;
 const results=useQueries({queries:tables.map(table=>({queryKey:['workbench',table,side],queryFn:async()=>{
 let q=supabase.from(table as 'workbench_threads').select('*');
 if(table==='workbench_threads')q=q.eq('mailbox',side).eq('in_inbox',true);
 if(table==='workbench_alerts'||table==='workbench_auto_log')q=q.filter('side','eq',side);
 const r=await q;if(r.error)throw r.error;return r.data as Record<string,any>[];
 },enabled,staleTime:15*60*1000,refetchOnWindowFocus:false,refetchInterval:false as const}))});
 const queries=results.map((result,i)=>({...result,table:tables[i]}));
 const rows=(table:typeof tables[number])=>queries.find(q=>q.table===table)?.data||[];
 const refresh=async()=>{setBusy(true);setSyncError('');const errors:string[]=[];
 for(const name of ['workbench-sync-inbox','workbench-recompute']){try{await workbenchInvoke(name,{side})}catch(e){errors.push(e instanceof Error?e.message:String(e))}}
 await qc.invalidateQueries({queryKey:['workbench']});setSyncError(errors.join(' · '));setBusy(false)};
 const reload=()=>qc.invalidateQueries({queryKey:['workbench']});
 return {rows,refresh,reload,busy,syncError,errors:queries.filter(q=>q.error).map(q=>`${q.table}: ${q.error?.message}`),loading:queries.some(q=>q.isLoading)};
}
