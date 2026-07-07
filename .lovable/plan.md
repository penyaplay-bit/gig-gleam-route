
## Goal

Type a promoter address (e.g. `8G Riversands Blvd, Fourways, Gauteng`), get the one-way driving distance in km from Ntate Stunna's home base auto-filled into the quote — no more manual `distance_km` input.

## What ships

1. **Google Maps Platform connector** — link the workspace connector so server-side Routes API calls work (no browser key needed for this).
2. **`artist_profiles.home_base`** — add `home_city TEXT` and `home_address TEXT` to the profile. Ntate Stunna seeded with Maseru, Lesotho as home base (matches existing quote template origin).
3. **Distance server fn** — `src/lib/pricing/distance.functions.ts`:
   - `computeDrivingDistance({ origin, destination })` → calls Routes API v2 (`routes/directions/v2:computeRoutes`) through the gateway, returns `{ distance_km, duration_min, cross_border, formatted_origin, formatted_destination }`.
   - Auth-gated (`requireSupabaseAuth`), Zod-validated, surfaces provider errors verbatim.
4. **Booking Command Centre UI** (`admin.bookings.new.tsx`):
   - Replace the `distance_km` number input with an **address field** + "Calculate distance" button.
   - On click: call `computeDrivingDistance` with the artist's `home_address` as origin and the typed address as destination.
   - Show resolved: `Maseru, LS → Fourways, ZA · 438 km · ~5h 20m · cross-border`.
   - Auto-populate `distance_km`, `cross_border`, and (if >400 km) `overnight_required` in the quote inputs; user can still override.
   - Manual km input remains as a fallback toggle.
5. **Live demo for the requested address** — once wired, the Ntate Stunna → 8G Riversands Blvd, Fourways calc runs from the UI; expected ~430–450 km, cross-border = true, triggers overnight + flights-optional per the engine's smart-distance rules.

## Technical notes

- Routes API path: `POST /routes/directions/v2:computeRoutes` via `https://connector-gateway.lovable.dev/google_maps/...` with `Authorization: Bearer $LOVABLE_API_KEY` and `X-Connection-Api-Key: $GOOGLE_MAPS_API_KEY`. `X-Goog-FieldMask: routes.distanceMeters,routes.duration,routes.legs.startLocation,routes.legs.endLocation`.
- Body: `{ origin: { address }, destination: { address }, travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", units: "METRIC" }`.
- Cross-border derived by geocoding both endpoints' country codes (Routes response includes leg coords; a lightweight reverse-geocode via `maps/api/geocode/json` fills country codes).
- Distance stored as km integer; existing `computeQuote` consumes `distance_km` unchanged.
- Existing static LUT in `src/lib/engines/infra.functions.ts` stays as offline fallback if the gateway errors.
- Out of scope: browser autocomplete (Places API New) — can layer on later; typed address is enough for the calc.

## Order of operations

1. Link Google Maps Platform connector (I'll trigger the connect flow first turn of build).
2. Migration: add `home_city`, `home_address` to `artist_profiles`; backfill Ntate Stunna with Maseru.
3. Add `distance.functions.ts`.
4. Update Booking Command Centre UI.
5. Run the Fourways calc live and paste the numbers back.
