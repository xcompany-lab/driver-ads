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
          address: Json | null
          city: string
          cnpj: string
          company_name: string
          created_at: string
          document_type: string | null
          email: string
          id: string
          pagou_customer_id: string | null
          phone: string
          responsible: string
          segment: string | null
          status: Database["public"]["Enums"]["advertiser_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: Json | null
          city: string
          cnpj: string
          company_name: string
          created_at?: string
          document_type?: string | null
          email: string
          id?: string
          pagou_customer_id?: string | null
          phone: string
          responsible: string
          segment?: string | null
          status?: Database["public"]["Enums"]["advertiser_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: Json | null
          city?: string
          cnpj?: string
          company_name?: string
          created_at?: string
          document_type?: string | null
          email?: string
          id?: string
          pagou_customer_id?: string | null
          phone?: string
          responsible?: string
          segment?: string | null
          status?: Database["public"]["Enums"]["advertiser_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      billing_transactions: {
        Row: {
          advertiser_id: string
          amount_cents: number
          billing_period_end: string | null
          billing_period_start: string | null
          campaign_id: string | null
          created_at: string
          currency: string
          expires_at: string | null
          external_ref: string | null
          failure_reason: string | null
          id: string
          method: string
          pagou_subscription_id: string | null
          pagou_transaction_id: string | null
          paid_amount_cents: number | null
          paid_at: string | null
          pix_qr_code: string | null
          pix_qr_code_image: string | null
          raw_payload: Json | null
          refunded_amount_cents: number | null
          request_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          amount_cents: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_ref?: string | null
          failure_reason?: string | null
          id?: string
          method: string
          pagou_subscription_id?: string | null
          pagou_transaction_id?: string | null
          paid_amount_cents?: number | null
          paid_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_image?: string | null
          raw_payload?: Json | null
          refunded_amount_cents?: number | null
          request_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          amount_cents?: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_ref?: string | null
          failure_reason?: string | null
          id?: string
          method?: string
          pagou_subscription_id?: string | null
          pagou_transaction_id?: string | null
          paid_amount_cents?: number | null
          paid_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_image?: string | null
          raw_payload?: Json | null
          refunded_amount_cents?: number | null
          request_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_transactions_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
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
      campaign_qr_codes: {
        Row: {
          advertiser_id: string
          assignment_id: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          destination_type: Database["public"]["Enums"]["qr_destination_type"]
          destination_url: string
          driver_id: string | null
          final_image_url: string | null
          final_pdf_url: string | null
          generated_at: string | null
          id: string
          is_active: boolean
          kit_label: string | null
          landing_page_url: string | null
          qr_position: Json
          qr_scope: string
          short_code: string
          updated_at: string
          vehicle_id: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          advertiser_id: string
          assignment_id?: string | null
          campaign_id: string
          created_at?: string
          created_by?: string | null
          destination_type: Database["public"]["Enums"]["qr_destination_type"]
          destination_url: string
          driver_id?: string | null
          final_image_url?: string | null
          final_pdf_url?: string | null
          generated_at?: string | null
          id?: string
          is_active?: boolean
          kit_label?: string | null
          landing_page_url?: string | null
          qr_position?: Json
          qr_scope?: string
          short_code?: string
          updated_at?: string
          vehicle_id?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          advertiser_id?: string
          assignment_id?: string | null
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          destination_type?: Database["public"]["Enums"]["qr_destination_type"]
          destination_url?: string
          driver_id?: string | null
          final_image_url?: string | null
          final_pdf_url?: string | null
          generated_at?: string | null
          id?: string
          is_active?: boolean
          kit_label?: string | null
          landing_page_url?: string | null
          qr_position?: Json
          qr_scope?: string
          short_code?: string
          updated_at?: string
          vehicle_id?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_qr_codes_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_qr_codes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_qr_codes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "campaign_driver_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_qr_codes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_qr_codes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_qr_scans: {
        Row: {
          advertiser_id: string
          approx_confidence: number | null
          approx_latitude: number | null
          approx_longitude: number | null
          approx_radius_m: number | null
          approx_source: string | null
          assignment_id: string | null
          browser_name: string | null
          campaign_id: string
          city: string | null
          country: string | null
          destination_url: string | null
          device_type: string | null
          driver_id: string | null
          geo_source: string | null
          id: string
          ip_hash: string | null
          latitude: number | null
          location_candidate_count: number
          location_processed_at: string | null
          longitude: number | null
          metadata: Json
          os_name: string | null
          processed_at: string
          qr_code_id: string
          referrer: string | null
          region: string | null
          scanned_at: string
          scan_key: string | null
          user_agent: string | null
          vehicle_id: string | null
        }
        Insert: {
          advertiser_id: string
          approx_confidence?: number | null
          approx_latitude?: number | null
          approx_longitude?: number | null
          approx_radius_m?: number | null
          approx_source?: string | null
          assignment_id?: string | null
          browser_name?: string | null
          campaign_id: string
          city?: string | null
          country?: string | null
          destination_url?: string | null
          device_type?: string | null
          driver_id?: string | null
          geo_source?: string | null
          id?: string
          ip_hash?: string | null
          latitude?: number | null
          location_candidate_count?: number
          location_processed_at?: string | null
          longitude?: number | null
          metadata?: Json
          os_name?: string | null
          processed_at?: string
          qr_code_id: string
          referrer?: string | null
          region?: string | null
          scanned_at?: string
          scan_key?: string | null
          user_agent?: string | null
          vehicle_id?: string | null
        }
        Update: {
          advertiser_id?: string
          approx_confidence?: number | null
          approx_latitude?: number | null
          approx_longitude?: number | null
          approx_radius_m?: number | null
          approx_source?: string | null
          assignment_id?: string | null
          browser_name?: string | null
          campaign_id?: string
          city?: string | null
          country?: string | null
          destination_url?: string | null
          device_type?: string | null
          driver_id?: string | null
          geo_source?: string | null
          id?: string
          ip_hash?: string | null
          latitude?: number | null
          location_candidate_count?: number
          location_processed_at?: string | null
          longitude?: number | null
          metadata?: Json
          os_name?: string | null
          processed_at?: string
          qr_code_id?: string
          referrer?: string | null
          region?: string | null
          scanned_at?: string
          scan_key?: string | null
          user_agent?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_qr_scans_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_qr_scans_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_qr_scans_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "campaign_qr_codes"
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
      campaign_plans: {
        Row: {
          billing_interval: string
          billing_interval_count: number
          created_at: string
          currency: string
          description: string | null
          driver_payout_cents: number
          id: string
          is_active: boolean
          metadata: Json
          monthly_price_cents: number
          name: string
          updated_at: string
        }
        Insert: {
          billing_interval?: string
          billing_interval_count?: number
          created_at?: string
          currency?: string
          description?: string | null
          driver_payout_cents?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          monthly_price_cents: number
          name: string
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          billing_interval_count?: number
          created_at?: string
          currency?: string
          description?: string | null
          driver_payout_cents?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          monthly_price_cents?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          advertiser_id: string
          approved_at: string | null
          approved_by: string | null
          art_url: string | null
          billing_status: Database["public"]["Enums"]["billing_status"] | null
          city: string
          created_at: string
          created_by: string | null
          current_period_end: string | null
          current_period_start: string | null
          description: string | null
          id: string
          name: string
          observations: string | null
          operational_status:
            | Database["public"]["Enums"]["operational_status_v2"]
            | null
          payment_grace_until: string | null
          period_end: string
          period_start: string
          plan_id: string | null
          plan_value: number
          regions: string[]
          removal_required_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          vehicles_qty: number
        }
        Insert: {
          advertiser_id: string
          approved_at?: string | null
          approved_by?: string | null
          art_url?: string | null
          billing_status?: Database["public"]["Enums"]["billing_status"] | null
          city: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          description?: string | null
          id?: string
          name: string
          observations?: string | null
          operational_status?:
            | Database["public"]["Enums"]["operational_status_v2"]
            | null
          payment_grace_until?: string | null
          period_end: string
          period_start: string
          plan_id?: string | null
          plan_value?: number
          regions?: string[]
          removal_required_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          vehicles_qty?: number
        }
        Update: {
          advertiser_id?: string
          approved_at?: string | null
          approved_by?: string | null
          art_url?: string | null
          billing_status?: Database["public"]["Enums"]["billing_status"] | null
          city?: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          description?: string | null
          id?: string
          name?: string
          observations?: string | null
          operational_status?:
            | Database["public"]["Enums"]["operational_status_v2"]
            | null
          payment_grace_until?: string | null
          period_end?: string
          period_start?: string
          plan_id?: string | null
          plan_value?: number
          regions?: string[]
          removal_required_at?: string | null
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
          {
            foreignKeyName: "campaigns_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "campaign_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_earnings: {
        Row: {
          amount_cents: number
          assignment_id: string | null
          available_at: string | null
          billing_transaction_id: string | null
          campaign_id: string
          created_at: string
          driver_id: string
          id: string
          locked_reason: string | null
          metadata: Json | null
          paid_at: string | null
          payout_id: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["earning_status"]
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          assignment_id?: string | null
          available_at?: string | null
          billing_transaction_id?: string | null
          campaign_id: string
          created_at?: string
          driver_id: string
          id?: string
          locked_reason?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payout_id?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["earning_status"]
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          assignment_id?: string | null
          available_at?: string | null
          billing_transaction_id?: string | null
          campaign_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          locked_reason?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payout_id?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["earning_status"]
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "campaign_driver_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_billing_transaction_id_fkey"
            columns: ["billing_transaction_id"]
            isOneToOne: false
            referencedRelation: "billing_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payout_methods: {
        Row: {
          created_at: string
          document_number: string | null
          document_type: string | null
          driver_id: string
          id: string
          is_default: boolean
          legal_name: string | null
          pix_key_type: string
          pix_key_value: string
          pix_key_value_masked: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["driver_payout_method_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          driver_id: string
          id?: string
          is_default?: boolean
          legal_name?: string | null
          pix_key_type: string
          pix_key_value: string
          pix_key_value_masked?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["driver_payout_method_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          driver_id?: string
          id?: string
          is_default?: boolean
          legal_name?: string | null
          pix_key_type?: string
          pix_key_value?: string
          pix_key_value_masked?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["driver_payout_method_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payout_methods_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
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
      ledger_entries: {
        Row: {
          advertiser_id: string | null
          amount_cents: number
          available_for_payout: boolean
          billing_transaction_id: string | null
          campaign_id: string | null
          created_at: string
          currency: string
          description: string | null
          direction: string
          driver_earning_id: string | null
          driver_id: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          external_ref: string | null
          id: string
          locked_until: string | null
          metadata: Json | null
          payout_id: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          advertiser_id?: string | null
          amount_cents: number
          available_for_payout?: boolean
          billing_transaction_id?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          direction: string
          driver_earning_id?: string | null
          driver_id?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          external_ref?: string | null
          id?: string
          locked_until?: string | null
          metadata?: Json | null
          payout_id?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          advertiser_id?: string | null
          amount_cents?: number
          available_for_payout?: boolean
          billing_transaction_id?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          direction?: string
          driver_earning_id?: string | null
          driver_id?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          external_ref?: string | null
          id?: string
          locked_until?: string | null
          metadata?: Json | null
          payout_id?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_billing_transaction_id_fkey"
            columns: ["billing_transaction_id"]
            isOneToOne: false
            referencedRelation: "billing_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_driver_earning_id_fkey"
            columns: ["driver_earning_id"]
            isOneToOne: false
            referencedRelation: "driver_earnings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
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
      operational_tasks: {
        Row: {
          assigned_to: string | null
          assignment_id: string | null
          campaign_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          driver_id: string | null
          due_at: string | null
          id: string
          metadata: Json | null
          priority: string
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          assignment_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          status?: string
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          assignment_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_tasks_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "campaign_driver_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_tasks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      pagou_api_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          http_status: number | null
          id: string
          method: string
          request_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          method: string
          request_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          method?: string
          request_id?: string | null
        }
        Relationships: []
      }
      pagou_reconciliation_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          internal_id: string | null
          last_error: string | null
          metadata: Json | null
          pagou_resource_id: string | null
          resource_type: string
          scheduled_at: string
          status: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          internal_id?: string | null
          last_error?: string | null
          metadata?: Json | null
          pagou_resource_id?: string | null
          resource_type: string
          scheduled_at?: string
          status?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          internal_id?: string | null
          last_error?: string | null
          metadata?: Json | null
          pagou_resource_id?: string | null
          resource_type?: string
          scheduled_at?: string
          status?: string
        }
        Relationships: []
      }
      pagou_webhook_events: {
        Row: {
          api_version: string | null
          error_message: string | null
          event: string | null
          event_type: string | null
          headers: Json | null
          id: string
          pagou_event_id: string
          pagou_resource_id: string | null
          payload: Json
          processed_at: string | null
          processing_status: Database["public"]["Enums"]["webhook_processing_status"]
          received_at: string
        }
        Insert: {
          api_version?: string | null
          error_message?: string | null
          event?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          pagou_event_id: string
          pagou_resource_id?: string | null
          payload: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["webhook_processing_status"]
          received_at?: string
        }
        Update: {
          api_version?: string | null
          error_message?: string | null
          event?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          pagou_event_id?: string
          pagou_resource_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["webhook_processing_status"]
          received_at?: string
        }
        Relationships: []
      }
      payout_items: {
        Row: {
          amount_cents: number
          created_at: string
          driver_earning_id: string
          id: string
          payout_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          driver_earning_id: string
          id?: string
          payout_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          driver_earning_id?: string
          id?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_items_driver_earning_id_fkey"
            columns: ["driver_earning_id"]
            isOneToOne: false
            referencedRelation: "driver_earnings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_cents: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          driver_id: string
          external_ref: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          pagou_transfer_id: string | null
          paid_at: string | null
          payout_method_id: string | null
          pix_key_type: string | null
          pix_key_value_masked: string | null
          raw_payload: Json | null
          request_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          driver_id: string
          external_ref?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          pagou_transfer_id?: string | null
          paid_at?: string | null
          payout_method_id?: string | null
          pix_key_type?: string | null
          pix_key_value_masked?: string | null
          raw_payload?: Json | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          driver_id?: string
          external_ref?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          pagou_transfer_id?: string | null
          paid_at?: string | null
          payout_method_id?: string | null
          pix_key_type?: string | null
          pix_key_value_masked?: string | null
          raw_payload?: Json | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_payout_method_id_fkey"
            columns: ["payout_method_id"]
            isOneToOne: false
            referencedRelation: "driver_payout_methods"
            referencedColumns: ["id"]
          },
        ]
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
      provider_balance_snapshots: {
        Row: {
          available_balance_cents: number | null
          captured_at: string
          captured_by: string | null
          id: string
          pending_balance_cents: number | null
          provider: string
          raw_payload: Json | null
          source: string
        }
        Insert: {
          available_balance_cents?: number | null
          captured_at?: string
          captured_by?: string | null
          id?: string
          pending_balance_cents?: number | null
          provider?: string
          raw_payload?: Json | null
          source?: string
        }
        Update: {
          available_balance_cents?: number | null
          captured_at?: string
          captured_by?: string | null
          id?: string
          pending_balance_cents?: number | null
          provider?: string
          raw_payload?: Json | null
          source?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          advertiser_id: string
          amount_cents: number
          campaign_id: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          cancellation_reason: string | null
          card_brand: string | null
          card_exp_month: string | null
          card_exp_year: string | null
          card_last4: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          external_ref: string | null
          failure_policy: string | null
          id: string
          interval: string
          interval_count: number
          latest_transaction_id: string | null
          metadata: Json
          pagou_customer_id: string | null
          pagou_subscription_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          plan_id: string | null
          retry_offsets_days: number[] | null
          status: string
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          amount_cents: number
          campaign_id: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          cancellation_reason?: string | null
          card_brand?: string | null
          card_exp_month?: string | null
          card_exp_year?: string | null
          card_last4?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_ref?: string | null
          failure_policy?: string | null
          id?: string
          interval?: string
          interval_count?: number
          latest_transaction_id?: string | null
          metadata?: Json
          pagou_customer_id?: string | null
          pagou_subscription_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          plan_id?: string | null
          retry_offsets_days?: number[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          amount_cents?: number
          campaign_id?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          cancellation_reason?: string | null
          card_brand?: string | null
          card_exp_month?: string | null
          card_exp_year?: string | null
          card_last4?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_ref?: string | null
          failure_policy?: string | null
          id?: string
          interval?: string
          interval_count?: number
          latest_transaction_id?: string | null
          metadata?: Json
          pagou_customer_id?: string | null
          pagou_subscription_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          plan_id?: string | null
          retry_offsets_days?: number[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "campaign_plans"
            referencedColumns: ["id"]
          },
        ]
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
      admin_finance_summary: {
        Row: {
          confirmed_revenue_cents: number | null
          driver_available_cents: number | null
          driver_paid_cents: number | null
          internal_net_balance_cents: number | null
          locked_revenue_cents: number | null
        }
        Relationships: []
      }
      driver_available_earnings: {
        Row: {
          available_cents: number | null
          driver_id: string | null
          earnings_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_self_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      driver_is_assigned_to_campaign: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      driver_owns_assignment: {
        Args: { _assignment_id: string; _user_id: string }
        Returns: boolean
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
      track_campaign_qr_scan: {
        Args: {
          _metadata?: Json
          _referrer?: string | null
          _short_code: string
          _user_agent?: string | null
        }
        Returns: {
          destination_url: string
        }[]
      }
      user_owns_advertiser: {
        Args: { _advertiser_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_campaign: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
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
      billing_status:
        | "none"
        | "pending"
        | "paid"
        | "active"
        | "trialing"
        | "past_due"
        | "payment_failed"
        | "cancel_scheduled"
        | "canceled"
        | "refunded"
        | "chargedback"
        | "in_protest"
        | "manual_review"
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
      qr_destination_type: "whatsapp" | "landing_page"
      doc_review_status: "pending" | "approved" | "rejected"
      driver_payout_method_status:
        | "incomplete"
        | "pending_review"
        | "approved"
        | "rejected"
        | "blocked"
      driver_payout_status: "pending" | "processing" | "paid" | "cancelled"
      driver_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "suspended"
        | "inactive"
      earning_status:
        | "estimated"
        | "accrued"
        | "locked"
        | "available"
        | "in_payout"
        | "paid"
        | "reversed"
        | "canceled"
      ledger_entry_type:
        | "advertiser_payment"
        | "advertiser_refund"
        | "chargeback_lock"
        | "chargeback_reversal"
        | "driver_earning_accrual"
        | "driver_earning_release"
        | "driver_payout"
        | "driver_payout_reversal"
        | "manual_adjustment"
      operational_status_v2:
        | "draft"
        | "waiting_art"
        | "waiting_payment"
        | "waiting_assignment"
        | "waiting_installation"
        | "active"
        | "removal_pending"
        | "removed"
        | "blocked"
        | "completed"
        | "suspended"
      payment_method_type:
        | "credit_card_subscription"
        | "pix_prepaid"
        | "manual_adjustment"
      payout_status:
        | "draft"
        | "approved"
        | "processing"
        | "in_analysis"
        | "paid"
        | "rejected"
        | "failed"
        | "cancelled"
        | "error"
        | "unknown"
        | "manual_review"
      proof_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "resubmission_requested"
      vehicle_status: "pending_review" | "approved" | "rejected" | "suspended"
      webhook_processing_status:
        | "received"
        | "processed"
        | "ignored"
        | "failed"
        | "needs_reconciliation"
        | "unhandled"
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
      billing_status: [
        "none",
        "pending",
        "paid",
        "active",
        "trialing",
        "past_due",
        "payment_failed",
        "cancel_scheduled",
        "canceled",
        "refunded",
        "chargedback",
        "in_protest",
        "manual_review",
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
      qr_destination_type: ["whatsapp", "landing_page"],
      doc_review_status: ["pending", "approved", "rejected"],
      driver_payout_method_status: [
        "incomplete",
        "pending_review",
        "approved",
        "rejected",
        "blocked",
      ],
      driver_payout_status: ["pending", "processing", "paid", "cancelled"],
      driver_status: [
        "pending_review",
        "approved",
        "rejected",
        "suspended",
        "inactive",
      ],
      earning_status: [
        "estimated",
        "accrued",
        "locked",
        "available",
        "in_payout",
        "paid",
        "reversed",
        "canceled",
      ],
      ledger_entry_type: [
        "advertiser_payment",
        "advertiser_refund",
        "chargeback_lock",
        "chargeback_reversal",
        "driver_earning_accrual",
        "driver_earning_release",
        "driver_payout",
        "driver_payout_reversal",
        "manual_adjustment",
      ],
      operational_status_v2: [
        "draft",
        "waiting_art",
        "waiting_payment",
        "waiting_assignment",
        "waiting_installation",
        "active",
        "removal_pending",
        "removed",
        "blocked",
        "completed",
        "suspended",
      ],
      payment_method_type: [
        "credit_card_subscription",
        "pix_prepaid",
        "manual_adjustment",
      ],
      payout_status: [
        "draft",
        "approved",
        "processing",
        "in_analysis",
        "paid",
        "rejected",
        "failed",
        "cancelled",
        "error",
        "unknown",
        "manual_review",
      ],
      proof_status: [
        "pending_review",
        "approved",
        "rejected",
        "resubmission_requested",
      ],
      vehicle_status: ["pending_review", "approved", "rejected", "suspended"],
      webhook_processing_status: [
        "received",
        "processed",
        "ignored",
        "failed",
        "needs_reconciliation",
        "unhandled",
      ],
    },
  },
} as const
