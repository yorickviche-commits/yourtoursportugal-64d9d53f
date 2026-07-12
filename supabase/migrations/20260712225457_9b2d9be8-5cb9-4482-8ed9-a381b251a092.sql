
-- Assign viewer role to every new signup so new users start at the lowest access tier
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );

  -- Grant the lowest-privilege role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Seed page-access permissions for every role.
-- Permission keys use the "page:<slug>" convention consumed by the sidebar + route guards.
DO $$
DECLARE
  page_keys text[] := ARRAY[
    'page:dashboard','page:leads','page:trips','page:proposals','page:payments','page:crm',
    'page:comercial_matriz','page:comercial_suppliers','page:partners',
    'page:admin_users','page:admin_permissions','page:admin_settings',
    'page:admin_integrations','page:admin_kpi','page:admin_logs','page:agents'
  ];
  k text;
BEGIN
  -- super_admin & admin get every page
  FOREACH k IN ARRAY page_keys LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('super_admin', k, true)
      ON CONFLICT (role, permission) DO NOTHING;
    INSERT INTO public.permissions (role, permission, granted) VALUES ('admin', k, true)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- sales_agent
  FOREACH k IN ARRAY ARRAY['page:dashboard','page:leads','page:trips','page:proposals','page:payments','page:crm','page:agents'] LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('sales_agent', k, true)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;
  -- Explicit denies for sales_agent
  FOREACH k IN ARRAY ARRAY['page:comercial_matriz','page:comercial_suppliers','page:partners','page:admin_users','page:admin_permissions','page:admin_settings','page:admin_integrations','page:admin_kpi','page:admin_logs'] LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('sales_agent', k, false)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- operations_agent
  FOREACH k IN ARRAY ARRAY['page:dashboard','page:leads','page:trips','page:crm','page:agents'] LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('operations_agent', k, true)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['page:proposals','page:payments','page:comercial_matriz','page:comercial_suppliers','page:partners','page:admin_users','page:admin_permissions','page:admin_settings','page:admin_integrations','page:admin_kpi','page:admin_logs'] LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('operations_agent', k, false)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- finance
  FOREACH k IN ARRAY ARRAY['page:dashboard','page:payments','page:admin_kpi'] LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('finance', k, true)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['page:leads','page:trips','page:proposals','page:crm','page:comercial_matriz','page:comercial_suppliers','page:partners','page:admin_users','page:admin_permissions','page:admin_settings','page:admin_integrations','page:admin_logs','page:agents'] LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('finance', k, false)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- b2b_manager
  FOREACH k IN ARRAY ARRAY['page:dashboard','page:partners','page:proposals'] LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('b2b_manager', k, true)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['page:leads','page:trips','page:payments','page:crm','page:comercial_matriz','page:comercial_suppliers','page:admin_users','page:admin_permissions','page:admin_settings','page:admin_integrations','page:admin_kpi','page:admin_logs','page:agents'] LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('b2b_manager', k, false)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

  -- viewer (lowest tier) – only dashboard
  INSERT INTO public.permissions (role, permission, granted) VALUES ('viewer', 'page:dashboard', true)
    ON CONFLICT (role, permission) DO NOTHING;
  FOREACH k IN ARRAY ARRAY['page:leads','page:trips','page:proposals','page:payments','page:crm','page:comercial_matriz','page:comercial_suppliers','page:partners','page:admin_users','page:admin_permissions','page:admin_settings','page:admin_integrations','page:admin_kpi','page:admin_logs','page:agents'] LOOP
    INSERT INTO public.permissions (role, permission, granted) VALUES ('viewer', k, false)
      ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;
END $$;

-- Allow every authenticated user to read the permissions matrix (needed so the sidebar/route guards can filter).
-- Writes remain restricted to admins via the existing "Admins can manage permissions" policy.
DROP POLICY IF EXISTS "Authenticated can read permissions" ON public.permissions;
CREATE POLICY "Authenticated can read permissions"
ON public.permissions FOR SELECT
TO authenticated
USING (true);
