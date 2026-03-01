const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, entity_type } = await req.json();

    if (!text || text.trim().length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Text too short to extract data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isPartner = entity_type === 'partner';

    const prompt = isPartner
      ? `You are a travel operations assistant. Extract RESALE PARTNER data from the following text (email, protocol, or partner info). This is a B2B partner who resells our private tours and tailor-made experiences.

Return a JSON object with this exact structure:
{
  "entity": {
    "name": "string or null",
    "category": "travel_agency|tour_operator|hotel_concierge|online_platform|dmc|other",
    "contact_name": "string or null",
    "contact_email": "string or null",
    "contact_phone": "string or null",
    "commission_percent": number or null,
    "contract_type": "string or null",
    "currency": "EUR",
    "payment_terms": "string or null",
    "territory": "string or null",
    "notes": "string or null"
  },
  "services": [
    {
      "name": "string",
      "description": "string or null",
      "category": "private_tour|tailor_made|group_tour|transfer|experience|other",
      "duration": "string or null",
      "price": number or 0,
      "price_unit": "per_person|per_group|per_night|per_day|flat_rate",
      "currency": "EUR",
      "commission_percent": number or null,
      "payment_conditions": "string or null",
      "cancellation_policy": "string or null",
      "refund_policy": "string or null",
      "validity_start": "YYYY-MM-DD or null",
      "validity_end": "YYYY-MM-DD or null",
      "notes": "string or null"
    }
  ]
}

TEXT TO ANALYZE:
${text}`
      : `You are a travel operations assistant. Extract supplier and service/protocol data from the following text (which may be an email, a protocol document, or general supplier information).

Return a JSON object with this exact structure:
{
  "entity": {
    "name": "string or null",
    "category": "hotel|guide|transport|winery|activity|restaurant|other",
    "contact_name": "string or null",
    "contact_email": "string or null",
    "contact_phone": "string or null",
    "contract_type": "string or null",
    "currency": "EUR",
    "cancellation_policy": "string or null",
    "notes": "string or null"
  },
  "services": [
    {
      "name": "string",
      "description": "string or null",
      "category": "hotel|guide|transport|winery|activity|restaurant|other",
      "duration": "string or null (e.g. '2 hours', '1 day')",
      "price": number or 0,
      "price_unit": "per_person|per_group|per_night|per_day|flat_rate",
      "currency": "EUR",
      "payment_conditions": "string or null",
      "cancellation_policy": "string or null",
      "refund_policy": "string or null",
      "validity_start": "YYYY-MM-DD or null",
      "validity_end": "YYYY-MM-DD or null",
      "notes": "string or null"
    }
  ]
}

Extract as much information as possible. If a field is not found, use null. For services, extract every distinct service/product mentioned with pricing.

TEXT TO ANALYZE:
${text}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI extraction failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'No content returned from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
