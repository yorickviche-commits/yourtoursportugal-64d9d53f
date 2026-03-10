const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, category, country } = await req.json();

    if (!name) {
      return new Response(JSON.stringify({ success: false, error: 'Name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const categoryContext = category ? ` (${category})` : '';
    const countryContext = country ? ` in ${country}` : '';

    const prompt = `You are a research assistant. Find the real online presence for this business:

Name: "${name}"${categoryContext}${countryContext}

Search for and return ONLY URLs that actually exist for this specific business. Return a JSON array of objects with "name", "url", and "description" fields.

Look for:
1. Their official website (if it exists)
2. Their Google Maps page (search Google Maps for "${name}${countryContext}")
3. Their TripAdvisor page (search TripAdvisor for "${name}${countryContext}")

IMPORTANT RULES:
- Only return links you are confident are correct for THIS specific business
- Do NOT make up or guess URLs
- If you cannot find a specific link, simply don't include it
- Return an empty array [] if you can't find any links
- The "name" field should be: "Website", "Google Maps", or "TripAdvisor"

Return ONLY valid JSON, no markdown, no explanation. Example:
[{"name":"Website","url":"https://example.com","description":"Site oficial"},{"name":"Google Maps","url":"https://maps.google.com/...","description":"Página Google Maps"}]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
          tools: [{ googleSearch: {} }],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return new Response(JSON.stringify({ success: false, error: 'AI search failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Extract JSON from response
    let links = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        links = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse links JSON:', text);
    }

    // Filter to only valid entries with URLs
    links = links.filter((l: any) => l.url && l.name && l.url.startsWith('http'));

    console.log(`Found ${links.length} links for "${name}"`);

    return new Response(JSON.stringify({ success: true, links }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error searching supplier links:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
