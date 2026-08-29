-- 1. Catálogo de roles
CREATE TABLE public.app_roles (
  code text PRIMARY KEY,
  label text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_roles TO authenticated;
GRANT ALL ON public.app_roles TO service_role;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read app_roles" ON public.app_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage app_roles" ON public.app_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_app_roles_updated BEFORE UPDATE ON public.app_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_roles (code, label, is_system) VALUES
  ('super_admin','Super Admin',true),
  ('admin','Admin',true),
  ('sales_agent','Sales',true),
  ('operations_agent','Operations',true),
  ('finance','Finance',true),
  ('b2b_manager','B2B',true),
  ('viewer','Viewer',true);

-- 2. Convites
CREATE TABLE public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role_code text NOT NULL DEFAULT 'viewer',
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  last_sent_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_invites_pending_email_uidx
  ON public.user_invites (lower(email)) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invites TO authenticated;
GRANT ALL ON public.user_invites TO service_role;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invites" ON public.user_invites FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_user_invites_updated BEFORE UPDATE ON public.user_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Roles personalizados atribuídos
CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES public.app_roles(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_roles TO authenticated;
GRANT ALL ON public.user_custom_roles TO service_role;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own custom roles" ON public.user_custom_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage custom roles" ON public.user_custom_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 4. Matriz de permissões aceita roles personalizados
ALTER TABLE public.permissions ALTER COLUMN role TYPE text USING role::text;

-- 5. Onboarding
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
UPDATE public.profiles SET onboarding_completed_at = COALESCE(onboarding_completed_at, now());

-- 6. handle_new_user aplica role do convite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.user_invites;
  v_role public.app_role := 'viewer';
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );

  SELECT * INTO v_invite
  FROM public.user_invites
  WHERE lower(email) = lower(COALESCE(NEW.email, ''))
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    BEGIN
      v_role := v_invite.role_code::public.app_role;
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN others THEN
      -- role personalizado (fora do enum)
      INSERT INTO public.user_custom_roles (user_id, role_code) VALUES (NEW.id, v_invite.role_code)
      ON CONFLICT (user_id, role_code) DO NOTHING;
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
      ON CONFLICT (user_id, role) DO NOTHING;
    END;

    UPDATE public.user_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invite.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;