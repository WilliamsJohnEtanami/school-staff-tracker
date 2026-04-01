type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

const normalize = (value?: string | null) => (value ?? "").toLowerCase();

export const isMissingPublicTableError = (
  error: SupabaseErrorLike | null | undefined,
  tableName: string
) => {
  const message = normalize(error?.message);
  const qualifiedTable = `public.${tableName}`.toLowerCase();

  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes(`relation "${qualifiedTable}" does not exist`) ||
    message.includes(`could not find the table '${qualifiedTable}' in the schema cache`) ||
    message.includes(`could not find the table "${qualifiedTable}" in the schema cache`) ||
    message.includes(`could not find table '${qualifiedTable}' in the schema cache`) ||
    message.includes(`could not find table "${qualifiedTable}" in the schema cache`)
  );
};

export const getNotificationSystemErrorMessage = (error: SupabaseErrorLike) => {
  if (isMissingPublicTableError(error, "notifications")) {
    return "Notifications are not available yet because the database schema is missing or stale. Run `supabase db push` to create the tables and reload the schema cache.";
  }

  if (isMissingPublicTableError(error, "notification_statuses")) {
    return "Notification read-status tracking is not available yet. Run `supabase db push` to create the missing notification tables.";
  }

  return error.message || "The notification system is currently unavailable.";
};

export const getFunctionErrorMessage = (error: any) => {
  if (!error) return "Request failed.";

  if (typeof error.message === "string" && error.message.trim()) {
    if (normalize(error.message).includes("edge function")) {
      return "The required Supabase edge function is not deployed or could not be reached. Deploy your edge functions and try again.";
    }
    return error.message;
  }

  const contextData = error.context?.data;

  if (typeof contextData === "string" && contextData.trim()) {
    try {
      const parsed = JSON.parse(contextData);
      if (typeof parsed?.error === "string" && parsed.error.trim()) {
        return parsed.error;
      }
    } catch {
      return contextData;
    }
  }

  if (typeof contextData?.error === "string" && contextData.error.trim()) {
    return contextData.error;
  }

  return "Request failed.";
};
