import * as React from 'react';

type Calendar = {
  id: string;
  name: string;
  color: string;
};

type CalendarContextType = {
  calendars: Calendar[];
  selectedCalendars: string[];
  toggleCalendar: (calendarId: string) => void;
};

const initialCalendars: Calendar[] = [
  { id: '1', name: 'Events', color: 'bg-blue-500' },
  { id: '2', name: 'Holidays', color: 'bg-red-500' },
  { id: '3', name: 'Early Closures', color: 'bg-amber-500' },
  { id: '4', name: 'No School', color: 'bg-green-500' },
];

export const CalendarContext = React.createContext<CalendarContextType | undefined>(undefined);

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [calendars] = React.useState<Calendar[]>(initialCalendars);
  const [selectedCalendars, setSelectedCalendars] = React.useState<string[]>(['1', '2', '3', '4']);

  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendars(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  return (
    <CalendarContext.Provider value={{ calendars, selectedCalendars, toggleCalendar }}>
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => {
  const context = React.useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
};
