import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function buildPrompt(input: string, defaults: { pax?: number; paxChildren?: number; margin?: number }): string {
  return `You are a senior travel operations cost analyst at Your Tours Portugal, a Portuguese DMC.
Extract ALL cost lines (rubricas de custo) from the document/text below and return structured JSON.

RULES
1. One JSON item per cost line (activity, transport, guide, meal, accommodation, entrance fee, extra...).
2. "pricingType":
   - "per_person" when the price is per person / pp / por pessoa
   - "per_night" for accommodation priced per night
   - "total" when the price is a group/global amount (default when unclear)
3. Prices are NET supplier prices (without our margin). priceAdults / priceChildren.
4. marginPercent: use the document's margin if stated; otherwise use ${defaults.margin ?? 30}.
   If the document gives a selling price (PVP) but no margin, compute marginPercent from NET vs PVP.
5. numAdults / numChildren: use the document values; if absent use ${defaults.pax ?? 0} adults and ${defaults.paxChildren ?? 0} children.
6. Anything you cannot identify → null (never invent suppliers, prices or days).
7. "day": the itinerary day number the line belongs to (1-based). If the document has no day structure, use 1.
   Accommodation lines that are not tied to a specific day → day 0.
8. costLayer: one of "transport", "guide", "experience", "accommodation", "meal", "operational".

Return EXACTLY this JSON shape (no markdown, no commentary):
{
  "items": [
    {
      "day": 1,
      "description": "string",
      "supplier": "string or null",
      "pricingType": "total|per_person|per_night",
      "numAdults": 0,
      "priceAdults": 0,
      "numChildren": 0,
      "priceChildren": 0,
      "marginPercent": ${defaults.margin ?? 30},
      "pvpTotal": null,
      "costLayer": "experience"
    }
  ],
  "notes": "string or null — anything relevant that could not be mapped",
  "missing_fields": ["array of field names commonly missing"]
}

${input}`;
}

async function callGateway(prompt: string, apiKey: string) {
  return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
}

async function callGeminiDirect(prompt: string, pdfBase64?: string) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  const parts: any[] = [];
  if (pdfBase64) parts.push({ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } });
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Sem conteúdo devolvido pelo Gemini');
  return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

async function callOpenAI(prompt: string) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY não configurada');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Sem conteúdo devolvido pelo OpenAI');
  return JSON.parse(content);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { text, pdf_base64, pax, pax_children, margin } = await req.json();
    const defaults = { pax, paxChildren: pax_children, margin: typeof margin === 'number' ? margin : 30 };

    if (!pdf_base64 && (!text || String(text).trim().length < 10)) {
      return new Response(JSON.stringify({ success: false, error: 'Sem texto ou PDF para analisar.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = pdf_base64
      ? buildPrompt('Extract all cost lines from the attached PDF document.', defaults)
      : buildPrompt(`TEXT / TABLE TO ANALYZE:\n${text}`, defaults);

    let parsed: any = null;
    const errors: string[] = [];

    if (!pdf_base64) {
      const gatewayKey = Deno.env.get('LOVABLE_API_KEY');
      if (gatewayKey) {
        try {
          const res = await callGateway(prompt, gatewayKey);
          if (res.ok) {
            const json = await res.json();
            const content = json.choices?.[0]?.message?.content;
            if (content) parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
          } else {
            errors.push(`gateway ${res.status}: ${await res.text()}`);
          }
        } catch (e) {
          errors.push(`gateway: ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    if (!parsed) {
      try { parsed = await callGeminiDirect(prompt, pdf_base64); }
      catch (e) { errors.push(`gemini: ${e instanceof Error ? e.message : e}`); }
    }
    if (!parsed && !pdf_base64) {
      try { parsed = await callOpenAI(prompt); }
      catch (e) { errors.push(`openai: ${e instanceof Error ? e.message : e}`); }
    }

    if (!parsed) {
      console.error('Costing extraction failed:', errors.join(' | '));
      return new Response(JSON.stringify({ success: false, error: `Falha na extração AI. ${errors.join(' | ')}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const items = Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
    return new Response(
      JSON.stringify({ success: true, data: { items, notes: parsed.notes ?? null, missing_fields: parsed.missing_fields ?? [] } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('extract-costing-data error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
