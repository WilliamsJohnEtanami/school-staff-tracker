-- Repair admin bootstrap behavior after moving to a new Supabase project.
-- This keeps admin@school.edu attached to an app profile and admin role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    'active'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = now();

  IF lower(COALESCE(NEW.email, '')) = 'admin@school.edu' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  admin_user_id uuid;
  admin_name text;
BEGIN
  SELECT
    id,
    COALESCE(raw_user_meta_data->>'name', email)
  INTO admin_user_id, admin_name
  FROM auth.users
  WHERE lower(email) = 'admin@school.edu'
  ORDER BY created_at ASC
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, name, email, status)
    VALUES (admin_user_id, admin_name, 'admin@school.edu', 'active')
    ON CONFLICT (user_id) DO UPDATE
    SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      status = 'active',
      updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END
$$;
