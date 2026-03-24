import * as React from 'react';
import { Calendar, dateFnsLocalizer, Views, EventProps } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';

// --- MOCK DATA ---
const NIGERIA_PUBLIC_HOLIDAYS = [
    { name: "New Year's Day", month: 0, day: 1 },
    { name: 'Good Friday', month: 3, day: 7 },
    { name: 'Easter Monday', month: 3, day: 10 },
    { name: 'Workers Day', month: 4, day: 1 },
    { name: 'Democracy Day', month: 5, day: 12 },
    { name: 'Independence Day', month: 9, day: 1 },
    { name: 'Christmas Day', month: 11, day: 25 },
    { name: 'Boxing Day', month: 11, day: 26 },
];

type SchoolEvent = {
  id: string;
  start: Date;
  end: Date;
  title: string;
  type: 'holiday' | 'early_closure' | 'event' | 'no_school';
};

const initialEvents: SchoolEvent[] = [
    { id: '1', start: new Date('2026-03-25'), end: new Date('2026-03-25'), title: 'National Holiday', type: 'holiday' },
    { id: '2', start: new Date('2026-04-10'), end: new Date('2026-04-10'), title: 'Staff Training Day', type: 'no_school' },
    { id: '3', start: new Date('2026-04-21'), end: new Date('2026-04-21'), title: 'Parent-Teacher Conf.', type: 'early_closure' },
];
// --- END MOCK DATA ---

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

const eventTypeClasses = {
  holiday: "bg-red-500 text-white",
  early_closure: "bg-amber-500 text-white",
  event: "bg-blue-500 text-white",
  no_school: "bg-gray-500 text-white",
};

const Event = ({ event }: EventProps<SchoolEvent>) => {
  return (
    <div className={`${eventTypeClasses[event.type]} p-1 rounded`}>
      <span>{event.title}</span>
    </div>
  );
};

const CalendarPage = () => {
  const { toast } = useToast();
  const [events, setEvents] = React.useState<SchoolEvent[]>(initialEvents);
  const [selectedSlot, setSelectedSlot] = React.useState<{ start: Date, end: Date } | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<SchoolEvent | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const [eventName, setEventName] = React.useState('');
  const [eventType, setEventType] = React.useState<SchoolEvent['type']>('event');

  const handleSelectSlot = (slotInfo: { start: Date, end: Date }) => {
    setSelectedSlot(slotInfo);
    setSelectedEvent(null);
    setEventName('');
    setEventType('event');
    setIsFormOpen(true);
  };

  const handleSelectEvent = (event: SchoolEvent) => {
    setSelectedEvent(event);
    setSelectedSlot(null);
    setEventName(event.title);
    setEventType(event.type);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName || (!selectedSlot && !selectedEvent)) return;

    const eventData = {
        title: eventName,
        type: eventType,
    };

    if (selectedEvent) {
        const updatedEvent = { ...selectedEvent, ...eventData };
        setEvents(events.map(ev => ev.id === updatedEvent.id ? updatedEvent : ev));
        toast({ title: "Event Updated" });
    } else if (selectedSlot) {
        const newEvent: SchoolEvent = {
            id: new Date().toISOString(),
            start: selectedSlot.start,
            end: selectedSlot.end,
            ...eventData
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
      <Card>
        <CardContent className="p-4">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            defaultView={Views.MONTH}
            components={{
              event: Event,
            }}
          />
        </CardContent>
      </Card>
      
      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
              <DialogHeader><DialogTitle>{selectedEvent ? 'Edit Event' : 'Add Event'}</DialogTitle></DialogHeader>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {selectedSlot && <p className="text-lg font-medium text-center">{`Add event on ${format(selectedSlot.start, 'MMMM d, yyyy')}`}</p>}
                <div>
                    <Label htmlFor="event-name">Event Name</Label>
                    <Input id="event-name" value={eventName} onChange={e => setEventName(e.target.value)} required />
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
