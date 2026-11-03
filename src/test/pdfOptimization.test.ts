import { describe, expect, it, vi } from 'vitest';
import { optimizePdf, PDF_MAX_BYTES } from '../lib/pdfOptimization';

describe('PDF size policy', () => {
  it('keeps the first high-quality result below 3 MB', async () => {
    const build = vi.fn(async () => ({ value: 'high quality', size: 2_999_999 }));
    expect((await optimizePdf(build)).value).toBe('high quality');
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('compresses progressively until the target is reached', async () => {
    const sizes = [12_000_000, 6_000_000, 2_500_000];
    const build = vi.fn(async () => ({ value: 'pdf', size: sizes.shift() ?? 0 }));
    expect((await optimizePdf(build)).size).toBe(2_500_000);
    expect(build).toHaveBeenCalledTimes(3);
  });

  it('allows a fallback strictly below 10 MB, replacing the old 5 MB ceiling', async () => {
    expect(PDF_MAX_BYTES).toBe(10_000_000);
    expect((await optimizePdf(async () => ({ value: 'pdf', size: 9_999_999 }))).size).toBe(9_999_999);
  });

  it('rejects 10 MB or larger rather than exporting it', async () => {
    for (const size of [10_000_000, 15_000_000]) {
      await expect(optimizePdf(async () => ({ value: 'pdf', size }))).rejects.toThrow('10 MB');
    }
  });
});