import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { getFunctionErrorMessage } from "@/lib/supabase-errors";

const StaffManagement = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [shiftName, setShiftName] = useState("");
  const [adding, setAdding] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<any | null>(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchStaff = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "staff"),
    ]);

    const staffIds = new Set((roles ?? []).map((row) => row.user_id));
    setStaff((profiles ?? []).filter((profile) => staffIds.has(profile.user_id)));
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const res = await supabase.functions.invoke("manage-staff", {
      body: { action: "create", name, email, password, department, shiftName },
    });

    setAdding(false);
    if (res.error) {
      toast({ title: "Error", description: getFunctionErrorMessage(res.error), variant: "destructive" });
    } else {
      toast({ title: "Staff Added", description: `${name} has been added successfully.` });
      setName(""); setEmail(""); setPassword(""); setDepartment(""); setShiftName("");
      setDialogOpen(false);
      fetchStaff();
    }
  };

  const toggleStatus = async (profile: any) => {
    const newStatus = profile.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", profile.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchStaff();
    }
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setStaffToDelete(null);
    setDeleteConfirmationName("");
  };

  const normalizedDeleteName = deleteConfirmationName.trim().replace(/\s+/g, " ").toLowerCase();
  const normalizedTargetName = staffToDelete?.name?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
  const canDeleteStaff = !!staffToDelete && normalizedDeleteName.length > 0 && normalizedDeleteName === normalizedTargetName;

  const handleDeleteStaff = async () => {
    if (!staffToDelete || !canDeleteStaff) {
      return;
    }

    setDeleting(true);
    const res = await supabase.functions.invoke("manage-staff", {
      body: {
        action: "delete",
        userId: staffToDelete.user_id,
        confirmName: deleteConfirmationName,
      },
    });

    setDeleting(false);

    if (res.error) {
      toast({ title: "Delete failed", description: getFunctionErrorMessage(res.error), variant: "destructive" });
      return;
    }

    toast({ title: "Staff Deleted", description: `${staffToDelete.name} has been deleted permanently.` });
    closeDeleteDialog();
    fetchStaff();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Staff Management</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Staff Member</DialogTitle></DialogHeader>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div><Label>Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
              <div><Label>Department</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Optional, e.g. Science" /></div>
              <div><Label>Shift</Label><Input value={shiftName} onChange={(e) => setShiftName(e.target.value)} placeholder="Optional, e.g. Morning" /></div>
              <Button type="submit" disabled={adding} className="w-full">
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add Staff
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link to={`/admin/staff/${s.id}`} className="text-primary hover:underline">
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>{s.department || "—"}</TableCell>
                      <TableCell>{s.shift_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"} className={s.status === "active" ? "bg-accent text-accent-foreground" : ""}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => toggleStatus(s)}>
                            {s.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setStaffToDelete(s);
                              setDeleteConfirmationName("");
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!staffToDelete} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff Profile</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently delete the staff account, profile, attendance-linked records, and access to the app.
                </p>
                {staffToDelete ? (
                  <p>
                    To confirm, type the full name exactly as shown: <span className="font-semibold text-foreground">{staffToDelete.name}</span>
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-staff-name">Staff Full Name</Label>
            <Input
              id="delete-staff-name"
              value={deleteConfirmationName}
              onChange={(event) => setDeleteConfirmationName(event.target.value)}
              placeholder={staffToDelete?.name ?? "Enter staff full name"}
              autoComplete="off"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteStaff} disabled={!canDeleteStaff || deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Staff
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StaffManagement;
