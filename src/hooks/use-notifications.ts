import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getNotificationSystemErrorMessage,
  isMissingPublicTableError,
} from "@/lib/supabase-errors";

type NotificationRow = {
  audience_summary: string | null;
  audience_type: string;
  id: string;
  title: string;
  message: string;
  created_by: string | null;
  created_at: string;
  recipient_count: number;
};

export type NotificationFeedItem = NotificationRow & {
  read: boolean;
};

export const useNotifications = (userIdOverride?: string | null) => {
  const { user } = useAuth();
  const userId = userIdOverride ?? user?.id ?? null;

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setStatuses({});
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [notifRes, statusRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("id,title,message,created_by,created_at,audience_type,audience_summary,recipient_count")
          .order("created_at", { ascending: false }),
        supabase
          .from("notification_statuses")
          .select("notification_id,read")
          .eq("user_id", userId),
      ]);

      if (notifRes.error) {
        setNotifications([]);
        setStatuses({});
        setError(getNotificationSystemErrorMessage(notifRes.error));
        setLoading(false);
        return;
      }

      const nextStatuses: Record<string, boolean> = {};

      if (statusRes.error) {
        if (!isMissingPublicTableError(statusRes.error, "notification_statuses")) {
          console.warn("Notification statuses query error:", statusRes.error);
        }
      } else {
        (statusRes.data ?? []).forEach((statusRow) => {
          nextStatuses[statusRow.notification_id] = statusRow.read;
        });
      }

      setNotifications(notifRes.data ?? []);
      setStatuses(nextStatuses);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load notifications.";
      setNotifications([]);
      setStatuses({});
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId || statuses[notificationId]) {
      return false;
    }

    const { error: updateError } = await supabase.from("notification_statuses").upsert(
      {
        notification_id: notificationId,
        user_id: userId,
        read: true,
      },
      { onConflict: "notification_id,user_id" }
    );

    if (updateError) {
      if (!isMissingPublicTableError(updateError, "notification_statuses")) {
        console.warn("Unable to mark notification as read:", updateError);
      }
      return false;
    }

    setStatuses((current) => ({ ...current, [notificationId]: true }));
    return true;
  }, [statuses, userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) {
      return false;
    }

    const unreadRows = notifications.filter((notification) => !statuses[notification.id]);
    if (!unreadRows.length) {
      return true;
    }

    const { error: updateError } = await supabase.from("notification_statuses").upsert(
      unreadRows.map((notification) => ({
        notification_id: notification.id,
        user_id: userId,
        read: true,
      })),
      { onConflict: "notification_id,user_id" }
    );

    if (updateError) {
      if (!isMissingPublicTableError(updateError, "notification_statuses")) {
        console.warn("Unable to mark all notifications as read:", updateError);
      }
      return false;
    }

    setStatuses((current) => {
      const next = { ...current };
      unreadRows.forEach((notification) => {
        next[notification.id] = true;
      });
      return next;
    });

    return true;
  }, [notifications, statuses, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    fetchNotifications();

    const channel = supabase
      .channel(`notifications_feed_${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, fetchNotifications)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_recipients",
          filter: `user_id=eq.${userId}`,
        },
        fetchNotifications
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_statuses",
          filter: `user_id=eq.${userId}`,
        },
        fetchNotifications
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, userId]);

  const notificationsWithRead = useMemo<NotificationFeedItem[]>(
    () =>
      notifications.map((notification) => ({
        ...notification,
        read: statuses[notification.id] === true,
      })),
    [notifications, statuses]
  );

  const unread = useMemo(
    () => notificationsWithRead.filter((notification) => !notification.read),
    [notificationsWithRead]
  );

  return {
    notifications: notificationsWithRead,
    unread,
    unreadCount: unread.length,
    loading,
    error,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
};
