# CRITICAL FIXES - DEPLOYMENT GUIDE

## Issues Fixed

### 1. **Real-Time Synchronization** ✅
- **Problem**: Staff clock-in not appearing on admin dashboard
- **Root Cause**: Admin didn't have SELECT RLS policy on attendance table initially
- **Fix**: New migrations ensure complete RLS policies and realtime publication

### 2. **Notifications "Table Not Found" Error** ✅
- **Problem**: Admin seeing "Could not find table 'public.notifications'" error
- **Root Cause**: Migration was dropping and recreating the table, causing schema cache issues
- **Fix**: New migration (`20260327000000_fix_notifications_realtime.sql`) uses non-destructive approach with `CREATE TABLE IF NOT EXISTS`

### 3. **Manual Notifications Failing** ✅
- **Problem**: Reminders edge function failing with "failed to send a request to the edge function"
- **Root Cause**: Reminders function was using authenticated user auth, but insertion requires admin role. Service role should bypass RLS.
- **Fix**: Updated `reminders/index.ts` to use `serviceRoleKey` for notifications insertion

### 4. **Admin Setup Button Visible** ✅
- **Problem**: User seeing confusing "Admin Setup" and "Checking..." buttons on landing page
- **Fix**: Removed these buttons from Landing.tsx - they were properly guarded but confusing

### 5. **Realtime Settings** ✅
- **Problem**: Realtime updates not working reliably
- **Fix**: Updated Supabase client configuration with realtime parameters

## Deployment Steps

### **STEP 1: Push Database Migrations**

The fixes include TWO new migrations that must be applied:

```bash
cd /path/to/school-staff-tracker
supabase db push
```

**New migrations added:**
- `supabase/migrations/20260327000000_fix_notifications_realtime.sql` - Fixes notifications table with non-destructive approach
- `supabase/migrations/20260327000001_complete_attendance_rls.sql` - Ensures attendance has complete RLS policies

**What these migrations do:**
- ✅ Creates/verifies `notifications` table exists (non-destructive)
- ✅ Creates/verifies `notification_statuses` table exists  
- ✅ Adds COMPLETE RLS policies for staff and admins
- ✅ Publishes attendance, notifications, and notification_statuses to realtime
- ✅ Creates proper indexes for performance
- ✅ Adds duplicate attendance check trigger

### **STEP 2: Deploy Edge Functions**

Update the reminders function and redeploy all edge functions:

```bash
supabase functions deploy clock-in
supabase functions deploy reminders
supabase functions deploy daily-alert
supabase functions deploy setup-admin
supabase functions deploy manage-staff
```

Or use auto-deployment if configured.

### **STEP 3: Deploy Frontend Changes**

The frontend has these changes:
- ✅ Fixed `StaffDashboard.tsx` - now calls clock-in edge function
- ✅ Improved admin dashboard error handling
- ✅ Better Supabase client configuration
- ✅ Improved NotificationsPanel error messages
- ✅ Removed confusing admin setup button from Landing

```bash
npm run build
# Deploy to Vercel or your hosting
git push
```

### **STEP 4: Verify Setup**

After deployment, verify everything works:

1. **Check Admin Account Exists**
   - Go to Supabase Dashboard → SQL Editor
   - Run: 
   ```sql
   SELECT * FROM public.user_roles WHERE role = 'admin';
   ```
   - Should return at least one row
   - If not, admin account needs to be created (see step 5)

2. **Check Realtime is Enabled**
   - Go to Supabase Dashboard → SQL Editor
   - Run:
   ```sql
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```
   - Should show: `attendance`, `notifications`, `notification_statuses`

3. **Test Clock-In**
   - Login as staff
   - Click "Clock In"
   - Should appear on admin dashboard within 1-2 seconds

4. **Test Notifications**
   - Login as admin
   - Go to Admin Dashboard
   - Click "Send Broadcast"
   - Check staff dashboard - notification should appear within 1-2 seconds

### **STEP 5: Create Admin Account (If Needed)**

If the admin account doesn't exist:

1. **Option A: Via Edge Function (Not exposed in UI)**
   - Admin account can only be created via the `setup-admin` function initially
   - Email: `admin@school.edu`
   - Password: `admin123`

2. **Option B: Manually in Supabase**
   - Go to Supabase Dashboard → Authentication
   - Create a new user with email: `admin@school.edu`, password: `admin123`
   - Then in SQL Editor, run:
   ```sql
   -- Insert into profiles
   INSERT INTO public.profiles (user_id, name, email, status)
   VALUES ((SELECT id FROM auth.users WHERE email = 'admin@school.edu'), 'Admin', 'admin@school.edu', 'active');

   -- Insert into user_roles  
   INSERT INTO public.user_roles (user_id, role)
   VALUES ((SELECT id FROM auth.users WHERE email = 'admin@school.edu'), 'admin');
   ```

## What Changed in the Code

### **Reminders Edge Function** (`supabase/functions/reminders/index.ts`)
- ✅ Now uses `serviceRoleKey` for notifications insertion
- ✅ Better error logging and messages
- ✅ Returns proper error responses with status codes

### **Staff Dashboard** (`src/pages/StaffDashboard.tsx`)
- ✅ Calls clock-in edge function with GPS verification
- ✅ Real-time listener for attendance changes
- ✅ Real-time listener for notifications
- ✅ Displays actual database data instead of mock data

### **Admin Dashboard** (`src/pages/admin/Dashboard.tsx`)
- ✅ Better error handling for data fetches
- ✅ Improved realtime subscription logging
- ✅ Broadcast notifications enabled

### **Notifications Panel** (`src/components/NotificationsPanel.tsx`)
- ✅ Better error messages that include migration instructions
- ✅ Graceful fallback if tables don't exist
- ✅ Real-time listener for new notifications

### **Supabase Client** (`src/integrations/supabase/client.ts`)
- ✅ Added realtime configuration with event throttling

### **Landing Page** (`src/pages/Landing.tsx`)
- ✅ Removed confusing "Admin Setup" and "Checking..." buttons

## Testing Checklist

- [ ] Staff can clock in via clock-in button
- [ ] Clock-in appears on admin dashboard within 2 seconds
- [ ] Admin can send broadcast notification
- [ ] Notification appears on staff dashboard within 2 seconds
- [ ] Staff can clock out
- [ ] Clock-out time is saved in attendance record
- [ ] Admin can see all attendance records
- [ ] No "Could not find table" errors in production

## Troubleshooting

### "Could not find table 'public.notifications'"
- Run: `supabase db push --no-reset`
- Check migrations ran successfully

### Staff clock-in not appearing on admin
- Check browser console for errors
- Verify realtime is enabled: `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
- Check attendance RLS policy: `SELECT * FROM pg_policies WHERE tablename = 'attendance';`

### Notifications not sending
- Check edge function logs in Supabase
- Verify serviceRoleKey is set in env
- Check notifications table exists and has RLS policies

### Admin can't log in
- Verify admin user exists in auth.users with email admin@school.edu  
- Verify admin role exists in user_roles table
- Check profiles table has entry for admin user

## Support

If issues persist after deployment:
1. Check Supabase logs for edge function errors
2. Verify all migrations ran successfully
3. Check browser network tab for failed requests
4. Check Supabase realtime connection status in browser console
