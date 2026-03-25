import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const StaffProfile = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!staffId) return;

    const fetchStaff = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, status, created_at, updated_at")
        .eq("id", staffId)
        .single();

      if (error) {
        console.error("Staff fetch error", error);
        setStaff(null);
      } else {
        setStaff(data);
      }
      setLoading(false);
    };

    fetchStaff();
  }, [staffId]);

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
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p>{new Date(staff.created_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Updated</p>
            <p>{new Date(staff.updated_at).toLocaleString()}</p>
          </div>
          <div className="pt-3">
            <Button className="w-full" onClick={() => navigate("/admin/staff")}>Back to Staff Management</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffProfile;
