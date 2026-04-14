import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, RefreshCw, Unlink, ExternalLink } from 'lucide-react';
import { useCalendar } from '@/contexts/CalendarContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type CalendarSidebarProps = {
  onCreateEvent: () => void;
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar";

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CalendarSidebar = ({ onCreateEvent }: CalendarSidebarProps) => {
  const { calendars, selectedCalendars, toggleCalendar } = useCalendar();
  const { user } = useAuth();
  const { toast } = useToast();
  const [googleConnected, setGoogleConnected] = React.useState(false);
  const [googleCalendarId, setGoogleCalendarId] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [checkingStatus, setCheckingStatus] = React.useState(true);

  // Check Google connection status on mount
  React.useEffect(() => {
    const checkStatus = async () => {
      if (!user?.id) return;
      setCheckingStatus(true);
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "status" },
      });
      if (!error && data?.connected) {
        setGoogleConnected(true);
        setGoogleCalendarId(data.calendarId);
      }
      setCheckingStatus(false);
    };
    checkStatus();
  }, [user?.id]);

  // Handle OAuth callback — Google returns ?code= in the URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    // Only handle if it looks like a Google OAuth code (long alphanumeric)
    if (!code || code.length < 20) return;

    // Clean URL immediately
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("scope");
    window.history.replaceState({}, "", url.toString());

    const exchange = async () => {
      setSyncing(true);
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: {
          action: "exchange_code",
          code,
          redirectUri: `${window.location.origin}/admin/calendar`,
        },
      });
      setSyncing(false);
      if (error || data?.error) {
        toast({ title: "Google Connect Failed", description: data?.error ?? error?.message, variant: "destructive" });
      } else {
        setGoogleConnected(true);
        setGoogleCalendarId(data.calendarId);
        toast({ title: "Google Calendar Connected", description: "Your school calendar will now sync to Google." });
      }
    };
    exchange();
  }, [toast]);

  const handleGoogleConnect = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast({ title: "Not Configured", description: "Add VITE_GOOGLE_CLIENT_ID to your .env file.", variant: "destructive" });
      return;
    }
    const redirectUri = `${window.location.origin}/admin/calendar`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      access_type: "offline",
      prompt: "consent",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleSync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "sync" },
    });
    setSyncing(false);
    if (error || data?.error) {
      toast({ title: "Sync Failed", description: data?.error ?? error?.message, variant: "destructive" });
    } else {
      toast({ title: "Sync Complete", description: data.message });
    }
  };

  const handleDisconnect = async () => {
    const { error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "disconnect" },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setGoogleConnected(false);
      setGoogleCalendarId(null);
      toast({ title: "Disconnected", description: "Google Calendar has been unlinked." });
    }
  };

  return (
    <div className="space-y-4">
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
                    ? { borderColor: calendar.color, backgroundColor: hexToRgba(calendar.color, 0.14) }
                    : undefined
                }
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full border"
                  style={{
                    borderColor: calendar.color,
                    backgroundColor: selectedCalendars.includes(calendar.id) ? hexToRgba(calendar.color, 0.16) : "transparent",
                  }}
                >
                  {selectedCalendars.includes(calendar.id) ? (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: calendar.color }} />
                  ) : null}
                </span>
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: calendar.color }} />
                <span
                  className={cn("text-sm", selectedCalendars.includes(calendar.id) ? "font-semibold" : "font-medium")}
                  style={selectedCalendars.includes(calendar.id) ? { color: calendar.color } : undefined}
                >
                  {calendar.name}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checkingStatus ? (
            <p className="text-xs text-muted-foreground">Checking connection...</p>
          ) : googleConnected ? (
            <>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500 text-white">Connected</Badge>
              </div>
              {googleCalendarId && (
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(googleCalendarId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> View in Google Calendar
                </a>
              )}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleDisconnect}>
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Events sync to a "School Attendance" calendar in your Google account.</p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Connect to sync school events to your Google Calendar.</p>
              <Button size="sm" className="w-full" variant="outline" onClick={handleGoogleConnect}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Connect Google Calendar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarSidebar;
