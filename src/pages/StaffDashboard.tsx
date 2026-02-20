import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "@/contexts/LocationContext";
import { supabase } from "@/integrations/supabase/client";
import { getDistanceInMeters } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, MapPin, LogOut, Loader2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { parseDeviceInfo } from "@/lib/device-info";

const StaffDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { latitude, longitude, refreshLocation } = useLocation();
  const { toast } = useToast();
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [marking, setMarking] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    const fetchData = async () => {
      const [attRes, settRes] = await Promise.all([
        supabase.from("attendance").select("*").eq("user_id", user!.id).gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59").maybeSingle(),
        supabase.from("settings").select("*").limit(1).maybeSingle(),
      ]);
      setTodayAttendance(attRes.data);
      setSettings(settRes.data);
      setLoading(false);
    };
    fetchData();
  }, [user, today]);

  const handleMarkAttendance = async () => {
    if (!latitude || !longitude || !settings || !user || !profile) return;

    refreshLocation();
    await new Promise(r => setTimeout(r, 1000));

    const distance = getDistanceInMeters(latitude, longitude, settings.school_latitude, settings.school_longitude);
    if (distance > settings.allowed_radius) {
      toast({ title: "Outside School Premises", description: `You are ${Math.round(distance)}m away. Maximum allowed: ${settings.allowed_radius}m.`, variant: "destructive" });
      return;
    }

    const now = new Date();
    const lateTimeParts = settings.late_time.split(":");
    const lateThreshold = new Date();
    lateThreshold.setHours(parseInt(lateTimeParts[0]), parseInt(lateTimeParts[1]), 0, 0);
    const status = now > lateThreshold ? "late" : "present";

    setMarking(true);
    const ua = navigator.userAgent;
    const { browser, operating_system, device_type } = parseDeviceInfo(ua);
    const { error } = await supabase.from("attendance").insert({
      user_id: user.id,
      staff_name: profile.name,
      latitude,
      longitude,
      status,
      device_info: ua,
      browser,
      operating_system,
      device_type,
    });
    setMarking(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Attendance Marked!", description: `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`, });
      const { data } = await supabase.from("attendance").select("*").eq("user_id", user.id).gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59").maybeSingle();
      setTodayAttendance(data);
    }
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
                  <p className="text-xs text-muted-foreground mt-1">Marked at {format(new Date(todayAttendance.timestamp), "h:mm a")}</p>
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
            Mark Attendance
          </Button>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Your Location</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Lat: {latitude?.toFixed(6)}, Lng: {longitude?.toFixed(6)}</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StaffDashboard;
