import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function injectBookNowButton(body: string, checkoutUrl?: string | null, depositEur?: number | null): string {
  if (!checkoutUrl) return body;
  const buttonHtml = `\n\n<div style="text-align:center;margin:24px 0;"><a href="${checkoutUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-family:Arial,sans-serif;">✈️ Book Now — Reserve Your Spot</a><p style="margin:8px 0 0;font-size:12px;color:#64748b;">${depositEur ? `€${depositEur} deposit · ` : ''}50% of total · 100% refundable</p></div>\n\n`;
  const sigPattern = /\n(Best regards|Kind regards|Warmly|Warm regards|À bientôt|Cordialement|Mit freundlichen|Atenciosamente|Com os melhores)/i;
  const idx = body.search(sigPattern);
  if (idx !== -1) return body.slice(0, idx) + buttonHtml + body.slice(idx);
  return body + buttonHtml;
}



const SALES_TEMPLATES: Record<string, { subject: string; body: string }> = {
  "new_inquiry": {
    subject: "Thanks for reaching out — let's build your Portugal experience",
    body: `Hi [FirstName],

Thank you for contacting Your Tours Portugal.

I've read your request and I'm already thinking about the best options for you.

To tailor the perfect experience, could you confirm a few details?

1. What are your travel dates (arrival and departure)?
2. How many people are travelling? (adults / children?)
3. Which regions or experiences interest you most? (Douro Valley, Lisbon, Porto, Alentejo, etc.)
4. Do you have a budget range in mind?
5. Any preferences or restrictions we should know? (dietary, mobility, pace of travel)

Once I have this, I'll prepare a personalised proposal — usually within 24–48 hours.

Looking forward to designing something exceptional for you.

[Signature]
Your Tours Portugal`,
  },
  "send_proposal": {
    subject: "Your tailor-made Portugal proposal — [Destination], [TravelDates]",
    body: `Hi [FirstName],

As promised, please find attached your personalised proposal for [TravelDates] in [Destination] — designed around your interests and travel style.

Highlights of the experience:
- [Highlight 1]
- [Highlight 2]
- [Highlight 3]

Total: [TotalPrice] for [Pax] travellers — includes private guiding, transport, curated experiences and 24/7 local support.

Take your time to review it. If you'd like to fine-tune anything (pace, experiences, accommodations) just reply and we'll adjust.

Happy to jump on a quick call if helpful: https://url-shortener.me/BT2R

Looking forward to your thoughts.

[Signature]
Your Tours Portugal`,
  },
  "proposal_followup": {
    subject: "Did you receive your personalised Portugal proposal?",
    body: `Hi [FirstName],

Just checking in — I sent your personalised proposal yesterday and wanted to make sure it reached you.

The itinerary covers [highlight 1], [highlight 2], and [highlight 3] — designed specifically around your interests.

A few things worth noting:
- Availability for [date range] is currently confirmed
- [Specific supplier/experience] has limited spots for that period

If you'd like to adjust anything — pace, budget, a specific experience — just say the word.

Ready to move forward? Simply reply to this email and I'll take it from there.

[Signature]`,
  },
  "followup_3days": {
    subject: "One idea to make your Portugal trip even better",
    body: `Hi [FirstName],

I know planning a trip takes time — no rush at all.

While reviewing your itinerary, I thought of something that could really elevate your [destination] day: [specific local tip or experience addition].

It's the kind of thing most guides don't mention — and exactly why having a local expert makes a difference.

Happy to add it to your proposal or answer any questions you have.

[Signature]`,
  },
  "followup_7days": {
    subject: "Shall I keep your dates on hold?",
    body: `Hi [FirstName],

I've been holding [travel dates] provisionally on our end, but I want to make sure I'm not blocking something you no longer need.

If you're still interested — even if just partially — let me know and we can adjust the proposal.

If plans have changed, no problem at all — just let me know so I can release the dates.

Either way, I'm here.

[Signature]`,
  },
  "breakup": {
    subject: "Closing the loop — Your Tours Portugal",
    body: `Hi [FirstName],

I haven't heard back and I don't want to keep cluttering your inbox.

I'm going to close your inquiry for now — but the door is always open.

If Portugal comes back onto the radar — next year, a different season, a different trip — just reach out. We'll pick up right where we left off.

Wishing you great travels, wherever they take you.

[Signature]
Your Tours Portugal`,
  },
  "booking_confirmed": {
    subject: "Your booking is confirmed — here's everything you need",
    body: `Hi [FirstName],

Great news — your tour is officially confirmed. Here's a full recap:

**Trip:** [Tour Name]
**Date:** [Date]
**Pickup:** [Time] at [Hotel/Location]
**Group:** [Pax number]
**File Reference:** [FileRef]

**What's included:**
- [Item 1]
- [Item 2]
- [Item 3]

**Emergency contact:** [Phone] (available from [time] on the day)

Your guide will be in touch 2 days before the tour with final confirmation.

Looking forward to showing you the best of Portugal.

[Signature]`,
  },
  "supplier_confirmation": {
    subject: "Booking Confirmation — [FileRef] | [Date] | [Pax] Pax",
    body: `Hi [Supplier Name],

Please find below the details for our upcoming booking:

**File:** [FileRef]
**Date:** [Date]
**Service:** [Service description]
**Pax:** [Number] adults / [Number] children
**Pickup:** [Time] at [Location]
**Special notes:** [Dietary / mobility / preferences]

Please confirm availability and service details by [Deadline].

Thank you,
[SenderName]
Your Tours Portugal
Operations Team`,
  },
  "guide_briefing": {
    subject: "Guide Briefing — [FileRef] | [Date]",
    body: `Hi [Guide Name],

Here's the briefing for your upcoming tour:

**File:** [FileRef]
**Date:** [Date]
**Pickup:** [Time] at [Hotel Name, Address]
**Client:** [ClientName]
**Group:** [Pax]
**Language:** [Language]

**Client profile:**
[Brief description — interests, travel style, expectations]

**Key preferences:**
- [Preference 1]
- [Preference 2]

**Special notes:**
- [Dietary restrictions]
- [Mobility considerations]

Let me know if you have any questions before the tour.

[Signature]
Operations Team — Your Tours Portugal`,
  },
  "post_tour_review": {
    subject: "Thank you for travelling with us — quick favour?",
    body: `Hi [FirstName],

It was a pleasure having you with us.

We hope your experience was everything you hoped for — and maybe a little more.

If you have 2 minutes, we'd love to hear your thoughts:

→ [Review Link]

Your feedback helps us keep improving and helps other travellers find us.

And if you're already thinking about the next trip — we'd love to be part of it.

Warm regards,
[Signature]
Your Tours Portugal`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const __auth = await requireInternalUser(req);
  if (!__auth.ok) return __auth.response;


  try {
    const { templateKey, leadContext, customNotes } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Enrich leadContext with WeTravel checkout URL from proposals table
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey && leadContext?.id) {
        const sb = createClient(supabaseUrl, serviceKey);
        const { data: leadLive } = await sb
          .from('leads').select('active_version').eq('id', leadContext.id).maybeSingle();
        const { data: proposalWT } = await sb
          .from('proposals')
          .select('wetravel_checkout_url, deposit_amount_eur, deposit_percent')
          .eq('lead_id', leadContext.id)
          .eq('version', Number((leadLive as any)?.active_version ?? 0))
          .maybeSingle();
        if (proposalWT?.wetravel_checkout_url) {
          (leadContext as any).wetravel_checkout_url = proposalWT.wetravel_checkout_url;
          (leadContext as any).deposit_amount_eur = proposalWT.deposit_amount_eur;
        }
      }
    } catch (e) {
      console.error('WeTravel context fetch failed (non-fatal):', e);
    }

    const template = SALES_TEMPLATES[templateKey];
    if (!template) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const systemPrompt = `You are the Sales & Operations AI Manager for Your Tours Portugal (YTP) — a premium private tour operator and DMC specializing in tailor-made experiences across Portugal.

COMMUNICATION TONE:
- Direct, pragmatic, professional
- Solution-oriented with clear CTAs
- Human warmth + operational efficiency
- Never too formal, never robotic
- Short paragraphs (max 2–3 lines)
- Every email ends with: defined next step + responsible party + deadline

MANDATORY EMAIL STRUCTURE (FYXER PROTOCOL):
1. What we are presenting — clear and specific
2. What we need from the client — no vague requests
3. Timeline — date + time + timezone (Lisbon time)
4. Clear CTA — one action, one next step

RULES:
- CRITICAL: Always write in the client's language. The lead context includes a 'language' field (e.g. EN, PT, FR, DE, ES). Use that language for the ENTIRE email — subject and body. If language is not specified, default to EN.
- Match Yorick's voice: direct, warm, expert, never salesy. Short sentences. No filler phrases.
- Use short, clear sentences
- Show local expertise without exaggeration
- Sound human — not AI-generated
- Reference specific client details in every reply
- NEVER use generic travel agency language
- NEVER write long blocks without structure
- NEVER make vague promises`;

    const clientLanguage = (leadContext as any)?.language || 'EN';
    const userPrompt = `MANDATORY: Write this entire email in ${clientLanguage} language (subject and body).

Personalize this email template using the lead context provided. Replace ALL placeholders with real data. If data is missing, make a smart contextual choice or omit that section gracefully.

TEMPLATE:
Subject: ${template.subject}

${template.body}

LEAD CONTEXT:
${JSON.stringify(leadContext, null, 2)}

ADDITIONAL NOTES FROM TEAM:
${customNotes || "None"}

Return a JSON object with:
- "subject": the personalized subject line
- "body": the personalized email body (plain text with **bold** for emphasis)
- "internal_notes": { "pipeline_stage": string, "lead_score_estimate": number, "missing_info": string[], "suggested_next_action": string, "assigned_to": string }

Use the extract_email tool to return the result.`;

    // Strategy: call Gemini direct FIRST (gateway has been returning 402 — wasted ~10s round-trip).
    // Fallback to Lovable AI gateway only if direct fails.
    let data: any;
    let result: any;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    const callGeminiDirect = async () => {
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
      const fallbackPrompt = `${systemPrompt}\n\n${userPrompt}\n\nIMPORTANT: Return ONLY a valid JSON object with keys "subject", "body", and "internal_notes". No markdown, no extra text.`;
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fallbackPrompt }] }],
            generationConfig: {
              temperature: 0.6,
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      );
      if (!r.ok) {
        const t = await r.text();
        console.error("Gemini direct error:", r.status, t);
        throw new Error(`Gemini ${r.status}`);
      }
      const gd = await r.json();
      let rawText = gd.candidates?.[0]?.content?.parts?.[0]?.text || "";
      rawText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      return JSON.parse(rawText);
    };

    const callLovableGateway = async () => {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_email",
              description: "Return the personalized email",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string" },
                  body: { type: "string" },
                  internal_notes: {
                    type: "object",
                    properties: {
                      pipeline_stage: { type: "string" },
                      lead_score_estimate: { type: "number" },
                      missing_info: { type: "array", items: { type: "string" } },
                      suggested_next_action: { type: "string" },
                      assigned_to: { type: "string" },
                    },
                    required: ["pipeline_stage", "lead_score_estimate", "missing_info", "suggested_next_action", "assigned_to"],
                  },
                },
                required: ["subject", "body", "internal_notes"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_email" } },
        }),
      });
      if (!response.ok) throw new Error(`Gateway ${response.status}`);
      data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call in response");
      return JSON.parse(toolCall.function.arguments);
    };

    try {
      result = await callGeminiDirect();
    } catch (directErr) {
      console.error("Gemini direct failed, falling back to Lovable gateway:", directErr);
      try {
        result = await callLovableGateway();
      } catch (gatewayErr) {
        console.error("Both AI providers failed:", gatewayErr);
        return new Response(JSON.stringify({ error: "AI providers unavailable" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    result.body = injectBookNowButton(result.body, (leadContext as any).wetravel_checkout_url, (leadContext as any).deposit_amount_eur);


    return new Response(JSON.stringify({ email: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
