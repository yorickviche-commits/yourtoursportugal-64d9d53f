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
    const { items, destination, fseContext } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

    // Fetch suppliers, supplier_services, partners, and partner_services in parallel
    const [suppRes, svcRes, partRes, pSvcRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/suppliers?status=eq.active&select=id,name,category,currency,net_rates,commission_structure,notes`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/supplier_services?status=eq.active&select=name,category,price,price_child,price_unit,supplier_id,currency,description,duration,booking_conditions,payment_conditions`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/partners?status=eq.active&select=id,name,category,currency,territory,commission_percent,notes`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/partner_services?status=eq.active&select=name,category,price,price_child,price_unit,partner_id,currency,description,duration,booking_conditions,payment_conditions`, { headers }),
    ]);

    const suppliers = await suppRes.json();
    const services = await svcRes.json();
    const partners = await partRes.json();
    const partnerServices = await pSvcRes.json();

    // Build comprehensive supplier context
    const supplierNames = (suppliers || []).map((s: any) =>
      `${s.name} (${s.category})${s.notes ? ` — ${s.notes.slice(0, 80)}` : ''}`
    ).join('\n');

    const serviceList = (services || []).map((s: any) => {
      const supplier = (suppliers || []).find((sup: any) => sup.id === s.supplier_id);
      return `"${s.name}" by ${supplier?.name || '?'} | cat:${s.category} | NET:${s.price}€/${s.price_unit}${s.price_child ? ` child:${s.price_child}€` : ''}${s.duration ? ` | dur:${s.duration}` : ''}`;
    }).join('\n');

    const partnerNames = (partners || []).map((p: any) =>
      `${p.name} (${p.category}, ${p.territory || 'PT'})${p.commission_percent ? ` — comm:${p.commission_percent}%` : ''}`
    ).join('\n');

    const partnerServiceList = (partnerServices || []).map((s: any) => {
      const partner = (partners || []).find((p: any) => p.id === s.partner_id);
      return `"${s.name}" by ${partner?.name || '?'} | cat:${s.category} | NET:${s.price}€/${s.price_unit}${s.price_child ? ` child:${s.price_child}€` : ''}${s.duration ? ` | dur:${s.duration}` : ''}`;
    }).join('\n');

    const itemDescriptions = items.map((it: any, i: number) =>
      `${i + 1}. Day ${it.day}: "${it.description}" (pricing: ${it.pricingType})`
    ).join('\n');

    const prompt = `You are a travel operations budget assistant for Your Tours Portugal.
Destination: ${destination || 'Portugal'}

=== OUR FSE (PROTOCOL SUPPLIERS) DATABASE ===
${supplierNames || 'No suppliers registered yet.'}

=== OUR SUPPLIER SERVICES WITH NET PRICES ===
${serviceList || 'No supplier services yet.'}

=== OUR PARTNERS (RESELLERS) DATABASE ===
${partnerNames || 'No partners registered yet.'}

=== OUR PARTNER SERVICES WITH NET PRICES ===
${partnerServiceList || 'No partner services yet.'}

${fseContext ? `=== ADDITIONAL FSE CONTEXT ===\n${fseContext}\n` : ''}
Also reference our full FSE protocol archive: https://drive.google.com/drive/folders/1HAjGSOKdgPQU3F3QPK6945OyeZMCJORN

=== COST ITEMS THAT NEED SUPPLIERS AND PRICING ===
${itemDescriptions}

For each item, suggest:
1. The best matching supplier/partner from our databases (EXACT name match from above). PRIORITIZE our protocol suppliers over external options. If no good match, suggest "WEB" and provide a market-rate estimate.
2. A realistic NET unit price in EUR. USE THE EXACT NET PRICE from our database when a match exists. Only estimate market rates for "WEB" items.
3. Whether pricing should be "per_person" or "total".

IMPORTANT: 
- ALWAYS prefer our protocol suppliers/partners over external suggestions.
- When using a protocol supplier, use their exact NET price from the database.
- For "WEB" items, use real Portugal market rates: restaurants 15-45€/person, hotels 80-250€/night, guides 150-300€/day, activities 20-80€/person, transport 100-400€/day, wine tastings 15-40€/person.

Return ONLY a JSON array with objects:
[{"index":0,"supplier":"Exact Name from DB or WEB","priceAdults":25,"pricingType":"per_person","marginPercent":30,"isProtocol":true}]`;

    const messages = [
      { role: "system", content: "You are a travel budget assistant. Return only valid JSON arrays. Prioritize protocol suppliers from the FSE database." },
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
