import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const LeaveManagement = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (status: "approved" | "rejected") => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("leave_requests").update({ status, admin_note: adminNote || null }).eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Request ${status}`, description: `Leave request for ${selected.staff_name} has been ${status}.` });
      setSelected(null);
      setAdminNote("");
      fetchRequests();
    }
  };

  const statusVariant = (status: string) => {
    if (status === "approved") return "default";
    if (status === "rejected") return "destructive";
    return "secondary";
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Leave Requests</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : requests.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No leave requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.staff_name}</TableCell>
                      <TableCell>{format(new Date(r.start_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{format(new Date(r.end_date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.reason ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)} className={r.status === "approved" ? "bg-accent text-accent-foreground" : ""}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => { setSelected(r); setAdminNote(""); }}>
                            Review
                          </Button>
                        )}
                        {r.status !== "pending" && r.admin_note && (
                          <span className="text-xs text-muted-foreground italic">{r.admin_note}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setAdminNote(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Leave Request</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Staff:</span> {selected.staff_name}</p>
                <p><span className="text-muted-foreground">Dates:</span> {format(new Date(selected.start_date), "MMM d")} – {format(new Date(selected.end_date), "MMM d, yyyy")}</p>
                {selected.reason && <p><span className="text-muted-foreground">Reason:</span> {selected.reason}</p>}
              </div>
              <div>
                <Label>Note to staff (optional)</Label>
                <Input placeholder="e.g. Approved. Please arrange cover." value={adminNote} onChange={e => setAdminNote(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={saving} onClick={() => handleAction("approved")}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Approve
                </Button>
                <Button className="flex-1" variant="destructive" disabled={saving} onClick={() => handleAction("rejected")}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;
