import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "@/contexts/LocationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, MapPin, LogOut, Loader2, XCircle, LogIn, History, ChevronDown, CalendarOff, Coffee, Briefcase, Play, Pause, Power, AlertCircle, Bell, FilePlus2 } from "lucide-react";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { useNotifications } from "@/hooks/use-notifications";
import { getDeviceInfo } from "@/lib/device-info";
import { getDistanceInMeters } from "@/lib/geo";
import { getFunctionErrorMessage } from "@/lib/supabase-errors";

type SessionType = "work" | "break" | "off-site";
type SessionState = "NOT_CLOCKED_IN" | "IN_WORK" | "IN_BREAK" | "IN_OFFSITE" | "CLOCKED_OUT";
type AttendanceRecord = {
  id: string;
  user_id: string;
  staff_name: string;
  timestamp: string;
  clock_out?: string | null;
  status: string;
  latitude: number;
  longitude: number;
  device_info?: string;
  browser?: string;
  operating_system?: string;
  device_type?: string;
};

type WorkSessionRecord = {
  id: string;
  user_id: string;
  session_date: string;
  type: SessionType;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

const StaffDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { latitude, longitude } = useLocation();
  const { notifications, unreadCount } = useNotifications();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- State Management ---
  const [sessionState, setSessionState] = useState<SessionState>("NOT_CLOCKED_IN");
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [distanceToSchool, setDistanceToSchool] = useState<number | null>(null);
  const [todaySessions, setTodaySessions] = useState<WorkSessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<WorkSessionRecord | null>(null);
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
    } else {
      setTodayAttendance(null);
    }
  }, [user?.id]);

  const fetchTodaySessions = useCallback(async () => {
    if (!user?.id) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("work_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("session_date", today)
      .order("started_at", { ascending: false });

    if (error) {
      console.warn("Work sessions fetch error:", error);
      setTodaySessions([]);
      setActiveSession(null);
      return;
    }

    const sessions = (data ?? []) as WorkSessionRecord[];
    setTodaySessions(sessions);
    setActiveSession(sessions.find((session) => !session.ended_at) ?? null);
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

  useEffect(() => {
    fetchTodayAttendance();
    fetchTodaySessions();
    fetchSettingsAndDistance();
  }, [fetchTodayAttendance, fetchTodaySessions, fetchSettingsAndDistance]);

  useEffect(() => {
    if (todayAttendance?.clock_out) {
      setSessionState("CLOCKED_OUT");
      return;
    }

    if (activeSession?.type === "break") {
      setSessionState("IN_BREAK");
      return;
    }

    if (activeSession?.type === "off-site") {
      setSessionState("IN_OFFSITE");
      return;
    }

    if (activeSession?.type === "work") {
      setSessionState("IN_WORK");
      return;
    }

    if (todayAttendance) {
      setSessionState("IN_WORK");
      return;
    }

    setSessionState("NOT_CLOCKED_IN");
  }, [activeSession, todayAttendance]);

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

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("staff-work-sessions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_sessions", filter: `user_id=eq.${user.id}` },
        () => {
          fetchTodaySessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTodaySessions, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      fetchSettingsAndDistance(); // Update distance every minute
    }, 1000 * 60);
    return () => clearInterval(timer);
  }, [fetchSettingsAndDistance]);

  const handleClockIn = async () => {
    if (!user?.id || typeof latitude !== "number" || typeof longitude !== "number") {
      toast({ title: "Error", description: "Location not available. Please enable location services.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const deviceInfo = getDeviceInfo();
      const { data: result, error } = await supabase.functions.invoke("clock-in", {
        body: {
          latitude,
          longitude,
          device_info: deviceInfo.device_type,
          browser: deviceInfo.browser,
          operating_system: deviceInfo.operating_system,
          device_type: deviceInfo.device_type,
        },
      });

      if (error) {
        throw new Error(getFunctionErrorMessage(error));
      }

      if (!result?.success) {
        throw new Error(result?.error || "Failed to clock in.");
      }

      const nowIso = new Date().toISOString();
      const sessionDate = nowIso.split("T")[0];

      const { error: sessionError } = await supabase.from("work_sessions").insert({
        user_id: user.id,
        session_date: sessionDate,
        type: "work",
        started_at: nowIso,
      });

      if (sessionError) {
        console.warn("Work session creation error:", sessionError);
        toast({
          title: "Clocked In",
          description: `Attendance was recorded, but the live activity session could not be created: ${sessionError.message}`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: `Clocked in successfully. Status: ${result.status}`, variant: "default" });
      }

      setSessionState("IN_WORK");
      await Promise.all([fetchTodayAttendance(), fetchTodaySessions()]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Clock in failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const transitionSession = async (nextType: SessionType, successMessage: string) => {
    if (!user?.id || !activeSession) return;

    setIsLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const sessionDate = nowIso.split("T")[0];

      const { error: closeError } = await supabase
        .from("work_sessions")
        .update({ ended_at: nowIso })
        .eq("id", activeSession.id)
        .is("ended_at", null);

      if (closeError) throw closeError;

      const { error: nextSessionError } = await supabase.from("work_sessions").insert({
        user_id: user.id,
        session_date: sessionDate,
        type: nextType,
        started_at: nowIso,
      });

      if (nextSessionError) throw nextSessionError;

      toast({ title: "Success", description: successMessage });
      await fetchTodaySessions();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Session update failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const startBreak = async () => {
    if (sessionState !== "IN_WORK") return;
    await transitionSession("break", "Break started.");
  };

  const startOffSite = async () => {
    if (sessionState !== "IN_WORK") return;
    await transitionSession("off-site", "Off-site session started.");
  };

  const resumeWork = async () => {
    if (sessionState !== "IN_BREAK" && sessionState !== "IN_OFFSITE") return;
    await transitionSession("work", "Work session resumed.");
  };

  const handleClockOut = async () => {
    setIsLoading(true);
    try {
      // Update attendance record to mark clock_out time
      if (todayAttendance?.id) {
        const nowIso = new Date().toISOString();

        if (activeSession?.id) {
          const { error: sessionError } = await supabase
            .from("work_sessions")
            .update({ ended_at: nowIso })
            .eq("id", activeSession.id)
            .is("ended_at", null);

          if (sessionError) throw sessionError;
        }

        const { error } = await supabase
          .from("attendance")
          .update({ clock_out: nowIso })
          .eq("id", todayAttendance.id);

        if (error) throw error;

        toast({ title: "Success", description: "Clocked out successfully" });
        setSessionState("CLOCKED_OUT");
        setClockOutTime(new Date());
        await Promise.all([fetchTodayAttendance(), fetchTodaySessions()]);
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

  const latestNotifications = useMemo(
    () => notifications.slice(0, 2),
    [notifications]
  );

  const getIconForType = (status: string) => {
    switch (status) {
      case "present":
      case "late":
      case "work":
        return <Briefcase className="h-4 w-4 mr-2" />;
      case "break":
        return <Coffee className="h-4 w-4 mr-2" />;
      case "off-site":
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={startBreak} variant="outline" className="h-12">
              <Pause className="h-4 w-4 mr-2" /> Start Break
            </Button>
            <Button onClick={startOffSite} variant="outline" className="h-12">
              <MapPin className="h-4 w-4 mr-2" /> Go Off-site
            </Button>
            <Button onClick={handleClockOut} variant="destructive" className="h-12 sm:col-span-2">
              <Power className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          </div>
        );
      case "IN_BREAK":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={resumeWork} className="h-12">
              <Briefcase className="h-4 w-4 mr-2" /> End Break
            </Button>
            <Button onClick={handleClockOut} variant="destructive" className="h-12">
              <Power className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          </div>
        );
      case "IN_OFFSITE":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={resumeWork} className="h-12">
              <Briefcase className="h-4 w-4 mr-2" /> Return On-site
            </Button>
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
          <Link
            to="/notifications?view=notifications"
            className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground"
          >
            <Bell className="h-4 w-4" />
            Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
          </Link>
          <Link
            to="/notifications?view=requests"
            className="inline-flex items-center gap-1 rounded-md border border-primary-foreground/30 px-2.5 py-1 text-xs text-primary-foreground sm:gap-2 sm:px-3 sm:text-sm"
          >
            <FilePlus2 className="h-4 w-4" />
            Request
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

        {todaySessions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Today's Activity Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todaySessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center text-sm">
                    {getIconForType(session.type)}
                    <div>
                      <p className="font-medium capitalize">{session.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(session.started_at), "h:mm a")}
                        {session.ended_at ? ` - ${format(parseISO(session.ended_at), "h:mm a")}` : " - Active"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={session.ended_at ? "secondary" : "default"}>
                    {session.ended_at ? "Completed" : "Active"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Latest Notifications</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} waiting for you.`
                    : "No missed notifications right now."}
                </p>
              </div>
              {unreadCount > 0 ? <Badge>{unreadCount}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestNotifications.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              latestNotifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={`/notifications?view=notifications&notification=${notification.id}`}
                  className="block rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{notification.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{notification.message}</p>
                    </div>
                    {!notification.read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /> : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {format(parseISO(notification.created_at), "MMM d, h:mm a")}
                  </p>
                </Link>
              ))
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                to="/notifications?view=notifications"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                View All Notifications
              </Link>
              <Link
                to="/notifications?view=requests"
                className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Make Request
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StaffDashboard;
