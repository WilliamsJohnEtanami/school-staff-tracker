import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserCheck, UserX, Clock, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";

const AdminDashboard = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [attRes, staffRes] = await Promise.all([
      supabase.from("attendance").select("*").gte("created_at", dateFilter + "T00:00:00").lte("created_at", dateFilter + "T23:59:59").order("timestamp", { ascending: false }),
      supabase.from("profiles").select("id", { count: "exact" }).eq("status", "active"),
    ]);
    setAttendance(attRes.data ?? []);
    setStaffCount(staffRes.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase.channel("attendance-realtime").on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance" }, () => {
      fetchData();
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dateFilter]);

  const presentCount = attendance.filter(a => a.status === "present").length;
  const lateCount = attendance.filter(a => a.status === "late").length;
  const absentCount = Math.max(0, staffCount - attendance.length);

  const filtered = attendance.filter(a => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (nameFilter && !a.staff_name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    return true;
  });

  const cards = [
    { label: "Total Staff", value: staffCount, icon: Users, color: "text-primary" },
    { label: "Present", value: presentCount, icon: UserCheck, color: "text-accent" },
    { label: "Absent", value: absentCount, icon: UserX, color: "text-destructive" },
    { label: "Late", value: lateCount, icon: Clock, color: "text-warning" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attendance Records</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-auto" />
            <Input placeholder="Search by name..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="w-auto" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.staff_name}</TableCell>
                      <TableCell>{format(new Date(a.timestamp), "h:mm a")}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "late" ? "destructive" : "default"} className={a.status !== "late" ? "bg-accent text-accent-foreground" : ""}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                          <ExternalLink className="h-3 w-3" /> Map
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
