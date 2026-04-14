# Pending Database Implementations

Run each SQL block in your Supabase SQL Editor in the order listed.

---

## 1 — work_sessions table

Tracks each individual work/break/off-site segment per staff member per day.

```sql
CREATE TABLE public.work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('work', 'break', 'off-site')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage own sessions" ON public.work_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.work_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.work_sessions;
```

---

## 2 — staff_contracts table

Stores contracted hours per day and grace period per staff member.

```sql
CREATE TABLE public.staff_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contracted_hours DECIMAL(4,2) NOT NULL DEFAULT 8.0,
  grace_minutes INTEGER NOT NULL DEFAULT 15,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own contract" ON public.staff_contracts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all contracts" ON public.staff_contracts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_staff_contracts_updated_at
  BEFORE UPDATE ON public.staff_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## 3 — school_calendar table

Stores holidays, early closures, no-school days and general events.

```sql
CREATE TABLE public.school_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  end_date DATE,
  type TEXT NOT NULL DEFAULT 'event' CHECK (type IN ('holiday', 'early_closure', 'no_school', 'event')),
  expected_hours DECIMAL(4,2),
  color TEXT DEFAULT '#3b82f6',
  google_event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.school_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view calendar" ON public.school_calendar
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage calendar" ON public.school_calendar
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_school_calendar_updated_at
  BEFORE UPDATE ON public.school_calendar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## 4 — location_pings table

Stores periodic GPS pings from staff during active work sessions.

```sql
CREATE TABLE public.location_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  distance_from_school DOUBLE PRECISION,
  is_outside_radius BOOLEAN NOT NULL DEFAULT false,
  location_available BOOLEAN NOT NULL DEFAULT true,
  pinged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can insert own pings" ON public.location_pings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all pings" ON public.location_pings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

---

## 5 — notifications tables

Required for the broadcast notification system.

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  audience_summary TEXT,
  recipient_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (notification_id, user_id)
);

CREATE TABLE public.notification_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view notifications sent to them" ON public.notifications
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.notification_recipients
      WHERE notification_id = notifications.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own recipient records" ON public.notification_recipients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own statuses" ON public.notification_statuses
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

---

## 6 — profiles: add department and shift_name columns

Required for broadcast targeting by department/shift.

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS shift_name TEXT;
```

---

## 7 — google_calendar_tokens table

Stores OAuth tokens for Google Calendar sync per admin user.

```sql
CREATE TABLE public.google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,
  calendar_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tokens" ON public.google_calendar_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## Edge Functions to Deploy

```sh
npx supabase functions deploy clock-in
npx supabase functions deploy daily-alert
npx supabase functions deploy manage-staff
npx supabase functions deploy broadcast-notification
npx supabase functions deploy google-calendar-sync
npx supabase functions deploy location-ping
```

---

## Google Calendar Setup

1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable the **Google Calendar API**
4. Go to APIs & Services → Credentials → Create OAuth 2.0 Client ID
5. Application type: **Web application**
6. Authorised redirect URIs: add `https://your-app-domain.com/admin/calendar`
7. Copy the Client ID → add to `.env` as `VITE_GOOGLE_CLIENT_ID`
8. Copy the Client Secret → add as Supabase secrets:

```sh
npx supabase secrets set GOOGLE_CLIENT_ID=your_client_id
npx supabase secrets set GOOGLE_CLIENT_SECRET=your_client_secret
```

9. Deploy the edge function:
```sh
npx supabase functions deploy google-calendar-sync
```

10. In the app, go to Admin → School Calendar → sidebar → Connect Google Calendar

---

## Activation Checklist (Google Calendar)

Complete these steps in order before clicking "Connect Google Calendar" in the app:

- [ ] 1. Go to https://console.cloud.google.com and sign in with the school's Google account
- [ ] 2. Create a new project named e.g. "School Staff Tracker"
- [ ] 3. In the left menu go to **APIs & Services → Library**, search for **Google Calendar API** and click **Enable**
- [ ] 4. Go to **APIs & Services → OAuth consent screen**
  - User type: **External**
  - Fill in app name, support email, developer email
  - Add scope: `https://www.googleapis.com/auth/calendar`
  - Add your admin email as a test user
  - Save and continue
- [ ] 5. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
  - Application type: **Web application**
  - Name: e.g. "School Staff Tracker Web"
  - Authorised JavaScript origins: `https://your-app-domain.com`
  - Authorised redirect URIs: `https://your-app-domain.com/admin/calendar`
  - Click **Create** and copy the **Client ID** and **Client Secret**
- [ ] 6. Add Client ID to your `.env` file:
  ```
  VITE_GOOGLE_CLIENT_ID=your_client_id_here
  ```
- [ ] 7. Add both secrets to Supabase:
  ```sh
  npx supabase secrets set GOOGLE_CLIENT_ID=your_client_id_here
  npx supabase secrets set GOOGLE_CLIENT_SECRET=your_client_secret_here
  ```
- [ ] 8. Apply migration 7 (google_calendar_tokens table) in Supabase SQL Editor
- [ ] 9. Deploy the edge function:
  ```sh
  npx supabase functions deploy google-calendar-sync
  ```
- [ ] 10. Rebuild and redeploy the frontend so the new `VITE_GOOGLE_CLIENT_ID` env var is picked up
- [ ] 11. Log in as admin, go to **School Calendar**, click **Connect Google Calendar** in the sidebar
- [ ] 12. Complete the Google sign-in flow — a "School Attendance" calendar will be created automatically
- [ ] 13. Click **Sync Now** to push all existing school events to Google Calendar

> **Note:** While the app is in Google's "Testing" mode, only accounts listed as test users can connect.
> To allow any Google account, submit the app for verification in the OAuth consent screen.
