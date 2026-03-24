import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useCalendar } from '@/contexts/CalendarContext';

const CalendarSidebar = () => {
  const { calendars, selectedCalendars, toggleCalendar } = useCalendar();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>My Calendars</span>
          <Button size="sm" variant="outline">
            <PlusCircle className="h-4 w-4 mr-2" />
            New
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {calendars.map((calendar) => (
            <div key={calendar.id} className="flex items-center space-x-2">
              <Checkbox
                id={calendar.id}
                checked={selectedCalendars.includes(calendar.id)}
                onCheckedChange={() => toggleCalendar(calendar.id)}
                className={`data-[state=checked]:${calendar.color}`}
              />
              <Label htmlFor={calendar.id} className="flex items-center">
                <span className={`h-4 w-4 rounded-full ${calendar.color} mr-2`}></span>
                {calendar.name}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarSidebar;
