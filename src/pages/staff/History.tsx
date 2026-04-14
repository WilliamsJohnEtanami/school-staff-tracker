import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

const StaffHistory = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    if (!user?.id) return;
    const fetchHistory = async () => {
      setLoading(true);
      const start = `${month}-01`;
      const end = format(new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0), "yyyy-MM-dd");

      const [attRes, sessRes] = await Promise.all([
        supabase.from("attendance").select("*").eq("user_id", user.id)
          .gte("created_at", start + "T00:00:00")
          .lte("created_at", end + "T23:59:59")
          .order("timestamp", { ascending: false }),
        supabase.from("work_sessions").select("*").eq("user_id", user.id)
          .gte("session_date", start)
          .lte("session_date", end)
          .order("started_at", { ascending: true }),
      ]);
      setRecords(attRes.data ?? []);
      setSessions(sessRes.data ?? []);
      setLoading(false);
    };
    fetchHistory();
  }, [user?.id, month]);

  const sessionsByDate = sessions.reduce((acc: Record<string, any[]>, s) => {
    if (!acc[s.session_date]) acc[s.session_date] = [];
    acc[s.session_date].push(s);
    return acc;
  }, {});

  const calcWorkHours = (daySessions: any[]) => {
    const workSessions = daySessions.filter(s => s.type === "work" && s.ended_at);
    const mins = workSessions.reduce((sum, s) => {
      return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
    }, 0);
    return (mins / 60).toFixed(1);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Attendance History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your full attendance record by month.</p>
        </div>
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No records found for this month.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {records.map(r => {
            const dateKey = r.timestamp.slice(0, 10);
            const daySessions = sessionsByDate[dateKey] ?? [];
            const workHours = calcWorkHours(daySessions);
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{format(parseISO(r.timestamp), "EEEE, MMMM d yyyy")}</CardTitle>
                    <Badge variant={r.status === "late" ? "destructive" : "default"}
                      className={r.status !== "late" ? "bg-accent text-accent-foreground" : ""}>
                      {r.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Clock In</p>
                      <p className="font-medium">{format(parseISO(r.timestamp), "h:mm a")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Clock Out</p>
                      <p className="font-medium">{r.clock_out ? format(parseISO(r.clock_out), "h:mm a") : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Work Hours</p>
                      <p className="font-medium">{workHours}h</p>
                    </div>
                  </div>

                  {daySessions.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Session Timeline</p>
                      <div className="flex flex-wrap gap-2">
                        {daySessions.map(s => (
                          <div key={s.id} className={`text-xs px-2 py-1 rounded-full border
                            ${s.type === "work" ? "bg-green-50 border-green-200 text-green-700" :
                              s.type === "break" ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                              "bg-blue-50 border-blue-200 text-blue-700"}`}>
                            <span className="capitalize font-medium">{s.type}</span>
                            {" · "}{format(parseISO(s.started_at), "h:mm a")}
                            {s.ended_at ? ` → ${format(parseISO(s.ended_at), "h:mm a")}` : " (active)"}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffHistory;
