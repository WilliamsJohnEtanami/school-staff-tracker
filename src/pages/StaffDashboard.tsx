import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "@/contexts/LocationContext";
import { supabase } from "@/integrations/supabase/client";
import { getDistanceInMeters } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, MapPin, LogOut, Loader2, XCircle, LogIn, History, ChevronDown, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { parseDeviceInfo } from "@/lib/device-info";

const StaffDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { latitude, longitude } = useLocation();
  const { toast } = useToast();
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [marking, setMarking] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    const fetchData = async () => {
      const [attRes, settRes, histRes, leaveRes] = await Promise.all([
        supabase.from("attendance").select("*").eq("user_id", user!.id).gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59").maybeSingle(),
        supabase.from("settings").select("*").limit(1).maybeSingle(),
        supabase.from("attendance").select("*").eq("user_id", user!.id).lt("created_at", today + "T00:00:00").order("timestamp", { ascending: false }).limit(30),
        supabase.from("leave_requests").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setTodayAttendance(attRes.data);
      setSettings(settRes.data);
      setHistory(histRes.data ?? []);
      setLeaveRequests(leaveRes.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, [user, today]);

  const handleClockOut = async () => {
    if (!todayAttendance) return;
    setClockingOut(true);
    const { error } = await supabase.from("attendance").update({ clock_out: new Date().toISOString() }).eq("id", todayAttendance.id);
    setClockingOut(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Clocked Out", description: "See you tomorrow!" });
      setTodayAttendance({ ...todayAttendance, clock_out: new Date().toISOString() });
    }
  };

  const handleMarkAttendance = async () => {
    if (!user || !profile) return;

    const freshCoords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

    if (!freshCoords) {
      toast({ title: "Location Error", description: "Could not get your current location. Please try again.", variant: "destructive" });
      return;
    }

    setMarking(true);
    const ua = navigator.userAgent;
    const { browser, operating_system, device_type } = parseDeviceInfo(ua);

    const res = await supabase.functions.invoke("clock-in", {
      body: {
        latitude: freshCoords.lat,
        longitude: freshCoords.lng,
        device_info: ua,
        browser,
        operating_system,
        device_type,
      },
    });
    setMarking(false);

    if (res.error || res.data?.error) {
      toast({ title: "Clock In Failed", description: res.data?.error ?? res.error?.message, variant: "destructive" });
    } else {
      const status = res.data.status as string;
      toast({ title: "Attendance Marked!", description: `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}` });
      setTodayAttendance(res.data.record);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !leaveStart || !leaveEnd) return;
    if (leaveEnd < leaveStart) {
      toast({ title: "Invalid Dates", description: "End date cannot be before start date.", variant: "destructive" });
      return;
    }
    setLeaveSaving(true);
    const { error, data } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      staff_name: profile.name,
      start_date: leaveStart,
      end_date: leaveEnd,
      reason: leaveReason || null,
    }).select().single();
    setLeaveSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Leave Request Submitted", description: "Your request is pending admin approval." });
      setLeaveRequests(prev => [data, ...prev]);
      setLeaveStart(""); setLeaveEnd(""); setLeaveReason("");
      setLeaveDialogOpen(false);
    }
  };

  const leaveStatusVariant = (status: string) => {
    if (status === "approved") return "default";
    if (status === "rejected") return "destructive";
    return "secondary";
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Staff Dashboard</h1>
          <p className="text-sm opacity-90">Welcome, {profile?.name}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{format(new Date(), "h:mm a")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today's Status</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAttendance ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-accent" />
                <div>
                  <Badge variant={todayAttendance.status === "late" ? "destructive" : "default"} className={todayAttendance.status !== "late" ? "bg-accent text-accent-foreground" : ""}>
                    {todayAttendance.status === "late" ? "Late" : "Present"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Clocked in at {format(new Date(todayAttendance.timestamp), "h:mm a")}</p>
                  {todayAttendance.clock_out && (
                    <p className="text-xs text-muted-foreground">Clocked out at {format(new Date(todayAttendance.clock_out), "h:mm a")}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">Not marked yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {!todayAttendance && (
          <Button onClick={handleMarkAttendance} disabled={marking} className="w-full h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground">
            {marking ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
            Clock In
          </Button>
        )}

        {todayAttendance && !todayAttendance.clock_out && (
          <Button onClick={handleClockOut} disabled={clockingOut} variant="outline" className="w-full h-14 text-lg">
            {clockingOut ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
            Clock Out
          </Button>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Your Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Lat: {latitude?.toFixed(6)}, Lng: {longitude?.toFixed(6)}</p>
            {settings && latitude && longitude && (() => {
              const dist = getDistanceInMeters(latitude, longitude, settings.school_latitude, settings.school_longitude);
              const inside = dist <= settings.allowed_radius;
              return (
                <div className="flex items-center gap-2">
                  <Badge variant={inside ? "default" : "destructive"} className={inside ? "bg-accent text-accent-foreground" : ""}>
                    {inside ? "Within school grounds" : "Outside school grounds"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{Math.round(dist)}m away · {settings.allowed_radius}m allowed</span>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Leave Requests */}
        <Collapsible open={leaveOpen} onOpenChange={setLeaveOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><CalendarOff className="h-4 w-4" /> Leave Requests</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${leaveOpen ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="w-full">Request Leave</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Submit Leave Request</DialogTitle></DialogHeader>
                    <form onSubmit={handleLeaveSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Start Date</Label>
                          <Input type="date" value={leaveStart} min={today} onChange={e => setLeaveStart(e.target.value)} required />
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Input type="date" value={leaveEnd} min={leaveStart || today} onChange={e => setLeaveEnd(e.target.value)} required />
                        </div>
                      </div>
                      <div>
                        <Label>Reason (optional)</Label>
                        <Input placeholder="e.g. Medical appointment, family emergency..." value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
                      </div>
                      <Button type="submit" disabled={leaveSaving} className="w-full">
                        {leaveSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Submit Request
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                {leaveRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-1">No leave requests yet.</p>
                ) : (
                  <div className="space-y-2">
                    {leaveRequests.map(r => (
                      <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(r.start_date), "MMM d")} – {format(new Date(r.end_date), "MMM d, yyyy")}
                          </p>
                          {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
                          {r.admin_note && <p className="text-xs text-muted-foreground italic">Admin: {r.admin_note}</p>}
                        </div>
                        <Badge variant={leaveStatusVariant(r.status)} className={r.status === "approved" ? "bg-accent text-accent-foreground" : ""}>
                          {r.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Attendance History */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><History className="h-4 w-4" /> Attendance History</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No previous records found.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{format(new Date(r.timestamp), "EEE, MMM d yyyy")}</p>
                          <p className="text-xs text-muted-foreground">
                            In: {format(new Date(r.timestamp), "h:mm a")}
                            {r.clock_out ? ` · Out: ${format(new Date(r.clock_out), "h:mm a")}` : " · No clock-out"}
                          </p>
                        </div>
                        <Badge variant={r.status === "late" ? "destructive" : "default"} className={r.status !== "late" ? "bg-accent text-accent-foreground" : ""}>
                          {r.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </main>
    </div>
  );
};

export default StaffDashboard;
