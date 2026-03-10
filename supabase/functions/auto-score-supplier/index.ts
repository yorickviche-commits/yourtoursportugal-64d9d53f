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

    // Build exact key list for AI to use
    const keyList = criteria.map((c: Record<string, string>) => `"${c.key}"`).join(', ');
    const critLines = criteria.map((c: Record<string, string>) => `- key="${c.key}": ${c.label} (${c.weight}%)`).join('\n');
    const svcLines = services.slice(0, 5).map((s: Record<string, string>) => `${s.name} (${s.category})`).join(', ');
    const linkLines = links.slice(0, 3).map((l: Record<string, string>) => `${l.name}: ${l.url}`).join(', ');

    const prompt = `Score supplier "${name}" (category: ${category}) for a Portuguese DMC. Score each criterion 1-5.

Services: ${svcLines || 'None listed'}
Links: ${linkLines || 'None listed'}

Criteria to score:
${critLines}

RULES:
- If no info available for a criterion, score 3.
- Be realistic, most scores should be 3-4.
- Return ONLY valid JSON with this exact structure:
{"scores":{${criteria.map((c: Record<string, string>) => `"${c.key}":3`).join(',')}},"occurrences":0,"notes":"Brief note in Portuguese"}

IMPORTANT: Use EXACTLY these keys in scores: ${keyList}. No other keys.`;

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://ai.lovable.dev/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 512,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('AI error:', errText);
      return new Response(JSON.stringify({ error: 'AI scoring failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await res.json();
    const text = result.choices?.[0]?.message?.content || '{}';

    let parsed: Record<string, unknown> = {};
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch (_e) {
        return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate and clamp scores
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
