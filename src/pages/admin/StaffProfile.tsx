import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, User, Briefcase } from "lucide-react";

const StaffProfile = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [staff, setStaff] = useState<any | null>(null);
  const [contract, setContract] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingContract, setSavingContract] = useState(false);

  // Profile fields
  const [department, setDepartment] = useState("");
  const [shiftName, setShiftName] = useState("");

  // Contract fields
  const [contractedHours, setContractedHours] = useState("8");
  const [graceMinutes, setGraceMinutes] = useState("15");
  const [effectiveFrom, setEffectiveFrom] = useState("");

  useEffect(() => {
    if (!staffId) return;
    const fetchData = async () => {
      setLoading(true);
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id, user_id, name, email, status, department, shift_name, created_at, updated_at")
        .eq("id", staffId)
        .single();

      if (error || !profileData) {
        setStaff(null);
        setLoading(false);
        return;
      }

      setStaff(profileData);
      setDepartment(profileData.department ?? "");
      setShiftName(profileData.shift_name ?? "");

      // Fetch active contract
      const { data: contractData } = await supabase
        .from("staff_contracts")
        .select("*")
        .eq("user_id", profileData.user_id)
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contractData) {
        setContract(contractData);
        setContractedHours(contractData.contracted_hours.toString());
        setGraceMinutes(contractData.grace_minutes.toString());
        setEffectiveFrom(contractData.effective_from);
      } else {
        setEffectiveFrom(new Date().toISOString().split("T")[0]);
      }

      setLoading(false);
    };
    fetchData();
  }, [staffId]);

  const handleSaveProfile = async () => {
    if (!staff?.id) return;
    setSavingProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({ department: department.trim() || null, shift_name: shiftName.trim() || null })
      .eq("id", staff.id)
      .select("id, user_id, name, email, status, department, shift_name, created_at, updated_at")
      .single();
    setSavingProfile(false);
    if (error) {
      toast({ title: "Unable to save", description: error.message, variant: "destructive" });
      return;
    }
    setStaff(data);
    toast({ title: "Profile updated" });
  };

  const handleSaveContract = async () => {
    if (!staff?.user_id) return;
    const hours = parseFloat(contractedHours);
    const grace = parseInt(graceMinutes);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      toast({ title: "Invalid hours", description: "Contracted hours must be between 0.5 and 24.", variant: "destructive" });
      return;
    }
    if (isNaN(grace) || grace < 0) {
      toast({ title: "Invalid grace period", description: "Grace period must be 0 or more minutes.", variant: "destructive" });
      return;
    }

    setSavingContract(true);

    if (contract?.id) {
      // Update existing contract
      const { error } = await supabase
        .from("staff_contracts")
        .update({ contracted_hours: hours, grace_minutes: grace, effective_from: effectiveFrom })
        .eq("id", contract.id);
      setSavingContract(false);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      // Create new contract
      const { data, error } = await supabase
        .from("staff_contracts")
        .insert({ user_id: staff.user_id, contracted_hours: hours, grace_minutes: grace, effective_from: effectiveFrom })
        .select()
        .single();
      setSavingContract(false);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setContract(data);
    }

    toast({ title: "Contract saved", description: `${hours}h/day · ${grace}min grace period` });
  };

  if (loading) {
    return <div className="p-4 md:p-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!staff) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <p className="text-destructive">Staff member not found.</p>
        <Button onClick={() => navigate("/admin/staff")}>Back</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/staff")}>← Back</Button>
        <h1 className="text-2xl font-bold">{staff.name}</h1>
        <Badge variant={staff.status === "active" ? "default" : "secondary"}
          className={staff.status === "active" ? "bg-accent text-accent-foreground" : ""}>
          {staff.status}
        </Badge>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Profile Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{staff.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Member since</p>
              <p className="font-medium">{new Date(staff.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input id="department" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Science" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift">Shift</Label>
              <Input id="shift" value={shiftName} onChange={e => setShiftName(e.target.value)} placeholder="e.g. Morning" />
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm">
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Contract */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Work Contract
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sets the expected daily hours and late/short-day grace period for this staff member.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contracted-hours" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Hours / Day
              </Label>
              <Input
                id="contracted-hours"
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={contractedHours}
                onChange={e => setContractedHours(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">e.g. 8 for full-time, 4 for part-time</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grace-minutes">Grace Period (mins)</Label>
              <Input
                id="grace-minutes"
                type="number"
                min="0"
                max="120"
                step="5"
                value={graceMinutes}
                onChange={e => setGraceMinutes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Allowed shortfall before flagging</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective-from">Effective From</Label>
              <Input
                id="effective-from"
                type="date"
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
              />
            </div>
          </div>

          {contract && (
            <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Current contract: <span className="font-medium text-foreground">{contract.contracted_hours}h/day</span> · {contract.grace_minutes}min grace · active since {new Date(contract.effective_from).toLocaleDateString()}
            </div>
          )}

          <Button onClick={handleSaveContract} disabled={savingContract} size="sm">
            {savingContract ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {contract ? "Update Contract" : "Create Contract"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffProfile;
