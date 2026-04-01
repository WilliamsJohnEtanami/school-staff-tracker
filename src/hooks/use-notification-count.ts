import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMissingPublicTableError } from "@/lib/supabase-errors";

export const useNotificationCount = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    setLoading(true);

    const [notifRes, statusRes] = await Promise.all([
      supabase.from("notifications").select("id"),
      supabase
        .from("notification_statuses")
        .select("notification_id,read")
        .eq("user_id", user.id),
    ]);

    if (notifRes.error) {
      setLoading(false);
      setUnreadCount(0);
      return;
    }

    if (statusRes.error && !isMissingPublicTableError(statusRes.error, "notification_statuses")) {
      setLoading(false);
      setUnreadCount(0);
      return;
    }

    const statuses = new Map<string, boolean>();
    (statusRes.data ?? []).forEach((row) => {
      statuses.set(row.notification_id, row.read);
    });

    const count = (notifRes.data ?? []).reduce((acc, notif) => {
      const read = statuses.get(notif.id) ?? false;
      return acc + (read ? 0 : 1);
    }, 0);

    setUnreadCount(count);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    const channel = supabase
      .channel("notifications_count")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, fetchUnreadCount)
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_statuses" }, fetchUnreadCount)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnreadCount]);

  return { unreadCount, loading, refresh: fetchUnreadCount };
};
