import { supabase } from '@/integrations/supabase/client';

/** Day titles defined in the Travel Plan of a specific lead version (source of truth). */
export async function fetchPlanDayTitles(leadId: string, version: number): Promise<Record<number, string>> {
  const { data } = await supabase
    .from('travel_plans').select('days').eq('lead_id', leadId).eq('version', version).maybeSingle();
  return planDaysToTitles((data as any)?.days);
}

export function planDaysToTitles(days: any): Record<number, string> {
  const map: Record<number, string> = {};
  if (!Array.isArray(days)) return map;
  days.forEach((d: any, i: number) => {
    const n = Number(d?.day_number ?? d?.day ?? i + 1);
    const t = String(d?.title || '').trim();
    if (n && t) map[n] = t;
  });
  return map;
}

/** Update ONLY the titles of lead_costing_data rows of this version. Never touches items/values. */
export async function syncCostingTitles(leadId: string, version: number, titles: Record<number, string>) {
  if (!Object.keys(titles).length) return;
  const { data: rows } = await supabase
    .from('lead_costing_data').select('id, day_number, title').eq('lead_id', leadId).eq('version', version);
  await Promise.all((rows || [])
    .filter((r: any) => titles[r.day_number] && titles[r.day_number] !== r.title)
    .map((r: any) => supabase.from('lead_costing_data').update({ title: titles[r.day_number] }).eq('id', r.id)));
}
