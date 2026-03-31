import { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NotificationsPanel from "@/components/NotificationsPanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserCheck, UserX, Clock, ExternalLink, Loader2, Download, ChevronDown, ChevronUp, Search, ArrowUpDown, Plus, Bell, BellRing, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";
import { getDistanceInMeters } from "@/lib/geo";
import { useToast } from "@/hooks/use-toast";
import { useReminders } from "@/hooks/use-reminders";
import * as XLSX from "xlsx";

const PAGE_SIZE = 25;

type SortKey = "timestamp" | "staff_name" | "status";
type SortDir = "asc" | "desc";

const AdminDashboard = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approvedLeaveToday, setApprovedLeaveToday] = useState(0);
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "late" | "break" | "absent" | "on_leave" | "anomalies">("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [workSessions, setWorkSessions] = useState<any[]>([]);
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { toast } = useToast();
  const { loading: reminderLoading, triggerClockInReminders, triggerClockOutReminders, triggerWeeklyReports, triggerPendingLeaveReminders } = useReminders();

  // Override dialog state
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStaffId, setOverrideStaffId] = useState("");
  const [overrideStaffName, setOverrideStaffName] = useState("");
  const [overrideDate, setOverrideDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [overrideTime, setOverrideTime] = useState("08:00");
  const [overrideStatus, setOverrideStatus] = useState("present");
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [attRes, staffRes, settRes, leaveRes, workSessionRes, allLeaveRes] = await Promise.all([
      supabase.from("attendance").select("*").gte("created_at", dateFrom + "T00:00:00").lte("created_at", dateTo + "T23:59:59").order("timestamp", { ascending: false }).limit(5000),
      supabase.from("profiles").select("id, name, user_id, status").order("name"),
      supabase.from("settings").select("*").limit(1).maybeSingle(),
      supabase.from("leave_requests").select("*").eq("status", "approved").lte("start_date", format(new Date(), "yyyy-MM-dd")).gte("end_date", format(new Date(), "yyyy-MM-dd")),
      supabase.from("work_sessions").select("*").gte("session_date", dateFrom).lte("session_date", dateTo).order("started_at", { ascending: false }).limit(1000),
      supabase.from("leave_requests").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setAttendance(attRes.data ?? []);
    setStaffList(staffRes.data ?? []);
    setStaffCount((staffRes.data ?? []).filter((s: any) => s.status === "active").length);
    setSettings(settRes.data);
    setApprovedLeaveToday((leaveRes.data ?? []).length);
    setWorkSessions(workSessionRes.data ?? []);
    setLeaveRequests(allLeaveRes.data ?? []);

    const events: any[] = [];
    (attRes.data ?? []).forEach((a: any) => {
      events.push({
        id: `attendance-${a.id}`,
        time: a.created_at || a.timestamp,
        text: `${a.staff_name} ${a.status === 'present' ? 'clocked in' : a.status === 'late' ? 'clocked in late' : a.status === 'break' ? 'started break' : a.status}`,
        type: 'attendance',
      });
    });
    (allLeaveRes.data ?? []).forEach((l: any) => {
      events.push({
        id: `leave-${l.id}`,
        time: l.created_at,
        text: `${l.staff_name} requested leave (${l.status}) from ${l.start_date} to ${l.end_date}`,
        type: 'leave',
      });
    });
    setActivityEvents(events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));

    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'present' || statusParam === 'late' || statusParam === 'break' || statusParam === 'absent') {
      setStatusFilter(statusParam);
    } else if (statusParam === 'on_leave') {
      setStatusFilter('all');
      setComplianceFilter('all');
    } else if (statusParam === 'anomalies') {
      setComplianceFilter('outside');
    }

    fetchData();

    // Set up real-time listener for new attendance records
    const channel = supabase
      .channel("attendance-realtime-dash")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        (payload) => {
          console.log("Attendance change detected:", payload);
          fetchData(); // Refetch all data when attendance changes
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, searchParams]);

  const calcDistance = useCallback((lat: number, lng: number) => {
    if (!settings) return null;
    return getDistanceInMeters(lat, lng, settings.school_latitude, settings.school_longitude);
  }, [settings]);

  const filtered = useMemo(() => {
    let data = attendance.filter(a => {
      if (statusFilter !== "all" && statusFilter !== "anomalies" && statusFilter !== "on_leave") {
        if (a.status !== statusFilter) return false;
      }
      if (statusFilter === "anomalies" && settings) {
        const d = calcDistance(a.latitude, a.longitude);
        if (d === null || d <= settings.allowed_radius) return false;
      }
      if (statusFilter === "on_leave") {
        return false;
      }
      if (deviceFilter !== "all" && (a.device_type ?? "Desktop") !== deviceFilter) return false;
      if (complianceFilter !== "all" && settings) {
        const d = calcDistance(a.latitude, a.longitude);
        if (complianceFilter === "inside" && d !== null && d > settings.allowed_radius) return false;
        if (complianceFilter === "outside" && d !== null && d <= settings.allowed_radius) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [a.staff_name, a.status, a.browser, a.operating_system, a.device_type, a.ip_address, a.location_address].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });

    data.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "timestamp") cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      else if (sortKey === "staff_name") cmp = (a.staff_name ?? "").localeCompare(b.staff_name ?? "");
      else if (sortKey === "status") cmp = (a.status ?? "").localeCompare(b.status ?? "");
      return sortDir === "desc" ? -cmp : cmp;
    });

    return data;
  }, [attendance, statusFilter, deviceFilter, complianceFilter, searchQuery, sortKey, sortDir, settings, calcDistance]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => setPage(0), [statusFilter, deviceFilter, complianceFilter, searchQuery, sortKey, sortDir, dateFrom, dateTo]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayRecords = attendance.filter(a => {
    const recordTime = new Date(a.timestamp || a.created_at);
    return recordTime >= todayStart && recordTime <= todayEnd;
  });

  const presentCount = todayRecords.filter(a => a.status === "present").length;
  const lateCount = todayRecords.filter(a => a.status === "late").length;
  const breakCount = todayRecords.filter(a => a.status === "break").length;
  
  // Get unique staff who have clocked in today
  const clockedInStaff = new Set(todayRecords.map(a => a.user_id));
  const onLeaveToday = approvedLeaveToday;
  const absentCount = Math.max(0, staffCount - clockedInStaff.size - onLeaveToday);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleStatsClick = (statusValue: string) => {
    setStatusFilter(statusValue as any);
    // Scroll to table
    setTimeout(() => {
      document.querySelector('[data-table-section]')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleOverrideStaffChange = (userId: string) => {
    setOverrideStaffId(userId);
    const staff = staffList.find(s => s.user_id === userId);
    setOverrideStaffName(staff?.name ?? "");
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideStaffId || !overrideStaffName) return;
    setOverrideSaving(true);
    const timestamp = new Date(`${overrideDate}T${overrideTime}:00`).toISOString();
    const { error } = await supabase.from("attendance").insert({
      user_id: overrideStaffId,
      staff_name: overrideStaffName,
      timestamp,
      latitude: settings?.school_latitude ?? 0,
      longitude: settings?.school_longitude ?? 0,
      status: overrideStatus,
      device_info: `Manual override${overrideNote ? `: ${overrideNote}` : ""}`,
      device_type: "Manual",
      browser: "Admin Override",
      operating_system: "N/A",
    });
    setOverrideSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Record Added", description: `Attendance manually recorded for ${overrideStaffName}.` });
      setOverrideOpen(false);
      setOverrideNote("");
      fetchData();
    }
  };

  const buildExportData = () => filtered.map(a => ({
    "Staff Name": a.staff_name ?? "",
    "User ID": a.user_id ?? "",
    "Date": format(new Date(a.timestamp), "yyyy-MM-dd"),
    "Time": format(new Date(a.timestamp), "HH:mm:ss"),
    "Full Timestamp": a.timestamp,
    "Status": a.status ?? "",
    "Latitude": a.latitude ?? "",
    "Longitude": a.longitude ?? "",
    "Location Address": a.location_address ?? "",
    "IP Address": a.ip_address ?? "",
    "Device Type": a.device_type ?? "",
    "Operating System": a.operating_system ?? "",
    "Browser": a.browser ?? "",
    "Device Info": a.device_info ?? "",
    "Distance from School (m)": calcDistance(a.latitude, a.longitude)?.toFixed(0) ?? "",
    "Record Created At": a.created_at ?? "",
  }));

  const exportCSV = () => {
    const rows = buildExportData();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${(r as any)[h] ?? ""}"`).join(","))].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), `attendance_${dateFrom}_${dateTo}.csv`);
  };

  const exportExcel = () => {
    const rows = buildExportData();
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `attendance_${dateFrom}_${dateTo}.xlsx`);
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    { label: "Total Staff", value: staffCount, icon: Users, color: "text-primary", clickable: false },
    { label: "Clocked In Today", value: presentCount, icon: UserCheck, color: "text-accent", clickable: true, filter: "present" },
    { label: "Absent Today", value: absentCount, icon: UserX, color: "text-destructive", clickable: true, filter: "absent" },
    { label: "Late Today", value: lateCount, icon: Clock, color: "text-warning", clickable: true, filter: "late" },
  ];

  const SortableHead = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        {sortKey === field && <span className="text-xs">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </TableHead>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { value: 'all', label: 'All' },
          { value: 'present', label: 'Clocked In' },
          { value: 'late', label: 'Late' },
          { value: 'break', label: 'Break' },
          { value: 'absent', label: 'Absent' },
          { value: 'on_leave', label: 'On Leave' },
          { value: 'anomalies', label: 'Anomalies' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setStatusFilter(option.value as any)}
            className={`rounded-full px-3 py-1 text-xs border transition ${statusFilter === option.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-border text-foreground hover:bg-primary/10'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label} className={c.clickable ? "cursor-pointer transition-all hover:shadow-lg hover:border-primary" : ""}>
            <CardContent 
              className="pt-6 flex items-center gap-4"
              onClick={() => c.clickable && handleStatsClick((c as any).filter)}
              role={c.clickable ? "button" : undefined}
              tabIndex={c.clickable ? 0 : undefined}
              onKeyDown={(e) => c.clickable && e.key === 'Enter' && handleStatsClick((c as any).filter)}
            >
              <div className={`p-3 rounded-full bg-muted ${c.color}`}>
                <c.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                {c.clickable && <p className="text-xs text-primary font-medium mt-1">Click to filter</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Quick Actions</h3>
        <Link to="/notifications" className="text-sm text-primary hover:underline">Go to Notifications</Link>
      </div>
      <NotificationsPanel enableBroadcast={true} />

      {/* Reminder Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manual Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              variant="outline"
              onClick={triggerClockInReminders}
              disabled={reminderLoading}
              className="flex items-center gap-2 h-auto p-4"
            >
              <Bell className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Clock In</div>
                <div className="text-xs text-muted-foreground">Send reminders to staff who haven't clocked in</div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={triggerClockOutReminders}
              disabled={reminderLoading}
              className="flex items-center gap-2 h-auto p-4"
            >
              <BellRing className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Clock Out</div>
                <div className="text-xs text-muted-foreground">Send reminders to staff who haven't clocked out</div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={triggerWeeklyReports}
              disabled={reminderLoading}
              className="flex items-center gap-2 h-auto p-4"
            >
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Weekly Report</div>
                <div className="text-xs text-muted-foreground">Send weekly attendance summary to admin</div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={triggerPendingLeaveReminders}
              disabled={reminderLoading}
              className="flex items-center gap-2 h-auto p-4"
            >
              <Calendar className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Pending Leave</div>
                <div className="text-xs text-muted-foreground">Remind admin about pending leave requests</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Work Session Details */}
      <Card>
        <CardHeader>
          <CardTitle>Work Sessions & Breaks</CardTitle>
        </CardHeader>
        <CardContent>
          {workSessions.length === 0 ? (
            <p className="text-muted-foreground">No work sessions recorded for the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workSessions.map((ws) => {
                    const start = ws.started_at ? new Date(ws.started_at) : null;
                    const end = ws.ended_at ? new Date(ws.ended_at) : null;
                    const duration = start && end ? `${((end.getTime() - start.getTime()) / 3600000).toFixed(2)}h` : "Ongoing";
                    return (
                      <TableRow key={ws.id}>
                        <TableCell>{ws.user_id || ws.staff_name}</TableCell>
                        <TableCell>{ws.session_date}</TableCell>
                        <TableCell>{ws.type}</TableCell>
                        <TableCell>{start ? start.toLocaleTimeString() : "-"}</TableCell>
                        <TableCell>{end ? end.toLocaleTimeString() : "-"}</TableCell>
                        <TableCell>{duration}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          {activityEvents.length === 0 ? (
            <p className="text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {activityEvents.slice(0, 50).map((evt) => (
                <div key={evt.id} className="p-3 border rounded-lg">
                  <p className="text-sm font-medium">{evt.text}</p>
                  <p className="text-xs text-muted-foreground">{new Date(evt.time).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card data-table-section="true">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Attendance Records</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Record</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Manual Attendance Override</DialogTitle></DialogHeader>
                  <form onSubmit={handleOverrideSubmit} className="space-y-4">
                    <div>
                      <Label>Staff Member</Label>
                      <Select value={overrideStaffId} onValueChange={handleOverrideStaffChange} required>
                        <SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger>
                        <SelectContent>
                          {staffList.map(s => (
                            <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Date</Label>
                        <Input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} required />
                      </div>
                      <div>
                        <Label>Time</Label>
                        <Input type="time" value={overrideTime} onChange={e => setOverrideTime(e.target.value)} required />
                      </div>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Reason / Note (optional)</Label>
                      <Input placeholder="e.g. GPS failure, off-site duty..." value={overrideNote} onChange={e => setOverrideNote(e.target.value)} />
                    </div>
                    <Button type="submit" disabled={overrideSaving || !overrideStaffId} className="w-full">
                      {overrideSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Save Record
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportExcel} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-3">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto" />
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 w-[180px]" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="Desktop">Desktop</SelectItem>
                <SelectItem value="Mobile">Mobile</SelectItem>
                <SelectItem value="Tablet">Tablet</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={complianceFilter} onValueChange={setComplianceFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="inside">Inside Radius</SelectItem>
                <SelectItem value="outside">Outside Radius</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No records found</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <SortableHead label="Name" field="staff_name" />
                      <SortableHead label="Date" field="timestamp" />
                      <TableHead>Time</TableHead>
                      <SortableHead label="Status" field="status" />
                      <TableHead>IP Address</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map(a => {
                      const dist = calcDistance(a.latitude, a.longitude);
                      const isExpanded = expandedRow === a.id;
                      const isManual = a.device_type === "Manual";
                      return (
                        <Collapsible key={a.id} open={isExpanded} onOpenChange={() => setExpandedRow(isExpanded ? null : a.id)} asChild>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow className={`cursor-pointer ${isManual ? "bg-muted/40" : ""}`}>
                                <TableCell className="w-8 p-2">
                                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {a.staff_name}
                                  {isManual && <span className="ml-1 text-xs text-muted-foreground">(manual)</span>}
                                </TableCell>
                                <TableCell>{format(new Date(a.timestamp), "MMM d, yyyy")}</TableCell>
                                <TableCell>{format(new Date(a.timestamp), "h:mm a")}</TableCell>
                                <TableCell>
                                  <Badge variant={a.status === "late" ? "destructive" : "default"} className={a.status !== "late" ? "bg-accent text-accent-foreground" : ""}>
                                    {a.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono">{a.ip_address ?? "—"}</TableCell>
                                <TableCell>{a.device_type ?? "—"}</TableCell>
                                <TableCell>
                                  {isManual ? "—" : dist !== null ? (
                                    <Badge variant={dist <= (settings?.allowed_radius ?? 200) ? "default" : "destructive"} className={dist <= (settings?.allowed_radius ?? 200) ? "bg-accent text-accent-foreground" : ""}>
                                      {Math.round(dist)}m
                                    </Badge>
                                  ) : "—"}
                                </TableCell>
                                <TableCell>
                                  {isManual ? "—" : (
                                    <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm" onClick={e => e.stopPropagation()}>
                                      <ExternalLink className="h-3 w-3" /> Map
                                    </a>
                                  )}
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <tr>
                                <td colSpan={8} className="bg-muted/30 px-6 py-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <p className="font-medium text-muted-foreground mb-1">Full Details</p>
                                      <p><span className="text-muted-foreground">User ID:</span> {a.user_id}</p>
                                      <p><span className="text-muted-foreground">Clock In:</span> {format(new Date(a.timestamp), "h:mm a")}</p>
                                      <p><span className="text-muted-foreground">Clock Out:</span> {a.clock_out ? format(new Date(a.clock_out), "h:mm a") : "Not clocked out"}</p>
                                      {a.clock_out && (
                                        <p><span className="text-muted-foreground">Hours Worked:</span> {((new Date(a.clock_out).getTime() - new Date(a.timestamp).getTime()) / 3600000).toFixed(1)}h</p>
                                      )}
                                      <p><span className="text-muted-foreground">IP Address:</span> {a.ip_address ?? "N/A"}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium text-muted-foreground mb-1">Location</p>
                                      <p><span className="text-muted-foreground">Latitude:</span> {a.latitude}</p>
                                      <p><span className="text-muted-foreground">Longitude:</span> {a.longitude}</p>
                                      <p><span className="text-muted-foreground">Address:</span> {a.location_address ?? "N/A"}</p>
                                      {!isManual && (
                                        <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 mt-1">
                                          <ExternalLink className="h-3 w-3" /> Open in Google Maps
                                        </a>
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium text-muted-foreground mb-1">Device Info</p>
                                      <p><span className="text-muted-foreground">Type:</span> {a.device_type ?? "N/A"}</p>
                                      <p><span className="text-muted-foreground">Browser:</span> {a.browser ?? "N/A"}</p>
                                      <p><span className="text-muted-foreground">OS:</span> {a.operating_system ?? "N/A"}</p>
                                      <p className="mt-1 text-xs text-muted-foreground break-all">{a.device_info ?? "N/A"}</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
