import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Service role client for writing to agent tables
function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

async function updateAgentStatus(
  supabase: any,
  agentId: string,
  status: string,
  currentTask?: string,
  currentEntity?: string,
  waitingFor?: string,
) {
  await supabase.from('agent_status').upsert({
    agent_id: agentId,
    status,
    current_task: currentTask || null,
    current_entity: currentEntity || null,
    waiting_for: waitingFor || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'agent_id' });
}

async function logAgentEvent(
  supabase: any,
  agentId: string,
  eventType: string,
  eventSummary: string,
  requiresAction = false,
  eventDetail?: Record<string, any>,
  relatedEntity?: string,
) {
  await supabase.from('agent_activity_log').insert({
    agent_id: agentId,
    event_type: eventType,
    event_summary: eventSummary,
    requires_action: requiresAction,
    event_detail: eventDetail || {},
    related_entity: relatedEntity || null,
  });
}

async function resetAgent(supabase: any, agentId: string) {
  await updateAgentStatus(supabase, agentId, 'idle', 'Standing by');
}

// ─── PIPELINE: GENERATE TRAVEL PLAN ───
async function runTravelPlanner(supabase: any, lead: any) {
  const agentId = 'itinerary_architect';
  try {
    await updateAgentStatus(supabase, agentId, 'working', `Designing itinerary for ${lead.client_name}`, lead.id);
    await logAgentEvent(supabase, agentId, 'task_started', `Started travel plan for ${lead.client_name} — ${lead.destination || 'Portugal'}`, false, { lead_id: lead.id }, lead.id);

    // Call existing generate-itinerary function
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

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
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`generate-itinerary failed: ${err}`);
    }

    const result = await response.json();
    const days = result.result?.days || [];

    if (days.length === 0) throw new Error('AI returned empty plan');

    // Save planner data to lead_planner_data
    const version = lead.active_version || 0;
    await supabase.from('lead_planner_data').delete().eq('lead_id', lead.id).eq('version', version);
    
    const plannerRows = days.map((d: any, i: number) => ({
      lead_id: lead.id,
      version,
      day_number: d.day || i + 1,
      title: d.title || `Day ${i + 1}`,
      description: d.date || '',
      activities: d.periods || {},
      images: [],
    }));

    await supabase.from('lead_planner_data').insert(plannerRows);

    await logAgentEvent(supabase, agentId, 'task_completed', `✅ Travel plan generated: ${days.length} days for ${lead.client_name}`, false, { lead_id: lead.id, days_count: days.length, model: result.modelUsed }, lead.id);
    await resetAgent(supabase, agentId);

    return { success: true, days };
  } catch (err: any) {
    await updateAgentStatus(supabase, agentId, 'error', err.message, lead.id);
    await logAgentEvent(supabase, agentId, 'error', `❌ Travel plan failed for ${lead.client_name}: ${err.message}`, false, { lead_id: lead.id, error: err.message }, lead.id);
    // Reset after 5s
    setTimeout(() => resetAgent(supabase, agentId), 5000);
    throw err;
  }
}

// ─── PIPELINE: AUTO-FULFILL BUDGET ───
async function runBudgetFulfill(supabase: any, lead: any) {
  const agentId = 'pricing_margin';
  try {
    await updateAgentStatus(supabase, agentId, 'working', `Calculating budget for ${lead.client_name}`, lead.id);
    await logAgentEvent(supabase, agentId, 'task_started', `Started budget calculation for ${lead.client_name}`, false, { lead_id: lead.id }, lead.id);

    // Get planner data to build cost items from
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

    // Extract items from planner periods
    const costItems: any[] = [];
    for (const day of plannerDays) {
      const activities = day.activities || {};
      for (const periodKey of ['morning', 'lunch', 'afternoon', 'night']) {
        const period = activities[periodKey];
        if (period?.items) {
          for (const item of period.items) {
            costItems.push({
              description: item.title || item.description || 'Activity',
              day: day.day_number,
              pricingType: periodKey === 'lunch' || periodKey === 'night' ? 'per_person' : 'total',
            });
          }
        }
      }
    }

    if (costItems.length === 0) {
      throw new Error('No activities found in travel plan');
    }

    // Call auto-fulfill-budget
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/auto-fulfill-budget`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        items: costItems,
        destination: lead.destination || 'Portugal',
      }),
    });

    if (!response.ok) throw new Error('auto-fulfill-budget failed');
    const { suggestions } = await response.json();

    // Build costing data from suggestions
    const costingByDay = new Map<number, any>();
    let totalNet = 0;

    costItems.forEach((item, idx) => {
      const suggestion = suggestions?.[idx] || {};
      const netCost = suggestion.priceAdults || 0;
      const marginPercent = suggestion.marginPercent || 30;
      const pvp = netCost * (1 + marginPercent / 100);

      if (!costingByDay.has(item.day)) {
        const dayData = plannerDays.find((d: any) => d.day_number === item.day);
        costingByDay.set(item.day, {
          day: item.day,
          title: dayData?.title || `Day ${item.day}`,
          items: [],
        });
      }

      const costId = `ci-${Math.random().toString(36).slice(2, 7)}`;
      costingByDay.get(item.day).items.push({
        id: costId,
        description: item.description,
        supplier: suggestion.supplier || '',
        pricingType: suggestion.pricingType || item.pricingType,
        numAdults: lead.pax || 2,
        priceAdults: netCost,
        numChildren: lead.pax_children || 0,
        priceChildren: 0,
        netTotal: item.pricingType === 'per_person' ? netCost * (lead.pax || 2) : netCost,
        marginPercent,
        pvpTotal: item.pricingType === 'per_person' ? pvp * (lead.pax || 2) : pvp,
        profit: (pvp - netCost) * (item.pricingType === 'per_person' ? (lead.pax || 2) : 1),
        status: 'neutro',
        notes: [],
      });
      totalNet += item.pricingType === 'per_person' ? netCost * (lead.pax || 2) : netCost;
    });

    // Save costing data
    await supabase.from('lead_costing_data').delete().eq('lead_id', lead.id).eq('version', version);
    const costingRows = [...costingByDay.values()].map(d => ({
      lead_id: lead.id,
      version,
      day_number: d.day,
      title: d.title,
      items: d.items,
    }));
    await supabase.from('lead_costing_data').insert(costingRows);

    const totalPVP = totalNet * 1.3; // Approx with 30% margin

    await logAgentEvent(supabase, agentId, 'task_completed', `✅ Budget calculated: €${totalNet.toFixed(0)} NET / €${totalPVP.toFixed(0)} PVP for ${lead.client_name}`, false, { lead_id: lead.id, total_net: totalNet, total_pvp: totalPVP, items_count: costItems.length }, lead.id);

    // Check if >€8k → create CEO approval
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
async function runDigitalItinerary(supabase: any, lead: any) {
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
      }),
    });

    if (!response.ok) throw new Error('generate-itinerary (digital) failed');
    const result = await response.json();
    const itinerary = result.result;

    // Create itinerary record
    const { data: itin } = await supabase.from('itineraries').insert({
      lead_id: lead.id,
      title: itinerary.title || `${lead.client_name} — ${lead.destination}`,
      subtitle: itinerary.subtitle || '',
      client_name: lead.client_name,
      travel_dates: lead.travel_dates || '',
      status: 'draft',
    }).select().single();

    // Create itinerary days
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
async function runFullPipeline(supabase: any, lead: any) {
  const results: any = { plan: null, budget: null, itinerary: null };

  // Step 1: Travel Plan
  try {
    results.plan = await runTravelPlanner(supabase, lead);
  } catch (e: any) {
    return { error: `Travel plan failed: ${e.message}`, results };
  }

  // Step 2: Budget
  try {
    results.budget = await runBudgetFulfill(supabase, lead);
  } catch (e: any) {
    return { error: `Budget failed: ${e.message}`, results };
  }

  // Step 3: Digital itinerary (only if no approval needed)
  if (!results.budget.needsApproval) {
    try {
      results.itinerary = await runDigitalItinerary(supabase, lead);
    } catch (e: any) {
      return { error: `Digital itinerary failed: ${e.message}`, results };
    }

    // Update lead status to proposal_sent
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

        // Continue pipeline: generate digital itinerary
        if (approval.lead_id) {
          const { data: lead } = await supabase.from('leads').select('*').eq('id', approval.lead_id).single();
          if (lead) {
            try {
              await runDigitalItinerary(supabase, lead);
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

    let result;

    switch (action) {
      case 'plan':
        result = await runTravelPlanner(supabase, lead);
        break;
      case 'cost':
        result = await runBudgetFulfill(supabase, lead);
        break;
      case 'itinerary':
        result = await runDigitalItinerary(supabase, lead);
        break;
      case 'full_pipeline':
        result = await runFullPipeline(supabase, lead);
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
