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
      admin_logs: {
        Row: {
          action: string
          created_at: string | null
          data: Json | null
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          data?: Json | null
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          data?: Json | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          performed_by?: string | null
        }
        Relationships: []
      }
      assignments: {
        Row: {
          course_id: string | null
          created_at: string | null
          description: string | null
          due_days: number | null
          id: string
          instructions: string | null
          mentor_id: string | null
          name: string
          submission_type: string | null
          updated_at: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          due_days?: number | null
          id?: string
          instructions?: string | null
          mentor_id?: string | null
          name: string
          submission_type?: string | null
          updated_at?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          due_days?: number | null
          id?: string
          instructions?: string | null
          mentor_id?: string | null
          name?: string
          submission_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      available_lessons: {
        Row: {
          assignment_id: string | null
          description: string | null
          drip_days: number | null
          duration_min: number | null
          id: string
          last_assignment_completed: string | null
          module: string | null
          notes: string | null
          recording_title: string | null
          recording_url: string | null
          sequence_order: number | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          assignment_id?: string | null
          description?: string | null
          drip_days?: number | null
          duration_min?: number | null
          id?: string
          last_assignment_completed?: string | null
          module?: string | null
          notes?: string | null
          recording_title?: string | null
          recording_url?: string | null
          sequence_order?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          assignment_id?: string | null
          description?: string | null
          drip_days?: number | null
          duration_min?: number | null
          id?: string
          last_assignment_completed?: string | null
          module?: string | null
          notes?: string | null
          recording_title?: string | null
          recording_url?: string | null
          sequence_order?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_available_lessons_assignment"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recordings_module_fkey"
            columns: ["module"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          description: string | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      batch_courses: {
        Row: {
          batch_id: string
          course_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          batch_id: string
          course_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          batch_id?: string
          course_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_courses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_pathways: {
        Row: {
          batch_id: string
          created_at: string | null
          id: string
          pathway_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          id?: string
          pathway_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          id?: string
          pathway_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_pathways_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_pathways_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "learning_pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_timeline_items: {
        Row: {
          assignment_id: string | null
          batch_id: string
          course_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          drip_offset_days: number
          end_datetime: string | null
          id: string
          meeting_link: string | null
          notification_sent_at: string | null
          recording_id: string | null
          recording_url: string | null
          reminder_1h_sent_at: string | null
          reminder_24h_sent_at: string | null
          reminder_start_sent_at: string | null
          sequence_order: number
          session_status: string | null
          start_datetime: string | null
          title: string
          type: string
          updated_at: string | null
          zoom_password: string | null
          zoom_username: string | null
        }
        Insert: {
          assignment_id?: string | null
          batch_id: string
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drip_offset_days?: number
          end_datetime?: string | null
          id?: string
          meeting_link?: string | null
          notification_sent_at?: string | null
          recording_id?: string | null
          recording_url?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_start_sent_at?: string | null
          sequence_order?: number
          session_status?: string | null
          start_datetime?: string | null
          title: string
          type: string
          updated_at?: string | null
          zoom_password?: string | null
          zoom_username?: string | null
        }
        Update: {
          assignment_id?: string | null
          batch_id?: string
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drip_offset_days?: number
          end_datetime?: string | null
          id?: string
          meeting_link?: string | null
          notification_sent_at?: string | null
          recording_id?: string | null
          recording_url?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_start_sent_at?: string | null
          sequence_order?: number
          session_status?: string | null
          start_datetime?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          zoom_password?: string | null
          zoom_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_timeline_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_timeline_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_timeline_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_timeline_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_timeline_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_timeline_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_timeline_items_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "available_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          course_id: string | null
          created_at: string | null
          created_by: string | null
          default_session_time: string | null
          facebook_community_link: string | null
          id: string
          name: string
          pathway_id: string | null
          start_date: string
          status: string | null
          timezone: string | null
          updated_at: string | null
          whatsapp_group_link: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          default_session_time?: string | null
          facebook_community_link?: string | null
          id?: string
          name: string
          pathway_id?: string | null
          start_date: string
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          whatsapp_group_link?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          default_session_time?: string | null
          facebook_community_link?: string | null
          id?: string
          name?: string
          pathway_id?: string | null
          start_date?: string
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          whatsapp_group_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "learning_pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_courses: {
        Row: {
          bundle_id: string
          course_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          bundle_id: string
          course_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          bundle_id?: string
          course_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_courses_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string
          announcement_banner: Json | null
          branding: Json | null
          company_email: string | null
          company_logo: string | null
          company_name: string
          contact_email: string
          created_at: string | null
          currency: string
          custom_domain: string | null
          drip_enabled_default: boolean | null
          enable_student_signin: boolean | null
          id: number
          installment_plans: string[] | null
          invoice_notes: string | null
          invoice_overdue_days: number
          invoice_send_gap_days: number
          livechat_code: string | null
          lms_sequential_unlock: boolean | null
          lms_url: string | null
          maximum_installment_count: number
          multi_course_enabled: boolean | null
          onboarding_video_url: string | null
          original_fee_amount: number
          overdue_penalty_amount: number | null
          overdue_penalty_type: string | null
          payment_methods: Json | null
          primary_phone: string
          questionnaire: Json | null
          secondary_phone: string | null
          suspension_notice_note: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string
          announcement_banner?: Json | null
          branding?: Json | null
          company_email?: string | null
          company_logo?: string | null
          company_name?: string
          contact_email?: string
          created_at?: string | null
          currency?: string
          custom_domain?: string | null
          drip_enabled_default?: boolean | null
          enable_student_signin?: boolean | null
          id?: number
          installment_plans?: string[] | null
          invoice_notes?: string | null
          invoice_overdue_days?: number
          invoice_send_gap_days?: number
          livechat_code?: string | null
          lms_sequential_unlock?: boolean | null
          lms_url?: string | null
          maximum_installment_count?: number
          multi_course_enabled?: boolean | null
          onboarding_video_url?: string | null
          original_fee_amount?: number
          overdue_penalty_amount?: number | null
          overdue_penalty_type?: string | null
          payment_methods?: Json | null
          primary_phone?: string
          questionnaire?: Json | null
          secondary_phone?: string | null
          suspension_notice_note?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          announcement_banner?: Json | null
          branding?: Json | null
          company_email?: string | null
          company_logo?: string | null
          company_name?: string
          contact_email?: string
          created_at?: string | null
          currency?: string
          custom_domain?: string | null
          drip_enabled_default?: boolean | null
          enable_student_signin?: boolean | null
          id?: number
          installment_plans?: string[] | null
          invoice_notes?: string | null
          invoice_overdue_days?: number
          invoice_send_gap_days?: number
          livechat_code?: string | null
          lms_sequential_unlock?: boolean | null
          lms_url?: string | null
          maximum_installment_count?: number
          multi_course_enabled?: boolean | null
          onboarding_video_url?: string | null
          original_fee_amount?: number
          overdue_penalty_amount?: number | null
          overdue_penalty_type?: string | null
          payment_methods?: Json | null
          primary_phone?: string
          questionnaire?: Json | null
          secondary_phone?: string | null
          suspension_notice_note?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      course_bundles: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          is_published: boolean | null
          name: string
          price: number
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          name: string
          price: number
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          name?: string
          price?: number
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_bundles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_bundles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_bundles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          access_expires_at: string | null
          amount_paid: number | null
          batch_id: string | null
          completed_at: string | null
          course_id: string
          created_at: string | null
          discount_amount: number | null
          discount_percentage: number | null
          drip_enabled: boolean | null
          drip_override: boolean | null
          enrolled_at: string | null
          enrollment_source: string
          id: string
          pathway_id: string | null
          payment_status: string | null
          progress_percentage: number | null
          sequential_enabled: boolean | null
          sequential_override: boolean | null
          status: string | null
          student_id: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          access_expires_at?: string | null
          amount_paid?: number | null
          batch_id?: string | null
          completed_at?: string | null
          course_id: string
          created_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          drip_enabled?: boolean | null
          drip_override?: boolean | null
          enrolled_at?: string | null
          enrollment_source?: string
          id?: string
          pathway_id?: string | null
          payment_status?: string | null
          progress_percentage?: number | null
          sequential_enabled?: boolean | null
          sequential_override?: boolean | null
          status?: string | null
          student_id: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          access_expires_at?: string | null
          amount_paid?: number | null
          batch_id?: string | null
          completed_at?: string | null
          course_id?: string
          created_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          drip_enabled?: boolean | null
          drip_override?: boolean | null
          enrolled_at?: string | null
          enrollment_source?: string
          id?: string
          pathway_id?: string | null
          payment_status?: string | null
          progress_percentage?: number | null
          sequential_enabled?: boolean | null
          sequential_override?: boolean | null
          status?: string | null
          student_id?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "learning_pathways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      course_tracks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          access_duration_days: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          drip_enabled: boolean | null
          id: string
          is_active: boolean | null
          is_published: boolean | null
          max_installments: number | null
          price: number | null
          sequence_order: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          access_duration_days?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          drip_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          max_installments?: number | null
          price?: number | null
          sequence_order?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          access_duration_days?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          drip_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          max_installments?: number | null
          price?: number | null
          sequence_order?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          created_at: string | null
          credentials: Json
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string
          retry_count: number | null
          sent_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials: Json
          email_type: string
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          created_at: string
          error_code: string | null
          error_details: Json | null
          error_message: string
          error_type: string
          id: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          stack_trace: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_details?: Json | null
          error_message: string
          error_type: string
          id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          stack_trace?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_details?: Json | null
          error_message?: string
          error_type?: string
          id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          stack_trace?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      installment_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          payment_date: string
          payment_method: string | null
          status: string
          student_id: string | null
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_date?: string
          payment_method?: string | null
          status?: string
          student_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_date?: string
          payment_method?: string | null
          status?: string
          student_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_plans: {
        Row: {
          created_at: string | null
          id: string
          interval_days: number
          is_active: boolean | null
          name: string
          num_installments: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interval_days: number
          is_active?: boolean | null
          name: string
          num_installments: number
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interval_days?: number
          is_active?: boolean | null
          name?: string
          num_installments?: number
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token: string
          connected_at: string
          external_id: string | null
          id: number
          refresh_token: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          external_id?: string | null
          id?: number
          refresh_token?: string | null
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          external_id?: string | null
          id?: number
          refresh_token?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          course_id: string | null
          created_at: string | null
          due_date: string
          enrollment_details: Json | null
          extended_due_date: string | null
          first_reminder_sent: boolean | null
          first_reminder_sent_at: string | null
          id: string
          installment_number: number
          issue_date: string | null
          notes: string | null
          paid_at: string | null
          pathway_id: string | null
          payment_method: string | null
          second_reminder_sent: boolean | null
          second_reminder_sent_at: string | null
          status: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          course_id?: string | null
          created_at?: string | null
          due_date: string
          enrollment_details?: Json | null
          extended_due_date?: string | null
          first_reminder_sent?: boolean | null
          first_reminder_sent_at?: string | null
          id?: string
          installment_number: number
          issue_date?: string | null
          notes?: string | null
          paid_at?: string | null
          pathway_id?: string | null
          payment_method?: string | null
          second_reminder_sent?: boolean | null
          second_reminder_sent_at?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          course_id?: string | null
          created_at?: string | null
          due_date?: string
          enrollment_details?: Json | null
          extended_due_date?: string | null
          first_reminder_sent?: boolean | null
          first_reminder_sent_at?: string | null
          id?: string
          installment_number?: number
          issue_date?: string | null
          notes?: string | null
          paid_at?: string | null
          pathway_id?: string | null
          payment_method?: string | null
          second_reminder_sent?: boolean | null
          second_reminder_sent_at?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "learning_pathways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_snapshots: {
        Row: {
          assignments_completed: number
          avatar_initials: string
          calculated_at: string
          created_at: string
          display_name: string
          has_meta: boolean
          has_shopify: boolean
          id: string
          milestones_completed: number
          progress: number
          rank: number
          score: number
          sessions_attended: number
          streak: number
          updated_at: string
          user_id: string
          videos_watched: number
        }
        Insert: {
          assignments_completed?: number
          avatar_initials: string
          calculated_at?: string
          created_at?: string
          display_name: string
          has_meta?: boolean
          has_shopify?: boolean
          id?: string
          milestones_completed?: number
          progress?: number
          rank?: number
          score?: number
          sessions_attended?: number
          streak?: number
          updated_at?: string
          user_id: string
          videos_watched?: number
        }
        Update: {
          assignments_completed?: number
          avatar_initials?: string
          calculated_at?: string
          created_at?: string
          display_name?: string
          has_meta?: boolean
          has_shopify?: boolean
          id?: string
          milestones_completed?: number
          progress?: number
          rank?: number
          score?: number
          sessions_attended?: number
          streak?: number
          updated_at?: string
          user_id?: string
          videos_watched?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_pathways: {
        Row: {
          access_duration_days: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          drip_enabled: boolean | null
          id: string
          is_active: boolean | null
          is_published: boolean | null
          max_installments: number | null
          name: string
          price: number | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          access_duration_days?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          drip_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          max_installments?: number | null
          name: string
          price?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          access_duration_days?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          drip_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          max_installments?: number | null
          name?: string
          price?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_pathways_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_pathways_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_pathways_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_course_assignments: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string
          is_global: boolean | null
          is_primary: boolean | null
          mentor_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          is_global?: boolean | null
          is_primary?: boolean | null
          mentor_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          is_global?: boolean | null
          is_primary?: boolean | null
          mentor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_course_assignments_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_course_assignments_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_course_assignments_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          context: Json | null
          created_at: string
          id: string
          replied_at: string | null
          response_id: string | null
          sent_at: string
          status: string
          template_name: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          context?: Json | null
          created_at?: string
          id?: string
          replied_at?: string | null
          response_id?: string | null
          sent_at?: string
          status?: string
          template_name?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          context?: Json | null
          created_at?: string
          id?: string
          replied_at?: string | null
          response_id?: string | null
          sent_at?: string
          status?: string
          template_name?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      milestone_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      milestones: {
        Row: {
          badge_url: string | null
          category_id: string | null
          celebration_config: Json | null
          celebration_message: string | null
          created_at: string | null
          description: string
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          points: number | null
          show_celebration: boolean | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          badge_url?: string | null
          category_id?: string | null
          celebration_config?: Json | null
          celebration_message?: string | null
          created_at?: string | null
          description: string
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          points?: number | null
          show_celebration?: boolean | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          badge_url?: string | null
          category_id?: string | null
          celebration_config?: Json | null
          celebration_message?: string | null
          created_at?: string | null
          description?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          points?: number | null
          show_celebration?: boolean | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "milestone_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string | null
          description: string | null
          id: string
          order: number | null
          title: string
        }
        Insert: {
          course_id?: string | null
          description?: string | null
          id?: string
          order?: number | null
          title: string
        }
        Update: {
          course_id?: string | null
          description?: string | null
          id?: string
          order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          id: string
          mutes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mutes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mutes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          active: boolean
          body_md: string
          created_at: string
          id: string
          key: string
          title_md: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          active?: boolean
          body_md: string
          created_at?: string
          id?: string
          key: string
          title_md: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          active?: boolean
          body_md?: string
          created_at?: string
          id?: string
          key?: string
          title_md?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          dismissed_at: string | null
          id: string
          payload: Json
          payload_hash: string | null
          read_at: string | null
          sent_at: string
          status: string
          template_key: string | null
          type: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          payload?: Json
          payload_hash?: string | null
          read_at?: string | null
          sent_at?: string
          status?: string
          template_key?: string | null
          type: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          payload?: Json
          payload_hash?: string | null
          read_at?: string | null
          sent_at?: string
          status?: string
          template_key?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_responses: {
        Row: {
          answer: string | null
          answer_type: string
          created_at: string
          id: string
          question_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answer_type: string
          created_at?: string
          id?: string
          question_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answer_type?: string
          created_at?: string
          id?: string
          question_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pathway_choice_selections: {
        Row: {
          choice_group: number
          created_at: string
          id: string
          pathway_id: string
          selected_course_id: string
          student_id: string
        }
        Insert: {
          choice_group: number
          created_at?: string
          id?: string
          pathway_id: string
          selected_course_id: string
          student_id: string
        }
        Update: {
          choice_group?: number
          created_at?: string
          id?: string
          pathway_id?: string
          selected_course_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathway_choice_selections_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "learning_pathways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathway_choice_selections_selected_course_id_fkey"
            columns: ["selected_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathway_choice_selections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      pathway_courses: {
        Row: {
          choice_group: number | null
          course_id: string
          created_at: string | null
          id: string
          is_choice_point: boolean | null
          is_mandatory: boolean | null
          pathway_id: string
          step_number: number
        }
        Insert: {
          choice_group?: number | null
          course_id: string
          created_at?: string | null
          id?: string
          is_choice_point?: boolean | null
          is_mandatory?: boolean | null
          pathway_id: string
          step_number: number
        }
        Update: {
          choice_group?: number | null
          course_id?: string
          created_at?: string | null
          id?: string
          is_choice_point?: boolean | null
          is_mandatory?: boolean | null
          pathway_id?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "pathway_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathway_courses_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "learning_pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_attachments: {
        Row: {
          file_name: string
          file_url: string
          id: string
          recording_id: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_url: string
          id?: string
          recording_id: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_url?: string
          id?: string
          recording_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_attachments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "available_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_ratings: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          lesson_title: string | null
          rating: number
          recording_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          lesson_title?: string | null
          rating: number
          recording_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          lesson_title?: string | null
          rating?: number
          recording_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_ratings_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "available_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_ratings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_ratings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_ratings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_views: {
        Row: {
          created_at: string
          id: string
          recording_id: string
          updated_at: string
          user_id: string
          watched: boolean
          watched_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          recording_id: string
          updated_at?: string
          user_id: string
          watched?: boolean
          watched_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          recording_id?: string
          updated_at?: string
          user_id?: string
          watched?: boolean
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_views_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "available_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_suspensions: {
        Row: {
          auto_unsuspend_date: string | null
          cancelled_at: string | null
          created_at: string | null
          created_by: string | null
          executed_at: string | null
          id: string
          reason: string | null
          schedule_suspend_date: string
          status: string
          user_id: string
        }
        Insert: {
          auto_unsuspend_date?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          created_by?: string | null
          executed_at?: string | null
          id?: string
          reason?: string | null
          schedule_suspend_date: string
          status?: string
          user_id: string
        }
        Update: {
          auto_unsuspend_date?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          created_by?: string | null
          executed_at?: string | null
          id?: string
          reason?: string | null
          schedule_suspend_date?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      session_attendance: {
        Row: {
          attended_at: string | null
          created_at: string | null
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          attended_at?: string | null
          created_at?: string | null
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          attended_at?: string | null
          created_at?: string | null
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "success_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_recovery_checks: {
        Row: {
          check_completed_at: string | null
          check_date: string
          created_at: string | null
          id: string
          newly_inactive: number | null
          recovered: number | null
          still_inactive: number | null
          students_checked: number | null
        }
        Insert: {
          check_completed_at?: string | null
          check_date?: string
          created_at?: string | null
          id?: string
          newly_inactive?: number | null
          recovered?: number | null
          still_inactive?: number | null
          students_checked?: number | null
        }
        Update: {
          check_completed_at?: string | null
          check_date?: string
          created_at?: string | null
          id?: string
          newly_inactive?: number | null
          recovered?: number | null
          still_inactive?: number | null
          students_checked?: number | null
        }
        Relationships: []
      }
      student_recovery_messages: {
        Row: {
          created_at: string
          days_inactive: number
          id: string
          last_check_date: string | null
          last_login_check: string | null
          message_content: string | null
          message_sent_at: string
          message_status: string | null
          message_type: string
          recovered_at: string | null
          recovery_cycle: number | null
          recovery_successful: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_inactive: number
          id?: string
          last_check_date?: string | null
          last_login_check?: string | null
          message_content?: string | null
          message_sent_at?: string
          message_status?: string | null
          message_type?: string
          recovered_at?: string | null
          recovery_cycle?: number | null
          recovery_successful?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_inactive?: number
          id?: string
          last_check_date?: string | null
          last_login_check?: string | null
          message_content?: string | null
          message_sent_at?: string
          message_status?: string | null
          message_type?: string
          recovered_at?: string | null
          recovery_cycle?: number | null
          recovery_successful?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          answers_json: Json | null
          created_at: string | null
          discount_amount: number | null
          discount_percentage: number | null
          enrollment_date: string | null
          fees_cleared: boolean | null
          final_fee_amount: number | null
          goal_brief: string | null
          id: string
          installment_count: number | null
          installment_plan_id: string | null
          lms_username: string
          onboarding_completed: boolean | null
          onboarding_video_watched: boolean | null
          student_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          answers_json?: Json | null
          created_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          enrollment_date?: string | null
          fees_cleared?: boolean | null
          final_fee_amount?: number | null
          goal_brief?: string | null
          id?: string
          installment_count?: number | null
          installment_plan_id?: string | null
          lms_username: string
          onboarding_completed?: boolean | null
          onboarding_video_watched?: boolean | null
          student_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          answers_json?: Json | null
          created_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          enrollment_date?: string | null
          fees_cleared?: boolean | null
          final_fee_amount?: number | null
          goal_brief?: string | null
          id?: string
          installment_count?: number | null
          installment_plan_id?: string | null
          lms_username?: string
          onboarding_completed?: boolean | null
          onboarding_video_watched?: boolean | null
          student_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_installment_plan_id_fkey"
            columns: ["installment_plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string | null
          created_at: string
          file_url: string | null
          file_urls: Json | null
          id: string
          links: Json | null
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          submitted_at: string
          updated_at: string
          version: number | null
        }
        Insert: {
          assignment_id: string
          content?: string | null
          created_at?: string
          file_url?: string | null
          file_urls?: Json | null
          id?: string
          links?: Json | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          submitted_at?: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          assignment_id?: string
          content?: string | null
          created_at?: string
          file_url?: string | null
          file_urls?: Json | null
          id?: string
          links?: Json | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          submitted_at?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      success_partner_credits: {
        Row: {
          created_at: string | null
          credits_used: number
          daily_limit: number
          date: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credits_used?: number
          daily_limit?: number
          date?: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credits_used?: number
          daily_limit?: number
          date?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      success_partner_messages: {
        Row: {
          content: string
          created_at: string
          date: string
          id: string
          role: string
          timestamp: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          date?: string
          id?: string
          role: string
          timestamp?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          date?: string
          id?: string
          role?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      success_sessions: {
        Row: {
          batch_id: string | null
          batch_ids: Json | null
          course_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          drip_days: number | null
          end_time: string | null
          host_login_email: string | null
          host_login_pwd: string | null
          id: string
          link: string
          mentor_id: string | null
          mentor_name: string | null
          pathway_id: string | null
          schedule_date: string | null
          start_time: string
          status: string | null
          title: string
          zoom_meeting_id: string | null
          zoom_passcode: string | null
        }
        Insert: {
          batch_id?: string | null
          batch_ids?: Json | null
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drip_days?: number | null
          end_time?: string | null
          host_login_email?: string | null
          host_login_pwd?: string | null
          id?: string
          link: string
          mentor_id?: string | null
          mentor_name?: string | null
          pathway_id?: string | null
          schedule_date?: string | null
          start_time: string
          status?: string | null
          title: string
          zoom_meeting_id?: string | null
          zoom_passcode?: string | null
        }
        Update: {
          batch_id?: string | null
          batch_ids?: Json | null
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drip_days?: number | null
          end_time?: string | null
          host_login_email?: string | null
          host_login_pwd?: string | null
          id?: string
          link?: string
          mentor_id?: string | null
          mentor_name?: string | null
          pathway_id?: string | null
          schedule_date?: string | null
          start_time?: string
          status?: string | null
          title?: string
          zoom_meeting_id?: string | null
          zoom_passcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "success_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "success_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "success_sessions_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "learning_pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_internal: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          metadata: Json | null
          occurred_at: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          created_at: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          created_at?: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          created_at?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_metrics: {
        Row: {
          date: string
          fetched_at: string
          id: number
          metric: string
          source: string
          user_id: string
          value: number
        }
        Insert: {
          date: string
          fetched_at?: string
          id?: number
          metric: string
          source: string
          user_id: string
          value: number
        }
        Update: {
          date?: string
          fetched_at?: string
          id?: number
          metric?: string
          source?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_milestones: {
        Row: {
          awarded_by: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          milestone_id: string | null
          notes: string | null
          progress_data: Json | null
          user_id: string
        }
        Insert: {
          awarded_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          milestone_id?: string | null
          notes?: string | null
          progress_data?: Json | null
          user_id: string
        }
        Update: {
          awarded_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          milestone_id?: string | null
          notes?: string | null
          progress_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_milestones_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          module_id: string
          progress_percentage: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          module_id: string
          progress_percentage?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          module_id?: string
          progress_percentage?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_security_summary_backup: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          is_temp_password: boolean | null
          last_active_at: string | null
          last_login_at: string | null
          lms_status: string | null
          password_status: string | null
          phone_status: string | null
          role: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          is_temp_password?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          lms_status?: string | null
          password_status?: string | null
          phone_status?: string | null
          role?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          is_temp_password?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          lms_status?: string | null
          password_status?: string | null
          phone_status?: string | null
          role?: string | null
          status?: string | null
        }
        Relationships: []
      }
      user_unlocks: {
        Row: {
          created_at: string
          id: string
          is_unlocked: boolean
          recording_id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_unlocked?: boolean
          recording_id: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_unlocked?: boolean
          recording_id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unlocks_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "available_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          created_by: string | null
          dream_goal_summary: string | null
          email: string
          full_name: string
          id: string
          is_temp_password: boolean | null
          last_active_at: string | null
          last_login_at: string | null
          lms_status: string | null
          lms_user_id: string | null
          meta_ads_credentials: string | null
          original_password: string | null
          password_display: string
          password_hash: string
          phone: string | null
          role: string
          shopify_credentials: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dream_goal_summary?: string | null
          email: string
          full_name: string
          id?: string
          is_temp_password?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          lms_status?: string | null
          lms_user_id?: string | null
          meta_ads_credentials?: string | null
          original_password?: string | null
          password_display: string
          password_hash: string
          phone?: string | null
          role: string
          shopify_credentials?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dream_goal_summary?: string | null
          email?: string
          full_name?: string
          id?: string
          is_temp_password?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          lms_status?: string | null
          lms_user_id?: string | null
          meta_ads_credentials?: string | null
          original_password?: string | null
          password_display?: string
          password_hash?: string
          phone?: string | null
          role?: string
          shopify_credentials?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_security_summary: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          lms_status: string | null
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          lms_status?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          lms_status?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users_safe_view: {
        Row: {
          created_at: string | null
          created_by: string | null
          dream_goal_summary: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_temp_password: boolean | null
          last_active_at: string | null
          last_login_at: string | null
          lms_status: string | null
          lms_user_id: string | null
          phone: string | null
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dream_goal_summary?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_temp_password?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          lms_status?: string | null
          lms_user_id?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dream_goal_summary?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_temp_password?: boolean | null
          last_active_at?: string | null
          last_login_at?: string | null
          lms_status?: string | null
          lms_user_id?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_security_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      advance_pathway: {
        Args: {
          p_pathway_id: string
          p_selected_course_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      can_view_sensitive_user_data: { Args: never; Returns: boolean }
      check_and_award_milestone: {
        Args: { p_context?: Json; p_milestone_type: string; p_user_id: string }
        Returns: boolean
      }
      create_notification: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_recovery_record: {
        Args: {
          p_days_inactive: number
          p_recovery_cycle?: number
          p_user_id: string
        }
        Returns: string
      }
      create_student_complete:
        | {
            Args: {
              p_address?: string
              p_email: string
              p_full_name: string
              p_mentor_id?: string
              p_password: string
              p_phone?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_address?: string
              p_batch_id?: string
              p_email: string
              p_full_name: string
              p_mentor_id?: string
              p_password: string
              p_phone?: string
              p_pod_id?: string
            }
            Returns: Json
          }
      create_user_with_role: {
        Args: {
          target_email: string
          target_full_name?: string
          target_metadata?: Json
          target_password: string
          target_role: string
        }
        Returns: Json
      }
      current_user_is_mentor: { Args: never; Returns: boolean }
      enroll_student_in_course: {
        Args: {
          p_course_id: string
          p_pathway_id?: string
          p_student_id: string
        }
        Returns: Json
      }
      get_batch_timeline_status: {
        Args: { p_batch_id: string; p_user_id: string }
        Returns: {
          assignment_id: string
          assignment_required: boolean
          assignment_status: string
          deployed_date: string
          description: string
          drip_offset_days: number
          duration_min: number
          end_datetime: string
          is_deployed: boolean
          is_unlocked: boolean
          item_id: string
          item_type: string
          meeting_link: string
          recording_id: string
          recording_url: string
          recording_watched: boolean
          sequence_order: number
          session_recording_url: string
          session_state: string
          session_status: string
          start_datetime: string
          title: string
          unlock_reason: string
        }[]
      }
      get_catalog_courses: {
        Args: { p_user_id?: string }
        Returns: {
          course_id: string
          currency: string
          description: string
          enrollment_status: string
          is_enrolled: boolean
          module_count: number
          price: number
          recording_count: number
          thumbnail_url: string
          title: string
        }[]
      }
      get_course_modules: {
        Args: { p_course_id: string }
        Returns: {
          assignment_count: number
          module_description: string
          module_id: string
          module_order: number
          module_title: string
          recording_count: number
        }[]
      }
      get_course_sequential_unlock_status: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: {
          drip_unlock_date: string
          is_unlocked: boolean
          lock_reason: string
          recording_id: string
          recording_title: string
          sequence_position: number
          unlock_reason: string
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_default_course_id: { Args: never; Returns: string }
      get_inactive_students: {
        Args: { days_threshold?: number }
        Returns: {
          days_inactive: number
          email: string
          full_name: string
          last_active_at: string
          phone: string
          user_id: string
        }[]
      }
      get_mentor_courses: {
        Args: { p_mentor_id: string }
        Returns: {
          course_id: string
          course_title: string
          is_global: boolean
          is_primary: boolean
          student_count: number
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_pathway_next_options: {
        Args: {
          p_current_step: number
          p_pathway_id: string
          p_user_id: string
        }
        Returns: {
          choice_group: number
          course_description: string
          course_id: string
          course_title: string
          is_choice_point: boolean
          is_mandatory: boolean
          step_number: number
        }[]
      }
      get_recovery_statistics: {
        Args: never
        Returns: {
          failed_recoveries: number
          pending_recoveries: number
          recovery_rate: number
          successful_recoveries: number
          total_messages_sent: number
        }[]
      }
      get_sequential_unlock_status: {
        Args: { p_user_id: string }
        Returns: {
          assignment_completed: boolean
          assignment_required: boolean
          drip_locked: boolean
          drip_unlock_date: string
          is_unlocked: boolean
          recording_id: string
          recording_watched: boolean
          sequence_order: number
          unlock_reason: string
        }[]
      }
      get_student_active_pathway: {
        Args: { p_user_id: string }
        Returns: {
          choice_group: number
          current_course_id: string
          current_course_title: string
          current_step_number: number
          has_pending_choice: boolean
          pathway_id: string
          pathway_name: string
          total_steps: number
        }[]
      }
      get_student_courses: {
        Args: { p_user_id: string }
        Returns: {
          completed_at: string
          course_description: string
          course_id: string
          course_title: string
          enrolled_at: string
          enrollment_status: string
          is_pathway: boolean
          pathway_id: string
          pathway_name: string
          progress_percentage: number
          thumbnail_url: string
        }[]
      }
      get_student_pathway_course_map: {
        Args: { p_pathway_id: string; p_user_id: string }
        Returns: {
          choice_group: number
          choice_options: Json
          course_id: string
          course_title: string
          is_available: boolean
          is_choice_point: boolean
          is_completed: boolean
          is_current: boolean
          is_selected_choice: boolean
          requires_choice: boolean
          step_number: number
        }[]
      }
      get_student_unlock_sequence: {
        Args: { p_user_id: string }
        Returns: {
          assignment_completed: boolean
          assignment_id: string
          is_unlocked: boolean
          is_watched: boolean
          module_id: string
          module_title: string
          recording_id: string
          recording_title: string
          sequence_order: number
          unlock_reason: string
        }[]
      }
      get_team_member_password: { Args: { member_id: string }; Returns: string }
      get_tracked_inactive_students: {
        Args: never
        Returns: {
          days_inactive: number
          email: string
          full_name: string
          last_check_date: string
          message_sent_at: string
          message_status: string
          phone: string
          recovery_cycle: number
          recovery_message_id: string
          user_id: string
        }[]
      }
      get_user_lms_status: { Args: { user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_unlock_status: {
        Args: { _user_id: string }
        Returns: {
          is_module_unlocked: boolean
          is_recording_unlocked: boolean
          module_id: string
          recording_id: string
        }[]
      }
      get_user_unlock_status_v2: {
        Args: { p_course_id?: string; p_user_id: string }
        Returns: {
          assignment_completed: boolean
          assignment_id: string
          is_unlocked: boolean
          module_id: string
          module_title: string
          recording_id: string
          recording_title: string
          sequence_order: number
          unlock_reason: string
          watched: boolean
        }[]
      }
      get_users_by_role: { Args: { role_code: string }; Returns: string[] }
      has_any_role: { Args: { role_codes: string[] }; Returns: boolean }
      has_completed_all_modules: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_course_access: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_student_logged_in_since: {
        Args: { p_since_date: string; p_user_id: string }
        Returns: boolean
      }
      initialize_first_recording_unlock: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      initialize_student_unlocks: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      interpolate_template: { Args: { t: string; vars: Json }; Returns: string }
      is_assignment_passed: {
        Args: { _assignment_id: string; _user_id: string }
        Returns: boolean
      }
      is_course_fully_completed: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: boolean
      }
      is_mentor_student: {
        Args: { _mentor_id: string; _student_user_id: string }
        Returns: boolean
      }
      is_module_completed: {
        Args: { _module_id: string; _user_id: string }
        Returns: boolean
      }
      is_multi_course_enabled: { Args: never; Returns: boolean }
      is_recording_watched: {
        Args: { _recording_id: string; _user_id: string }
        Returns: boolean
      }
      log_data_access_attempt: {
        Args: {
          operation: string
          table_name: string
          target_user_id?: string
          user_role: string
        }
        Returns: undefined
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_recovery_successful: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      mark_student_recovered: {
        Args: { p_recovery_message_id: string }
        Returns: undefined
      }
      notify_all_students: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
        }
        Returns: number
      }
      notify_mentor_students: {
        Args: {
          p_mentor_id: string
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
        }
        Returns: number
      }
      notify_roles: {
        Args: { payload: Json; role_codes: string[]; template_key: string }
        Returns: string[]
      }
      notify_users: {
        Args: { payload: Json; template_key: string; user_ids: string[] }
        Returns: string[]
      }
      record_recovery_message: {
        Args: {
          p_days_inactive?: number
          p_message_content?: string
          p_message_type?: string
          p_user_id: string
        }
        Returns: string
      }
      send_test_notification: {
        Args: { payload: Json; template_key: string }
        Returns: string[]
      }
      sync_all_users_unlock_progress: { Args: never; Returns: string }
      sync_user_unlock_progress: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      unlock_next_recording: {
        Args: { p_current_recording_id: string; p_user_id: string }
        Returns: undefined
      }
      update_company_branding: { Args: { branding_data: Json }; Returns: Json }
      update_course_progress: {
        Args: { p_course_id: string; p_student_id: string }
        Returns: undefined
      }
      validate_questionnaire_structure: {
        Args: { questionnaire_data: Json }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "superadmin"
        | "admin"
        | "enrollment_manager"
        | "mentor"
        | "student"
        | "support_member"
      assignment_submission_status:
        | "submitted"
        | "under_review"
        | "accepted"
        | "rejected"
        | "resubmit"
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
        "superadmin",
        "admin",
        "enrollment_manager",
        "mentor",
        "student",
        "support_member",
      ],
      assignment_submission_status: [
        "submitted",
        "under_review",
        "accepted",
        "rejected",
        "resubmit",
      ],
    },
  },
} as const
