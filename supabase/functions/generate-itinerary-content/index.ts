import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ContentRequest {
  type: 'narrative' | 'highlights' | 'inclusions' | 'all';
  dayTitle: string;
  dayNumber: number;
  location: string;
  destination: string;
  existingHighlights?: string[];
  existingInclusions?: string[];
  existingNarrative?: string;
  travelStyle?: string;
  clientName?: string;
}

const SYSTEM_PROMPT = `You are a senior travel content writer for Your Tours Portugal, creating premium customer-facing itinerary content.
Your tone: inspirational, evocative, sensorial — like a luxury travel magazine. Write in English unless asked otherwise.

CRITICAL RULES:
- Be specific with real place names, landmarks, cuisine, cultural references
- Highlight unique experiences, hidden gems, sensory details
- Avoid generic tourism clichés
- Keep it concise but impactful

OUTPUT: Return ONLY valid JSON matching the requested format. No markdown, no extra text.`;

function buildPrompt(req: ContentRequest): string {
  const context = `Day ${req.dayNumber}: "${req.dayTitle}" in ${req.location || req.destination}`;
  
  if (req.type === 'narrative') {
    return `${context}
${req.existingHighlights?.length ? `Key highlights: ${req.existingHighlights.join(', ')}` : ''}
${req.existingInclusions?.length ? `Included experiences: ${req.existingInclusions.join(', ')}` : ''}

Write an inspirational narrative paragraph (3-5 sentences) for this day. Make it emotional, sensory, and evocative.
Return JSON: { "narrative": "..." }`;
  }
  
  if (req.type === 'highlights') {
    return `${context}
${req.existingNarrative ? `Day narrative: ${req.existingNarrative}` : ''}
${req.existingInclusions?.length ? `Included experiences: ${req.existingInclusions.join(', ')}` : ''}

Generate 3-5 short highlight titles for this day (e.g. "Visit Pena Palace", "Wine Tasting in Historic Cellar").
Each should be concise (3-8 words), specific, and varied.
Return JSON: { "highlights": ["...", "..."] }`;
  }
  
  if (req.type === 'inclusions') {
    return `${context}
${req.existingNarrative ? `Day narrative: ${req.existingNarrative}` : ''}
${req.existingHighlights?.length ? `Day highlights: ${req.existingHighlights.join(', ')}` : ''}

Generate 4-7 specific inclusions for this day (what's included for the client).
Format: short descriptive items like "Private guided tour of Jerónimos Monastery", "Traditional Portuguese lunch at local tasca", "Round-trip transfers from hotel".
Return JSON: { "inclusions": ["...", "..."] }`;
  }
  
  // type === 'all'
  return `${context}
${req.existingNarrative ? `Current narrative (improve): ${req.existingNarrative}` : ''}
${req.existingHighlights?.length ? `Current highlights (improve): ${req.existingHighlights.join(', ')}` : ''}
${req.existingInclusions?.length ? `Current inclusions (improve): ${req.existingInclusions.join(', ')}` : ''}

Generate ALL content for this day:
1. An inspirational narrative (3-5 sentences, emotional, sensory)
2. 3-5 highlight titles (concise, specific, varied)
3. 4-7 inclusions (what's included)

Return JSON: { "narrative": "...", "highlights": ["..."], "inclusions": ["..."] }`;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (LOVABLE_API_KEY) {
    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
      if (res.status === 402 || res.status === 429) {
        console.log(`Lovable AI returned ${res.status}, trying Gemini fallback...`);
      } else {
        throw new Error(`Lovable AI error: ${res.status}`);
      }
    } catch (e) {
      console.error('Lovable AI failed:', e);
    }
  }

  // Fallback to Gemini direct
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) throw new Error('No AI provider available');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.8 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as ContentRequest;
    const userPrompt = buildPrompt(body);
    const resultText = await callAI(SYSTEM_PROMPT, userPrompt);

    // Parse JSON from response
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON in AI response');
    
    const cleaned = jsonMatch[0].replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-itinerary-content error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
