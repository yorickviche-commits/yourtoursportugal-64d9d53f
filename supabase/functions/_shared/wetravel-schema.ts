// Single point of coupling to the WeTravel payment-link API.
// If the private docs (developer.wetravel.com) use different field names,
// change ONLY this file.

export const WETRAVEL = {
  baseUrl: "https://api.wetravel.com/v2",
  tokenPath: "/auth/tokens/access", // refresh token -> access token
  paymentLinksPath: "/payment_links",
  publishPath: (uuid: string) => `/payment_links/${uuid}/publish`,
} as const;

export interface PaymentLinkInput {
  title: string;
  tripRef?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  amountCents: number;
  currency: string;
  expiresAt?: string | null;
  paymentFeesPaidBy: "organizer" | "participant";
  wetravelFeePaidBy: "organizer" | "participant";
}

// CONFIRMAR NOMES NA DOC PRIVADA
export function toWeTravelPayload(i: PaymentLinkInput) {
  return {
    title: i.title,
    trip_id: i.tripRef ?? undefined,
    start_date: i.startDate ?? undefined,
    end_date: i.endDate ?? undefined,
    price: i.amountCents, // confirmar: cêntimos ou unidades?
    currency: i.currency,
    expiration_date: i.expiresAt ?? undefined,
    payment_fees_paid_by: i.paymentFeesPaidBy,
    wetravel_fees_paid_by: i.wetravelFeePaidBy,
  };
}

// CONFIRMAR NOMES NA DOC PRIVADA
export function fromWeTravelResponse(raw: any) {
  const node = raw?.payment_link ?? raw?.data ?? raw ?? {};
  return {
    uuid: (node.uuid ?? node.id ?? raw?.uuid ?? raw?.id) as string | undefined,
    url: (node.url ?? node.link ?? node.payment_link_url ?? node.checkout_url) as string | undefined,
  };
}
