import { supabase } from '@/integrations/supabase/client';

export const logActivity = async (
  actionType: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, any>
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('activity_logs').insert({
      action_type: actionType,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details: details ?? {},
      user_id: user?.id ?? null,
    });
    if (error) console.error('Activity log insert failed:', error.message);
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
};
