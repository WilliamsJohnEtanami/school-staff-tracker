import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { getSettingsSystemErrorMessage, isMissingPublicColumnError } from "@/lib/supabase-errors";
import { Loader2, Save, MapPin, Crosshair, RefreshCw, ChevronDown, CheckCircle2, ExternalLink, LogOut, Bell, Clock } from "lucide-react";

const SettingsPage = () => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const { toast } = useToast();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [schoolLat, setSchoolLat] = useState("");
  const [schoolLng, setSchoolLng] = useState("");
  const [radius, setRadius] = useState("");
  const [lateTime, setLateTime] = useState("");
  const [alertTime, setAlertTime] = useState("");
  const [alertEmail, setAlertEmail] = useState("");

  // Reminder settings
  const [clockInReminder, setClockInReminder] = useState(true);
  const [clockOutReminder, setClockOutReminder] = useState(true);
  const [dailyAlerts, setDailyAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [reminderTime, setReminderTime] = useState("09:00");

  const [detecting, setDetecting] = useState(false);
  const [detectedLat, setDetectedLat] = useState<number | null>(null);
  const [detectedLng, setDetectedLng] = useState<number | null>(null);
  const [detectedAccuracy, setDetectedAccuracy] = useState<number | null>(null);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [improving, setImproving] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      if (error) {
        setSchemaWarning(getSettingsSystemErrorMessage(error));
        setLoading(false);
        return;
      }
      if (data) {
        setSettings(data);
        setSchoolLat(data.school_latitude.toString());
        setSchoolLng(data.school_longitude.toString());
        setRadius(data.allowed_radius.toString());
        setLateTime(data.late_time.substring(0, 5));
        setAlertTime(data.alert_time ? data.alert_time.substring(0, 5) : "10:00");
        setAlertEmail(data.alert_email ?? "");
        setClockInReminder(data.clock_in_reminder ?? true);
        setClockOutReminder(data.clock_out_reminder ?? true);
        setDailyAlerts(data.daily_alerts ?? true);
        setWeeklyReports(data.weekly_reports ?? true);
        setReminderTime(data.reminder_time ?? "09:00");
      }
      setSchemaWarning(null);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      return data.display_name ?? null;
    } catch {
      return null;
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Not Supported", description: "Geolocation is not supported by your browser.", variant: "destructive" });
      return;
    }
    setDetecting(true);
    setDetectedAddress(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setDetectedLat(pos.coords.latitude);
        setDetectedLng(pos.coords.longitude);
        setDetectedAccuracy(pos.coords.accuracy);
        setDetecting(false);
        const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setDetectedAddress(addr);
      },
      (err) => {
        setDetecting(false);
        toast({ title: "Location Error", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const improveAccuracy = () => {
    if (!navigator.geolocation) return;
    setImproving(true);
    const readings: { lat: number; lng: number; acc: number }[] = [];
    let count = 0;
    const maxReadings = 5;

    const take = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          readings.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
          count++;
          if (count < maxReadings) {
            setTimeout(take, 1500);
          } else {
            const avgLat = readings.reduce((s, r) => s + r.lat, 0) / readings.length;
            const avgLng = readings.reduce((s, r) => s + r.lng, 0) / readings.length;
            const bestAcc = Math.min(...readings.map(r => r.acc));
            setDetectedLat(avgLat);
            setDetectedLng(avgLng);
            setDetectedAccuracy(bestAcc);
            setImproving(false);
            const addr = await reverseGeocode(avgLat, avgLng);
            setDetectedAddress(addr);
            toast({ title: "Accuracy Improved", description: `Averaged ${maxReadings} readings. Best accuracy: ${bestAcc.toFixed(0)}m.` });
          }
        },
        () => {
          setImproving(false);
          toast({ title: "Error", description: "Failed to get location reading.", variant: "destructive" });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };
    take();
  };

  const applyDetected = () => {
    if (detectedLat !== null && detectedLng !== null) {
      setSchoolLat(detectedLat.toFixed(8));
      setSchoolLng(detectedLng.toFixed(8));
      toast({ title: "Coordinates Applied", description: "Detected location has been set. Click 'Save Settings' to confirm." });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings?.id) {
      toast({ title: "Error", description: "Settings record is not available yet.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const basePayload = {
      school_latitude: parseFloat(schoolLat),
      school_longitude: parseFloat(schoolLng),
      allowed_radius: parseInt(radius),
      late_time: lateTime + ":00",
    };

    const reminderPayload = {
      alert_time: alertTime + ":00",
      alert_email: alertEmail,
      clock_in_reminder: clockInReminder,
      clock_out_reminder: clockOutReminder,
      daily_alerts: dailyAlerts,
      weekly_reports: weeklyReports,
      reminder_time: reminderTime + ":00",
    };

    let { error } = await supabase
      .from("settings")
      .update({ ...basePayload, ...reminderPayload })
      .eq("id", settings.id);

    if (error && isMissingPublicColumnError(error, "settings")) {
      const fallback = await supabase
        .from("settings")
        .update(basePayload)
        .eq("id", settings.id);

      setSaving(false);

      if (fallback.error) {
        toast({ title: "Error", description: getSettingsSystemErrorMessage(fallback.error), variant: "destructive" });
        return;
      }

      const warning =
        "Location and attendance rules were saved, but reminder settings still need the latest database migration.";
      setSchemaWarning(warning);
      toast({ title: "Partial Save", description: warning, variant: "destructive" });
      return;
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: getSettingsSystemErrorMessage(error), variant: "destructive" });
    } else {
      setSchemaWarning(null);
      toast({ title: "School Location Set Successfully", description: "Location and settings have been saved." });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const hasDetected = detectedLat !== null && detectedLng !== null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Settings</h2>

      {schemaWarning && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {schemaWarning}
        </div>
      )}

      {/* GPS Detection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" /> School Location Setup
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Stand inside the school and click detect to automatically set the school's GPS coordinates.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={detectLocation} disabled={detecting || improving} variant="default" className="gap-2">
              {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              {detecting ? "Detecting..." : "Detect My Current Location"}
            </Button>
            {hasDetected && (
              <Button onClick={improveAccuracy} disabled={improving || detecting} variant="outline" className="gap-2">
                {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {improving ? "Improving..." : "Improve Accuracy"}
              </Button>
            )}
          </div>

          {hasDetected && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                <span className="font-medium text-foreground">Location Detected</span>
              </div>
              {detectedAddress && (
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm text-foreground">{detectedAddress}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Latitude</p>
                  <p className="text-sm font-mono text-foreground">{detectedLat?.toFixed(8)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Longitude</p>
                  <p className="text-sm font-mono text-foreground">{detectedLng?.toFixed(8)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                  <Badge variant="outline">{detectedAccuracy?.toFixed(0)}m</Badge>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps?q=${detectedLat},${detectedLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
              >
                <ExternalLink className="h-3 w-3" /> View on Google Maps
              </a>
              <Button onClick={applyDetected} className="gap-2 w-full sm:w-auto">
                <MapPin className="h-4 w-4" /> Save as School Location
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reminder Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Reminder Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure automated reminders and notifications for staff and administrators.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6 max-w-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Clock-in Reminders</Label>
                  <p className="text-sm text-muted-foreground">Send notifications to staff who haven't clocked in by the reminder time</p>
                </div>
                <Switch checked={clockInReminder} onCheckedChange={setClockInReminder} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Clock-out Reminders</Label>
                  <p className="text-sm text-muted-foreground">Remind staff to clock out at the end of the day</p>
                </div>
                <Switch checked={clockOutReminder} onCheckedChange={setClockOutReminder} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Daily Absence Alerts</Label>
                  <p className="text-sm text-muted-foreground">Send daily email reports of absent staff</p>
                </div>
                <Switch checked={dailyAlerts} onCheckedChange={setDailyAlerts} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">Generate weekly attendance summary reports</p>
                </div>
                <Switch checked={weeklyReports} onCheckedChange={setWeeklyReports} />
              </div>

              <div>
                <Label>Reminder Time</Label>
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Time to send clock-in reminders and other automated notifications</p>
              </div>
            </div>

            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Reminder Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Main settings form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Location & Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4 max-w-md">
            <div><Label>Allowed Radius (meters)</Label><Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} required /></div>
            <div><Label>Late Time Threshold</Label><Input type="time" value={lateTime} onChange={(e) => setLateTime(e.target.value)} required /></div>
            <div><Label>Daily Alert Time</Label><Input type="time" value={alertTime} onChange={(e) => setAlertTime(e.target.value)} /><p className="text-xs text-muted-foreground mt-1">Time to send the daily absent staff alert email.</p></div>
            <div><Label>Alert Email Address</Label><Input type="email" placeholder="admin@school.edu" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} /><p className="text-xs text-muted-foreground mt-1">Who receives the daily alert. Leave blank to disable.</p></div>

            <Collapsible open={showManual} onOpenChange={setShowManual}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" type="button" className="gap-1 text-muted-foreground px-0">
                  <ChevronDown className={`h-4 w-4 transition-transform ${showManual ? "rotate-180" : ""}`} />
                  Advanced: Manual Coordinates
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>School Latitude</Label><Input type="number" step="any" value={schoolLat} onChange={(e) => setSchoolLat(e.target.value)} required /></div>
                  <div><Label>School Longitude</Label><Input type="number" step="any" value={schoolLng} onChange={(e) => setSchoolLng(e.target.value)} required /></div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {schoolLat && schoolLng && parseFloat(schoolLat) !== 0 && (
              <p className="text-sm text-muted-foreground">
                Current: {parseFloat(schoolLat).toFixed(6)}, {parseFloat(schoolLng).toFixed(6)}
              </p>
            )}

            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sign Out - separated at bottom */}
      <Separator />
      <div className="pt-2">
        <Button variant="destructive" onClick={handleSignOut} className="gap-2">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
