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
      artist_profiles: {
        Row: {
          accommodation_rules: Json
          active: boolean
          artist_id: string | null
          banking: Json
          base_fee: number
          cancellation_terms: Json
          created_at: string
          currency: string
          default_team_size: number
          home_address: string | null
          home_city: string | null
          home_country: string
          home_country_code: string | null
          id: string
          min_margin_pct: number
          name: string
          notes: string | null
          payment_terms: Json
          per_diem_rules: Json
          profile_version: number
          rider: Json
          transport_rules: Json
          updated_at: string
        }
        Insert: {
          accommodation_rules?: Json
          active?: boolean
          artist_id?: string | null
          banking?: Json
          base_fee?: number
          cancellation_terms?: Json
          created_at?: string
          currency?: string
          default_team_size?: number
          home_address?: string | null
          home_city?: string | null
          home_country?: string
          home_country_code?: string | null
          id?: string
          min_margin_pct?: number
          name: string
          notes?: string | null
          payment_terms?: Json
          per_diem_rules?: Json
          profile_version?: number
          rider?: Json
          transport_rules?: Json
          updated_at?: string
        }
        Update: {
          accommodation_rules?: Json
          active?: boolean
          artist_id?: string | null
          banking?: Json
          base_fee?: number
          cancellation_terms?: Json
          created_at?: string
          currency?: string
          default_team_size?: number
          home_address?: string | null
          home_city?: string | null
          home_country?: string
          home_country_code?: string | null
          id?: string
          min_margin_pct?: number
          name?: string
          notes?: string | null
          payment_terms?: Json
          per_diem_rules?: Json
          profile_version?: number
          rider?: Json
          transport_rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_profiles_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_rosters: {
        Row: {
          active: boolean
          artist_name: string
          artist_type: string | null
          base_city: string | null
          base_country: string | null
          bio: string | null
          created_at: string
          currency: string
          genre: string | null
          id: string
          manager_id: string
          rate_hint_cents: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          artist_name: string
          artist_type?: string | null
          base_city?: string | null
          base_country?: string | null
          bio?: string | null
          created_at?: string
          currency?: string
          genre?: string | null
          id?: string
          manager_id: string
          rate_hint_cents?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          artist_name?: string
          artist_type?: string | null
          base_city?: string | null
          base_country?: string | null
          bio?: string | null
          created_at?: string
          currency?: string
          genre?: string | null
          id?: string
          manager_id?: string
          rate_hint_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_rosters_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          active: boolean
          base_fee: number
          created_at: string
          home_city: string
          id: string
          name: string
          photo: string | null
          slug: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_fee?: number
          created_at?: string
          home_city?: string
          id?: string
          name: string
          photo?: string | null
          slug: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_fee?: number
          created_at?: string
          home_city?: string
          id?: string
          name?: string
          photo?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      booking_notes: {
        Row: {
          author_id: string | null
          body: string
          booking_id: string
          created_at: string
          id: string
          internal: boolean
        }
        Insert: {
          author_id?: string | null
          body: string
          booking_id: string
          created_at?: string
          id?: string
          internal?: boolean
        }
        Update: {
          author_id?: string | null
          body?: string
          booking_id?: string
          created_at?: string
          id?: string
          internal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "booking_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      bookings: {
        Row: {
          artist_id: string
          balance_amount: number | null
          budget_min: number | null
          city: string
          client_offer: number | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          contact_whatsapp: string | null
          country: string
          created_at: string
          crowd_size: number | null
          deposit_amount: number | null
          deposit_pct: number
          deposit_ready: boolean
          deposit_verified_at: string | null
          description: string | null
          end_time: string | null
          ends_after_10pm: boolean
          event_class: string
          event_date: string
          event_name: string
          event_type: string
          has_media: boolean
          has_sponsors: boolean
          id: string
          package_id: string | null
          preferred_contact: string
          promoter_id: string | null
          proof_link: string | null
          quote_breakdown: Json | null
          quoted_amount: number | null
          ref: string
          score: number
          score_breakdown: Json
          source_application_id: string | null
          source_gig_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          ticket_price: number | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          artist_id: string
          balance_amount?: number | null
          budget_min?: number | null
          city: string
          client_offer?: number | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          contact_whatsapp?: string | null
          country?: string
          created_at?: string
          crowd_size?: number | null
          deposit_amount?: number | null
          deposit_pct?: number
          deposit_ready?: boolean
          deposit_verified_at?: string | null
          description?: string | null
          end_time?: string | null
          ends_after_10pm?: boolean
          event_class?: string
          event_date: string
          event_name: string
          event_type: string
          has_media?: boolean
          has_sponsors?: boolean
          id?: string
          package_id?: string | null
          preferred_contact?: string
          promoter_id?: string | null
          proof_link?: string | null
          quote_breakdown?: Json | null
          quoted_amount?: number | null
          ref: string
          score?: number
          score_breakdown?: Json
          source_application_id?: string | null
          source_gig_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          ticket_price?: number | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          artist_id?: string
          balance_amount?: number | null
          budget_min?: number | null
          city?: string
          client_offer?: number | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          contact_whatsapp?: string | null
          country?: string
          created_at?: string
          crowd_size?: number | null
          deposit_amount?: number | null
          deposit_pct?: number
          deposit_ready?: boolean
          deposit_verified_at?: string | null
          description?: string | null
          end_time?: string | null
          ends_after_10pm?: boolean
          event_class?: string
          event_date?: string
          event_name?: string
          event_type?: string
          has_media?: boolean
          has_sponsors?: boolean
          id?: string
          package_id?: string | null
          preferred_contact?: string
          promoter_id?: string | null
          proof_link?: string | null
          quote_breakdown?: Json | null
          quoted_amount?: number | null
          ref?: string
          score?: number
          score_breakdown?: Json
          source_application_id?: string | null
          source_gig_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          ticket_price?: number | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "promoters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_source_application_id_fkey"
            columns: ["source_application_id"]
            isOneToOne: false
            referencedRelation: "gig_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_source_gig_id_fkey"
            columns: ["source_gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          method: string
          pop_path: string | null
          reference: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          uploaded_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          method?: string
          pop_path?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          uploaded_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          method?: string
          pop_path?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          uploaded_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_campaign: {
        Row: {
          channel: string
          created_at: string
          event_id: string
          id: string
          meta: Json
          phase: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          template: string | null
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          event_id: string
          id?: string
          meta?: Json
          phase: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_id?: string
          id?: string
          meta?: Json
          phase?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_campaign_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_campaign_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_contracts: {
        Row: {
          created_at: string
          document_id: string | null
          event_id: string
          id: string
          meta: Json
          signed_at: string | null
          signer_email: string | null
          signer_name: string | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          event_id: string
          id?: string
          meta?: Json
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          event_id?: string
          id?: string
          meta?: Json
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_contracts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_contracts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_documents: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          filename: string
          id: string
          kind: string
          meta: Json
          mime: string | null
          size: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          filename: string
          id?: string
          kind: string
          meta?: Json
          mime?: string | null
          size?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          filename?: string
          id?: string
          kind?: string
          meta?: Json
          mime?: string | null
          size?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_health: {
        Row: {
          evaluated_at: string
          event_id: string
          factors: Json
          financial_lock: string
          health_score: number
          next_best_action: Json
          pillar_scores: Json
          predicted_failure_pct: number
          predicted_reasons: Json
          pulse: string
          risk_level: string
          stale: boolean
          updated_at: string
        }
        Insert: {
          evaluated_at?: string
          event_id: string
          factors?: Json
          financial_lock?: string
          health_score?: number
          next_best_action?: Json
          pillar_scores?: Json
          predicted_failure_pct?: number
          predicted_reasons?: Json
          pulse?: string
          risk_level?: string
          stale?: boolean
          updated_at?: string
        }
        Update: {
          evaluated_at?: string
          event_id?: string
          factors?: Json
          financial_lock?: string
          health_score?: number
          next_best_action?: Json
          pillar_scores?: Json
          predicted_failure_pct?: number
          predicted_reasons?: Json
          pulse?: string
          risk_level?: string
          stale?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_health_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_health_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_health_history: {
        Row: {
          event_id: string
          health_score: number
          id: string
          pillar_scores: Json
          risk_level: string
          snapshot_at: string
        }
        Insert: {
          event_id: string
          health_score: number
          id?: string
          pillar_scores?: Json
          risk_level: string
          snapshot_at?: string
        }
        Update: {
          event_id?: string
          health_score?: number
          id?: string
          pillar_scores?: Json
          risk_level?: string
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_health_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_health_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_logistics: {
        Row: {
          call_sheet: Json
          created_at: string
          distance_km: number | null
          driver: Json
          event_id: string
          hotel: Json
          id: string
          rider: Json
          travel: Json
          updated_at: string
        }
        Insert: {
          call_sheet?: Json
          created_at?: string
          distance_km?: number | null
          driver?: Json
          event_id: string
          hotel?: Json
          id?: string
          rider?: Json
          travel?: Json
          updated_at?: string
        }
        Update: {
          call_sheet?: Json
          created_at?: string
          distance_km?: number | null
          driver?: Json
          event_id?: string
          hotel?: Json
          id?: string
          rider?: Json
          travel?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_logistics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_logistics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_media: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          kind: string
          meta: Json
          storage_path: string | null
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          kind: string
          meta?: Json
          storage_path?: string | null
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          kind?: string
          meta?: Json
          storage_path?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_messages: {
        Row: {
          author_id: string | null
          body: string
          channel: string
          created_at: string
          direction: string
          event_id: string
          id: string
          kind: string
          meta: Json
        }
        Insert: {
          author_id?: string | null
          body: string
          channel?: string
          created_at?: string
          direction?: string
          event_id: string
          id?: string
          kind?: string
          meta?: Json
        }
        Update: {
          author_id?: string | null
          body?: string
          channel?: string
          created_at?: string
          direction?: string
          event_id?: string
          id?: string
          kind?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_overrides: {
        Row: {
          active: boolean
          approved_by: string | null
          created_at: string
          event_id: string
          id: string
          kind: string
          meta: Json
          new_deadline: string | null
          notes: string | null
          reason: string
        }
        Insert: {
          active?: boolean
          approved_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          kind: string
          meta?: Json
          new_deadline?: string | null
          notes?: string | null
          reason: string
        }
        Update: {
          active?: boolean
          approved_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          kind?: string
          meta?: Json
          new_deadline?: string | null
          notes?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_parties: {
        Row: {
          artist_id: string | null
          contact: Json
          created_at: string
          event_id: string
          id: string
          meta: Json
          name: string | null
          party_type: string | null
          promoter_id: string | null
          role: string
        }
        Insert: {
          artist_id?: string | null
          contact?: Json
          created_at?: string
          event_id: string
          id?: string
          meta?: Json
          name?: string | null
          party_type?: string | null
          promoter_id?: string | null
          role: string
        }
        Update: {
          artist_id?: string | null
          contact?: Json
          created_at?: string
          event_id?: string
          id?: string
          meta?: Json
          name?: string | null
          party_type?: string | null
          promoter_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_parties_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_parties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_parties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_parties_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "promoters"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payments: {
        Row: {
          amount_lsl: number
          created_at: string
          currency: string
          event_id: string
          hold_status: string
          id: string
          kind: string
          meta: Json
          method: string | null
          pop_path: string | null
          reference: string | null
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          status: string
          updated_at: string
          uploaded_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_lsl: number
          created_at?: string
          currency?: string
          event_id: string
          hold_status?: string
          id?: string
          kind: string
          meta?: Json
          method?: string | null
          pop_path?: string | null
          reference?: string | null
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_lsl?: number
          created_at?: string
          currency?: string
          event_id?: string
          hold_status?: string
          id?: string
          kind?: string
          meta?: Json
          method?: string | null
          pop_path?: string | null
          reference?: string | null
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_quotes: {
        Row: {
          ai_suggestion: Json | null
          artist_profile_id: string | null
          breakdown: Json
          created_at: string
          created_by: string | null
          currency: string
          deposit_pct: number
          event_id: string
          fee_total: number
          id: string
          line_items: Json
          logistics_total: number
          payment_schedule: Json
          profile_version: number | null
          status: string
          subtotal_lsl: number
          total_lsl: number
          updated_at: string
          version: number
        }
        Insert: {
          ai_suggestion?: Json | null
          artist_profile_id?: string | null
          breakdown?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_pct?: number
          event_id: string
          fee_total?: number
          id?: string
          line_items?: Json
          logistics_total?: number
          payment_schedule?: Json
          profile_version?: number | null
          status?: string
          subtotal_lsl?: number
          total_lsl?: number
          updated_at?: string
          version?: number
        }
        Update: {
          ai_suggestion?: Json | null
          artist_profile_id?: string | null
          breakdown?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_pct?: number
          event_id?: string
          fee_total?: number
          id?: string
          line_items?: Json
          logistics_total?: number
          payment_schedule?: Json
          profile_version?: number | null
          status?: string
          subtotal_lsl?: number
          total_lsl?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_quotes_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_quotes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_quotes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          event_id: string
          id: string
          meta: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          event_id: string
          id?: string
          meta?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          event_id?: string
          id?: string
          meta?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_timeline: {
        Row: {
          actor_id: string | null
          at: string
          event_id: string
          id: string
          payload: Json
          stage: string
        }
        Insert: {
          actor_id?: string | null
          at?: string
          event_id: string
          id?: string
          payload?: Json
          stage: string
        }
        Update: {
          actor_id?: string | null
          at?: string
          event_id?: string
          id?: string
          payload?: Json
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_timeline_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_timeline_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      gig_applications: {
        Row: {
          availability_notes: string | null
          booked_at: string | null
          created_at: string
          currency: string
          gig_id: string
          id: string
          manager_id: string
          message: string | null
          quote_cents: number
          rider_notes: string | null
          roster_artist_id: string | null
          shortlisted_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          availability_notes?: string | null
          booked_at?: string | null
          created_at?: string
          currency?: string
          gig_id: string
          id?: string
          manager_id: string
          message?: string | null
          quote_cents: number
          rider_notes?: string | null
          roster_artist_id?: string | null
          shortlisted_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          availability_notes?: string | null
          booked_at?: string | null
          created_at?: string
          currency?: string
          gig_id?: string
          id?: string
          manager_id?: string
          message?: string | null
          quote_cents?: number
          rider_notes?: string | null
          roster_artist_id?: string | null
          shortlisted_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_applications_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_applications_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_applications_roster_artist_id_fkey"
            columns: ["roster_artist_id"]
            isOneToOne: false
            referencedRelation: "artist_rosters"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_messages: {
        Row: {
          application_id: string | null
          body: string
          created_at: string
          gig_id: string
          id: string
          sender_user_id: string
        }
        Insert: {
          application_id?: string | null
          body: string
          created_at?: string
          gig_id: string
          id?: string
          sender_user_id: string
        }
        Update: {
          application_id?: string | null
          body?: string
          created_at?: string
          gig_id?: string
          id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "gig_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_messages_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_status_history: {
        Row: {
          at: string
          changed_by: string | null
          from_status: string | null
          gig_id: string
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          at?: string
          changed_by?: string | null
          from_status?: string | null
          gig_id: string
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          at?: string
          changed_by?: string | null
          from_status?: string | null
          gig_id?: string
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_status_history_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gigs: {
        Row: {
          admin_notes: string | null
          application_deadline: string
          approved_at: string | null
          approved_by: string | null
          artist_type_needed: string[]
          booked_application_id: string | null
          boost_until: string | null
          budget_high_cents: number
          budget_low_cents: number
          city: string
          country: string
          created_at: string
          crowd_size: number
          currency: string
          description: string | null
          event_date: string
          event_name: string
          event_type: string | null
          genre_needed: string[]
          id: string
          promoter_id: string
          status: string
          updated_at: string
          venue: string
        }
        Insert: {
          admin_notes?: string | null
          application_deadline: string
          approved_at?: string | null
          approved_by?: string | null
          artist_type_needed?: string[]
          booked_application_id?: string | null
          boost_until?: string | null
          budget_high_cents: number
          budget_low_cents: number
          city: string
          country: string
          created_at?: string
          crowd_size?: number
          currency?: string
          description?: string | null
          event_date: string
          event_name: string
          event_type?: string | null
          genre_needed?: string[]
          id?: string
          promoter_id: string
          status?: string
          updated_at?: string
          venue: string
        }
        Update: {
          admin_notes?: string | null
          application_deadline?: string
          approved_at?: string | null
          approved_by?: string | null
          artist_type_needed?: string[]
          booked_application_id?: string | null
          boost_until?: string | null
          budget_high_cents?: number
          budget_low_cents?: number
          city?: string
          country?: string
          created_at?: string
          crowd_size?: number
          currency?: string
          description?: string | null
          event_date?: string
          event_name?: string
          event_type?: string | null
          genre_needed?: string[]
          id?: string
          promoter_id?: string
          status?: string
          updated_at?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "gigs_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "promoter_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_profiles: {
        Row: {
          agency_name: string | null
          bio: string | null
          city: string | null
          contact_name: string
          country: string | null
          created_at: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          agency_name?: string | null
          bio?: string | null
          city?: string | null
          contact_name: string
          country?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          agency_name?: string | null
          bio?: string | null
          city?: string | null
          contact_name?: string
          country?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          event_id: string | null
          id: string
          meta: Json
          read_at: string | null
          read_by: string | null
          rule: string
          severity: string
          target_role: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          meta?: Json
          read_at?: string | null
          read_by?: string | null
          rule: string
          severity?: string
          target_role?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          meta?: Json
          read_at?: string | null
          read_by?: string | null
          rule?: string
          severity?: string
          target_role?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_financial_state"
            referencedColumns: ["event_id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          artist_id: string
          base_price: number
          created_at: string
          crew_size: number
          description: string | null
          duration_minutes: number | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          artist_id: string
          base_price: number
          created_at?: string
          crew_size?: number
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          artist_id?: string
          base_price?: number
          created_at?: string
          crew_size?: number
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          artist_id: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          artist_id: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          artist_id?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      promoter_profiles: {
        Row: {
          bio: string | null
          city: string | null
          company_name: string | null
          confirmed_bookings: number
          contact_name: string
          country: string | null
          created_at: string
          id: string
          phone: string | null
          trust_score: number
          updated_at: string
          user_id: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          company_name?: string | null
          confirmed_bookings?: number
          contact_name: string
          country?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          trust_score?: number
          updated_at?: string
          user_id: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          company_name?: string | null
          confirmed_bookings?: number
          contact_name?: string
          country?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          trust_score?: number
          updated_at?: string
          user_id?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      promoters: {
        Row: {
          blacklisted: boolean
          bookings_count: number
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          reliability_score: number
          social_links: Json | null
          total_revenue: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          blacklisted?: boolean
          bookings_count?: number
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          reliability_score?: number
          social_links?: Json | null
          total_revenue?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          blacklisted?: boolean
          bookings_count?: number
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          reliability_score?: number
          social_links?: Json | null
          total_revenue?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      quotation_templates: {
        Row: {
          artist_profile_id: string
          created_at: string
          defaults: Json
          description: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          artist_profile_id: string
          created_at?: string
          defaults?: Json
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          artist_profile_id?: string
          created_at?: string
          defaults?: Json
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_templates_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_gigs: {
        Row: {
          gig_id: string
          id: string
          manager_id: string
          saved_at: string
        }
        Insert: {
          gig_id: string
          id?: string
          manager_id: string
          saved_at?: string
        }
        Update: {
          gig_id?: string
          id?: string
          manager_id?: string
          saved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_gigs_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_gigs_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_profiles"
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
      event_financial_state: {
        Row: {
          balance_due_on: string | null
          days_to_balance_due: number | null
          days_to_event: number | null
          event_date: string | null
          event_id: string | null
          financial_state: string | null
          has_continuation: boolean | null
          is_cancelled: boolean | null
          lock_active: boolean | null
          outstanding_lsl: number | null
          paid_lsl: number | null
          ref: string | null
          total_due_lsl: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff_or_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff" | "promoter" | "manager" | "artist"
      booking_status:
        | "new"
        | "reviewing"
        | "quote_sent"
        | "offer_submitted"
        | "counter_offer"
        | "deposit_pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "declined"
      deposit_status: "uploaded" | "verified" | "rejected"
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
      app_role: ["admin", "staff", "promoter", "manager", "artist"],
      booking_status: [
        "new",
        "reviewing",
        "quote_sent",
        "offer_submitted",
        "counter_offer",
        "deposit_pending",
        "confirmed",
        "completed",
        "cancelled",
        "declined",
      ],
      deposit_status: ["uploaded", "verified", "rejected"],
    },
  },
} as const
