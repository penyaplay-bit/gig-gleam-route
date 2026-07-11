// Central trust thresholds & risk config. Keep numbers here so we can tune
// without hunting through the codebase.

// Auto-require Level 2 (ID + selfie) when a single booking value meets/exceeds this.
export const ID_VERIFICATION_TRIGGER_CENTS = 500_000; // R5,000

// Rate limits (rough guidance — enforce server-side via risk_signals)
export const MAX_BOOKINGS_PER_24H_BEFORE_ID = 3;
export const MAX_OTP_FAILURES_BEFORE_LOCK = 5;

// Family-event badge requirements
export const MIN_REFERENCES_FOR_FAMILY_BADGE = 2;

// Buyer levels
export const TRUST_LEVEL = {
  VISITOR: 0,
  CONTACT_VERIFIED: 1,
  ID_VERIFIED: 2,
  BUSINESS_VERIFIED: 3,
} as const;
export type TrustLevelValue = (typeof TRUST_LEVEL)[keyof typeof TRUST_LEVEL];

// Actions -> minimum level required
export const ACTION_MIN_LEVEL: Record<string, TrustLevelValue> = {
  browse: 0,
  save_performer: 1,
  send_enquiry: 1,
  receive_quote: 1,
  book_low_value: 1,
  book_high_value: 2, // above ID_VERIFICATION_TRIGGER_CENTS
  business_booking: 3,
};

export function requiresIdCheck(bookingValueCents: number | null | undefined) {
  if (!bookingValueCents) return false;
  return bookingValueCents >= ID_VERIFICATION_TRIGGER_CENTS;
}
