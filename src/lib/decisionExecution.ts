import { supabase } from '@/integrations/supabase/client';

export async function executeDecision(decisionId: string, sendNow = false) {
  const { data, error } = await supabase.functions.invoke('execute-decision', { body: { decision_id: decisionId, send_now: sendNow } });
  if (error) {
    let message = error.message;
    try { const body = await error.context?.json(); message = body?.error || message; } catch { /* preserve error */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}