// Sourced from the real Ntate Stunna quotation (Vaal Arts & Sound Experience,
// 5 Dec 2026, Ref NS-VASE-20261205). Terms are generalised here as the seed
// template library for the platform's auto-generated performance agreements.

export interface RiderItem {
  category: string;
  items: string[];
}

export const DEFAULT_RIDER: RiderItem[] = [
  {
    category: "Food & beverages (team of 5)",
    items: [
      "Water",
      "Food platters × 5",
      "Hennessy VSOP × 1 OR Hennessy Original × 2 (with Ginger Ale)",
      "Veuve Rich × 2",
      "Ice",
    ],
  },
];

export interface TermsClause {
  n: string;
  title: string;
  body: string[];
}

export const DEFAULT_TERMS: TermsClause[] = [
  {
    n: "1",
    title: "Payment terms",
    body: [
      "A 50% non-refundable deposit is required to secure the booking.",
      "The remaining 50% balance must be cleared 7 days prior to the event date.",
      "Deposit released to artist on booking confirmation; balance held in platform escrow until dual-completion sign-off.",
    ],
  },
  {
    n: "2",
    title: "Weather / force majeure",
    body: [
      "In the event of cancellation due to adverse weather or other force majeure beyond the control of both parties, no refund shall be issued.",
      "The 50% deposit is retained as compensation for loss of opportunity and associated costs.",
      "One free reschedule within 90 days is permitted at the artist's discretion.",
    ],
  },
  {
    n: "3",
    title: "Cancellation — artist fault",
    body: [
      "Deposit remains non-refundable and applied to the rescheduled date.",
      "Artist shall prioritise rescheduling within a 90-day window, subject to availability.",
      "No additional fees beyond the original quoted amount for the rescheduled performance.",
      "Repeat artist cancellations trigger platform strike system — 3 strikes = suspension.",
    ],
  },
  {
    n: "4",
    title: "Cancellation — promoter fault",
    body: [
      "The 50% deposit is non-refundable.",
      "The promoter remains liable for the full performance fee unless a mutually agreed alternative arrangement is made in writing.",
    ],
  },
  {
    n: "5",
    title: "Rider compliance",
    body: [
      "The hospitality rider must be fulfilled in its entirety and made available in the artist's dressing room prior to arrival.",
      "Failure to provide the agreed rider may result in performance delays or cancellation at the artist's discretion, with no refund issued.",
    ],
  },
  {
    n: "6",
    title: "Transport & accommodation",
    body: [
      "When engine-priced: transport and accommodation are itemised in this quote and paid to the artist as part of the booking total.",
      "When excluded: the promoter arranges and covers transport and accommodation for the artist and full team; costs incurred by the artist due to promoter negligence are invoiced separately.",
    ],
  },
  {
    n: "7",
    title: "Liability & dispute resolution",
    body: [
      "The artist and platform assume no liability for cancellations beyond their control.",
      "Disputes are resolved first through Penya's in-platform dispute console with full quote, contract, chat, and payment audit trail.",
      "Unresolved matters may be escalated to legal counsel at the cost of the breaching party.",
    ],
  },
  {
    n: "8",
    title: "Acceptance",
    body: [
      "By accepting this quote in-platform the promoter acknowledges and accepts all terms and conditions outlined herein. The accepted quote becomes the performance agreement and is e-signed by both parties.",
    ],
  },
];

export const BANKING = {
  accountName: "PENYA PLAY PRODUCTIONS PTY LTD",
  bank: "FNB / RMB",
  accountType: "Business Cheque Account",
  accountNumber: "6318 2765 231",
};
