import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/use-notifications";

const NotificationsList = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { notifications, unread, loading, error, markAsRead } = useNotifications(userId);

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Notifications</CardTitle>
          <Badge variant="secondary">{unread.length} unread</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <div>Loading notifications...</div>}
        {error && <div className="text-destructive">{error}</div>}
        {!loading && sortedNotifications.length === 0 && <div>No notifications at the moment.</div>}

        <div className="space-y-3">
          {sortedNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 border rounded-lg ${notification.read ? "bg-white" : "bg-primary/5 border-primary"}`}
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className={`text-base ${notification.read ? "font-medium" : "font-bold"}`}>
                    {notification.title}
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</p>
                </div>
                {!notification.read && <Badge variant="secondary">New</Badge>}
              </div>

              {!notification.read && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => markAsRead(notification.id)}>
                  Mark as read
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationsList;
