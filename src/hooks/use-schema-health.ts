import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMissingPublicTableError } from "@/lib/supabase-errors";

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

        if (notifError && isMissingPublicTableError(notifError, "notifications")) {
          setError("Notifications table is missing from the schema cache");
        } else if (statusError && isMissingPublicTableError(statusError, "notification_statuses")) {
          setError("Notification statuses table is missing from the schema cache");
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
