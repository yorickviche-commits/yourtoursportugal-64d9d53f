import { describe, expect, it } from 'vitest';
import { costingExportTotals, costingNotes, type CostingExportInput } from './costingExport';
import type { LeadCostItem } from '@/components/trip/LeadCostingEditor';

const item = (patch: Partial<LeadCostItem>): LeadCostItem => ({ id: 'a', description: 'Serviço', supplier: 'FSE', pricingType: 'total', numAdults: 1, priceAdults: 100, numChildren: 0, priceChildren: 0, netTotal: 100, marginPercent: 30, pvpTotal: 130, profit: 30, status: 'neutro', notes: [], ...patch });

describe('internal Costing export', () => {
  it('preserves complete notes and attachment links without truncation', () => {
    const note = 'Nota muito longa com informação operacional completa. '.repeat(1000);
    const result = costingNotes(item({ notes: [{ id: 'n', text: note, imageUrl: 'https://example.com/confirmacao.pdf', createdAt: '2026-11-18T18:00:00Z' }] }));
    expect(result).toContain(note);
    expect(result).toContain('https://example.com/confirmacao.pdf');
  });
  it('uses the current snapshot and manual PVP while excluding optional/deleted lines from base totals', () => {
    const input: CostingExportInput = { version: 2, pax: 2, paxChildren: 0, pvpOverride: 150, days: [{ day: 1, title: 'Dia', items: [item({}), item({ status: 'opcionais', pvpTotal: 70 }), item({ status: 'eliminar', pvpTotal: 900 })] }] };
    expect(costingExportTotals(input)).toEqual({ net: 100, computed: 130, pvp: 150, profit: 50, markup: 50, optional: 70 });
  });
});