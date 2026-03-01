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
      ? `You are a senior travel operations data analyst. Your task is to extract EVERY possible piece of information about a B2B RESALE PARTNER from the following text (email, protocol document, contract, or partner communication).

CRITICAL RULES:
- Extract MAXIMUM information. Fill every field you can find evidence for.
- For each field you CANNOT find in the text, set it to null.
- In the "missing_fields" array, list ALL fields that are null and would be important for a complete partner profile.
- Be thorough: infer category from context (e.g. if they mention "agency" → "travel_agency", if they do transfers → check if they resell or provide).
- For services/products: extract EVERY distinct product, tour, package, or offering mentioned with ALL details (price, duration, conditions, commissions, etc.)
- Prices should be numbers (not strings). Currencies should be 3-letter codes.

Return this EXACT JSON structure:
{
  "entity": {
    "name": "string or null — company/partner name",
    "category": "travel_agency|tour_operator|hotel_concierge|online_platform|dmc|other",
    "contact_name": "string or null — person name",
    "contact_email": "string or null",
    "contact_phone": "string or null — with country code if available",
    "commission_percent": "number or null — default commission percentage",
    "contract_type": "string or null — e.g. 'exclusive', 'non-exclusive', 'seasonal'",
    "currency": "string — 3-letter code, default EUR",
    "payment_terms": "string or null — e.g. 'Net 30', '50% advance, 50% after trip'",
    "territory": "string or null — markets or regions they cover",
    "cancellation_policy": "string or null — full cancellation terms",
    "notes": "string or null — any other relevant information"
  },
  "services": [
    {
      "name": "string — product/tour/package name",
      "description": "string or null — full description of what's included",
      "category": "private_tour|tailor_made|group_tour|transfer|experience|other",
      "duration": "string or null — e.g. '4 hours', 'Full day', '3 days'",
      "price": "number or 0 — net price",
      "price_unit": "per_person|per_group|per_night|per_day|flat_rate",
      "currency": "string — 3-letter code",
      "commission_percent": "number or null — commission for this specific service",
      "payment_conditions": "string or null — payment terms specific to this service",
      "cancellation_policy": "string or null — cancellation rules for this service",
      "refund_policy": "string or null — refund conditions",
      "validity_start": "YYYY-MM-DD or null — when rates start",
      "validity_end": "YYYY-MM-DD or null — when rates expire",
      "notes": "string or null — inclusions, exclusions, special conditions"
    }
  ],
  "missing_fields": ["array of field names that are null but IMPORTANT for a complete partner profile — e.g. 'commission_percent', 'payment_terms', 'territory'"]
}

TEXT TO ANALYZE:
${text}`
      : `You are a senior travel operations data analyst. Your task is to extract EVERY possible piece of information about a SUPPLIER (fornecedor) from the following text (email, protocol document, contract, rate sheet, or supplier communication).

CRITICAL RULES:
- Extract MAXIMUM information. Fill every field you can find evidence for.
- For each field you CANNOT find in the text, set it to null.
- In the "missing_fields" array, list ALL fields that are null and would be important for a complete supplier profile.
- Be thorough: infer category from context (e.g. mentions rooms/check-in → "hotel", mentions wine/cellar → "winery", mentions vehicle/driver → "transport").
- For services: extract EVERY distinct service, room type, experience, tour, or product mentioned with ALL details (pricing tiers, seasonal rates, group sizes, etc.)
- If there are different price tiers (e.g. high/low season, different room types), create SEPARATE service entries for each.
- Prices should be numbers (not strings). Currencies should be 3-letter codes.
- Extract validity dates from any mention of seasons, years, or date ranges.

Return this EXACT JSON structure:
{
  "entity": {
    "name": "string or null — supplier/company name",
    "category": "hotel|guide|transport|winery|activity|restaurant|other",
    "contact_name": "string or null — person name / account manager",
    "contact_email": "string or null",
    "contact_phone": "string or null — with country code if available",
    "contract_type": "string or null — e.g. 'net rates', 'commission-based', 'allotment'",
    "currency": "string — 3-letter code, default EUR",
    "cancellation_policy": "string or null — FULL cancellation terms with deadlines and penalties",
    "notes": "string or null — any other relevant operational information (parking, access, special requirements)"
  },
  "services": [
    {
      "name": "string — service/product/room name",
      "description": "string or null — full description, what's included/excluded",
      "category": "hotel|guide|transport|winery|activity|restaurant|other",
      "duration": "string or null — e.g. '2 hours', 'Full day', 'Per night'",
      "price": "number or 0 — net cost",
      "price_unit": "per_person|per_group|per_night|per_day|flat_rate",
      "currency": "string — 3-letter code",
      "payment_conditions": "string or null — how and when to pay (advance, on-site, invoice terms)",
      "cancellation_policy": "string or null — cancellation rules specific to this service",
      "refund_policy": "string or null — refund conditions and timelines",
      "validity_start": "YYYY-MM-DD or null — rate validity start",
      "validity_end": "YYYY-MM-DD or null — rate validity end",
      "notes": "string or null — capacity limits, group size rules, seasonal notes, extras, surcharges"
    }
  ],
  "missing_fields": ["array of field names that are null but IMPORTANT for a complete supplier profile — e.g. 'cancellation_policy', 'contact_phone', 'validity dates for services'"]
}

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
