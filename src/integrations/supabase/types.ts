export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          staff_id: string
          status: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          staff_id: string
          status?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_archive: {
        Row: {
          browser: string | null
          clock_out: string | null
          created_at: string
          device_info: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          latitude: number
          location_address: string | null
          longitude: number
          operating_system: string | null
          staff_name: string
          status: string
          timestamp: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          clock_out?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          latitude: number
          location_address?: string | null
          longitude: number
          operating_system?: string | null
          staff_name: string
          status?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          browser?: string | null
          clock_out?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number
          location_address?: string | null
          longitude?: number
          operating_system?: string | null
          staff_name?: string
          status?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_role: string
          sender_user_id: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_role: string
          sender_user_id: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_role?: string
          sender_user_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "feedback_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          staff_email: string | null
          staff_name: string
          staff_user_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          staff_email?: string | null
          staff_name: string
          staff_user_id: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          staff_email?: string | null
          staff_name?: string
          staff_user_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          end_date: string
          id: string
          reason: string | null
          staff_name: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          staff_name: string
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          staff_name?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      location_pings: {
        Row: {
          distance_from_school_meters: number | null
          id: number
          is_outside_radius: boolean | null
          latitude: number
          location_available: boolean
          longitude: number
          pinged_at: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          distance_from_school_meters?: number | null
          id?: number
          is_outside_radius?: boolean | null
          latitude: number
          location_available?: boolean
          longitude: number
          pinged_at?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          distance_from_school_meters?: number | null
          id?: number
          is_outside_radius?: boolean | null
          latitude?: number
          location_available?: boolean
          longitude?: number
          pinged_at?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_pings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_statuses: {
        Row: {
          id: string
          notification_id: string
          read: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_statuses_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      school_calendar: {
        Row: {
          color: string | null
          created_at: string
          event_date: string
          event_name: string
          expected_hours: number | null
          id: string
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          event_date: string
          event_name: string
          expected_hours?: number | null
          id?: string
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string
          event_date?: string
          event_name?: string
          expected_hours?: number | null
          id?: string
          type?: string
        }
        Relationships: []
      }
      session_start_attempts: {
        Row: {
          attempted_at: string
          id: string
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          alert_email: string | null
          alert_time: string | null
          allowed_radius: number
          clock_in_reminder: boolean | null
          clock_out_reminder: boolean | null
          created_at: string
          daily_alerts: boolean | null
          id: string
          late_time: string
          reminder_time: string | null
          school_latitude: number
          school_longitude: number
          updated_at: string
          weekly_reports: boolean | null
        }
        Insert: {
          alert_email?: string | null
          alert_time?: string | null
          allowed_radius?: number
          clock_in_reminder?: boolean | null
          clock_out_reminder?: boolean | null
          created_at?: string
          daily_alerts?: boolean | null
          id?: string
          late_time?: string
          reminder_time?: string | null
          school_latitude?: number
          school_longitude?: number
          updated_at?: string
          weekly_reports?: boolean | null
        }
        Update: {
          alert_email?: string | null
          alert_time?: string | null
          allowed_radius?: number
          clock_in_reminder?: boolean | null
          clock_out_reminder?: boolean | null
          created_at?: string
          daily_alerts?: boolean | null
          id?: string
          late_time?: string
          reminder_time?: string | null
          school_latitude?: number
          school_longitude?: number
          updated_at?: string
          weekly_reports?: boolean | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          role?: string
        }
        Relationships: []
      }
      staff_contracts: {
        Row: {
          contracted_hours: number
          created_at: string
          effective_from: string
          effective_to: string | null
          grace_minutes: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contracted_hours?: number
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          grace_minutes?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contracted_hours?: number
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          grace_minutes?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          session_date: string
          started_at: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          session_date: string
          started_at: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          session_date?: string
          started_at?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const

