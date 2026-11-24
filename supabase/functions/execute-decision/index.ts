import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { sendPreparedEmail } from '../_shared/decision-email.ts';

const bodySchema = z.object({ decision_id: z.string().uuid(), send_now: z.boolean().default(false) }).strict();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  try {
    const input = bodySchema.safeParse(await req.json());
    if (!input.success) return json({ error: 'Pedido de execução inválido' }, 400);
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key || !service) throw new Error('Configuração indisponível');
    const db = createClient(url, service, { auth: { persistSession: false } });
    const workerSecret = req.headers.get('x-sync-secret');
    let caller;
    if (workerSecret) {
      const { data: secret, error } = await db.rpc('get_sync_worker_secret');
      if (error || !secret || secret !== workerSecret) return json({ error: 'Acesso recusado' }, 403);
      caller = db;
    } else {
      const authorization = req.headers.get('Authorization');
      if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sessão necessária' }, 401);
      caller = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
      const { data, error } = await caller.auth.getUser();
      if (error || !data.user) return json({ error: 'Sessão expirada' }, 401);
    }
    const { data: claim, error } = await caller.rpc('claim_decision_execution', { p_id: input.data.decision_id, p_send_now: input.data.send_now });
    if (error) return json({ error: error.message }, 403);
    if (claim.skipped) return json(claim);
    let result = null, failure: string | null = null, retrySafe = true;
    try {
      if (claim.item.type === 'payment_link') {
        const p = claim.payload;
        const { data: lead } = await db.from('leads').select('travel_dates,travel_end_date,trip_start,trip_finish').eq('id', claim.item.lead_id).single();
        // Preserve the existing payment executor and its human/CEO guards.
        retrySafe = false;
        const response = await fetch(`${url}/functions/v1/wetravel-create-payment-link`, { method: 'POST', headers: { Authorization: req.headers.get('Authorization') || '', apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', lead_id: claim.item.lead_id, proposal_id:p.proposal_id || null, title:p.description || claim.item.title, trip_ref:p.trip_ref || claim.item.lead_code, start_date:p.start_date || lead?.trip_start || lead?.travel_dates, end_date:p.end_date || lead?.trip_finish || lead?.travel_end_date || p.start_date, amount_cents:p.amount_cents ?? Math.round(Number(p.amount_eur)*100), currency:'EUR', deposit_cents:p.deposit_cents ?? null }) });
        const data = await response.json();
        if (!response.ok || data.error) {
          retrySafe = response.status >= 400 && response.status < 500;
          throw new Error(data.error || 'Não foi possível confirmar a criação do link');
        }
        result = { payment_link:data.payment_link, url:data.payment_link?.url || data.payment_link?.checkout_url };
      } else {
        result = await sendPreparedEmail(db, claim.item.type === 'fse_email' ? 'ops' : 'sales', claim.payload);
      }
    } catch (e) {
      failure = e instanceof Error ? e.message : 'Falhou a execução';
      if (e && typeof e === 'object' && 'uncertain' in e && e.uncertain) retrySafe = false;
    }
    const finish = await db.rpc('finish_decision_execution', { p_id:input.data.decision_id, p_token:claim.token, p_result:result, p_error:failure, p_retry_safe:retrySafe });
    if (finish.error) return json({ error:'Execução reservada, mas o resultado não pôde ser registado. Verifica antes de repetir.' }, 500);
    return json({ result, error:failure, retry_safe:retrySafe }, failure ? 422 : 200);
  } catch (e) { return json({ error:e instanceof Error ? e.message : 'Erro de execução' }, 400); }
});