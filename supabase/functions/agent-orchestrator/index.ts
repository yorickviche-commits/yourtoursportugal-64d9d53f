import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

async function updateAgentStatus(
  supabase: any, agentId: string, status: string,
  currentTask?: string, currentEntity?: string, waitingFor?: string,
) {
  await supabase.from('agent_status').upsert({
    agent_id: agentId, status,
    current_task: currentTask || null,
    current_entity: currentEntity || null,
    waiting_for: waitingFor || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'agent_id' });
}

async function logAgentEvent(
  supabase: any, agentId: string, eventType: string, eventSummary: string,
  requiresAction = false, eventDetail?: Record<string, any>, relatedEntity?: string,
) {
  await supabase.from('agent_activity_log').insert({
    agent_id: agentId, event_type: eventType, event_summary: eventSummary,
    requires_action: requiresAction,
    event_detail: eventDetail || {},
    related_entity: relatedEntity || null,
  });
}

async function resetAgent(supabase: any, agentId: string) {
  await updateAgentStatus(supabase, agentId, 'idle', 'Standing by');
}

// ─── BUILD FSE CONTEXT FROM DATABASE ───
async function buildFSEContext(supabase: any, destination?: string): Promise<string> {
  try {
    // Fetch suppliers + services + partners + partner_services in parallel
    const [suppRes, svcRes, partRes, pSvcRes] = await Promise.all([
      supabase.from('suppliers').select('id,name,category,currency,notes,net_rates,ideal_for').eq('status', 'active'),
      supabase.from('supplier_services').select('name,category,price,price_child,price_unit,supplier_id,currency,description,duration').eq('status', 'active'),
      supabase.from('partners').select('id,name,category,currency,territory,commission_percent,notes').eq('status', 'active'),
      supabase.from('partner_services').select('name,category,price,price_child,price_unit,partner_id,currency,description,duration').eq('status', 'active'),
    ]);

    const suppliers = suppRes.data || [];
    const services = svcRes.data || [];
    const partners = partRes.data || [];
    const partnerServices = pSvcRes.data || [];

    if (suppliers.length === 0 && partners.length === 0) return '';

    const lines: string[] = [];

    if (suppliers.length > 0) {
      lines.push('=== PROTOCOL SUPPLIERS (FSE) ===');
      for (const s of suppliers) {
        const svcList = services.filter((sv: any) => sv.supplier_id === s.id);
        lines.push(`• ${s.name} [${s.category}]${s.notes ? ` — ${s.notes.slice(0, 100)}` : ''}`);
        if (s.ideal_for && Array.isArray(s.ideal_for) && s.ideal_for.length > 0) {
          lines.push(`  Ideal for: ${s.ideal_for.join(', ')}`);
        }
        for (const sv of svcList) {
          lines.push(`  → "${sv.name}" NET:${sv.price}€/${sv.price_unit}${sv.price_child ? ` child:${sv.price_child}€` : ''}${sv.duration ? ` dur:${sv.duration}` : ''}`);
        }
      }
    }

    if (partners.length > 0) {
      lines.push('\n=== PARTNERS (RESELLERS) ===');
      for (const p of partners) {
        const pSvcs = partnerServices.filter((ps: any) => ps.partner_id === p.id);
        lines.push(`• ${p.name} [${p.category}, ${p.territory || 'PT'}]${p.commission_percent ? ` comm:${p.commission_percent}%` : ''}`);
        for (const ps of pSvcs) {
          lines.push(`  → "${ps.name}" NET:${ps.price}€/${ps.price_unit}${ps.price_child ? ` child:${ps.price_child}€` : ''}${ps.duration ? ` dur:${ps.duration}` : ''}`);
        }
      }
    }

    lines.push('\nFull FSE archive: https://drive.google.com/drive/folders/1HAjGSOKdgPQU3F3QPK6945OyeZMCJORN');

    return lines.join('\n');
  } catch (err) {
    console.error('Failed to build FSE context:', err);
    return '';
  }
}

// ─── PIPELINE: GENERATE TRAVEL PLAN ───
async function runTravelPlanner(supabase: any, lead: any, fseContext: string) {
  const agentId = 'itinerary_architect';
  try {
    await updateAgentStatus(supabase, agentId, 'working', `Designing itinerary for ${lead.client_name}`, lead.id);
    await logAgentEvent(supabase, agentId, 'task_started', `Started travel plan for ${lead.client_name} — ${lead.destination || 'Portugal'}`, false, { lead_id: lead.id }, lead.id);

    const travelStyles = Array.isArray(lead.travel_style) ? lead.travel_style : [];

    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-itinerary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        leadData: {
          clientName: lead.client_name,
          destination: lead.destination || 'Portugal',
          travelDates: lead.travel_dates || '',
          travelEndDate: lead.travel_end_date || '',
          datesType: lead.dates_type || 'flexible',
          numberOfDays: lead.number_of_days || 5,
          pax: lead.pax || 2,
          paxChildren: lead.pax_children || 0,
          paxInfants: lead.pax_infants || 0,
          travelStyles,
          comfortLevel: lead.comfort_level || 'Standard',
          budgetLevel: lead.budget_level || 'medium',
          magicQuestion: lead.magic_question || '',
          notes: lead.notes || '',
        },
        type: 'travel_planner',
        fseContext, // Pass FSE database context to AI
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`generate-itinerary failed: ${err}`);
    }

    const result = await response.json();
    const days = result.result?.days || [];

    if (days.length === 0) throw new Error('AI returned empty plan');

    const version = lead.active_version || 0;
    await supabase.from('lead_planner_data').delete().eq('lead_id', lead.id).eq('version', version);
    
    const plannerRows = days.map((d: any, i: number) => ({
      lead_id: lead.id, version,
      day_number: d.day || i + 1,
      title: d.title || `Day ${i + 1}`,
      description: d.date || '',
      activities: d.periods || {},
      images: [],
    }));

    await supabase.from('lead_planner_data').insert(plannerRows);

    const protocolCount = days.reduce((acc: number, d: any) => {
      const periods = d.periods || {};
      for (const p of Object.values(periods) as any[]) {
        for (const item of (p?.items || [])) {
          if (item.fse_supplier) acc++;
        }
      }
      return acc;
    }, 0);

    await logAgentEvent(supabase, agentId, 'task_completed', `✅ Travel plan generated: ${days.length} days for ${lead.client_name}${protocolCount > 0 ? ` (${protocolCount} protocol suppliers matched)` : ''}`, false, { lead_id: lead.id, days_count: days.length, protocol_suppliers: protocolCount, model: result.modelUsed }, lead.id);
    await resetAgent(supabase, agentId);

    return { success: true, days };
  } catch (err: any) {
    await updateAgentStatus(supabase, agentId, 'error', err.message, lead.id);
    await logAgentEvent(supabase, agentId, 'error', `❌ Travel plan failed for ${lead.client_name}: ${err.message}`, false, { lead_id: lead.id, error: err.message }, lead.id);
    setTimeout(() => resetAgent(supabase, agentId), 5000);
    throw err;
  }
}

// ─── PIPELINE: AUTO-FULFILL BUDGET ───
async function runBudgetFulfill(supabase: any, lead: any, fseContext: string) {
  const agentId = 'pricing_margin';
  try {
    await updateAgentStatus(supabase, agentId, 'working', `Calculating budget for ${lead.client_name}`, lead.id);
    await logAgentEvent(supabase, agentId, 'task_started', `Started budget calculation for ${lead.client_name}`, false, { lead_id: lead.id }, lead.id);

    const version = lead.active_version || 0;
    const { data: plannerDays } = await supabase
      .from('lead_planner_data')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('version', version)
      .order('day_number');

    if (!plannerDays || plannerDays.length === 0) {
      throw new Error('No travel plan found. Generate travel plan first.');
    }

    const costItems: any[] = [];
    for (const day of plannerDays) {
      const activities = day.activities || {};
      for (const periodKey of ['morning', 'lunch', 'afternoon', 'night']) {
        const period = activities[periodKey];
        if (period?.items) {
          for (const item of period.items) {
            // Determine cost layer from AI output or infer from period
            let costLayer = item.cost_layer || 'experience';
            if (!item.cost_layer) {
              if (periodKey === 'lunch') costLayer = 'meal';
              else if (periodKey === 'night' && (item.title || '').toLowerCase().includes('hotel')) costLayer = 'accommodation';
              else if (periodKey === 'night') costLayer = 'meal';
            }

            costItems.push({
              description: item.title || item.description || 'Activity',
              day: day.day_number,
              pricingType: ['transport', 'guide', 'operational'].includes(costLayer) ? 'total' : 
                           (periodKey === 'lunch' || periodKey === 'night' ? 'per_person' : 'total'),
              fse_supplier: item.fse_supplier || null,
              cost_layer: costLayer,
              is_fixed_rate: item.is_fixed_rate || false,
            });
          }
        }
      }
    }

    if (costItems.length === 0) {
      throw new Error('No activities found in travel plan');
    }

    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/auto-fulfill-budget`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        items: costItems,
        destination: lead.destination || 'Portugal',
        fseContext, // Pass FSE context for richer matching
      }),
    });

    if (!response.ok) throw new Error('auto-fulfill-budget failed');
    const { suggestions } = await response.json();

    const costingByDay = new Map<number, any>();
    let totalNet = 0;
    let protocolItems = 0;

    costItems.forEach((item, idx) => {
      const suggestion = suggestions?.[idx] || {};
      const netCost = suggestion.priceAdults || 0;
      const marginPercent = suggestion.marginPercent || 30;
      const pvp = netCost * (1 + marginPercent / 100);
      const isProtocol = suggestion.isProtocol || false;
      if (isProtocol) protocolItems++;

      if (!costingByDay.has(item.day)) {
        const dayData = plannerDays.find((d: any) => d.day_number === item.day);
        costingByDay.set(item.day, {
          day: item.day,
          title: dayData?.title || `Day ${item.day}`,
          items: [],
        });
      }

      const costId = `ci-${Math.random().toString(36).slice(2, 7)}`;
      const effectivePricingType = suggestion.pricingType || item.pricingType;
      const effectiveNet = effectivePricingType === 'per_person' ? netCost * (lead.pax || 2) : netCost;
      const effectivePVP = effectivePricingType === 'per_person' ? pvp * (lead.pax || 2) : pvp;
      const effectiveProfit = effectivePVP - effectiveNet;

      costingByDay.get(item.day).items.push({
        id: costId,
        description: item.description,
        supplier: suggestion.supplier || '',
        pricingType: effectivePricingType,
        numAdults: lead.pax || 2,
        priceAdults: netCost,
        numChildren: lead.pax_children || 0,
        priceChildren: 0,
        netTotal: effectiveNet,
        marginPercent,
        pvpTotal: effectivePVP,
        profit: effectiveProfit,
        status: isProtocol ? 'confirmado' : 'neutro',
        isProtocol,
        isFixedRate: suggestion.isFixedRate || item.is_fixed_rate || false,
        costLayer: suggestion.costLayer || item.cost_layer || 'experience',
        notes: [],
      });
      totalNet += item.pricingType === 'per_person' ? netCost * (lead.pax || 2) : netCost;
    });

    await supabase.from('lead_costing_data').delete().eq('lead_id', lead.id).eq('version', version);
    const costingRows = [...costingByDay.values()].map(d => ({
      lead_id: lead.id, version,
      day_number: d.day,
      title: d.title,
      items: d.items,
    }));
    await supabase.from('lead_costing_data').insert(costingRows);

    const totalPVP = totalNet * 1.3;

    await logAgentEvent(supabase, agentId, 'task_completed', `✅ Budget: €${totalNet.toFixed(0)} NET / €${totalPVP.toFixed(0)} PVP for ${lead.client_name} (${protocolItems}/${costItems.length} protocol suppliers)`, false, { lead_id: lead.id, total_net: totalNet, total_pvp: totalPVP, items_count: costItems.length, protocol_items: protocolItems }, lead.id);

    if (totalPVP > 8000) {
      await updateAgentStatus(supabase, agentId, 'waiting', `Waiting for CEO approval: €${totalPVP.toFixed(0)}`, lead.id, 'CEO_APPROVAL');
      await supabase.from('ceo_approval_queue').insert({
        agent_id: agentId,
        approval_type: 'PROPOSAL_OVER_8K',
        title: `${lead.client_name} — ${lead.destination || 'Portugal'}`,
        description: `${plannerDays.length}-day trip, ${lead.pax} pax. NET: €${totalNet.toFixed(0)}, PVP: €${totalPVP.toFixed(0)}`,
        amount_eur: totalPVP,
        lead_id: lead.id,
        payload: { total_net: totalNet, total_pvp: totalPVP, days: plannerDays.length, pax: lead.pax },
        status: 'pending',
      });
      await logAgentEvent(supabase, agentId, 'approval_requested', `🔴 CEO approval needed: ${lead.client_name} — €${totalPVP.toFixed(0)}`, true, { lead_id: lead.id, amount: totalPVP }, lead.id);
      return { success: true, totalNet, totalPVP, needsApproval: true };
    }

    await resetAgent(supabase, agentId);
    return { success: true, totalNet, totalPVP, needsApproval: false };
  } catch (err: any) {
    await updateAgentStatus(supabase, agentId, 'error', err.message, lead.id);
    await logAgentEvent(supabase, agentId, 'error', `❌ Budget failed for ${lead.client_name}: ${err.message}`, false, { lead_id: lead.id }, lead.id);
    setTimeout(() => resetAgent(supabase, agentId), 5000);
    throw err;
  }
}

// ─── PIPELINE: GENERATE DIGITAL ITINERARY ───
async function runDigitalItinerary(supabase: any, lead: any, fseContext: string) {
  const agentId = 'itinerary_architect';
  try {
    await updateAgentStatus(supabase, agentId, 'working', `Creating digital itinerary for ${lead.client_name}`, lead.id);
    await logAgentEvent(supabase, agentId, 'task_started', `Started digital itinerary for ${lead.client_name}`, false, { lead_id: lead.id }, lead.id);

    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-itinerary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        leadData: {
          clientName: lead.client_name,
          destination: lead.destination || 'Portugal',
          travelDates: lead.travel_dates || '',
          travelEndDate: lead.travel_end_date || '',
          datesType: lead.dates_type || 'flexible',
          numberOfDays: lead.number_of_days || 5,
          pax: lead.pax || 2,
          paxChildren: lead.pax_children || 0,
          paxInfants: lead.pax_infants || 0,
          travelStyles: Array.isArray(lead.travel_style) ? lead.travel_style : [],
          comfortLevel: lead.comfort_level || 'Standard',
          budgetLevel: lead.budget_level || 'medium',
          magicQuestion: lead.magic_question || '',
          notes: lead.notes || '',
        },
        type: 'digital_itinerary',
        fseContext,
      }),
    });

    if (!response.ok) throw new Error('generate-itinerary (digital) failed');
    const result = await response.json();
    const itinerary = result.result;

    const { data: itin } = await supabase.from('itineraries').insert({
      lead_id: lead.id,
      title: itinerary.title || `${lead.client_name} — ${lead.destination}`,
      subtitle: itinerary.subtitle || '',
      client_name: lead.client_name,
      travel_dates: lead.travel_dates || '',
      status: 'draft',
    }).select().single();

    if (itin && itinerary.days) {
      const dayRows = itinerary.days.map((d: any, i: number) => ({
        itinerary_id: itin.id,
        day_number: d.day || i + 1,
        title: d.title || `Day ${i + 1}`,
        narrative: d.narrative || '',
        highlights: d.highlights || [],
        inclusions: d.mealSuggestions || [],
      }));
      await supabase.from('itinerary_days').insert(dayRows);
    }

    await logAgentEvent(supabase, agentId, 'task_completed', `✅ Digital itinerary created for ${lead.client_name}`, false, { lead_id: lead.id, itinerary_id: itin?.id }, lead.id);
    await resetAgent(supabase, agentId);
    return { success: true, itineraryId: itin?.id };
  } catch (err: any) {
    await updateAgentStatus(supabase, agentId, 'error', err.message, lead.id);
    await logAgentEvent(supabase, agentId, 'error', `❌ Digital itinerary failed: ${err.message}`, false, { lead_id: lead.id }, lead.id);
    setTimeout(() => resetAgent(supabase, agentId), 5000);
    throw err;
  }
}

// ─── FULL PIPELINE ───
async function runFullPipeline(supabase: any, lead: any, fseContext: string) {
  const results: any = { plan: null, budget: null, itinerary: null };

  try {
    results.plan = await runTravelPlanner(supabase, lead, fseContext);
  } catch (e: any) {
    return { error: `Travel plan failed: ${e.message}`, results };
  }

  try {
    results.budget = await runBudgetFulfill(supabase, lead, fseContext);
  } catch (e: any) {
    return { error: `Budget failed: ${e.message}`, results };
  }

  if (!results.budget.needsApproval) {
    try {
      results.itinerary = await runDigitalItinerary(supabase, lead, fseContext);
    } catch (e: any) {
      return { error: `Digital itinerary failed: ${e.message}`, results };
    }
    await supabase.from('leads').update({ status: 'proposal_sent' }).eq('id', lead.id);
    await logAgentEvent(supabase, 'crm_manager', 'task_completed', `📋 Lead ${lead.lead_code} status → Proposta Enviada`, false, { lead_id: lead.id }, lead.id);
  }

  return { success: true, results };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, leadId, approvalId, decision } = await req.json();
    const supabase = getServiceClient();

    // Handle approval decisions
    if (action === 'approve_decision' && approvalId) {
      const { data: approval } = await supabase
        .from('ceo_approval_queue')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (!approval) throw new Error('Approval not found');

      await supabase.from('ceo_approval_queue').update({
        status: decision,
        decided_at: new Date().toISOString(),
      }).eq('id', approvalId);

      const agentId = approval.agent_id;
      
      if (decision === 'approved') {
        await logAgentEvent(supabase, agentId, 'approval_granted', `✅ CEO approved: ${approval.title}`, false, { approval_id: approvalId }, approval.lead_id);
        await resetAgent(supabase, agentId);

        if (approval.lead_id) {
          const { data: lead } = await supabase.from('leads').select('*').eq('id', approval.lead_id).single();
          if (lead) {
            try {
              const fseContext = await buildFSEContext(supabase, lead.destination);
              await runDigitalItinerary(supabase, lead, fseContext);
              await supabase.from('leads').update({ status: 'proposal_sent' }).eq('id', lead.id);
              await logAgentEvent(supabase, 'crm_manager', 'task_completed', `📋 Lead ${lead.lead_code} status → Proposta Enviada`, false, { lead_id: lead.id }, lead.id);
            } catch (e) {
              console.error('Post-approval pipeline error:', e);
            }
          }
        }
      } else {
        await logAgentEvent(supabase, agentId, 'task_completed', `❌ CEO rejected: ${approval.title}`, false, { approval_id: approvalId }, approval.lead_id);
        await resetAgent(supabase, agentId);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get lead data
    if (!leadId) throw new Error('leadId is required');
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    if (leadError || !lead) throw new Error('Lead not found');

    // Build FSE context from our database ONCE for all pipeline steps
    console.log('Building FSE context from suppliers/partners database...');
    const fseContext = await buildFSEContext(supabase, lead.destination);
    console.log(`FSE context built: ${fseContext.length} chars`);

    let result;

    switch (action) {
      case 'plan':
        result = await runTravelPlanner(supabase, lead, fseContext);
        break;
      case 'cost':
        result = await runBudgetFulfill(supabase, lead, fseContext);
        break;
      case 'itinerary':
        result = await runDigitalItinerary(supabase, lead, fseContext);
        break;
      case 'full_pipeline':
        result = await runFullPipeline(supabase, lead, fseContext);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('agent-orchestrator error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
