import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSchemaHealth } from "@/hooks/use-schema-health";
import {
  getFunctionErrorMessage,
  getNotificationSystemErrorMessage,
  isMissingPublicTableError,
} from "@/lib/supabase-errors";

export type Notification = {
  id: string;
  title: string;
  message: string;
  created_by: string | null;
  created_at: string;
};

export type NotificationStatus = {
  id: string;
  notification_id: string;
  user_id: string;
  read: boolean;
  updated_at: string;
};

const NotificationsPanel = ({ enableBroadcast = false }: { enableBroadcast?: boolean }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const schemaHealth = useSchemaHealth();
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const lastSchemaToast = useRef<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !statuses[n.id]).length,
    [notifications, statuses]
  );

  const reportSchemaError = useCallback((message: string) => {
    setSchemaError(message);

    if (lastSchemaToast.current !== message) {
      toast({ title: "Notification System Issue", description: message, variant: "destructive" });
      lastSchemaToast.current = message;
    }
  }, [toast]);

  const clearSchemaError = useCallback(() => {
    setSchemaError(null);
    lastSchemaToast.current = null;
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setSchemaError(null);

    try {
      // Fetch notifications
      const notifRes = await supabase
        .from("notifications")
        .select("id,title,message,created_by,created_at")
        .order("created_at", { ascending: false });

      if (notifRes.error) {
        const errorMsg = getNotificationSystemErrorMessage(notifRes.error);
        reportSchemaError(errorMsg);
        setNotifications([]);
        setStatuses({});
        setLoading(false);
        return;
      }

      const notifs = notifRes.data ?? [];
      setNotifications(notifs);

      // Try to fetch notification statuses - this table might not exist yet
      const statusRes = await supabase
        .from("notification_statuses")
        .select("notification_id,read")
        .eq("user_id", userId);

      if (statusRes.error) {
        // Don't show error for missing notification_statuses table - just treat as empty
        if (!isMissingPublicTableError(statusRes.error, "notification_statuses")) {
          console.warn("Notification statuses query error:", statusRes.error);
        }
        // Default to all notifications being unread if table doesn't exist
        setStatuses({});
      } else {
        const statusMap: Record<string, boolean> = {};
        (statusRes.data ?? []).forEach((status: any) => {
          statusMap[status.notification_id] = status.read;
        });
        setStatuses(statusMap);
      }

      lastSchemaToast.current = null;
    } catch (err: any) {
      reportSchemaError(`Failed to fetch notifications: ${err.message}`);
      setNotifications([]);
    }

    setLoading(false);
  }, [reportSchemaError, userId]);

  const setAsRead = async (notificationId: string) => {
    if (!userId) return;
    
    const { error } = await supabase.from("notification_statuses").upsert(
      {
        notification_id: notificationId,
        user_id: userId,
        read: true,
      },
      { onConflict: "notification_id,user_id" }
    );

    if (error) {
      if (!isMissingPublicTableError(error, "notification_statuses")) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      // Silently fail if table doesn't exist - user can still see notifications
      return;
    }

    setStatuses((prev) => ({ ...prev, [notificationId]: true }));
  };

  const markAllAsRead = async () => {
    if (!userId || notifications.length === 0) return;
    const upserts = notifications
      .filter((n) => !statuses[n.id])
      .map((n) => ({ notification_id: n.id, user_id: userId, read: true }));

    if (!upserts.length) return;

    const { error } = await supabase.from("notification_statuses").upsert(upserts, {
      onConflict: "notification_id,user_id",
    });

    if (error) {
      if (!isMissingPublicTableError(error, "notification_statuses")) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      // Silently fail if table doesn't exist
      return;
    }

    const newStatuses: Record<string, boolean> = {};
    upserts.forEach((u) => {
      newStatuses[u.notification_id] = true;
    });
    setStatuses((prev) => ({ ...prev, ...newStatuses }));
  };

  const broadcastNotification = useCallback(async () => {
    if (!userId) {
      toast({ title: "Error", description: "You must be signed in to broadcast.", variant: "destructive" });
      return;
    }

    if (!title.trim() || !message.trim()) {
      toast({ title: "Validation", description: "Title and message are required.", variant: "destructive" });
      return;
    }

    setSending(true);
    const { data, error } = await supabase.functions.invoke("broadcast-notification", {
      body: {
        title: title.trim(),
        message: message.trim(),
      },
    });
    setSending(false);

    if (error) {
      const errorMessage = getFunctionErrorMessage(error);
      const lowerMessage = errorMessage.toLowerCase();

      if (lowerMessage.includes("edge function")) {
        const fallbackInsert = await supabase.from("notifications").insert({
          title: title.trim(),
          message: message.trim(),
          created_by: userId,
        });

        if (!fallbackInsert.error) {
          clearSchemaError();
          setTitle("");
          setMessage("");
          toast({ title: "Broadcast Sent", description: "All staff will see this message in notifications." });
          fetchNotifications();
          return;
        }

        if (isMissingPublicTableError(fallbackInsert.error, "notifications")) {
          reportSchemaError(getNotificationSystemErrorMessage(fallbackInsert.error));
        } else {
          toast({ title: "Error", description: fallbackInsert.error.message, variant: "destructive" });
        }
        return;
      }

      if (
        isMissingPublicTableError(error, "notifications") ||
        lowerMessage.includes("notifications table") ||
        lowerMessage.includes("schema cache") ||
        lowerMessage.includes("supabase db push")
      ) {
        reportSchemaError(errorMessage);
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
      return;
    }

    clearSchemaError();
    setTitle("");
    setMessage("");
    toast({ title: "Broadcast Sent", description: data?.message ?? "All staff will see this message in notifications." });
    fetchNotifications();
  }, [clearSchemaError, fetchNotifications, reportSchemaError, title, message, userId, toast]);

  useEffect(() => {
    if (!schemaHealth.loading) {
      fetchNotifications();
    }
    const channel = supabase
      .channel("notifications_channel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, fetchNotifications)
      .subscribe();

    // Fallback polling every 30 seconds in case realtime fails
    const pollInterval = setInterval(fetchNotifications, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [userId, schemaHealth.loading, fetchNotifications]);

  return (
    <Card className="space-y-4">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle>Notifications</CardTitle>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <Badge variant="secondary" className="min-w-[92px] text-center">
              {unreadCount} Unread
            </Badge>
            <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={!unreadCount || loading} className="w-full sm:w-auto">
              Mark all read
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {schemaError ? (
          <p className="text-destructive text-sm">{schemaError}</p>
        ) : null}
        {enableBroadcast ? (
          <div className="space-y-2 border-b border-border pb-4 mb-4">
            <Input
              placeholder="Broadcast title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Textarea
              placeholder="Broadcast message"
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <Button onClick={broadcastNotification} disabled={sending}>
              {sending ? "Sending..." : "Send Broadcast"}
            </Button>
          </div>
        ) : null}

        {loading ? (
          <p>Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <p className="text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const isRead = statuses[notification.id] === true;
              return (
                <div
                  key={notification.id}
                  className={`rounded-lg p-3 border ${isRead ? "border-border bg-muted" : "border-primary/40 bg-primary/10"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(notification.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Badge variant={isRead ? "secondary" : "default"}>{isRead ? "Read" : "Unread"}</Badge>
                  </div>
                  <p className="mt-2 text-sm">{notification.message}</p>
                  {!isRead && (
                    <Button className="mt-2" size="sm" variant="outline" onClick={() => setAsRead(notification.id)}>
                      Mark as read
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationsPanel;
