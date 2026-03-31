# FILES REQUIRING FIXES - PRIORITIZED LIST

**Date**: March 31, 2026  
**Total Files to Fix**: 7 (Database migrations + Frontend)  

---

## PRIORITY 1: DATABASE MIGRATIONS (MUST FIX)

### ✅ Run These Migrations
These are the CORRECT migrations that should be applied:

#### 1. [supabase/migrations/20260327000000_fix_notifications_realtime.sql](supabase/migrations/20260327000000_fix_notifications_realtime.sql)

**Status**: ✅ KEEP - Uses safe approach

**Why**: 
- Uses `CREATE TABLE IF NOT EXISTS` instead of DROP
- Non-destructive to schema cache
- Idempotent (safe to run multiple times)

**What it fixes**:
- Recreates notifications table safely
- Adds realtime publication
- Recreates RLS policies correctly

**Action**: Ensure this runs: `supabase db push`

---

#### 2. [supabase/migrations/20260327000001_complete_attendance_rls.sql](supabase/migrations/20260327000001_complete_attendance_rls.sql)

**Status**: ✅ KEEP - Uses safe approach

**Why**:
- Uses DO blocks with IF NOT EXISTS for policies
- Won't fail if policy already exists
- Safer than destructive DROP approach

**What it fixes**:
- All attendance RLS policies
- User can view own attendance
- Admin can view all attendance
- Attendance table published to realtime

**Action**: Ensure this runs: `supabase db push`

---

### ⚠️ SKIP/DELETE These Migrations
These are PROBLEMATIC and should NOT run (or should be deleted):

#### 1. [supabase/migrations/20260326000000_fix_notifications_schema.sql](supabase/migrations/20260326000000_fix_notifications_schema.sql)

**Status**: ❌ DELETE - Causes schema cache error

**Lines 4-6** (PROBLEMATIC):
```sql
DROP TABLE IF EXISTS public.notification_statuses CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
```

**Why it's bad**:
- Drops tables breaking Supabase schema cache
- Causes "relation not found" errors in client
- Schema introspection becomes stale
- Migration 20260327000000 is the better fix

**Action**: 
- Option 1: Delete this file entirely (safest)
- Option 2: Comment out the DROP statements if you want to keep history

---

#### 2. [supabase/migrations/20260326000001_fix_realtime_attendance.sql](supabase/migrations/20260326000001_fix_realtime_attendance.sql)

**Status**: ⚠️ SKIP - Uses unsafe DROP pattern

**Lines 8-16** (PROBLEMATIC):
```sql
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can update own attendance (clock out)" ON public.attendance;
DROP POLICY IF EXISTS "Service role can insert attendance" ON public.attendance;
```

**Why it's problematic**:
- Drops 7 policies sequentially
- If ANY CREATE fails after drop = all policies are gone
- RLS will block all access (silent failure)
- Migration 20260327000001 is safer

**Action**:
- Skip this one - 20260327000001 handles it better
- If already applied, don't worry - 20260327000001 will fix it

---

## PRIORITY 2: FRONTEND ERROR REPORTING

### 1. [src/components/NotificationsPanel.tsx](src/components/NotificationsPanel.tsx)

**Status**: 🟠 NEEDS UPDATE - Silent error handling

**Current Code - Lines 74-82**:
```typescript
if (notifRes.error) {
  const notFound = notifRes.error.message.toLowerCase().includes("relation \"public.notifications\" does not exist") || notifRes.error.code === "42P01";
  const errorMsg = notFound 
    ? "Notifications table not found. Please run database migrations: supabase db push"
    : `Error loading notifications: ${notifRes.error.message}`;
  setSchemaError(errorMsg);  // ← Set but never displayed!
  setNotifications(DEMO_NOTIFICATIONS.length > 0 ? DEMO_NOTIFICATIONS : []);
  setStatuses({});
  setLoading(false);
  return;  // ← Returns without showing error
}
```

**Problem**: 
- Error set to state but never rendered
- User sees demo notifications instead of error
- User has NO idea feature is broken

**Fix Required**:
```typescript
if (notifRes.error) {
  const isDatabaseError = notifRes.error.code === "42P01" || 
    notifRes.error.message.includes("does not exist");
  
  toast({
    title: "⚠️ Notifications Unavailable",
    description: isDatabaseError 
      ? "Run migrations: supabase db push"
      : notifRes.error.message,
    variant: "destructive"
  });
  
  setNotifications([]);  // Empty, not demo data
  setStatuses({});
  setLoading(false);
  return;
}
```

**Lines to Change**: 74-82

---

### 2. [src/hooks/use-notifications.tsx](src/hooks/use-notifications.tsx)

**Status**: 🟠 NEEDS UPDATE - Silent error handling

**Current Code - Lines 73-83**:
```typescript
if (statusRes.error) {
  // Don't show error for missing notification_statuses table - just treat as empty
  const notFound = statusRes.error.message.toLowerCase().includes("relation \"public.notification_statuses\" does not exist") || statusRes.error.code === "42P01";
  if (!notFound) {
    console.warn("Notification statuses query error:", statusRes.error);
  }
  // Silently sets empty state
  setStatuses({});
}
```

**Problem**:
- Error silently caught and ignored
- If table is missing, user doesn't know
- Error only in console (user won't see)

**Fix Required**:
```typescript
if (statusRes.error) {
  const isTableMissing = statusRes.error.code === "42P01";
  
  // Always log for debugging
  console.error("Notification statuses error:", {
    message: statusRes.error.message,
    code: statusRes.error.code,
    isTableMissing
  });
  
  // If table missing, it will exist after migration
  // For now, just treat as empty
  setStatuses({});
}
```

**Lines to Change**: 73-83

---

### 3. [src/pages/admin/Dashboard.tsx](src/pages/admin/Dashboard.tsx)

**Status**: 🟠 NEEDS UPDATE - Generic error messages

**Current Code - Lines 85-88**:
```typescript
if (attRes.error) {
  console.error("Attendance fetch error:", attRes.error);
  toast({ title: "Error", description: "Failed to load attendance records", variant: "destructive" });
}
```

**Problem**:
- Generic error message "Failed to load"
- Doesn't tell admin WHY it failed
- Could be: RLS blocked, table missing, network error, etc.
- Admin has no way to diagnose

**Fix Required**:
```typescript
if (attRes.error) {
  let description = "Failed to load attendance records";
  
  if (attRes.error.code === "42P01") {
    description = "Attendance table not found - run: supabase db push";
  } else if (attRes.error.message.includes("policy")) {
    description = "You don't have permission to view attendance - check admin role";
  } else if (attRes.error.message.includes("permission")) {
    description = "Permission denied - verify your admin access";
  } else {
    description = attRes.error.message;
  }
  
  toast({ 
    title: "⚠️ Error Loading Attendance", 
    description,
    variant: "destructive" 
  });
  
  console.error("Attendance fetch error:", attRes.error);
}
```

**Lines to Change**: 85-88

---

#### Also in Dashboard.tsx - Real-Time Connection Status

**Current Code - Lines 134-136**:
```typescript
.subscribe((status) => {
  console.log("Realtime subscription status:", status);
  if (status === "CLOSED") {
    console.warn("Realtime connection closed, will retry on next action");
  }
});
```

**Problem**:
- Connection status only in console
- User doesn't know real-time died
- Dashboard appears up-to-date but is stale

**Fix Required**:
```typescript
.subscribe((status) => {
  if (status === "CLOSED") {
    toast({
      title: "⚠️ Live Updates Paused",
      description: "Real-time connection lost - trying to reconnect...",
      variant: "warning"
    });
  } else if (status === "CHANNEL_ERROR") {
    toast({
      title: "❌ Connection Error",
      description: "Failed to connect to real-time updates",
      variant: "destructive"
    });
  }
  console.log("Realtime subscription status:", status);
});
```

**Lines to Change**: 134-136

---

### 4. [src/pages/admin/Dashboard.tsx](src/pages/admin/Dashboard.tsx) - Add Verification

**Status**: 🟠 NEEDS NEW CODE - Verify admin role

**Add on Component Mount**:
```typescript
useEffect(() => {
  // Verify admin user has admin role assigned
  const verifyAdminAccess = async () => {
    if (!user?.id) return;
    
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const hasAdminRole = roles?.some(r => r.role === "admin");
    
    if (!hasAdminRole) {
      toast({
        title: "⚠️ Admin Role Not Assigned",
        description: "Your account doesn't have admin role. You may not see any data.",
        variant: "warning"
      });
    }
  };
  
  verifyAdminAccess();
}, [user?.id]);
```

**Where to Add**: In the component, after useEffect that sets up realtime, around line 160

---

## PRIORITY 3: VERIFICATION SCRIPTS

### Database Verification Queries

**File**: Create file [VERIFICATION_QUERIES.sql](VERIFICATION_QUERIES.sql)

**Content**:
```sql
-- Run these in Supabase SQL Editor to verify database state

-- 1. Check migrations applied
SELECT migration_name FROM supabase_migrations_table 
WHERE migration_name LIKE '202603%' 
ORDER BY migration_name DESC;
-- Should include: 20260327000000, 20260327000001

-- 2. Verify notifications table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'notifications'
) AS notifications_exists;
-- Should be: true

-- 3. Verify notification_statuses table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'notification_statuses'
) AS notification_statuses_exists;
-- Should be: true

-- 4. Check attendance table columns
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'attendance' 
ORDER BY ordinal_position;
-- Should have: clock_out, browser, operating_system columns from v2

-- 5. Check for unwanted tables
SELECT * FROM information_schema.tables 
WHERE table_name IN ('attendance_old', 'attendance_wrong_structure');
-- Should be: EMPTY (no old tables)

-- 6. Verify admin role exists
SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin';
-- Should be: >= 1

-- 7. Check attendance RLS policies
SELECT policyname, permissive FROM pg_policies 
WHERE tablename = 'attendance' 
ORDER BY policyname;
-- Should have exactly 4:
--   - Admins can view all attendance
--   - Users can view own attendance
--   - Users can update own attendance
--   - Staff can update own attendance (clock out)

-- 8. Verify has_role function
SELECT COUNT(*) FROM pg_proc WHERE proname = 'has_role';
-- Should be: 1

-- 9. Check realtime publications
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('attendance', 'notifications');
-- Should have: attendance, notifications
```

**Action**: Save and run these queries to verify database state

---

## SUMMARY MATRIX

| File | Type | Issue | Fix Type | Priority |
|------|------|-------|----------|----------|
| 20260326000000_fix_notifications_schema.sql | Migration | Destructive DROP | DELETE | 🔴 CRITICAL |
| 20260326000001_fix_realtime_attendance.sql | Migration | Unsafe pattern | SKIP | 🟠 HIGH |
| 20260327000000_fix_notifications_realtime.sql | Migration | OK | RUN | ✅ DEPLOY |
| 20260327000001_complete_attendance_rls.sql | Migration | OK | RUN | ✅ DEPLOY |
| NotificationsPanel.tsx | Frontend | Silent error | UPDATE | 🟠 HIGH |
| use-notifications.tsx | Frontend | Silent catch | UPDATE | 🟠 HIGH |
| Dashboard.tsx (error handling) | Frontend | Generic message | UPDATE | 🟠 HIGH |
| Dashboard.tsx (realtime) | Frontend | Console-only | UPDATE | 🟠 HIGH |
| Dashboard.tsx (verification) | Frontend | Missing check | ADD | 🟠 HIGH |

---

## DEPLOYMENT STEPS

### Step 1: Database
```bash
# Applies migrations 20260327000000 and 20260327000001
supabase db push

# Regenerate schema types
supabase gen types typescript --local
```

### Step 2: Verify Database State
```bash
# Run verification queries in Supabase dashboard
# See VERIFICATION_QUERIES.sql above
```

### Step 3: Frontend Code Changes
- Update NotificationsPanel.tsx (3 files)
- Add admin role verification

### Step 4: Test
```bash
# Test clock-in flow
# Test notifications
# Check real-time updates
```

---

## FILES NOT REQUIRING CHANGES

✅ These files are CORRECT:
- [src/pages/StaffDashboard.tsx](src/pages/StaffDashboard.tsx) - Real-time listeners are correct
- [supabase/functions/clock-in/index.ts](supabase/functions/clock-in/index.ts) - Uses serviceRoleKey correctly
- [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts) - Realtime config is correct
- All other edge functions - serviceRoleKey usage is correct

