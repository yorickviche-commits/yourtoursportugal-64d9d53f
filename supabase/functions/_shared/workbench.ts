import {createClient} from 'npm:@supabase/supabase-js@2';
import {corsHeaders} from 'npm:@supabase/supabase-js@2/cors';
export {corsHeaders};
export const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
export async function workbenchUser(req:Request){
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!key)throw new Error('Configuração indisponível');
 const token=req.headers.get('Authorization');
 if(!token?.startsWith('Bearer '))throw new Error('401: Sessão necessária');
 const db=createClient(url,key,{global:{headers:{Authorization:token}},auth:{persistSession:false}});
 const {data,error}=await db.auth.getUser();if(error||!data.user)throw new Error('401: Sessão expirada');
 const allowed=await db.rpc('can_use_workbench',{_user_id:data.user.id});
 if(allowed.error||!allowed.data)throw new Error('403: Sem acesso ao Workbench');
 return {db,user:data.user};
}
export async function gateway(service:string,keyName:string,path:string){
 const key=Deno.env.get(keyName),api=Deno.env.get('LOVABLE_API_KEY');
 if(!key||!api)throw new Error('Ligar caixa: ligação não disponível');
 const r=await fetch(`https://connector-gateway.lovable.dev/${service}${path}`,{headers:{Authorization:`Bearer ${api}`,'X-Connection-Api-Key':key}});
 if(!r.ok){const text=await r.text();console.error('Workbench provider',r.status,text);throw new Error(`[${r.status}]: ${text}`)}
 return r;
}
