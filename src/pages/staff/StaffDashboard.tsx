import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "@/contexts/LocationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNotificationCount } from "@/hooks/use-notification-count";
import NotificationsPanel from "@/components/NotificationsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, MapPin, LogOut, Loader2, XCircle, LogIn, History, ChevronDown, CalendarOff, Coffee, Briefcase, Play, Pause, Power, AlertCircle } from "lucide-react";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { getDeviceInfo } from "@/lib/device-info";
import { getDistanceInMeters } from "@/lib/geo";

type SessionType = "work" | "break" | "off-site";
type SessionState = "NOT_CLOCKED_IN" | "IN_WORK" | "IN_BREAK" | "IN_OFFSITE" | "CLOCKED_OUT";
type AttendanceRecord = {
  id: string;
  user_id: string;
  staff_name: string;
  timestamp: string;
  status: string;
  latitude: number;
  longitude: number;
  device_info?: string;
  browser?: string;
  operating_system?: string;
  device_type?: string;
};

interface Notification {
  id: string;
  title: string;
  message: string;
  created_by: string | null;
  created_at: string;
}

const StaffDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { latitude, longitude } = useLocation();
  const { unreadCount } = useNotificationCount();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- State Management ---
  const [sessionState, setSessionState] = useState<SessionState>("NOT_CLOCKED_IN");
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [distanceToSchool, setDistanceToSchool] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [clockOutTime, setClockOutTime] = useState<Date | null>(null);

  // Fetch today's attendance record
  const fetchTodayAttendance = useCallback(async () => {
    if (!user?.id) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", today + "T00:00:00")
      .lte("created_at", today + "T23:59:59")
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setTodayAttendance(data);
      // Determine session state based on attendance record
      if (data.status === "present" || data.status === "late") {
        setSessionState("IN_WORK");
      }
    }
  }, [user?.id]);

  // Fetch settings and calculate distance
  const fetchSettingsAndDistance = useCallback(async () => {
    if (!latitude || !longitude) return;
    const { data: settings } = await supabase.from("settings").select("*").limit(1).maybeSingle();
    if (settings && settings.school_latitude && settings.school_longitude) {
      const distance = getDistanceInMeters(latitude, longitude, settings.school_latitude, settings.school_longitude);
      setDistanceToSchool(distance);
    }
  }, [latitude, longitude]);

  // Fetch recent notifications
  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id,title,message,created_by,created_at")
      .order("created_at", { ascending: false })
      .limit(3);
    if (data) {
      setNotifications(data);
    }
  }, []);

  useEffect(() => {
    fetchTodayAttendance();
    fetchSettingsAndDistance();
    fetchNotifications();
  }, [fetchTodayAttendance, fetchSettingsAndDistance, fetchNotifications]);

  // Real-time listener for attendance changes
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("staff-attendance-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance", filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log("Attendance updated:", payload);
          fetchTodayAttendance();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchTodayAttendance]);

  // Real-time listener for notifications
  useEffect(() => {
    const channel = supabase
      .channel("staff-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          console.log("New notification:", payload);
          fetchNotifications();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      fetchSettingsAndDistance(); // Update distance every minute
    }, 1000 * 60);
    return () => clearInterval(timer);
  }, [fetchSettingsAndDistance]);

  const handleClockIn = async () => {
    if (!user?.id || latitude === undefined || longitude === undefined) {
      toast({ title: "Error", description: "Location not available. Please enable location services.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const deviceInfo = getDeviceInfo();
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/clock-in`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude,
          longitude,
          device_info: deviceInfo.device_type,
          browser: deviceInfo.browser,
          operating_system: deviceInfo.os,
          device_type: deviceInfo.device_type,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        toast({ title: "Success", description: `Clocked in successfully. Status: ${result.status}`, variant: "default" });
        setSessionState("IN_WORK");
        fetchTodayAttendance();
      } else {
        toast({ title: "Error", description: result.error || "Failed to clock in", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Clock in failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    setIsLoading(true);
    try {
      // Update attendance record to mark clock_out time
      if (todayAttendance?.id) {
        const { error } = await supabase
          .from("attendance")
          .update({ clock_out: new Date().toISOString() })
          .eq("id", todayAttendance.id);

        if (error) throw error;

        toast({ title: "Success", description: "Clocked out successfully" });
        setSessionState("CLOCKED_OUT");
        setClockOutTime(new Date());
        fetchTodayAttendance();
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Clock out failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total hours worked from today's attendance
  const hoursWorked = useMemo(() => {
    if (!todayAttendance) return 0;
    const clockedIn = parseISO(todayAttendance.timestamp);
    const clockedOut = todayAttendance.clock_out ? parseISO(todayAttendance.clock_out) : currentTime;
    return differenceInMinutes(clockedOut, clockedIn) / 60;
  }, [todayAttendance, currentTime]);

  const getIconForType = (status: string) => {
    switch (status) {
      case "present":
      case "late":
        return <Briefcase className="h-4 w-4 mr-2" />;
      case "break":
        return <Coffee className="h-4 w-4 mr-2" />;
      default:
        return <MapPin className="h-4 w-4 mr-2" />;
    }
  };

  const renderActionButtons = () => {
    if (isLoading) {
      return <Button disabled className="w-full"><Loader2 className="h-5 w-5 animate-spin" /></Button>;
    }

    switch (sessionState) {
      case "NOT_CLOCKED_IN":
        return (
          <Button onClick={handleClockIn} className="w-full h-14 text-lg bg-green-500 hover:bg-green-600 text-white">
            <Play className="h-5 w-5 mr-2" /> Clock In
          </Button>
        );
      case "IN_WORK":
        return (
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={handleClockOut} variant="destructive" className="h-12">
              <Power className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          </div>
        );
      case "CLOCKED_OUT":
        return <p className="text-center text-muted-foreground p-4">You have clocked out for the day. Well done!</p>;
      default:
        return null;
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Staff Dashboard</h1>
          <p className="text-sm opacity-90">Welcome, {profile?.name || "Staff Member"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/notifications" className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm">
            Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
          </Link>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* Time Card */}
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{format(currentTime, "EEEE, MMMM d, yyyy")}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{format(currentTime, "h:mm a")}</p>
          </CardContent>
        </Card>

        {/* Today's Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-around text-center">
              <div>
                <p className="text-2xl font-bold">{hoursWorked.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Hours Worked</p>
              </div>
              <div>
                <p className="text-2xl font-bold">8.0</p>
                <p className="text-xs text-muted-foreground">Contracted</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${hoursWorked < 8 ? 'text-red-500' : 'text-green-500'}`}>
                  {(hoursWorked - 8).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Status */}
        {distanceToSchool !== null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Distance to School
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span>{Math.round(distanceToSchool)}m away</span>
                <Badge variant={distanceToSchool > 200 ? "destructive" : "default"}>
                  {distanceToSchool > 200 ? "Outside Radius" : "Within Radius"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {renderActionButtons()}
        </div>

        {/* Today's Record */}
        {todayAttendance && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Today's Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Clocked In:</span>
                <span className="font-semibold">{format(parseISO(todayAttendance.timestamp), "h:mm a")}</span>
              </div>
              {todayAttendance.clock_out && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Clocked Out:</span>
                  <span className="font-semibold">{format(parseISO(todayAttendance.clock_out), "h:mm a")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={todayAttendance.status === "late" ? "destructive" : "default"}>
                  {todayAttendance.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latest Notifications */}
        {notifications.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latest Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.map((notif) => (
                <div key={notif.id} className="border rounded-lg p-3">
                  <p className="font-semibold text-sm">{notif.title}</p>
                  <p className="text-xs text-muted-foreground">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{format(parseISO(notif.created_at), "MMM d, h:mm a")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Link to="/notifications" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
            View All Notifications
          </Link>
        </div>

        <NotificationsPanel />
      </main>
    </div>
  );
};

export default StaffDashboard;
