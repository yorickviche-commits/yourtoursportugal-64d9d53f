// Single point of coupling to the WeTravel Payment Links API (v2).
// Spec: https://developer.wetravel.com/reference/createpaymentlink

export const WETRAVEL = {
  baseUrl: "https://api.wetravel.com/v2",
  tokenPath: "/auth/tokens/access", // refresh token -> access token
  paymentLinksPath: "/payment_links",
  publishPath: (uuid: string) => `/payment_links/${uuid}/publish`,
} as const;

// "credit_card" | "service" | "all" | "none"
export type ParticipantFees = "credit_card" | "service" | "all" | "none";

export interface Installment {
  price: number; // currency units
  days_before_departure: number;
}

export interface PaymentLinkInput {
  title: string;
  tripRef?: string | null;
  startDate: string; // YYYY-MM-DD (required by WeTravel)
  endDate: string; // YYYY-MM-DD (required by WeTravel)
  amountCents: number;
  currency: string;
  participantFees: ParticipantFees;
  daysBeforeDeparture?: number;
  depositCents?: number | null;
  installments?: Installment[];
  allowAutoPayment?: boolean;
  allowPartialPayment?: boolean;
}

const money = (cents: number) => Math.round(cents) / 100;

export function toWeTravelPayload(i: PaymentLinkInput) {
  const hasPlan = (i.depositCents != null && i.depositCents > 0) ||
    (i.installments?.length ?? 0) > 0 ||
    i.allowAutoPayment || i.allowPartialPayment;

  return {
    data: {
      trip: {
        title: i.title,
        ...(i.tripRef ? { trip_id: i.tripRef } : {}),
        start_date: i.startDate,
        end_date: i.endDate,
        currency: i.currency,
        participant_fees: i.participantFees,
      },
      pricing: {
        price: money(i.amountCents),
        days_before_departure: i.daysBeforeDeparture ?? 0,
        ...(hasPlan
          ? {
              payment_plan: {
                allow_auto_payment: !!i.allowAutoPayment,
                allow_partial_payment: !!i.allowPartialPayment,
                deposit: money(i.depositCents ?? 0),
                installments: (i.installments ?? []).map(inst => ({
                  price: inst.price,
                  days_before_departure: inst.days_before_departure,
                })),
              },
            }
          : {}),
      },
    },
  };
}

export function fromWeTravelResponse(raw: any) {
  const node = raw?.data ?? raw ?? {};
  const trip = node.trip ?? node.payment_link?.trip ?? node;
  return {
    uuid: (trip.uuid ?? node.uuid ?? node.id) as string | undefined,
    url: (trip.url ?? node.url ?? node.checkout_url) as string | undefined,
  };
}
