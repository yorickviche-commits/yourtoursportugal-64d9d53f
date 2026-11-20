// Native CRM actions shared by the lead UI and Gmail add-on; never call external services.
export type CrmActor = { userId: string | null; email: string; label: string };

async function requireLead(sb: any, leadId: string) {
  const r = await sb.from('leads').select('id,nethunt_stage,status').eq('id', leadId).maybeSingle();
  if (r.error) throw r.error;
  if (!r.data) throw new Error('File não encontrada');
  return r.data;
}

async function audit(sb: any, actor: CrmActor, leadId: string, action: string, details: Record<string, unknown>) {
  const r = await sb.from('activity_logs').insert({ user_id: actor.userId, entity_type: 'lead', entity_id: leadId,
    action_type: action, details: { ...details, actor: actor.label, actor_email: actor.email, source: 'tcc_local' } });
  if (r.error) console.warn('CRM action saved, audit failed:', r.error.message);
}

export async function addLocalComment(sb: any, actor: CrmActor, leadId: string, text: string) {
  const clean = text.trim();
  if (!clean || clean.length > 5000) throw new Error('O comentário deve ter entre 1 e 5000 caracteres');
  await requireLead(sb, leadId);
  const r = await sb.from('item_notes').insert({ entity_type: 'lead', entity_id: leadId, entity_key: leadId,
    note_text: `${clean}\n— ${actor.label}`, created_by: actor.userId }).select().single();
  if (r.error) throw r.error;
  await audit(sb, actor, leadId, 'note_added', { note_id: r.data.id });
  return r.data;
}

export async function createLocalTask(sb: any, actor: CrmActor, input: {
  lead_id: string; title: string; description?: string; due_at?: string | null; due_date?: string | null;
  all_day?: boolean; priority?: string; assignee_emails?: string[];
}) {
  const title = input.title.trim();
  if (!title || title.length > 300) throw new Error('O título deve ter entre 1 e 300 caracteres');
  const lead = await requireLead(sb, input.lead_id);
  const dueAt = input.due_at || null;
  if (dueAt && !Number.isFinite(Date.parse(dueAt))) throw new Error('Data inválida');
  const r = await sb.from('tasks').insert({ lead_id: input.lead_id, title, description: input.description || '',
    due_at: dueAt, due_date: input.due_date || dueAt?.slice(0, 10) || null,
    all_day: input.all_day ?? false, priority: input.priority || 'medium', assignee_emails: input.assignee_emails || [],
    status: 'todo', completed: false, team: lead.nethunt_stage?.startsWith('OPERATIONS') || lead.status === 'won' ? 'operations' : 'sales',
    category: 'general', created_by: actor.userId, creator_email: actor.email }).select().single();
  if (r.error) throw r.error;
  await audit(sb, actor, input.lead_id, 'task_created', { task_id: r.data.id, title });
  return r.data;
}

export async function setLocalTaskCompleted(sb: any, actor: CrmActor, taskId: string, completed: boolean) {
  const task = await sb.from('tasks').select('id,lead_id,title').eq('id', taskId).maybeSingle();
  if (task.error) throw task.error;
  if (!task.data?.lead_id) throw new Error('Tarefa ligada a uma file não encontrada');
  const r = await sb.from('tasks').update({ completed, status: completed ? 'done' : 'todo' }).eq('id', taskId).select().single();
  if (r.error) throw r.error;
  await audit(sb, actor, task.data.lead_id, completed ? 'task_completed' : 'task_reopened', { task_id: taskId, title: task.data.title });
  return r.data;
}