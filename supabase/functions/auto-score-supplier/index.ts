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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!lovableApiKey && !geminiApiKey) {
      return new Response(JSON.stringify({ error: 'No AI API key configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    async function callAI(prompt: string, maxTokens: number): Promise<string> {
      if (lovableApiKey) {
        try {
          const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lovableApiKey}` },
            body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: maxTokens }),
          });
          if (res.ok) {
            const r = await res.json();
            return r.choices?.[0]?.message?.content || '';
          }
          if (res.status !== 402 && res.status !== 429) console.error('Lovable AI error:', res.status);
        } catch (e) { console.log('Lovable fallback triggered:', e); }
      }
      if (!geminiApiKey) throw new Error('AI credits exhausted. Please add credits at Settings > Workspace > Usage.');
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens } }),
      });
      if (!gRes.ok) { const t = await gRes.text(); throw new Error(`Gemini error ${gRes.status}: ${t}`); }
      const gData = await gRes.json();
      return gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // Step 1: Gather web context about the supplier
    let webContext = '';
    const websiteLink = links.find((l: any) => l.name?.toLowerCase().includes('website') || l.name?.toLowerCase().includes('site'));
    const googleLink = links.find((l: any) => l.name?.toLowerCase().includes('google'));
    const tripLink = links.find((l: any) => l.name?.toLowerCase().includes('tripadvisor'));

    // Use a quick AI call to search for info about this supplier
    const searchPrompt = `Search for information about "${name}" in Portugal, category: ${category}.
${websiteLink ? `Website: ${websiteLink.url}` : ''}
${googleLink ? `Google Maps: ${googleLink.url}` : ''}
${tripLink ? `TripAdvisor: ${tripLink.url}` : ''}

Based on what you know about this supplier/venue, provide a brief summary including:
- Quality reputation
- Service quality and hospitality
- Location and accessibility
- Reviews sentiment (Google/TripAdvisor if known)
- Vegetarian options availability
- Authenticity of experience
- Any known issues or complaints
- What type of travelers it's ideal for (families, couples, wine lovers, seniors, kids, foodies, etc.)

If you don't have specific info, say so. Keep it brief (max 200 words).`;

    try {
      webContext = await callAI(searchPrompt, 400);
    } catch (e) {
      console.log('Web context search failed, continuing without:', e);
    }

    // Step 2: Build scoring prompt with web context
    const keyList = criteria.map((c: any) => `"${c.key}"`).join(', ');
    const critLines = criteria.map((c: any) => `- key="${c.key}": ${c.label} — ${c.description} (weight: ${c.weight}%)`).join('\n');
    const svcLines = services.slice(0, 8).map((s: any) => `- ${s.name} (${s.category})${s.price ? ` €${s.price}` : ''}`).join('\n');
    const linkLines = links.map((l: any) => `- ${l.name}: ${l.url}`).join('\n');

    const defaultScores = criteria.map((c: any) => `"${c.key}":3`).join(',');

    const scoringPrompt = `You are an expert travel DMC operations manager evaluating supplier "${name}" (category: ${category}) in Portugal.

SUPPLIER DATA:
Services: ${svcLines || 'None listed'}
Links: ${linkLines || 'None listed'}

${webContext ? `WEB RESEARCH CONTEXT:\n${webContext}\n` : ''}

SCORING CRITERIA (score each 1-5):
${critLines}

SCORING GUIDELINES:
- 1 = Mau (very poor), 2 = Fraco (poor), 3 = Suficiente (adequate/no info), 4 = Bom (good), 5 = Excelente (excellent)
- If you have NO information about a criterion, score it 3 (Suficiente)
- If you found positive reviews/reputation, score higher (4-5)
- If you found negative reviews/issues, score lower (1-2)
- Be realistic: most scores should range 3-4 for average suppliers

Also suggest what type of travelers this supplier is ideal for.

Return ONLY this exact JSON structure (no markdown, no extra text):
{"scores":{${defaultScores}},"occurrences":0,"notes":"Brief evaluation summary in Portuguese (2-3 sentences)","ideal_for":["families","couples","wine lovers"]}

CRITICAL: Use EXACTLY these keys in scores: ${keyList}. Every key must be present.`;

    const text = await callAI(scoringPrompt, 600);

    let parsed: Record<string, unknown> = {};
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (_e) {
        console.error('JSON parse failed. Raw text:', text);
        return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate and clamp scores
    const scores = parsed.scores as Record<string, number> | undefined;
    if (scores) {
      // Ensure all criteria keys exist
      for (const c of criteria) {
        if (!(c.key in scores) || typeof scores[c.key] !== 'number') {
          scores[c.key] = 3;
        }
        scores[c.key] = Math.max(1, Math.min(5, Math.round(scores[c.key])));
      }
    } else {
      // Fallback: create default scores
      parsed.scores = {};
      for (const c of criteria) {
        (parsed.scores as Record<string, number>)[c.key] = 3;
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
