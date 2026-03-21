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
          id: string
          lead_operation_id: string | null
          operation_id: string | null
          sent_at: string
          sent_by: string | null
          subject: string
          supplier_email: string | null
        }
        Insert: {
          body: string
          id?: string
          lead_operation_id?: string | null
          operation_id?: string | null
          sent_at?: string
          sent_by?: string | null
          subject: string
          supplier_email?: string | null
        }
        Update: {
          body?: string
          id?: string
          lead_operation_id?: string | null
          operation_id?: string | null
          sent_at?: string
          sent_by?: string | null
          subject?: string
          supplier_email?: string | null
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
          booking_status: string
          created_at: string
          day_number: number
          id: string
          invoice_file_name: string | null
          invoice_file_url: string | null
          invoice_status: string
          item_key: string
          lead_id: string
          payment_status: string
          schedule_time: string | null
          updated_at: string
        }
        Insert: {
          booking_status?: string
          created_at?: string
          day_number?: number
          id?: string
          invoice_file_name?: string | null
          invoice_file_url?: string | null
          invoice_status?: string
          item_key: string
          lead_id: string
          payment_status?: string
          schedule_time?: string | null
          updated_at?: string
        }
        Update: {
          booking_status?: string
          created_at?: string
          day_number?: number
          id?: string
          invoice_file_name?: string | null
          invoice_file_url?: string | null
          invoice_status?: string
          item_key?: string
          lead_id?: string
          payment_status?: string
          schedule_time?: string | null
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
          budget_level: string | null
          client_name: string
          comfort_level: string | null
          created_at: string
          created_by: string | null
          dates_type: string | null
          destination: string | null
          email: string | null
          id: string
          lead_code: string
          magic_question: string | null
          notes: string | null
          number_of_days: number | null
          pax: number | null
          pax_children: number | null
          pax_infants: number | null
          phone: string | null
          sales_owner: string | null
          source: string
          status: string
          travel_dates: string | null
          travel_end_date: string | null
          travel_style: Json | null
          updated_at: string
        }
        Insert: {
          active_version?: number | null
          budget_level?: string | null
          client_name?: string
          comfort_level?: string | null
          created_at?: string
          created_by?: string | null
          dates_type?: string | null
          destination?: string | null
          email?: string | null
          id?: string
          lead_code: string
          magic_question?: string | null
          notes?: string | null
          number_of_days?: number | null
          pax?: number | null
          pax_children?: number | null
          pax_infants?: number | null
          phone?: string | null
          sales_owner?: string | null
          source?: string
          status?: string
          travel_dates?: string | null
          travel_end_date?: string | null
          travel_style?: Json | null
          updated_at?: string
        }
        Update: {
          active_version?: number | null
          budget_level?: string | null
          client_name?: string
          comfort_level?: string | null
          created_at?: string
          created_by?: string | null
          dates_type?: string | null
          destination?: string | null
          email?: string | null
          id?: string
          lead_code?: string
          magic_question?: string | null
          notes?: string | null
          number_of_days?: number | null
          pax?: number | null
          pax_children?: number | null
          pax_infants?: number | null
          phone?: string | null
          sales_owner?: string | null
          source?: string
          status?: string
          travel_dates?: string | null
          travel_end_date?: string | null
          travel_style?: Json | null
          updated_at?: string
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
          status?: string
          updated_at?: string
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
          assigned_to: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: string | null
          status: string
          team: string | null
          title: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          status?: string
          team?: string | null
          title?: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
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
