import * as React from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, EventProps, SlotInfo, Views } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import enUS from "date-fns/locale/en-US";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCalendar } from "@/contexts/CalendarContext";
import { supabase } from "@/integrations/supabase/client";
import CalendarSidebar from "@/components/CalendarSidebar";
import "react-big-calendar/lib/css/react-big-calendar.css";
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
};

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const calendarIdByType: Record<SchoolEventType, string> = {
  event: "1",
  holiday: "2",
  early_closure: "3",
  no_school: "4",
};

const mapEventTypeToCalendarId = (type: SchoolEventType) => calendarIdByType[type];

const mapCalendarIdToEventType = (calendarId: string): SchoolEventType => {
  switch (calendarId) {
    case "2":
      return "holiday";
    case "3":
      return "early_closure";
    case "4":
      return "no_school";
    default:
      return "event";
  }
};

const toDateKey = (date: Date) => format(date, "yyyy-MM-dd");

const eventTypeLabel: Record<SchoolEventType, string> = {
  event: "Event",
  holiday: "Holiday",
  early_closure: "Early Closure",
  no_school: "No School",
};

const defaultEventColorByType: Record<SchoolEventType, string> = {
  event: "#3b82f6",
  holiday: "#ef4444",
  early_closure: "#f59e0b",
  no_school: "#22c55e",
};

const quickEventColors = [
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#ec4899",
  "#64748b",
];

const Event = ({ event }: EventProps<SchoolEvent>) => {
  const { calendars } = useCalendar();
  const calendar = calendars.find((entry) => entry.id === event.calendarId);
  const color = event.color || calendar?.color || defaultEventColorByType[event.type];

  return (
    <div
      className="rounded px-2 py-1 text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      <span>{event.title}</span>
    </div>
  );
};

const CalendarPage = () => {
  const { toast } = useToast();
  const { calendars, selectedCalendars } = useCalendar();
  const [events, setEvents] = React.useState<SchoolEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedEvent, setSelectedEvent] = React.useState<SchoolEvent | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [eventName, setEventName] = React.useState("");
  const [eventType, setEventType] = React.useState<SchoolEventType>("event");
  const [eventDate, setEventDate] = React.useState("");
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

    const mappedEvents: SchoolEvent[] = (data ?? []).map((entry) => {
      const start = new Date(`${entry.event_date}T00:00:00`);
      const end = new Date(`${entry.event_date}T23:59:59`);

      return {
        id: entry.id,
        start,
        end,
        title: entry.event_name,
        type: entry.type as SchoolEventType,
        allDay: true,
        expectedHours: entry.expected_hours ?? null,
        calendarId: mapEventTypeToCalendarId(entry.type as SchoolEventType),
        color: entry.color ?? defaultEventColorByType[entry.type as SchoolEventType],
      };
    });

    setEvents(mappedEvents);
    setLoading(false);
  }, [toast]);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = React.useMemo(
    () => events.filter((event) => selectedCalendars.includes(event.calendarId)),
    [events, selectedCalendars]
  );

  const resetForm = React.useCallback(() => {
    setSelectedEvent(null);
    setEventName("");
    setEventType("event");
    setEventDate("");
    setExpectedHours("");
    setEventColor(defaultEventColorByType.event);
  }, []);

  const handleCreateEvent = () => {
    resetForm();
    setEventDate(toDateKey(new Date()));
    setIsFormOpen(true);
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    resetForm();
    setEventDate(toDateKey(slotInfo.start));
    setIsFormOpen(true);
  };

  const handleSelectEvent = (event: SchoolEvent) => {
    setSelectedEvent(event);
    setEventName(event.title);
    setEventType(event.type);
    setEventDate(toDateKey(event.start));
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eventName.trim() || !eventDate) {
      return;
    }

    setSaving(true);

    const payload = {
      event_name: eventName.trim(),
      event_date: eventDate,
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

    if (error) {
      toast({ title: "Calendar Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Event Deleted", variant: "destructive" });
    setIsFormOpen(false);
    resetForm();
    fetchEvents();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">School Calendar</h1>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <CalendarSidebar onCreateEvent={handleCreateEvent} />
        </div>
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
              {loading ? (
                <p className="text-muted-foreground">Loading calendar events...</p>
              ) : (
                <BigCalendar
                  localizer={localizer}
                  events={filteredEvents}
                  startAccessor="start"
                  endAccessor="end"
                  selectable
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  views={[Views.MONTH, Views.WEEK, Views.DAY]}
                  defaultView={Views.MONTH}
                  popup
                  components={{ event: Event }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <Label htmlFor="event-name">Event Name</Label>
              <Input id="event-name" value={eventName} onChange={(e) => setEventName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="event-date">Date</Label>
              <Input id="event-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="event-type">Event Type</Label>
              <Select value={eventType} onValueChange={handleEventTypeChange}>
                <SelectTrigger id="event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">{eventTypeLabel.event}</SelectItem>
                  <SelectItem value="holiday">{eventTypeLabel.holiday}</SelectItem>
                  <SelectItem value="early_closure">{eventTypeLabel.early_closure}</SelectItem>
                  <SelectItem value="no_school">{eventTypeLabel.no_school}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="event-color">Event Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="event-color"
                  type="color"
                  value={eventColor}
                  onChange={(e) => setEventColor(e.target.value)}
                  className="h-11 w-16 cursor-pointer p-1"
                />
                <div className="flex flex-wrap gap-2">
                  {quickEventColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-105"
                      style={{
                        backgroundColor: color,
                        borderColor: eventColor === color ? "#0f172a" : "transparent",
                      }}
                      onClick={() => setEventColor(color)}
                      aria-label={`Use ${color} for event color`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="expected-hours">Expected Hours (optional)</Label>
              <Input
                id="expected-hours"
                type="number"
                min="0"
                step="0.25"
                placeholder="e.g. 4"
                value={expectedHours}
                onChange={(e) => setExpectedHours(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Useful for early-closure days when staff are expected to work fewer hours.
              </p>
            </div>
            <DialogFooter>
              {selectedEvent ? (
                <Button type="button" variant="destructive" onClick={handleDeleteEvent} className="mr-auto" disabled={saving}>
                  Delete
                </Button>
              ) : null}
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={saving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
