import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callGateway(messages: any[], apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
    }),
  });
  if (!res.ok) {
    const err: any = new Error(`Gateway ${res.status}`);
    err.status = res.status;
    await res.text();
    throw err;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "[]";
}

async function callGeminiFallback(messages: any[]) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("No fallback API key available");

  const prompt = messages.map((m: any) => m.content).join("\n\n");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    console.error("Gemini fallback error:", res.status, t);
    throw new Error("Gemini fallback failed");
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { items, destination } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const [suppRes, svcRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/suppliers?status=eq.active&select=name,category,currency`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/supplier_services?status=eq.active&select=name,category,price,price_child,price_unit,supplier_id,currency`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }),
    ]);

    const suppliers = await suppRes.json();
    const services = await svcRes.json();

    const supplierNames = (suppliers || []).map((s: any) => `${s.name} (${s.category})`).join(', ');
    const serviceList = (services || []).slice(0, 50).map((s: any) =>
      `"${s.name}" cat:${s.category} price:${s.price}€/${s.price_unit}`
    ).join('\n');
    const itemDescriptions = items.map((it: any, i: number) =>
      `${i + 1}. Day ${it.day}: "${it.description}" (pricing: ${it.pricingType})`
    ).join('\n');

    const prompt = `You are a travel operations budget assistant for Your Tours Portugal.
Destination: ${destination || 'Portugal'}

Our registered suppliers (FSE database):
${supplierNames || 'No suppliers registered yet.'}

Our supplier services with prices:
${serviceList || 'No services registered yet.'}

Cost items that need suppliers and pricing:
${itemDescriptions}

For each item, suggest:
1. The best matching supplier from our database (exact name match). If no good match, suggest "WEB" and provide a market-rate estimate.
2. A realistic NET unit price in EUR based on Portugal tourism market rates for ${destination || 'Portugal'}.
3. Whether pricing should be "per_person" or "total".

IMPORTANT: Use real Portugal market rates. For restaurants: 15-45€/person. Hotels: 80-250€/night. Guides: 150-300€/day. Activities: 20-80€/person. Transport: 100-400€/day. Wine tastings: 15-40€/person.

Return ONLY a JSON array with objects:
[{"index":0,"supplier":"Name or WEB","priceAdults":25,"pricingType":"per_person","marginPercent":30}]`;

    const messages = [
      { role: "system", content: "You are a travel budget assistant. Return only valid JSON arrays." },
      { role: "user", content: prompt },
    ];

    let content: string;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    try {
      if (!LOVABLE_API_KEY) throw Object.assign(new Error("No gateway key"), { status: 402 });
      content = await callGateway(messages, LOVABLE_API_KEY);
    } catch (err: any) {
      if (err.status === 402 || err.status === 429) {
        console.warn(`Gateway ${err.status}, falling back to Gemini`);
        content = await callGeminiFallback(messages);
      } else {
        throw err;
      }
    }

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let suggestions;
    try {
      suggestions = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      suggestions = [];
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-fulfill error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
