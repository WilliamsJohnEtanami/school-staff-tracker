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
  MessageSquareText,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import AdminLeaveRequestsPanel from "@/components/AdminLeaveRequestsPanel";
import FeedbackCenter from "@/components/FeedbackCenter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { getFunctionErrorMessage, getNotificationSystemErrorMessage, isMissingPublicTableError } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";

type LeaveRequest = Tables<"leave_requests">;
type ProfileRow = Tables<"profiles">;
type StaffSection = "notifications" | "feedback" | "requests" | "history";
type AdminSection = "broadcast" | "notifications" | "requests" | "feedback";
type SectionKey = StaffSection | AdminSection;
type TargetAudience = "all" | "specific_staff" | "department" | "late_today" | "absent_today" | "shift";
type StaffAudienceProfile = Pick<
  ProfileRow,
  "user_id" | "name" | "email" | "status" | "department" | "shift_name"
>;
type AttendanceAudienceRow = {
  user_id: string;
  status: string;
};

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
    description: "Chat with admin about complaints, suggestions, or questions.",
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
    description: "Send a targeted message to the right staff.",
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
    description: "Reply directly to staff feedback conversations.",
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
  const { notifications } = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  const sectionOptions = isAdmin ? ADMIN_SECTIONS : STAFF_SECTIONS;
  const activeSection = getValidSection(searchParams.get("view"), isAdmin);
  const selectedNotificationId = searchParams.get("notification");

  const setView = (section: SectionKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("view", section);
    if (section !== "notifications") next.delete("notification");
    setSearchParams(next, { replace: true });
  };

  const selectNotification = (notificationId: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set("view", "notifications");
    if (notificationId) next.set("notification", notificationId);
    else next.delete("notification");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-4 md:px-6 pt-6 pb-0">
        <h1 className="text-2xl font-bold">{isAdmin ? "Notifications" : "Notifications"}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin
            ? "Broadcast messages, review requests and staff feedback."
            : "Stay updated, send requests and chat with admin."}
        </p>
      </div>

      {/* Pill tab bar */}
      <div className="px-4 md:px-6 pt-4 pb-0">
        <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto scrollbar-none">
          {sectionOptions.map((section) => {
            const isActive = activeSection === section.value;
            const showBadge = section.value === "notifications" && unreadCount > 0;
            return (
              <button
                key={section.value}
                onClick={() => setView(section.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-1 justify-center",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <section.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{section.label}</span>
                <span className="sm:hidden">{section.label.split(" ")[0]}</span>
                {showBadge && (
                  <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-4">
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
            {activeSection === "requests" ? <StaffLeaveRequestForm onSubmitted={() => setView("history")} /> : null}
            {activeSection === "feedback" ? <FeedbackCenter mode="staff" /> : null}
            {activeSection === "history" ? <StaffRequestsHistory onMakeRequest={() => setView("requests")} /> : null}
          </>
        )}
      </div>
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
            {selectedNotification.audience_summary ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{selectedNotification.audience_summary}</Badge>
                <span>
                  {selectedNotification.recipient_count} recipient
                  {selectedNotification.recipient_count === 1 ? "" : "s"}
                </span>
              </div>
            ) : null}
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
                    {notification.audience_summary ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        Sent to {notification.audience_summary} • {notification.recipient_count} recipient
                        {notification.recipient_count === 1 ? "" : "s"}
                      </p>
                    ) : null}
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

const normalizeText = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const BroadcastComposer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audienceType, setAudienceType] = useState<TargetAudience>("all");
  const [staffProfiles, setStaffProfiles] = useState<StaffAudienceProfile[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(true);
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [lateTodayIds, setLateTodayIds] = useState<string[]>([]);
  const [absentTodayIds, setAbsentTodayIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let mounted = true;

    const fetchAudienceData = async () => {
      setAudienceLoading(true);

      const today = format(new Date(), "yyyy-MM-dd");

      const [profilesRes, rolesRes, attendanceRes, leaveRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, name, email, status, department, shift_name")
          .eq("status", "active")
          .order("name"),
        supabase.from("user_roles").select("user_id").eq("role", "staff"),
        supabase
          .from("attendance")
          .select("user_id, status")
          .gte("timestamp", `${today}T00:00:00`)
          .lte("timestamp", `${today}T23:59:59`),
        supabase
          .from("leave_requests")
          .select("user_id")
          .eq("status", "approved")
          .lte("start_date", today)
          .gte("end_date", today),
      ]);

      if (!mounted) {
        return;
      }

      if (profilesRes.error || rolesRes.error || attendanceRes.error || leaveRes.error) {
        const firstError = profilesRes.error || rolesRes.error || attendanceRes.error || leaveRes.error;
        toast({
          title: "Audience load failed",
          description: firstError?.message ?? "Unable to load staff targeting data.",
          variant: "destructive",
        });
        setStaffProfiles([]);
        setLateTodayIds([]);
        setAbsentTodayIds([]);
        setAudienceLoading(false);
        return;
      }

      const staffRoleIds = new Set((rolesRes.data ?? []).map((row) => row.user_id));
      const activeStaff = ((profilesRes.data ?? []) as StaffAudienceProfile[]).filter((profile) =>
        staffRoleIds.has(profile.user_id)
      );
      const lateIds = Array.from(
        new Set(
          ((attendanceRes.data ?? []) as AttendanceAudienceRow[])
            .filter((row) => row.status === "late")
            .map((row) => row.user_id)
        )
      );
      const clockedInIds = new Set(
        ((attendanceRes.data ?? []) as AttendanceAudienceRow[])
          .filter((row) => row.status === "present" || row.status === "late")
          .map((row) => row.user_id)
      );
      const onLeaveIds = new Set((leaveRes.data ?? []).map((row) => row.user_id));
      const absentIds = activeStaff
        .filter((profile) => !clockedInIds.has(profile.user_id) && !onLeaveIds.has(profile.user_id))
        .map((profile) => profile.user_id);

      setStaffProfiles(activeStaff);
      setLateTodayIds(lateIds);
      setAbsentTodayIds(absentIds);
      setAudienceLoading(false);
    };

    void fetchAudienceData();

    return () => {
      mounted = false;
    };
  }, [toast, user?.id]);

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          staffProfiles
            .map((profile) => profile.department?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [staffProfiles]
  );

  const shiftOptions = useMemo(
    () =>
      Array.from(
        new Set(
          staffProfiles
            .map((profile) => profile.shift_name?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [staffProfiles]
  );

  const filteredStaffProfiles = useMemo(() => {
    if (!staffSearch.trim()) {
      return staffProfiles;
    }

    const query = staffSearch.trim().toLowerCase();
    return staffProfiles.filter((profile) => {
      const searchable = [
        profile.name,
        profile.email,
        profile.department ?? "",
        profile.shift_name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [staffProfiles, staffSearch]);

  const previewRecipients = useMemo(() => {
    if (audienceType === "all") {
      return staffProfiles;
    }

    if (audienceType === "specific_staff") {
      const selected = new Set(selectedStaffIds);
      return staffProfiles.filter((profile) => selected.has(profile.user_id));
    }

    if (audienceType === "department") {
      const selected = new Set(selectedDepartments.map(normalizeText));
      return staffProfiles.filter((profile) => selected.has(normalizeText(profile.department)));
    }

    if (audienceType === "shift") {
      const selected = new Set(selectedShifts.map(normalizeText));
      return staffProfiles.filter((profile) => selected.has(normalizeText(profile.shift_name)));
    }

    if (audienceType === "late_today") {
      const selected = new Set(lateTodayIds);
      return staffProfiles.filter((profile) => selected.has(profile.user_id));
    }

    const selected = new Set(absentTodayIds);
    return staffProfiles.filter((profile) => selected.has(profile.user_id));
  }, [
    absentTodayIds,
    audienceType,
    lateTodayIds,
    selectedDepartments,
    selectedShifts,
    selectedStaffIds,
    staffProfiles,
  ]);

  const audienceSummary = useMemo(() => {
    if (audienceType === "all") return "All active staff";
    if (audienceType === "specific_staff") return "Selected staff members";
    if (audienceType === "department") return "Selected departments";
    if (audienceType === "shift") return "Selected shifts";
    if (audienceType === "late_today") return "Staff marked late today";
    return "Staff absent today";
  }, [audienceType]);

  const toggleSelection = (values: string[], nextValue: string) =>
    values.includes(nextValue)
      ? values.filter((value) => value !== nextValue)
      : [...values, nextValue];

  const resetTargeting = () => {
    setAudienceType("all");
    setSelectedStaffIds([]);
    setSelectedDepartments([]);
    setSelectedShifts([]);
    setStaffSearch("");
  };

  const sendBroadcast = async () => {
    if (!user?.id) {
      toast({ title: "Error", description: "You must be signed in to broadcast.", variant: "destructive" });
      return;
    }

    if (!title.trim() || !message.trim()) {
      toast({ title: "Validation", description: "Title and message are required.", variant: "destructive" });
      return;
    }

    if (previewRecipients.length === 0) {
      toast({ title: "No matching staff", description: "Choose an audience with at least one recipient.", variant: "destructive" });
      return;
    }

    setSending(true);
    setSchemaError(null);

    const { data, error } = await supabase.functions.invoke("broadcast-notification", {
      body: {
        title: title.trim(),
        message: message.trim(),
        audienceType,
        staffUserIds: selectedStaffIds,
        departments: selectedDepartments,
        shifts: selectedShifts,
      },
    });

    setSending(false);

    if (error) {
      const errorMessage = getFunctionErrorMessage(error);
      const lowerMessage = errorMessage.toLowerCase();
      const schemaLikeError = { message: errorMessage };

      if (
        isMissingPublicTableError(schemaLikeError, "notifications") ||
        isMissingPublicTableError(schemaLikeError, "notification_recipients") ||
        lowerMessage.includes("notification") ||
        lowerMessage.includes("schema cache") ||
        lowerMessage.includes("supabase db push")
      ) {
        setSchemaError(getNotificationSystemErrorMessage(schemaLikeError));
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
      return;
    }

    setTitle("");
    setMessage("");
    resetTargeting();
    toast({
      title: "Notification Sent",
      description:
        data?.message ??
        `Your notification has been sent to ${previewRecipients.length} staff member${previewRecipients.length === 1 ? "" : "s"}.`,
    });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Targeted Notification</CardTitle>
        <CardDescription>
          Send a message to all staff, selected staff, departments, late staff, absent staff, or everyone on a chosen shift.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {schemaError ? <p className="text-sm text-destructive">{schemaError}</p> : null}

        {audienceLoading ? (
          <div className="flex items-center justify-center rounded-2xl border p-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="audience-type">Audience</Label>
          <Select value={audienceType} onValueChange={(value: TargetAudience) => setAudienceType(value)}>
            <SelectTrigger id="audience-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All active staff</SelectItem>
              <SelectItem value="specific_staff">Specific staff</SelectItem>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="late_today">Late staff only</SelectItem>
              <SelectItem value="absent_today">Absent staff only</SelectItem>
              <SelectItem value="shift">Shift</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        {audienceType === "specific_staff" ? (
          <div className="space-y-3 rounded-2xl border p-4">
            <div className="space-y-2">
              <Label htmlFor="staff-search">Choose Staff</Label>
              <Input
                id="staff-search"
                placeholder="Search by name, email, department, or shift"
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
              />
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {filteredStaffProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff matched your search.</p>
              ) : (
                filteredStaffProfiles.map((profile) => (
                  <label
                    key={profile.user_id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2"
                  >
                    <Checkbox
                      checked={selectedStaffIds.includes(profile.user_id)}
                      onCheckedChange={() => setSelectedStaffIds((current) => toggleSelection(current, profile.user_id))}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.department || "No department"} • {profile.shift_name || "No shift"}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}

        {audienceType === "department" ? (
          <div className="space-y-3 rounded-2xl border p-4">
            <Label>Select Departments</Label>
            {departmentOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No departments are configured yet. Add them in staff profiles first.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {departmentOptions.map((department) => (
                  <label key={department} className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2">
                    <Checkbox
                      checked={selectedDepartments.includes(department)}
                      onCheckedChange={() =>
                        setSelectedDepartments((current) => toggleSelection(current, department))
                      }
                    />
                    <span className="text-sm">{department}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {audienceType === "shift" ? (
          <div className="space-y-3 rounded-2xl border p-4">
            <Label>Select Shifts</Label>
            {shiftOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No shifts are configured yet. Add them in staff profiles first.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {shiftOptions.map((shift) => (
                  <label key={shift} className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2">
                    <Checkbox
                      checked={selectedShifts.includes(shift)}
                      onCheckedChange={() => setSelectedShifts((current) => toggleSelection(current, shift))}
                    />
                    <span className="text-sm">{shift}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{audienceSummary}</p>
              <p className="text-sm text-muted-foreground">
                {previewRecipients.length} recipient{previewRecipients.length === 1 ? "" : "s"} matched right now.
              </p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3.5 w-3.5" />
              {previewRecipients.length}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {previewRecipients.slice(0, 6).map((profile) => (
              <Badge key={profile.user_id} variant="outline">
                {profile.name}
              </Badge>
            ))}
            {previewRecipients.length > 6 ? (
              <Badge variant="outline">+{previewRecipients.length - 6} more</Badge>
            ) : null}
          </div>
        </div>

        <Button onClick={sendBroadcast} disabled={sending || audienceLoading}>
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Send Notification
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
