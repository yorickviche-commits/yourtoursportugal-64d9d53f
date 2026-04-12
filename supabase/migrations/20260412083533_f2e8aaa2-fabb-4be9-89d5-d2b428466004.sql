
-- Create proposals table
CREATE TABLE public.proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NULL,
  public_token text UNIQUE NOT NULL,
  client_name text NOT NULL DEFAULT '',
  client_email text NULL,
  booking_ref text NULL,
  title text NOT NULL DEFAULT '',
  date_range text NULL,
  participants text NULL,
  hero_image_url text NULL,
  summary_text text NULL,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'draft',
  days jsonb NOT NULL DEFAULT '[]'::jsonb,
  map_stops jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  approved_at timestamptz NULL
);

-- Create proposal_annotations table
CREATE TABLE public.proposal_annotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'proposal',
  target_day_index int NULL,
  target_item_index int NULL,
  author_type text NOT NULL DEFAULT 'client',
  author_name text NOT NULL DEFAULT '',
  author_email text NULL,
  content text NOT NULL DEFAULT '',
  is_resolved boolean NOT NULL DEFAULT false,
  parent_id uuid NULL REFERENCES public.proposal_annotations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create proposal_events table
CREATE TABLE public.proposal_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_name text NOT NULL DEFAULT '',
  actor_email text NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;

-- Proposals: public read by token, authenticated full access
CREATE POLICY "Public can view proposals by token" ON public.proposals
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can manage proposals" ON public.proposals
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Annotations: public can read and insert, authenticated can manage all
CREATE POLICY "Anyone can view annotations" ON public.proposal_annotations
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create annotations" ON public.proposal_annotations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated can manage annotations" ON public.proposal_annotations
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Events: public can read and insert, authenticated can manage
CREATE POLICY "Anyone can view events" ON public.proposal_events
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create events" ON public.proposal_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated can manage events" ON public.proposal_events
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Updated_at trigger for proposals
CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for annotations and events
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_annotations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_events;
