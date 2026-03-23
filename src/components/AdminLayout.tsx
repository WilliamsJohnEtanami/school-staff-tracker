import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Users, Settings, FileText, LogOut, GraduationCap, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/staff", icon: Users, label: "Staff" },
  { to: "/admin/leave", icon: CalendarOff, label: "Leave" },
  { to: "/admin/reports", icon: FileText, label: "Reports" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

const AdminLayout = () => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

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

      {/* Mobile nav */}
      <nav className="md:hidden flex bg-primary text-primary-foreground p-2 gap-1 overflow-x-auto">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors", isActive ? "bg-primary-foreground/20 font-medium" : "hover:bg-primary-foreground/10 opacity-80")}>
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-primary-foreground hover:bg-primary-foreground/10 ml-auto">
          <LogOut className="h-4 w-4" />
        </Button>
      </nav>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
