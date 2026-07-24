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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          diff: Json | null
          entity_id: string
          entity_type: string
          id: string
          occurred_at: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          diff?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          diff?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          occurred_at?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string
          criteria: string | null
          icon: string | null
          id: number
          name: string | null
        }
        Insert: {
          created_at?: string
          criteria?: string | null
          icon?: string | null
          id?: number
          name?: string | null
        }
        Update: {
          created_at?: string
          criteria?: string | null
          icon?: string | null
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount_rappen: number
          category: string
          currency: string
          id: string
          period_id: string
          version: number
        }
        Insert: {
          amount_rappen: number
          category: string
          currency?: string
          id?: string
          period_id: string
          version?: number
        }
        Update: {
          amount_rappen?: number
          category?: string
          currency?: string
          id?: string
          period_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "financial_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_urls: string[] | null
          content: string
          created_at: string | null
          edited_at: string | null
          id: string
          is_read: boolean | null
          read_at: string | null
          relation_id: string
          sender_id: string
        }
        Insert: {
          attachment_urls?: string[] | null
          content: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          relation_id: string
          sender_id: string
        }
        Update: {
          attachment_urls?: string[] | null
          content?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          relation_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "mentorship_relations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_rubrics: {
        Row: {
          created_at: string | null
          created_by: string
          criteria: Json | null
          description: string | null
          id: string
          max_points: number | null
          pdf_name: string | null
          pdf_path: string | null
          subject: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          criteria?: Json | null
          description?: string | null
          id?: string
          max_points?: number | null
          pdf_name?: string | null
          pdf_path?: string | null
          subject?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          criteria?: Json | null
          description?: string | null
          id?: string
          max_points?: number | null
          pdf_name?: string | null
          pdf_path?: string | null
          subject?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correction_rubrics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_days: {
        Row: {
          course_date: string
          id: string
          sequence: number
          session_id: number
        }
        Insert: {
          course_date: string
          id?: string
          sequence: number
          session_id: number
        }
        Update: {
          course_date?: string
          id?: string
          sequence?: number
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_days_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_occurrences: {
        Row: {
          course_id: number | null
          ends_at_utc: string
          id: number
          starts_at_utc: string
        }
        Insert: {
          course_id?: number | null
          ends_at_utc: string
          id?: never
          starts_at_utc: string
        }
        Update: {
          course_id?: number | null
          ends_at_utc?: string
          id?: never
          starts_at_utc?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_occurrences_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sessions: {
        Row: {
          created_at: string
          delivery_modes: string[]
          edition_id: string
          id: number
          registration_status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          delivery_modes?: string[]
          edition_id: string
          id: number
          registration_status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          delivery_modes?: string[]
          edition_id?: string
          id?: number
          registration_status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_sessions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "offer_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sessions_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "intensivwoche_kurse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sessions_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "intensivwoche_kurse_mit_anmeldungen"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          id: number
          location: string | null
          payment_method: string | null
          price: number | null
          timezone: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          location?: string | null
          payment_method?: string | null
          price?: number | null
          timezone?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          location?: string | null
          payment_method?: string | null
          price?: number | null
          timezone?: string | null
          title?: string | null
        }
        Relationships: []
      }
      daily_release_items: {
        Row: {
          content_item_id: string
          position: number
          release_id: string
        }
        Insert: {
          content_item_id: string
          position: number
          release_id: string
        }
        Update: {
          content_item_id?: string
          position?: number
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_release_items_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "release_content_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_release_items_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "daily_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_releases: {
        Row: {
          closes_at: string | null
          course_day_id: string
          created_at: string
          id: string
          opens_at: string | null
          published_at: string | null
          published_by: string | null
          revoked_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          closes_at?: string | null
          course_day_id: string
          created_at?: string
          id?: string
          opens_at?: string | null
          published_at?: string | null
          published_by?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          closes_at?: string | null
          course_day_id?: string
          created_at?: string
          id?: string
          opens_at?: string | null
          published_at?: string | null
          published_by?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_releases_course_day_id_fkey"
            columns: ["course_day_id"]
            isOneToOne: true
            referencedRelation: "course_days"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_ai_corrections: {
        Row: {
          essay_id: string
          generated_at: string | null
          id: string
          input_tokens: number | null
          model_used: string
          output_tokens: number | null
          raw_suggestion: string
          released_at: string | null
          released_by: string | null
          rubric_id: string | null
          status: string
          teacher_edited_suggestion: string | null
        }
        Insert: {
          essay_id: string
          generated_at?: string | null
          id?: string
          input_tokens?: number | null
          model_used?: string
          output_tokens?: number | null
          raw_suggestion?: string
          released_at?: string | null
          released_by?: string | null
          rubric_id?: string | null
          status?: string
          teacher_edited_suggestion?: string | null
        }
        Update: {
          essay_id?: string
          generated_at?: string | null
          id?: string
          input_tokens?: number | null
          model_used?: string
          output_tokens?: number | null
          raw_suggestion?: string
          released_at?: string | null
          released_by?: string | null
          rubric_id?: string | null
          status?: string
          teacher_edited_suggestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "essay_ai_corrections_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: true
            referencedRelation: "student_essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_ai_corrections_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_ai_corrections_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "correction_rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          id: number
          subject_id: number | null
          subtitle: string | null
          table_data: Json | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          subject_id?: number | null
          subtitle?: string | null
          table_data?: Json | null
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          subject_id?: number | null
          subtitle?: string | null
          table_data?: Json | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_entries: {
        Row: {
          amount_rappen: number
          category: string
          created_at: string
          created_by: string
          currency: string
          edition_id: string | null
          id: string
          receipt_ref: string | null
          service_date: string
          session_id: number | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          amount_rappen: number
          category: string
          created_at?: string
          created_by: string
          currency?: string
          edition_id?: string | null
          id?: string
          receipt_ref?: string | null
          service_date: string
          session_id?: number | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount_rappen?: number
          category?: string
          created_at?: string
          created_by?: string
          currency?: string
          edition_id?: string | null
          id?: string
          receipt_ref?: string | null
          service_date?: string
          session_id?: number | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "offer_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_adjustments: {
        Row: {
          amount_rappen: number
          category: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          period_id: string
          reason: string
        }
        Insert: {
          amount_rappen: number
          category?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          period_id: string
          reason: string
        }
        Update: {
          amount_rappen?: number
          category?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          period_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_adjustments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "financial_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_events: {
        Row: {
          amount_rappen: number
          audience_id: string | null
          created_at: string
          currency: string
          edition_id: string | null
          event_type: string
          event_version: number
          id: string
          occurred_at: string
          recognized_at: string
          session_id: number | null
          source_id: string
          source_kind: string
          status: string
        }
        Insert: {
          amount_rappen: number
          audience_id?: string | null
          created_at?: string
          currency?: string
          edition_id?: string | null
          event_type: string
          event_version?: number
          id?: string
          occurred_at?: string
          recognized_at?: string
          session_id?: number | null
          source_id: string
          source_kind: string
          status?: string
        }
        Update: {
          amount_rappen?: number
          audience_id?: string | null
          created_at?: string
          currency?: string
          edition_id?: string | null
          event_type?: string
          event_version?: number
          id?: string
          occurred_at?: string
          recognized_at?: string
          session_id?: number | null
          source_id?: string
          source_kind?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_events_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "offer_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_periods: {
        Row: {
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          status: string
          updated_at: string
          version: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          status?: string
          updated_at?: string
          version?: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          status?: string
          updated_at?: string
          version?: number
          year?: number
        }
        Relationships: []
      }
      intensivwoche_anmeldungen: {
        Row: {
          beneficiary_user_id: string | null
          booked_price_rappen: number | null
          child_class_level: string
          child_firstname: string
          child_gender: string
          child_lastname: string
          created_at: string
          currency: string
          edition_id: string | null
          id: string
          idempotency_key: string | null
          kurs_id: number | null
          notes: string | null
          paid_at: string | null
          parent_email: string
          parent_phone: string
          session_id: number | null
          status: string
        }
        Insert: {
          beneficiary_user_id?: string | null
          booked_price_rappen?: number | null
          child_class_level: string
          child_firstname: string
          child_gender: string
          child_lastname: string
          created_at?: string
          currency?: string
          edition_id?: string | null
          id?: string
          idempotency_key?: string | null
          kurs_id?: number | null
          notes?: string | null
          paid_at?: string | null
          parent_email: string
          parent_phone: string
          session_id?: number | null
          status?: string
        }
        Update: {
          beneficiary_user_id?: string | null
          booked_price_rappen?: number | null
          child_class_level?: string
          child_firstname?: string
          child_gender?: string
          child_lastname?: string
          created_at?: string
          currency?: string
          edition_id?: string | null
          id?: string
          idempotency_key?: string | null
          kurs_id?: number | null
          notes?: string | null
          paid_at?: string | null
          parent_email?: string
          parent_phone?: string
          session_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "intensivwoche_anmeldungen_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "offer_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intensivwoche_anmeldungen_kurs_id_fkey"
            columns: ["kurs_id"]
            isOneToOne: false
            referencedRelation: "intensivwoche_kurse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intensivwoche_anmeldungen_kurs_id_fkey"
            columns: ["kurs_id"]
            isOneToOne: false
            referencedRelation: "intensivwoche_kurse_mit_anmeldungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intensivwoche_anmeldungen_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      intensivwoche_buchungsversuche: {
        Row: {
          attempted_at: string
          id: number
          parent_email: string
        }
        Insert: {
          attempted_at?: string
          id?: never
          parent_email: string
        }
        Update: {
          attempted_at?: string
          id?: never
          parent_email?: string
        }
        Relationships: []
      }
      intensivwoche_kurse: {
        Row: {
          beschreibung: string
          created_at: string
          created_by: string | null
          detail_beschreibung: string | null
          end_datum: string
          fach: string
          highlights: string[] | null
          id: number
          ist_aktiv: boolean
          klassenstufen: string[]
          lehrer: string
          max_teilnehmer: number
          name: string
          ort: string
          preis: number
          start_datum: string
          uhrzeit: string
          updated_at: string
        }
        Insert: {
          beschreibung: string
          created_at?: string
          created_by?: string | null
          detail_beschreibung?: string | null
          end_datum: string
          fach: string
          highlights?: string[] | null
          id?: number
          ist_aktiv?: boolean
          klassenstufen?: string[]
          lehrer: string
          max_teilnehmer?: number
          name: string
          ort: string
          preis: number
          start_datum: string
          uhrzeit: string
          updated_at?: string
        }
        Update: {
          beschreibung?: string
          created_at?: string
          created_by?: string | null
          detail_beschreibung?: string | null
          end_datum?: string
          fach?: string
          highlights?: string[] | null
          id?: number
          ist_aktiv?: boolean
          klassenstufen?: string[]
          lehrer?: string
          max_teilnehmer?: number
          name?: string
          ort?: string
          preis?: number
          start_datum?: string
          uhrzeit?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_materials: {
        Row: {
          area_id: number | null
          class_levels: string[]
          created_at: string
          created_by: string | null
          description: string | null
          download_count: number | null
          download_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: number
          is_link: boolean | null
          is_public: boolean | null
          name: string | null
          subject_id: number | null
          type: string | null
        }
        Insert: {
          area_id?: number | null
          class_levels: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          download_count?: number | null
          download_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: number
          is_link?: boolean | null
          is_public?: boolean | null
          name?: string | null
          subject_id?: number | null
          type?: string | null
        }
        Update: {
          area_id?: number | null
          class_levels?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          download_count?: number | null
          download_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: number
          is_link?: boolean | null
          is_public?: boolean | null
          name?: string | null
          subject_id?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_materials_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "material_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_materials_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_outbox: {
        Row: {
          anmeldung_id: string
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          template_key: string
          updated_at: string
        }
        Insert: {
          anmeldung_id: string
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          template_key?: string
          updated_at?: string
        }
        Update: {
          anmeldung_id?: string
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_outbox_anmeldung_id_fkey"
            columns: ["anmeldung_id"]
            isOneToOne: false
            referencedRelation: "intensivwoche_anmeldungen"
            referencedColumns: ["id"]
          },
        ]
      }
      material_access_grants: {
        Row: {
          area_id: number
          created_at: string
          id: string
          revoked_at: string | null
          source_id: string | null
          source_kind: string
          status: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          area_id: number
          created_at?: string
          id?: string
          revoked_at?: string | null
          source_id?: string | null
          source_kind: string
          status?: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          area_id?: number
          created_at?: string
          id?: string
          revoked_at?: string | null
          source_id?: string | null
          source_kind?: string
          status?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_access_grants_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "material_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      material_areas: {
        Row: {
          created_at: string
          id: number
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          id?: never
          key: string
          label: string
        }
        Update: {
          created_at?: string
          id?: never
          key?: string
          label?: string
        }
        Relationships: []
      }
      math_solution_steps: {
        Row: {
          exercise_id: number
          exercise_type: string
          generated_at: string | null
          id: string
          model_used: string
          question: string
          solution: string
          steps: Json
        }
        Insert: {
          exercise_id: number
          exercise_type: string
          generated_at?: string | null
          id?: string
          model_used?: string
          question: string
          solution: string
          steps: Json
        }
        Update: {
          exercise_id?: number
          exercise_type?: string
          generated_at?: string | null
          id?: string
          model_used?: string
          question?: string
          solution?: string
          steps?: Json
        }
        Relationships: []
      }
      mentor_skills: {
        Row: {
          class_levels: string[]
          created_at: string | null
          description: string | null
          id: string
          mentor_id: string
          subject_id: number
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          class_levels?: string[]
          created_at?: string | null
          description?: string | null
          id?: string
          mentor_id: string
          subject_id: number
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          class_levels?: string[]
          created_at?: string | null
          description?: string | null
          id?: string
          mentor_id?: string
          subject_id?: number
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_skills_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_skills_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_listings: {
        Row: {
          author_id: string
          availability: string | null
          class_levels: string[]
          created_at: string | null
          current_mentees: number | null
          description: string | null
          expires_at: string | null
          id: string
          is_featured: boolean | null
          max_mentees: number | null
          status: string
          subject_ids: number[]
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          availability?: string | null
          class_levels?: string[]
          created_at?: string | null
          current_mentees?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_featured?: boolean | null
          max_mentees?: number | null
          status?: string
          subject_ids?: number[]
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          availability?: string | null
          class_levels?: string[]
          created_at?: string | null
          current_mentees?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_featured?: boolean | null
          max_mentees?: number | null
          status?: string
          subject_ids?: number[]
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_listings_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_materials: {
        Row: {
          assigned_to: string
          corrected_at: string | null
          created_at: string | null
          description: string | null
          feedback: string | null
          feedback_file_urls: string[] | null
          file_types: string[]
          file_urls: string[]
          grade: string | null
          id: string
          relation_id: string
          status: string
          submitted_at: string | null
          title: string
          type: string
          updated_at: string | null
          uploader_id: string
        }
        Insert: {
          assigned_to: string
          corrected_at?: string | null
          created_at?: string | null
          description?: string | null
          feedback?: string | null
          feedback_file_urls?: string[] | null
          file_types?: string[]
          file_urls?: string[]
          grade?: string | null
          id?: string
          relation_id: string
          status?: string
          submitted_at?: string | null
          title: string
          type?: string
          updated_at?: string | null
          uploader_id: string
        }
        Update: {
          assigned_to?: string
          corrected_at?: string | null
          created_at?: string | null
          description?: string | null
          feedback?: string | null
          feedback_file_urls?: string[] | null
          file_types?: string[]
          file_urls?: string[]
          grade?: string | null
          id?: string
          relation_id?: string
          status?: string
          submitted_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_materials_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_materials_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "mentorship_relations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_materials_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_relations: {
        Row: {
          ended_at: string | null
          ended_reason: string | null
          id: string
          materials_corrected: number | null
          materials_submitted: number | null
          mentee_id: string
          mentor_id: string
          original_listing_id: string | null
          original_request_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          materials_corrected?: number | null
          materials_submitted?: number | null
          mentee_id: string
          mentor_id: string
          original_listing_id?: string | null
          original_request_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          materials_corrected?: number | null
          materials_submitted?: number | null
          mentee_id?: string
          mentor_id?: string
          original_listing_id?: string | null
          original_request_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_relations_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_relations_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_relations_original_listing_id_fkey"
            columns: ["original_listing_id"]
            isOneToOne: false
            referencedRelation: "mentorship_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_relations_original_request_id_fkey"
            columns: ["original_request_id"]
            isOneToOne: false
            referencedRelation: "mentorship_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_requests: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          listing_id: string
          message: string | null
          requester_id: string
          responded_at: string | null
          response_message: string | null
          status: string
          target_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          listing_id: string
          message?: string | null
          requester_id: string
          responded_at?: string | null
          response_message?: string | null
          status?: string
          target_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          listing_id?: string
          message?: string | null
          requester_id?: string
          responded_at?: string | null
          response_message?: string | null
          status?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mentorship_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_requests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_editions: {
        Row: {
          created_at: string
          currency: string
          description: string
          early_bird_deadline: string | null
          early_bird_enabled: boolean
          early_bird_price_rappen: number | null
          id: string
          offer_id: number
          public_title: string
          published_at: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          regular_price_rappen: number
          school_year: string
          status: string
          tagline: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          currency?: string
          description: string
          early_bird_deadline?: string | null
          early_bird_enabled?: boolean
          early_bird_price_rappen?: number | null
          id?: string
          offer_id: number
          public_title: string
          published_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          regular_price_rappen: number
          school_year: string
          status?: string
          tagline: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string
          early_bird_deadline?: string | null
          early_bird_enabled?: boolean
          early_bird_price_rappen?: number | null
          id?: string
          offer_id?: number
          public_title?: string
          published_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          regular_price_rappen?: number
          school_year?: string
          status?: string
          tagline?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_editions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          audience_id: string
          created_at: string
          id: number
          kurstyp: string
          slug: string
        }
        Insert: {
          audience_id: string
          created_at?: string
          id?: never
          kurstyp: string
          slug: string
        }
        Update: {
          audience_id?: string
          created_at?: string
          id?: never
          kurstyp?: string
          slug?: string
        }
        Relationships: []
      }
      payroll_periods: {
        Row: {
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          month: number
          status: string
          updated_at: string
          version: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          month: number
          status?: string
          updated_at?: string
          version?: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          month?: number
          status?: string
          updated_at?: string
          version?: number
          year?: number
        }
        Relationships: []
      }
      payroll_snapshot_lines: {
        Row: {
          amount_rappen: number
          duration_minutes: number
          hourly_rate_rappen: number
          id: string
          rate_agreement_id: string
          snapshot_id: string
          work_entry_id: string
        }
        Insert: {
          amount_rappen: number
          duration_minutes: number
          hourly_rate_rappen: number
          id?: string
          rate_agreement_id: string
          snapshot_id: string
          work_entry_id: string
        }
        Update: {
          amount_rappen?: number
          duration_minutes?: number
          hourly_rate_rappen?: number
          id?: string
          rate_agreement_id?: string
          snapshot_id?: string
          work_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_snapshot_lines_rate_agreement_id_fkey"
            columns: ["rate_agreement_id"]
            isOneToOne: false
            referencedRelation: "teacher_rate_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_snapshot_lines_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "payroll_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_snapshot_lines_work_entry_id_fkey"
            columns: ["work_entry_id"]
            isOneToOne: true
            referencedRelation: "work_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_snapshots: {
        Row: {
          created_at: string
          currency: string
          id: string
          period_id: string
          teacher_id: string
          total_amount_rappen: number
          total_minutes: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          period_id: string
          teacher_id: string
          total_amount_rappen: number
          total_minutes: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          period_id?: string
          teacher_id?: string
          total_amount_rappen?: number
          total_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_snapshots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          class_level: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: string | null
          school_name: string | null
          theme_preference: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          class_level?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          school_name?: string | null
          theme_preference?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          class_level?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          school_name?: string | null
          theme_preference?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      release_content_catalog: {
        Row: {
          created_at: string
          exercise_id: number | null
          id: string
          kind: string
          trainer_exam_id: string | null
        }
        Insert: {
          created_at?: string
          exercise_id?: number | null
          id?: string
          kind: string
          trainer_exam_id?: string | null
        }
        Update: {
          created_at?: string
          exercise_id?: number | null
          id?: string
          kind?: string
          trainer_exam_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "release_content_catalog_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: true
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_content_catalog_trainer_exam_id_fkey"
            columns: ["trainer_exam_id"]
            isOneToOne: true
            referencedRelation: "trainer_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      self_study_enrollments: {
        Row: {
          access_until: string | null
          area_id: number
          audience_id: string
          beneficiary_user_id: string | null
          created_at: string
          id: string
          invite_token_hash: string | null
          payment_provider_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_until?: string | null
          area_id: number
          audience_id: string
          beneficiary_user_id?: string | null
          created_at?: string
          id?: string
          invite_token_hash?: string | null
          payment_provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_until?: string | null
          area_id?: number
          audience_id?: string
          beneficiary_user_id?: string | null
          created_at?: string
          id?: string
          invite_token_hash?: string | null
          payment_provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_study_enrollments_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "material_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      student_essays: {
        Row: {
          created_at: string | null
          description: string | null
          feedback: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          grade: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          student_id: string
          subject: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feedback?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          grade?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id: string
          subject: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feedback?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          grade?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id?: string
          subject?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_essays_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_essays_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          id: number
          name: string | null
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          exercise_id: number
          formula: string | null
          highlight: string | null
          hint: string | null
          id: number
          options: Json | null
          question: string
          solution: string
          type: string | null
        }
        Insert: {
          exercise_id: number
          formula?: string | null
          highlight?: string | null
          hint?: string | null
          id?: number
          options?: Json | null
          question: string
          solution: string
          type?: string | null
        }
        Update: {
          exercise_id?: number
          formula?: string | null
          highlight?: string | null
          hint?: string | null
          id?: number
          options?: Json | null
          question?: string
          solution?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          created_at: string
          id: string
          role: string
          session_id: number
          teacher_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          session_id: number
          teacher_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          session_id?: number
          teacher_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_rate_agreements: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          hourly_rate_rappen: number
          id: string
          teacher_id: string
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          hourly_rate_rappen: number
          id?: string
          teacher_id: string
          valid_from: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          hourly_rate_rappen?: number
          id?: string
          teacher_id?: string
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: []
      }
      trainer_exams: {
        Row: {
          created_at: string | null
          data: Json
          generated_by: string | null
          id: string
          subject: string
          text_lines: string[] | null
          title: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          data: Json
          generated_by?: string | null
          id: string
          subject: string
          text_lines?: string[] | null
          title: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          data?: Json
          generated_by?: string | null
          id?: string
          subject?: string
          text_lines?: string[] | null
          title?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      trainer_progress: {
        Row: {
          answers: Json | null
          completed_at: string | null
          exam_id: string
          id: string
          last_updated: string | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          exam_id: string
          id?: string
          last_updated?: string | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          exam_id?: string
          id?: string
          last_updated?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_progress_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "trainer_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_name: string
          earned_at: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          badge_name: string
          earned_at?: string | null
          id?: number
          user_id?: string | null
        }
        Update: {
          badge_name?: string
          earned_at?: string | null
          id?: number
          user_id?: string | null
        }
        Relationships: []
      }
      user_exercises: {
        Row: {
          created_at: string | null
          exercise_type: string | null
          id: string
          is_correct: boolean | null
          question: string | null
          question_id: number | null
          user_answer: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          exercise_type?: string | null
          id?: string
          is_correct?: boolean | null
          question?: string | null
          question_id?: number | null
          user_answer?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          exercise_type?: string | null
          id?: string
          is_correct?: boolean | null
          question?: string | null
          question_id?: number | null
          user_answer?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wake_up: {
        Row: {
          id: number
          message: string | null
          wake_up_call: string | null
        }
        Insert: {
          id?: number
          message?: string | null
          wake_up_call?: string | null
        }
        Update: {
          id?: number
          message?: string | null
          wake_up_call?: string | null
        }
        Relationships: []
      }
      work_entries: {
        Row: {
          activity_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          duration_minutes: number
          id: string
          note: string | null
          rejection_reason: string | null
          session_id: number | null
          status: string
          submission_id: string | null
          teacher_id: string
          updated_at: string
          version: number
          work_date: string
        }
        Insert: {
          activity_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          duration_minutes: number
          id?: string
          note?: string | null
          rejection_reason?: string | null
          session_id?: number | null
          status?: string
          submission_id?: string | null
          teacher_id: string
          updated_at?: string
          version?: number
          work_date: string
        }
        Update: {
          activity_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          note?: string | null
          rejection_reason?: string | null
          session_id?: number | null
          status?: string
          submission_id?: string | null
          teacher_id?: string
          updated_at?: string
          version?: number
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "student_essays"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      intensivwoche_kurse_mit_anmeldungen: {
        Row: {
          aktuelle_teilnehmer: number | null
          beschreibung: string | null
          created_at: string | null
          created_by: string | null
          detail_beschreibung: string | null
          end_datum: string | null
          fach: string | null
          highlights: string[] | null
          id: number | null
          ist_aktiv: boolean | null
          klassenstufen: string[] | null
          lehrer: string | null
          max_teilnehmer: number | null
          name: string | null
          ort: string | null
          preis: number | null
          start_datum: string | null
          status: string | null
          uhrzeit: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_mentorship_request: {
        Args: { request_id: string }
        Returns: string
      }
      admin_close_payroll_period: {
        Args: { p_month: number; p_year: number }
        Returns: string
      }
      admin_save_daily_release: {
        Args: {
          p_closes_at?: string
          p_course_day_id: string
          p_items?: Json
          p_opens_at?: string
          p_status: string
        }
        Returns: string
      }
      admin_save_rate_agreement: {
        Args: {
          p_hourly_rate_rappen: number
          p_teacher_id: string
          p_valid_from: string
        }
        Returns: string
      }
      admin_upsert_course_session: {
        Args: {
          p_beschreibung: string
          p_delivery_modes?: string[]
          p_edition_id: string
          p_end_datum: string
          p_fach: string
          p_kurs_id?: number
          p_lehrer: string
          p_max_teilnehmer: number
          p_name: string
          p_ort: string
          p_registration_status?: string
          p_start_datum: string
          p_uhrzeit: string
        }
        Returns: number
      }
      book_intensivwoche_kurs: {
        Args: {
          p_child_class_level: string
          p_child_firstname: string
          p_child_gender: string
          p_child_lastname: string
          p_idempotency_key?: string
          p_kurs_id: number
          p_notes?: string
          p_parent_email: string
          p_parent_phone: string
        }
        Returns: string
      }
      count_active_anmeldungen: { Args: { p_kurs_id: number }; Returns: number }
      get_upcoming_courses: { Args: never; Returns: Json[] }
      increment_material_view_count: {
        Args: { material_id: number }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_content_manager: { Args: never; Returns: boolean }
      is_kurs_aktiv: { Args: { p_kurs_id: number }; Returns: boolean }
      is_kurs_owner: { Args: { kurs_created_by: string }; Returns: boolean }
      is_owner: { Args: { record_user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// ============================================================
// Convenience Types fuer die App
// ============================================================

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"]
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]

export type UserRole = "user" | "lehrperson" | "admin"
export type Gender = "male" | "female" | "other" | "prefer_not_to_say"
