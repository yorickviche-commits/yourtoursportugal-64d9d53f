import { z } from 'npm:zod@3';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Data inválida');
export const SetChecklist = z.object({lead_id:z.string().uuid(),item_key:z.string().min(1),status:z.enum(['ok','pending','missing','na']),note:z.string().max(5000).optional()});
export const CompleteTask = z.object({task_id:z.string().uuid()});
export const ListEvents = z.object({lead_id:z.string().uuid(),q:z.string().trim().min(1).max(300).optional()});
export const UpdateLead = z.object({lead_id:z.string().uuid(),fields:z.object({
  program_name:z.string().trim().min(1).max(500).optional(),email:z.union([z.string().email(),z.literal('')]).optional(),phone:z.string().max(100).optional(),
  trip_start:date.optional(),trip_finish:date.optional(),pax:z.number().int().nonnegative().optional(),pax_children:z.number().int().nonnegative().optional(),
  destination:z.string().max(500).optional(),client_type:z.enum(['B2B','B2C']).optional(),language:z.string().max(100).optional(),booking_origin:z.string().max(255).optional(),pvp_override:z.number().finite().nonnegative().nullable().optional(),
}).refine(f=>Object.keys(f).length>0,'Sem campos permitidos')});
export function eventWindow(lead:{trip_start?:string|null;trip_finish?:string|null},q?:string,now=new Date()) {
  const shift=(v:Date,n:number)=>{const d=new Date(v);d.setUTCDate(d.getUTCDate()+n);return d.toISOString()};
  return q?{from:shift(now,-90),to:shift(now,365)}:lead.trip_start?{from:shift(new Date(`${lead.trip_start.slice(0,10)}T00:00:00Z`),-2),to:shift(new Date(`${(lead.trip_finish||lead.trip_start).slice(0,10)}T00:00:00Z`),3)}:{from:now.toISOString(),to:shift(now,30)};
}