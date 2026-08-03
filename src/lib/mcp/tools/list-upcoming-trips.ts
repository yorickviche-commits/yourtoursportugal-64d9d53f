import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_upcoming_trips",
  title: "List upcoming trips",
  description:
    "List confirmed trips departing within the next N days, soonest first. Use for operational priorities (D-1, D-3, D-7).",
  inputSchema: {
    days: z.number().int().optional().describe("Days ahead to include (default 7, max 365)."),
    limit: z.number().int().optional().describe("Max rows to return (default 50, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const window = Math.min(Math.max(days ?? 7, 1), 365);
    const take = Math.min(Math.max(limit ?? 50, 1), 100);

    const from = new Date();
    const until = new Date();
    until.setDate(until.getDate() + window);

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("trips")
      .select(
        "id,trip_code,client_name,destination,start_date,end_date,status,pax,total_value,urgency,has_blocker,blocker_note,sales_owner,lead_id",
      )
      .gte("start_date", from.toISOString().slice(0, 10))
      .lte("start_date", until.toISOString().slice(0, 10))
      .order("start_date", { ascending: true })
      .limit(take);

    if (error) throw new ToolError(error.message);

    const payload = { days_ahead: window, total: data?.length ?? 0, trips: data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
