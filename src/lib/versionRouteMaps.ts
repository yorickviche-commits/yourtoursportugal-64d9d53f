import { supabase } from '@/integrations/supabase/client';

export interface RouteCtx { routeMapUrl?: string | null; routeDayMaps?: { day: number; url: string }[] | null }

/** Route of a version for day index i (0-based): per-day route first; the exact route only on day 1 when there are no per-day routes. */
export const routeForDay = (i: number, ctx: RouteCtx): string => {
  const list = (Array.isArray(ctx.routeDayMaps) ? ctx.routeDayMaps : []).filter(d => d?.url);
  const hit = list.find(d => Number(d.day) === i + 1)?.url;
  if (hit) return hit.trim();
  if (i === 0 && list.length === 0 && ctx.routeMapUrl) return ctx.routeMapUrl.trim();
  return '';
};

/**
 * After the routes of ONE version change, refresh the day maps of that version's
 * travel plan and proposal. A day map is replaced only when empty or when it was the
 * previous route of that version (manual links typed in the planner are kept).
 */
export const syncVersionRoutes = async (leadId: string, version: number, prev: RouteCtx, next: RouteCtx) => {
  const [{ data: plan }, { data: prop }] = await Promise.all([
    supabase.from('travel_plans').select('id, days').eq('lead_id', leadId).eq('version', version).maybeSingle(),
    supabase.from('proposals').select('id, days').eq('lead_id', leadId).eq('version', version).maybeSingle(),
  ]);
  const apply = (days: any[], key: 'mapUrl' | 'map_url') => days.map((d, i) => {
    const cur = String(d?.[key] || '').trim();
    const old = routeForDay(i, prev);
    if (cur && cur !== old) return d;
    return { ...d, [key]: routeForDay(i, next) };
  });
  const jobs: PromiseLike<any>[] = [];
  if (plan && Array.isArray((plan as any).days)) {
    jobs.push(supabase.from('travel_plans').update({ days: apply((plan as any).days, 'mapUrl') } as any).eq('id', (plan as any).id));
  }
  if (prop && Array.isArray((prop as any).days)) {
    jobs.push(supabase.from('proposals').update({ days: apply((prop as any).days, 'map_url') } as any).eq('id', (prop as any).id));
  }
  await Promise.all(jobs);
};
