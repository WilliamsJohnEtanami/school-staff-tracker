import { useEffect, useMemo, useState, useCallback } from "react";
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

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "demo-1",
    title: "Welcome to Staff Tracker",
    message: "Welcome! Your account has been created successfully. Start tracking your attendance and notifications here.",
    created_by: null,
    created_at: new Date().toISOString(),
  },
];

const NotificationsPanel = ({ enableBroadcast = false }: { enableBroadcast?: boolean }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const schemaHealth = useSchemaHealth();
  const [schemaError, setSchemaError] = useState<string | null>(null);

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
        const notFound = notifRes.error.message.toLowerCase().includes("relation \"public.notifications\" does not exist") || notifRes.error.code === "42P01";
        const errorMsg = notFound 
          ? "Notifications table not found. Please run database migrations: supabase db push"
          : `Error loading notifications: ${notifRes.error.message}`;
        setSchemaError(errorMsg);
        setNotifications(DEMO_NOTIFICATIONS.length > 0 ? DEMO_NOTIFICATIONS : []);
        setStatuses({});
        setLoading(false);
        return;
      }

      // Set notifications - if empty, show demo notifications
      const notifs = notifRes.data ?? [];
      if (notifs.length === 0 && DEMO_NOTIFICATIONS.length > 0) {
        setNotifications(DEMO_NOTIFICATIONS);
      } else {
        setNotifications(notifs);
      }

      // Try to fetch notification statuses - this table might not exist yet
      const statusRes = await supabase
        .from("notification_statuses")
        .select("notification_id,read")
        .eq("user_id", userId);

      if (statusRes.error) {
        // Don't show error for missing notification_statuses table - just treat as empty
        const notFound = statusRes.error.message.toLowerCase().includes("relation \"public.notification_statuses\" does not exist") || statusRes.error.code === "42P01";
        if (!notFound) {
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
    } catch (err: any) {
      setSchemaError(`Failed to fetch notifications: ${err.message}`);
      setNotifications(DEMO_NOTIFICATIONS);
    }

    setLoading(false);
  }, [userId]);

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
      const isTableMissing = error.message.toLowerCase().includes("relation \"public.notification_statuses\" does not exist") || error.code === "42P01";
      if (!isTableMissing) {
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
      const isTableMissing = error.message.toLowerCase().includes("relation \"public.notification_statuses\" does not exist") || error.code === "42P01";
      if (!isTableMissing) {
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

  const broadcastNotification = async () => {
    if (!userId) {
      toast({ title: "Error", description: "You must be signed in to broadcast.", variant: "destructive" });
      return;
    }

    if (!title.trim() || !message.trim()) {
      toast({ title: "Validation", description: "Title and message are required.", variant: "destructive" });
      return;
    }

    setSending(true);
    const { error } = await supabase.from("notifications").insert({
      title: title.trim(),
      message: message.trim(),
      created_by: userId,
    });

    setSending(false);

    if (error) {
      const notFound = error.message.toLowerCase().includes("relation \"public.notifications\" does not exist") || error.code === "42P01";
      if (notFound) {
        setSchemaError("Notifications table does not exist. Run database migrations.");
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      return;
    }

    setTitle("");
    setMessage("");
    toast({ title: "Broadcast Sent", description: "All staff will see this message in notifications." });
    fetchNotifications();
  };

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
        ) : schemaError ? (
          <p className="text-destructive text-sm">{schemaError}</p>
        ) : notifications.length === 0 ? (
          <>
            <p className="text-muted-foreground">No notifications yet. Showing demo notifications.</p>
            <div className="space-y-2">
              {DEMO_NOTIFICATIONS.map((notification) => (
                <div key={notification.id} className="rounded-lg p-3 border border-primary/40 bg-primary/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(notification.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Badge variant="secondary">Demo</Badge>
                  </div>
                  <p className="mt-2 text-sm">{notification.message}</p>
                </div>
              ))}
            </div>
          </>
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
