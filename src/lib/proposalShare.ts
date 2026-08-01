// Public share URL for a proposal — routes through the `proposal-preview`
// edge function so WhatsApp / Slack / iMessage crawlers get proper OG meta
// (hero image, program title, summary). Human visitors are HTTP-redirected to
// the SPA at /proposal/:token.

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://jufqscczzmioauzkqztj.supabase.co";

export function getProposalShareUrl(token: string): string {
  return `${SUPABASE_URL}/functions/v1/proposal-preview/${encodeURIComponent(token)}`;
}

export function getProposalAppUrl(token: string): string {
  return `${window.location.origin}/proposal/${token}`;
}
