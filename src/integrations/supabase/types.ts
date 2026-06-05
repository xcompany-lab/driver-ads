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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      advertiser_payments: {
        Row: {
          advertiser_id: string
          amount: number
          campaign_id: string
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["advertiser_payment_status"]
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          amount?: number
          campaign_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["advertiser_payment_status"]
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          amount?: number
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["advertiser_payment_status"]
          updated_at?: string
        }
        Relationships: []
      }
      advertisers: {
        Row: {
          city: string
          cnpj: string
          company_name: string
          created_at: string
          email: string
          id: string
          phone: string
          responsible: string
          segment: string | null
          status: Database["public"]["Enums"]["advertiser_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          cnpj: string
          company_name: string
          created_at?: string
          email: string
          id?: string
          phone: string
          responsible: string
          segment?: string | null
          status?: Database["public"]["Enums"]["advertiser_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          cnpj?: string
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          phone?: string
          responsible?: string
          segment?: string | null
          status?: Database["public"]["Enums"]["advertiser_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_assets: {
        Row: {
          campaign_id: string
          created_at: string
          file_url: string
          id: string
          type: Database["public"]["Enums"]["campaign_asset_type"]
          uploaded_by: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          file_url: string
          id?: string
          type?: Database["public"]["Enums"]["campaign_asset_type"]
          uploaded_by?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          file_url?: string
          id?: string
          type?: Database["public"]["Enums"]["campaign_asset_type"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_driver_assignments: {
        Row: {
          assigned_by: string | null
          campaign_id: string
          created_at: string
          driver_id: string
          id: string
          monthly_payout: number
          notes: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          assigned_by?: string | null
          campaign_id: string
          created_at?: string
          driver_id: string
          id?: string
          monthly_payout?: number
          notes?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          assigned_by?: string | null
          campaign_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          monthly_payout?: number
          notes?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_driver_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_driver_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          advertiser_id: string
          approved_at: string | null
          approved_by: string | null
          art_url: string | null
          city: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          observations: string | null
          period_end: string
          period_start: string
          plan_value: number
          regions: string[]
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          vehicles_qty: number
        }
        Insert: {
          advertiser_id: string
          approved_at?: string | null
          approved_by?: string | null
          art_url?: string | null
          city: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          observations?: string | null
          period_end: string
          period_start: string
          plan_value?: number
          regions?: string[]
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          vehicles_qty?: number
        }
        Update: {
          advertiser_id?: string
          approved_at?: string | null
          approved_by?: string | null
          art_url?: string | null
          city?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          observations?: string | null
          period_end?: string
          period_start?: string
          plan_value?: number
          regions?: string[]
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          vehicles_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payouts: {
        Row: {
          amount: number
          assignment_id: string
          created_at: string
          created_by: string | null
          driver_id: string
          id: string
          notes: string | null
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          receipt_url: string | null
          reference_month: string
          status: Database["public"]["Enums"]["driver_payout_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          assignment_id: string
          created_at?: string
          created_by?: string | null
          driver_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          receipt_url?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["driver_payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          driver_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          receipt_url?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["driver_payout_status"]
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          address_proof_status: Database["public"]["Enums"]["doc_review_status"]
          address_proof_url: string | null
          birth_date: string | null
          city: string
          cnh_front_status: Database["public"]["Enums"]["doc_review_status"]
          cnh_front_url: string | null
          cpf: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          photo_url: string | null
          pix_key: string | null
          pix_key_type: string | null
          regions: string[]
          selfie_doc_status: Database["public"]["Enums"]["doc_review_status"]
          selfie_doc_url: string | null
          status: Database["public"]["Enums"]["driver_status"]
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_proof_status?: Database["public"]["Enums"]["doc_review_status"]
          address_proof_url?: string | null
          birth_date?: string | null
          city: string
          cnh_front_status?: Database["public"]["Enums"]["doc_review_status"]
          cnh_front_url?: string | null
          cpf: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone: string
          photo_url?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          regions?: string[]
          selfie_doc_status?: Database["public"]["Enums"]["doc_review_status"]
          selfie_doc_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_proof_status?: Database["public"]["Enums"]["doc_review_status"]
          address_proof_url?: string | null
          birth_date?: string | null
          city?: string
          cnh_front_status?: Database["public"]["Enums"]["doc_review_status"]
          cnh_front_url?: string | null
          cpf?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          photo_url?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          regions?: string[]
          selfie_doc_status?: Database["public"]["Enums"]["doc_review_status"]
          selfie_doc_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_diagnostics: {
        Row: {
          created_at: string
          error_message: string | null
          flow: string
          id: string
          metadata: Json
          recipient_email: string | null
          status: string
          step: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          flow: string
          id?: string
          metadata?: Json
          recipient_email?: string | null
          status: string
          step: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          flow?: string
          id?: string
          metadata?: Json
          recipient_email?: string | null
          status?: string
          step?: string
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          sent_at: string | null
          status: string
          subject: string | null
          template: string
          to_email: string
          to_name: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          subject?: string | null
          template: string
          to_email: string
          to_name?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string
          to_email?: string
          to_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      installation_proofs: {
        Row: {
          assignment_id: string
          created_at: string
          geo_lat: number | null
          geo_lng: number | null
          id: string
          observation: string | null
          photo_url: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["proof_status"]
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          observation?: string | null
          photo_url: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["proof_status"]
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          observation?: string | null
          photo_url?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["proof_status"]
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_proofs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "campaign_driver_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
          brand: string | null
          color: string | null
          created_at: string
          crlv_status: Database["public"]["Enums"]["doc_review_status"]
          crlv_url: string | null
          driver_id: string
          id: string
          model: string
          photo_url: string | null
          plate: string
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          vehicle_type: string | null
          year: number | null
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          crlv_status?: Database["public"]["Enums"]["doc_review_status"]
          crlv_url?: string | null
          driver_id: string
          id?: string
          model: string
          photo_url?: string | null
          plate: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          crlv_status?: Database["public"]["Enums"]["doc_review_status"]
          crlv_url?: string | null
          driver_id?: string
          id?: string
          model?: string
          photo_url?: string | null
          plate?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_self_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      enqueue_email: {
        Args: {
          _payload: Json
          _template: string
          _to_email: string
          _to_name: string
        }
        Returns: string
      }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_email_diagnostic: {
        Args: {
          _error_message?: string
          _flow: string
          _metadata?: Json
          _recipient_email?: string
          _status: string
          _step: string
        }
        Returns: string
      }
      notify_user: {
        Args: {
          _body: string
          _link: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      advertiser_payment_status: "pending" | "paid" | "overdue" | "cancelled"
      advertiser_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "suspended"
      app_role: "admin" | "operator" | "advertiser" | "driver"
      assignment_status:
        | "invited"
        | "accepted"
        | "declined"
        | "awaiting_installation"
        | "active"
        | "paused"
        | "completed"
        | "cancelled"
      campaign_asset_type: "art" | "briefing" | "contract" | "other"
      campaign_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "rejected"
        | "active"
        | "paused"
        | "completed"
        | "cancelled"
      doc_review_status: "pending" | "approved" | "rejected"
      driver_payout_status: "pending" | "processing" | "paid" | "cancelled"
      driver_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "suspended"
        | "inactive"
      proof_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "resubmission_requested"
      vehicle_status: "pending_review" | "approved" | "rejected" | "suspended"
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
      advertiser_payment_status: ["pending", "paid", "overdue", "cancelled"],
      advertiser_status: [
        "pending_review",
        "approved",
        "rejected",
        "suspended",
      ],
      app_role: ["admin", "operator", "advertiser", "driver"],
      assignment_status: [
        "invited",
        "accepted",
        "declined",
        "awaiting_installation",
        "active",
        "paused",
        "completed",
        "cancelled",
      ],
      campaign_asset_type: ["art", "briefing", "contract", "other"],
      campaign_status: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "active",
        "paused",
        "completed",
        "cancelled",
      ],
      doc_review_status: ["pending", "approved", "rejected"],
      driver_payout_status: ["pending", "processing", "paid", "cancelled"],
      driver_status: [
        "pending_review",
        "approved",
        "rejected",
        "suspended",
        "inactive",
      ],
      proof_status: [
        "pending_review",
        "approved",
        "rejected",
        "resubmission_requested",
      ],
      vehicle_status: ["pending_review", "approved", "rejected", "suspended"],
    },
  },
} as const
