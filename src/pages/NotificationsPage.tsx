import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import NotificationsPanel from "@/components/NotificationsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Calendar, MessageSquare } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type LeaveRequest = Tables<"leave_requests">;

const NotificationsPage = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [leaveReason, setLeaveReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!startDate || !endDate) {
      toast({ title: "Validation", description: "Please select start and end dates.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      setSubmitting(false);
      toast({ title: "Error", description: profileError.message, variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      staff_name: profile?.name || "Unknown",
      start_date: startDate,
      end_date: endDate,
      reason: leaveReason || null,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Request Submitted", description: "Your leave request has been submitted for approval." });
      setLeaveReason("");
      setStartDate("");
      setEndDate("");
    }
  };

  const isAdmin = role === "admin";

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "Admin" : "Staff"} Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Manage broadcasts and staff requests" : "View notifications and submit requests"}
          </p>
        </div>
        <Link to={isAdmin ? "/admin/dashboard" : "/staff"} className="text-sm text-primary hover:underline">
          Go Back
        </Link>
      </div>

      <Tabs defaultValue={isAdmin ? "broadcast" : "notifications"} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          {isAdmin ? (
            <>
              <TabsTrigger value="broadcast" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Broadcast
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                General Notifications
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Staff Requests
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                General Notifications
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Make Requests
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                My Requests
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {isAdmin ? (
          <>
            <TabsContent value="broadcast">
              <Card>
                <CardHeader>
                  <CardTitle>Send Broadcast Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <NotificationsPanel enableBroadcast />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>General Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <NotificationsPanel />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="requests">
              <StaffRequestsAdmin />
            </TabsContent>
          </>
        ) : (
          <>
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>General Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <NotificationsPanel />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="requests">
              <Card>
                <CardHeader>
                  <CardTitle>Submit Leave Request</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLeaveRequest} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="reason">Reason (Optional)</Label>
                      <Textarea
                        id="reason"
                        placeholder="Please provide a reason for your leave request..."
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button type="submit" disabled={submitting} className="w-full">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit Leave Request
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <StaffRequestsHistory />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

const StaffRequestsAdmin = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }

      setRequests(data ?? []);
      setLoading(false);
    };

    fetchRequests();
  }, [toast]);

  const updateRequestStatus = async (id: string, status: string, note?: string) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({ status, admin_note: note || null })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRequests((current) => current.map((request) => (
        request.id === id ? { ...request, status, admin_note: note ?? null } : request
      )));
      toast({ title: "Updated", description: `Request ${status}.` });
    }
  };

  if (loading) return <div>Loading requests...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Leave Requests</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.length === 0 ? (
            <p className="text-muted-foreground">No leave requests have been submitted yet.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">{request.staff_name}</p>
                    <p className="text-sm text-muted-foreground">{request.start_date} to {request.end_date}</p>
                  </div>
                  <Badge
                    variant={
                      request.status === "approved"
                        ? "default"
                        : request.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {request.status}
                  </Badge>
                </div>
                <p className="text-sm mb-2">Reason: {request.reason || "N/A"}</p>
                {request.admin_note && <p className="text-sm text-muted-foreground">Admin note: {request.admin_note}</p>}
                {request.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateRequestStatus(request.id, "approved")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateRequestStatus(request.id, "rejected")}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => navigate("/admin/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const StaffRequestsHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchRequests = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }

      setRequests(data ?? []);
      setLoading(false);
    };

    fetchRequests();
  }, [toast, user]);

  if (loading) return <div>Loading your requests...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Leave Requests</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.length === 0 ? (
            <p className="text-muted-foreground">You have not submitted any leave requests yet.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {request.start_date} to {request.end_date}
                    </p>
                  </div>
                  <Badge
                    variant={
                      request.status === "approved"
                        ? "default"
                        : request.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {request.status}
                  </Badge>
                </div>
                {request.reason && <p className="text-sm mb-2">Reason: {request.reason}</p>}
                {request.admin_note && <p className="text-sm text-muted-foreground">Admin note: {request.admin_note}</p>}
              </div>
            ))
          )}
        </div>
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => navigate("/staff")}>
            Back to Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationsPage;
