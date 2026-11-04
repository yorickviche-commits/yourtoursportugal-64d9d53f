// Readable proposal link name mirroring the PDF filename:
// "YT#### - Client - Program - Dates" -> "yt5171-smith-douro-wine-12-15-may-2027-v1-ab12".
// Relative-import safe (used by src/lib/mcp too).

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const slugify = (value: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseIso = (v?: string | null) => {
  const m = (v || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: m[1], m: MONTHS[Number(m[2]) - 1], d: String(Number(m[3])) } : null;
};

export function formatSlugDates(start?: string | null, end?: string | null): string {
  const a = parseIso(start);
  const b = parseIso(end);
  if (a && b && (a.y !== b.y || a.m !== b.m || a.d !== b.d)) {
    if (a.y === b.y && a.m === b.m) return `${a.d}-${b.d}-${b.m}-${b.y}`;
    if (a.y === b.y) return `${a.d}-${a.m}-${b.d}-${b.m}-${b.y}`;
    return `${a.d}-${a.m}-${a.y}-${b.d}-${b.m}-${b.y}`;
  }
  const one = a || b;
  if (one) return `${one.d}-${one.m}-${one.y}`;
  return slugify([start, end].filter(Boolean).join(" "));
}

export interface ProposalSlugParts {
  leadCode: string;
  version: number;
  client?: string | null;
  program?: string | null;
  start?: string | null;
  end?: string | null;
  suffix?: string;
}

export function buildProposalSlug(p: ProposalSlugParts): string {
  const program = slugify(p.program || "").split("-").slice(0, 6).join("-");
  const client = slugify(p.client || "").split("-").slice(0, 3).join("-");
  const parts = [slugify(p.leadCode) || "ytp", client, program, formatSlugDates(p.start, p.end), `v${p.version}`]
    .filter(Boolean);
  const suffix = p.suffix ?? Math.random().toString(36).slice(2, 6);
  return `${parts.join("-")}-${suffix}`.slice(0, 120);
}
