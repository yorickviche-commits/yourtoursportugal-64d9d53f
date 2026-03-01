import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { emailText } = await req.json();
    if (!emailText || typeof emailText !== "string" || emailText.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Please paste a valid email conversation." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a travel operations assistant for Your Tours Portugal, a premium DMC.
Extract client and trip information from email conversations.
Always respond using the extract_lead_data tool.
If a field cannot be determined from the email, leave it as null.
For dates, indicate if they are concrete or estimated/flexible.
For language, detect from the email language (EN, PT, FR, ES, DE, IT, NL).
Budget should be extracted if mentioned, otherwise null.`,
          },
          {
            role: "user",
            content: `Extract the lead data from this email conversation:\n\n${emailText.slice(0, 8000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_lead_data",
              description: "Extract structured lead data from an email conversation",
              parameters: {
                type: "object",
                properties: {
                  clientName: { type: "string", description: "Full name of the client" },
                  email: { type: "string", description: "Client email address" },
                  phone: { type: "string", description: "Client phone number" },
                  travelDates: { type: "string", description: "Travel dates mentioned" },
                  datesType: { type: "string", enum: ["concrete", "estimated"], description: "Whether dates are concrete or estimated/flexible" },
                  pax: { type: "number", description: "Number of travelers" },
                  language: { type: "string", enum: ["EN", "PT", "FR", "ES", "DE", "IT", "NL"], description: "Detected language" },
                  budget: { type: "string", description: "Budget if mentioned" },
                  destination: { type: "string", description: "Desired destination in Portugal" },
                  request: { type: "string", description: "Main request or what the client is looking for" },
                  preferences: { type: "string", description: "Specific preferences, interests, or requirements" },
                },
                required: ["clientName"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_lead_data" } },
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

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-lead-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
