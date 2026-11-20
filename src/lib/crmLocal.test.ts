import { describe, expect, it } from 'vitest';
import { addLocalComment, createLocalTask, setLocalTaskCompleted } from '../../supabase/functions/_shared/crm-local';

function db(stage = 'SALES - New Lead') {
  const writes: { table: string; data: any }[] = [];
  const sb = {
    // No rpc/functions API: tests fail if native actions try external sync.
    from(table: string) {
      let data: any;
      const q: any = {
        select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: table === 'leads' ? { id: 'lead', nethunt_stage: stage } : { id: 'task', lead_id: 'lead', title: 'Confirmar guia' }, error: null }),
        insert: (v: any) => { data = v; writes.push({ table, data: v }); return q; },
        update: (v: any) => { data = v; writes.push({ table, data: v }); return q; },
        single: async () => ({ data: { id: 'created', ...data }, error: null }),
        then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
      };
      return q;
    },
  };
  return { sb, writes };
}
const actor = { userId: 'user', email: 'test@yourtours.pt', label: 'Equipa teste' };

describe('Native CRM — no NetHunt dependency', () => {
  it('saves full comments locally, with file and author, without a NetHunt record', async () => {
    const { sb, writes } = db();
    const text = 'Comentário completo '.repeat(30);
    await addLocalComment(sb, actor, 'lead', text);
    expect(writes[0]).toEqual({ table: 'item_notes', data: { entity_type: 'lead', entity_id: 'lead', entity_key: 'lead', note_text: `${text.trim()}\n— Equipa teste`, created_by: 'user' } });
    expect(writes[1].data.details.actor).toBe('Equipa teste');
  });
  it('creates native tasks with both due fields and operations ownership', async () => {
    const { sb, writes } = db('OPERATIONS - Deposit/Payment Received');
    await createLocalTask(sb, actor, { lead_id: 'lead', title: 'Confirmar guia', due_at: '2026-11-21T10:00:00.000Z' });
    expect(writes[0].data).toMatchObject({ lead_id: 'lead', status: 'todo', completed: false, team: 'operations', due_date: '2026-11-21', due_at: '2026-11-21T10:00:00.000Z' });
    expect(writes[0].data.nethunt_record_id).toBeUndefined();
  });
  it('completion and reopening keep completed and status consistent', async () => {
    const { sb, writes } = db();
    await setLocalTaskCompleted(sb, actor, 'task', true);
    await setLocalTaskCompleted(sb, actor, 'task', false);
    expect(writes.filter(w => w.table === 'tasks').map(w => w.data)).toEqual([{ completed: true, status: 'done' }, { completed: false, status: 'todo' }]);
  });
  it('rejects empty comments and task titles before any writes', async () => {
    const { sb, writes } = db();
    await expect(addLocalComment(sb, actor, 'lead', '  ')).rejects.toThrow();
    await expect(createLocalTask(sb, actor, { lead_id: 'lead', title: '  ' })).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });
  it('surfaces permission errors rather than claiming a write succeeded', async () => {
    const denied = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: new Error('permission denied') }) }) }) }) };
    await expect(addLocalComment(denied, actor, 'lead', 'Teste')).rejects.toThrow('permission denied');
  });
});