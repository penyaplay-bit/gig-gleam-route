
-- Widen review eligibility: any signed-in user, one per artist
DROP POLICY IF EXISTS "reviews booker insert" ON public.artist_reviews;
ALTER TABLE public.artist_reviews DROP CONSTRAINT IF EXISTS artist_reviews_application_id_promoter_id_key;
ALTER TABLE public.artist_reviews
  ADD CONSTRAINT artist_reviews_unique_per_reviewer UNIQUE (artist_owner_id, promoter_id);
CREATE POLICY "reviews any signed-in insert" ON public.artist_reviews FOR INSERT TO authenticated
  WITH CHECK (promoter_id = auth.uid());
CREATE POLICY "reviews owner delete own" ON public.artist_reviews FOR DELETE TO authenticated
  USING (promoter_id = auth.uid());
