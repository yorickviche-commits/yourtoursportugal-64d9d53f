import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_leads",
  title: "List leads",
  description:
    "List leads (sales pipeline) for the signed-in user, newest activity first. Optionally filter by status or destination.",
  inputSchema: {
    status: z.string().optional().describe("Filter by lead status, e.g. novo, proposta, ganho."),
    destination: z.string().optional().describe("Case-insensitive partial match on destination."),
    limit: z.number().int().optional().describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, destination, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("leads")
      .select(
        "id,lead_code,yt_id,client_name,email,status,destination,travel_dates,travel_end_date,pax,number_of_days,budget_level,sales_owner,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(take);

    if (status) query = query.eq("status", status);
    if (destination) query = query.ilike("destination", `%${destination}%`);

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify({ total: data?.length ?? 0, leads: data ?? [] }, null, 2) }],
      structuredContent: { total: data?.length ?? 0, leads: data ?? [] },
    };
  },
});
