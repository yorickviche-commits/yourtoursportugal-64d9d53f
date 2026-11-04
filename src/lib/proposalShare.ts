// Client-facing proposal links always use the YTP custom domain.
import { PUBLIC_APP_URL } from "./publicUrl";

export function getProposalShareUrl(token: string): string {
  return `${PUBLIC_APP_URL}/proposal/${encodeURIComponent(token)}`;
}

export function getProposalAppUrl(token: string): string {
  return `${PUBLIC_APP_URL}/proposal/${token}`;
}
