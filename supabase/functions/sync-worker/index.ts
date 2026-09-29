// Generic sync worker. Called by pg_cron (every minute) and by enqueue_sync (fire-and-forget).
// Requires header x-sync-secret matching the vault secret 'sync_worker_secret'.
// Processes target='calendar' (Google Calendar) and target='nethunt' (field-level push to NetHunt).
import {
  LEAD_SYNC_COLS, leadValues, taskRowValues, pushDiff, getBaselines, updateRecord, wkey, TF,
  createRecord, recId, recUpdatedAt, setBaselines, logSync, fromDateTime, PRIORITY_OUT, TASKS_FOLDER,
} from '../_shared/nethunt.ts';
import { createClient, SUPABASE_URL, SERVICE_ROLE_KEY, getSyncAdmins, runCalendarSync, ADMIN_URL_BASE } from '../_shared/calendar-sync-core.ts';

// Backoff [1,2,5,15,60] min and the 5-failure limit live in SQL complete_sync_item().

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function esc(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

// Creates a TCC task (inserted outside the UI, e.g. MCP) in NetHunt, linked to the lead's deal. Idempotent:
// only runs while nethunt_record_id is NULL and writes it back conditionally.
async function createNethuntTask(sb: any, task: any): Promise<void> {
  if (!task.lead_id) return;
  const { data: lead } = await sb.from('leads').select('nethunt_record_id').eq('id', task.lead_id).maybeSingle();
  const leadRid = lead?.nethunt_record_id;
  if (!leadRid) return;
  const vals = taskRowValues(task);
  const fields: Record<string, unknown> = {
    [wkey(TF.name)]: vals.title || '(sem título)',
    [wkey(TF.description)]: vals.description ?? '',
    [wkey(TF.priority)]: PRIORITY_OUT[String(vals.priority)] ?? 'Medium',
    [wkey(TF.completed)]: Boolean(vals.completed),
    [wkey(TF.allDay)]: Boolean(vals.all_day),
    [wkey(TF.recordLinks)]: [leadRid],
  };
  const due = task.due_at || (task.due_date ? `${task.due_date}T09:00:00Z` : null);
  if (due) fields[wkey(TF.dueDate)] = fromDateTime(due);
  if (Array.isArray(vals.assignee_emails) && vals.assignee_emails.length) fields[wkey(TF.assignee)] = vals.assignee_emails;
  // Re-check right before creating (frontend push may have linked it meanwhile).
  const { data: again } = await sb.from('tasks').select('nethunt_record_id').eq('id', task.id).maybeSingle();
  if (again?.nethunt_record_id) return;
  const created = await createRecord(TASKS_FOLDER, fields);
  const rid = created ? recId(created) : null;
  if (!rid) throw new Error('NetHunt não devolveu recordId ao criar task');
  const now = new Date().toISOString();
  await sb.from('tasks').update({
    nethunt_record_id: rid, nethunt_record_links: [leadRid],
    nethunt_updated_at: created ? recUpdatedAt(created) : now, nethunt_synced_at: now,
  }).eq('id', task.id).is('nethunt_record_id', null);
  await setBaselines(sb, 'task', task.id, vals);
  await logSync(sb, [{ direction: 'push', entity: 'task', entity_id: task.id, nethunt_record_id: rid, action: 'create' }]);
}

async function syncNethunt(sb: any, entity: string, id: string): Promise<void> {
  if (entity === 'lead') {
    const { data: lead } = await sb.from('leads').select(LEAD_SYNC_COLS).eq('id', id).maybeSingle();
    if (!lead?.nethunt_record_id) return;
    const { vals } = await leadValues(sb, lead);
    await pushDiff(sb, 'lead', id, lead.nethunt_record_id, vals);
    return;
  }
  if (entity === 'task') {
    const { data: task } = await sb.from('tasks').select('*').eq('id', id).maybeSingle();
    if (task) {
      if (task.nethunt_record_id) { await pushDiff(sb, 'task', id, task.nethunt_record_id, taskRowValues(task)); return; }
      await createNethuntTask(sb, task);
      return;
    }
    // Deleted in the TCC → Completed=true + 'Cancelada no TCC' in NetHunt (never delete there).
    const del = (await getBaselines(sb, 'task', id)).get('__deleted') as { rid?: string; description?: string } | undefined;
    if (!del?.rid) return;
    const desc = String(del.description || '');
    await updateRecord(del.rid, [
      { field: wkey(TF.completed), value: true },
      { field: wkey(TF.description), value: desc.startsWith('Cancelada no TCC') ? desc : `Cancelada no TCC${desc ? ` — ${desc}` : ''}` },
    ]);
    await sb.from('nethunt_field_state').update({ value: { ...del, done: true } }).eq('entity', 'task').eq('entity_id', id).eq('field', '__deleted');
  }
}

async function notifyFailure(sb: any, leadId: string, error: string, target = 'calendar', entity = 'lead') {
  const kind = target === 'nethunt' ? 'NetHunt' : 'Calendar';
  if (entity === 'task') {
    const { data: t } = await sb.from('tasks').select('lead_id').eq('id', leadId).maybeSingle();
    leadId = t?.lead_id || leadId;
  }
  const { data: lead } = await sb.from('leads').select('yt_id, lead_code, client_name').eq('id', leadId).maybeSingle();
  const ref = lead?.yt_id || lead?.lead_code || leadId;
  const link = `${ADMIN_URL_BASE}${leadId}`;
  const subject = `Falha de sincronização ${kind} — ${ref}`;
  const text = `A sincronização ${kind} falhou 5 vezes.\n\nLead: ${lead?.client_name || ''}\nYT ID: ${ref}\nErro: ${error}\n\n${link}`;
  const html = `<p>A sincronização ${kind} falhou 5 vezes.</p><p><b>Lead:</b> ${esc(lead?.client_name || '')}<br><b>YT ID:</b> ${esc(ref)}<br><b>Erro:</b> ${esc(error)}</p><p><a href="${link}">${link}</a></p>`;
  for (const to of await getSyncAdmins(sb)) {
    const messageId = crypto.randomUUID();
    const { error: e } = await sb.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        idempotency_key: `sync-fail-${target}-${leadId}-${to}-${new Date().toISOString().slice(0, 13)}`,
        to,
        from: 'Your Tours TCC <noreply@yourtours.pt>',
        sender_domain: 'notify.yourtours.pt',
        subject, html, text,
        purpose: 'transactional',
        label: 'sync_failure',
        queued_at: new Date().toISOString(),
      },
    });
    if (e) console.error('enqueue_email failed', e);
  }
}

Deno.serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const given = req.headers.get('x-sync-secret') || '';
  const { data: expected } = await sb.rpc('get_sync_worker_secret');
  if (!expected || given !== expected) return reply({ error: 'forbidden' }, 403);

  const out: any[] = [];
  for (const target of ['calendar', 'nethunt'] as const) {
    const { data: items, error } = await sb.rpc('claim_sync_items', { p_target: target, p_limit: 20 });
    if (error) { out.push({ target, error: error.message }); continue; }
    for (const it of (items || []) as any[]) {
      try {
        if (target === 'calendar') {
          const res = await runCalendarSync(sb, { lead_id: it.entity_id, mode: 'update' });
          const errs = (res.body?.results || []).filter((r: any) => r.action === 'error').map((r: any) => `${r.day_date}: ${r.error}`);
          // 'travel_dates not parseable' is a data gap, not a sync failure: no retries/alerts.
          if (res.body?.ok === false && res.body?.error !== 'travel_dates not parseable') errs.push(String(res.body.error || 'erro'));
          if (errs.length) throw new Error(errs.join(' | ').slice(0, 2000));
        } else {
          await syncNethunt(sb, it.entity, it.entity_id);
        }
        await sb.rpc('complete_sync_item', { p_id: it.id, p_success: true });
        out.push({ target, id: it.id, ok: true });
      } catch (e: any) {
        const msg = String(e?.message || e).slice(0, 2000);
        const { data: failed } = await sb.rpc('complete_sync_item', { p_id: it.id, p_success: false, p_error: msg });
        if (failed) await notifyFailure(sb, it.entity_id, msg, target, it.entity);
        out.push({ target, id: it.id, ok: false, attempts: (it.attempts || 0) + 1, error: msg });
      }
    }
  }
  return reply({ processed: out.length, items: out });
});
