
CREATE TABLE public.itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  subtitle text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft',
  travel_dates text,
  client_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.itinerary_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid REFERENCES public.itineraries(id) ON DELETE CASCADE NOT NULL,
  day_number integer NOT NULL,
  title text NOT NULL DEFAULT '',
  narrative text,
  description text,
  highlights text[] DEFAULT '{}',
  inclusions text[] DEFAULT '{}',
  images jsonb DEFAULT '[]',
  location_name text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published itineraries"
ON public.itineraries FOR SELECT
USING (status = 'published');

CREATE POLICY "Authenticated can manage itineraries"
ON public.itineraries FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can view published itinerary days"
ON public.itinerary_days FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.itineraries
  WHERE itineraries.id = itinerary_days.itinerary_id
  AND (itineraries.status = 'published')
) OR auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can manage itinerary days"
ON public.itinerary_days FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
