/** Decimal MB: keep exported files strictly below the user-facing 10 MB limit. */
export const PDF_TARGET_BYTES = 3_000_000;
export const PDF_MAX_BYTES = 10_000_000;

export const PDF_COMPRESSION_ATTEMPTS = [
  { scale: 1, quality: 0.92 },
  { scale: 1, quality: 0.8 },
  { scale: 0.85, quality: 0.75 },
  { scale: 0.75, quality: 0.7 },
  { scale: 0.65, quality: 0.65 },
  { scale: 0.55, quality: 0.6 },
  { scale: 0.5, quality: 0.55 },
] as const;

/** Prefer the highest-quality attempt reaching the target; otherwise smallest safe fallback. */
export async function optimizePdf<T>(build: (scale: number, quality: number) => Promise<{ value: T; size: number }>) {
  let best: { value: T; size: number } | undefined;
  for (const attempt of PDF_COMPRESSION_ATTEMPTS) {
    const candidate = await build(attempt.scale, attempt.quality);
    if (!best || candidate.size < best.size) best = candidate;
    if (candidate.size < PDF_TARGET_BYTES) break;
  }
  if (!best || best.size <= 0) throw new Error('Falha ao gerar o PDF.');
  if (best.size >= PDF_MAX_BYTES) {
    throw new Error(`O PDF tem ${(best.size / 1_000_000).toFixed(1)} MB após compressão. O limite é inferior a 10 MB; reduza as imagens e tente novamente.`);
  }
  return best;
}