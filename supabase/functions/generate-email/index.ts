import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

  try {
    const { templateKey, leadContext, customNotes } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
- Write in English by default (adapt if client writes in another language)
- Use short, clear sentences
- Show local expertise without exaggeration
- Sound human — not AI-generated
- Reference specific client details in every reply
- NEVER use generic travel agency language
- NEVER write long blocks without structure
- NEVER make vague promises`;

    const userPrompt = `Personalize this email template using the lead context provided. Replace ALL placeholders with real data. If data is missing, make a smart contextual choice or omit that section gracefully.

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

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
