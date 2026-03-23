import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import * as XLSX from "xlsx";

const Reports = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  const startDate = format(startOfMonth(new Date(month + "-01")), "yyyy-MM-dd");
  const endDate = format(endOfMonth(new Date(month + "-01")), "yyyy-MM-dd");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [attRes, staffRes, leaveRes] = await Promise.all([
        supabase.from("attendance").select("*").gte("created_at", startDate + "T00:00:00").lte("created_at", endDate + "T23:59:59"),
        supabase.from("profiles").select("user_id, name, status").eq("status", "active").order("name"),
        supabase.from("leave_requests").select("*").eq("status", "approved").lte("start_date", endDate).gte("end_date", startDate),
      ]);
      setAttendance(attRes.data ?? []);
      setStaffList(staffRes.data ?? []);
      setLeaveRequests(leaveRes.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, [startDate, endDate]);

  // Count working days in the month (Mon–Fri)
  const workingDays = useMemo(() => {
    const days = eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) });
    return days.filter(d => !isWeekend(d)).length;
  }, [startDate, endDate]);

  const summary = useMemo(() => {
    return staffList.map(staff => {
      const records = attendance.filter(a => a.user_id === staff.user_id);
      const present = records.filter(a => a.status === "present").length;
      const late = records.filter(a => a.status === "late").length;

      // Count approved leave days that fall within working days
      const staffLeave = leaveRequests.filter(l => l.user_id === staff.user_id);
      let leaveDays = 0;
      staffLeave.forEach(l => {
        const days = eachDayOfInterval({ start: new Date(l.start_date), end: new Date(l.end_date) });
        leaveDays += days.filter(d => !isWeekend(d)).length;
      });

      const absent = Math.max(0, workingDays - present - late - leaveDays);

      // Average clock-in time
      const clockInTimes = records.map(a => {
        const d = new Date(a.timestamp);
        return d.getHours() * 60 + d.getMinutes();
      });
      const avgMinutes = clockInTimes.length
        ? Math.round(clockInTimes.reduce((a, b) => a + b, 0) / clockInTimes.length)
        : null;
      const avgClockIn = avgMinutes !== null
        ? `${String(Math.floor(avgMinutes / 60)).padStart(2, "0")}:${String(avgMinutes % 60).padStart(2, "0")}`
        : "—";

      // Average hours worked (only records with clock_out)
      const durations = records
        .filter(a => a.clock_out)
        .map(a => (new Date(a.clock_out).getTime() - new Date(a.timestamp).getTime()) / 3600000);
      const avgHours = durations.length
        ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)
        : "—";

      const attendanceRate = workingDays > 0
        ? Math.round(((present + late) / (workingDays - leaveDays)) * 100)
        : 0;

      return { name: staff.name, present, late, absent, leaveDays, avgClockIn, avgHours, attendanceRate, total: present + late };
    });
  }, [staffList, attendance, leaveRequests, workingDays]);

  const exportExcel = () => {
    if (!summary.length) return;
    const rows = summary.map(s => ({
      "Staff Name": s.name,
      "Working Days": workingDays,
      "Present": s.present,
      "Late": s.late,
      "Absent": s.absent,
      "On Leave": s.leaveDays,
      "Attendance Rate (%)": s.attendanceRate,
      "Avg Clock-In": s.avgClockIn,
      "Avg Hours Worked": s.avgHours,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    XLSX.writeFile(wb, `attendance_summary_${month}.xlsx`);
  };

  const exportCSV = () => {
    if (!summary.length) return;
    const headers = ["Staff Name", "Working Days", "Present", "Late", "Absent", "On Leave", "Attendance Rate (%)", "Avg Clock-In", "Avg Hours Worked"];
    const rows = summary.map(s => [s.name, workingDays, s.present, s.late, s.absent, s.leaveDays, s.attendanceRate, s.avgClockIn, s.avgHours]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance_summary_${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{workingDays} working days in selected month</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" />
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!summary.length}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!summary.length}><Download className="h-4 w-4 mr-1" /> Excel</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Staff Summary — {format(new Date(month + "-01"), "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : summary.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No active staff found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>On Leave</TableHead>
                    <TableHead>Attendance Rate</TableHead>
                    <TableHead>Avg Clock-In</TableHead>
                    <TableHead>Avg Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map(s => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-accent text-accent-foreground">{s.present}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.late > 0 ? "destructive" : "secondary"}>{s.late}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.absent > 0 ? "destructive" : "secondary"}>{s.absent}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.leaveDays}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${s.attendanceRate >= 80 ? "bg-accent" : s.attendanceRate >= 60 ? "bg-yellow-500" : "bg-destructive"}`}
                              style={{ width: `${Math.min(s.attendanceRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm">{isNaN(s.attendanceRate) ? "—" : `${s.attendanceRate}%`}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.avgClockIn}</TableCell>
                      <TableCell className="text-sm">{s.avgHours === "—" ? "—" : `${s.avgHours}h`}</TableCell>
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

export default Reports;
