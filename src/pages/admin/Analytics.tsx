import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  User,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StaffMember {
  id: string;
  name: string;
  email: string;
}

interface AttendanceMetrics {
  date: string;
  attendanceRate: number;
  onTimeCount: number;
  lateCount: number;
  averageHours: number;
}

interface StaffStats {
  id: string;
  name: string;
  email: string;
  attendanceRate: number;
  averageClockInTime: string;
  averageHoursWorked: number;
  contractedHours: number;
  daysShort: number;
  locationAnomalies: number;
  absenceCount: number;
  lateCount: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function Analytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<AttendanceMetrics[]>([]);
  const [liveStats, setLiveStats] = useState({
    inOffice: 0,
    onBreak: 0,
    offSite: 0,
    notIn: 0,
    onLeave: 0,
  });
  const [staffStats, setStaffStats] = useState<StaffStats[]>([]);
  const [topAbsent, setTopAbsent] = useState<StaffStats[]>([]);
  const [topLate, setTopLate] = useState<StaffStats[]>([]);
  const [topShortHours, setTopShortHours] = useState<StaffStats[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffStats | null>(null);
  const [showStaffDetail, setShowStaffDetail] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);

        // Fetch attendance data for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: attendanceRecords } = await supabase
          .from("attendance")
          .select("*")
          .gte("created_at", thirtyDaysAgo.toISOString());

        // Process attendance data
        if (attendanceRecords) {
          const dailyMetrics: { [key: string]: AttendanceMetrics } = {};

          attendanceRecords.forEach((record: any) => {
            const date = new Date(record.created_at).toLocaleDateString();
            if (!dailyMetrics[date]) {
              dailyMetrics[date] = {
                date,
                attendanceRate: 0,
                onTimeCount: 0,
                lateCount: 0,
                averageHours: 0,
              };
            }

            if (record.status === "present" || record.status === "late") {
              if (record.status === "present") {
                dailyMetrics[date].onTimeCount++;
              } else if (record.status === "late") {
                dailyMetrics[date].lateCount++;
              }
            }

            if (record.clock_out_time && record.clock_in_time) {
              const clockIn = new Date(record.clock_in_time).getTime();
              const clockOut = new Date(record.clock_out_time).getTime();
              const hours = (clockOut - clockIn) / (1000 * 60 * 60);
              dailyMetrics[date].averageHours += hours;
            }
          });

          // Calculate final metrics
          const processedData = Object.values(dailyMetrics)
            .map((metric) => ({
              ...metric,
              attendanceRate: Math.round(
                ((metric.onTimeCount + metric.lateCount) /
                  (metric.onTimeCount + metric.lateCount + 1)) *
                  100
              ),
              averageHours:
                Math.round(
                  (metric.averageHours /
                    (metric.onTimeCount + metric.lateCount || 1)) *
                    10
                ) / 10,
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-30);

          setAttendanceData(processedData);
        }

        // Fetch live stats
        const today = new Date().toLocaleDateString();
        const { data: todayRecords } = await supabase
          .from("attendance")
          .select("status")
          .gte("created_at", new Date(today).toISOString());

        if (todayRecords) {
          const stats = {
            inOffice: todayRecords.filter(
              (r: any) => r.status === "present" || r.status === "late"
            ).length,
            onBreak: todayRecords.filter((r: any) => r.status === "break").length,
            offSite: todayRecords.filter((r: any) => r.status === "external")
              .length,
            notIn: todayRecords.filter((r: any) => r.status === "absent").length,
            onLeave: todayRecords.filter((r: any) => r.status === "leave").length,
          };
          setLiveStats(stats);
        }

        // Fetch staff statistics
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email");

        if (profiles) {
          const staffData = await Promise.all(
            profiles.map(async (profile: any) => {
              const { data: attendance } = await supabase
                .from("attendance")
                .select("*")
                .eq("user_id", profile.id)
                .gte("created_at", thirtyDaysAgo.toISOString());

              if (!attendance) return null;

              let totalHours = 0;
              let presentDays = 0;
              let lateDays = 0;
              let absentDays = 0;
              let locationAnomalies = 0;
              let clockInTimes: number[] = [];

              attendance.forEach((record: any) => {
                if (record.status === "present") presentDays++;
                if (record.status === "late") lateDays++;
                if (record.status === "absent") absentDays++;
                if (record.location_verified === false) locationAnomalies++;

                if (record.clock_in_time) {
                  const time = new Date(record.clock_in_time).getHours();
                  clockInTimes.push(time);
                }

                if (record.clock_out_time && record.clock_in_time) {
                  const clockIn = new Date(record.clock_in_time).getTime();
                  const clockOut = new Date(record.clock_out_time).getTime();
                  totalHours += (clockOut - clockIn) / (1000 * 60 * 60);
                }
              });

              const avgClockInTime =
                clockInTimes.length > 0
                  ? Math.round(
                      clockInTimes.reduce((a, b) => a + b, 0) / clockInTimes.length
                    )
                  : 0;
              const attendanceRate = Math.round(
                ((presentDays + lateDays) / (attendance.length || 1)) * 100
              );

              return {
                id: profile.id,
                name: profile.full_name,
                email: profile.email,
                attendanceRate,
                averageClockInTime: `${avgClockInTime}:00`,
                averageHoursWorked: Math.round((totalHours / 30) * 10) / 10,
                contractedHours: 40,
                daysShort: Math.max(0, Math.round(30 - totalHours / 8)),
                locationAnomalies,
                absenceCount: absentDays,
                lateCount: lateDays,
              };
            })
          );

          const validStaffData = staffData.filter(Boolean) as StaffStats[];
          setStaffStats(validStaffData);

          // Get top performers
          setTopAbsent(
            [...validStaffData]
              .sort((a, b) => b.absenceCount - a.absenceCount)
              .slice(0, 5)
          );

          setTopLate(
            [...validStaffData]
              .sort((a, b) => b.lateCount - a.lateCount)
              .slice(0, 5)
          );

          setTopShortHours(
            [...validStaffData]
              .sort((a, b) => b.daysShort - a.daysShort)
              .slice(0, 5)
          );
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching analytics:", error);
        toast({
          title: "Error",
          description: "Failed to load analytics data",
          variant: "destructive",
        });
        setLoading(false);
      }
    };

    if (user) {
      fetchAnalytics();
    }
  }, [user, toast]);

  const liveStatsData = [
    { name: "In Office", value: liveStats.inOffice, color: "#10b981" },
    { name: "On Break", value: liveStats.onBreak, color: "#f59e0b" },
    { name: "Off-site", value: liveStats.offSite, color: "#3b82f6" },
    { name: "Not In", value: liveStats.notIn, color: "#ef4444" },
    { name: "On Leave", value: liveStats.onLeave, color: "#8b5cf6" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">School-wide attendance insights and performance metrics</p>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {liveStatsData.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Status Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Current Staff Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={liveStatsData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {liveStatsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Attendance Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Rate (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="attendanceRate"
                stroke="#3b82f6"
                name="Attendance Rate (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* On-time vs Late Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>On-Time vs Late (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="onTimeCount" stackId="a" fill="#10b981" name="On-Time" />
              <Bar dataKey="lateCount" stackId="a" fill="#f59e0b" name="Late" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Average Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Average Hours Worked (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="averageHours" fill="#3b82f6" name="Hours" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Most Absent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Top 5 Most Absent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topAbsent.map((staff, idx) => (
                <button
                  key={staff.id}
                  onClick={() => {
                    setSelectedStaff(staff);
                    setShowStaffDetail(true);
                  }}
                  className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{idx + 1}. {staff.name}</span>
                    <Badge variant="destructive">{staff.absenceCount} days</Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Most Late */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Top 5 Most Late
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topLate.map((staff, idx) => (
                <button
                  key={staff.id}
                  onClick={() => {
                    setSelectedStaff(staff);
                    setShowStaffDetail(true);
                  }}
                  className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{idx + 1}. {staff.name}</span>
                    <Badge variant="warning">{staff.lateCount} times</Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shortest Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top 5 Shortest Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topShortHours.map((staff, idx) => (
                <button
                  key={staff.id}
                  onClick={() => {
                    setSelectedStaff(staff);
                    setShowStaffDetail(true);
                  }}
                  className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{idx + 1}. {staff.name}</span>
                    <Badge variant="outline">{staff.daysShort} days</Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Detail Modal */}
      <Dialog open={showStaffDetail} onOpenChange={setShowStaffDetail}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedStaff?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{selectedStaff.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  <p className="text-2xl font-bold">{selectedStaff.attendanceRate}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Clock-In</p>
                  <p className="text-lg font-medium">{selectedStaff.averageClockInTime}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
                  <p className="text-lg font-medium">{selectedStaff.averageHoursWorked}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Days Short</p>
                  <p className="text-lg font-medium">{selectedStaff.daysShort}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Location Anomalies</p>
                  <p className="text-lg font-medium">{selectedStaff.locationAnomalies}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Times Late</p>
                  <p className="text-lg font-medium">{selectedStaff.lateCount}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
