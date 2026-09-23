import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { enqueueAction } from "../queue";
import { loadPlan, planWarnings } from "../travelPlan";
import { renderTravelPlanPdf, storeTravelPlanPdf } from "../pdf";

const TEMPLATE: Record<string, string> = {
  proposal: "sales_proposal",
  first_draft: "sales_first_contact",
  follow_up: "sales_followup_d2",
  payment_request: "sales_proposal",
  confirmation: "ops_client_briefing",
  custom: "sales_proposal",
};

export default defineTool({
  name: "draft_client_email",
  title: "Draft a client email — human approval required",
  description:
    "Draft a client email with the AI Email Composer (house style, clickable cover, day-by-day, Book Now), optionally attaching the travel plan PDF. The email is placed in the 'Aprovações AI' queue: nothing is sent until a human approves it, and it is then sent from reservas@yourtours.pt and logged in Comunicações and NetHunt.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    purpose: z
      .enum(["proposal", "first_draft", "follow_up", "payment_request", "confirmation", "custom"])
      .describe("What the email is for."),
    notes: z.string().optional().describe("Notes for the AI: what to emphasise, what changed, tone hints."),
    language: z.string().optional().describe("Email language (default: the client language on the lead)."),
    attach_travel_plan_pdf: z.boolean().optional().describe("Attach the travel plan PDF (default false)."),
    cc: z.array(z.string().email()).optional().describe("Cc recipients."),
    bcc: z.array(z.string().email()).optional().describe("Bcc recipients."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async ({ lead_id, lead_code, purpose, notes, language, attach_travel_plan_pdf, cc, bcc }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const l = lead as any;
    const ref = leadLabel(lead);
    const ver = liveVersion(lead);
    if (!l.email) throw new ToolError(`Lead ${ref} has no client email address`);

    const { plan, meta } = await loadPlan(supabase, lead, ver);
    const { data: proposal } = await supabase
      .from("proposals")
      .select("public_token, wetravel_checkout_url, title, total_value_eur")
      .eq("lead_id", lead.id)
      .eq("version", ver)
      .maybeSingle();

    const { data, error } = await supabase.functions.invoke("generate-email", {
      body: {
        templateKey: TEMPLATE[purpose],
        leadContext: {
          ...l,
          language: language ?? l.language,
          programme_title: plan.trip_title,
          programme_summary: plan.narrative,
          itinerary_url: (proposal as any)?.public_token
            ? `https://yourtoursportugal.lovable.app/proposal/${(proposal as any).public_token}`
            : null,
          booking_url: (proposal as any)?.wetravel_checkout_url ?? null,
          senderName: "Yorick Viche",
        },
        customNotes: [purpose === "custom" ? null : `Purpose: ${purpose}`, notes].filter(Boolean).join("\n"),
      },
    });
    if (error) throw new ToolError(error.message);
    const email = (data as any)?.email;
    if (!email?.body) throw new ToolError("The email generator returned no content — try again with clearer notes");

    const attachments: Record<string, unknown>[] = [];
    const warnings = planWarnings(plan);
    if (attach_travel_plan_pdf) {
      if (!plan.days.length) throw new ToolError(`Lead ${ref} has no travel plan to attach on version ${ver}`);
      const pdf = await renderTravelPlanPdf(supabase, lead, ver, plan, meta);
      const stored = await storeTravelPlanPdf(supabase, lead, pdf);
      attachments.push({ filename: stored.file_name, path: stored.storage_path, signed_url: stored.signed_url, pages: pdf.pages });
    }

    const { item, created } = await enqueueAction(supabase, ctx, lead, {
      type: "client_email",
      title: `${ref} · ${l.client_name} — ${email.subject}`,
      subtitle: purpose,
      idempotencyKey: `client:${purpose}:${email.subject}`,
      payload: {
        to: l.email,
        cc: cc ?? [],
        bcc: bcc ?? [],
        subject: email.subject,
        html: email.body,
        purpose,
        language: language ?? l.language ?? "EN",
        attachments,
        from: "reservas@yourtours.pt",
      },
    });

    if (created) {
      await auditLead(supabase, ctx, lead, "client_email_drafted", {
        client_email: { from: null, to: `${email.subject} — awaiting human approval` },
      }, { approval_id: item.id, purpose });
    }

    const payload = {
      approval_id: item.id,
      already_queued: !created,
      lead: ref,
      to: l.email,
      subject: email.subject,
      attachments: attachments.map((a) => a.filename),
      programme_warnings: warnings,
      note: "No email was sent. Approve it in 'Aprovações AI' to send from reservas@yourtours.pt.",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
