import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase: SupabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const {
      proposal_id, total_value_eur, deposit_percent = 50,
      title, description, start_date, end_date,
      cover_image_url, client_name,
    } = await req.json();

    if (!proposal_id) throw new Error('proposal_id required');
    if (!total_value_eur || total_value_eur <= 0) throw new Error('total_value_eur must be > 0');

    const depositAmount = Math.round(total_value_eur * deposit_percent) / 100;

    const { data: existing } = await supabase
      .from('proposals')
      .select('wetravel_trip_uuid, wetravel_checkout_url, total_value_eur')
      .eq('id', proposal_id)
      .maybeSingle();

    if (existing?.wetravel_checkout_url && Number(existing?.total_value_eur) === Number(total_value_eur)) {
      return new Response(JSON.stringify({
        skipped: true,
        checkout_url: existing.wetravel_checkout_url,
        trip_uuid: existing.wetravel_trip_uuid,
        deposit_amount_eur: depositAmount,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const proxyRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/wetravel-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'create-trip',
        title: title ?? 'Private Tour — Your Tours Portugal',
        description: description ?? `Bespoke private programme. Deposit of €${depositAmount} — 100% refundable.`,
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        total_price: total_value_eur,
        deposit_price: depositAmount,
        currency: 'EUR',
        cover_image_url: cover_image_url ?? null,
        client_name: client_name ?? '',
      }),
    });

    if (!proxyRes.ok) throw new Error(`wetravel-proxy: ${await proxyRes.text()}`);
    const wt = await proxyRes.json();
    if (!wt.trip_uuid) throw new Error(`No trip_uuid in response: ${JSON.stringify(wt)}`);

    await supabase.from('proposals').update({
      wetravel_trip_uuid: wt.trip_uuid,
      wetravel_trip_url: wt.trip_url,
      wetravel_checkout_url: wt.checkout_url,
      deposit_amount_eur: depositAmount,
      deposit_percent,
      total_value_eur,
    }).eq('id', proposal_id);

    await supabase.from('activity_logs').insert({
      action_type: 'wetravel_trip_created',
      entity_type: 'proposal',
      entity_id: proposal_id,
      details: { trip_uuid: wt.trip_uuid, deposit_eur: depositAmount, total_eur: total_value_eur },
    });

    return new Response(JSON.stringify({
      success: true,
      trip_uuid: wt.trip_uuid,
      checkout_url: wt.checkout_url,
      deposit_amount_eur: depositAmount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('create-wetravel-deposit error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), success: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
