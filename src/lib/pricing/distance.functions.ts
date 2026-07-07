import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const InputSchema = z.object({
  origin: z.string().min(2).max(300),
  destination: z.string().min(2).max(300),
});

export type DrivingDistanceResult = {
  distance_km: number;
  duration_min: number;
  origin_country_code: string | null;
  destination_country_code: string | null;
  cross_border: boolean;
  origin_latlng: { lat: number; lng: number } | null;
  destination_latlng: { lat: number; lng: number } | null;
};

async function reverseCountry(lat: number, lng: number, headers: HeadersInit): Promise<string | null> {
  const url = `${GATEWAY}/maps/api/geocode/json?latlng=${lat},${lng}&result_type=country`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) return null;
  const json: {
    results?: Array<{ address_components?: Array<{ short_name: string; types: string[] }> }>;
  } = await resp.json();
  const first = json.results?.[0];
  const country = first?.address_components?.find((c) => c.types.includes("country"));
  return country?.short_name ?? null;
}

export const computeDrivingDistance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<DrivingDistanceResult> => {
    const lovKey = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovKey || !mapsKey) throw new Error("Google Maps connector is not configured.");

    const authHeaders = {
      Authorization: `Bearer ${lovKey}`,
      "X-Connection-Api-Key": mapsKey,
    };

    const resp = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.legs.startLocation,routes.legs.endLocation",
      },
      body: JSON.stringify({
        origin: { address: data.origin },
        destination: { address: data.destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        units: "METRIC",
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[distance] gateway ${resp.status}: ${body}`);
      throw new Error(`Distance lookup failed (${resp.status}): ${body}`);
    }

    const json: {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        legs?: Array<{
          startLocation?: { latLng?: { latitude: number; longitude: number } };
          endLocation?: { latLng?: { latitude: number; longitude: number } };
        }>;
      }>;
    } = await resp.json();

    const route = json.routes?.[0];
    if (!route?.distanceMeters) throw new Error("No route found between those addresses.");

    const distance_km = Math.round(route.distanceMeters / 1000);
    const duration_min = Math.round(Number((route.duration ?? "0s").replace("s", "")) / 60);

    const start = route.legs?.[0]?.startLocation?.latLng ?? null;
    const end = route.legs?.[route.legs.length - 1]?.endLocation?.latLng ?? null;

    const [oCC, dCC] = await Promise.all([
      start ? reverseCountry(start.latitude, start.longitude, authHeaders) : Promise.resolve(null),
      end ? reverseCountry(end.latitude, end.longitude, authHeaders) : Promise.resolve(null),
    ]);

    return {
      distance_km,
      duration_min,
      origin_country_code: oCC,
      destination_country_code: dCC,
      cross_border: !!(oCC && dCC && oCC !== dCC),
      origin_latlng: start ? { lat: start.latitude, lng: start.longitude } : null,
      destination_latlng: end ? { lat: end.latitude, lng: end.longitude } : null,
    };
  });
