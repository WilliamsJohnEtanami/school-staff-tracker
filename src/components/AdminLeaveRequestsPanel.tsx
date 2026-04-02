import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LeaveRequest = Tables<"leave_requests">;
type ReviewAction = "approved" | "rejected";

const statusVariant = (status: LeaveRequest["status"]) => {
  if (status === "approved") {
    return "default";
  }

  if (status === "rejected") {
    return "destructive";
  }

  return "secondary";
};

const AdminLeaveRequestsPanel = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Unable to load requests", description: error.message, variant: "destructive" });
      setRequests([]);
      setLoading(false);
      return;
    }

    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const counts = useMemo(() => ({
    pending: requests.filter((request) => request.status === "pending").length,
    approved: requests.filter((request) => request.status === "approved").length,
    rejected: requests.filter((request) => request.status === "rejected").length,
  }), [requests]);

  const openReview = (request: LeaveRequest) => {
    setSelected(request);
    setAdminNote(request.admin_note ?? "");
  };

  const closeReview = () => {
    setSelected(null);
    setAdminNote("");
  };

  const updateRequest = async (
    request: LeaveRequest,
    status: ReviewAction,
    note: string | null = null
  ) => {
    setSavingRequestId(request.id);

    const { error } = await supabase
      .from("leave_requests")
      .update({ status, admin_note: note })
      .eq("id", request.id);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      setSavingRequestId(null);
      return;
    }

    setRequests((current) =>
      current.map((row) =>
        row.id === request.id ? { ...row, status, admin_note: note } : row
      )
    );

    toast({
      title: status === "approved" ? "Leave approved" : "Leave rejected",
      description: `${request.staff_name}'s request has been ${status}.`,
    });

    setSavingRequestId(null);
    closeReview();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Leave Approval Queue</CardTitle>
            <CardDescription>Review, approve, or reject staff leave requests from one place.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="mt-1 text-2xl font-semibold">{counts.pending}</p>
          </div>
          <div className="rounded-2xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="mt-1 text-2xl font-semibold">{counts.approved}</p>
          </div>
          <div className="rounded-2xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="mt-1 text-2xl font-semibold">{counts.rejected}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            No leave requests have been submitted yet.
          </p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const isSaving = savingRequestId === request.id;

              return (
                <div key={request.id} className="rounded-2xl border bg-background p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold">{request.staff_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.start_date), "MMM d, yyyy")} to {format(new Date(request.end_date), "MMM d, yyyy")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted {format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Badge
                      variant={statusVariant(request.status)}
                      className={request.status === "approved" ? "bg-accent text-accent-foreground" : ""}
                    >
                      {request.status}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Reason:</span> {request.reason?.trim() || "No reason provided."}
                    </p>
                    {request.admin_note ? (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Admin note:</span> {request.admin_note}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    {request.status === "pending" ? (
                      <>
                        <Button
                          className="sm:flex-1"
                          disabled={isSaving}
                          onClick={() => void updateRequest(request, "approved")}
                        >
                          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          className="sm:flex-1"
                          disabled={isSaving}
                          onClick={() => void updateRequest(request, "rejected")}
                        >
                          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Reject
                        </Button>
                      </>
                    ) : null}
                    <Button variant="outline" className="sm:flex-1" onClick={() => openReview(request)}>
                      {request.status === "pending" ? "Review and Add Note" : "View Details"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) closeReview(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-2xl border bg-muted/30 p-4 text-sm">
                <p><span className="font-medium">Staff:</span> {selected.staff_name}</p>
                <p>
                  <span className="font-medium">Dates:</span> {format(new Date(selected.start_date), "MMM d, yyyy")} to {format(new Date(selected.end_date), "MMM d, yyyy")}
                </p>
                <p><span className="font-medium">Status:</span> {selected.status}</p>
                <p><span className="font-medium">Reason:</span> {selected.reason?.trim() || "No reason provided."}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-note">Admin note</Label>
                <Textarea
                  id="admin-note"
                  rows={4}
                  placeholder="Add context for the staff member if needed."
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                />
              </div>

              {selected.status === "pending" ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="sm:flex-1"
                    disabled={savingRequestId === selected.id}
                    onClick={() => void updateRequest(selected, "approved", adminNote.trim() || null)}
                  >
                    {savingRequestId === selected.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="sm:flex-1"
                    disabled={savingRequestId === selected.id}
                    onClick={() => void updateRequest(selected, "rejected", adminNote.trim() || null)}
                  >
                    {savingRequestId === selected.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Reject
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={closeReview}>
                  Close
                </Button>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminLeaveRequestsPanel;
