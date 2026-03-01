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
      ? `You are a senior travel operations data analyst at Your Tours Portugal. Your task is to extract EVERY possible piece of information about a B2B RESALE PARTNER from the following text (email, protocol document, contract, or partner communication).

CONTEXT: Your Tours Portugal works with protocols/contracts that typically contain:
- Section 1: Company data (Your Tours — ignore this, it's us)
- Section 2: Partner/Supplier data (FSE) — THIS is what we need to extract
- Section 3: Partnership terms & validity
- Section 4: Contracted services with detailed NET pricing (adult, child, baby, guide)
- Section 5: Booking mode / reservation conditions
- Section 6: Invoicing / payment mode
- Section 7: Terms & conditions

CRITICAL RULES:
- Extract MAXIMUM information. Fill every field you can find evidence for.
- For each field you CANNOT find in the text, set it to null.
- In "missing_fields", list ALL null fields important for a complete profile.
- ALWAYS extract from Section 2 (partner data): name, address, NIF, IBAN, contact person, phone, email.
- ALWAYS extract from Section 4 (services): create a SEPARATE service for EACH menu/package/service tier.
- For EACH service extract: adult NET price, child NET price, baby price, guide price — as separate fields.
- Extract booking conditions from Section 5 (e.g. "apenas por email").
- Extract payment/invoicing conditions from Section 6.
- Extract cancellation/refund terms from Section 7 or wherever mentioned.
- Extract validity dates from Section 3.
- Infer category from context (e.g. "restauração" → "restaurant", "alojamento" → "hotel").
- Prices should be numbers (not strings). Currencies should be 3-letter codes.
- Description should include what's included in the service (e.g. menu items, drinks, etc.)
- "ideal_for" tags if mentioned (e.g. "Famílias", "Luxo", "Casais").

Return this EXACT JSON structure:
{
  "entity": {
    "name": "string or null — partner company/person name (from Section 2, NOT Your Tours)",
    "category": "travel_agency|tour_operator|hotel_concierge|online_platform|dmc|restaurant|hotel|guide|transport|winery|activity|other",
    "contact_name": "string or null — responsible person name",
    "contact_email": "string or null",
    "contact_phone": "string or null — with country code if available",
    "address": "string or null — full address",
    "fiscal_number": "string or null — NIF/NIPC/VAT number",
    "bank_iban": "string or null — IBAN",
    "commission_percent": "number or null — default commission percentage",
    "contract_type": "string or null — e.g. 'exclusive', 'non-exclusive', 'seasonal'",
    "currency": "string — 3-letter code, default EUR",
    "payment_terms": "string or null — full invoicing/payment mode from Section 6",
    "territory": "string or null — markets or regions they cover",
    "cancellation_policy": "string or null — full cancellation terms",
    "notes": "string or null — ideal_for tags, special conditions, anything else relevant",
    "validity_start": "YYYY-MM-DD or null — protocol validity start",
    "validity_end": "YYYY-MM-DD or null — protocol validity end"
  },
  "services": [
    {
      "name": "string — service/menu/package name",
      "description": "string or null — FULL description of what's included (menu items, drinks, experiences, etc.)",
      "category": "private_tour|tailor_made|group_tour|transfer|experience|restaurant|hotel|other",
      "duration": "string or null — e.g. '2 hours', 'Full day', 'Per night'",
      "price": "number or 0 — NET price per adult",
      "price_child": "number or 0 — NET price per child (include age range in notes if mentioned)",
      "price_unit": "per_person|per_group|per_night|per_day|flat_rate",
      "currency": "string — 3-letter code",
      "commission_percent": "number or null",
      "booking_conditions": "string or null — HOW to book (email only, phone, platform, advance notice, etc.)",
      "payment_conditions": "string or null — how and when to pay (advance, on-site, invoice terms, who collects invoice)",
      "cancellation_policy": "string or null — cancellation rules specific to this service",
      "refund_policy": "string or null — refund conditions and timelines",
      "validity_start": "YYYY-MM-DD or null — rate validity start",
      "validity_end": "YYYY-MM-DD or null — rate validity end",
      "notes": "string or null — child age range, baby policy, guide price, VAT info, capacity limits, ideal_for tags, extras"
    }
  ],
  "missing_fields": ["array of field names that are null but IMPORTANT"]
}

TEXT TO ANALYZE:
${text}`
      : `You are a senior travel operations data analyst at Your Tours Portugal. Your task is to extract EVERY possible piece of information about a SUPPLIER (fornecedor/FSE) from the following text (email, protocol document, contract, rate sheet, or supplier communication).

CONTEXT: Your Tours Portugal works with protocols/contracts that typically contain:
- Section 1: Company data (Your Tours — ignore this, it's us)
- Section 2: Partner/Supplier data (FSE) — THIS is what we need to extract
- Section 3: Partnership terms & validity
- Section 4: Contracted services with detailed NET pricing (adult, child, baby, guide)
- Section 5: Booking mode / reservation conditions
- Section 6: Invoicing / payment mode
- Section 7: Terms & conditions

CRITICAL RULES:
- Extract MAXIMUM information. Fill every field you can find evidence for.
- For each field you CANNOT find in the text, set it to null.
- In "missing_fields", list ALL null fields important for a complete supplier profile.
- ALWAYS extract from Section 2 (FSE data): name, address, NIF, IBAN, contact person, phone, email.
- ALWAYS extract from Section 4 (services): create a SEPARATE service entry for EACH menu/package/room/tier.
- For EACH service extract: adult NET price, child NET price — as separate numeric fields.
- Also extract baby policy and guide price into the notes field.
- Extract booking conditions from Section 5 (e.g. "reservas apenas por email").
- Extract payment/invoicing mode from Section 6 (e.g. "guia recolhe fatura, pagamento até dia 8 do mês seguinte").
- Extract cancellation/refund terms from Section 7 or wherever mentioned.
- Extract validity dates from Section 3.
- Infer category from context (e.g. mentions rooms/check-in → "hotel", wine/cellar → "winery", vehicle/driver → "transport", menus/almoço → "restaurant").
- If there are different price tiers (e.g. high/low season, different menus, room types), create SEPARATE service entries for each.
- Prices should be numbers (not strings). Currencies should be 3-letter codes.
- Description should include what's included (menu items, drinks, activities, etc.)

Return this EXACT JSON structure:
{
  "entity": {
    "name": "string or null — supplier/company name (from Section 2, NOT Your Tours)",
    "category": "hotel|guide|transport|winery|activity|restaurant|other",
    "contact_name": "string or null — responsible person name",
    "contact_email": "string or null",
    "contact_phone": "string or null — with country code if available",
    "address": "string or null — full address",
    "fiscal_number": "string or null — NIF/NIPC/VAT number",
    "bank_iban": "string or null — IBAN",
    "contract_type": "string or null — e.g. 'net rates', 'commission-based', 'allotment'",
    "currency": "string — 3-letter code, default EUR",
    "cancellation_policy": "string or null — FULL cancellation terms with deadlines and penalties",
    "notes": "string or null — ideal_for tags, special conditions, parking, access, etc.",
    "validity_start": "YYYY-MM-DD or null — protocol validity start",
    "validity_end": "YYYY-MM-DD or null — protocol validity end"
  },
  "services": [
    {
      "name": "string — service/product/menu/room name",
      "description": "string or null — FULL description of what's included/excluded (menu items, drinks, experiences)",
      "category": "hotel|guide|transport|winery|activity|restaurant|other",
      "duration": "string or null — e.g. '2 hours', 'Full day', 'Per night'",
      "price": "number or 0 — NET price per adult",
      "price_child": "number or 0 — NET price per child (include age range in notes)",
      "price_unit": "per_person|per_group|per_night|per_day|flat_rate",
      "currency": "string — 3-letter code",
      "booking_conditions": "string or null — HOW to book (email only, phone, advance notice required, etc.)",
      "payment_conditions": "string or null — invoicing process, payment deadlines, who collects invoice",
      "cancellation_policy": "string or null — cancellation rules specific to this service",
      "refund_policy": "string or null — refund conditions and timelines",
      "validity_start": "YYYY-MM-DD or null — rate validity start",
      "validity_end": "YYYY-MM-DD or null — rate validity end",
      "notes": "string or null — child age range (e.g. '3-8 anos'), baby policy (e.g. '0-3 grátis'), guide price (e.g. '17€/guia'), VAT info, capacity, group size, extras, surcharges, ideal_for tags"
    }
  ],
  "missing_fields": ["array of field names that are null but IMPORTANT for a complete supplier profile"]
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
        model: 'google/gemini-2.5-flash',
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
