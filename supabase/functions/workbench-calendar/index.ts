import {z} from 'npm:zod@3';
import {workbenchUser,gateway,corsHeaders,json} from '../_shared/workbench.ts';
// Read-only view of the "Reservas YT" Google Calendar. Never writes.
const CAL='yourtours.pt_jfr4e1bm8giatbcemdtjirvbjs@group.calendar.google.com';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 try{
 await workbenchUser(req);
 const {from,to}=z.object({from:z.string().datetime(),to:z.string().datetime()}).parse(await req.json());
 const events:unknown[]=[];let page='';
 do{
  const r=await (await gateway('google_calendar','GOOGLE_CALENDAR_API_KEY',`/calendar/v3/calendars/${encodeURIComponent(CAL)}/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}${page?`&pageToken=${encodeURIComponent(page)}`:''}`)).json();
  for(const e of r.items||[])if(e.status!=='cancelled')events.push({id:e.id,title:e.summary||'',description:(e.description||'').slice(0,800),start:e.start?.dateTime||e.start?.date,end:e.end?.dateTime||e.end?.date,allDay:!!e.start?.date,colorId:e.colorId||null,link:e.htmlLink||null});
  page=r.nextPageToken||'';
 }while(page&&events.length<2000);
 return json({ok:true,events});
 }catch(e){const message=e instanceof Error?e.message:String(e);return json({error:message},message.startsWith('401')?401:message.startsWith('403')?403:502)}
});
