
ALTER TABLE public.artist_owner_profiles
  ADD COLUMN IF NOT EXISTS spotify_artist_id text,
  ADD COLUMN IF NOT EXISTS spotify_followers integer,
  ADD COLUMN IF NOT EXISTS spotify_popularity integer,
  ADD COLUMN IF NOT EXISTS spotify_monthly_listeners_est integer,
  ADD COLUMN IF NOT EXISTS spotify_genres text[],
  ADD COLUMN IF NOT EXISTS spotify_top_city text,
  ADD COLUMN IF NOT EXISTS spotify_image_url text,
  ADD COLUMN IF NOT EXISTS youtube_handle text,
  ADD COLUMN IF NOT EXISTS youtube_subscribers integer,
  ADD COLUMN IF NOT EXISTS youtube_views bigint,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS instagram_followers integer,
  ADD COLUMN IF NOT EXISTS tiktok_handle text,
  ADD COLUMN IF NOT EXISTS tiktok_followers integer,
  ADD COLUMN IF NOT EXISTS tiktok_video_views bigint,
  ADD COLUMN IF NOT EXISTS reach_updated_at timestamptz;
