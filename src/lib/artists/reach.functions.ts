// Streaming + social reach: fetches Spotify (Client Credentials) + YouTube Data v3,
// stores manual Instagram/TikTok counts. All values cached on artist_owner_profiles.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// --- Spotify Client Credentials token cache (per Worker instance) ---
let spotifyToken: { value: string; expires: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (spotifyToken && spotifyToken.expires > Date.now() + 30_000) return spotifyToken.value;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error("[spotify] token failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  spotifyToken = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return spotifyToken.value;
}

function extractSpotifyId(input: string): string | null {
  const s = input.trim();
  if (/^[a-zA-Z0-9]{22}$/.test(s)) return s;
  const m = s.match(/artist[/:]([a-zA-Z0-9]{22})/);
  return m?.[1] ?? null;
}

interface SpotifyArtistPayload {
  id: string;
  name: string;
  followers: number;
  popularity: number;
  monthly_listeners_est: number;
  genres: string[];
  image_url: string | null;
}

async function fetchSpotifyArtist(id: string): Promise<SpotifyArtistPayload | null> {
  const token = await getSpotifyToken();
  if (!token) throw new Error("Spotify is not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Spotify returned ${res.status}`);
  const a = (await res.json()) as {
    id: string; name: string; popularity: number;
    followers: { total: number }; genres: string[];
    images: { url: string }[];
  };
  // Spotify's public API does NOT expose monthly listeners. Estimate:
  // rough heuristic that scales followers by popularity (0-100).
  const monthly_listeners_est = Math.round(a.followers.total * (0.6 + a.popularity / 100));
  return {
    id: a.id,
    name: a.name,
    followers: a.followers.total,
    popularity: a.popularity,
    monthly_listeners_est,
    genres: a.genres,
    image_url: a.images?.[0]?.url ?? null,
  };
}

async function fetchYouTubeChannel(handle: string): Promise<{ subscribers: number; views: number } | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YouTube is not configured. Add YOUTUBE_API_KEY.");
  const clean = handle.replace(/^@/, "");
  // Resolve @handle → channelId via the search endpoint.
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=@${encodeURIComponent(clean)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube returned ${res.status}`);
  const json = (await res.json()) as { items?: { statistics: { subscriberCount: string; viewCount: string } }[] };
  const stats = json.items?.[0]?.statistics;
  if (!stats) return null;
  return {
    subscribers: Number(stats.subscriberCount || 0),
    views: Number(stats.viewCount || 0),
  };
}

// --- Server functions ---

export const searchSpotifyArtist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(2).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const token = await getSpotifyToken();
    if (!token) throw new Error("Spotify is not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
    const res = await fetch(
      `https://api.spotify.com/v1/search?type=artist&limit=8&q=${encodeURIComponent(data.query)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Spotify returned ${res.status}`);
    const json = (await res.json()) as {
      artists: { items: { id: string; name: string; followers: { total: number }; genres: string[]; images: { url: string }[] }[] };
    };
    return json.artists.items.map((a) => ({
      id: a.id,
      name: a.name,
      followers: a.followers.total,
      genres: a.genres,
      image_url: a.images?.[0]?.url ?? null,
    }));
  });

export const linkSpotifyArtist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ idOrUrl: z.string().trim().min(3).max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    const id = extractSpotifyId(data.idOrUrl);
    if (!id) throw new Error("Couldn't read a Spotify artist ID from that value.");
    const payload = await fetchSpotifyArtist(id);
    if (!payload) throw new Error("Spotify artist not found.");
    const { error } = await context.supabase.from("artist_owner_profiles").update({
      spotify_artist_id: payload.id,
      spotify_followers: payload.followers,
      spotify_popularity: payload.popularity,
      spotify_monthly_listeners_est: payload.monthly_listeners_est,
      spotify_genres: payload.genres,
      spotify_image_url: payload.image_url,
      reach_updated_at: new Date().toISOString(),
    }).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true, artist: payload };
  });

export const setSocialHandles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    youtube_handle: z.string().trim().max(80).optional().nullable(),
    instagram_handle: z.string().trim().max(80).optional().nullable(),
    instagram_followers: z.number().int().min(0).max(2_000_000_000).optional().nullable(),
    tiktok_handle: z.string().trim().max(80).optional().nullable(),
    tiktok_followers: z.number().int().min(0).max(2_000_000_000).optional().nullable(),
    tiktok_video_views: z.number().int().min(0).max(999_999_999_999).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("artist_owner_profiles")
      .update(data).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const refreshReach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase.from("artist_owner_profiles")
      .select("spotify_artist_id, youtube_handle").eq("user_id", context.userId).maybeSingle();
    if (!profile) throw new Error("No artist profile.");

    const patch: Record<string, unknown> = { reach_updated_at: new Date().toISOString() };
    const errors: string[] = [];

    if (profile.spotify_artist_id) {
      try {
        const s = await fetchSpotifyArtist(profile.spotify_artist_id);
        if (s) {
          patch.spotify_followers = s.followers;
          patch.spotify_popularity = s.popularity;
          patch.spotify_monthly_listeners_est = s.monthly_listeners_est;
          patch.spotify_genres = s.genres;
          patch.spotify_image_url = s.image_url;
        }
      } catch (e) { errors.push(`Spotify: ${(e as Error).message}`); }
    }
    if (profile.youtube_handle) {
      try {
        const y = await fetchYouTubeChannel(profile.youtube_handle);
        if (y) {
          patch.youtube_subscribers = y.subscribers;
          patch.youtube_views = y.views;
        }
      } catch (e) { errors.push(`YouTube: ${(e as Error).message}`); }
    }

    const { error } = await context.supabase.from("artist_owner_profiles")
      .update(patch as never).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true, errors };
  });

export const getReachSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("artist_owner_profiles")
      .select("spotify_artist_id, spotify_followers, spotify_popularity, spotify_monthly_listeners_est, spotify_genres, spotify_top_city, spotify_image_url, youtube_handle, youtube_subscribers, youtube_views, instagram_handle, instagram_followers, tiktok_handle, tiktok_followers, tiktok_video_views, reach_updated_at")
      .eq("user_id", context.userId).maybeSingle();
    return data;
  });
