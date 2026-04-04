import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const StaffProfile = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [department, setDepartment] = useState("");
  const [shiftName, setShiftName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!staffId) return;

    const fetchStaff = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, status, department, shift_name, created_at, updated_at")
        .eq("id", staffId)
        .single();

      if (error) {
        console.error("Staff fetch error", error);
        setStaff(null);
      } else {
        setStaff(data);
        setDepartment(data.department ?? "");
        setShiftName(data.shift_name ?? "");
      }
      setLoading(false);
    };

    fetchStaff();
  }, [staffId]);

  const handleSaveProfile = async () => {
    if (!staff?.id) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        department: department.trim() || null,
        shift_name: shiftName.trim() || null,
      })
      .eq("id", staff.id)
      .select("id, name, email, status, department, shift_name, created_at, updated_at")
      .single();

    setSaving(false);

    if (error) {
      toast({ title: "Unable to save", description: error.message, variant: "destructive" });
      return;
    }

    setStaff(data);
    toast({ title: "Profile updated", description: "Department and shift details have been saved." });
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-destructive">Staff member not found.</p>
        <div className="mt-4">
          <Button onClick={() => navigate("/admin/staff")}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Staff Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{staff.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{staff.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={staff.status === "active" ? "default" : "secondary"}>
              {staff.status}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="e.g. Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-name">Shift</Label>
              <Input
                id="shift-name"
                value={shiftName}
                onChange={(event) => setShiftName(event.target.value)}
                placeholder="e.g. Morning"
              />
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p>{new Date(staff.created_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Updated</p>
            <p>{new Date(staff.updated_at).toLocaleString()}</p>
          </div>
          <div className="grid gap-2 pt-3 sm:grid-cols-2">
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Details
            </Button>
            <Button className="w-full" variant="outline" onClick={() => navigate("/admin/staff")}>Back to Staff Management</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffProfile;
