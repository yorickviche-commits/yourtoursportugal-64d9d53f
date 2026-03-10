const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, category, services, links, criteria } = await req.json();

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const servicesDesc = services?.length > 0
      ? `Services offered:\n${services.map((s: any) => `- ${s.name} (${s.category}): €${s.price} - ${s.description || 'no description'}`).join('\n')}`
      : 'No services registered yet.';

    const linksDesc = links?.length > 0
      ? `Online presence:\n${links.map((l: any) => `- ${l.name}: ${l.url}`).join('\n')}`
      : 'No online links registered.';

    const criteriaDesc = criteria.map((c: any) =>
      `- "${c.key}": ${c.label} (weight: ${c.weight}%) — ${c.description}`
    ).join('\n');

    const prompt = `You are an expert travel industry supplier evaluator for a Portuguese DMC (Destination Management Company) called Your Tours Portugal.

Evaluate the following supplier and assign scores from 1-5 for each criterion based on the available information.

SUPPLIER:
- Name: ${name}
- Category: ${category}
- ${servicesDesc}
- ${linksDesc}

SCORING CRITERIA (1=Mau, 2=Fraco, 3=Suficiente, 4=Bom, 5=Excelente):
${criteriaDesc}

SCORING GUIDELINES:
- Score 1 (Mau): Very poor, serious issues, not recommended
- Score 2 (Fraco): Below average, needs significant improvement
- Score 3 (Suficiente): Acceptable, meets minimum requirements
- Score 4 (Bom): Good quality, reliable, recommended
- Score 5 (Excelente): Outstanding, best in class

IMPORTANT RULES:
- If you have limited information about a criterion, score conservatively (3 = Suficiente)
- For "reviews", if links include TripAdvisor or Google Maps, consider those platforms for reputation
- If the supplier has good services and pricing, that reflects positively on product_quality
- Be realistic - most suppliers should score between 3-4 unless truly exceptional or problematic
- Set occurrences to 0 if no incident history is available

Return ONLY valid JSON with this structure:
{
  "scores": { "criterion_key": score_number, ... },
  "occurrences": 0,
  "notes": "Brief evaluation summary in Portuguese (2-3 sentences)"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', errText);
      return new Response(JSON.stringify({ error: 'AI scoring failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed: any = {};
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse AI response:', text);
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate scores are 1-5
    if (parsed.scores) {
      for (const key of Object.keys(parsed.scores)) {
        const v = parsed.scores[key];
        if (typeof v !== 'number' || v < 1 || v > 5) {
          parsed.scores[key] = 3; // default to Suficiente
        }
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in auto-score:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
