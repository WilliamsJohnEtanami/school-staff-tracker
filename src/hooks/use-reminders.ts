import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getFunctionErrorMessage } from "@/lib/supabase-errors";

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
          description: getFunctionErrorMessage(error),
          variant: "destructive",
        });
      } else if (data?.success === false && data?.error) {
        toast({
          title: "Reminder Error",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reminder Sent",
          description: data?.message ?? "Reminder request completed.",
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
