import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { crmPvp, crmStage } from "@/lib/crmPipeline";
import type { Tables } from "@/integrations/supabase/types";

export type CrmLead = Tables<"leads"> & {
  stage: string;
  last_email: string | null;
  overdue: number;
  pvp: number | null;
  owner_name: string;
  avatar: string | null;
  program: string;
};
async function allRows<T>(
  fetch: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetch(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export function useCrmPipeline() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`crm-leads-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
  return useQuery({
    queryKey: ["crm-pipeline"],
    queryFn: async (): Promise<CrmLead[]> => {
      const leads = await allRows((a, b) =>
        supabase.from("leads").select("*").order("id").range(a, b),
      );
      const active = leads.filter((l) => crmStage(l));
      const emails = new Map<string, string>();
      const overdue = new Map<string, number>();
      const costs = new Map<string, { status?: string; pvpTotal?: number }[]>();
      const programs = new Map<string, string>();
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url");
      if (profileError) throw profileError;
      for (let offset = 0; offset < active.length; offset += 100) {
        const ids = active.slice(offset, offset + 100).map((l) => l.id);
        const [mail, timeline, tasks, costing, versions] = await Promise.all([
          allRows((a, b) =>
            supabase
              .from("email_links")
              .select("id,lead_id,sent_at")
              .in("lead_id", ids)
              .eq("direction", "out")
              .eq("unlinked", false)
              .order("id")
              .range(a, b),
          ),
          allRows((a, b) =>
            supabase
              .from("nethunt_timeline")
              .select("id,lead_id,event_time,payload")
              .in("lead_id", ids)
              .eq("event_type", "email")
              .order("id")
              .range(a, b),
          ),
          allRows((a, b) =>
            supabase
              .from("tasks")
              .select("id,lead_id,completed,status,due_at,due_date")
              .in("lead_id", ids)
              .order("id")
              .range(a, b),
          ),
          allRows((a, b) =>
            supabase
              .from("lead_costing_data")
              .select("id,lead_id,version,items")
              .in("lead_id", ids)
              .order("id")
              .range(a, b),
          ),
          allRows((a, b) =>
            supabase
              .from("lead_versions")
              .select("id,lead_id,version,general_data")
              .in("lead_id", ids)
              .order("id")
              .range(a, b),
          ),
        ]);
        const putEmail = (id: string | null, time: string | null) => {
          if (id && time && time > (emails.get(id) ?? "")) emails.set(id, time);
        };
        mail.forEach((m) => putEmail(m.lead_id, m.sent_at));
        timeline.forEach((t) => {
          const p = t.payload as Record<string, unknown> | null;
          if (String(p?.direction ?? "").toLowerCase() === "out")
            putEmail(t.lead_id, t.event_time);
        });
        tasks.forEach((t) => {
          const due =
            t.due_at ?? (t.due_date ? `${t.due_date}T23:59:59` : null);
          if (
            t.lead_id &&
            !t.completed &&
            !["done", "completed", "cancelled"].includes(t.status ?? "") &&
            due &&
            Date.parse(due) < Date.now()
          )
            overdue.set(t.lead_id, (overdue.get(t.lead_id) ?? 0) + 1);
        });
        costing.forEach((c) => {
          const l = active.find((l) => l.id === c.lead_id);
          if (c.version === (l?.active_version ?? 0))
            costs.set(c.lead_id, [
              ...(costs.get(c.lead_id) ?? []),
              ...(Array.isArray(c.items) ? c.items : []),
            ] as { status?: string; pvpTotal?: number }[]);
        });
        versions.forEach((v) => {
          const l = active.find((l) => l.id === v.lead_id);
          const g = v.general_data as Record<string, unknown> | null;
          if (v.version === (l?.active_version ?? 0))
            programs.set(
              v.lead_id,
              String(g?.program_name ?? g?.programName ?? g?.tourTitle ?? ""),
            );
        });
      }
      return active.map((l) => {
        const owner = profiles?.find(
          (p) =>
            p.id === l.owner_id ||
            p.email === l.sales_owner ||
            p.full_name === l.sales_owner,
        );
        return {
          ...l,
          stage: crmStage(l) ?? "",
          last_email: emails.get(l.id) ?? null,
          overdue: overdue.get(l.id) ?? 0,
          pvp: crmPvp(l.pvp_override, costs.get(l.id) ?? []),
          owner_name: owner?.full_name ?? l.sales_owner ?? "",
          avatar: owner?.avatar_url ?? null,
          program: programs.get(l.id) ?? "",
        };
      });
    },
    staleTime: 30000,
  });
}
