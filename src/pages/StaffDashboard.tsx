import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "@/contexts/LocationContext";
import { Button } from "@/components/ui/button";
import { useNotificationCount } from "@/hooks/use-notification-count";
import NotificationsPanel from "@/components/NotificationsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, MapPin, LogOut, Loader2, XCircle, LogIn, History, ChevronDown, CalendarOff, Coffee, Briefcase, Play, Pause, Power } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";

// --- Mock Data ---
const MOCK_CONTRACT = { contractedHours: 8.0 };
const MOCK_PROFILE = { name: "Sunday Solomon" }; // Using mock profile as useAuth is not fully mocked here

const DEMO_NOTIFICATIONS = [
  { id: "demo-1", title: "Welcome to School Staff Tracker", message: "Use the notification page to see all broadcasts and staff requests.", created_at: new Date().toISOString() },
  { id: "demo-2", title: "System Update", message: "New leave categories added in the next release.", created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
  { id: "demo-3", title: "Reminder", message: "Submit your weekly report before Friday 5 PM.", created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
];
// --- End Mock Data ---

type SessionType = "work" | "break" | "off-site";
type Session = {
  type: SessionType;
  startedAt: Date;
  endedAt?: Date;
};
type SessionState = "NOT_CLOCKED_IN" | "IN_WORK" | "IN_BREAK" | "IN_OFFSITE" | "CLOCKED_OUT";


const StaffDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { latitude, longitude } = useLocation();
  const { unreadCount } = useNotificationCount();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- State Management ---
  const [sessionState, setSessionState] = useState<SessionState>("NOT_CLOCKED_IN");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);


  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60); // Update time every minute
    return () => clearInterval(timer);
  }, []);

  const handleSessionChange = (newState: SessionState, sessionType?: SessionType) => {
    setIsLoading(true);
    // Simulate network delay
    setTimeout(() => {
      const now = new Date();
      let newSessions = [...sessions];

      // End the current session if it exists and is open
      const currentSession = newSessions.find(s => !s.endedAt);
      if (currentSession) {
        currentSession.endedAt = now;
      }

      // Start a new session if needed
      if (sessionType) {
        newSessions.push({ type: sessionType, startedAt: now });
      }

      setSessions(newSessions);
      setSessionState(newState);
      setIsLoading(false);
      toast({ title: "Status Updated", description: `You are now ${newState.replace(/_/g, " ").toLowerCase()}`});
    }, 500);
  };

  const totalHoursWorked = useMemo(() => {
    const totalMinutes = sessions
      .filter(s => s.type === 'work' || s.type === 'off-site')
      .reduce((acc, session) => {
        const end = session.endedAt || new Date(); // Use current time for ongoing sessions
        return acc + differenceInMinutes(end, session.startedAt);
      }, 0);
    return totalMinutes / 60;
  }, [sessions, currentTime]);


  const getIconForType = (type: SessionType) => {
    switch (type) {
      case "work": return <Briefcase className="h-4 w-4 mr-2" />;
      case "break": return <Coffee className="h-4 w-4 mr-2" />;
      case "off-site": return <MapPin className="h-4 w-4 mr-2" />;
    }
  };

  const renderActionButtons = () => {
    if (isLoading) {
      return <Button disabled className="w-full"><Loader2 className="h-5 w-5 animate-spin" /></Button>;
    }

    switch (sessionState) {
      case "NOT_CLOCKED_IN":
        return (
          <Button onClick={() => handleSessionChange("IN_WORK", "work")} className="w-full h-14 text-lg bg-green-500 hover:bg-green-600 text-white">
            <Play className="h-5 w-5 mr-2" /> Clock In
          </Button>
        );
      case "IN_WORK":
        return (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => handleSessionChange("IN_BREAK", "break")} variant="outline">
              <Coffee className="h-4 w-4 mr-2" /> Start Break
            </Button>
            <Button onClick={() => handleSessionChange("CLOCKED_OUT")} variant="destructive" className="h-full">
              <Power className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          </div>
        );
      case "IN_BREAK":
        return (
          <Button onClick={() => handleSessionChange("IN_WORK", "work")} className="w-full h-14 text-lg">
            <Play className="h-5 w-5 mr-2" /> End Break
          </Button>
        );
      case "CLOCKED_OUT":
        return <p className="text-center text-muted-foreground p-4">You have clocked out for the day. Well done!</p>;
      default:
        return null;
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Staff Dashboard</h1>
          <p className="text-sm opacity-90">Welcome, {profile?.name || MOCK_PROFILE.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/notifications" className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm">
            Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
          </Link>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{format(currentTime, "EEEE, MMMM d, yyyy")}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{format(currentTime, "h:mm a")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex justify-around text-center">
                <div>
                    <p className="text-2xl font-bold">{totalHoursWorked.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Hours Worked</p>
                </div>
                <div>
                    <p className="text-2xl font-bold">{MOCK_CONTRACT.contractedHours.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Contracted</p>
                </div>
                 <div>
                    <p className={`text-2xl font-bold ${totalHoursWorked < MOCK_CONTRACT.contractedHours ? 'text-red-500' : 'text-green-500'}`}>
                        {(totalHoursWorked - MOCK_CONTRACT.contractedHours).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Balance</p>
                </div>
             </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
            {renderActionButtons()}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Today's Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">Your day hasn't started yet.</p>
            ) : (
                sessions.map((session, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center">
                            {getIconForType(session.type)}
                            <span className="capitalize">{session.type}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {format(session.startedAt, "h:mm a")} - {session.endedAt ? format(session.endedAt, "h:mm a") : "Now"}
                        </p>
                    </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Your Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Lat: {latitude?.toFixed(4) ?? '...'}, Lng: {longitude?.toFixed(4) ?? '...'}</p>
            <p className="text-xs text-muted-foreground">Location card will show live distance check once DB is connected.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Latest Notifications (Demo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_NOTIFICATIONS.map((notif) => (
              <div key={notif.id} className="border rounded-lg p-3">
                <p className="font-semibold">{notif.title}</p>
                <p className="text-sm text-muted-foreground">{notif.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{format(new Date(notif.created_at), "MMM d, yyyy h:mm a")}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Link to="/notifications" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
            View All Notifications
          </Link>
        </div>

        <NotificationsPanel />
      </main>
    </div>
  );
};

export default StaffDashboard;
