import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, resolveLead } from "../lead";

interface Profile { id: string; full_name: string | null; email: string | null; status: string }

export default defineTool({
  name: "assign_lead_agents",
  title: "Assign lead agents",
  description:
    "Assign up to two TCC users as the agents of a lead, exactly like the 'Atribuir até 2 agentes' popup. Accepts a full name or an email; pass null to clear a slot.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    agent_1: z.string().nullable().optional().describe("First agent: full name or email. null clears it."),
    agent_2: z.string().nullable().optional().describe("Second agent: full name or email. null clears it."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, agent_1, agent_2 }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    if (agent_1 === undefined && agent_2 === undefined) {
      throw new ToolError("Provide agent_1 and/or agent_2 (use null to clear)");
    }
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });

    const { data: profileRows, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, status");
    if (profErr) throw new ToolError(profErr.message);
    const profiles = (profileRows ?? []) as Profile[];
    const validList = profiles
      .filter((p) => p.status !== "inactive")
      .map((p) => p.full_name || p.email || p.id)
      .join(" | ");

    const match = (value: string): string => {
      const needle = value.trim().toLowerCase();
      const hit =
        profiles.find((p) => (p.email || "").toLowerCase() === needle) ??
        profiles.find((p) => (p.full_name || "").toLowerCase() === needle) ??
        profiles.find((p) => p.id === value.trim()) ??
        profiles.find((p) => (p.full_name || "").toLowerCase().includes(needle));
      if (!hit) throw new ToolError(`Agent "${value}" not found. Valid users: ${validList}`);
      return hit.id;
    };

    const current = (lead.assigned_agents ?? []) as string[];
    const nextRaw: (string | null)[] = [
      agent_1 === undefined ? current[0] ?? null : agent_1,
      agent_2 === undefined ? current[1] ?? null : agent_2,
    ];
    const next = nextRaw
      .map((v) => (v == null || v === "" ? null : match(v)))
      .filter((v): v is string => Boolean(v));

    if (new Set(next).size !== next.length) throw new ToolError("agent_1 and agent_2 must be different users");

    const nameOf = (id: string) => {
      const p = profiles.find((x) => x.id === id);
      return p?.full_name || p?.email || id;
    };

    const changed = current.join(",") !== next.join(",");
    if (changed) {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_agents: next } as never)
        .eq("id", lead.id);
      if (error) throw new ToolError(error.message);
      await auditLead(supabase, ctx, lead, "lead_agents_changed", {
        assigned_agents: { from: current.map(nameOf), to: next.map(nameOf) },
      });
    }

    const payload = {
      lead: leadLabel(lead),
      lead_id: lead.id,
      previous_agents: current.map(nameOf),
      new_agents: next.map(nameOf),
      changed,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
