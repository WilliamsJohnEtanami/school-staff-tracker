import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { CalendarProvider } from "@/contexts/CalendarContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LocationGate from "@/components/LocationGate";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import StaffDashboard from "@/pages/staff/StaffDashboard";
import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import StaffManagement from "@/pages/admin/StaffManagement";
import SettingsPage from "@/pages/admin/SettingsPage";
import Reports from "@/pages/admin/Reports";
import LeaveManagement from "@/pages/admin/LeaveManagement";
import CalendarPage from "@/pages/admin/Calendar";
import StaffProfile from "@/pages/admin/StaffProfile";
import AdminSetup from "@/pages/AdminSetup";
import NotificationsPage from "@/pages/NotificationsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LocationProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin/setup" element={<AdminSetup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route path="/staff" element={
                <ProtectedRoute requiredRole="staff">
                  <LocationGate>
                    <StaffDashboard />
                  </LocationGate>
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/staff/attendance" replace />} />
                <Route path="attendance" element={<StaffDashboard />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="leave" element={<LeaveManagement />} />
              </Route>

              <Route path="/admin" element={
                <ProtectedRoute requiredRole="admin">
                  <CalendarProvider>
                    <AdminLayout />
                  </CalendarProvider>
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="staff" element={<StaffManagement />} />
                <Route path="staff/:staffId" element={<StaffProfile />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="leave" element={<LeaveManagement />} />
              </Route>
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </LocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
