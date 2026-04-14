import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Calendar, Bell, CalendarOff, History, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import LogoMark from "@/components/LogoMark";

const navItems = [
  { to: "/staff", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/staff/calendar", icon: Calendar, label: "Calendar" },
  { to: "/staff/notifications", icon: Bell, label: "Notifications" },
  { to: "/staff/leave", icon: CalendarOff, label: "Leave" },
  { to: "/staff/history", icon: History, label: "My History" },
];

const StaffLayout = () => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationCount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const NavItems = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onClick}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              isActive ? "bg-primary-foreground/20 font-medium" : "hover:bg-primary-foreground/10 opacity-80"
            )
          }
        >
          <item.icon className="h-5 w-5 shrink-0" />
          {item.label}
          {item.to === "/staff/notifications" && unreadCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background md:h-screen md:flex-row md:overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 flex-col bg-primary text-primary-foreground md:flex md:h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="rounded-xl bg-white/95 p-1 shadow-sm">
            <LogoMark className="h-8 w-8" alt="" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Attendance</h1>
            <p className="text-xs opacity-80">Staff Portal</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          <NavItems />
        </nav>
        <div className="p-4 border-t border-primary-foreground/20">
          <p className="text-sm opacity-80 mb-2 truncate">{profile?.name}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile header + hamburger */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/95 p-1 shadow-sm">
              <LogoMark className="h-6 w-6" alt="" />
            </div>
            <div>
              <h1 className="font-bold text-base">Attendance</h1>
              <p className="text-xs opacity-80">Staff Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{unreadCount}</span>
            )}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 bg-primary text-primary-foreground border-primary-foreground/20">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-semibold">Menu</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <nav className="space-y-2">
                  <NavItems onClick={() => setMobileMenuOpen(false)} />
                </nav>
                <div className="mt-6 pt-4 border-t border-primary-foreground/20">
                  <p className="text-sm opacity-80 mb-2 truncate">{profile?.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="w-full justify-start text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default StaffLayout;
