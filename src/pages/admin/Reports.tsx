import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, ExternalLink } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const Reports = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("attendance").select("*").gte("created_at", startDate + "T00:00:00").lte("created_at", endDate + "T23:59:59").order("timestamp", { ascending: false });
    setAttendance(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  const exportCSV = () => {
    const headers = ["Staff Name", "Date", "Time", "Status", "Latitude", "Longitude", "Device"];
    const rows = attendance.map(a => [
      a.staff_name,
      format(new Date(a.timestamp), "yyyy-MM-dd"),
      format(new Date(a.timestamp), "HH:mm:ss"),
      a.status,
      a.latitude,
      a.longitude,
      a.device_info ?? "",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">Reports</h2>
        <Button onClick={exportCSV} variant="outline" className="gap-2" disabled={attendance.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Date Range</CardTitle>
          <div className="flex gap-3 mt-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : attendance.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No records in this range</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.staff_name}</TableCell>
                      <TableCell>{format(new Date(a.timestamp), "MMM d, yyyy")}</TableCell>
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

export default Reports;
