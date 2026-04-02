import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useCalendar } from '@/contexts/CalendarContext';
import { cn } from '@/lib/utils';

type CalendarSidebarProps = {
  onCreateEvent: () => void;
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CalendarSidebar = ({ onCreateEvent }: CalendarSidebarProps) => {
  const { calendars, selectedCalendars, toggleCalendar } = useCalendar();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>My Calendars</span>
          <Button size="sm" variant="outline" onClick={onCreateEvent}>
            <PlusCircle className="h-4 w-4 mr-2" />
            New
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {calendars.map((calendar) => (
            <button
              key={calendar.id}
              type="button"
              onClick={() => toggleCalendar(calendar.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                selectedCalendars.includes(calendar.id)
                  ? "shadow-sm"
                  : "border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/40"
              )}
              style={
                selectedCalendars.includes(calendar.id)
                  ? {
                      borderColor: calendar.color,
                      backgroundColor: hexToRgba(calendar.color, 0.14),
                    }
                  : undefined
              }
            >
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full border"
                style={{
                  borderColor: calendar.color,
                  backgroundColor: selectedCalendars.includes(calendar.id)
                    ? hexToRgba(calendar.color, 0.16)
                    : "transparent",
                }}
              >
                {selectedCalendars.includes(calendar.id) ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: calendar.color }}
                  />
                ) : null}
              </span>
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: calendar.color }}
              />
              <span
                className={cn(
                  "text-sm",
                  selectedCalendars.includes(calendar.id) ? "font-semibold" : "font-medium"
                )}
                style={selectedCalendars.includes(calendar.id) ? { color: calendar.color } : undefined}
              >
                {calendar.name}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarSidebar;
