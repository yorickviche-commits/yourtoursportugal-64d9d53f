import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { leadLabel, liveVersion, resolveLead } from "../lead";
import { buildTravelPlanPdf } from "../pdf";

const BUCKET = "travel-plan-pdfs";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

export default defineTool({
  name: "export_travel_plan_pdf",
  title: "Export travel plan PDF",
  description:
    "Generate the client-facing Travel Plan PDF of a lead server-side (cover, day-by-day with images and route maps, hotels, pricing, terms, reviews, B2B logo when set), store it privately and return a signed download link valid for 7 days plus warnings about days missing maps or images.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5104."),
    language: z.string().optional().describe("Override the programme language (en, pt, es, fr, it, de)."),
    version: z.number().int().optional().describe("Version to export (default: LIVE version)."),
    hide_optionals: z.boolean().optional().describe("Hide optional experiences from the pricing block."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, language, version, hide_optionals }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const ver = version ?? liveVersion(lead);

    const { data: proposal, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("lead_id", lead.id)
      .eq("version", ver)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!proposal) throw new ToolError(`No proposal found for ${leadLabel(lead)} version ${ver}`);

    const p = proposal as any;
    const built = await buildTravelPlanPdf(
      { ...p, language: language || p.language, client_name: p.client_name || lead.client_name },
      { hideOptionals: Boolean(hide_optionals) },
    );

    const code = leadLabel(lead);
    const title = String(p.title || "Travel Plan").replace(/\*\*/g, "");
    const fileName = `${safe(code)} - ${safe(String(lead.client_name || ""))} - ${safe(title)}.pdf`;
    const path = `${safe(code)}/${fileName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, built.bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new ToolError(`Upload failed: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, SEVEN_DAYS);
    if (signErr) throw new ToolError(`Could not sign the file: ${signErr.message}`);

    const payload = {
      lead: code,
      lead_id: lead.id,
      version: ver,
      file_name: fileName,
      storage_path: `${BUCKET}/${path}`,
      signed_url: signed?.signedUrl ?? null,
      expires_in_days: 7,
      pages: built.pages,
      size_bytes: built.bytes.length,
      language: language || p.language || "en",
      warnings: built.warnings,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
