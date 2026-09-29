// Thin wrapper around _shared/calendar-sync-core.ts (manual full_resync / force_overwrite / legacy calls).
// Sentido único: Lovable -> Google Calendar. Nunca envia DELETE ao Google.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  createClient, SUPABASE_URL, SERVICE_ROLE_KEY, getSyncAdmins, runCalendarSync, type SyncRequest,
} from '../_shared/calendar-sync-core.ts';

async function getCallerEmail(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const jwt = auth.slice(7);
  const anon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data, error } = await anon.auth.getUser(jwt);
  if (error || !data?.user?.email) return null;
  return data.user.email.toLowerCase();
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  try {
    const body = await req.json() as SyncRequest;
    if (!body.lead_id) throw new Error('lead_id required');
    const mode = body.mode || 'update';

    if (mode === 'preview') {
      const email = await getCallerEmail(req);
      if (!email) return reply({ ok: false, error: 'autenticação necessária' }, 401);
      const { data: isInternal } = await supabase.rpc('is_internal_user', {
        _user_id: (await createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!).auth.getUser((req.headers.get('Authorization') || '').slice(7))).data.user?.id,
      });
      if (!isInternal) return reply({ ok: false, error: 'sem acesso' }, 403);
    }

    const forceDates = new Set<string>();
    if (mode === 'force_overwrite') {
      const email = await getCallerEmail(req);
      const admins = await getSyncAdmins(supabase);
      if (!email || !admins.includes(email)) return reply({ ok: false, error: 'force_overwrite reservado ao administrador' }, 403);
      for (const d of body.day_dates || []) if (/^\d{4}-\d{2}-\d{2}$/.test(d)) forceDates.add(d);
      if (forceDates.size === 0) return reply({ ok: false, error: 'day_dates obrigatório em force_overwrite' }, 400);
    }

    const res = await runCalendarSync(supabase, { lead_id: body.lead_id, mode, forceDates });
    return reply(res.body, res.status);
  } catch (err: any) {
    console.error('calendar-sync error:', err);
    return reply({ ok: false, error: String(err.message || err) }, 500);
  }
});
