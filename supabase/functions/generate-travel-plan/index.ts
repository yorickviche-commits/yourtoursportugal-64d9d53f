import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `You are the senior travel designer for Your Tours Portugal (YTP), a premium DMC.
Your task is to generate a complete, day-by-day travel plan proposal for a private client.

You must follow these strict rules:
1. Structure: one day per destination, unless pax requested more days in one city
2. Day 1 is always arrival + transfer-in. Last day is always transfer-out.
3. Each touring day has 5–7 bullet points. No times. No sub-bullets.
4. Bullet order: pickup → guide/transport → experiences (2–4) → meal → highlight
5. Always mention "drinks included" in meal bullets
6. Shared vs private: note "(shared basis)" when activity is not private
7. End every day with "Night in [City]"
8. Last day ends with "Departure from [City]" — no overnight
9. Language: English, premium tone, confident and evocative
10. Trip title: poetic and specific to the itinerary (never generic)
11. Opening narrative: 2–3 sentences, mentions all destinations, premium DMC tone
12. Day subtitles: evocative, 3–6 words (e.g. "Exploring the Northern Capital")
13. Bullet style: "Entrance and guided visit of..." (not "we will visit")
14. "Regional lunch (drinks included)" — always mention drinks included
15. "Pick-up & Drop-off at your accommodation in [City] city centre"
16. "Private Guide & Transportation" as a standalone bullet when applicable
17. Transfer-only days (arrival/departure) get 1–2 bullets max

Output ONLY valid JSON — no markdown, no preamble, no code fences.

Output this exact JSON structure:
{
  "trip_title": "...",
  "narrative": "2-3 sentence premium description mentioning all destinations",
  "days": [
    {
      "day_number": 1,
      "title": "Welcome, Portugal!",
      "date": "02-Aug-2026",
      "subtitle": "Arrival in Porto & Transfer-in",
      "bullets": [
        "Private transfer from Porto Airport to your accommodation in Porto city centre (without guide)",
        "Night in Porto"
      ],
      "overnight": "Porto"
    }
  ]
}`;

interface RequestBody {
  leadData: {
    clientName: string;
    fileId: string;
    destination: string;
    travelDates: string;
    travelEndDate?: string;
    numberOfDays?: number;
    datesType?: string;
    pax: number;
    paxChildren?: number;
    paxInfants?: number;
    travelStyles: string[];
    comfortLevel: string;
    budgetLevel: string;
    magicQuestion?: string;
    notes?: string;
  };
  extraInstructions?: string;
}

function formatDateRange(leadData: RequestBody['leadData'], numDays: number): string {
  if (leadData.travelDates && leadData.travelEndDate) {
    return `${leadData.travelDates} to ${leadData.travelEndDate} (${numDays} days)`;
  }
  if (leadData.travelDates) return `Starting ${leadData.travelDates} for ${numDays} days`;
  return `${numDays} days (dates TBD)`;
}

function calculateDays(ld: RequestBody['leadData']): number {
  if (ld.numberOfDays && ld.numberOfDays > 0) return ld.numberOfDays;
  if (ld.travelDates && ld.travelEndDate) {
    const d = Math.ceil((new Date(ld.travelEndDate).getTime() - new Date(ld.travelDates).getTime()) / 86400000) + 1;
    if (d > 0) return d;
  }
  return 5;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const errors: string[] = [];

  // 1) Lovable AI Gateway
  const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (LOVABLE_KEY) {
    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          max_tokens: 4096,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
      errors.push(`Lovable AI: ${res.status}`);
      console.error('Lovable AI failed:', res.status);
    } catch (e: any) {
      errors.push(`Lovable AI: ${e.message}`);
      console.error('Lovable AI error:', e.message);
    }
  }

  // 2) Gemini Direct
  const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');
  if (GEMINI_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) return content;
      }
      errors.push(`Gemini: ${res.status}`);
      console.error('Gemini failed:', res.status);
    } catch (e: any) {
      errors.push(`Gemini: ${e.message}`);
      console.error('Gemini error:', e.message);
    }
  }

  // 3) OpenAI (ChatGPT)
  const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
  if (OPENAI_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          max_tokens: 4096,
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
      errors.push(`OpenAI: ${res.status}`);
      console.error('OpenAI failed:', res.status);
    } catch (e: any) {
      errors.push(`OpenAI: ${e.message}`);
      console.error('OpenAI error:', e.message);
    }
  }

  // 4) Claude (Anthropic)
  const CLAUDE_KEY = Deno.env.get('CLAUDE_API_KEY');
  if (CLAUDE_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': CLAUDE_KEY,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.content?.[0]?.text;
        if (content) return content;
      }
      errors.push(`Claude: ${res.status}`);
      console.error('Claude failed:', res.status);
    } catch (e: any) {
      errors.push(`Claude: ${e.message}`);
      console.error('Claude error:', e.message);
    }
  }

  throw new Error(`All AI providers failed: ${errors.join(' | ')}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { leadData, extraInstructions } = (await req.json()) as RequestBody;
    const numDays = calculateDays(leadData);
    const dateRange = formatDateRange(leadData, numDays);

    const paxStr = `${leadData.pax} adult${leadData.pax > 1 ? 's' : ''}${leadData.paxChildren ? ` + ${leadData.paxChildren} children` : ''}${leadData.paxInfants ? ` + ${leadData.paxInfants} infants` : ''}`;

    const userPrompt = `Generate a ${numDays}-day travel plan proposal for:

Client: ${leadData.clientName}
File ID: ${leadData.fileId || 'TBD'}
Destinations: ${leadData.destination}
Travel Dates: ${dateRange}
EXACT NUMBER OF DAYS: ${numDays} — create exactly ${numDays} days
Participants: ${paxStr}
Travel Styles: ${leadData.travelStyles?.join(', ') || 'General'}
Comfort Level: ${leadData.comfortLevel || 'Standard'}
Budget: ${leadData.budgetLevel || 'Medium'}
${leadData.magicQuestion ? `What would make this trip unforgettable: ${leadData.magicQuestion}` : ''}
${leadData.notes ? `Additional notes: ${leadData.notes}` : ''}
${extraInstructions ? `\nADDITIONAL INSTRUCTIONS FROM TEAM: ${extraInstructions}` : ''}

Format dates as DD-Mon-YYYY (e.g. 02-Aug-2026). If exact dates aren't provided, use placeholder dates starting from a reasonable near-future date.`;

    const systemWithExtra = extraInstructions
      ? `${SYSTEM_PROMPT}\n\nIMPORTANT ADDITIONAL INSTRUCTIONS: ${extraInstructions}`
      : SYSTEM_PROMPT;

    const raw = await callAI(systemWithExtra, userPrompt);

    // Parse JSON from response
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    if (!parsed || !parsed.days) {
      return new Response(JSON.stringify({ error: 'AI returned invalid format', raw: raw.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-travel-plan error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
