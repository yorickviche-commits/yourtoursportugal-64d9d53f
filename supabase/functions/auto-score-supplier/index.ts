const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const name = body.name || '';
    const category = body.category || '';
    const services = body.services || [];
    const links = body.links || [];
    const criteria = body.criteria || [];

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const svcLines = services.map((s: Record<string, string>) => `- ${s.name} (${s.category}): ${s.price || 'N/A'}`).join('\n');
    const linkLines = links.map((l: Record<string, string>) => `- ${l.name}: ${l.url}`).join('\n');
    const critLines = criteria.map((c: Record<string, string>) => `- "${c.key}": ${c.label} (weight: ${c.weight}%)`).join('\n');

    const prompt = `Evaluate supplier "${name}" (${category}) for a Portuguese DMC. Score 1-5 per criterion.

Services: ${svcLines || 'None'}
Links: ${linkLines || 'None'}

Criteria:
${critLines}

Rules: Limited info = score 3. Be realistic (most 3-4). Return ONLY JSON:
{"scores":{"key":number},"occurrences":0,"notes":"Brief summary in Portuguese"}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini error:', errText);
      return new Response(JSON.stringify({ error: 'AI scoring failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await res.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed: Record<string, unknown> = {};
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch (_e) {
        return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const scores = parsed.scores as Record<string, number> | undefined;
    if (scores) {
      for (const key of Object.keys(scores)) {
        const v = scores[key];
        if (typeof v !== 'number' || v < 1 || v > 5) scores[key] = 3;
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
