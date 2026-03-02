
DROP POLICY "Authenticated can manage itineraries" ON public.itineraries;
DROP POLICY "Authenticated can manage itinerary days" ON public.itinerary_days;

CREATE POLICY "Authenticated can manage itineraries"
ON public.itineraries FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can manage itinerary days"
ON public.itinerary_days FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
