import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireInternalUser } from '../_shared/require-auth.ts';
import { serviceClient, DEALS_FOLDER, TASKS_FOLDER, field, TF, taskNhValues, toIso } from '../_shared/nethunt.ts';
import { SOURCES, hash, identity, archiveEntries, recordId, matchLead, sourcePath, escapeHtml, mayImportTask, taskTeam, type Raw, type Kind, type LocalLead } from './archive.ts';
import { copyNextFile } from './media.ts';

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const KINDS = Object.keys(SOURCES) as Kind[];
const LIMITATIONS = [
  'Cobertura limitada aos dados devolvidos pela API e às pastas acessíveis à conta NetHunt.',
  'Emails completos e anexos Gmail não são exportados por esta rotina; permanecem no Gmail.',
  'Ficheiros Google Drive só estão concluídos quando media_status=copied e a assinatura binária é verificada; falhas exigem revisão.',
  'Utilizadores, permissões, automações e WhatsApp não têm exportação confirmada por esta API.',
  'Registos sem associação única são preservados no arquivo, sem criar ou alterar files operacionais.',
  'Repetir a captura imediatamente antes do corte; a sincronização continua ativa.',
];
type Source = { id: string; run_id: string; folder_id: string; folder_name: string; kind: Kind; status: string };
const sb = serviceClient();
function assertDb(error: { message: string } | null) { if (error) throw new Error(`Arquivo: ${error.message}`); }
async function all(table: string, columns: string, apply: (q: any) => any = q => q): Promise<Raw[]> {
  const rows: Raw[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await apply(sb.from(table).select(columns).order('id').range(from, from + 499));
    assertDb(error);
    const batch = (data ?? []) as Raw[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
async function remote(path: string): Promise<Raw[]> {
  const email = Deno.env.get('NETHUNT_EMAIL');
  const key = Deno.env.get('NETHUNT_API_KEY');
  if (!email || !key) throw new Error('Credenciais NetHunt indisponíveis');
  const res = await fetch(`https://nethunt.com/api/v1/zapier${path}`, {
    headers: { Authorization: `Basic ${btoa(`${email}:${key}`)}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    // Never echo source payloads or credentials in a public error/report.
    await res.body?.cancel();
    throw new Error(`NetHunt HTTP ${res.status}`);
  }
  const text = await res.text();
  if (text.length > 30_000_000) throw new Error('Origem excede 30 MB: exige exportação dedicada, não foi truncada');
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data) || data.some(x => x === null || typeof x !== 'object' || Array.isArray(x))) {
    throw new Error('Resposta NetHunt inesperada; não tratada como lista vazia');
  }
  return data as Raw[];
}
async function report(runId: string) {
  const { data: run, error } = await sb.from('nethunt_archive_runs').select('*').eq('id', runId).maybeSingle();
  assertDb(error);
  if (!run) return null;
  const sources = await all('nethunt_archive_sources', '*', q => q.eq('run_id', runId));
  const media = await all('nethunt_archive_items', 'id,source_id,media_status,binary_bytes,media_error,storage_path', q => q.eq('run_id',runId).eq('kind','file'));
  return { ok: true, run, sources, media, limitations: LIMITATIONS, ready_to_disconnect: false };
}
async function leadIndex(runId: string) {
  const leads = await all('leads', 'id,yt_id,nethunt_record_id,nethunt_stage') as unknown as LocalLead[];
  const archived = await all('nethunt_archive_items', 'id,record_id,lead_id', q => q.eq('run_id', runId).eq('folder_id', DEALS_FOLDER).eq('kind', 'records').not('lead_id', 'is', null));
  const byRid = new Map<string, LocalLead>();
  for (const l of leads) if (l.nethunt_record_id) {
    if (leads.filter(x => x.nethunt_record_id === l.nethunt_record_id).length === 1) byRid.set(l.nethunt_record_id, l);
  }
  for (const r of archived) {
    const l = leads.find(x => x.id === r.lead_id);
    if (l && r.record_id) byRid.set(String(r.record_id), l);
  }
  return { leads, byRid };
}
async function importMissingTasks(items: Raw[], byRid: Map<string, LocalLead>) {
  const existing = await all('tasks', 'id,nethunt_record_id', q => q.not('nethunt_record_id', 'is', null));
  const existingIds = new Set(existing.map(r => String(r.nethunt_record_id)));
  const rows: Raw[] = [];
  let preserved = 0;
  for (const it of items) {
    const rid = recordId('records', it);
    if (!rid) continue;
    if (!mayImportTask(existingIds, rid, it)) { preserved++; continue; }
    const rawLinks = field(it as any, TF.recordLinks);
    const links = Array.isArray(rawLinks) ? rawLinks.map(String) : rawLinks ? [String(rawLinks)] : [];
    const matched = links.map(r => byRid.get(r)).filter((l): l is LocalLead => Boolean(l));
    const unique = [...new Map(matched.map(l => [l.id, l])).values()];
    const lead = unique.length === 1 ? unique[0] : null;
    const vals = taskNhValues(it as any);
    rows.push({ ...vals, nethunt_record_id: rid, nethunt_record_links: links,
      creator_email: field(it as any, TF.creator) ? String(field(it as any, TF.creator)) : null,
      lead_id: lead?.id ?? null, team: taskTeam(lead?.nethunt_stage),
      status: vals.completed ? 'done' : 'todo', due_date: vals.due_at ? String(vals.due_at).slice(0, 10) : null,
      nethunt_updated_at: toIso(it.updatedAt ?? it.createdAt), nethunt_synced_at: new Date().toISOString(),
    });
    existingIds.add(rid);
  }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    // The legacy task unique index is partial; PostgREST ON CONFLICT cannot
    // infer it. Plain inserts plus duplicate handling preserve concurrent edits.
    const batch = rows.slice(i, i + 100);
    const { data, error } = await sb.from('tasks').insert(batch).select('id');
    if (error?.code === '23505') {
      for (const row of batch) {
        const one = await sb.from('tasks').insert(row).select('id');
        if (one.error?.code !== '23505') assertDb(one.error);
        inserted += one.data?.length ?? 0;
      }
    } else { assertDb(error); inserted += data?.length ?? 0; }
  }
  return { tasks_inserted: inserted, existing_tasks_preserved: preserved };
}
async function importMissingTimeline(source: Source, items: Raw[], byRid: Map<string, LocalLead>) {
  if (!['comment','file','call','field_change'].includes(source.kind)) return { timeline_inserted: 0 };
  const rows: Raw[] = [];
  for (const it of items) {
    const rid = recordId(source.kind, it);
    const lead = rid ? byRid.get(rid) : undefined;
    if (!lead) continue;
    const id = await identity(source.kind, it);
    const text = String(it.bodyHtml ?? it.body_html ?? it.html ?? it.body ?? it.text ?? it.message ?? it.transcript ?? '');
    const subject = String(it.subject ?? it.title ?? it.summary ?? it.name ?? ({ comment:'Comentário', file:'Ficheiro', call:'Chamada', field_change:'Alteração de registo' } as Raw)[source.kind] ?? 'Histórico NetHunt');
    const time = toIso(it.createdAt ?? it.time ?? it.date ?? it.updatedAt);
    if (!time) continue; // Raw remains archived; never invent a historical timestamp.
    rows.push({ lead_id: lead.id, nethunt_record_id: rid, event_id: id, event_type: source.kind,
      event_time: time, pinned: Boolean(it.pinned), subject,
      creator_name: it.creatorName ?? it.authorName ?? null,
      creator_email: it.creatorEmail ?? it.authorEmail ?? null,
      snippet: text.replace(/<[^>]*>/g, ' ').slice(0, 300) || subject,
      body_html: escapeHtml(text).replace(/\n/g, '<br/>'), payload: it, synced_at: new Date().toISOString(),
    });
  }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { data, error } = await sb.from('nethunt_timeline').upsert(rows.slice(i, i + 100), {
      onConflict: 'event_id', ignoreDuplicates: true,
    }).select('id');
    assertDb(error); inserted += data?.length ?? 0;
  }
  return { timeline_inserted: inserted, timeline_eligible: rows.length };
}
async function capture(source: Source) {
  const raw = await remote(sourcePath(source.kind, source.folder_id));
  const { leads, byRid } = await leadIndex(source.run_id);
  const unique = new Map<string, Raw>();
  const hashes = new Map<string, string>();
  const rows: Raw[] = [];
  let matched = 0;
  const entries = await archiveEntries(source.kind, raw);
  for (const {raw:it,id,digest} of entries) {
    hashes.set(id, digest); unique.set(id, it);
    const rid = recordId(source.kind, it);
    const lead = source.folder_id === DEALS_FOLDER ? (rid ? byRid.get(rid) : undefined) ?? matchLead(leads, rid, it, source.kind) : null;
    if (lead) matched++;
    rows.push({ run_id: source.run_id, folder_id: source.folder_id, kind: source.kind,
      source_id: id, record_id: rid, lead_id: lead?.id ?? null, source_time: toIso(it.updatedAt ?? it.createdAt ?? it.time ?? it.date),
      payload: it, payload_sha256: digest,
    });
  }
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await sb.from('nethunt_archive_items').upsert(rows.slice(i, i + 100), { onConflict: 'run_id,folder_id,kind,source_id' });
    assertDb(error);
  }
  const stored = await all('nethunt_archive_items', 'id,source_id,payload,payload_sha256', q => q.eq('run_id', source.run_id).eq('folder_id', source.folder_id).eq('kind', source.kind));
  const readHashes: [string, string][] = [];
  for (const r of stored) {
    const digest = await hash(r.payload);
    if (digest !== r.payload_sha256) throw new Error('Conteúdo relido não coincide com a assinatura gravada');
    readHashes.push([String(r.source_id), digest]);
  }
  const sourceDigest = await hash([...hashes.entries()].sort(([a],[b]) => a.localeCompare(b)));
  const storedDigest = await hash(readHashes.sort(([a],[b]) => a.localeCompare(b)));
  if (unique.size !== stored.length || sourceDigest !== storedDigest) throw new Error('Contagem ou assinatura origem/arquivo não coincide');
  const effects: Raw = source.folder_id === TASKS_FOLDER && source.kind === 'records'
    ? await importMissingTasks([...unique.values()], byRid)
    : source.folder_id === DEALS_FOLDER ? await importMissingTimeline(source, [...unique.values()], byRid) : {};
  const { error } = await sb.from('nethunt_archive_sources').update({
    status: 'verified', source_count: unique.size, archived_count: stored.length, digest: sourceDigest,
    checked_at: new Date().toISOString(), detail: { matched_leads: matched, unlinked: unique.size - matched,
      duplicate_rows: raw.length - unique.size, request_has_no_limit: true, ...effects,
      disambiguated_history_variants: entries.filter(e=>e.conflictingId).length,
      suspected_round_cap: raw.length > 0 && raw.length % 500 === 0,
    },
  }).eq('id', source.id);
  assertDb(error);
  return { kind: source.kind, folder_name: source.folder_name, source_count: unique.size, archived_count: stored.length, ...effects };
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = await requireInternalUser(req, { adminOnly: true });
  if (!auth.ok) return auth.response;
  try {
    if (req.method !== 'POST') return respond({error:'Usar POST'},405);
    let body: Raw;
    try { body = await req.json(); } catch { return respond({error:'Pedido inválido'},400); }
    if (!body || !['start','next','report','retry','media'].includes(String(body.action))) return respond({error:'Ação inválida'},400);
    if (body.action === 'start') {
      const folders = await remote('/triggers/readable-folder');
      if (!folders.length) throw new Error('Nenhuma pasta acessível; não é uma exportação completa');
      const { data: run, error } = await sb.from('nethunt_archive_runs').insert({created_by:auth.userId,
        scope:{folders, since:'1970-01-01T00:00:00Z', limitations:LIMITATIONS, no_operational_lead_writes:true},
      }).select('id').single();
      assertDb(error);
      if (!run) throw new Error('Não foi possível iniciar o arquivo');
      const sources = folders.flatMap(f => KINDS.map(kind => ({run_id:run.id,folder_id:String(f.id),folder_name:String(f.name),kind})));
      const created = await sb.from('nethunt_archive_sources').insert(sources); assertDb(created.error);
      return respond({ok:true,run_id:run.id,sources:sources.length,limitations:LIMITATIONS});
    }
    const runId = String(body.run_id ?? '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) return respond({error:'Identificador inválido'},400);
    const current = await report(runId);
    if (!current) return respond({error:'Arquivo não encontrado'},404);
    if (body.action === 'report') return respond(current);
    if (body.action === 'media') return respond(await copyNextFile(sb,runId));
    if (body.action === 'retry') {
      const sourceId = String(body.source_id ?? '');
      const target = current.sources.find(s => s.id === sourceId);
      if (!target || !['error','processing','verified'].includes(String(target.status))) return respond({error:'Origem inválida para repetição'},400);
      if (target.status === 'processing' && Date.now() - Date.parse(String(target.checked_at)) < 180000) return respond({error:'Origem ainda em execução'},409);
      const result = await sb.from('nethunt_archive_sources').update({status:'pending'}).eq('id',sourceId).eq('run_id',runId); assertDb(result.error);
      return respond({ok:true,requeued:sourceId});
    }
    // Prefer all record inventories before dependent tasks/events, irrespective of folder order.
    const pending = current.sources.filter(s => s.status === 'pending').sort((a,b) =>
      (a.kind === 'records' ? 0 : 1) - (b.kind === 'records' ? 0 : 1) || String(a.folder_id).localeCompare(String(b.folder_id)) || String(a.kind).localeCompare(String(b.kind)));
    const source = pending[0] as unknown as Source | undefined;
    if (!source) {
      const processing = current.sources.some(s => s.status === 'processing');
      if (!processing) { const done = await sb.from('nethunt_archive_runs').update({status:'review_required',finished_at:new Date().toISOString()}).eq('id',runId); assertDb(done.error); }
      return respond({ok:true,done:!processing,...await report(runId)});
    }
    const claim = await sb.from('nethunt_archive_sources').update({status:'processing',checked_at:new Date().toISOString()}).eq('id',source.id).eq('status','pending').select('id'); assertDb(claim.error);
    if (!claim.data?.length) return respond({ok:true,busy:true});
    try {
      return respond({ok:true,done:false,source:await capture(source)});
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha de cópia';
      const unsupported = message === 'NetHunt HTTP 404';
      const saved = await sb.from('nethunt_archive_sources').update({status:unsupported?'unsupported':'error',checked_at:new Date().toISOString(),detail:{error:message}}).eq('id',source.id); assertDb(saved.error);
      return respond({ok:false,done:false,source:{kind:source.kind,folder_name:source.folder_name,status:unsupported?'unsupported':'error',error:message}});
    }
  } catch (e) { return respond({ok:false,error:e instanceof Error?e.message:'Falha do arquivo'},500); }
});