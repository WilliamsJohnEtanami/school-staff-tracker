import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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

  const fetchNotifications = async () => {
    if (!userId) return;
    setLoading(true);
    setSchemaError(null);

    const [notifRes, statusRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("id,title,message,created_by,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("notification_statuses")
        .select("notification_id,read")
        .eq("user_id", userId),
    ]);

    if (notifRes.error) {
      const notFound = notifRes.error.message.toLowerCase().includes("relation \"public.notifications\" does not exist") || notifRes.error.code === "42P01";
      setSchemaError(notFound ? "Notifications table does not exist. Run database migrations." : notifRes.error.message);
      setNotifications([]);
    } else {
      setNotifications(notifRes.data ?? []);
    }

    if (statusRes.error) {
      const notFound = statusRes.error.message.toLowerCase().includes("relation \"public.notification_statuses\" does not exist") || statusRes.error.code === "42P01";
      setSchemaError(notFound ? "Notification statuses table does not exist. Run database migrations." : statusRes.error.message);
      setStatuses({});
    } else {
      const statusMap: Record<string, boolean> = {};
      (statusRes.data ?? []).forEach((status) => {
        statusMap[status.notification_id] = status.read;
      });
      setStatuses(statusMap);
    }

    setLoading(false);
  };

  const setAsRead = async (notificationId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("notification_statuses").upsert(
      {
        notification_id: notificationId,
        user_id: userId,
        read: true,
      },
      { onConflict: "notification_id,user_id", returning: "minimal" }
    );

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      returning: "minimal",
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const newStatuses = { ...statuses };
    upserts.forEach((u) => {
      newStatuses[u.notification_id] = true;
    });
    setStatuses(newStatuses);
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
    fetchNotifications();
    const channel = supabase
      .channel("notifications_channel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, fetchNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Card className="space-y-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Notifications</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{unreadCount} Unread</Badge>
            <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={!unreadCount || loading}>
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
                      <p className="text-sm text-muted-foreground">{format(new Date(notification.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
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
