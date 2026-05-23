import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const toolDef = {
  type: "function" as const,
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
        travelStartDate: { type: "string", description: "Start date of travel in YYYY-MM-DD format if determinable, otherwise null" },
        travelEndDate: { type: "string", description: "End date of travel in YYYY-MM-DD format if determinable, otherwise null" },
        numberOfDays: { type: "number", description: "Number of travel days if mentioned or calculable from dates" },
        travelStyle: { type: "array", items: { type: "string" }, description: "Travel styles detected: e.g. 'Cultural', 'Gastronomy', 'Wine', 'Adventure', 'Nature', 'Romantic', 'Family', 'Luxury', 'Beach', 'History', 'Photography', 'Wellness'" },
        comfortLevel: { type: "string", enum: ["budget", "standard", "superior", "luxury"], description: "Comfort/accommodation level inferred from budget, preferences or explicit mention" },
      },
      required: ["clientName"],
      additionalProperties: false,
    },
  },
};

const systemPrompt = `You are a travel operations assistant for Your Tours Portugal, a premium DMC.
Extract client and trip information from email conversations.
Always respond using the extract_lead_data tool.
If a field cannot be determined from the email, leave it as null.
For dates, indicate if they are concrete or estimated/flexible.
When dates are mentioned, also extract travelStartDate and travelEndDate in YYYY-MM-DD format. Calculate numberOfDays from the date range if possible.
For language, detect from the email language (EN, PT, FR, ES, DE, IT, NL).
Budget should be extracted if mentioned, otherwise null.
For travelStyle, infer from context: wine tours → Wine, food mentions → Gastronomy, history/monuments → Cultural/History, hiking/outdoors → Adventure/Nature, honeymoon/couples → Romantic, kids → Family, spa/retreat → Wellness, etc. Multiple styles can apply.
For comfortLevel, infer from budget level, hotel preferences, or explicit mentions: budget travelers → budget, mid-range → standard, upscale/boutique → superior, 5-star/luxury mentions → luxury.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, init: RequestInit, label: string, maxAttempts = 4): Promise<Response> {
  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    lastStatus = res.status;
    // Only retry transient errors
    if (res.status !== 429 && res.status < 500) {
      return res;
    }
    lastText = await res.text().catch(() => "");
    console.warn(`[${label}] attempt ${attempt} failed ${res.status}: ${lastText.slice(0, 200)}`);
    if (attempt < maxAttempts) {
      // exp backoff with jitter: 800ms, 1.8s, 3.5s
      const delay = Math.min(800 * Math.pow(2, attempt - 1), 4000) + Math.random() * 300;
      await sleep(delay);
    }
  }
  // Reconstruct a Response-like with the last error to keep flow uniform
  return new Response(lastText || `Retry exhausted ${lastStatus}`, { status: lastStatus || 500 });
}

async function callLovableGateway(emailText: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract the lead data from this email conversation:\n\n${emailText.slice(0, 8000)}` },
      ],
      tools: [toolDef],
      tool_choice: { type: "function", function: { name: "extract_lead_data" } },
    }),
  }, "gateway");

  if (!response.ok) {
    const err: any = new Error(`Gateway error ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in response");
  return JSON.parse(toolCall.function.arguments);
}

async function callGeminiFallback(emailText: string) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("No Gemini API key");

  const prompt = `${systemPrompt}\n\nExtract the lead data from this email conversation and return ONLY valid JSON with these fields: clientName, email, phone, travelDates, datesType (concrete|estimated), pax (number), language (EN|PT|FR|ES|DE|IT|NL), budget, destination, request, preferences, travelStartDate (YYYY-MM-DD or null), travelEndDate (YYYY-MM-DD or null), numberOfDays (number or null), travelStyle (array of strings or []), comfortLevel (budget|standard|superior|luxury or null). If unknown, use null.\n\nEmail:\n${emailText.slice(0, 8000)}`;

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
    "gemini"
  );

  if (!response.ok) {
    const t = await response.text();
    console.error("Gemini fallback error:", response.status, t);
    throw new Error(`Gemini ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No content from Gemini");
  return JSON.parse(text);
}

async function callOpenAIFallback(emailText: string) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("No OpenAI API key");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract the lead data from this email conversation:\n\n${emailText.slice(0, 8000)}` },
      ],
      tools: [toolDef],
      tool_choice: { type: "function", function: { name: "extract_lead_data" } },
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    console.error("OpenAI fallback error:", response.status, t);
    throw new Error(`OpenAI ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call from OpenAI");
  return JSON.parse(toolCall.function.arguments);
}

async function callAnthropicFallback(emailText: string) {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("No Anthropic API key");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2048,
      system: systemPrompt,
      tools: [{
        name: "extract_lead_data",
        description: toolDef.function.description,
        input_schema: toolDef.function.parameters,
      }],
      tool_choice: { type: "tool", name: "extract_lead_data" },
      messages: [
        { role: "user", content: `Extract the lead data from this email conversation:\n\n${emailText.slice(0, 8000)}` },
      ],
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    console.error("Anthropic fallback error:", response.status, t);
    throw new Error(`Anthropic ${response.status}`);
  }

  const data = await response.json();
  const toolUse = data.content?.find((c: any) => c.type === "tool_use");
  if (!toolUse) throw new Error("No tool use from Anthropic");
  return toolUse.input;
}

async function extractWithFailover(emailText: string) {
  const errors: string[] = [];
  try { return await callLovableGateway(emailText); }
  catch (e: any) { console.warn("Gateway failed:", e.status || e.message); errors.push(`gateway:${e.status || e.message}`); }
  try { return await callGeminiFallback(emailText); }
  catch (e: any) { console.warn("Gemini failed:", e.message); errors.push(`gemini:${e.message}`); }
  try { return await callOpenAIFallback(emailText); }
  catch (e: any) { console.warn("OpenAI failed:", e.message); errors.push(`openai:${e.message}`); }
  try { return await callAnthropicFallback(emailText); }
  catch (e: any) { console.warn("Anthropic failed:", e.message); errors.push(`anthropic:${e.message}`); }
  throw new Error(`All AI providers failed: ${errors.join(" | ")}`);
}

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

    const extracted = await extractWithFailover(emailText);

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
