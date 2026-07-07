// Payment templates. Plain-text strings with {placeholders} rendered by the
// comms engine. Ordered by the policy cadence.

export type ReminderRule =
  | "reminder_21d"
  | "reminder_14d"
  | "reminder_10d"
  | "reminder_final_notice"
  | "payment_default";

export const REMINDER_META: Record<ReminderRule, {
  severity: "info" | "warn" | "critical";
  daysBefore: number | null; // null for post-deadline
  title: string;
  body: string;
}> = {
  reminder_21d: {
    severity: "info",
    daysBefore: 14,
    title: "Balance due in 14 days",
    body: "Reminder: your final balance for {event} on {event_date} in {city} is due in 14 days ({due_date}). Outstanding: M {outstanding}.",
  },
  reminder_14d: {
    severity: "info",
    daysBefore: 7,
    title: "Balance due in 7 days",
    body: "Reminder: final balance for {event} is due in 7 days ({due_date}). Outstanding: M {outstanding}.",
  },
  reminder_10d: {
    severity: "warn",
    daysBefore: 3,
    title: "Final balance due in 3 days",
    body: "Your final balance for {event} is due in 3 days ({due_date}). Please arrange payment now to avoid disruption. Outstanding: M {outstanding}.",
  },
  reminder_final_notice: {
    severity: "critical",
    daysBefore: 0,
    title: "FINAL NOTICE — balance due today",
    body: "Today is the final deadline for your outstanding balance on {event}. Payment must reflect today to avoid disruption. Outstanding: M {outstanding}.",
  },
  payment_default: {
    severity: "critical",
    daysBefore: null,
    title: "Payment default — event escalated",
    body: "The balance for {event} was not received by the deadline ({due_date}). The event is now in Payment Default and requires Management Override to continue.",
  },
};

export function renderTemplate(
  body: string,
  vars: { event?: string; event_date?: string; city?: string; due_date?: string; outstanding?: string | number },
): string {
  return body
    .replaceAll("{event}", vars.event ?? "your event")
    .replaceAll("{event_date}", vars.event_date ?? "")
    .replaceAll("{city}", vars.city ?? "")
    .replaceAll("{due_date}", vars.due_date ?? "")
    .replaceAll("{outstanding}", String(vars.outstanding ?? "0"));
}
