import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, MapPin } from "lucide-react";

const SettingsPage = () => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [schoolLat, setSchoolLat] = useState("");
  const [schoolLng, setSchoolLng] = useState("");
  const [radius, setRadius] = useState("");
  const [lateTime, setLateTime] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      if (data) {
        setSettings(data);
        setSchoolLat(data.school_latitude.toString());
        setSchoolLng(data.school_longitude.toString());
        setRadius(data.allowed_radius.toString());
        setLateTime(data.late_time.substring(0, 5));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("settings").update({
      school_latitude: parseFloat(schoolLat),
      school_longitude: parseFloat(schoolLng),
      allowed_radius: parseInt(radius),
      late_time: lateTime + ":00",
    }).eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings Saved", description: "School settings have been updated." });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> School Location & Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4 max-w-md">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>School Latitude</Label><Input type="number" step="any" value={schoolLat} onChange={(e) => setSchoolLat(e.target.value)} required /></div>
              <div><Label>School Longitude</Label><Input type="number" step="any" value={schoolLng} onChange={(e) => setSchoolLng(e.target.value)} required /></div>
            </div>
            <div><Label>Allowed Radius (meters)</Label><Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} required /></div>
            <div><Label>Late Time Threshold</Label><Input type="time" value={lateTime} onChange={(e) => setLateTime(e.target.value)} required /></div>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
