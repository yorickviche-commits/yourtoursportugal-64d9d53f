import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadUrl, type LeadRow } from "../lead";

const SOURCES = { direct: "direct", site: "website", ota: "ota", b2b_partner: "b2b" } as const;

const toDate = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export default defineTool({
  name: "import_lead_ai",
  title: "Create a lead from a client email (AI Import)",
  description:
    "Create a new lead from the raw client request, using the same AI extraction as 'Nova Lead → AI Import'. Assigns the next YT code and starts at 'SALES · New Lead'. Deduplicates: if a lead with the same client email and overlapping dates exists, nothing is created and that lead is returned with duplicate=true.",
  inputSchema: {
    raw_text: z.string().min(20).describe("Full client email / request text."),
    source: z.enum(["direct", "site", "ota", "b2b_partner"]).describe("Where the request came from."),
    sender_email: z.string().email().optional().describe("Sender email (used when the text has none)."),
    gmail_thread_id: z.string().optional().describe("Gmail message/thread id, stored in the notes."),
    language: z.string().optional().describe("Client language, e.g. EN, PT, FR."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ raw_text, source, sender_email, gmail_thread_id, language }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase.functions.invoke("parse-lead-email", { body: { emailText: raw_text } });
    if (error) throw new ToolError(`AI extraction failed: ${error.message}`);
    const x = ((data as any)?.extracted ?? {}) as Record<string, any>;
    const email = String(x.email || sender_email || "").trim().toLowerCase();
    const start = x.travelDates || null;
    const end = x.travelEndDate || null;

    // Deduplication: same email + overlapping dates
    if (email) {
      const { data: same } = await supabase
        .from("leads")
        .select("id, lead_code, yt_id, client_name, travel_dates, travel_end_date, nethunt_record_id")
        .ilike("email", email);
      const s = toDate(start), e = toDate(end) ?? s;
      const dup = (same ?? []).find((r: any) => {
        const rs = toDate(r.travel_dates), re = toDate(r.travel_end_date) ?? rs;
        if (!s || !rs) return !s && !rs; // both undated → same request
        return s <= (re as Date) && rs <= (e as Date);
      }) as any;
      if (dup) {
        const payload = {
          duplicate: true, id: dup.id, lead_code: dup.yt_id || dup.lead_code,
          url: leadUrl(dup as LeadRow), nethunt_record_id: dup.nethunt_record_id,
          note: "A lead with this client email and overlapping dates already exists — nothing was created.",
        };
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
      }
    }

    // Next YT code (same rule as the manual form: highest number + 1)
    const { data: codes } = await supabase.from("leads").select("yt_id").not("yt_id", "is", null);
    const max = Math.max(0, ...(codes ?? []).map((r: any) => Number(String(r.yt_id).replace(/\D/g, "").slice(-4)) || 0));
    const ytId = `YT${max + 1}`;

    // Reuse the NetHunt record when the same client is already linked
    let nethuntId: string | null = null;
    if (email) {
      const { data: linked } = await supabase.from("leads").select("nethunt_record_id")
        .ilike("email", email).not("nethunt_record_id", "is", null).limit(1);
      nethuntId = (linked?.[0] as any)?.nethunt_record_id ?? null;
    }

    const notes = [x.request, x.preferences, gmail_thread_id ? `Gmail: ${gmail_thread_id}` : null].filter(Boolean).join("\n");
    const row = {
      yt_id: ytId,
      client_type: source === "b2b_partner" ? "B2B" : "B2C",
      client_name: x.clientName || email || "Cliente (AI Import)",
      email,
      phone: x.phone || "",
      destination: Array.isArray(x.destination) ? x.destination.join(", ") : x.destination || "A definir",
      travel_dates: start || "A definir",
      travel_end_date: end || "",
      number_of_days: Number(x.numberOfDays) || 0,
      dates_type: x.datesType || "estimated",
      pax: Number(x.pax) || 0,
      status: "new",
      nethunt_stage: "SALES - New Lead",
      source: SOURCES[source],
      budget_level: x.budget || "€€",
      sales_owner: "Yorick",
      notes,
      travel_style: x.travelStyle || "",
      comfort_level: x.comfortLevel || "",
      language: language || x.language || "EN",
      nethunt_record_id: nethuntId,
    };
    const { data: created, error: insErr } = await supabase.from("leads").insert(row as never).select().single();
    if (insErr) throw new ToolError(insErr.message);
    const lead = created as unknown as LeadRow;
    await auditLead(supabase, ctx, lead, "lead_created", { lead: { from: null, to: ytId } }, { source, gmail_thread_id });

    const required = ["clientName", "email", "travelDates", "pax", "destination"];
    const payload = {
      duplicate: false, id: lead.id, lead_code: ytId, url: leadUrl(lead),
      stage: "SALES · New Lead", extracted: x,
      missing_fields: required.filter((k) => !x[k] && !(k === "email" && email)),
      nethunt_record_id: nethuntId,
      nethunt_note: nethuntId ? "Linked to the client's existing NetHunt record" : "Not linked — create/link the NetHunt record in the TCC",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
