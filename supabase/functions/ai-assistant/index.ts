import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

// ── Tool definitions (read-only) ────────────────────────────────
const tools = [
  {
    type: "function",
    function: {
      name: "search_leads",
      description:
        "Procura leads por nome de cliente, código YT, destino ou estado. Devolve dados gerais da lead.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto livre: nome, YT-2026-1234, destino" },
          status: { type: "string", description: "Filtrar por estado exato (ex: novo, ganho)" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lead",
      description:
        "Detalhe completo de uma lead: dados gerais, proposta, custos (NET/PVP/margem), operações (custo real) e links de pagamento.",
      parameters: {
        type: "object",
        properties: {
          lead_code: { type: "string", description: "Código YT ou nome do cliente" },
          lead_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_upcoming_trips",
      description: "Viagens/reservas confirmadas nos próximos N dias (default 7).",
      parameters: {
        type: "object",
        properties: { days: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Tarefas por estado, equipa ou lead.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          team: { type: "string" },
          lead_code: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_suppliers",
      description:
        "Fornecedores e respetivos serviços com preços net, condições de pagamento e cancelamento.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nome do fornecedor ou categoria" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Produtos do catálogo (Magpie) e da biblioteca interna, com preços, duração, incluídos e condições.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nome, destino ou categoria do produto" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_payment_links",
      description: "Links de pagamento WeTravel gerados (estado, valor, ativo, lead).",
      parameters: {
        type: "object",
        properties: { lead_code: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
];

const clip = (rows: any[] | null, fields?: string[]) =>
  (rows || []).map((r) => {
    if (!fields) return r;
    const o: Record<string, unknown> = {};
    for (const f of fields) if (r[f] !== null && r[f] !== undefined && r[f] !== "") o[f] = r[f];
    return o;
  });

async function findLead(sb: SupabaseClient, key?: string, id?: string) {
  if (id) {
    const { data } = await sb.from("leads").select("*").eq("id", id).maybeSingle();
    if (data) return data;
  }
  if (!key) return null;
  const { data } = await sb
    .from("leads")
    .select("*")
    .or(`lead_code.ilike.%${key}%,client_name.ilike.%${key}%,yt_id.ilike.%${key}%`)
    .limit(1);
  return data?.[0] || null;
}

async function runTool(sb: SupabaseClient, name: string, args: any): Promise<unknown> {
  const limit = Math.min(Number(args?.limit) || 10, 25);
  switch (name) {
    case "search_leads": {
      let q = sb.from("leads").select("*").order("updated_at", { ascending: false }).limit(limit);
      if (args?.status) q = q.eq("status", args.status);
      if (args?.query) {
        const t = String(args.query);
        q = q.or(
          `client_name.ilike.%${t}%,lead_code.ilike.%${t}%,destination.ilike.%${t}%,email.ilike.%${t}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return clip(data, [
        "id", "lead_code", "client_name", "status", "destination", "travel_dates",
        "travel_end_date", "pax", "number_of_days", "budget_level", "sales_owner",
        "email", "phone", "source", "updated_at",
      ]);
    }
    case "get_lead": {
      const lead = await findLead(sb, args?.lead_code, args?.lead_id);
      if (!lead) return { error: "Lead não encontrada" };
      const [proposal, costing, ops, links, tasks] = await Promise.all([
        sb.from("proposals").select("title, status, total_value_eur, deposit_amount_eur, language, date_range, sent_at, wetravel_checkout_url, public_token").eq("lead_id", lead.id).maybeSingle(),
        sb.from("lead_costing_data").select("day_number, title, items").eq("lead_id", lead.id).order("day_number"),
        sb.from("lead_operations").select("day_number, activity_title, supplier, net_value, real_cost, booking_status, payment_status, pax, schedule_time").eq("lead_id", lead.id).order("day_number"),
        sb.from("payment_links").select("title, url, amount_cents, currency, status, is_active, created_at").eq("lead_id", lead.id),
        sb.from("tasks").select("title, status, priority, due_date, team").eq("lead_id", lead.id),
      ]);
      const totals = (ops.data || []).reduce(
        (a: any, r: any) => ({
          net: a.net + (Number(r.net_value) || 0),
          real: a.real + (Number(r.real_cost) || 0),
        }),
        { net: 0, real: 0 },
      );
      return {
        lead,
        proposal: proposal.data || null,
        costing_days: costing.data || [],
        operations: ops.data || [],
        operations_totals: totals,
        payment_links: links.data || [],
        tasks: tasks.data || [],
      };
    }
    case "list_upcoming_trips": {
      const days = Math.min(Number(args?.days) || 7, 120);
      const today = new Date().toISOString().slice(0, 10);
      const until = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
      const { data, error } = await sb
        .from("trips")
        .select("trip_code, client_name, destination, start_date, end_date, pax, status, total_value, has_blocker, blocker_note, urgency, sales_owner, lead_id")
        .gte("start_date", today)
        .lte("start_date", until)
        .order("start_date");
      if (error) throw error;
      return data;
    }
    case "list_tasks": {
      let q = sb.from("tasks").select("*").order("due_date", { ascending: true }).limit(limit);
      if (args?.status) q = q.eq("status", args.status);
      if (args?.team) q = q.eq("team", args.team);
      if (args?.lead_code) {
        const lead = await findLead(sb, args.lead_code);
        if (lead) q = q.eq("lead_id", lead.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return clip(data, ["title", "description", "status", "priority", "team", "due_date", "assigned_to", "lead_id"]);
    }
    case "search_suppliers": {
      let q = sb.from("suppliers").select("*").limit(limit);
      if (args?.query) {
        const t = String(args.query);
        q = q.or(`name.ilike.%${t}%,category.ilike.%${t}%,ideal_for.ilike.%${t}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      const ids = (data || []).map((s: any) => s.id);
      const { data: services } = ids.length
        ? await sb
            .from("supplier_services")
            .select("supplier_id, name, category, price, price_child, price_unit, currency, duration, payment_conditions, cancellation_policy, refund_policy, booking_conditions, validity_start, validity_end, status")
            .in("supplier_id", ids)
            .limit(80)
        : { data: [] as any[] };
      return (data || []).map((s: any) => ({
        name: s.name,
        category: s.category,
        status: s.status,
        contact: { name: s.contact_name, email: s.contact_email, phone: s.contact_phone },
        currency: s.currency,
        net_rates: s.net_rates,
        market_pricing: s.market_pricing,
        commission_structure: s.commission_structure,
        cancellation_policy: s.cancellation_policy,
        contract_type: s.contract_type,
        validity: [s.validity_start, s.validity_end],
        ideal_for: s.ideal_for,
        services: (services || []).filter((sv: any) => sv.supplier_id === s.id),
      }));
    }
    case "search_products": {
      const t = args?.query ? String(args.query) : null;
      let mq = sb
        .from("magpie_products")
        .select("name, category, location, summary, duration_text, currency, retail_rate_adult, retail_rate_child, included, excluded, cancellation_policy, cancellation_cutoff, booking_cutoff, min_pax, max_pax, highlights, private, sync_status")
        .limit(limit);
      if (t) mq = mq.or(`name.ilike.%${t}%,location.ilike.%${t}%,category.ilike.%${t}%,summary.ilike.%${t}%`);
      let pq = sb
        .from("products")
        .select("name, category, currency, fixed_cost, variable_cost_per_pax, per_day_cost, markup_rules, margin_calculation, market_pricing, status")
        .limit(limit);
      if (t) pq = pq.or(`name.ilike.%${t}%,category.ilike.%${t}%`);
      const [magpie, internal] = await Promise.all([mq, pq]);
      return { catalog_magpie: magpie.data || [], internal_products: internal.data || [] };
    }
    case "list_payment_links": {
      let q = sb
        .from("payment_links")
        .select("title, url, amount_cents, currency, status, is_active, created_at, lead_id, trip_ref")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args?.lead_code) {
        const lead = await findLead(sb, args.lead_code);
        if (lead) q = q.eq("lead_id", lead.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

const SYSTEM = `Es o "YT Copilot", assistente operacional interno da Your Tours Portugal (DMC boutique em Portugal).

Responde SEMPRE em português de Portugal, de forma direta, curta e operacional (estilo sala de operações).
Usa as ferramentas para ir buscar dados reais — nunca inventes números, preços, estados ou datas.
Se não encontrares o dado, di-lo claramente e sugere onde confirmar.

Regras de negócio a respeitar nas respostas:
- IDs de lead no formato YT-AAAA-0000.
- Margem saudável > 30%, aviso 25–30%, risco < 25%.
- Prioridade operacional por proximidade da partida: D-1 crítico, D-3 alto, D-7 preparação.
- Propostas acima de 8.000 EUR precisam de aprovação de Admin.
- Valores em EUR, formato 1.234,56 €.

Formato da resposta:
- Markdown compacto: frases curtas, listas, negrito nos números-chave. Sem preâmbulos.
- Termina SEMPRE com um bloco JSON isolado, entre as marcas <<<META e META>>>, com no máximo 4 sugestões e 3 próximos passos:
<<<META
{"suggestions":["pergunta curta de seguimento", "..."],"next_steps":[{"label":"Abrir lead YT-2026-0001","route":"/leads/<uuid>"}]}
META>>>
Nas rotas usa apenas caminhos internos existentes: /dashboard, /leads, /leads/<lead_id>, /trips, /trips/<id>, /tasks, /proposals, /proposals/<id>, /comercial/suppliers, /comercial/suppliers/<id>, /products, /catalog, /payments, /partners, /approvals. Se não houver ação óbvia, devolve next_steps vazio.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireInternalUser(req);
    if (!auth.ok) return auth.response;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY não configurada." }, 500);

    const body = await req.json().catch(() => null);
    const history = Array.isArray(body?.messages) ? body.messages : null;
    if (!history || history.length === 0) return json({ error: "messages é obrigatório." }, 400);

    const jwt = (req.headers.get("Authorization") || "").slice(7);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );

    const contextNote = body?.context
      ? `\n\nContexto atual do utilizador na app: ${JSON.stringify(body.context)}`
      : "";

    const messages: any[] = [
      { role: "system", content: SYSTEM + contextNote },
      ...history.slice(-20).map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "").slice(0, 8000),
      })),
    ];

    for (let step = 0; step < 6; step++) {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({ model: MODEL, messages, tools, temperature: 0.2 }),
      });

      if (res.status === 429) return json({ error: "Limite de pedidos atingido. Tenta dentro de um minuto." }, 429);
      if (res.status === 402) return json({ error: "Créditos AI esgotados. Adiciona créditos no workspace." }, 402);
      if (res.status === 403) return json({ error: "Limite de créditos do workspace atingido — o assistente fica indisponível até ajustares o limite." }, 403);
      if (!res.ok) {
        const txt = await res.text();
        console.error("gateway error", res.status, txt);
        return json({ error: `Erro do modelo (${res.status}).`, details: txt.slice(0, 500) }, 502);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) return json({ error: "Resposta vazia do modelo." }, 502);

      const calls = msg.tool_calls;
      if (calls?.length) {
        messages.push(msg);
        for (const c of calls) {
          let out: unknown;
          try {
            const args = c.function?.arguments ? JSON.parse(c.function.arguments) : {};
            out = await runTool(sb, c.function.name, args);
          } catch (e) {
            out = { error: String((e as Error).message || e) };
          }
          messages.push({
            role: "tool",
            tool_call_id: c.id,
            content: JSON.stringify(out).slice(0, 24000),
          });
        }
        continue;
      }

      const raw = String(msg.content || "");
      let reply = raw;
      let suggestions: string[] = [];
      let next_steps: { label: string; route?: string }[] = [];
      const m = raw.match(/<<<META([\s\S]*?)META>>>/);
      if (m) {
        reply = raw.replace(m[0], "").trim();
        try {
          const meta = JSON.parse(m[1].trim());
          if (Array.isArray(meta.suggestions)) suggestions = meta.suggestions.slice(0, 4).map(String);
          if (Array.isArray(meta.next_steps)) next_steps = meta.next_steps.slice(0, 3);
        } catch (_e) { /* ignora meta inválida */ }
      }
      return json({ reply, suggestions, next_steps });
    }

    return json({ error: "O assistente excedeu o número de passos permitidos." }, 500);
  } catch (e) {
    console.error("ai-assistant error", e);
    return json({ error: (e as Error).message || "Erro inesperado." }, 500);
  }
});
