import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, UserCog } from "lucide-react";

const StaffManagement = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchStaff = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setStaff(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await supabase.functions.invoke("manage-staff", {
      body: { action: "create", name, email, password },
    });

    setAdding(false);
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" });
    } else {
      toast({ title: "Staff Added", description: `${name} has been added successfully.` });
      setName(""); setEmail(""); setPassword("");
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
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"} className={s.status === "active" ? "bg-accent text-accent-foreground" : ""}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => toggleStatus(s)}>
                          {s.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffManagement;
