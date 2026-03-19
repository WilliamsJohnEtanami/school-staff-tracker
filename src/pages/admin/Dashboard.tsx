import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, UserCheck, UserX, Clock, ExternalLink, Loader2, Download, ChevronDown, ChevronUp, Search, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { getDistanceInMeters } from "@/lib/geo";
import * as XLSX from "xlsx";

const PAGE_SIZE = 25;

type SortKey = "timestamp" | "staff_name" | "status";
type SortDir = "asc" | "desc";

const AdminDashboard = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [attRes, staffRes, settRes] = await Promise.all([
      supabase.from("attendance").select("*").gte("created_at", dateFrom + "T00:00:00").lte("created_at", dateTo + "T23:59:59").order("timestamp", { ascending: false }).limit(5000),
      supabase.from("profiles").select("id", { count: "exact" }).eq("status", "active"),
      supabase.from("settings").select("*").limit(1).maybeSingle(),
    ]);
    setAttendance(attRes.data ?? []);
    setStaffCount(staffRes.count ?? 0);
    setSettings(settRes.data);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel("attendance-realtime-dash").on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance" }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const calcDistance = useCallback((lat: number, lng: number) => {
    if (!settings) return null;
    return getDistanceInMeters(lat, lng, settings.school_latitude, settings.school_longitude);
  }, [settings]);

  const filtered = useMemo(() => {
    let data = attendance.filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
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

  const todayRecords = attendance.filter(a => format(new Date(a.created_at), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"));
  const presentCount = todayRecords.filter(a => a.status === "present").length;
  const lateCount = todayRecords.filter(a => a.status === "late").length;
  const absentCount = Math.max(0, staffCount - todayRecords.length);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
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
    { label: "Total Staff", value: staffCount, icon: Users, color: "text-primary" },
    { label: "Present Today", value: presentCount, icon: UserCheck, color: "text-accent" },
    { label: "Absent Today", value: absentCount, icon: UserX, color: "text-destructive" },
    { label: "Late Today", value: lateCount, icon: Clock, color: "text-warning" },
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

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className={`p-3 rounded-full bg-muted ${c.color}`}>
                <c.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Attendance Records</CardTitle>
            <div className="flex gap-2">
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
                      return (
                        <Collapsible key={a.id} open={isExpanded} onOpenChange={() => setExpandedRow(isExpanded ? null : a.id)} asChild>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow className="cursor-pointer">
                                <TableCell className="w-8 p-2">
                                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </TableCell>
                                <TableCell className="font-medium">{a.staff_name}</TableCell>
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
                                  {dist !== null ? (
                                    <Badge variant={dist <= (settings?.allowed_radius ?? 200) ? "default" : "destructive"} className={dist <= (settings?.allowed_radius ?? 200) ? "bg-accent text-accent-foreground" : ""}>
                                      {Math.round(dist)}m
                                    </Badge>
                                  ) : "—"}
                                </TableCell>
                                <TableCell>
                                  <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm" onClick={e => e.stopPropagation()}>
                                    <ExternalLink className="h-3 w-3" /> Map
                                  </a>
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
                                      <p><span className="text-muted-foreground">Full Timestamp:</span> {a.timestamp}</p>
                                      <p><span className="text-muted-foreground">Created At:</span> {a.created_at}</p>
                                      <p><span className="text-muted-foreground">IP Address:</span> {a.ip_address ?? "N/A"}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium text-muted-foreground mb-1">Location</p>
                                      <p><span className="text-muted-foreground">Latitude:</span> {a.latitude}</p>
                                      <p><span className="text-muted-foreground">Longitude:</span> {a.longitude}</p>
                                      <p><span className="text-muted-foreground">Address:</span> {a.location_address ?? "N/A"}</p>
                                      <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 mt-1">
                                        <ExternalLink className="h-3 w-3" /> Open in Google Maps
                                      </a>
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

              {/* Pagination */}
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
