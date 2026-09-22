import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { syncGeneralToProposalServer } from "../generalSync";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default defineTool({
  name: "update_lead_general_data",
  title: "Update lead general data",
  description:
    "Update the general data of the LIVE version of a lead (dates, participants, language, client type, phone, category, destination), exactly like saving Dados Gerais in the TCC. Participants and dates are propagated to the travel plan and digital proposal. No financial fields.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    data_inicio: z.string().optional().describe("Trip start date, YYYY-MM-DD."),
    data_fim: z.string().optional().describe("Trip end date, YYYY-MM-DD."),
    n_adultos: z.number().int().min(1).optional().describe("Number of adults."),
    n_jovens: z.number().int().min(0).optional().describe("Number of children/teens."),
    n_criancas: z.number().int().min(0).optional().describe("Alias of n_jovens (children)."),
    n_bebes: z.number().int().min(0).optional().describe("Number of infants."),
    idioma: z.string().optional().describe("Programme language: en, pt, es, fr, it, de."),
    tipo_cliente: z.enum(["B2C", "B2B"]).optional().describe("Client type."),
    telefone: z.string().optional().describe("Client phone."),
    categoria: z.string().optional().describe("Comfort/category level."),
    destino: z.string().optional().describe("Destination(s), comma separated."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const { lead_id, lead_code, ...fields } = args;
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const version = liveVersion(lead);

    if (fields.n_jovens !== undefined && fields.n_criancas !== undefined && fields.n_jovens !== fields.n_criancas) {
      throw new ToolError("n_jovens and n_criancas map to the same field — send only one of them");
    }
    for (const [k, v] of Object.entries({ data_inicio: fields.data_inicio, data_fim: fields.data_fim })) {
      if (v && !DATE.test(v)) throw new ToolError(`${k} must be YYYY-MM-DD`);
    }

    const updates: Record<string, unknown> = {};
    const set = (col: string, value: unknown) => {
      if (value !== undefined && value !== null) updates[col] = value;
    };
    set("travel_dates", fields.data_inicio);
    set("travel_end_date", fields.data_fim);
    set("pax", fields.n_adultos);
    set("pax_children", fields.n_jovens ?? fields.n_criancas);
    set("pax_infants", fields.n_bebes);
    set("client_type", fields.tipo_cliente);
    set("phone", fields.telefone);
    set("comfort_level", fields.categoria);
    set("destination", fields.destino);

    if (!Object.keys(updates).length && !fields.idioma) throw new ToolError("No fields to update");

    if (fields.data_inicio && fields.data_fim) {
      const days =
        Math.round(
          (Date.parse(fields.data_fim) - Date.parse(fields.data_inicio)) / 86400000,
        ) + 1;
      if (days < 1) throw new ToolError("data_fim must be on or after data_inicio");
      updates.number_of_days = days;
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(updates)) changes[key] = { from: (lead as any)[key] ?? null, to: updates[key] };

    if (Object.keys(updates).length) {
      const { error } = await supabase.from("leads").update(updates as never).eq("id", lead.id);
      if (error) throw new ToolError(error.message);
    }

    // Keep the version snapshot in sync with the live row (same as the UI save).
    const { data: verRow } = await supabase
      .from("lead_versions")
      .select("id, general_data")
      .eq("lead_id", lead.id)
      .eq("version", version)
      .maybeSingle();
    const merged = { ...(((verRow as any)?.general_data as Record<string, unknown>) ?? {}), ...updates };
    if (verRow) {
      await supabase.from("lead_versions").update({ general_data: merged as never } as never).eq("id", (verRow as any).id);
    } else {
      await supabase
        .from("lead_versions")
        .insert({ lead_id: lead.id, version, name: `V${version}`, general_data: merged as never } as never);
    }

    if (fields.idioma) {
      const lang = fields.idioma.slice(0, 2).toLowerCase();
      const { error } = await supabase
        .from("proposals")
        .update({ language: lang } as never)
        .eq("lead_id", lead.id)
        .eq("version", version);
      if (error) throw new ToolError(error.message);
      changes.language = { from: null, to: lang };
    }

    const pax = Number(updates.pax ?? lead.pax ?? 2);
    const paxChildren = Number(updates.pax_children ?? (lead as any).pax_children ?? 0);
    await syncGeneralToProposalServer(supabase, {
      leadId: lead.id,
      version,
      pax,
      paxChildren,
      travelDates: (updates.travel_dates as string) ?? ((lead as any).travel_dates || null),
      travelEndDate: (updates.travel_end_date as string) ?? ((lead as any).travel_end_date || null),
    });

    await auditLead(supabase, ctx, lead, "lead_updated", changes, { version });

    const payload = { lead: leadLabel(lead), lead_id: lead.id, version, updated_fields: changes };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
