import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, Coffee, Plane, AlertTriangle, TrendingUp, TrendingDown, UserCheck, UserX } from 'lucide-react';

// --- MOCK DATA ---

const MOCK_LIVE_STATS = {
  clockedIn: 45,
  onBreak: 6,
  onLeave: 3,
  absent: 10,
  locationAnomalies: 2,
};

const MOCK_TREND_DATA = [
  { date: 'Mar 01', attendance: 85 },
  { date: 'Mar 02', attendance: 88 },
  { date: 'Mar 03', attendance: 82 },
  { date: 'Mar 04', attendance: 90 },
  { date: 'Mar 05', attendance: 89 },
  { date: 'Mar 06', attendance: 91 },
  { date: 'Mar 07', attendance: 78 },
  { date: 'Mar 08', attendance: 85 },
];

const MOCK_ONTIME_LATE_DATA = [
  { name: 'On-Time', value: 380, color: '#22c55e' },
  { name: 'Late', value: 70, color: '#ef4444' },
];

const MOCK_LEADERBOARDS = {
  mostAbsent: [
    { name: 'John Doe', days: 5, avatar: 'JD' },
    { name: 'Jane Smith', days: 4, avatar: 'JS' },
    { name: 'Peter Jones', days: 4, avatar: 'PJ' },
    { name: 'Mary Williams', days: 3, avatar: 'MW' },
  ],
  mostLate: [
    { name: 'David Brown', count: 8, avatar: 'DB' },
    { name: 'Susan Miller', count: 7, avatar: 'SM' },
    { name: 'Michael Clark', count: 7, avatar: 'MC' },
    { name: 'John Doe', count: 6, avatar: 'JD' },
  ]
};

// --- END MOCK DATA ---

const AnalyticsPage = () => {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>

      {/* Live Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clocked In</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_LIVE_STATS.clockedIn}</div>
            <p className="text-xs text-muted-foreground">Currently on site</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Break</CardTitle>
            <Coffee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_LIVE_STATS.onBreak}</div>
            <p className="text-xs text-muted-foreground">Currently on a break</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_LIVE_STATS.onLeave}</div>
            <p className="text-xs text-muted-foreground">Approved leave today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_LIVE_STATS.absent}</div>
            <p className="text-xs text-muted-foreground">Not clocked in today</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Location Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{MOCK_LIVE_STATS.locationAnomalies}</div>
            <p className="text-xs text-muted-foreground">Active staff outside radius</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Attendance Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={MOCK_TREND_DATA}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Attendance %', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="attendance" stroke="#16a34a" strokeWidth={2} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>On-Time vs. Late (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie data={MOCK_ONTIME_LATE_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                        {MOCK_ONTIME_LATE_DATA.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><TrendingDown className="mr-2 text-red-500"/> Most Absent Staff (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_LEADERBOARDS.mostAbsent.map((staff) => (
                <div key={staff.name} className="flex items-center">
                  <div className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold text-sm mr-4">{staff.avatar}</div>
                  <div className="flex-grow">
                    <p className="font-medium">{staff.name}</p>
                  </div>
                  <div className="text-lg font-bold">{staff.days} <span className="text-sm font-normal text-muted-foreground">days</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><TrendingDown className="mr-2 text-orange-500"/> Most Late Staff (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
              {MOCK_LEADERBOARDS.mostLate.map((staff) => (
                <div key={staff.name} className="flex items-center">
                  <div className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold text-sm mr-4">{staff.avatar}</div>
                  <div className="flex-grow">
                    <p className="font-medium">{staff.name}</p>
                  </div>
                  <div className="text-lg font-bold">{staff.count} <span className="text-sm font-normal text-muted-foreground">times</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;
