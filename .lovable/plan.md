## Change

On `src/routes/book.tsx`, in the "Logistics & budget" step, remove the two offer fields (Your offer, Minimum budget). Keep Expected crowd size, Ticket price, and Deposit-ready.

## Edits

1. **Step 3 UI (~lines 515–521)** — delete the "Your offer (M)" and "Minimum budget (M)" inputs and their labels.
2. **Validation (line 235)** — remove the `if (!f.client_offer && !f.budget_min) return "Enter an offer or a minimum budget"` guard.
3. **Review step (line 598)** — remove the "Offer" row.
4. **Form state + submit payload** — leave `client_offer` / `budget_min` in state and payload as empty (send `null`) so the backend contract is untouched; no schema or server change.

Deposit-ready checkbox, crowd, and ticket price stay as-is. No changes to booking-score logic or DB.