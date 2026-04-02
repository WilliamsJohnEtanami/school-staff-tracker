import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp,
  Clock,
  AlertCircle,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getDistanceInMeters } from "@/lib/geo";

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

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"];

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildDateRange = (days: number) => {
  const dates: { key: string; label: string }[] = [];
  const today = startOfDay(new Date());

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - offset);
    dates.push({
      key: toDateKey(current),
      label: current.toLocaleDateString(),
    });
  }

  return dates;
};

const average = (numbers: number[]) =>
  numbers.length === 0 ? 0 : numbers.reduce((sum, value) => sum + value, 0) / numbers.length;

const formatAverageClockIn = (minutes: number[]) => {
  if (minutes.length === 0) return "N/A";

  const avgMinutes = Math.round(average(minutes));
  const hours = Math.floor(avgMinutes / 60);
  const mins = avgMinutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = ((hours + 11) % 12) + 1;
  return `${displayHour}:${`${mins}`.padStart(2, "0")} ${period}`;
};

const Analytics = () => {
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
      if (!user) return;

      setLoading(true);

      try {
        const dateRange = buildDateRange(30);
        const rangeStart = dateRange[0]?.key;
        const todayKey = dateRange[dateRange.length - 1]?.key;

        const [
          roleRes,
          profileRes,
          attendanceRes,
          workSessionRes,
          leaveRes,
          settingsRes,
          contractRes,
          calendarRes,
        ] = await Promise.all([
          supabase.from("user_roles").select("user_id").eq("role", "staff"),
          supabase.from("profiles").select("user_id, name, email, status").eq("status", "active"),
          supabase
            .from("attendance")
            .select("user_id, status, timestamp, clock_out, latitude, longitude")
            .gte("timestamp", `${rangeStart}T00:00:00`),
          supabase
            .from("work_sessions")
            .select("user_id, type, session_date, ended_at")
            .gte("session_date", rangeStart),
          supabase
            .from("leave_requests")
            .select("user_id, status, start_date, end_date")
            .gte("end_date", rangeStart),
          supabase.from("settings").select("allowed_radius, school_latitude, school_longitude").limit(1).maybeSingle(),
          supabase.from("staff_contracts").select("user_id, contracted_hours"),
          supabase
            .from("school_calendar")
            .select("event_date, type")
            .gte("event_date", rangeStart)
            .lte("event_date", todayKey),
        ]);

        const criticalError =
          roleRes.error ||
          profileRes.error ||
          attendanceRes.error ||
          workSessionRes.error ||
          leaveRes.error ||
          settingsRes.error ||
          contractRes.error ||
          calendarRes.error;

        if (criticalError) {
          throw criticalError;
        }

        const staffRoleIds = new Set((roleRes.data ?? []).map((row) => row.user_id));
        const activeStaff = (profileRes.data ?? []).filter((profile) => staffRoleIds.has(profile.user_id));
        const attendanceRecords = (attendanceRes.data ?? []).filter((record) => staffRoleIds.has(record.user_id));
        const workSessions = (workSessionRes.data ?? []).filter((record) => staffRoleIds.has(record.user_id));
        const approvedLeaves = (leaveRes.data ?? []).filter((record) => staffRoleIds.has(record.user_id) && record.status === "approved");
        const contractHours = new Map((contractRes.data ?? []).map((row) => [row.user_id, Number(row.contracted_hours ?? 8)]));

        const nonWorkingDays = new Set(
          (calendarRes.data ?? [])
            .filter((event) => event.type === "holiday" || event.type === "no_school")
            .map((event) => event.event_date)
        );

        const attendanceByDay = new Map<string, typeof attendanceRecords>();
        const attendanceByUser = new Map<string, typeof attendanceRecords>();

        attendanceRecords.forEach((record) => {
          const dayKey = record.timestamp.slice(0, 10);

          if (!attendanceByDay.has(dayKey)) {
            attendanceByDay.set(dayKey, []);
          }
          attendanceByDay.get(dayKey)!.push(record);

          if (!attendanceByUser.has(record.user_id)) {
            attendanceByUser.set(record.user_id, []);
          }
          attendanceByUser.get(record.user_id)!.push(record);
        });

        const isOnApprovedLeave = (userId: string, dayKey: string) =>
          approvedLeaves.some((leave) => leave.user_id === userId && leave.start_date <= dayKey && leave.end_date >= dayKey);

        const expectedWorkingDays = dateRange
          .filter(({ key }) => {
            const date = new Date(`${key}T00:00:00`);
            const day = date.getDay();
            return day !== 0 && day !== 6 && !nonWorkingDays.has(key);
          })
          .map(({ key }) => key);

        const computedAttendanceData = dateRange.map(({ key, label }) => {
          const dayAttendance = attendanceByDay.get(key) ?? [];
          const attendedUsers = new Set(
            dayAttendance
              .filter((record) => record.status === "present" || record.status === "late")
              .map((record) => record.user_id)
          );

          const onTimeCount = dayAttendance.filter((record) => record.status === "present").length;
          const lateCount = dayAttendance.filter((record) => record.status === "late").length;
          const workedHours = dayAttendance
            .filter((record) => record.clock_out)
            .map((record) => (new Date(record.clock_out!).getTime() - new Date(record.timestamp).getTime()) / 3600000)
            .filter((hours) => Number.isFinite(hours) && hours >= 0);

          const expectedStaffCount = expectedWorkingDays.includes(key)
            ? activeStaff.filter((staff) => !isOnApprovedLeave(staff.user_id, key)).length
            : 0;

          return {
            date: label,
            attendanceRate: expectedStaffCount > 0 ? Math.round((attendedUsers.size / expectedStaffCount) * 100) : 0,
            onTimeCount,
            lateCount,
            averageHours: Math.round(average(workedHours) * 10) / 10,
          };
        });

        const todayAttendance = attendanceByDay.get(todayKey) ?? [];
        const attendedTodayIds = new Set(
          todayAttendance
            .filter((record) => record.status === "present" || record.status === "late")
            .map((record) => record.user_id)
        );

        const activeSessionsToday = workSessions.filter(
          (session) => session.session_date === todayKey && session.ended_at === null
        );

        const breakIds = new Set(
          activeSessionsToday.filter((session) => session.type === "break").map((session) => session.user_id)
        );
        const offSiteIds = new Set(
          activeSessionsToday.filter((session) => session.type === "off-site").map((session) => session.user_id)
        );
        const workingIds = new Set(
          activeSessionsToday.filter((session) => session.type === "work").map((session) => session.user_id)
        );
        const onLeaveTodayIds = new Set(
          approvedLeaves
            .filter((leave) => leave.start_date <= todayKey && leave.end_date >= todayKey)
            .map((leave) => leave.user_id)
        );

        const inOfficeIds = new Set(
          [...attendedTodayIds, ...workingIds].filter((userId) => !breakIds.has(userId) && !offSiteIds.has(userId))
        );

        const classifiedIds = new Set([
          ...inOfficeIds,
          ...breakIds,
          ...offSiteIds,
          ...onLeaveTodayIds,
        ]);

        setLiveStats({
          inOffice: inOfficeIds.size,
          onBreak: breakIds.size,
          offSite: offSiteIds.size,
          notIn: Math.max(activeStaff.length - classifiedIds.size, 0),
          onLeave: onLeaveTodayIds.size,
        });

        const settings = settingsRes.data;

        const computedStaffStats = activeStaff.map((staff) => {
          const records = attendanceByUser.get(staff.user_id) ?? [];
          const attendedDays = new Set(
            records
              .filter((record) => record.status === "present" || record.status === "late")
              .map((record) => record.timestamp.slice(0, 10))
          );
          const leaveAdjustedWorkingDays = expectedWorkingDays.filter((key) => !isOnApprovedLeave(staff.user_id, key));
          const clockInMinutes = records.map((record) => {
            const timestamp = new Date(record.timestamp);
            return timestamp.getHours() * 60 + timestamp.getMinutes();
          });
          const workedHours = records
            .filter((record) => record.clock_out)
            .map((record) => (new Date(record.clock_out!).getTime() - new Date(record.timestamp).getTime()) / 3600000)
            .filter((hours) => Number.isFinite(hours) && hours >= 0);
          const contractedHours = contractHours.get(staff.user_id) ?? 8;
          const locationAnomalies = settings
            ? records.filter((record) => (
                getDistanceInMeters(
                  record.latitude,
                  record.longitude,
                  settings.school_latitude,
                  settings.school_longitude
                ) > settings.allowed_radius
              )).length
            : 0;

          const attendanceRate = leaveAdjustedWorkingDays.length > 0
            ? Math.round((attendedDays.size / leaveAdjustedWorkingDays.length) * 100)
            : 0;

          return {
            id: staff.user_id,
            name: staff.name,
            email: staff.email,
            attendanceRate,
            averageClockInTime: formatAverageClockIn(clockInMinutes),
            averageHoursWorked: Math.round(average(workedHours) * 10) / 10,
            contractedHours,
            daysShort: workedHours.filter((hours) => hours < contractedHours).length,
            locationAnomalies,
            absenceCount: Math.max(leaveAdjustedWorkingDays.length - attendedDays.size, 0),
            lateCount: records.filter((record) => record.status === "late").length,
          };
        });

        const byAbsence = [...computedStaffStats].sort((a, b) => b.absenceCount - a.absenceCount);
        const byLate = [...computedStaffStats].sort((a, b) => b.lateCount - a.lateCount);
        const byShortHours = [...computedStaffStats].sort((a, b) => b.daysShort - a.daysShort);

        setAttendanceData(computedAttendanceData);
        setStaffStats(computedStaffStats);
        setTopAbsent(byAbsence.slice(0, 5));
        setTopLate(byLate.slice(0, 5));
        setTopShortHours(byShortHours.slice(0, 5));
      } catch (error: any) {
        console.error("Error fetching analytics:", error);
        toast({
          title: "Analytics Error",
          description: error.message || "Unable to load analytics right now.",
          variant: "destructive",
        });
        setAttendanceData([]);
        setStaffStats([]);
        setTopAbsent([]);
        setTopLate([]);
        setTopShortHours([]);
        setLiveStats({ inOffice: 0, onBreak: 0, offSite: 0, notIn: 0, onLeave: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [toast, user]);

  const liveStatsData = useMemo(
    () => [
      { name: "In Office", value: liveStats.inOffice, color: COLORS[0] },
      { name: "On Break", value: liveStats.onBreak, color: COLORS[1] },
      { name: "Off-site", value: liveStats.offSite, color: COLORS[2] },
      { name: "Not In", value: liveStats.notIn, color: COLORS[3] },
      { name: "On Leave", value: liveStats.onLeave, color: COLORS[4] },
    ],
    [liveStats]
  );

  const liveStatsChartData = useMemo(
    () => liveStatsData.filter((stat) => stat.value > 0),
    [liveStatsData]
  );

  const totalLiveStaff = useMemo(
    () => liveStatsData.reduce((sum, stat) => sum + stat.value, 0),
    [liveStatsData]
  );

  const hasAttendanceMetrics = attendanceData.some(
    (entry) => entry.attendanceRate > 0 || entry.onTimeCount > 0 || entry.lateCount > 0 || entry.averageHours > 0
  );

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
        <p className="text-muted-foreground">School-wide attendance insights using your real records only.</p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Current Staff Status</CardTitle>
        </CardHeader>
        <CardContent>
          {totalLiveStaff > 0 ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={liveStatsChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={88}
                    paddingAngle={2}
                    labelLine={false}
                    label={false}
                    dataKey="value"
                  >
                    {liveStatsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}`, name]} />
                </PieChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {liveStatsData.map((stat) => {
                  const percent = totalLiveStaff > 0 ? Math.round((stat.value / totalLiveStaff) * 100) : 0;

                  return (
                    <div key={stat.name} className="rounded-2xl border bg-background p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: stat.color }}
                            aria-hidden="true"
                          />
                          <span className="truncate text-sm font-medium">{stat.name}</span>
                        </div>
                        <Badge variant="secondary">{stat.value}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {stat.value === 0 ? "No staff in this group right now." : `${percent}% of current staff status records.`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No current staff status data is available yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Rate (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {hasAttendanceMetrics ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="attendanceRate" stroke="#3b82f6" name="Attendance Rate (%)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground">No attendance data has been recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>On-Time vs Late (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {hasAttendanceMetrics ? (
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
          ) : (
            <p className="text-muted-foreground">No attendance data has been recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Average Hours Worked (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {hasAttendanceMetrics ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="averageHours" fill="#3b82f6" name="Hours" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground">No worked-hour data has been recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RankingCard
          title="Top 5 Most Absent"
          icon={<AlertCircle className="h-5 w-5" />}
          items={topAbsent}
          badgeVariant="destructive"
          badgeLabel={(staff) => `${staff.absenceCount} day${staff.absenceCount === 1 ? "" : "s"}`}
          onSelect={(staff) => {
            setSelectedStaff(staff);
            setShowStaffDetail(true);
          }}
          emptyMessage="No staff records yet."
        />
        <RankingCard
          title="Top 5 Most Late"
          icon={<Clock className="h-5 w-5" />}
          items={topLate}
          badgeVariant="secondary"
          badgeLabel={(staff) => `${staff.lateCount} time${staff.lateCount === 1 ? "" : "s"}`}
          onSelect={(staff) => {
            setSelectedStaff(staff);
            setShowStaffDetail(true);
          }}
          emptyMessage="No lateness data yet."
        />
        <RankingCard
          title="Top 5 Shortest Hours"
          icon={<TrendingUp className="h-5 w-5" />}
          items={topShortHours}
          badgeVariant="outline"
          badgeLabel={(staff) => `${staff.daysShort} day${staff.daysShort === 1 ? "" : "s"}`}
          onSelect={(staff) => {
            setSelectedStaff(staff);
            setShowStaffDetail(true);
          }}
          emptyMessage="No work-hour data yet."
        />
      </div>

      <Dialog open={showStaffDetail} onOpenChange={setShowStaffDetail}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedStaff?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedStaff ? (
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
                  <p className="text-sm text-muted-foreground">Contracted Hours</p>
                  <p className="text-lg font-medium">{selectedStaff.contractedHours}h</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Absent Days</p>
                  <p className="text-lg font-medium">{selectedStaff.absenceCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Short Days</p>
                  <p className="text-lg font-medium">{selectedStaff.daysShort}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const RankingCard = ({
  title,
  icon,
  items,
  badgeVariant,
  badgeLabel,
  onSelect,
  emptyMessage,
}: {
  title: string;
  icon: React.ReactNode;
  items: StaffStats[];
  badgeVariant: "destructive" | "secondary" | "outline";
  badgeLabel: (staff: StaffStats) => string;
  onSelect: (staff: StaffStats) => void;
  emptyMessage: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {items.map((staff, index) => (
            <button
              key={staff.id}
              onClick={() => onSelect(staff)}
              className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
            >
              <div className="flex justify-between items-center gap-3">
                <span className="font-medium text-sm">
                  {index + 1}. {staff.name}
                </span>
                <Badge variant={badgeVariant}>{badgeLabel(staff)}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export default Analytics;
