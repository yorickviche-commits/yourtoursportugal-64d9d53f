import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { APP_ORIGIN, resolveStage, STAGES } from "../lead";

export default defineTool({
  name: "list_leads",
  title: "List leads",
  description:
    "List leads (sales pipeline) for the signed-in user, most recently updated first. Filter by stage, status, destination, agent, free-text search, trip start range or last update. Each row includes totals, deposit and the TCC lead URL.",
  inputSchema: {
    stage: z.string().optional().describe("Pipeline stage code or label — see list_lead_stages."),
    status: z.string().optional().describe("Internal status: new, proposal_sent, negotiation, won, lost."),
    search: z.string().optional().describe("Free text: lead code, client name or email."),
    agent: z.string().optional().describe("Assigned agent full name or email."),
    destination: z.string().optional().describe("Case-insensitive partial match on destination."),
    trip_start_from: z.string().optional().describe("Trip starts on or after this date (YYYY-MM-DD)."),
    trip_start_to: z.string().optional().describe("Trip starts on or before this date (YYYY-MM-DD)."),
    updated_since: z.string().optional().describe("Only leads updated after this ISO date/time."),
    limit: z.number().int().optional().describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const take = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const supabase = supabaseForUser(ctx);

    let agentId: string | null = null;
    const { data: profileRows } = await supabase.from("profiles").select("id, full_name, email");
    const profiles = (profileRows ?? []) as { id: string; full_name: string | null; email: string | null }[];
    if (args.agent) {
      const needle = args.agent.trim().toLowerCase();
      const hit =
        profiles.find((p) => (p.email || "").toLowerCase() === needle) ??
        profiles.find((p) => (p.full_name || "").toLowerCase().includes(needle));
      if (!hit) {
        throw new ToolError(
          `Agent "${args.agent}" not found. Valid users: ${profiles.map((p) => p.full_name || p.email).join(" | ")}`,
        );
      }
      agentId = hit.id;
    }
    const agentName = (id: string) => {
      const p = profiles.find((x) => x.id === id);
      return p?.full_name || p?.email || id;
    };

    let query = supabase
      .from("leads")
      .select(
        "id,lead_code,yt_id,client_name,email,status,nethunt_stage,nethunt_record_id,destination,travel_dates,travel_end_date,pax,pax_children,pax_infants,number_of_days,budget_level,client_type,assigned_agents,active_version,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(take);

    if (args.stage) query = query.eq("nethunt_stage", resolveStage(args.stage).code);
    if (args.status) query = query.eq("status", args.status);
    if (args.destination) query = query.ilike("destination", `%${args.destination}%`);
    if (args.trip_start_from) query = query.gte("travel_dates", args.trip_start_from);
    if (args.trip_start_to) query = query.lte("travel_dates", args.trip_start_to);
    if (args.updated_since) query = query.gte("updated_at", args.updated_since);
    if (agentId) query = query.contains("assigned_agents", [agentId]);
    if (args.search) {
      const s = args.search.trim().replace(/,/g, " ");
      query = query.or(
        `lead_code.ilike.%${s}%,yt_id.ilike.%${s}%,client_name.ilike.%${s}%,email.ilike.%${s}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    const rows = (data ?? []) as any[];
    const ids = rows.map((r) => r.id);

    const totals = new Map<string, { pvp: number; net: number }>();
    const paid = new Map<string, number>();
    if (ids.length) {
      const [costing, payments] = await Promise.all([
        supabase.from("lead_costing_data").select("lead_id, version, items").in("lead_id", ids),
        supabase.from("lead_payments").select("lead_id, amount").in("lead_id", ids),
      ]);
      const live = new Map(rows.map((r) => [r.id, r.active_version ?? 0]));
      ((costing.data ?? []) as any[]).forEach((row) => {
        if (row.version !== (live.get(row.lead_id) ?? 0)) return;
        const agg = totals.get(row.lead_id) ?? { pvp: 0, net: 0 };
        (Array.isArray(row.items) ? row.items : []).forEach((it: any) => {
          if (it?.status === "eliminar") return;
          agg.pvp += Number(it?.pvpTotal) || 0;
          agg.net += Number(it?.netTotal) || 0;
        });
        totals.set(row.lead_id, agg);
      });
      ((payments.data ?? []) as any[]).forEach((r) => {
        paid.set(r.lead_id, (paid.get(r.lead_id) ?? 0) + (Number(r.amount) || 0));
      });
    }

    const leads = rows.map((r) => {
      const total = totals.get(r.id)?.pvp ?? 0;
      const deposited = paid.get(r.id) ?? 0;
      return {
        lead_code: r.yt_id || r.lead_code,
        id: r.id,
        client_name: r.client_name,
        email: r.email,
        client_type: r.client_type,
        destination: r.destination,
        trip_start: r.travel_dates,
        trip_end: r.travel_end_date,
        days: r.number_of_days,
        pax: r.pax,
        pax_children: r.pax_children,
        pax_infants: r.pax_infants,
        stage: STAGES.find((s) => s.code === r.nethunt_stage)?.label ?? r.nethunt_stage ?? r.status,
        status: r.status,
        agents: (r.assigned_agents ?? []).map(agentName),
        total_yt_eur: Math.round(total * 100) / 100,
        deposited_eur: Math.round(deposited * 100) / 100,
        outstanding_eur: Math.round(Math.max(0, total - deposited) * 100) / 100,
        nethunt_record_id: r.nethunt_record_id ?? null,
        tcc_url: `${APP_ORIGIN}/leads/${r.id}`,
        updated_at: r.updated_at,
      };
    });

    const payload = { total: leads.length, leads };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
