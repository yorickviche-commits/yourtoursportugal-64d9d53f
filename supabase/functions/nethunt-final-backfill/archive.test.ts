import { describe, it, expect } from 'bun:test';
import { ARCHIVE_SINCE, canonical, hash, identity, matchLead, sourcePath, mayImportTask, archiveEntries, taskTeam } from './archive';

describe('final archive safety', () => {
  it('uses the existing task board operations team key', () => {
    expect(taskTeam('OPERATIONS - Trip Ready / In Execution')).toBe('operations');
    expect(taskTeam('SALES - New Lead')).toBe('sales');
  });
  it('requests all history from 1970 without an ascending since cursor or a page limit', () => {
    expect(ARCHIVE_SINCE).toBe('1970-01-01T00:00:00Z');
    expect(sourcePath('records', 'folder')).toBe('/triggers/new-record/folder?since=1970-01-01T00%3A00%3A00Z');
    expect(sourcePath('comment', 'folder')).not.toContain('limit=');
  });
  it('preserves an edited existing task instead of replacing it from NetHunt', () => {
    expect(mayImportTask(new Set(['old-task']), 'old-task', { fields: { Name: 'remote' } })).toBe(false);
    expect(mayImportTask(new Set(), 'new-task', { deleted: true })).toBe(false);
    expect(mayImportTask(new Set(), 'new-task', {})).toBe(true);
  });
  it('does not guess associations for ambiguous YT references', () => {
    const leads = [
      { id: 'a', yt_id: 'YT5057', nethunt_record_id: null },
      { id: 'b', yt_id: '5057', nethunt_record_id: null },
    ];
    expect(matchLead(leads, 'remote', { fields: { 'YT ID/Referencia': 5057 } }, 'records')).toBeNull();
    expect(matchLead(leads.slice(0, 1), 'remote', { fields: { 'YT ID/Referencia': 5057 } }, 'records')?.id).toBe('a');
    expect(matchLead(leads.slice(0, 1), 'remote', { fields: { 'YT ID/Referencia': '2026-5057' } }, 'records')).toBeNull();
  });
  it('does not relink a file already tied to another NetHunt record', () => {
    expect(matchLead([{ id: 'a', yt_id: 'YT5057', nethunt_record_id: 'other' }], 'remote', { fields: { 'YT ID/Referencia': 5057 } }, 'records')).toBeNull();
  });
  it('retains distinct anonymous events at the same timestamp and deduplicates exact replay', async () => {
    const a = { recordId: 'r', createdAt: '2026-11-20T12:00:00Z', text: 'first' };
    const b = { ...a, text: 'second' };
    expect(await identity('comment', a)).not.toBe(await identity('comment', b));
    expect(await identity('comment', a)).toBe(await identity('comment', {...a}));
  });
  it('verifies full payload content independently of property order', async () => {
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
    expect(await hash({text:'original'})).not.toBe(await hash({text:'changed'}));
  });
  it('archives every variant when NetHunt repeats a history id with different content', async () => {
    const a = {id:'same',text:'first'};
    const b = {id:'same',text:'second'};
    const entries = await archiveEntries('field_change',[a,b,a]);
    expect(entries.length).toBe(2);
    expect(entries[0].id).not.toBe(entries[1].id);
    expect(entries.every(e => e.conflictingId)).toBe(true);
    expect((await archiveEntries('field_change',[b,a])).map(e=>e.id).sort()).toEqual(entries.map(e=>e.id).sort());
  });
});