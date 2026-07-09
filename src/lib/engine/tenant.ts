/**
 * Tenant config for the Bookings Intelligence Engine.
 *
 * All marketplace-specific branding, taxonomies, and copy live here so the
 * engine can later power other marketplaces without a rewrite.
 */

import type { Database } from "@/integrations/supabase/types";

export type OpportunityCategory = Database["public"]["Enums"]["opportunity_category"];
export type DealStage = Database["public"]["Enums"]["deal_stage"];
export type WatchlistCadence = Database["public"]["Enums"]["watchlist_cadence"];

export type GeoScope =
  | "my_city"
  | "province"
  | "anywhere_lesotho"
  | "south_africa"
  | "southern_africa"
  | "africa"
  | "worldwide";

export interface TenantConfig {
  slug: string;
  name: string;
  tagline: string;
  defaultCurrency: string;
  homeCountry: string;
  categories: { value: OpportunityCategory; label: string }[];
  geoScopes: { value: GeoScope; label: string }[];
  preferenceFilters: { id: string; label: string }[];
  dealStages: { value: DealStage; label: string }[];
  cadences: { value: WatchlistCadence; label: string }[];
  quickFeeRanges: { label: string; min: number; max: number }[];
}

export const PENYA_PLAY: TenantConfig = {
  slug: "penya-play",
  name: "Penya Play",
  tagline: "The intelligent booking engine for African artists",
  defaultCurrency: "ZAR",
  homeCountry: "LS",

  categories: [
    { value: "festival", label: "Festivals" },
    { value: "corporate", label: "Corporate" },
    { value: "government", label: "Government" },
    { value: "university", label: "Universities" },
    { value: "club", label: "Clubs" },
    { value: "lounge", label: "Lounges" },
    { value: "wedding", label: "Weddings" },
    { value: "private", label: "Private Events" },
    { value: "brand", label: "Brand Campaigns" },
    { value: "tv", label: "TV" },
    { value: "radio", label: "Radio" },
    { value: "cultural", label: "Cultural Festivals" },
    { value: "sports", label: "Sports Events" },
    { value: "international", label: "International Tours" },
  ],

  geoScopes: [
    { value: "my_city", label: "My City" },
    { value: "province", label: "Province" },
    { value: "anywhere_lesotho", label: "Anywhere in Lesotho" },
    { value: "south_africa", label: "South Africa" },
    { value: "southern_africa", label: "Southern Africa" },
    { value: "africa", label: "Africa" },
    { value: "worldwide", label: "Worldwide" },
  ],

  preferenceFilters: [
    { id: "paid_only", label: "Paid Only" },
    { id: "sponsored", label: "Sponsored" },
    { id: "festivals", label: "Festivals" },
    { id: "corporate", label: "Corporate" },
    { id: "tv", label: "TV" },
    { id: "brand", label: "Brand Activations" },
    { id: "government", label: "Government" },
    { id: "universities", label: "Universities" },
    { id: "international", label: "International" },
    { id: "vip", label: "VIP Events" },
  ],

  dealStages: [
    { value: "discovered", label: "Discovered" },
    { value: "qualified", label: "Qualified" },
    { value: "contact_available", label: "Contact Available" },
    { value: "proposal_prepared", label: "Proposal Prepared" },
    { value: "proposal_sent", label: "Proposal Sent" },
    { value: "opened", label: "Opened" },
    { value: "interested", label: "Interested" },
    { value: "negotiating", label: "Negotiating" },
    { value: "contract_sent", label: "Contract Sent" },
    { value: "deposit_paid", label: "Deposit Paid" },
    { value: "booked", label: "Booked" },
    { value: "completed", label: "Completed" },
    { value: "review_collected", label: "Review Collected" },
  ],

  cadences: [
    { value: "realtime", label: "Real-time" },
    { value: "daily", label: "Daily digest" },
    { value: "weekly", label: "Weekly digest" },
  ],

  quickFeeRanges: [
    { label: "Under M5,000", min: 0, max: 5000 },
    { label: "M5,000 – M15,000", min: 5000, max: 15000 },
    { label: "M15,000 – M50,000", min: 15000, max: 50000 },
    { label: "M50,000 – M150,000", min: 50000, max: 150000 },
    { label: "M150,000+", min: 150000, max: 1_000_000 },
  ],
};

export const tenant = PENYA_PLAY;
