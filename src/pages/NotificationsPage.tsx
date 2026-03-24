import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NotificationsPanel from "@/components/NotificationsPanel";

const NotificationsPage = () => {
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Broadcasts and system alerts for your account.</p>
        </div>
        <Link to={window.location.pathname.startsWith("/admin") ? "/admin/dashboard" : "/staff"} className="text-sm text-primary hover:underline">
          Go Back
        </Link>
      </div>
      <NotificationsPanel enableBroadcast />
    </div>
  );
};

export default NotificationsPage;
