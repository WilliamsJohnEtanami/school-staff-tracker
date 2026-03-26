# Real-Time Attendance Sync Fix - Action Plan

## Problem Identified
Staff clock-in/break records are being inserted into the database by the edge function but NOT appearing on the admin dashboard in real-time, even though:
- The dashboard has a real-time listener set up
- RLS policies allow admins to view all attendance
- The `has_role()` function is defined and working

## Root Cause
The issue is likely a **combined problem of three factors**:

1. **RLS Policy Evaluation**: The original RLS policy used `public.has_role(auth.uid(), 'admin')` which requires the `has_role` function to be SECURITY DEFINER. While it's defined, the new policy uses an EXISTS check that is more explicit and doesn't depend on the function behavior.

2. **Real-Time Publication**: The attendance table needs to be explicitly added to the `supabase_realtime` publication for real-time subscriptions to work.

3. **Admin User Roles**: The admin user must have an entry in the `user_roles` table with `role = 'admin'` for the RLS policy to grant access.

## Solution Implemented

Created migration: `supabase/migrations/20260326000001_fix_realtime_attendance.sql`

This migration:
- ✅ Drops old RLS policies to prevent conflicts
- ✅ Creates new explicit RLS policy: `EXISTS (SELECT FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')`
- ✅ Ensures `supabase_realtime` publication includes the attendance table
- ✅ Creates performance indexes on frequently queried columns
- ✅ Keeps RLS enabled for security

## Immediate Action Items

### 1. Apply the Migration (CRITICAL)
Execute in Supabase SQL Editor:
```sql
-- Run the migration file
-- supabase/migrations/20260326000001_fix_realtime_attendance.sql
```

OR from terminal:
```bash
npx supabase db push
```

### 2. Verify Admin Role Assignment
Check if your admin user has the `admin` role:
```sql
SELECT * FROM public.user_roles WHERE role = 'admin';
```

If no admins exist, the setup-admin edge function needs to be called to create the first admin.

### 3. Clear Browser Cache & Reload
- Open Developer Tools (F12)
- Refresh the page with hard cache clear (Ctrl+Shift+R)
- Check console for "Attendance change detected" logs

### 4. Test Real-Time Updates
1. **Open admin dashboard** and keep Developer Tools console open
2. **Clock in as staff** from another device/browser
3. **Watch for logs** in admin console showing: `Attendance change detected: {...}`
4. **Verify** the records appear on the dashboard immediately

## Code References

**Dashboard Real-Time Listener** (src/pages/admin/Dashboard.tsx):
```tsx
const channel = supabase
  .channel("attendance-realtime-dash")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "attendance" },
    (payload) => {
      console.log("Attendance change detected:", payload);
      fetchData();
    }
  )
  .subscribe((status) => {
    console.log("Realtime subscription status:", status);
  });
```

**Clock-In Edge Function** (supabase/functions/clock-in/index.ts):
- Uses `service_role_key` to bypass RLS
- Inserts to `attendance` table with `user_id, staff_name, status, etc.`
- Creates both `timestamp` and `created_at` (auto-set to NOW())

**Setup Functions**:
- `setup-admin` edge function: Creates admin user and assigns `admin` role
- `manage-staff` edge function: Creates staff user and assigns `staff` role

## Expected Behavior After Fix

✅ Staff clock-in → Edge function inserts record  
✅ Admin dashboard real-time listener → Receives postgres_changes event  
✅ Dashboard console → Logs "Attendance change detected"  
✅ Dashboard table → Refreshes with new attendance record  
✅ Admin stats → Updated immediately with present/late/break counts  

## Troubleshooting If Still Not Working

If clock-in still doesn't appear after migration:

1. **Check real-time subscription status**:
   - Open admin dashboard → F12 → Console
   - Look for `Realtime subscription status: SUBSCRIBED`
   - If status is CLOSED/FAILED, there's a subscription issue

2. **Verify RLS isn't blocking the read**:
   - In Supabase SQL Editor, run as admin user:
     ```sql
     SELECT * FROM public.attendance LIMIT 10;
     ```
   - If this returns no results, the RLS policy is too restrictive

3. **Check if attendance table was published**:
   ```sql
   SELECT * FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' 
   AND tablename = 'attendance';
   ```
   - Should return one row

4. **Verify admin role exists**:
   ```sql
   SELECT * FROM public.user_roles 
   WHERE user_id = auth.uid() AND role = 'admin';
   ```
   - Must return at least one row for current admin user

## Files Modified

- ✅ `supabase/migrations/20260326000000_fix_notifications_schema.sql` (already created - needs db push)
- ✅ `supabase/migrations/20260326000001_fix_realtime_attendance.sql` (just created - needs db push)

## Next Steps

1. Push migrations to Supabase: `npx supabase db push`
2. Verify admin role exists or create via setup-admin edge function
3. Test clock-in with browser console open
4. Confirm "Attendance change detected" logs appear on admin dashboard
5. Verify staff attendance records display in real-time
