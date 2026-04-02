import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Bell,
  Calendar,
  FilePlus2,
  History,
  Loader2,
  Menu,
  MessageSquareText,
  Send,
  type LucideIcon,
} from "lucide-react";
import AdminLeaveRequestsPanel from "@/components/AdminLeaveRequestsPanel";
import FeedbackCenter from "@/components/FeedbackCenter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import {
  getFunctionErrorMessage,
  getNotificationSystemErrorMessage,
  isMissingPublicTableError,
} from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";

type LeaveRequest = Tables<"leave_requests">;
type StaffSection = "notifications" | "feedback" | "requests" | "history";
type AdminSection = "broadcast" | "notifications" | "requests" | "feedback";
type SectionKey = StaffSection | AdminSection;

type SectionOption = {
  value: SectionKey;
  label: string;
  description: string;
  icon: LucideIcon;
};

const STAFF_SECTIONS: SectionOption[] = [
  {
    value: "notifications",
    label: "Notifications",
    description: "Open messages and review updates.",
    icon: Bell,
  },
  {
    value: "feedback",
    label: "Feedback",
    description: "Send complaints, suggestions, or questions to admin.",
    icon: MessageSquareText,
  },
  {
    value: "requests",
    label: "Make Request",
    description: "Submit a new leave request.",
    icon: FilePlus2,
  },
  {
    value: "history",
    label: "My Requests",
    description: "Track every leave request you have sent.",
    icon: History,
  },
];

const ADMIN_SECTIONS: SectionOption[] = [
  {
    value: "broadcast",
    label: "Broadcast",
    description: "Send a message to the whole team.",
    icon: Send,
  },
  {
    value: "notifications",
    label: "Notifications",
    description: "Review the current notification feed.",
    icon: Bell,
  },
  {
    value: "requests",
    label: "Staff Requests",
    description: "Approve or reject leave requests.",
    icon: Calendar,
  },
  {
    value: "feedback",
    label: "Feedback",
    description: "Reply directly to staff feedback threads.",
    icon: MessageSquareText,
  },
];

const getValidSection = (value: string | null, isAdmin: boolean): SectionKey => {
  const allowed = (isAdmin ? ADMIN_SECTIONS : STAFF_SECTIONS).map((section) => section.value);

  if (value && allowed.includes(value as SectionKey)) {
    return value as SectionKey;
  }

  return isAdmin ? "broadcast" : "notifications";
};

const NotificationsPage = () => {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sectionOptions = isAdmin ? ADMIN_SECTIONS : STAFF_SECTIONS;
  const activeSection = getValidSection(searchParams.get("view"), isAdmin);
  const selectedNotificationId = searchParams.get("notification");
  const activeSectionMeta = sectionOptions.find((section) => section.value === activeSection) ?? sectionOptions[0];

  const setView = (section: SectionKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("view", section);

    if (section !== "notifications") {
      next.delete("notification");
    }

    setSearchParams(next, { replace: true });
    setMobileMenuOpen(false);
  };

  const selectNotification = (notificationId: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set("view", "notifications");

    if (notificationId) {
      next.set("notification", notificationId);
    } else {
      next.delete("notification");
    }

    setSearchParams(next, { replace: true });
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "Admin Notifications" : "Notifications"}</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Manage broadcasts, leave requests, and direct staff feedback conversations."
              : "Read updates, send feedback, submit requests, and keep track of your leave history."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isAdmin ? (
            <Button variant="outline" size="sm" onClick={() => setView("requests")} className="hidden sm:inline-flex">
              <FilePlus2 className="mr-2 h-4 w-4" />
              Make Request
            </Button>
          ) : null}

          <Link
            to={isAdmin ? "/admin/dashboard" : "/staff"}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Go Back
          </Link>
        </div>
      </div>

      <div className="mb-6 hidden gap-2 md:grid md:grid-cols-3">
        {sectionOptions.map((section) => (
          <Button
            key={section.value}
            variant={activeSection === section.value ? "default" : "outline"}
            className="h-auto justify-start gap-3 px-4 py-3 text-left"
            onClick={() => setView(section.value)}
          >
            <section.icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{section.label}</div>
              <div className="truncate text-xs opacity-80">{section.description}</div>
            </div>
          </Button>
        ))}
      </div>

      <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 md:hidden">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Section</p>
          <h2 className="truncate text-lg font-semibold">{activeSectionMeta.label}</h2>
          <p className="text-sm text-muted-foreground">{activeSectionMeta.description}</p>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] sm:max-w-[280px]">
            <SheetHeader>
              <SheetTitle>Sections</SheetTitle>
              <SheetDescription>
                Switch between notifications, requests, and other actions from one clean menu.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-2">
              {sectionOptions.map((section) => (
                <Button
                  key={section.value}
                  variant={activeSection === section.value ? "default" : "ghost"}
                  className="h-auto w-full justify-start gap-3 px-3 py-3 text-left"
                  onClick={() => setView(section.value)}
                >
                  <section.icon className="h-4 w-4 shrink-0" />
                  <div>
                    <div>{section.label}</div>
                    <div className="text-xs opacity-80">{section.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {isAdmin ? (
        <>
          {activeSection === "broadcast" ? <BroadcastComposer /> : null}
          {activeSection === "notifications" ? (
            <NotificationInbox
              title="Admin Inbox"
              emptyMessage="No notifications have been sent yet."
              selectedNotificationId={selectedNotificationId}
              onSelectNotification={selectNotification}
            />
          ) : null}
          {activeSection === "requests" ? <AdminLeaveRequestsPanel /> : null}
          {activeSection === "feedback" ? <FeedbackCenter mode="admin" /> : null}
        </>
      ) : (
        <>
          {activeSection === "notifications" ? (
            <NotificationInbox
              title="Inbox"
              emptyMessage="No notifications yet."
              selectedNotificationId={selectedNotificationId}
              onSelectNotification={selectNotification}
              actionLabel="Make Request"
              onAction={() => setView("requests")}
            />
          ) : null}

          {activeSection === "requests" ? (
            <StaffLeaveRequestForm onSubmitted={() => setView("history")} />
          ) : null}

          {activeSection === "feedback" ? (
            <FeedbackCenter mode="staff" />
          ) : null}

          {activeSection === "history" ? (
            <StaffRequestsHistory onMakeRequest={() => setView("requests")} />
          ) : null}
        </>
      )}
    </div>
  );
};

const NotificationInbox = ({
  title,
  emptyMessage,
  selectedNotificationId,
  onSelectNotification,
  actionLabel,
  onAction,
}: {
  title: string;
  emptyMessage: string;
  selectedNotificationId: string | null;
  onSelectNotification: (notificationId: string | null) => void;
  actionLabel?: string;
  onAction?: () => void;
}) => {
  const { notifications, unreadCount, loading, error, markAllAsRead, markAsRead } = useNotifications();

  const selectedNotification = useMemo(
    () => notifications.find((notification) => notification.id === selectedNotificationId) ?? null,
    [notifications, selectedNotificationId]
  );

  useEffect(() => {
    if (selectedNotificationId && notifications.length > 0 && !selectedNotification) {
      onSelectNotification(null);
    }
  }, [notifications.length, onSelectNotification, selectedNotification, selectedNotificationId]);

  const openNotification = async (notificationId: string) => {
    onSelectNotification(notificationId);
    await markAsRead(notificationId);
  };

  if (selectedNotification) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={() => onSelectNotification(null)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {onAction && actionLabel ? (
              <Button variant="outline" size="sm" onClick={onAction}>
                <FilePlus2 className="mr-2 h-4 w-4" />
                {actionLabel}
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{selectedNotification.title}</CardTitle>
              <Badge variant={selectedNotification.read ? "secondary" : "default"}>
                {selectedNotification.read ? "Read" : "Unread"}
              </Badge>
            </div>
            <CardDescription>
              {format(new Date(selectedNotification.created_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-2xl border bg-muted/20 p-4 text-sm leading-6 whitespace-pre-wrap">
            {selectedNotification.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} waiting for you.`
                : "You're all caught up."}
            </CardDescription>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={() => void markAllAsRead()} disabled={!unreadCount || loading}>
              Mark all read
            </Button>
            {onAction && actionLabel ? (
              <Button variant="outline" size="sm" onClick={onAction}>
                <FilePlus2 className="mr-2 h-4 w-4" />
                {actionLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                onClick={() => void openNotification(notification.id)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40",
                  notification.read ? "bg-background" : "border-primary/30 bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      notification.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                    )}
                  >
                    {notification.title.trim().charAt(0).toUpperCase() || "N"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className={cn("truncate text-sm", !notification.read && "font-semibold")}>
                        {notification.title}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                  </div>

                  {!notification.read ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /> : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const BroadcastComposer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const sendBroadcast = async () => {
    if (!user?.id) {
      toast({ title: "Error", description: "You must be signed in to broadcast.", variant: "destructive" });
      return;
    }

    if (!title.trim() || !message.trim()) {
      toast({ title: "Validation", description: "Title and message are required.", variant: "destructive" });
      return;
    }

    setSending(true);
    setSchemaError(null);

    const { data, error } = await supabase.functions.invoke("broadcast-notification", {
      body: {
        title: title.trim(),
        message: message.trim(),
      },
    });

    if (error) {
      const errorMessage = getFunctionErrorMessage(error);
      const lowerMessage = errorMessage.toLowerCase();

      if (lowerMessage.includes("edge function")) {
        const fallbackInsert = await supabase.from("notifications").insert({
          title: title.trim(),
          message: message.trim(),
          created_by: user.id,
        });

        setSending(false);

        if (!fallbackInsert.error) {
          setTitle("");
          setMessage("");
          toast({ title: "Broadcast Sent", description: "All staff will see this message in notifications." });
          return;
        }

        if (isMissingPublicTableError(fallbackInsert.error, "notifications")) {
          setSchemaError(getNotificationSystemErrorMessage(fallbackInsert.error));
        } else {
          toast({ title: "Error", description: fallbackInsert.error.message, variant: "destructive" });
        }
        return;
      }

      setSending(false);

      if (
        isMissingPublicTableError(error, "notifications") ||
        lowerMessage.includes("notifications table") ||
        lowerMessage.includes("schema cache") ||
        lowerMessage.includes("supabase db push")
      ) {
        setSchemaError(errorMessage);
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
      return;
    }

    setSending(false);
    setTitle("");
    setMessage("");
    toast({ title: "Broadcast Sent", description: data?.message ?? "All staff will see this message in notifications." });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Broadcast Message</CardTitle>
        <CardDescription>
          Send a school-wide message to staff. Notifications themselves stay in the Notifications tab.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {schemaError ? <p className="text-sm text-destructive">{schemaError}</p> : null}

        <div className="space-y-2">
          <Label htmlFor="broadcast-title">Title</Label>
          <Input
            id="broadcast-title"
            placeholder="Broadcast title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="broadcast-message">Message</Label>
          <Textarea
            id="broadcast-message"
            rows={5}
            placeholder="Write the message staff should receive."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        <Button onClick={sendBroadcast} disabled={sending}>
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Send Broadcast
        </Button>
      </CardContent>
    </Card>
  );
};

const StaffLeaveRequestForm = ({ onSubmitted }: { onSubmitted: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaveReason, setLeaveReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLeaveRequest = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (!startDate || !endDate) {
      toast({ title: "Dates required", description: "Please select both dates.", variant: "destructive" });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Invalid date range",
        description: "The end date must be the same as or after the start date.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      setSubmitting(false);
      toast({ title: "Unable to submit", description: profileError.message, variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      staff_name: profile?.name || "Unknown",
      start_date: startDate,
      end_date: endDate,
      reason: leaveReason.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: "Unable to submit", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Request submitted",
      description: "Your leave request has been sent to admin for review.",
    });

    setLeaveReason("");
    setStartDate("");
    setEndDate("");
    onSubmitted();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Submit Leave Request</CardTitle>
        <CardDescription>Choose the dates you need and include any context that will help admin review it quickly.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleLeaveRequest} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-reason">Reason</Label>
            <Textarea
              id="leave-reason"
              rows={4}
              placeholder="Add a short reason or any handover note for admin."
              value={leaveReason}
              onChange={(event) => setLeaveReason(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
            Submit Leave Request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const StaffRequestsHistory = ({ onMakeRequest }: { onMakeRequest: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }

    let mounted = true;

    const fetchRequests = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!mounted) {
        return;
      }

      if (error) {
        toast({ title: "Unable to load requests", description: error.message, variant: "destructive" });
        setRequests([]);
        setLoading(false);
        return;
      }

      setRequests(data ?? []);
      setLoading(false);
    };

    fetchRequests();

    return () => {
      mounted = false;
    };
  }, [toast, user]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>My Leave Requests</CardTitle>
        <CardDescription>Track the status of every request you have submitted.</CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">You have not submitted any leave requests yet.</p>
            <Button variant="outline" className="mt-4" onClick={onMakeRequest}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              Make Request
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {format(new Date(request.start_date), "MMM d, yyyy")} to {format(new Date(request.end_date), "MMM d, yyyy")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted {format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}
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

                {request.reason ? (
                  <p className="mt-3 text-sm">
                    <span className="font-medium">Reason:</span> {request.reason}
                  </p>
                ) : null}

                {request.admin_note ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Admin note:</span> {request.admin_note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationsPage;
