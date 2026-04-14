import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isWeekend } from "date-fns";

const typeColors: Record<string, string> = {
  holiday: "bg-red-100 text-red-700 border-red-200",
  early_closure: "bg-yellow-100 text-yellow-700 border-yellow-200",
  no_school: "bg-green-100 text-green-700 border-green-200",
  event: "bg-blue-100 text-blue-700 border-blue-200",
};

const typeLabels: Record<string, string> = {
  holiday: "Holiday",
  early_closure: "Early Closure",
  no_school: "No School",
  event: "Event",
};

const StaffCalendar = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("school_calendar")
        .select("*")
        .gte("event_date", startDate)
        .lte("event_date", endDate)
        .order("event_date");
      setEvents(data ?? []);
      setLoading(false);
    };
    fetchEvents();
  }, [startDate, endDate]);

  const days = eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) });
  const eventsByDate = new Map(events.map(e => [e.event_date, e]));
  const firstDayOfWeek = days[0].getDay();
  const paddedDays = Array(firstDayOfWeek).fill(null).concat(days);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">School Calendar</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View upcoming school events, holidays, and closures.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="px-3 py-1 rounded border text-sm hover:bg-muted transition-colors">‹</button>
              <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="px-3 py-1 rounded border text-sm hover:bg-muted transition-colors">›</button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="grid grid-cols-7 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {paddedDays.map((day, i) => {
                  if (!day) return <div key={`pad-${i}`} />;
                  const dateKey = format(day, "yyyy-MM-dd");
                  const event = eventsByDate.get(dateKey);
                  const weekend = isWeekend(day);
                  const today = isToday(day);
                  return (
                    <div
                      key={dateKey}
                      className={`min-h-[60px] rounded-lg border p-1.5 text-xs transition-colors
                        ${today ? "border-primary bg-primary/5" : "border-border"}
                        ${weekend && !event ? "bg-muted/30" : ""}
                      `}
                      style={event?.color ? { borderColor: event.color + "60", backgroundColor: event.color + "15" } : {}}
                    >
                      <p className={`font-medium mb-0.5 ${today ? "text-primary" : weekend ? "text-muted-foreground" : ""}`}>
                        {format(day, "d")}
                      </p>
                      {event && (
                        <p className="text-[10px] leading-tight font-medium truncate" style={{ color: event.color }}>
                          {event.event_name}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Events This Month</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events scheduled this month.</p>
          ) : (
            <div className="space-y-2">
              {events.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{e.event_name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(e.event_date), "EEEE, MMMM d")}</p>
                    {e.expected_hours != null && (
                      <p className="text-xs text-muted-foreground">Expected hours: {e.expected_hours}h</p>
                    )}
                  </div>
                  <Badge className={typeColors[e.type] ?? ""}>{typeLabels[e.type] ?? e.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffCalendar;
