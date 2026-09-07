import { supabase } from '@/integrations/supabase/client';
import type { ReportDefinition, RunReportResult } from '@/types/reports';

/**
 * Chama a função `run_report` na base de dados. Toda a validação, permissões e
 * agregação acontecem do lado do servidor — nunca escrevemos SQL no frontend.
 * Erros do Postgres são propagados com a mensagem original (português).
 */
export async function runReport(definition: ReportDefinition): Promise<RunReportResult> {
  const { data, error } = await supabase.rpc('run_report', { definition: definition as any });
  if (error) throw new Error(error.message || 'Erro ao gerar o relatório');
  return data as unknown as RunReportResult;
}

export function encodeDefinition(def: ReportDefinition): string {
  const json = JSON.stringify(def);
  return btoa(encodeURIComponent(json));
}

export function decodeDefinition(hash: string): ReportDefinition | null {
  try {
    const json = decodeURIComponent(atob(hash));
    const parsed = JSON.parse(json);
    if (parsed && parsed.report_type) return parsed as ReportDefinition;
    return null;
  } catch {
    return null;
  }
}
