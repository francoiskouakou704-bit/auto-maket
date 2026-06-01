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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          email_override: string | null
          notify_on_resolved: boolean
          severities: string[]
          slack_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          email_override?: string | null
          notify_on_resolved?: boolean
          severities?: string[]
          slack_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          email_override?: string | null
          notify_on_resolved?: boolean
          severities?: string[]
          slack_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean | null
          recipient_id: string
          sender_id: string
          vehicle_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean | null
          recipient_id: string
          sender_id: string
          vehicle_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean | null
          recipient_id?: string
          sender_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          assigned_at: string | null
          assigned_to: string | null
          created_at: string
          details: Json | null
          id: string
          message: string
          payment_id: string | null
          proof_payload: Json | null
          proof_refund_ref: string | null
          proof_screenshot_url: string | null
          resolution_comment: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          payment_id?: string | null
          proof_payload?: Json | null
          proof_refund_ref?: string | null
          proof_screenshot_url?: string | null
          resolution_comment?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          payment_id?: string | null
          proof_payload?: Json | null
          proof_refund_ref?: string | null
          proof_screenshot_url?: string | null
          resolution_comment?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_alerts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed: boolean
          provider: string
          provider_ref: string | null
          signature: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          payment_id?: string | null
          processed?: boolean
          provider: string
          provider_ref?: string | null
          signature?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed?: boolean
          provider?: string
          provider_ref?: string | null
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          kind: Database["public"]["Enums"]["payment_kind"]
          provider: string | null
          provider_ref: string | null
          raw_event: Json | null
          reconciled_at: string | null
          refunded_amount: number
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["payment_kind"]
          provider?: string | null
          provider_ref?: string | null
          raw_event?: Json | null
          reconciled_at?: string | null
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["payment_kind"]
          provider?: string | null
          provider_ref?: string | null
          raw_event?: Json | null
          reconciled_at?: string | null
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          accident_free: boolean | null
          ai_estimated_price: number | null
          ai_generated: boolean | null
          brand: string
          city: string | null
          color: string | null
          consumption: number | null
          country: string | null
          created_at: string
          currency: string
          description: string | null
          district: string | null
          doors: number | null
          drivetrain: string | null
          engine_size: number | null
          featured: boolean | null
          first_hand: boolean | null
          fuel: Database["public"]["Enums"]["fuel_type"]
          id: string
          latitude: number | null
          longitude: number | null
          mileage: number
          model: string
          negotiable: boolean | null
          photos: string[] | null
          power_hp: number | null
          price: number
          seats: number | null
          seller_id: string
          service_history: boolean | null
          status: Database["public"]["Enums"]["vehicle_status"]
          title: string
          tour_360_url: string | null
          transmission: Database["public"]["Enums"]["transmission_type"]
          updated_at: string
          version: string | null
          video_url: string | null
          views_count: number | null
          year: number
        }
        Insert: {
          accident_free?: boolean | null
          ai_estimated_price?: number | null
          ai_generated?: boolean | null
          brand: string
          city?: string | null
          color?: string | null
          consumption?: number | null
          country?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          district?: string | null
          doors?: number | null
          drivetrain?: string | null
          engine_size?: number | null
          featured?: boolean | null
          first_hand?: boolean | null
          fuel?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          latitude?: number | null
          longitude?: number | null
          mileage?: number
          model: string
          negotiable?: boolean | null
          photos?: string[] | null
          power_hp?: number | null
          price: number
          seats?: number | null
          seller_id: string
          service_history?: boolean | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          title: string
          tour_360_url?: string | null
          transmission?: Database["public"]["Enums"]["transmission_type"]
          updated_at?: string
          version?: string | null
          video_url?: string | null
          views_count?: number | null
          year: number
        }
        Update: {
          accident_free?: boolean | null
          ai_estimated_price?: number | null
          ai_generated?: boolean | null
          brand?: string
          city?: string | null
          color?: string | null
          consumption?: number | null
          country?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          district?: string | null
          doors?: number | null
          drivetrain?: string | null
          engine_size?: number | null
          featured?: boolean | null
          first_hand?: boolean | null
          fuel?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          latitude?: number | null
          longitude?: number | null
          mileage?: number
          model?: string
          negotiable?: boolean | null
          photos?: string[] | null
          power_hp?: number | null
          price?: number
          seats?: number | null
          seller_id?: string
          service_history?: boolean | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          title?: string
          tour_360_url?: string | null
          transmission?: Database["public"]["Enums"]["transmission_type"]
          updated_at?: string
          version?: string | null
          video_url?: string | null
          views_count?: number | null
          year?: number
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
      app_role: "user" | "dealer" | "admin"
      fuel_type: "gasoline" | "diesel" | "electric" | "hybrid" | "lpg" | "other"
      payment_kind: "boost" | "featured" | "subscription" | "other"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      report_reason:
        | "fraud"
        | "duplicate"
        | "inappropriate"
        | "wrong_info"
        | "sold"
        | "other"
      report_status: "pending" | "reviewing" | "resolved" | "dismissed"
      transmission_type: "manual" | "automatic" | "semi_automatic"
      vehicle_status: "draft" | "published" | "sold" | "archived"
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
  public: {
    Enums: {
      app_role: ["user", "dealer", "admin"],
      fuel_type: ["gasoline", "diesel", "electric", "hybrid", "lpg", "other"],
      payment_kind: ["boost", "featured", "subscription", "other"],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      report_reason: [
        "fraud",
        "duplicate",
        "inappropriate",
        "wrong_info",
        "sold",
        "other",
      ],
      report_status: ["pending", "reviewing", "resolved", "dismissed"],
      transmission_type: ["manual", "automatic", "semi_automatic"],
      vehicle_status: ["draft", "published", "sold", "archived"],
    },
  },
} as const
