import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blankLine, costingTotals } from './costing';
import { marginBreakdown, marginReferenceValue } from '../marginReference';

const mocks = vi.hoisted(() => ({ save: vi.fn(), days: [] as unknown[], audit: vi.fn() }));
vi.mock('@lovable.dev/mcp-js', () => ({ defineTool: (tool: unknown) => tool, ToolError: class extends Error {} }));
vi.mock('./supabase', () => ({ supabaseForUser: () => ({
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { public_token: 'test', language: 'pt', value: 20 } }) }) }) }) }),
}) }));
vi.mock('./lead', () => ({
  resolveLead: async () => ({ id: 'test-lead', yt_id: 'YT-test', status: 'new', nethunt_stage: 'SALES - New Lead', client_name: 'Test', email: 'test@example.com', phone: '123', travel_dates: '2027-01-01', travel_end_date: '2027-01-01', number_of_days: 1, pax: 2, language: 'pt', destination: 'Porto', assigned_agents: ['test'] }),
  leadLabel: () => 'YT-test', liveVersion: () => 0, auditLead: mocks.audit,
}));
vi.mock('./agent', () => ({ resolveWriteVersion: async () => 0 }));
vi.mock('./travelPlan', () => ({ loadPlan: async () => ({ plan: { days: [{ day_number: 1 }] } }), planWarnings: () => [] }));
vi.mock('./costing', async (importOriginal) => ({
  ...await importOriginal<typeof import('./costing')>(),
  loadCosting: async () => mocks.days,
  loadMarginReference: async () => 20,
  saveCostingDay: mocks.save,
  paymentsSummary: async () => 0,
}));
import upsert from './tools/upsert-costing-lines';
import validate from './tools/validate-lead';

const context = { isAuthenticated: () => true } as never;
const run = (tool: unknown, input: unknown) => (tool as { handler: (input: unknown, ctx: unknown) => Promise<{ structuredContent: any }> }).handler(input, context);

describe('margin is advisory for every lead', () => {
  beforeEach(() => { mocks.days = []; vi.clearAllMocks(); });

  it('saves a SALES costing at 10% markup without an override or reason', async () => {
    const result = await run(upsert, { lines: [{ day_number: 0, description: 'Hotel', price_adults: 100, margin_percent: 10 }] });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(result.structuredContent.totals.margin_percent).toBe(9.09);
    expect(result.structuredContent.warnings).toHaveLength(1);
  });

  it('accepts legacy allow_below_min_margin=true without a reason', async () => {
    await run(upsert, { allow_below_min_margin: true, lines: [{ day_number: 0, description: 'Hotel', price_adults: 100, margin_percent: 15 }] });
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it('low margin does not invalidate an otherwise complete SALES lead', async () => {
    mocks.days = [{ day_number: 1, title: 'Test', items: [blankLine({ description: 'Hotel', priceAdults: 100, marginPercent: 10 })] }];
    const result = await run(validate, {});
    expect(result.structuredContent.ready).toBe(true);
    expect(result.structuredContent.inconsistencies).toEqual([]);
    expect(result.structuredContent.warnings).toHaveLength(1);
  });

  it('preserves CEO approval strictly above €8000 even with low margin', () => {
    const totals = (net: number) => costingTotals([{ day_number: 0, title: 'Hotel', items: [blankLine({ priceAdults: net, marginPercent: 0 })] }]);
    expect(totals(8000).requires_ceo_approval).toBe(false);
    expect(totals(8000.01).requires_ceo_approval).toBe(true);
  });

  it('separates hotel 10% markup and other services 30%, excluding optional and deleted lines', () => {
    const parts = marginBreakdown([
      { day: 0, items: [blankLine({ priceAdults: 100, marginPercent: 10 })] },
      { day: 1, items: [blankLine({ priceAdults: 100, marginPercent: 30 }), blankLine({ priceAdults: 900, marginPercent: 0, status: 'opcionais' }), blankLine({ priceAdults: 900, marginPercent: 0, status: 'eliminar' })] },
    ]);
    expect(parts.accommodation_percent).toBeCloseTo(9.09, 2);
    expect(parts.other_services_percent).toBeCloseTo(23.08, 2);
  });

  it('uses the configured advisory reference rather than the fallback 20%', () => {
    expect(marginReferenceValue('25')).toBe(25);
    expect(costingTotals([], marginReferenceValue('25')).min_margin_percent).toBe(25);
  });
});