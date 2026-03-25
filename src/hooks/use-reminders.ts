import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useReminders = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const triggerReminder = async (type: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reminders", {
        body: { type },
      });

      if (error) {
        toast({
          title: "Reminder Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reminder Sent",
          description: data.message,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerClockInReminders = () => triggerReminder("clock_in_reminders");
  const triggerClockOutReminders = () => triggerReminder("clock_out_reminders");
  const triggerWeeklyReports = () => triggerReminder("weekly_reports");
  const triggerPendingLeaveReminders = () => triggerReminder("pending_leave_reminders");

  return {
    loading,
    triggerClockInReminders,
    triggerClockOutReminders,
    triggerWeeklyReports,
    triggerPendingLeaveReminders,
  };
};