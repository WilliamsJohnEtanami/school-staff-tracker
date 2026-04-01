import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getNotificationSystemErrorMessage, isMissingPublicTableError } from "@/lib/supabase-errors";

export type Notification = {
  id: string;
  title: string;
  message: string;
  created_by: string | null;
  created_at: string;
  read?: boolean;
};

export const useNotifications = (userId: string | null) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const { data: notifData, error: notifError } = await supabase
      .from("notifications")
      .select("id,title,message,created_by,created_at")
      .order("created_at", { ascending: false });

    if (notifError) {
      setError(getNotificationSystemErrorMessage(notifError));
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data: statusData, error: statusError } = await supabase
      .from("notification_statuses")
      .select("notification_id,read,user_id")
      .eq("user_id", userId);

    if (statusError && !isMissingPublicTableError(statusError, "notification_statuses")) {
      setError(getNotificationSystemErrorMessage(statusError));
      setNotifications([]);
      setLoading(false);
      return;
    }

    const statusByNotificationId = new Map<string, boolean>();
    (statusData ?? []).forEach((status) => {
      statusByNotificationId.set(status.notification_id, status.read);
    });

    const normalized: Notification[] = (notifData || []).map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      created_by: row.created_by,
      created_at: row.created_at,
      read: statusByNotificationId.get(row.id) ?? false,
    }));

    setNotifications(normalized);

    setLoading(false);
  }, [userId]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      const { error: stateError } = await supabase
        .from("notification_statuses")
        .upsert(
          { notification_id: notificationId, user_id: userId, read: true },
          { onConflict: "notification_id,user_id", returning: "minimal" }
        );

      if (stateError) {
        if (!isMissingPublicTableError(stateError, "notification_statuses")) {
          setError(getNotificationSystemErrorMessage(stateError));
        }
        return;
      }

      setNotifications((prev) => prev.map((notif) => (notif.id === notificationId ? { ...notif, read: true } : notif)));
    },
    [userId]
  );

  useEffect(() => {
    fetchNotifications();

    if (!userId) return;

    const notificationChannel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        fetchNotifications();
      })
      .subscribe();

    const statusChannel = supabase
      .channel("notification_statuses-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_statuses" }, (payload) => {
        if (payload.new?.user_id === userId || payload.old?.user_id === userId) {
          fetchNotifications();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [fetchNotifications, userId]);

  const unread = useMemo(() => notifications.filter((n) => !n.read), [notifications]);

  return { notifications, unread, loading, error, fetchNotifications, markAsRead };
};
