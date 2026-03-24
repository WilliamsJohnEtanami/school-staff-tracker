import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useSchemaHealth = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSchema = async () => {
      try {
        // Check if notifications table exists
        const { error: notifError } = await supabase
          .from("notifications")
          .select("id")
          .limit(1);

        // Check if notification_statuses table exists
        const { error: statusError } = await supabase
          .from("notification_statuses")
          .select("id")
          .limit(1);

        if (notifError && (notifError.message.toLowerCase().includes("relation") || notifError.code === "42P01")) {
          setError("Notifications table does not exist");
        } else if (statusError && (statusError.message.toLowerCase().includes("relation") || statusError.code === "42P01")) {
          setError("Notification statuses table does not exist");
        } else {
          setError(null);
        }
      } catch (err) {
        setError("Failed to check schema health");
      } finally {
        setLoading(false);
      }
    };

    checkSchema();
  }, []);

  return { loading, error };
};