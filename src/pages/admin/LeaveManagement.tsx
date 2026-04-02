import AdminLeaveRequestsPanel from "@/components/AdminLeaveRequestsPanel";

const LeaveManagement = () => {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Leave Requests</h2>
        <p className="text-sm text-muted-foreground">
          Approve or reject leave requests from here without hunting through the dashboard.
        </p>
      </div>

      <AdminLeaveRequestsPanel />
    </div>
  );
};

export default LeaveManagement;
