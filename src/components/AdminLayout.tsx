import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Users, Settings, FileText, LogOut, GraduationCap, CalendarOff, BarChart, Calendar, Bell, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { to: "/admin/analytics", icon: BarChart, label: "Analytics", end: true },
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/staff", icon: Users, label: "Staff" },
  { to: "/admin/calendar", icon: Calendar, label: "School Calendar" },
  { to: "/admin/leave", icon: CalendarOff, label: "Leave" },
  { to: "/admin/reports", icon: FileText, label: "Reports" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

const AdminLayout = () => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationCount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-primary-foreground">
        <div className="p-6 flex items-center gap-3">
          <GraduationCap className="h-8 w-8" />
          <div>
            <h1 className="font-bold text-lg">Attendance</h1>
            <p className="text-xs opacity-80">Admin Panel</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors", isActive ? "bg-primary-foreground/20 font-medium" : "hover:bg-primary-foreground/10 opacity-80")}>
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.to === "/notifications" && unreadCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-primary-foreground/20">
          <p className="text-sm opacity-80 mb-2">{profile?.name}</p>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile nav - hamburger menu */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6" />
            <div>
              <h1 className="font-bold text-base">Attendance</h1>
              <p className="text-xs opacity-80">Admin Panel</p>
            </div>
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-primary text-primary-foreground border-primary-foreground/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold">Menu</h2>
                <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)} className="text-primary-foreground hover:bg-primary-foreground/10">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="space-y-2">
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors", isActive ? "bg-primary-foreground/20 font-medium" : "hover:bg-primary-foreground/10 opacity-80")}>
                    <item.icon className="h-5 w-5" />
                    {item.label}
                    {item.to === "/notifications" && unreadCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                        {unreadCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-6 pt-4 border-t border-primary-foreground/20">
                <p className="text-sm opacity-80 mb-2">{profile?.name}</p>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-primary-foreground hover:bg-primary-foreground/10">
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
