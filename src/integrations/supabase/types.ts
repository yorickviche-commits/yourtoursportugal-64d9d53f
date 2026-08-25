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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_activity_log: {
        Row: {
          actioned_at: string | null
          actioned_by: string | null
          agent_id: string
          created_at: string | null
          event_detail: Json | null
          event_summary: string
          event_type: string
          id: string
          related_entity: string | null
          requires_action: boolean | null
        }
        Insert: {
          actioned_at?: string | null
          actioned_by?: string | null
          agent_id: string
          created_at?: string | null
          event_detail?: Json | null
          event_summary: string
          event_type: string
          id?: string
          related_entity?: string | null
          requires_action?: boolean | null
        }
        Update: {
          actioned_at?: string | null
          actioned_by?: string | null
          agent_id?: string
          created_at?: string | null
          event_detail?: Json | null
          event_summary?: string
          event_type?: string
          id?: string
          related_entity?: string | null
          requires_action?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      agent_status: {
        Row: {
          agent_id: string
          current_entity: string | null
          current_task: string | null
          id: string
          started_at: string | null
          status: string
          updated_at: string | null
          waiting_for: string | null
        }
        Insert: {
          agent_id: string
          current_entity?: string | null
          current_task?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          waiting_for?: string | null
        }
        Update: {
          agent_id?: string
          current_entity?: string | null
          current_task?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          waiting_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_status_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "ai_agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          agent_id: string
          character_color: string | null
          created_at: string | null
          desk_position: Json | null
          display_name: string
          id: string
          is_active: boolean | null
          role_description: string | null
        }
        Insert: {
          agent_id: string
          character_color?: string | null
          created_at?: string | null
          desk_position?: Json | null
          display_name: string
          id?: string
          is_active?: boolean | null
          role_description?: string | null
        }
        Update: {
          agent_id?: string
          character_color?: string | null
          created_at?: string | null
          desk_position?: Json | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          role_description?: string | null
        }
        Relationships: []
      }
      approvals: {
        Row: {
          client_name: string | null
          created_at: string
          id: string
          lead_id: string | null
          priority: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          summary: string | null
          title: string
          trip_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          summary?: string | null
          title?: string
          trip_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          summary?: string | null
          title?: string
          trip_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_emails_log: {
        Row: {
          body: string
          email_category: string | null
          id: string
          lead_id: string | null
          lead_operation_id: string | null
          operation_id: string | null
          sent_at: string
          sent_by: string | null
          subject: string
          supplier_email: string | null
          trip_id: string | null
        }
        Insert: {
          body: string
          email_category?: string | null
          id?: string
          lead_id?: string | null
          lead_operation_id?: string | null
          operation_id?: string | null
          sent_at?: string
          sent_by?: string | null
          subject: string
          supplier_email?: string | null
          trip_id?: string | null
        }
        Update: {
          body?: string
          email_category?: string | null
          id?: string
          lead_id?: string | null
          lead_operation_id?: string | null
          operation_id?: string | null
          sent_at?: string
          sent_by?: string | null
          subject?: string
          supplier_email?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_emails_log_lead_operation_id_fkey"
            columns: ["lead_operation_id"]
            isOneToOne: false
            referencedRelation: "lead_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_emails_log_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "trip_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_formulas: {
        Row: {
          category: string
          created_at: string | null
          id: string
          notes: string | null
          text_en: string | null
          text_es: string | null
          text_pt: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          notes?: string | null
          text_en?: string | null
          text_es?: string | null
          text_pt?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          text_en?: string | null
          text_es?: string | null
          text_pt?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string
          day_date: string
          google_event_id: string | null
          id: string
          last_payload_hash: string | null
          last_synced_at: string | null
          lead_id: string
          status: string | null
          sync_error: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_date: string
          google_event_id?: string | null
          id?: string
          last_payload_hash?: string | null
          last_synced_at?: string | null
          lead_id: string
          status?: string | null
          sync_error?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_date?: string
          google_event_id?: string | null
          id?: string
          last_payload_hash?: string | null
          last_synced_at?: string | null
          lead_id?: string
          status?: string | null
          sync_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_approval_queue: {
        Row: {
          agent_id: string
          amount_eur: number | null
          approval_type: string
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          description: string | null
          id: string
          lead_id: string | null
          payload: Json | null
          status: string | null
          title: string
          trip_id: string | null
        }
        Insert: {
          agent_id: string
          amount_eur?: number | null
          approval_type: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          status?: string | null
          title: string
          trip_id?: string | null
        }
        Update: {
          agent_id?: string
          amount_eur?: number | null
          approval_type?: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          status?: string | null
          title?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceo_approval_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_items: {
        Row: {
          category: string
          created_at: string
          currency: string | null
          day_number: number
          description: string
          id: string
          margin_percent: number | null
          notes: string | null
          num_adults: number
          price_adults: number
          pricing_type: string
          quantity: number
          status: string
          supplier: string | null
          total_cost: number | null
          trip_id: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          currency?: string | null
          day_number?: number
          description?: string
          id?: string
          margin_percent?: number | null
          notes?: string | null
          num_adults?: number
          price_adults?: number
          pricing_type?: string
          quantity?: number
          status?: string
          supplier?: string | null
          total_cost?: number | null
          trip_id: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string | null
          day_number?: number
          description?: string
          id?: string
          margin_percent?: number | null
          notes?: string | null
          num_adults?: number
          price_adults?: number
          pricing_type?: string
          quantity?: number
          status?: string
          supplier?: string | null
          total_cost?: number | null
          trip_id?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      day_modules: {
        Row: {
          avg_rating: number | null
          canonical_text: string
          code: string
          created_at: string | null
          id: string
          name: string
          region: string
          segment_fit: string[]
          updated_at: string | null
          usage_count: number | null
          win_count: number | null
        }
        Insert: {
          avg_rating?: number | null
          canonical_text: string
          code: string
          created_at?: string | null
          id?: string
          name: string
          region: string
          segment_fit?: string[]
          updated_at?: string | null
          usage_count?: number | null
          win_count?: number | null
        }
        Update: {
          avg_rating?: number | null
          canonical_text?: string
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          region?: string
          segment_fit?: string[]
          updated_at?: string | null
          usage_count?: number | null
          win_count?: number | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      fse_drive_index: {
        Row: {
          category: string | null
          depth: number
          district: string | null
          drive_id: string
          id: string
          indexed_at: string
          mime_type: string
          name: string
          parent_drive_id: string | null
          path: string | null
          region: string | null
          supplier_name: string | null
          web_view_link: string | null
        }
        Insert: {
          category?: string | null
          depth?: number
          district?: string | null
          drive_id: string
          id?: string
          indexed_at?: string
          mime_type: string
          name: string
          parent_drive_id?: string | null
          path?: string | null
          region?: string | null
          supplier_name?: string | null
          web_view_link?: string | null
        }
        Update: {
          category?: string | null
          depth?: number
          district?: string | null
          drive_id?: string
          id?: string
          indexed_at?: string
          mime_type?: string
          name?: string
          parent_drive_id?: string | null
          path?: string | null
          region?: string | null
          supplier_name?: string | null
          web_view_link?: string | null
        }
        Relationships: []
      }
      fse_supplier_flags: {
        Row: {
          category: string | null
          district: string | null
          has_protocol: boolean
          manual_override: boolean | null
          region: string | null
          supplier_drive_id: string
          supplier_name: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          district?: string | null
          has_protocol?: boolean
          manual_override?: boolean | null
          region?: string | null
          supplier_drive_id: string
          supplier_name: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          district?: string | null
          has_protocol?: boolean
          manual_override?: boolean | null
          region?: string | null
          supplier_drive_id?: string
          supplier_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fse_sync_state: {
        Row: {
          change_token: string | null
          id: number
          last_full_sync_at: string | null
          last_sync_at: string | null
          root_folder_id: string | null
        }
        Insert: {
          change_token?: string | null
          id?: number
          last_full_sync_at?: string | null
          last_sync_at?: string | null
          root_folder_id?: string | null
        }
        Update: {
          change_token?: string | null
          id?: number
          last_full_sync_at?: string | null
          last_sync_at?: string | null
          root_folder_id?: string | null
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          api_key_ref: string | null
          config: Json | null
          created_at: string
          error_count: number | null
          id: string
          last_sync_at: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          api_key_ref?: string | null
          config?: Json | null
          created_at?: string
          error_count?: number | null
          id?: string
          last_sync_at?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          api_key_ref?: string | null
          config?: Json | null
          created_at?: string
          error_count?: number | null
          id?: string
          last_sync_at?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      item_notes: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          note_text: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          note_text?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          note_text?: string | null
        }
        Relationships: []
      }
      itineraries: {
        Row: {
          client_name: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          status: string
          subtitle: string | null
          title: string
          travel_dates: string | null
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          status?: string
          subtitle?: string | null
          title?: string
          travel_dates?: string | null
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          status?: string
          subtitle?: string | null
          title?: string
          travel_dates?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      itinerary_days: {
        Row: {
          created_at: string
          day_number: number
          description: string | null
          highlights: string[] | null
          id: string
          images: Json | null
          inclusions: string[] | null
          itinerary_id: string
          latitude: number | null
          location_name: string | null
          longitude: number | null
          narrative: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          description?: string | null
          highlights?: string[] | null
          id?: string
          images?: Json | null
          inclusions?: string[] | null
          itinerary_id: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          narrative?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          description?: string | null
          highlights?: string[] | null
          id?: string
          images?: Json | null
          inclusions?: string[] | null
          itinerary_id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          narrative?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_days_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_costing_data: {
        Row: {
          created_at: string
          day_number: number
          id: string
          items: Json | null
          lead_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          items?: Json | null
          lead_id: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          items?: Json | null
          lead_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_costing_data_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_operations: {
        Row: {
          activity_title: string | null
          booking_status: string
          created_at: string
          day_number: number
          id: string
          invoice_file_name: string | null
          invoice_file_url: string | null
          invoice_status: string
          item_key: string
          lead_id: string
          net_value: number | null
          pax: number | null
          payment_status: string
          real_cost: number | null
          schedule_time: string | null
          sort_order: number
          source: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          activity_title?: string | null
          booking_status?: string
          created_at?: string
          day_number?: number
          id?: string
          invoice_file_name?: string | null
          invoice_file_url?: string | null
          invoice_status?: string
          item_key: string
          lead_id: string
          net_value?: number | null
          pax?: number | null
          payment_status?: string
          real_cost?: number | null
          schedule_time?: string | null
          sort_order?: number
          source?: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          activity_title?: string | null
          booking_status?: string
          created_at?: string
          day_number?: number
          id?: string
          invoice_file_name?: string | null
          invoice_file_url?: string | null
          invoice_status?: string
          item_key?: string
          lead_id?: string
          net_value?: number | null
          pax?: number | null
          payment_status?: string
          real_cost?: number | null
          schedule_time?: string | null
          sort_order?: number
          source?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_operations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          kind: string
          lead_id: string
          method: string
          method_other: string | null
          notes: string | null
          paid_at: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          kind?: string
          lead_id: string
          method: string
          method_other?: string | null
          notes?: string | null
          paid_at?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          kind?: string
          lead_id?: string
          method?: string
          method_other?: string | null
          notes?: string | null
          paid_at?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_planner_data: {
        Row: {
          activities: Json | null
          created_at: string
          day_number: number
          description: string | null
          id: string
          images: Json | null
          lead_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          activities?: Json | null
          created_at?: string
          day_number: number
          description?: string | null
          id?: string
          images?: Json | null
          lead_id: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          activities?: Json | null
          created_at?: string
          day_number?: number
          description?: string | null
          id?: string
          images?: Json | null
          lead_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_planner_data_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          active_version: number | null
          assigned_agents: string[]
          budget_level: string | null
          client_name: string
          client_type: string
          close_date: string | null
          comfort_level: string | null
          created_at: string
          created_by: string | null
          dates_type: string | null
          destination: string | null
          email: string | null
          exact_itinerary_pdf_path: string | null
          id: string
          lead_code: string
          magic_question: string | null
          nethunt_record_id: string | null
          nethunt_stage: string | null
          nethunt_synced_at: string | null
          nethunt_updated_at: string | null
          notes: string | null
          number_of_days: number | null
          pax: number | null
          pax_children: number | null
          pax_infants: number | null
          phone: string | null
          pvp_override: number | null
          route_map_path: string | null
          sales_owner: string | null
          source: string
          status: string
          travel_dates: string | null
          travel_end_date: string | null
          travel_style: Json | null
          trip_finish: string | null
          trip_start: string | null
          updated_at: string
          yt_id: string | null
        }
        Insert: {
          active_version?: number | null
          assigned_agents?: string[]
          budget_level?: string | null
          client_name?: string
          client_type?: string
          close_date?: string | null
          comfort_level?: string | null
          created_at?: string
          created_by?: string | null
          dates_type?: string | null
          destination?: string | null
          email?: string | null
          exact_itinerary_pdf_path?: string | null
          id?: string
          lead_code: string
          magic_question?: string | null
          nethunt_record_id?: string | null
          nethunt_stage?: string | null
          nethunt_synced_at?: string | null
          nethunt_updated_at?: string | null
          notes?: string | null
          number_of_days?: number | null
          pax?: number | null
          pax_children?: number | null
          pax_infants?: number | null
          phone?: string | null
          pvp_override?: number | null
          route_map_path?: string | null
          sales_owner?: string | null
          source?: string
          status?: string
          travel_dates?: string | null
          travel_end_date?: string | null
          travel_style?: Json | null
          trip_finish?: string | null
          trip_start?: string | null
          updated_at?: string
          yt_id?: string | null
        }
        Update: {
          active_version?: number | null
          assigned_agents?: string[]
          budget_level?: string | null
          client_name?: string
          client_type?: string
          close_date?: string | null
          comfort_level?: string | null
          created_at?: string
          created_by?: string | null
          dates_type?: string | null
          destination?: string | null
          email?: string | null
          exact_itinerary_pdf_path?: string | null
          id?: string
          lead_code?: string
          magic_question?: string | null
          nethunt_record_id?: string | null
          nethunt_stage?: string | null
          nethunt_synced_at?: string | null
          nethunt_updated_at?: string | null
          notes?: string | null
          number_of_days?: number | null
          pax?: number | null
          pax_children?: number | null
          pax_infants?: number | null
          phone?: string | null
          pvp_override?: number | null
          route_map_path?: string | null
          sales_owner?: string | null
          source?: string
          status?: string
          travel_dates?: string | null
          travel_end_date?: string | null
          travel_style?: Json | null
          trip_finish?: string | null
          trip_start?: string | null
          updated_at?: string
          yt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      magpie_products: {
        Row: {
          accessibility: Json
          account_id: string | null
          account_name: string | null
          additional_info: string | null
          addresses: Json
          availability_status: string
          before_arrival: Json
          before_booking: Json
          booking_cutoff: string | null
          cancellation_cutoff: string | null
          cancellation_notes: string | null
          cancellation_policy: string | null
          category: string | null
          commentaries: Json
          confirmation_required: boolean | null
          currency: string | null
          description: string | null
          duration_from: number | null
          duration_text: string | null
          duration_to: number | null
          duration_type: string | null
          duration_unit: string | null
          end_date: string | null
          excluded: Json
          guide_type: string | null
          health_items: Json
          highlights: Json
          id: string
          images: Json
          imported_at: string
          included: Json
          internal_id: string | null
          language: string | null
          last_synced_at: string | null
          location: string | null
          long_description: string | null
          magpie_id: string
          max_group_size: number | null
          max_pax: number | null
          min_pax: number | null
          multiday: boolean | null
          name: string
          opening_hours: Json
          private: boolean | null
          raw_payload: Json
          redemption_type: string | null
          restrictions: Json
          retail_rate_adult: number | null
          retail_rate_child: number | null
          retail_rate_infant: number | null
          retail_rate_senior: number | null
          retail_rate_youth: number | null
          start_date: string | null
          summary: string | null
          sync_error: string | null
          sync_status: string
          terms_and_conditions: string | null
          timezone: string | null
          trip_difficulty: string | null
          valid_for: string | null
          version_id: string | null
          voucher_info: string | null
        }
        Insert: {
          accessibility?: Json
          account_id?: string | null
          account_name?: string | null
          additional_info?: string | null
          addresses?: Json
          availability_status?: string
          before_arrival?: Json
          before_booking?: Json
          booking_cutoff?: string | null
          cancellation_cutoff?: string | null
          cancellation_notes?: string | null
          cancellation_policy?: string | null
          category?: string | null
          commentaries?: Json
          confirmation_required?: boolean | null
          currency?: string | null
          description?: string | null
          duration_from?: number | null
          duration_text?: string | null
          duration_to?: number | null
          duration_type?: string | null
          duration_unit?: string | null
          end_date?: string | null
          excluded?: Json
          guide_type?: string | null
          health_items?: Json
          highlights?: Json
          id?: string
          images?: Json
          imported_at?: string
          included?: Json
          internal_id?: string | null
          language?: string | null
          last_synced_at?: string | null
          location?: string | null
          long_description?: string | null
          magpie_id: string
          max_group_size?: number | null
          max_pax?: number | null
          min_pax?: number | null
          multiday?: boolean | null
          name: string
          opening_hours?: Json
          private?: boolean | null
          raw_payload: Json
          redemption_type?: string | null
          restrictions?: Json
          retail_rate_adult?: number | null
          retail_rate_child?: number | null
          retail_rate_infant?: number | null
          retail_rate_senior?: number | null
          retail_rate_youth?: number | null
          start_date?: string | null
          summary?: string | null
          sync_error?: string | null
          sync_status?: string
          terms_and_conditions?: string | null
          timezone?: string | null
          trip_difficulty?: string | null
          valid_for?: string | null
          version_id?: string | null
          voucher_info?: string | null
        }
        Update: {
          accessibility?: Json
          account_id?: string | null
          account_name?: string | null
          additional_info?: string | null
          addresses?: Json
          availability_status?: string
          before_arrival?: Json
          before_booking?: Json
          booking_cutoff?: string | null
          cancellation_cutoff?: string | null
          cancellation_notes?: string | null
          cancellation_policy?: string | null
          category?: string | null
          commentaries?: Json
          confirmation_required?: boolean | null
          currency?: string | null
          description?: string | null
          duration_from?: number | null
          duration_text?: string | null
          duration_to?: number | null
          duration_type?: string | null
          duration_unit?: string | null
          end_date?: string | null
          excluded?: Json
          guide_type?: string | null
          health_items?: Json
          highlights?: Json
          id?: string
          images?: Json
          imported_at?: string
          included?: Json
          internal_id?: string | null
          language?: string | null
          last_synced_at?: string | null
          location?: string | null
          long_description?: string | null
          magpie_id?: string
          max_group_size?: number | null
          max_pax?: number | null
          min_pax?: number | null
          multiday?: boolean | null
          name?: string
          opening_hours?: Json
          private?: boolean | null
          raw_payload?: Json
          redemption_type?: string | null
          restrictions?: Json
          retail_rate_adult?: number | null
          retail_rate_child?: number | null
          retail_rate_infant?: number | null
          retail_rate_senior?: number | null
          retail_rate_youth?: number | null
          start_date?: string | null
          summary?: string | null
          sync_error?: string | null
          sync_status?: string
          terms_and_conditions?: string | null
          timezone?: string | null
          trip_difficulty?: string | null
          valid_for?: string | null
          version_id?: string | null
          voucher_info?: string | null
        }
        Relationships: []
      }
      magpie_sync_log: {
        Row: {
          details: Json
          error_message: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          products_failed: number
          products_requested: number
          products_succeeded: number
          run_type: string
          started_at: string
        }
        Insert: {
          details?: Json
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          products_failed?: number
          products_requested?: number
          products_succeeded?: number
          run_type: string
          started_at?: string
        }
        Update: {
          details?: Json
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          products_failed?: number
          products_requested?: number
          products_succeeded?: number
          run_type?: string
          started_at?: string
        }
        Relationships: []
      }
      nethunt_sync_log: {
        Row: {
          action: string | null
          created_at: string
          detail: Json | null
          direction: string
          entity: string
          entity_id: string | null
          id: string
          nethunt_record_id: string | null
          status: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          detail?: Json | null
          direction: string
          entity: string
          entity_id?: string | null
          id?: string
          nethunt_record_id?: string | null
          status?: string
        }
        Update: {
          action?: string | null
          created_at?: string
          detail?: Json | null
          direction?: string
          entity?: string
          entity_id?: string | null
          id?: string
          nethunt_record_id?: string | null
          status?: string
        }
        Relationships: []
      }
      nethunt_sync_state: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      nethunt_timeline: {
        Row: {
          body_html: string | null
          creator_email: string | null
          creator_name: string | null
          event_id: string
          event_time: string
          event_type: string
          id: string
          lead_id: string | null
          nethunt_record_id: string
          payload: Json | null
          pinned: boolean | null
          snippet: string | null
          subject: string | null
          synced_at: string
        }
        Insert: {
          body_html?: string | null
          creator_email?: string | null
          creator_name?: string | null
          event_id: string
          event_time: string
          event_type: string
          id?: string
          lead_id?: string | null
          nethunt_record_id: string
          payload?: Json | null
          pinned?: boolean | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string
        }
        Update: {
          body_html?: string | null
          creator_email?: string | null
          creator_name?: string | null
          event_id?: string
          event_time?: string
          event_type?: string
          id?: string
          lead_id?: string | null
          nethunt_record_id?: string
          payload?: Json | null
          pinned?: boolean | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nethunt_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_actions: {
        Row: {
          booking_id: string
          created_at: string
          deadline_iso: string | null
          deadline_label: string
          draft_body: string
          draft_subject: string
          id: string
          links: Json
          primary_label: string
          priority_score: number
          recipient: string
          secondary_label: string
          severity: string
          stage: string
          state: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          deadline_iso?: string | null
          deadline_label?: string
          draft_body?: string
          draft_subject?: string
          id: string
          links?: Json
          primary_label?: string
          priority_score?: number
          recipient?: string
          secondary_label?: string
          severity?: string
          stage?: string
          state?: string
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          deadline_iso?: string | null
          deadline_label?: string
          draft_body?: string
          draft_subject?: string
          id?: string
          links?: Json
          primary_label?: string
          priority_score?: number
          recipient?: string
          secondary_label?: string
          severity?: string
          stage?: string
          state?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_actions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "ops_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_bookings: {
        Row: {
          client_name: string
          created_at: string
          days_in_stage: number
          departure_date: string | null
          id: string
          language: string
          last_contact_days: number
          links: Json
          missing: Json
          pax: number
          product: string
          stage: string
          updated_at: string
        }
        Insert: {
          client_name: string
          created_at?: string
          days_in_stage?: number
          departure_date?: string | null
          id: string
          language?: string
          last_contact_days?: number
          links?: Json
          missing?: Json
          pax?: number
          product?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          days_in_stage?: number
          departure_date?: string | null
          id?: string
          language?: string
          last_contact_days?: number
          links?: Json
          missing?: Json
          pax?: number
          product?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_files: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string | null
          id: string
          partner_id: string
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          partner_id: string
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          partner_id?: string
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_files_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_links: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          partner_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          partner_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          partner_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_services: {
        Row: {
          booking_conditions: string | null
          cancellation_policy: string | null
          category: string
          commission_percent: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          duration: string | null
          id: string
          name: string
          notes: string | null
          partner_id: string
          payment_conditions: string | null
          price: number | null
          price_child: number | null
          price_unit: string | null
          refund_policy: string | null
          status: string
          updated_at: string
          validity_end: string | null
          validity_start: string | null
        }
        Insert: {
          booking_conditions?: string | null
          cancellation_policy?: string | null
          category?: string
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          name: string
          notes?: string | null
          partner_id: string
          payment_conditions?: string | null
          price?: number | null
          price_child?: number | null
          price_unit?: string | null
          refund_policy?: string | null
          status?: string
          updated_at?: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Update: {
          booking_conditions?: string | null
          cancellation_policy?: string | null
          category?: string
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          name?: string
          notes?: string | null
          partner_id?: string
          payment_conditions?: string | null
          price?: number | null
          price_child?: number | null
          price_unit?: string | null
          refund_policy?: string | null
          status?: string
          updated_at?: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_services_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          cancellation_policy: string | null
          category: string
          commission_percent: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_type: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          status: string
          territory: string | null
          updated_at: string
          validity_end: string | null
          validity_start: string | null
        }
        Insert: {
          cancellation_policy?: string | null
          category?: string
          commission_percent?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          territory?: string | null
          updated_at?: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Update: {
          cancellation_policy?: string | null
          category?: string
          commission_percent?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          territory?: string | null
          updated_at?: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          allow_auto_payment: boolean
          allow_partial_payment: boolean
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          days_before_departure: number
          deposit_cents: number | null
          end_date: string | null
          expires_at: string | null
          id: string
          idempotency_key: string
          installments: Json
          is_active: boolean
          last_error: string | null
          lead_id: string
          participant_fees: string
          payment_fees_paid_by: string
          proposal_id: string | null
          start_date: string | null
          status: string
          title: string
          trip_ref: string | null
          updated_at: string
          url: string | null
          wetravel_fee_paid_by: string
          wetravel_uuid: string | null
        }
        Insert: {
          allow_auto_payment?: boolean
          allow_partial_payment?: boolean
          amount_cents: number
          created_at?: string
          created_by?: string | null
          currency?: string
          days_before_departure?: number
          deposit_cents?: number | null
          end_date?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key: string
          installments?: Json
          is_active?: boolean
          last_error?: string | null
          lead_id: string
          participant_fees?: string
          payment_fees_paid_by?: string
          proposal_id?: string | null
          start_date?: string | null
          status?: string
          title: string
          trip_ref?: string | null
          updated_at?: string
          url?: string | null
          wetravel_fee_paid_by?: string
          wetravel_uuid?: string | null
        }
        Update: {
          allow_auto_payment?: boolean
          allow_partial_payment?: boolean
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          days_before_departure?: number
          deposit_cents?: number | null
          end_date?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          installments?: Json
          is_active?: boolean
          last_error?: string | null
          lead_id?: string
          participant_fees?: string
          payment_fees_paid_by?: string
          proposal_id?: string | null
          start_date?: string | null
          status?: string
          title?: string
          trip_ref?: string | null
          updated_at?: string
          url?: string | null
          wetravel_fee_paid_by?: string
          wetravel_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      pricing_patterns: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          item: string
          price: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          item: string
          price: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          item?: string
          price?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_local: {
        Row: {
          commercial_notes: string | null
          created_at: string
          custom_summary: string | null
          custom_title: string | null
          id: string
          internal_tags: string[]
          is_visible: boolean
          magpie_id: string
          sort_weight: number
          updated_at: string
          workflow_status: string
        }
        Insert: {
          commercial_notes?: string | null
          created_at?: string
          custom_summary?: string | null
          custom_title?: string | null
          id?: string
          internal_tags?: string[]
          is_visible?: boolean
          magpie_id: string
          sort_weight?: number
          updated_at?: string
          workflow_status?: string
        }
        Update: {
          commercial_notes?: string | null
          created_at?: string
          custom_summary?: string | null
          custom_title?: string | null
          id?: string
          internal_tags?: string[]
          is_visible?: boolean
          magpie_id?: string
          sort_weight?: number
          updated_at?: string
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_local_magpie_id_fkey"
            columns: ["magpie_id"]
            isOneToOne: true
            referencedRelation: "magpie_products"
            referencedColumns: ["magpie_id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          currency: string | null
          fixed_cost: number | null
          guide_allocation: Json | null
          id: string
          margin_calculation: Json | null
          market_pricing: Json | null
          markup_rules: Json | null
          name: string
          per_day_cost: number | null
          status: string
          supplier_id: string | null
          updated_at: string
          variable_cost_per_pax: number | null
          vehicle_allocation: Json | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          fixed_cost?: number | null
          guide_allocation?: Json | null
          id?: string
          margin_calculation?: Json | null
          market_pricing?: Json | null
          markup_rules?: Json | null
          name: string
          per_day_cost?: number | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          variable_cost_per_pax?: number | null
          vehicle_allocation?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          fixed_cost?: number | null
          guide_allocation?: Json | null
          id?: string
          margin_calculation?: Json | null
          market_pricing?: Json | null
          markup_rules?: Json | null
          name?: string
          per_day_cost?: number | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          variable_cost_per_pax?: number | null
          vehicle_allocation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposal_annotations: {
        Row: {
          author_email: string | null
          author_name: string
          author_type: string
          content: string
          created_at: string
          id: string
          is_resolved: boolean
          level: string
          parent_id: string | null
          proposal_id: string
          target_day_index: number | null
          target_item_index: number | null
        }
        Insert: {
          author_email?: string | null
          author_name?: string
          author_type?: string
          content?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          level?: string
          parent_id?: string | null
          proposal_id: string
          target_day_index?: number | null
          target_item_index?: number | null
        }
        Update: {
          author_email?: string | null
          author_name?: string
          author_type?: string
          content?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          level?: string
          parent_id?: string | null
          proposal_id?: string
          target_day_index?: number | null
          target_item_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_annotations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "proposal_annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_annotations_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_events: {
        Row: {
          actor_email: string | null
          actor_name: string
          created_at: string
          event_type: string
          id: string
          note: string | null
          proposal_id: string
        }
        Insert: {
          actor_email?: string | null
          actor_name?: string
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
          proposal_id: string
        }
        Update: {
          actor_email?: string | null
          actor_name?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_feedback: {
        Row: {
          client_reaction: string | null
          created_at: string | null
          edits_made: Json | null
          id: string
          learnings: string | null
          module_ratings: Json | null
          outcome: string
          proposal_id: string
          recorded_by: string | null
        }
        Insert: {
          client_reaction?: string | null
          created_at?: string | null
          edits_made?: Json | null
          id?: string
          learnings?: string | null
          module_ratings?: Json | null
          outcome: string
          proposal_id: string
          recorded_by?: string | null
        }
        Update: {
          client_reaction?: string | null
          created_at?: string | null
          edits_made?: Json | null
          id?: string
          learnings?: string | null
          module_ratings?: Json | null
          outcome?: string
          proposal_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_feedback_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_references: {
        Row: {
          created_at: string | null
          day_module_ids: string[] | null
          id: string
          proposal_id: string
          reference_program_id: string | null
        }
        Insert: {
          created_at?: string | null
          day_module_ids?: string[] | null
          id?: string
          proposal_id: string
          reference_program_id?: string | null
        }
        Update: {
          created_at?: string | null
          day_module_ids?: string[] | null
          id?: string
          proposal_id?: string
          reference_program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_references_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_references_reference_program_id_fkey"
            columns: ["reference_program_id"]
            isOneToOne: false
            referencedRelation: "reference_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approved_at: string | null
          booking_id: string | null
          booking_ref: string | null
          brand_logo_url: string | null
          client_email: string | null
          client_name: string
          closing_terms: Json | null
          created_at: string
          created_by: string | null
          date_range: string | null
          days: Json
          deposit_amount_eur: number | null
          deposit_percent: number
          hero_image_url: string | null
          id: string
          language: string
          lead_id: string | null
          map_stops: Json
          participants: string | null
          public_token: string
          sent_at: string | null
          status: string
          summary_text: string | null
          title: string
          total_value_eur: number | null
          updated_at: string
          wetravel_checkout_url: string | null
          wetravel_trip_url: string | null
          wetravel_trip_uuid: string | null
        }
        Insert: {
          approved_at?: string | null
          booking_id?: string | null
          booking_ref?: string | null
          brand_logo_url?: string | null
          client_email?: string | null
          client_name?: string
          closing_terms?: Json | null
          created_at?: string
          created_by?: string | null
          date_range?: string | null
          days?: Json
          deposit_amount_eur?: number | null
          deposit_percent?: number
          hero_image_url?: string | null
          id?: string
          language?: string
          lead_id?: string | null
          map_stops?: Json
          participants?: string | null
          public_token: string
          sent_at?: string | null
          status?: string
          summary_text?: string | null
          title?: string
          total_value_eur?: number | null
          updated_at?: string
          wetravel_checkout_url?: string | null
          wetravel_trip_url?: string | null
          wetravel_trip_uuid?: string | null
        }
        Update: {
          approved_at?: string | null
          booking_id?: string | null
          booking_ref?: string | null
          brand_logo_url?: string | null
          client_email?: string | null
          client_name?: string
          closing_terms?: Json | null
          created_at?: string
          created_by?: string | null
          date_range?: string | null
          days?: Json
          deposit_amount_eur?: number | null
          deposit_percent?: number
          hero_image_url?: string | null
          id?: string
          language?: string
          lead_id?: string | null
          map_stops?: Json
          participants?: string | null
          public_token?: string
          sent_at?: string | null
          status?: string
          summary_text?: string | null
          title?: string
          total_value_eur?: number | null
          updated_at?: string
          wetravel_checkout_url?: string | null
          wetravel_trip_url?: string | null
          wetravel_trip_uuid?: string | null
        }
        Relationships: []
      }
      reference_programs: {
        Row: {
          channel: string | null
          client_name: string | null
          created_at: string | null
          dates: string | null
          days: Json
          doc_type: string | null
          duration_days: number
          id: string
          is_best_of: boolean | null
          language: string
          notes: string | null
          pax: number | null
          segment: string
          signature_elements: string[] | null
          title: string
          updated_at: string | null
          usage_count: number | null
          wetravel_url: string | null
          win_count: number | null
          yt_id: string | null
        }
        Insert: {
          channel?: string | null
          client_name?: string | null
          created_at?: string | null
          dates?: string | null
          days: Json
          doc_type?: string | null
          duration_days: number
          id?: string
          is_best_of?: boolean | null
          language: string
          notes?: string | null
          pax?: number | null
          segment: string
          signature_elements?: string[] | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
          wetravel_url?: string | null
          win_count?: number | null
          yt_id?: string | null
        }
        Update: {
          channel?: string | null
          client_name?: string | null
          created_at?: string | null
          dates?: string | null
          days?: Json
          doc_type?: string | null
          duration_days?: number
          id?: string
          is_best_of?: boolean | null
          language?: string
          notes?: string | null
          pax?: number | null
          segment?: string
          signature_elements?: string[] | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
          wetravel_url?: string | null
          win_count?: number | null
          yt_id?: string | null
        }
        Relationships: []
      }
      signature_elements: {
        Row: {
          code: string
          created_at: string | null
          description: string
          id: string
          name: string
          segments: string[] | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description: string
          id?: string
          name: string
          segments?: string[] | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          name?: string
          segments?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_files: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string | null
          id: string
          size_bytes: number | null
          storage_path: string | null
          supplier_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          size_bytes?: number | null
          storage_path?: string | null
          supplier_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          size_bytes?: number | null
          storage_path?: string | null
          supplier_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_files_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_links: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          supplier_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          supplier_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          supplier_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_links_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_scores: {
        Row: {
          classification: string | null
          created_at: string
          id: string
          is_selected: boolean | null
          notes: string | null
          occurrences: number | null
          qualification: string | null
          scored_by: string | null
          scores: Json
          supplier_id: string
          updated_at: string
          weighted_average: number | null
        }
        Insert: {
          classification?: string | null
          created_at?: string
          id?: string
          is_selected?: boolean | null
          notes?: string | null
          occurrences?: number | null
          qualification?: string | null
          scored_by?: string | null
          scores?: Json
          supplier_id: string
          updated_at?: string
          weighted_average?: number | null
        }
        Update: {
          classification?: string | null
          created_at?: string
          id?: string
          is_selected?: boolean | null
          notes?: string | null
          occurrences?: number | null
          qualification?: string | null
          scored_by?: string | null
          scores?: Json
          supplier_id?: string
          updated_at?: string
          weighted_average?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_scores_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: true
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_services: {
        Row: {
          booking_conditions: string | null
          cancellation_policy: string | null
          category: string
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          duration: string | null
          id: string
          name: string
          notes: string | null
          payment_conditions: string | null
          price: number | null
          price_child: number | null
          price_unit: string | null
          refund_policy: string | null
          status: string
          supplier_id: string
          updated_at: string
          validity_end: string | null
          validity_start: string | null
        }
        Insert: {
          booking_conditions?: string | null
          cancellation_policy?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_conditions?: string | null
          price?: number | null
          price_child?: number | null
          price_unit?: string | null
          refund_policy?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Update: {
          booking_conditions?: string | null
          cancellation_policy?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_conditions?: string | null
          price?: number | null
          price_child?: number | null
          price_unit?: string | null
          refund_policy?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_services_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          cancellation_policy: string | null
          category: string
          commission_structure: Json | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_type: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          ideal_for: Json | null
          market_pricing: Json | null
          name: string
          net_rates: Json | null
          notes: string | null
          status: string
          updated_at: string
          validity_end: string | null
          validity_start: string | null
        }
        Insert: {
          cancellation_policy?: string | null
          category?: string
          commission_structure?: Json | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          ideal_for?: Json | null
          market_pricing?: Json | null
          name: string
          net_rates?: Json | null
          notes?: string | null
          status?: string
          updated_at?: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Update: {
          cancellation_policy?: string | null
          category?: string
          commission_structure?: Json | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          ideal_for?: Json | null
          market_pricing?: Json | null
          name?: string
          net_rates?: Json | null
          notes?: string | null
          status?: string
          updated_at?: string
          validity_end?: string | null
          validity_start?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      tasks: {
        Row: {
          all_day: boolean
          assigned_to: string | null
          assignee_emails: string[] | null
          category: string | null
          completed: boolean
          created_at: string
          created_by: string | null
          creator_email: string | null
          description: string | null
          due_at: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          nethunt_record_id: string | null
          nethunt_record_links: Json | null
          nethunt_synced_at: string | null
          nethunt_updated_at: string | null
          priority: string | null
          status: string
          team: string | null
          title: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          assigned_to?: string | null
          assignee_emails?: string[] | null
          category?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          creator_email?: string | null
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          nethunt_record_id?: string | null
          nethunt_record_links?: Json | null
          nethunt_synced_at?: string | null
          nethunt_updated_at?: string | null
          priority?: string | null
          status?: string
          team?: string | null
          title?: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          assigned_to?: string | null
          assignee_emails?: string[] | null
          category?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          creator_email?: string | null
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          nethunt_record_id?: string | null
          nethunt_record_links?: Json | null
          nethunt_synced_at?: string | null
          nethunt_updated_at?: string | null
          priority?: string | null
          status?: string
          team?: string | null
          title?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_plans: {
        Row: {
          client_name: string
          created_at: string
          created_by: string | null
          days: Json
          end_date: string | null
          extra_instructions: string | null
          file_id: string | null
          id: string
          lead_id: string
          narrative: string | null
          pax: string | null
          start_date: string | null
          status: string
          trip_title: string
          updated_at: string
        }
        Insert: {
          client_name?: string
          created_at?: string
          created_by?: string | null
          days?: Json
          end_date?: string | null
          extra_instructions?: string | null
          file_id?: string | null
          id?: string
          lead_id: string
          narrative?: string | null
          pax?: string | null
          start_date?: string | null
          status?: string
          trip_title?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string | null
          days?: Json
          end_date?: string | null
          extra_instructions?: string | null
          file_id?: string | null
          id?: string
          lead_id?: string
          narrative?: string | null
          pax?: string | null
          start_date?: string | null
          status?: string
          trip_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_plans_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_itinerary_items: {
        Row: {
          created_at: string
          day_number: number
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          net_total: number
          notes: string | null
          num_people: number
          paid_amount: number
          payment_status: string
          reservation_status: string
          sort_order: number | null
          start_time: string | null
          supplier: string | null
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          net_total?: number
          notes?: string | null
          num_people?: number
          paid_amount?: number
          payment_status?: string
          reservation_status?: string
          sort_order?: number | null
          start_time?: string | null
          supplier?: string | null
          title?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          net_total?: number
          notes?: string | null
          num_people?: number
          paid_amount?: number
          payment_status?: string
          reservation_status?: string
          sort_order?: number | null
          start_time?: string | null
          supplier?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_operations: {
        Row: {
          booking_status: string
          cost_item_id: string
          created_at: string
          id: string
          invoice_file_name: string | null
          invoice_file_url: string | null
          invoice_status: string
          payment_status: string
          schedule_time: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          booking_status?: string
          cost_item_id: string
          created_at?: string
          id?: string
          invoice_file_name?: string | null
          invoice_file_url?: string | null
          invoice_status?: string
          payment_status?: string
          schedule_time?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          booking_status?: string
          cost_item_id?: string
          created_at?: string
          id?: string
          invoice_file_name?: string | null
          invoice_file_url?: string | null
          invoice_status?: string
          payment_status?: string
          schedule_time?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_operations_cost_item_id_fkey"
            columns: ["cost_item_id"]
            isOneToOne: true
            referencedRelation: "cost_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_operations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          blocker_note: string | null
          budget_level: string | null
          checklist_items: Json | null
          client_name: string
          created_at: string
          created_by: string | null
          destination: string | null
          end_date: string | null
          has_blocker: boolean | null
          id: string
          lead_id: string | null
          notes: string | null
          pax: number | null
          sales_owner: string | null
          start_date: string | null
          status: string
          total_value: number | null
          trip_code: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          blocker_note?: string | null
          budget_level?: string | null
          checklist_items?: Json | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          end_date?: string | null
          has_blocker?: boolean | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          pax?: number | null
          sales_owner?: string | null
          start_date?: string | null
          status?: string
          total_value?: number | null
          trip_code?: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          blocker_note?: string | null
          budget_level?: string | null
          checklist_items?: Json | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          end_date?: string | null
          has_blocker?: boolean | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          pax?: number | null
          sales_owner?: string | null
          start_date?: string | null
          status?: string
          total_value?: number | null
          trip_code?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      used_photos: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          photo_id: string
          photo_url: string
          proposal_id: string | null
          used_in: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          photo_id: string
          photo_url: string
          proposal_id?: string | null
          used_in?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          photo_id?: string
          photo_url?: string
          proposal_id?: string | null
          used_in?: string
        }
        Relationships: [
          {
            foreignKeyName: "used_photos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "used_photos_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
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
      ytb_activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ytb_categories: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      ytb_classification_values: {
        Row: {
          classification_id: string
          id: string
          sort_order: number
          value: string
        }
        Insert: {
          classification_id: string
          id?: string
          sort_order?: number
          value: string
        }
        Update: {
          classification_id?: string
          id?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "ytb_classification_values_classification_id_fkey"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "ytb_classifications"
            referencedColumns: ["id"]
          },
        ]
      }
      ytb_classifications: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      ytb_document_categories: {
        Row: {
          category_id: string
          document_id: string
        }
        Insert: {
          category_id: string
          document_id: string
        }
        Update: {
          category_id?: string
          document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ytb_document_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ytb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ytb_document_categories_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ytb_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ytb_document_versions: {
        Row: {
          content: string | null
          created_at: string
          document_id: string
          edited_by: string | null
          file_path: string | null
          id: string
          title: string | null
          url: string | null
          version_number: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          document_id: string
          edited_by?: string | null
          file_path?: string | null
          id?: string
          title?: string | null
          url?: string | null
          version_number?: number
        }
        Update: {
          content?: string | null
          created_at?: string
          document_id?: string
          edited_by?: string | null
          file_path?: string | null
          id?: string
          title?: string | null
          url?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ytb_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ytb_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ytb_documents: {
        Row: {
          confidentiality: string
          content: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          folder_id: string | null
          id: string
          is_deleted: boolean
          status: string
          tags: string[]
          title: string
          type: string
          updated_at: string
          updated_by: string | null
          url: string | null
        }
        Insert: {
          confidentiality?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          is_deleted?: boolean
          status?: string
          tags?: string[]
          title: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          confidentiality?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          is_deleted?: boolean
          status?: string
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ytb_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "ytb_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      ytb_embeddings: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json
        }
        Insert: {
          chunk_index?: number
          chunk_text: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ytb_embeddings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ytb_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ytb_folders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_deleted: boolean
          name: string
          parent_folder_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_deleted?: boolean
          name: string
          parent_folder_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_deleted?: boolean
          name?: string
          parent_folder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ytb_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "ytb_folders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_internal_user: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      ytb_can_edit: { Args: { _user_id: string }; Returns: boolean }
      ytb_match_chunks: {
        Args: {
          allow_confidential?: boolean
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          document_id: string
          metadata: Json
          similarity: number
          title: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "sales_agent"
        | "operations_agent"
        | "finance"
        | "b2b_manager"
        | "viewer"
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
      app_role: [
        "super_admin",
        "admin",
        "sales_agent",
        "operations_agent",
        "finance",
        "b2b_manager",
        "viewer",
      ],
    },
  },
} as const
