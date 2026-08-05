import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Purpose =
  | "auto" | "proposal" | "proposal_update" | "welcome"
  | "qualification" | "followup" | "booking" | "custom";

const PURPOSE_BRIEF: Record<string, string> = {
  proposal:
    "First presentation of the tailor-made proposal. Warm opening referencing what the client asked for, 2-4 short paragraphs, invite them to open the digital itinerary, mention that everything can be fine-tuned.",
  proposal_update:
    "An UPDATED version of a proposal already sent. Open by naming exactly what changed (use bold for the changed elements), then invite them to review the updated itinerary.",
  welcome:
    "Welcome / thank-you for the inquiry. No program, no price. Say what we will do, when the proposal arrives (24-48h), and the next steps.",
  qualification:
    "We cannot build the proposal yet because information is missing. Ask ONLY for what is actually missing, as a short numbered list. No program, no price.",
  followup:
    "Gentle follow-up on a proposal already sent. Add one piece of local value or urgency (availability), no pressure.",
  booking:
    "Booking confirmed / operational recap. Confirm details, payment status and what happens next.",
  custom: "Follow the team notes strictly.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const __auth = await requireInternalUser(req);
  if (!__auth.ok) return __auth.response;

  try {
    const body = await req.json();
    const leadId: string | undefined = body.leadId;
    const requested: Purpose = body.purpose || "auto";
    const language: string = body.language || "EN";
    const senderName: string = body.senderName || "Your Tours Portugal";
    const customNotes: string = body.customNotes || "";
    const mode: "full" | "block" = body.mode || "full";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Backend not configured");
    const sb = createClient(supabaseUrl, serviceKey);

    /* ── context ─────────────────────────────────────────────────────── */
    let lead: any = null;
    let proposal: any = null;
    let planner: any[] = [];
    let payments: any[] = [];
    let activeLink: any = null;
    let lastEmails: any[] = [];

    if (leadId) {
      lead = (await sb.from("leads").select("*").eq("id", leadId).maybeSingle()).data;
      proposal = (
        await sb
          .from("proposals")
          .select(
            "id, title, client_name, date_range, participants, hero_image_url, brand_logo_url, public_token, days, total_value_eur, deposit_amount_eur, closing_terms, wetravel_checkout_url, language, status, sent_at, updated_at, created_at",
          )
          .eq("lead_id", leadId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;
      planner = (
        await sb
          .from("lead_planner_data")
          .select("day_number, title, description, activities")
          .eq("lead_id", leadId)
          .order("day_number")
      ).data || [];
      payments = (await sb.from("lead_payments").select("kind, amount, currency, paid_at").eq("lead_id", leadId)).data || [];
      activeLink = (
        await sb.from("payment_links").select("url, amount_cents, deposit_cents, currency, is_active")
          .eq("lead_id", leadId).eq("is_active", true).limit(1).maybeSingle()
      ).data;
      lastEmails = (
        await sb.from("booking_emails_log").select("subject, email_category, sent_at")
          .eq("lead_id", leadId).order("sent_at", { ascending: false }).limit(5)
      ).data || [];
    }

    /* ── missing info + auto purpose ─────────────────────────────────── */
    const missing: string[] = [];
    if (lead) {
      if (!lead.travel_dates) missing.push("travel dates");
      if (!lead.pax) missing.push("number of travellers (adults / children)");
      if (!lead.destination) missing.push("regions or experiences of interest");
      if (!lead.budget_level) missing.push("budget range");
      if (!lead.comfort_level) missing.push("accommodation / comfort level");
    }

    let purpose: Purpose = requested;
    if (requested === "auto") {
      const hasProposal = !!proposal && Array.isArray(proposal.days) && proposal.days.length > 0;
      const status = String(lead?.status || "").toLowerCase();
      if (["won", "paid", "confirmed"].includes(status)) purpose = "booking";
      else if (!hasProposal) purpose = missing.length >= 2 ? "qualification" : "welcome";
      else {
        const sentProposalBefore = lastEmails.some((e) =>
          ["proposal", "proposal_update", "send_proposal"].includes(String(e.email_category || "")),
        );
        purpose = sentProposalBefore ? "proposal_update" : "proposal";
      }
    }

    const withProgram = ["proposal", "proposal_update", "followup", "booking"].includes(purpose);

    /* ── program payload for the email builder ───────────────────────── */
    const notes = (proposal?.closing_terms as any) || {};
    const program = proposal
      ? {
          title: proposal.title,
          clientName: proposal.client_name,
          ytCode: lead?.yt_id || lead?.lead_code || proposal.booking_ref || "",
          dateLabel: proposal.date_range,
          publicToken: proposal.public_token,
          heroImageUrl: proposal.hero_image_url,
          brandLogoUrl: proposal.brand_logo_url,
          totalEur: lead?.pvp_override ?? proposal.total_value_eur,
          currency: "EUR",
          importantNotes:
            notes.importantNotes || notes.important_notes || notes.notes || null,
          bookNowUrl: activeLink?.url || proposal.wetravel_checkout_url || null,
          days: (Array.isArray(proposal.days) ? proposal.days : []).map((d: any, i: number) => ({
            day_number: d.day_number ?? d.dayNumber ?? i + 1,
            title: d.title || "",
            subtitle: d.subtitle || "",
            date_label: d.date_label || d.dateLabel || "",
            items: (d.items || d.inclusions || d.highlights || []).map((x: any) =>
              typeof x === "string" ? x : x?.text || x?.title || "",
            ).filter(Boolean),
          })),
        }
      : null;

    /* ── prompt ──────────────────────────────────────────────────────── */
    const systemPrompt = `You are the senior travel designer writing client emails for Your Tours Portugal (YTP), a premium private DMC in Portugal.

VOICE (founder style):
- ALWAYS write in the first person PLURAL as the company: "we", "our team", "us" (Your Tours Portugal). NEVER use "I", "my", "me" — not in the opening, main, closing, next steps or signature. The signature is the consultant's name followed by Your Tours Portugal, but the body always speaks as "we".
- Direct, warm, expert. Never salesy, never generic travel-agency language.
- Short paragraphs (max 2-3 lines). No filler.
- Reference the client's specific request and details.
- Use **bold** only for the truly key elements (changed items, dates, prices).
- Every email ends with defined next steps: action + who + when (Lisbon time).

WRITE THE ENTIRE EMAIL IN ${language}. Subject included.
SUBJECT RULE: the subject MUST always contain the reference code ${lead?.yt_id || lead?.lead_code || proposal?.booking_ref || ""} (e.g. "Douro Valley Private Tour - YT5014"). Never omit it.
Never invent prices, dates, inclusions or supplier names that are not in the context.
Do not write unsubscribe text, do not repeat the itinerary day-by-day in prose (the program block is rendered separately by the system).`;

    const contextJson = JSON.stringify(
      {
        lead: lead && {
          client_name: lead.client_name, yt_id: lead.yt_id || lead.lead_code,
          destination: lead.destination, travel_dates: lead.travel_dates,
          dates_type: lead.dates_type, pax: lead.pax, pax_children: lead.pax_children,
          status: lead.status, budget_level: lead.budget_level,
          travel_style: lead.travel_style, comfort_level: lead.comfort_level,
          magic_question: lead.magic_question, notes: lead.notes,
          sales_owner: lead.sales_owner,
        },
        proposal: program && {
          title: program.title, date_range: program.dateLabel,
          total_eur: program.totalEur, days: program.days,
          has_book_now: !!program.bookNowUrl,
        },
        planner_days: planner.map((p) => ({ day: p.day_number, title: p.title })),
        payments_recorded: payments,
        recent_emails: lastEmails,
        missing_info: missing,
      },
      null,
      2,
    );

    let userPrompt: string;
    if (mode === "block") {
      const blockKey = body.blockKey || "main";
      const action = body.action || "regenerate";
      const actionBrief: Record<string, string> = {
        regenerate: "Rewrite this block from scratch, keeping the same intent.",
        shorten: "Make it clearly shorter and sharper, same meaning.",
        premium: "Make it more premium and elegant, still direct.",
        friendly: "Make it warmer and more personal.",
        translate: `Translate it faithfully into ${language}.`,
      };
      userPrompt = `Rewrite ONE block of a client email.

BLOCK: ${blockKey}
INSTRUCTION: ${actionBrief[action] || actionBrief.regenerate}
EMAIL PURPOSE: ${purpose} — ${PURPOSE_BRIEF[purpose] || ""}
CURRENT TEXT:
${body.currentText || "(empty)"}

CONTEXT:
${contextJson}

TEAM NOTES: ${customNotes || "none"}

Return ONLY JSON: { "text": "the rewritten block, plain text with **bold** where useful" }`;
    } else {
      userPrompt = `Write a client email in ${language}.

PURPOSE: ${purpose} — ${PURPOSE_BRIEF[purpose] || ""}
PROGRAM BLOCK WILL BE INSERTED BY THE SYSTEM: ${withProgram ? "YES (cover image, day-by-day, total price, notes, Book Now)" : "NO"}

CONTEXT:
${contextJson}

TEAM NOTES: ${customNotes || "none"}
SENDER: ${senderName}

Return ONLY JSON with this exact shape:
{
  "subject": "string",
  "greeting": "e.g. Hi Ben,",
  "opening": "1-2 short paragraphs, plain text, **bold** allowed",
  "main": "${withProgram ? "1-3 short paragraphs introducing the program before it is shown" : "the core content, including the numbered list of missing information when purpose is qualification"}",
  "closing": "1-2 short lines after the program block",
  "next_steps": [{ "action": "string", "responsible": "string", "timeframe": "string" }],
  "signature": "sender name + Your Tours Portugal, 2-3 lines plain text"
}`;
    }

    /* ── AI call: Gemini direct → Lovable gateway ────────────────────── */
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const callGemini = async () => {
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}\n\nReturn ONLY valid JSON.` }] }],
            generationConfig: { temperature: 0.6, responseMimeType: "application/json" },
          }),
        },
      );
      if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
      const gd = await r.json();
      const raw = (gd.candidates?.[0]?.content?.parts?.[0]?.text || "")
        .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      return JSON.parse(raw);
    };

    const callGateway = async () => {
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          reasoning_effort: "none",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `${userPrompt}\n\nReturn ONLY valid JSON.` },
          ],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        const err: any = new Error(`Gateway ${r.status}: ${t}`);
        err.status = r.status;
        throw err;
      }
      const d = await r.json();
      const raw = (d.choices?.[0]?.message?.content || "")
        .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      return JSON.parse(raw);
    };

    let result: any;
    try {
      result = await callGemini();
    } catch (e1) {
      console.error("Gemini direct failed:", e1);
      try {
        result = await callGateway();
      } catch (e2: any) {
        console.error("Gateway failed:", e2);
        const status = e2?.status === 402 || e2?.status === 429 ? e2.status : 502;
        return new Response(
          JSON.stringify({
            error: status === 402
              ? "Créditos de AI esgotados. Adicione créditos nas configurações do workspace."
              : status === 429
                ? "Limite de pedidos AI atingido. Tente novamente em alguns instantes."
                : "Serviços de AI indisponíveis.",
          }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const ytRef = String(lead?.yt_id || lead?.lead_code || proposal?.booking_ref || "").trim();
    const dropFirstPerson = (t: string) =>
      typeof t === "string"
        ? t
            .replace(/\bI am\b/g, "We are").replace(/\bI'm\b/g, "We're")
            .replace(/\bI have\b/g, "We have").replace(/\bI've\b/g, "We've")
            .replace(/\bI will\b/g, "We will").replace(/\bI'll\b/g, "We'll")
            .replace(/\bI would\b/g, "We would").replace(/\bI'd\b/g, "We'd")
            .replace(/\bI can\b/g, "We can").replace(/\bI\b/g, "We")
            .replace(/\bmy\b/g, "our").replace(/\bMy\b/g, "Our")
            .replace(/\bmine\b/g, "ours")
        : t;

    if (mode === "block" && result?.text) result.text = dropFirstPerson(result.text);
    if (mode !== "block" && result) {
      for (const k of ["greeting", "opening", "main", "closing"]) {
        if (typeof result[k] === "string") result[k] = dropFirstPerson(result[k]);
      }
      if (Array.isArray(result.next_steps)) {
        result.next_steps = result.next_steps.map((s: any) => ({
          ...s,
          action: dropFirstPerson(s?.action || ""),
        }));
      }
      // Subject is always deterministic: YTID - Trip Name - Dates - Client Name
      const tripName = String(proposal?.title || lead?.destination || "").trim();
      const subjectDates = String(proposal?.date_range || lead?.travel_dates || "").trim();
      const clientName = String(lead?.client_name || proposal?.client_name || "").trim();
      const subjectParts = [ytRef, tripName, subjectDates, clientName].filter(Boolean);
      if (subjectParts.length) result.subject = subjectParts.join(" - ");
    }


    return new Response(
      JSON.stringify({
        purpose_resolved: purpose,
        include_program: withProgram,
        missing_info: missing,
        program,
        blocks: mode === "block" ? undefined : result,
        text: mode === "block" ? result?.text || "" : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-email-blocks error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
