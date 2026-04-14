import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "@/contexts/LocationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocationPing } from "@/hooks/use-location-ping";
import { MapPin, Loader2, Briefcase, Coffee, Play, Pause, Power, Clock, TrendingUp, Timer, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
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
  const { user, profile } = useAuth();
  const { latitude, longitude } = useLocation();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionState, setSessionState] = useState<SessionState>("NOT_CLOCKED_IN");
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [distanceToSchool, setDistanceToSchool] = useState<number | null>(null);
  const [allowedRadius, setAllowedRadius] = useState<number>(200);
  const [todaySessions, setTodaySessions] = useState<WorkSessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<WorkSessionRecord | null>(null);
  const [locationLost, setLocationLost] = useState(false);

  // Background GPS pinging via service worker
  useLocationPing(activeSession?.id ?? null);

  const fetchTodayAttendance = useCallback(async () => {
    if (!user?.id) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", today + "T00:00:00")
      .lte("created_at", today + "T23:59:59")
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    setTodayAttendance(data ?? null);
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
    if (error) { setTodaySessions([]); setActiveSession(null); return; }
    const sessions = (data ?? []) as WorkSessionRecord[];
    setTodaySessions(sessions);
    setActiveSession(sessions.find(s => !s.ended_at) ?? null);
  }, [user?.id]);

  const fetchSettingsAndDistance = useCallback(async () => {
    if (!latitude || !longitude) return;
    const { data: settings } = await supabase.from("settings").select("*").limit(1).maybeSingle();
    if (settings?.school_latitude && settings?.school_longitude) {
      setDistanceToSchool(getDistanceInMeters(latitude, longitude, settings.school_latitude, settings.school_longitude));
      setAllowedRadius(settings.allowed_radius ?? 200);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    fetchTodayAttendance();
    fetchTodaySessions();
    fetchSettingsAndDistance();
  }, [fetchTodayAttendance, fetchTodaySessions, fetchSettingsAndDistance]);

  useEffect(() => {
    if (todayAttendance?.clock_out) { setSessionState("CLOCKED_OUT"); return; }
    if (activeSession?.type === "break") { setSessionState("IN_BREAK"); return; }
    if (activeSession?.type === "off-site") { setSessionState("IN_OFFSITE"); return; }
    if (activeSession?.type === "work") { setSessionState("IN_WORK"); return; }
    if (todayAttendance) { setSessionState("IN_WORK"); return; }
    setSessionState("NOT_CLOCKED_IN");
  }, [activeSession, todayAttendance]);

  useEffect(() => {
    if (!user?.id) return;
    const ch1 = supabase.channel("staff-att-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter: `user_id=eq.${user.id}` }, fetchTodayAttendance)
      .subscribe();
    const ch2 = supabase.channel("staff-sess-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_sessions", filter: `user_id=eq.${user.id}` }, fetchTodaySessions)
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [user?.id, fetchTodayAttendance, fetchTodaySessions]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      fetchSettingsAndDistance();
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchSettingsAndDistance]);

  // Listen for location lost events from service worker
  useEffect(() => {
    const handler = () => setLocationLost(true);
    window.addEventListener("location-ping-lost", handler);
    return () => window.removeEventListener("location-ping-lost", handler);
  }, []);

  // Clear location lost when session ends
  useEffect(() => {
    if (!activeSession) setLocationLost(false);
  }, [activeSession]);

  const handleClockIn = async () => {
    if (!user?.id || typeof latitude !== "number" || typeof longitude !== "number") {
      toast({ title: "Error", description: "Location not available.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const deviceInfo = getDeviceInfo();
      const { data: result, error } = await supabase.functions.invoke("clock-in", {
        body: { latitude, longitude, device_info: deviceInfo.device_type, browser: deviceInfo.browser, operating_system: deviceInfo.operating_system, device_type: deviceInfo.device_type },
      });
      if (error) throw new Error(getFunctionErrorMessage(error));
      if (!result?.success) throw new Error(result?.error || "Failed to clock in.");
      const nowIso = new Date().toISOString();
      const { error: sessionError } = await supabase.from("work_sessions").insert({ user_id: user.id, session_date: nowIso.split("T")[0], type: "work", started_at: nowIso });
      if (sessionError) {
        toast({ title: "Clocked In", description: `Session tracking unavailable: ${sessionError.message}`, variant: "destructive" });
      } else {
        toast({ title: "Clocked In", description: `Status: ${result.status}` });
      }
      await Promise.all([fetchTodayAttendance(), fetchTodaySessions()]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Clock in failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const transitionSession = async (nextType: SessionType, msg: string) => {
    if (!user?.id || !activeSession) return;
    setIsLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { error: closeErr } = await supabase.from("work_sessions").update({ ended_at: nowIso }).eq("id", activeSession.id).is("ended_at", null);
      if (closeErr) throw closeErr;
      const { error: nextErr } = await supabase.from("work_sessions").insert({ user_id: user.id, session_date: nowIso.split("T")[0], type: nextType, started_at: nowIso });
      if (nextErr) throw nextErr;
      toast({ title: "Updated", description: msg });
      await fetchTodaySessions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance?.id) return;
    setIsLoading(true);
    try {
      const nowIso = new Date().toISOString();
      if (activeSession?.id) {
        const { error } = await supabase.from("work_sessions").update({ ended_at: nowIso }).eq("id", activeSession.id).is("ended_at", null);
        if (error) throw error;
      }
      const { error } = await supabase.from("attendance").update({ clock_out: nowIso }).eq("id", todayAttendance.id);
      if (error) throw error;
      toast({ title: "Clocked Out", description: "See you tomorrow!" });
      await Promise.all([fetchTodayAttendance(), fetchTodaySessions()]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const hoursWorked = useMemo(() => {
    return todaySessions.filter(s => s.type === "work").reduce((total, s) => {
      const end = s.ended_at ? parseISO(s.ended_at) : currentTime;
      return total + (end.getTime() - parseISO(s.started_at).getTime()) / 3600000;
    }, 0);
  }, [todaySessions, currentTime]);

  const sessionMins = useMemo(() => ({
    work: todaySessions.filter(s => s.type === "work").reduce((t, s) => {
      const end = s.ended_at ? parseISO(s.ended_at) : currentTime;
      return t + (end.getTime() - parseISO(s.started_at).getTime()) / 60000;
    }, 0),
    break: todaySessions.filter(s => s.type === "break").reduce((t, s) => {
      const end = s.ended_at ? parseISO(s.ended_at) : currentTime;
      return t + (end.getTime() - parseISO(s.started_at).getTime()) / 60000;
    }, 0),
    offsite: todaySessions.filter(s => s.type === "off-site").reduce((t, s) => {
      const end = s.ended_at ? parseISO(s.ended_at) : currentTime;
      return t + (end.getTime() - parseISO(s.started_at).getTime()) / 60000;
    }, 0),
  }), [todaySessions, currentTime]);

  const greeting = useMemo(() => {
    const h = currentTime.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, [currentTime]);

  const sessionStatusLabel = useMemo(() => {
    switch (sessionState) {
      case "IN_WORK": return { text: "Currently working", color: "bg-green-400" };
      case "IN_BREAK": return { text: "On break", color: "bg-yellow-400" };
      case "IN_OFFSITE": return { text: "Off-site", color: "bg-blue-400" };
      case "CLOCKED_OUT": return { text: "Clocked out", color: "bg-gray-400" };
      default: return { text: "Not clocked in", color: "bg-red-400" };
    }
  }, [sessionState]);

  const barConfig = useMemo(() => {
    if (sessionState === "CLOCKED_OUT") {
      return hoursWorked >= 8
        ? { color: "bg-green-500", pulse: false, label: "text-green-600", text: `✓ Full day complete · ${(hoursWorked - 8).toFixed(1)}h overtime` }
        : { color: "bg-muted-foreground", pulse: false, label: "text-muted-foreground", text: `Clocked out · ${(8 - hoursWorked).toFixed(1)}h short` };
    }
    if (sessionState === "IN_WORK") return { color: "bg-primary", pulse: true, label: "text-primary", text: `${(8 - hoursWorked).toFixed(1)}h remaining · counting now` };
    if (sessionState === "IN_BREAK") return { color: "bg-yellow-500", pulse: false, label: "text-yellow-600", text: `On break · timer paused` };
    if (sessionState === "IN_OFFSITE") return { color: "bg-blue-500", pulse: true, label: "text-blue-600", text: `Off-site · time counting` };
    return { color: "bg-muted-foreground/40", pulse: false, label: "text-muted-foreground", text: "Clock in to start tracking" };
  }, [sessionState, hoursWorked]);

  const formatMins = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m` : `${Math.round(mins)}m`;

  const renderActionButtons = () => {
    if (isLoading) return <Button disabled className="w-full h-14"><Loader2 className="h-5 w-5 animate-spin" /></Button>;
    switch (sessionState) {
      case "NOT_CLOCKED_IN":
        return (
          <Button onClick={handleClockIn} className="w-full h-14 text-lg bg-green-500 hover:bg-green-600 text-white">
            <Play className="h-5 w-5 mr-2" /> Clock In
          </Button>
        );
      case "IN_WORK":
        return (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => transitionSession("break", "Break started.")} variant="outline" className="h-12">
              <Pause className="h-4 w-4 mr-2" /> Start Break
            </Button>
            <Button onClick={() => transitionSession("off-site", "Off-site session started.")} variant="outline" className="h-12">
              <MapPin className="h-4 w-4 mr-2" /> Go Off-site
            </Button>
            <Button onClick={handleClockOut} variant="destructive" className="h-12 col-span-2">
              <Power className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          </div>
        );
      case "IN_BREAK":
        return (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => transitionSession("work", "Work resumed.")} className="h-12">
              <Briefcase className="h-4 w-4 mr-2" /> End Break
            </Button>
            <Button onClick={handleClockOut} variant="destructive" className="h-12">
              <Power className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          </div>
        );
      case "IN_OFFSITE":
        return (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => transitionSession("work", "Back on-site.")} className="h-12">
              <Briefcase className="h-4 w-4 mr-2" /> Return On-site
            </Button>
            <Button onClick={handleClockOut} variant="destructive" className="h-12">
              <Power className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          </div>
        );
      case "CLOCKED_OUT":
        return <p className="text-center text-muted-foreground py-4">You have clocked out for the day. Well done! 🎉</p>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Welcome header */}
      <header className="bg-primary text-primary-foreground px-6 py-5 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm opacity-70">{format(currentTime, "EEEE, MMMM d, yyyy")}</p>
            <h1 className="text-xl font-bold mt-0.5 truncate">
              {greeting}, {profile?.name?.split(" ")[0] || "there"} 👋
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-block h-2 w-2 rounded-full ${sessionStatusLabel.color}`} />
              <span className="text-sm opacity-80">{sessionStatusLabel.text}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold tabular-nums">{format(currentTime, "h:mm")}</p>
            <p className="text-sm opacity-70">{format(currentTime, "a")}</p>
          </div>
        </div>
      </header>

      {/* Location lost banner */}
      {locationLost && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2.5 flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">
            Your location is no longer available. This has been logged. Please re-enable location access.
          </p>
          <button
            onClick={() => setLocationLost(false)}
            className="ml-auto text-destructive/70 hover:text-destructive text-xs underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Today's Summary — full width, no max-w constraint */}
      <div className="bg-card border-b">
        {/* Summary header strip */}
        <div className="bg-primary/5 border-b px-4 md:px-6 pt-4 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Today's Summary</h2>
          <div className="flex items-center gap-2">
            {todayAttendance ? (
              <>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  In: {format(parseISO(todayAttendance.timestamp), "h:mm a")}
                </span>
                {todayAttendance.clock_out && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Out: {format(parseISO(todayAttendance.clock_out), "h:mm a")}
                  </span>
                )}
                <Badge
                  variant={todayAttendance.status === "late" ? "destructive" : "default"}
                  className={todayAttendance.status !== "late" ? "bg-green-500 text-white" : ""}
                >
                  {todayAttendance.status === "late" ? "Late" : "On Time"}
                </Badge>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Not clocked in yet</span>
            )}
          </div>
        </div>

        <div className="px-4 md:px-6 py-4 space-y-4">
          {/* Hours progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Hours worked
              </span>
              <span className="font-semibold tabular-nums">
                {hoursWorked.toFixed(1)}h
                <span className="text-muted-foreground font-normal"> / 8h</span>
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-700 ease-in-out ${
                  barConfig.color
                } ${barConfig.pulse ? "animate-pulse" : ""}`}
                style={{ width: `${Math.min((hoursWorked / 8) * 100, 100)}%` }}
              />
            </div>
            <p className={`text-xs font-medium ${barConfig.label}`}>
              {barConfig.text}
            </p>
          </div>

          {/* Session breakdown tiles */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: "Work", icon: Briefcase, color: "text-green-700", bg: "bg-green-50 border-green-100", mins: sessionMins.work },
              { label: "Break", icon: Coffee, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-100", mins: sessionMins.break },
              { label: "Off-site", icon: MapPin, color: "text-blue-700", bg: "bg-blue-50 border-blue-100", mins: sessionMins.offsite },
            ] as const).map(({ label, icon: Icon, color, bg, mins }) => (
              <div key={label} className={`rounded-xl border ${bg} p-3 md:p-4 text-center`}>
                <Icon className={`h-4 w-4 md:h-5 md:w-5 mx-auto mb-1.5 ${color}`} />
                <p className={`text-base md:text-lg font-bold tabular-nums ${color}`}>
                  {formatMins(mins)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Timeline */}
          {todaySessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5" /> Session Timeline
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {[...todaySessions].reverse().map((s) => (
                  <div key={s.id} className={`flex items-center gap-2.5 text-xs rounded-lg px-3 py-2 border ${
                    s.type === "work" ? "bg-green-50 border-green-100" :
                    s.type === "break" ? "bg-yellow-50 border-yellow-100" :
                    "bg-blue-50 border-blue-100"
                  }`}>
                    <span className={`h-2 w-2 rounded-full shrink-0 ${
                      s.type === "work" ? "bg-green-500" :
                      s.type === "break" ? "bg-yellow-500" : "bg-blue-500"
                    }`} />
                    <span className={`capitalize font-medium w-12 shrink-0 ${
                      s.type === "work" ? "text-green-700" :
                      s.type === "break" ? "text-yellow-700" : "text-blue-700"
                    }`}>{s.type === "off-site" ? "Off-site" : s.type}</span>
                    <span className="text-muted-foreground flex-1">
                      {format(parseISO(s.started_at), "h:mm a")}
                      {s.ended_at ? ` → ${format(parseISO(s.ended_at), "h:mm a")}` : " → now"}
                    </span>
                    {!s.ended_at && (
                      <span className="text-primary font-semibold animate-pulse">live</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons + location — constrained width for readability */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        {distanceToSchool !== null && (
          <Card>
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <span className="text-sm flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {Math.round(distanceToSchool)}m from school
              </span>
              <Badge variant={distanceToSchool > allowedRadius ? "destructive" : "default"}
                className={distanceToSchool <= allowedRadius ? "bg-green-500 text-white" : ""}>
                {distanceToSchool > allowedRadius ? "Outside Radius" : "Within Radius"}
              </Badge>
            </CardContent>
          </Card>
        )}

        {renderActionButtons()}
      </div>
    </div>
  );
};

export default StaffDashboard;
