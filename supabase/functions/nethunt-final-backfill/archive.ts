// Pure archival rules: no operational writes and no NetHunt mutation endpoints.
export type Raw = Record<string, unknown>;
export const ARCHIVE_SINCE = '1970-01-01T00:00:00Z';
export const SOURCES = {
  records: 'new-record', fields: 'folder-field', comment: 'new-comment',
  file: 'new-gdrivefile', call: 'new-call-log', field_change: 'record-change', email: 'new-email',
} as const;
export type Kind = keyof typeof SOURCES;

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = value as Raw;
    return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
export async function hash(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function identity(kind: Kind, raw: Raw): Promise<string> {
  const value = kind === 'fields' ? raw.name :
    raw.id ?? raw.commentId ?? raw.callLogId ?? raw.fileId ?? (kind === 'records' ? raw.recordId : undefined);
  return value != null && String(value) ? String(value) : `sha256:${await hash(raw)}`;
}
export async function archiveEntries(kind: Kind, items: Raw[]) {
  const groups = new Map<string, Map<string, Raw>>();
  for (const raw of items) {
    const id = await identity(kind, raw);
    const digest = await hash(raw);
    const group = groups.get(id) ?? new Map<string, Raw>();
    group.set(digest, raw); groups.set(id, group);
  }
  return [...groups].flatMap(([baseId, variants]) => [...variants].map(([digest, raw]) => ({
    id: variants.size > 1 ? `${baseId}:sha256:${digest}` : baseId,
    digest, raw, conflictingId: variants.size > 1,
  })));
}
export function recordId(kind: Kind, raw: Raw): string | null {
  const nested = raw.record && typeof raw.record === 'object' ? raw.record as Raw : {};
  const id = raw.recordId ?? raw.record_id ?? nested.id ?? (kind === 'records' ? raw.id : null);
  return id == null ? null : String(id);
}
export function ytKey(value: unknown): string | null {
  const match = String(value ?? '').trim().match(/^(?:YT[\s-]*)?(\d+)$/i);
  return match ? String(Number(match[1])) : null;
}
export type LocalLead = { id: string; yt_id: string | null; nethunt_record_id: string | null; nethunt_stage?: string | null };
export function matchLead(leads: LocalLead[], rid: string | null, raw: Raw, kind: Kind): LocalLead | null {
  if (rid) {
    const matches = leads.filter(l => l.nethunt_record_id === rid);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return null;
  }
  if (kind !== 'records') return null;
  const fields = raw.fields && typeof raw.fields === 'object' ? raw.fields as Raw : {};
  const yt = ytKey(fields['YT ID/Referencia'] ?? fields['79']);
  if (!yt) return null;
  const matches = leads.filter(l => ytKey(l.yt_id) === yt && (!l.nethunt_record_id || l.nethunt_record_id === rid));
  return matches.length === 1 ? matches[0] : null;
}
export function sourcePath(kind: Kind, folder: string): string {
  // NetHunt documents "No limit" when limit is omitted. The API returns newest
  // first: advancing a `since` cursor to the maximum timestamp loses old pages.
  const base = `/triggers/${SOURCES[kind]}/${encodeURIComponent(folder)}`;
  return kind === 'fields' ? base : `${base}?since=${encodeURIComponent(ARCHIVE_SINCE)}`;
}
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));
}
export function mayImportTask(existingRecordIds: Set<string>, rid: string, raw: Raw): boolean {
  return !existingRecordIds.has(rid) && raw.deleted !== true;
}
export function taskTeam(stage: string | null | undefined): 'sales' | 'operations' {
  return stage?.startsWith('OPERATIONS') ? 'operations' : 'sales';
}