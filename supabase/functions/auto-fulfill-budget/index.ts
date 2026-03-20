import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── YT FIXED GUIDE RATES ──────────────────────────────
const GUIDE_RATES = {
  yt_vehicle_fullday: 125,
  own_vehicle: {
    douro_vinho_verde_coimbra_aveiro: 265,
    braga_guimaraes_alto_minho_geres: 250,
    santiago_compostela: 275,
    porto_city_fullday: 225,
  },
  city_guide_halfday: 80,
  city_guide_fullday: 150,
  continuous_fullday: 180,
  extras: { meal: 15, night: 80, extra_hour: 20, displacement: 15, fleet_wash: 4.25 },
};

function getGuideRateForRoute(description: string, isFullDay: boolean): { rate: number; type: string } {
  const d = description.toLowerCase();
  // Check own-vehicle routes
  if (d.includes('douro') || d.includes('vinho verde') || d.includes('coimbra') || d.includes('aveiro'))
    return { rate: GUIDE_RATES.own_vehicle.douro_vinho_verde_coimbra_aveiro, type: 'guide+vehicle' };
  if (d.includes('braga') || d.includes('guimarães') || d.includes('guimaraes') || d.includes('alto-minho') || d.includes('gerês') || d.includes('geres'))
    return { rate: GUIDE_RATES.own_vehicle.braga_guimaraes_alto_minho_geres, type: 'guide+vehicle' };
  if (d.includes('santiago') || d.includes('compostela'))
    return { rate: GUIDE_RATES.own_vehicle.santiago_compostela, type: 'guide+vehicle' };
  if (d.includes('porto') && isFullDay)
    return { rate: GUIDE_RATES.own_vehicle.porto_city_fullday, type: 'guide+vehicle' };
  // Default: guide in YT vehicle
  if (isFullDay) return { rate: GUIDE_RATES.yt_vehicle_fullday, type: 'yt_vehicle' };
  return { rate: GUIDE_RATES.city_guide_halfday, type: 'city_guide' };
}

async function callGateway(messages: any[], apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
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
  if (!res.ok) { const t = await res.text(); console.error("Gemini fallback error:", res.status, t); throw new Error("Gemini fallback failed"); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { items, destination, fseContext, leadData } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

    // Fetch suppliers, services, partners, partner_services in parallel
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

    // Build supplier context
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
      `${i + 1}. Day ${it.day}: "${it.description}" (pricing: ${it.pricingType}, layer: ${it.cost_layer || 'unknown'})`
    ).join('\n');

    // Determine day titles from items for route context
    const dayRoutes = new Map<number, string[]>();
    items.forEach((it: any) => {
      if (!dayRoutes.has(it.day)) dayRoutes.set(it.day, []);
      dayRoutes.get(it.day)!.push(it.description);
    });

    // Pre-compute guide costs per day based on route
    const guideRatesPerDay: string[] = [];
    dayRoutes.forEach((descriptions, day) => {
      const routeDesc = descriptions.join(' ');
      const { rate, type } = getGuideRateForRoute(routeDesc, true);
      guideRatesPerDay.push(`Day ${day}: Guide rate = ${rate}€ (${type}) + meal 15€ + wash 4.25€`);
    });

    const prompt = `You are a travel operations budget assistant for Your Tours Portugal.
Destination: ${destination || 'Portugal'}

=== LAYERED COSTING APPROACH (CRITICAL) ===
You MUST cost each item according to its layer:

LAYER 1 — TRANSPORT (YT fleet operational costs):
• Fuel: 30-50€/day depending on distance
• Tolls: varies by route (Porto-Douro ~15€, Porto-Lisboa ~25€, Porto-Braga ~8€)
• Parking: 5-15€/day in cities
• These are FLAT costs (total, not per person)

LAYER 2 — GUIDE (FIXED RATES — non-negotiable):
${guideRatesPerDay.join('\n')}
• Guide meal: 15€ when eating with group
• Fleet wash: 4.25€ per driving day
• Night service: 80€ if past 20:00
• Extra hours: 20€/hour
• These are FLAT costs (total, not per person)

LAYER 3 — EXPERIENCES:
Use protocol supplier NET prices when available. Market rates otherwise.
Wine tastings: 15-40€/person, Activities: 20-80€/person
Usually PER PERSON pricing.

LAYER 4 — ACCOMMODATION:
Budget: 80-120€/night, Standard: 120-200€/night, Premium: 200-400€/night
Usually TOTAL (per room) pricing.

LAYER 5 — MEALS:
Protocol restaurants first. Market rates: 15-45€/person.
PER PERSON pricing.

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

=== COST ITEMS THAT NEED PRICING ===
${itemDescriptions}

For each item, return:
1. Best matching supplier/partner from our databases (EXACT name). PRIORITIZE protocol suppliers. If none, use "YT Internal" for transport/guide or "WEB" for external.
2. Realistic NET unit price in EUR using the EXACT rates from above.
3. Pricing type: "per_person" or "total" (transport and guide are ALWAYS "total").
4. Cost layer tag.
5. Whether it's a fixed YT rate or protocol price.

Return ONLY a JSON array:
[{"index":0,"supplier":"Exact Name or YT Internal or WEB","priceAdults":125,"pricingType":"total","marginPercent":30,"isProtocol":true,"isFixedRate":true,"costLayer":"guide"}]`;

    const messages = [
      { role: "system", content: "You are a travel budget assistant. Return only valid JSON arrays. Use YT fixed rates for guides/transport. Prioritize protocol suppliers." },
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
      } else { throw err; }
    }

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let suggestions;
    try { suggestions = JSON.parse(content); } catch {
      console.error("Failed to parse AI response:", content);
      suggestions = [];
    }

    // Post-process: inject fixed guide rates if AI didn't respect them
    const processedSuggestions = suggestions.map((sug: any, idx: number) => {
      const item = items[sug.index ?? idx];
      if (!item) return sug;

      // If item is tagged as guide layer, enforce fixed rate
      if (sug.costLayer === 'guide' || (item.cost_layer === 'guide')) {
        const routeDesc = item.description || destination || '';
        const { rate } = getGuideRateForRoute(routeDesc, true);
        return {
          ...sug,
          priceAdults: rate,
          pricingType: 'total',
          supplier: 'YT Guias Freelancer',
          isFixedRate: true,
          isProtocol: true,
          costLayer: 'guide',
          marginPercent: sug.marginPercent || 30,
        };
      }

      // If transport layer, ensure total pricing
      if (sug.costLayer === 'transport' || (item.cost_layer === 'transport')) {
        return { ...sug, pricingType: 'total', costLayer: 'transport' };
      }

      return sug;
    });

    return new Response(JSON.stringify({ suggestions: processedSuggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-fulfill error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
