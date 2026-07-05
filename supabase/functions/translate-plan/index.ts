import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LANG_MAP: Record<string, string> = {
  EN: 'English (premium DMC tone)',
  PT: 'Portuguese from Portugal (premium, fluent)',
  ES: 'Spanish (premium, fluent)',
  FR: 'French (premium, fluent)',
  IT: 'Italian (premium, fluent)',
  DE: 'German (premium, fluent)',
};

const SYSTEM = `You are a professional travel-copy translator for a premium DMC.
You receive a JSON payload with text fields from a travel proposal and must translate ALL string values into the requested target language, preserving:
- JSON structure and keys EXACTLY
- Arrays order and length EXACTLY
- Proper nouns (city names, hotel names, region names) UNTRANSLATED
- Premium, evocative tone
- Bullet-style phrasing (e.g. "Entrance and guided visit of..." → equivalent idiom in target language)

Return ONLY valid JSON — no markdown, no code fences, no preamble.`;

async function callAI(system: string, user: string): Promise<string> {
  const LOVABLE = Deno.env.get('LOVABLE_API_KEY');
  if (LOVABLE) {
    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: 16384,
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } else {
        console.error('Lovable', res.status, await res.text().catch(() => ''));
      }
    } catch (e) { console.error('Lovable err', e); }
  }
  const GEMINI = Deno.env.get('GEMINI_API_KEY');
  if (GEMINI) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { maxOutputTokens: 16384, temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) return content;
    }
  }
  throw new Error('AI providers unavailable');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { plan, closing, language } = await req.json();
    if (!plan) {
      return new Response(JSON.stringify({ error: 'Missing plan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const langCode = String(language || 'EN').toUpperCase();
    const langName = LANG_MAP[langCode] || LANG_MAP.EN;

    // Build a compact payload: only translatable text fields.
    const payload = {
      trip_title: plan.trip_title || '',
      narrative: plan.narrative || '',
      days: (plan.days || []).map((d: any) => ({
        day_number: d.day_number,
        title: d.title || '',
        subtitle: d.subtitle || '',
        overnight: d.overnight || '',
        bullets: (d.bullets || []).map((b: any) => (typeof b === 'string' ? b : (b?.text || ''))),
      })),
      closing: closing ? {
        inclusionsOverride: closing.inclusionsOverride || '',
        payment: closing.payment || '',
        cancellation: closing.cancellation || '',
        importantNotes: closing.importantNotes || '',
        closingMessage: closing.closingMessage || '',
      } : null,
    };

    const userPrompt = `TARGET LANGUAGE: ${langName}

Translate every string value in this JSON into the target language. Return EXACT same structure and array lengths. Keep JSON keys in English. Keep proper nouns (cities, hotels, region names) untranslated. Keep bullet lines that start with a bullet character (•) starting with the same bullet character.

INPUT:
${JSON.stringify(payload)}`;

    const raw = await callAI(SYSTEM, userPrompt);
    let parsed: any = null;
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed || !Array.isArray(parsed.days)) {
      return new Response(JSON.stringify({ error: 'Invalid AI JSON', raw: raw.slice(0, 600) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Merge translations back into the original plan preserving images, dates, bullet metadata.
    const translatedDays = plan.days.map((orig: any) => {
      const tr = parsed.days.find((x: any) => x.day_number === orig.day_number) || {};
      const bullets = (orig.bullets || []).map((b: any, i: number) => {
        const text = tr.bullets?.[i];
        if (text == null) return b;
        if (typeof b === 'string') return text;
        return { ...b, text };
      });
      return {
        ...orig,
        title: tr.title || orig.title,
        subtitle: tr.subtitle || orig.subtitle,
        overnight: tr.overnight || orig.overnight,
        bullets,
      };
    });

    const result = {
      plan: {
        ...plan,
        trip_title: parsed.trip_title || plan.trip_title,
        narrative: parsed.narrative || plan.narrative,
        days: translatedDays,
      },
      closing: parsed.closing || closing || null,
    };

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('translate-plan error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
