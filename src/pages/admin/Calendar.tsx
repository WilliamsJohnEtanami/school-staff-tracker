import * as React from 'react';
import { Calendar, dateFnsLocalizer, Views, EventProps } from 'react-big-calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCalendar } from '@/contexts/CalendarContext';
import CalendarSidebar from '@/components/CalendarSidebar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './Calendar.css';

// --- MOCK DATA ---
type SchoolEvent = {
  id: string;
  start: Date;
  end: Date;
  title: string;
  type: 'holiday' | 'early_closure' | 'event' | 'no_school';
  allDay?: boolean;
  description?: string;
  calendarId: string;
};

const initialEvents: SchoolEvent[] = [
    { id: '1', start: new Date('2026-03-25T10:00:00'), end: new Date('2026-03-25T11:00:00'), title: 'National Holiday', type: 'holiday', allDay: false, description: 'A day off for everyone.', calendarId: '2' },
    { id: '2', start: new Date('2026-04-10T09:00:00'), end: new Date('2026-04-10T17:00:00'), title: 'Staff Training Day', type: 'no_school', allDay: true, description: 'All staff are required to attend the training.', calendarId: '1' },
    { id: '3', start: new Date('2026-04-21T13:00:00'), end: new Date('2026-04-21T15:00:00'), title: 'Parent-Teacher Conf.', type: 'early_closure', allDay: false, description: 'Discussing student progress.', calendarId: '1' },
    { id: '4', start: new Date('2026-03-30T10:00:00'), end: new Date('2026-03-30T11:00:00'), title: 'Board Meeting', type: 'event', allDay: false, description: 'Monthly board meeting.', calendarId: '3' },
];

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

const Event = ({ event }: EventProps<SchoolEvent>) => {
    const { calendars } = useCalendar();
    const calendar = calendars.find(c => c.id === event.calendarId);
    const color = calendar ? calendar.color : 'bg-gray-500';
  
    return (
      <div className={`${color} p-1 rounded`}>
        <span>{event.title}</span>
      </div>
    );
  };

const CalendarPage = () => {
  const { toast } = useToast();
  const { calendars, selectedCalendars } = useCalendar();
  const [events, setEvents] = React.useState<SchoolEvent[]>(initialEvents);
  const [selectedSlot, setSelectedSlot] = React.useState<{ start: Date, end: Date } | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<SchoolEvent | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const [eventName, setEventName] = React.useState('');
  const [eventType, setEventType] = React.useState<SchoolEvent['type']>('event');
  const [allDay, setAllDay] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
  const [calendarId, setCalendarId] = React.useState('1');

  const filteredEvents = React.useMemo(() => {
    return events.filter(event => selectedCalendars.includes(event.calendarId));
  }, [events, selectedCalendars]);

  const handleSelectSlot = (slotInfo: { start: Date, end: Date }) => {
    setSelectedSlot(slotInfo);
    setSelectedEvent(null);
    setEventName('');
    setEventType('event');
    setAllDay(false);
    setDescription('');
    setStartDate(slotInfo.start);
    setEndDate(slotInfo.end);
    setCalendarId('1');
    setIsFormOpen(true);
  };

  const handleSelectEvent = (event: SchoolEvent) => {
    setSelectedEvent(event);
    setSelectedSlot(null);
    setEventName(event.title);
    setEventType(event.type);
    setAllDay(event.allDay || false);
    setDescription(event.description || '');
    setStartDate(event.start);
    setEndDate(event.end);
    setCalendarId(event.calendarId);
    setIsFormOpen(true);
  };

  const onEventResize: withDragAndDropProps['onEventResize'] = ({ event, start, end }) => {
    setEvents((prevEvents) => {
        const updatedEvents = prevEvents.map(e => e.id === event.id ? { ...e, start, end } : e);
        return updatedEvents as SchoolEvent[];
    });
    toast({ title: "Event Resized" });
  };
  
  const onEventDrop: withDragAndDropProps['onEventDrop'] = ({ event, start, end }) => {
      setEvents((prevEvents) => {
          const updatedEvents = prevEvents.map(e => e.id === event.id ? { ...e, start, end } : e);
          return updatedEvents as SchoolEvent[];
      });
      toast({ title: "Event Moved" });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName || (!startDate && !endDate)) return;

    const eventData = {
        title: eventName,
        type: eventType,
        allDay,
        description,
        start: startDate,
        end: endDate,
        calendarId,
    };

    if (selectedEvent) {
        const updatedEvent = { ...selectedEvent, ...eventData };
        setEvents(events.map(ev => ev.id === updatedEvent.id ? updatedEvent : ev));
        toast({ title: "Event Updated" });
    } else if (selectedSlot) {
        const newEvent: SchoolEvent = {
            id: new Date().toISOString(),
            ...eventData,
            start: selectedSlot.start,
            end: selectedSlot.end,
        };
        setEvents([...events, newEvent]);
        toast({ title: "Event Added" });
    }
    setIsFormOpen(false);
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    setEvents(events.filter(ev => ev.id !== selectedEvent.id));
    toast({ title: "Event Deleted", variant: 'destructive' });
    setIsFormOpen(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">School Calendar</h1>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <CalendarSidebar />
        </div>
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
              <DnDCalendar
                localizer={localizer}
                events={filteredEvents}
                startAccessor="start"
                endAccessor="end"
                selectable
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                onEventDrop={onEventDrop}
                onEventResize={onEventResize}
                resizable
                views={[Views.MONTH, Views.WEEK, Views.DAY]}
                defaultView={Views.MONTH}
                components={{
                  event: Event,
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
              <DialogHeader><DialogTitle>{selectedEvent ? 'Edit Event' : 'Add Event'}</DialogTitle></DialogHeader>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                    <Label htmlFor="event-name">Event Name</Label>
                    <Input id="event-name" value={eventName} onChange={e => setEventName(e.target.value)} required />
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="all-day" checked={allDay} onCheckedChange={(checked) => setAllDay(Boolean(checked))} />
                    <Label htmlFor="all-day">All day</Label>
                </div>
                <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input id="start-date" type="datetime-local" value={startDate ? format(startDate, "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setStartDate(new Date(e.target.value))} />
                </div>
                <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input id="end-date" type="datetime-local" value={endDate ? format(endDate, "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setEndDate(new Date(e.target.value))} />
                </div>
                <div>
                    <Label htmlFor="event-type">Event Type</Label>
                    <Select value={eventType} onValueChange={(v: any) => setEventType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="event">Event</SelectItem>
                            <SelectItem value="holiday">Holiday</SelectItem>
                            <SelectItem value="no_school">No School Day</SelectItem>
                            <SelectItem value="early_closure">Early Closure</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="calendar">Calendar</Label>
                    <Select value={calendarId} onValueChange={(v: any) => setCalendarId(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {calendars.map(cal => (
                                <SelectItem key={cal.id} value={cal.id}>{cal.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <DialogFooter>
                    {selectedEvent && <Button type="button" variant="destructive" onClick={handleDeleteEvent} className="mr-auto">Delete</Button>}
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
