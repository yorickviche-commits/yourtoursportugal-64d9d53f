import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_regions",
  title: "List regions (Portugal + Spain)",
  description:
    "List the active regions YTP sells (country PT or ES) with their cities/sub-destinations, as configured in Admin → Regiões. Use these exact names for lead destinations, FSE regions and per-day country/region in travel plans.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const [{ data: regs, error }, { data: dests }] = await Promise.all([
      supabase.from("regions").select("id, name, slug, country").eq("is_active", true).order("sort_order"),
      supabase.from("region_destinations").select("region_id, name").eq("is_active", true).order("sort_order"),
    ]);
    if (error) throw new ToolError(error.message);
    const regions = (regs || []).map((r: any) => ({
      name: r.name, slug: r.slug, country: r.country,
      cities: (dests || []).filter((d: any) => d.region_id === r.id).map((d: any) => d.name),
    }));
    const payload = { total: regions.length, regions };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
