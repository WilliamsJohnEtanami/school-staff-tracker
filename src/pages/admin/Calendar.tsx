import * as React from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  EventProps,
  SlotInfo,
  Views,
  View,
} from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import enUS from "date-fns/locale/en-US";
import {
  isFuture, isToday, isWeekend, parseISO, addDays, addWeeks, addMonths, addYears,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCalendar } from "@/contexts/CalendarContext";
import { supabase } from "@/integrations/supabase/client";
import CalendarSidebar from "@/components/CalendarSidebar";
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles, RefreshCw } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./Calendar.css";

type SchoolEventType = "holiday" | "early_closure" | "event" | "no_school";

type SchoolEvent = {
  id: string;
  start: Date;
  end: Date;
  title: string;
  type: SchoolEventType;
  allDay: true;
  expectedHours: number | null;
  calendarId: string;
  color: string;
  isRecurring: boolean;
  recurrenceGroupId: string | null;
};

// Nigeria public holidays for the current year — shown as suggestions
const currentYear = new Date().getFullYear();
const NIGERIA_HOLIDAYS: { name: string; date: string; type: SchoolEventType }[] = [
  { name: "New Year's Day", date: `${currentYear}-01-01`, type: "holiday" },
  { name: "Good Friday", date: `${currentYear}-04-18`, type: "holiday" },
  { name: "Easter Monday", date: `${currentYear}-04-21`, type: "holiday" },
  { name: "Workers' Day", date: `${currentYear}-05-01`, type: "holiday" },
  { name: "Democracy Day", date: `${currentYear}-06-12`, type: "holiday" },
  { name: "Eid al-Fitr", date: `${currentYear}-03-31`, type: "holiday" },
  { name: "Eid al-Adha", date: `${currentYear}-06-07`, type: "holiday" },
  { name: "Independence Day", date: `${currentYear}-10-01`, type: "holiday" },
  { name: "Maulid al-Nabi", date: `${currentYear}-09-05`, type: "holiday" },
  { name: "Christmas Day", date: `${currentYear}-12-25`, type: "holiday" },
  { name: "Boxing Day", date: `${currentYear}-12-26`, type: "holiday" },
];

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop<SchoolEvent>(BigCalendar);

const calendarIdByType: Record<SchoolEventType, string> = {
  event: "1", holiday: "2", early_closure: "3", no_school: "4",
};

const eventTypeLabel: Record<SchoolEventType, string> = {
  event: "Event", holiday: "Holiday", early_closure: "Early Closure", no_school: "No School",
};

const defaultEventColorByType: Record<SchoolEventType, string> = {
  event: "#3b82f6", holiday: "#ef4444", early_closure: "#f59e0b", no_school: "#22c55e",
};

const quickEventColors = [
  "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b", "#22c55e", "#14b8a6", "#ec4899", "#64748b",
];

type RecurrenceFrequency = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";

const recurrenceLabel: Record<RecurrenceFrequency, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekdays: "Every weekday (Mon–Fri)",
  weekly: "Every week",
  monthly: "Every month (same date)",
  yearly: "Every year",
};

// Generate all occurrence dates for a recurring event
function generateOccurrences(
  startDate: string,
  frequency: RecurrenceFrequency,
  endType: "date" | "count",
  endDate: string,
  count: number
): string[] {
  if (frequency === "none") return [startDate];
  const dates: string[] = [];
  let current = parseISO(startDate);
  const limit = endType === "count" ? count : 365 * 3; // safety cap
  const cutoff = endType === "date" ? parseISO(endDate) : null;

  while (dates.length < limit) {
    if (cutoff && current > cutoff) break;
    const skip = frequency === "weekdays" && isWeekend(current);
    if (!skip) dates.push(format(current, "yyyy-MM-dd"));

    switch (frequency) {
      case "daily":
      case "weekdays":
        current = addDays(current, 1);
        break;
      case "weekly":
        current = addWeeks(current, 1);
        break;
      case "monthly":
        current = addMonths(current, 1);
        break;
      case "yearly":
        current = addYears(current, 1);
        break;
    }

    // Safety: never generate more than 500 occurrences
    if (dates.length >= 500) break;
  }

  return dates;
}

const EventComponent = ({ event }: EventProps<SchoolEvent>) => (
  <div className="rounded px-1.5 py-0.5 text-white text-xs font-medium truncate shadow-sm h-full flex items-center gap-1"
    style={{ backgroundColor: event.color }}>
    {event.isRecurring && <RefreshCw className="h-2.5 w-2.5 shrink-0 opacity-80" />}
    <span className="truncate">{event.title}</span>
  </div>
);

const CalendarPage = () => {
  const { toast } = useToast();
  const { selectedCalendars } = useCalendar();
  const [events, setEvents] = React.useState<SchoolEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedEvent, setSelectedEvent] = React.useState<SchoolEvent | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [currentView, setCurrentView] = React.useState<View>(Views.MONTH);
  const [showHolidaySuggestions, setShowHolidaySuggestions] = React.useState(false);
  const [addingHoliday, setAddingHoliday] = React.useState<string | null>(null);

  // Form state
  const [eventName, setEventName] = React.useState("");
  const [eventType, setEventType] = React.useState<SchoolEventType>("event");
  const [eventStartDate, setEventStartDate] = React.useState("");
  const [eventEndDate, setEventEndDate] = React.useState("");
  const [expectedHours, setExpectedHours] = React.useState("");
  const [eventColor, setEventColor] = React.useState(defaultEventColorByType.event);

  const fetchEvents = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("school_calendar")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) {
      toast({ title: "Calendar Error", description: error.message, variant: "destructive" });
      setEvents([]);
      setLoading(false);
      return;
    }

    const mapped: SchoolEvent[] = (data ?? []).map((entry) => {
      const start = new Date(`${entry.event_date}T00:00:00`);
      // Use end_date if present, otherwise same day
      const endDateStr = entry.end_date ?? entry.event_date;
      const end = new Date(`${endDateStr}T23:59:59`);
      return {
        id: entry.id,
        start,
        end,
        title: entry.event_name,
        type: entry.type as SchoolEventType,
        allDay: true,
        expectedHours: entry.expected_hours ?? null,
        calendarId: calendarIdByType[entry.type as SchoolEventType] ?? "1",
        color: entry.color ?? defaultEventColorByType[entry.type as SchoolEventType],
      };
    });

    setEvents(mapped);
    setLoading(false);
  }, [toast]);

  React.useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filteredEvents = React.useMemo(
    () => events.filter(e => selectedCalendars.includes(e.calendarId)),
    [events, selectedCalendars]
  );

  // Upcoming events — next 30 days, sorted
  const upcomingEvents = React.useMemo(() => {
    const now = new Date();
    const cutoff = addDays(now, 30);
    return events
      .filter(e => (isToday(e.start) || isFuture(e.start)) && e.start <= cutoff)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 8);
  }, [events]);

  // Which Nigeria holidays are not yet added
  const missingHolidays = React.useMemo(() => {
    const existingDates = new Set(events.map(e => format(e.start, "yyyy-MM-dd")));
    return NIGERIA_HOLIDAYS.filter(h => !existingDates.has(h.date));
  }, [events]);

  const resetForm = React.useCallback(() => {
    setSelectedEvent(null);
    setEventName("");
    setEventType("event");
    setEventStartDate("");
    setEventEndDate("");
    setExpectedHours("");
    setEventColor(defaultEventColorByType.event);
  }, []);

  const openCreateForm = (date?: string) => {
    resetForm();
    const d = date ?? format(new Date(), "yyyy-MM-dd");
    setEventStartDate(d);
    setEventEndDate(d);
    setIsFormOpen(true);
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    resetForm();
    const start = format(slotInfo.start, "yyyy-MM-dd");
    // For multi-day drag selection, end is exclusive in rbc so subtract 1 day
    const rawEnd = new Date(slotInfo.end);
    rawEnd.setDate(rawEnd.getDate() - 1);
    const end = format(rawEnd < slotInfo.start ? slotInfo.start : rawEnd, "yyyy-MM-dd");
    setEventStartDate(start);
    setEventEndDate(end);
    setIsFormOpen(true);
  };

  const handleSelectEvent = (event: SchoolEvent) => {
    setSelectedEvent(event);
    setEventName(event.title);
    setEventType(event.type);
    setEventStartDate(format(event.start, "yyyy-MM-dd"));
    setEventEndDate(format(event.end, "yyyy-MM-dd"));
    setExpectedHours(event.expectedHours?.toString() ?? "");
    setEventColor(event.color || defaultEventColorByType[event.type]);
    setIsFormOpen(true);
  };

  const handleEventTypeChange = (value: SchoolEventType) => {
    if (!eventColor || eventColor === defaultEventColorByType[eventType]) {
      setEventColor(defaultEventColorByType[value]);
    }
    setEventType(value);
  };

  // Drag and drop reschedule
  const handleEventDrop = async ({ event, start }: { event: SchoolEvent; start: Date | string }) => {
    const newDate = format(new Date(start), "yyyy-MM-dd");
    const { error } = await supabase
      .from("school_calendar")
      .update({ event_date: newDate })
      .eq("id", event.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchEvents();
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !eventStartDate) return;
    if (eventEndDate && eventEndDate < eventStartDate) {
      toast({ title: "Invalid dates", description: "End date cannot be before start date.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      event_name: eventName.trim(),
      event_date: eventStartDate,
      end_date: eventEndDate && eventEndDate !== eventStartDate ? eventEndDate : null,
      type: eventType,
      expected_hours: expectedHours ? Number(expectedHours) : null,
      color: eventColor,
    };
    const response = selectedEvent
      ? await supabase.from("school_calendar").update(payload).eq("id", selectedEvent.id)
      : await supabase.from("school_calendar").insert(payload);
    setSaving(false);
    if (response.error) {
      toast({ title: "Calendar Error", description: response.error.message, variant: "destructive" });
      return;
    }
    toast({ title: selectedEvent ? "Event Updated" : "Event Added" });
    setIsFormOpen(false);
    resetForm();
    fetchEvents();
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    const { error } = await supabase.from("school_calendar").delete().eq("id", selectedEvent.id);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Event Deleted", variant: "destructive" });
    setIsFormOpen(false);
    resetForm();
    fetchEvents();
  };

  const handleAddNigeriaHoliday = async (holiday: typeof NIGERIA_HOLIDAYS[0]) => {
    setAddingHoliday(holiday.date);
    const { error } = await supabase.from("school_calendar").insert({
      event_name: holiday.name,
      event_date: holiday.date,
      type: holiday.type,
      color: defaultEventColorByType[holiday.type],
    });
    setAddingHoliday(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Holiday Added", description: holiday.name });
      fetchEvents();
    }
  };

  const handleAddAllHolidays = async () => {
    setSaving(true);
    const inserts = missingHolidays.map(h => ({
      event_name: h.name,
      event_date: h.date,
      type: h.type,
      color: defaultEventColorByType[h.type],
    }));
    const { error } = await supabase.from("school_calendar").insert(inserts);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Holidays Added", description: `${inserts.length} Nigerian public holidays added.` });
      setShowHolidaySuggestions(false);
      fetchEvents();
    }
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">School Calendar</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {missingHolidays.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowHolidaySuggestions(v => !v)}
              className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50">
              <Sparkles className="h-3.5 w-3.5" />
              {missingHolidays.length} Nigerian holidays to add
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setCurrentDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentDate, "MMMM yyyy")}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setCurrentDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={() => openCreateForm()}>
            <CalendarDays className="h-4 w-4 mr-1.5" /> Add Event
          </Button>
        </div>
      </div>

      {/* Nigeria holidays suggestion banner */}
      {showHolidaySuggestions && missingHolidays.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Nigerian Public Holidays {currentYear}
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={handleAddAllHolidays} disabled={saving}>
                  Add All ({missingHolidays.length})
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600"
                  onClick={() => setShowHolidaySuggestions(false)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-2">
              {missingHolidays.map(h => (
                <button
                  key={h.date}
                  onClick={() => handleAddNigeriaHoliday(h)}
                  disabled={addingHoliday === h.date}
                  className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  {h.name}
                  <span className="text-amber-500">{format(parseISO(h.date), "MMM d")}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto">
          <CalendarSidebar onCreateEvent={() => openCreateForm()} />

          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {upcomingEvents.map(e => (
                  <button
                    key={e.id}
                    onClick={() => handleSelectEvent(e)}
                    className="w-full flex items-start gap-2.5 text-left hover:bg-muted/50 rounded-lg p-1.5 transition-colors"
                  >
                    <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {isToday(e.start) ? "Today" : format(e.start, "MMM d")}
                        {format(e.start, "yyyy-MM-dd") !== format(e.end, "yyyy-MM-dd")
                          ? ` – ${format(e.end, "MMM d")}`
                          : ""}
                      </p>
                    </div>
                    <Badge className="ml-auto shrink-0 text-[10px] px-1.5 py-0"
                      style={{ backgroundColor: e.color + "20", color: e.color, border: `1px solid ${e.color}40` }}>
                      {eventTypeLabel[e.type]}
                    </Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Calendar */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardContent className="p-2 md:p-4 h-full">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Loading calendar...</p>
                </div>
              ) : (
                <DnDCalendar
                  localizer={localizer}
                  events={filteredEvents}
                  startAccessor="start"
                  endAccessor="end"
                  selectable
                  resizable={false}
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  onEventDrop={handleEventDrop}
                  views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
                  view={currentView}
                  onView={setCurrentView}
                  date={currentDate}
                  onNavigate={setCurrentDate}
                  popup
                  components={{ event: EventComponent }}
                  style={{ height: "calc(100vh - 280px)", minHeight: 500 }}
                  toolbar={false}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event form dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <Label htmlFor="event-name">Event Name</Label>
              <Input id="event-name" value={eventName} onChange={e => setEventName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-start">Start Date</Label>
                <Input id="event-start" type="date" value={eventStartDate} onChange={e => {
                  setEventStartDate(e.target.value);
                  if (!eventEndDate || eventEndDate < e.target.value) setEventEndDate(e.target.value);
                }} required />
              </div>
              <div>
                <Label htmlFor="event-end">End Date</Label>
                <Input id="event-end" type="date" value={eventEndDate} min={eventStartDate}
                  onChange={e => setEventEndDate(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Leave same as start for single-day</p>
              </div>
            </div>
            <div>
              <Label htmlFor="event-type">Event Type</Label>
              <Select value={eventType} onValueChange={handleEventTypeChange}>
                <SelectTrigger id="event-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(eventTypeLabel) as [SchoolEventType, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Event Color</Label>
              <div className="flex items-center gap-3">
                <Input type="color" value={eventColor} onChange={e => setEventColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer p-1" />
                <div className="flex flex-wrap gap-2">
                  {quickEventColors.map(color => (
                    <button key={color} type="button"
                      className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: color, borderColor: eventColor === color ? "#0f172a" : "transparent" }}
                      onClick={() => setEventColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="expected-hours">Expected Hours (optional)</Label>
              <Input id="expected-hours" type="number" min="0" step="0.25" placeholder="e.g. 4"
                value={expectedHours} onChange={e => setExpectedHours(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">For early-closure days with reduced hours.</p>
            </div>
            <DialogFooter>
              {selectedEvent && (
                <Button type="button" variant="destructive" onClick={handleDeleteEvent} className="mr-auto" disabled={saving}>
                  Delete
                </Button>
              )}
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={saving}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
