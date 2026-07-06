// Public-facing YT code helper.
// Every visible listing / label / PDF / share URL must show the user-defined
// `yt_id` (e.g. "YT4249") from Dados Gerais. The auto-generated `lead_code`
// (e.g. "YT-2026-4249") is an internal identifier only — never shared, never
// shown to clients, kept only inside the lead's Dados Gerais as system ID.
export function displayLeadCode(lead: { yt_id?: string | null; lead_code?: string | null } | null | undefined): string {
  if (!lead) return '';
  const yt = (lead.yt_id || '').trim();
  return yt || lead.lead_code || '';
}
