/**
 * YT Operations MCP Server
 * Implements Model Context Protocol for Gemini Spark / Google Agentic integration
 * Protocol: https://modelcontextprotocol.io
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// ─── MCP TOOL DEFINITIONS ────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "yt_get_pipeline",
    description: "Get the current leads and bookings pipeline — active deals, status, values and next actions needed.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status (optional)" },
        limit:  { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "yt_get_upcoming_trips",
    description: "Get confirmed bookings/trips happening in the next N days. Useful for pre-trip checklist monitoring.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days ahead to look (default 30)" },
      },
    },
  },
  {
    name: "yt_get_pending_items",
    description: "Get all items needing attention: missing invoices, pending payments, unconfirmed suppliers, proposals without client response.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "yt_get_proposals_without_response",
    description: "Get proposals sent to clients that have not been responded to after a given number of days.",
    inputSchema: {
      type: "object",
      properties: {
        days_without_response: { type: "number", description: "Min days without response (default 3)" },
      },
    },
  },
  {
    name: "yt_create_notification",
    description: "Create an alert or notification for the YT Operations team. Use for monitoring findings that need human awareness.",
    inputSchema: {
      type: "object",
      required: ["type", "priority", "title", "body"],
      properties: {
        type:        { type: "string", enum: ["alert", "info", "warning", "action_required"] },
        priority:    { type: "string", enum: ["low", "medium", "high", "urgent"] },
        title:       { type: "string" },
        body:        { type: "string" },
        entity_type: { type: "string" },
        entity_id:   { type: "string" },
        entity_ref:  { type: "string" },
      },
    },
  },
  {
    name: "yt_propose_action",
    description: "Propose an action for human approval before execution. Never send emails or update records without creating a pending action first.",
    inputSchema: {
      type: "object",
      required: ["action_type", "title", "description", "payload"],
      properties: {
        action_type:  { type: "string", enum: ["send_email", "update_status", "create_calendar_event", "request_invoice", "send_proposal_followup"] },
        title:        { type: "string" },
        description:  { type: "string" },
        entity_type:  { type: "string" },
        entity_id:    { type: "string" },
        entity_ref:   { type: "string" },
        payload:      { type: "object", description: "Action details — email content, event data, etc." },
      },
    },
  },
];

// ─── MCP RESOURCE DEFINITIONS ────────────────────────────────────────────────

const RESOURCES = [
  {
    uri: "yt://pipeline/summary",
    name: "Pipeline Summary",
    description: "Current state of all active leads and bookings",
    mimeType: "application/json",
  },
  {
    uri: "yt://alerts/pending",
    name: "Pending Alerts",
    description: "All active notifications and pending actions requiring attention",
    mimeType: "application/json",
  },
];

// ─── TOOL HANDLERS ───────────────────────────────────────────────────────────

async function handleToolCall(name: string, args: Record<string, any>) {
  const db = getClient();

  switch (name) {

    case "yt_get_pipeline": {
      const limit = args.limit || 20;
      let query = db.from('leads').select('id,ref,client_name,status,destination,travel_dates,budget_eur,assigned_to,updated_at').order('updated_at', { ascending: false }).limit(limit);
      if (args.status) query = query.eq('status', args.status);
      const { data, error } = await query;
      if (error) throw error;
      return { pipeline: data, total: data?.length };
    }

    case "yt_get_upcoming_trips": {
      const days = args.days || 30;
      const until = new Date();
      until.setDate(until.getDate() + days);
      const { data, error } = await db
        .from('trips')
        .select('id,ref,client_name,destination,start_date,end_date,status,pax,lead_id')
        .gte('start_date', new Date().toISOString())
        .lte('start_date', until.toISOString())
        .order('start_date');
      if (error) throw error;
      return { trips: data, total: data?.length, days_ahead: days };
    }

    case "yt_get_pending_items": {
      const [leads, actions, notifications] = await Promise.all([
        db.from('leads').select('id,ref,client_name,status,updated_at').in('status', ['proposal_sent', 'follow_up_needed']).order('updated_at'),
        db.from('agent_pending_actions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        db.from('agent_notifications').select('*').is('dismissed_at', null).is('read_at', null).order('created_at', { ascending: false }),
      ]);
      return {
        proposals_without_response: leads.data || [],
        pending_agent_actions: actions.data || [],
        unread_notifications: notifications.data || [],
        summary: {
          proposals_needing_followup: (leads.data || []).length,
          actions_awaiting_approval: (actions.data || []).length,
          unread_alerts: (notifications.data || []).length,
        },
      };
    }

    case "yt_get_proposals_without_response": {
      const days = args.days_without_response || 3;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const { data, error } = await db
        .from('leads')
        .select('id,ref,client_name,status,updated_at,destination,travel_dates')
        .eq('status', 'proposal_sent')
        .lte('updated_at', cutoff.toISOString())
        .order('updated_at');
      if (error) throw error;
      return { proposals: data, days_without_response: days, total: data?.length };
    }

    case "yt_create_notification": {
      const { data, error } = await db.from('agent_notifications').insert({
        type:        args.type,
        priority:    args.priority,
        title:       args.title,
        body:        args.body,
        entity_type: args.entity_type || null,
        entity_id:   args.entity_id || null,
        entity_ref:  args.entity_ref || null,
        agent_name:  'spark',
      }).select().single();
      if (error) throw error;
      return { created: true, notification: data };
    }

    case "yt_propose_action": {
      const { data, error } = await db.from('agent_pending_actions').insert({
        action_type: args.action_type,
        title:       args.title,
        description: args.description,
        entity_type: args.entity_type || null,
        entity_id:   args.entity_id || null,
        entity_ref:  args.entity_ref || null,
        payload:     args.payload,
        agent_name:  'spark',
        status:      'pending',
      }).select().single();
      if (error) throw error;
      return { proposed: true, action: data, message: "Action queued for human approval." };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── RESOURCE HANDLERS ───────────────────────────────────────────────────────

async function handleResourceRead(uri: string) {
  const db = getClient();

  if (uri === "yt://pipeline/summary") {
    const { data } = await db.from('leads').select('status').neq('status', 'closed').neq('status', 'lost');
    const byStatus: Record<string, number> = {};
    (data || []).forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    return JSON.stringify({ pipeline_by_status: byStatus, total_active: data?.length, updated_at: new Date().toISOString() });
  }

  if (uri === "yt://alerts/pending") {
    const [notifs, actions] = await Promise.all([
      db.from('agent_notifications').select('*').is('dismissed_at', null).order('created_at', { ascending: false }).limit(10),
      db.from('agent_pending_actions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    return JSON.stringify({ notifications: notifs.data, pending_actions: actions.data });
  }

  throw new Error(`Unknown resource: ${uri}`);
}

// ─── MCP JSON-RPC HANDLER ────────────────────────────────────────────────────

async function handleMCPRequest(body: any) {
  const { id, method, params } = body;

  const ok = (result: any) => ({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

  try {
    switch (method) {
      case "initialize":
        return ok({
          protocolVersion: "2024-11-05",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: "yt-operations-mcp", version: "1.0.0" },
        });

      case "tools/list":
        return ok({ tools: TOOLS });

      case "tools/call": {
        const result = await handleToolCall(params.name, params.arguments || {});
        return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      }

      case "resources/list":
        return ok({ resources: RESOURCES });

      case "resources/read": {
        const text = await handleResourceRead(params.uri);
        return ok({ contents: [{ uri: params.uri, mimeType: "application/json", text }] });
      }

      default:
        return err(-32601, `Method not found: ${method}`);
    }
  } catch (e: any) {
    return err(-32000, e.message || "Internal error");
  }
}

// ─── SERVE ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const __auth = await requireInternalUser(req);
  if (!__auth.ok) return __auth.response;


  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', server: 'yt-operations-mcp', version: '1.0.0' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const response = await handleMCPRequest(body);
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
