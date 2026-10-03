/**
 * Supabase Database Types Foundation (Phase 3 Academic Master Data)
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'teacher' | 'student' | 'parent';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone_number: string | null;
          role: UserRole;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email?: string | null;
          phone_number?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          phone_number?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      academic_years: {
        Row: {
          id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      boards: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      class_levels: {
        Row: {
          id: string;
          class_number: number;
          display_name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_number: number;
          display_name: string;
          sort_order: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          class_number?: number;
          display_name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      streams: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      board_classes: {
        Row: {
          id: string;
          board_id: string;
          class_level_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          class_level_id: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          board_id?: string;
          class_level_id?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "board_classes_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "board_classes_class_level_id_fkey";
            columns: ["class_level_id"];
            isOneToOne: false;
            referencedRelation: "class_levels";
            referencedColumns: ["id"];
          }
        ];
      };
      batches: {
        Row: {
          id: string;
          academic_year_id: string;
          board_class_id: string;
          stream_id: string | null;
          name: string;
          code: string | null;
          max_capacity: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academic_year_id: string;
          board_class_id: string;
          stream_id?: string | null;
          name: string;
          code?: string | null;
          max_capacity?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academic_year_id?: string;
          board_class_id?: string;
          stream_id?: string | null;
          name?: string;
          code?: string | null;
          max_capacity?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "batches_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batches_board_class_id_fkey";
            columns: ["board_class_id"];
            isOneToOne: false;
            referencedRelation: "board_classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batches_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          }
        ];
      };
      subjects: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      board_class_subjects: {
        Row: {
          id: string;
          board_class_id: string;
          subject_id: string;
          stream_id: string | null;
          is_core: boolean;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board_class_id: string;
          subject_id: string;
          stream_id?: string | null;
          is_core?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          board_class_id?: string;
          subject_id?: string;
          stream_id?: string | null;
          is_core?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "board_class_subjects_board_class_id_fkey";
            columns: ["board_class_id"];
            isOneToOne: false;
            referencedRelation: "board_classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "board_class_subjects_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "board_class_subjects_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          }
        ];
      };
      students: {
        Row: {
          id: string;
          profile_id: string;
          admission_number: string;
          date_of_birth: string | null;
          gender: 'male' | 'female' | 'other' | null;
          guardian_name: string | null;
          guardian_phone: string | null;
          guardian_relation: string | null;
          emergency_contact: string | null;
          address: string | null;
          status: 'active' | 'inactive' | 'transferred' | 'completed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          admission_number: string;
          date_of_birth?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          guardian_relation?: string | null;
          emergency_contact?: string | null;
          address?: string | null;
          status?: 'active' | 'inactive' | 'transferred' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          admission_number?: string;
          date_of_birth?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          guardian_relation?: string | null;
          emergency_contact?: string | null;
          address?: string | null;
          status?: 'active' | 'inactive' | 'transferred' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      teachers: {
        Row: {
          id: string;
          profile_id: string;
          employee_code: string;
          joining_date: string | null;
          designation: string | null;
          qualification: string | null;
          specialization: string | null;
          status: 'active' | 'inactive' | 'left';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          employee_code: string;
          joining_date?: string | null;
          designation?: string | null;
          qualification?: string | null;
          specialization?: string | null;
          status?: 'active' | 'inactive' | 'left';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          employee_code?: string;
          joining_date?: string | null;
          designation?: string | null;
          qualification?: string | null;
          specialization?: string | null;
          status?: 'active' | 'inactive' | 'left';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teachers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      student_enrollments: {
        Row: {
          id: string;
          student_id: string;
          academic_year_id: string;
          board_class_id: string;
          stream_id: string | null;
          batch_id: string;
          roll_number: string | null;
          enrollment_date: string;
          status: 'enrolled' | 'promoted' | 'transferred' | 'dropped' | 'completed';
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          academic_year_id: string;
          board_class_id: string;
          stream_id?: string | null;
          batch_id: string;
          roll_number?: string | null;
          enrollment_date?: string;
          status?: 'enrolled' | 'promoted' | 'transferred' | 'dropped' | 'completed';
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          academic_year_id?: string;
          board_class_id?: string;
          stream_id?: string | null;
          batch_id?: string;
          roll_number?: string | null;
          enrollment_date?: string;
          status?: 'enrolled' | 'promoted' | 'transferred' | 'dropped' | 'completed';
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_board_class_id_fkey";
            columns: ["board_class_id"];
            isOneToOne: false;
            referencedRelation: "board_classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          }
        ];
      };
      teacher_assignments: {
        Row: {
          id: string;
          teacher_id: string;
          academic_year_id: string;
          batch_id: string;
          subject_id: string;
          role: 'primary_teacher' | 'assistant_teacher' | 'substitute';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          academic_year_id: string;
          batch_id: string;
          subject_id: string;
          role?: 'primary_teacher' | 'assistant_teacher' | 'substitute';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          academic_year_id?: string;
          batch_id?: string;
          subject_id?: string;
          role?: 'primary_teacher' | 'assistant_teacher' | 'substitute';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_assignments_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_assignments_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_assignments_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      attendance_sessions: {
        Row: {
          id: string;
          academic_year_id: string;
          batch_id: string;
          teacher_id: string;
          subject_id: string | null;
          attendance_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academic_year_id: string;
          batch_id: string;
          teacher_id: string;
          subject_id?: string | null;
          attendance_date: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academic_year_id?: string;
          batch_id?: string;
          teacher_id?: string;
          subject_id?: string | null;
          attendance_date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_sessions_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_sessions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_sessions_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      attendance_records: {
        Row: {
          id: string;
          attendance_session_id: string;
          enrollment_id: string;
          student_id: string;
          status: 'present' | 'absent' | 'late' | 'leave';
          remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attendance_session_id: string;
          enrollment_id: string;
          student_id: string;
          status: 'present' | 'absent' | 'late' | 'leave';
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          attendance_session_id?: string;
          enrollment_id?: string;
          student_id?: string;
          status?: 'present' | 'absent' | 'late' | 'leave';
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_attendance_session_id_fkey";
            columns: ["attendance_session_id"];
            isOneToOne: false;
            referencedRelation: "attendance_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "student_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      fee_categories: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fee_structures: {
        Row: {
          id: string;
          academic_year_id: string;
          board_class_id: string;
          stream_id: string | null;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academic_year_id: string;
          board_class_id: string;
          stream_id?: string | null;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academic_year_id?: string;
          board_class_id?: string;
          stream_id?: string | null;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fee_structures_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structures_board_class_id_fkey";
            columns: ["board_class_id"];
            isOneToOne: false;
            referencedRelation: "board_classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structures_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          }
        ];
      };
      fee_structure_items: {
        Row: {
          id: string;
          fee_structure_id: string;
          fee_category_id: string;
          amount: number;
          frequency: 'one_time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
          is_optional: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fee_structure_id: string;
          fee_category_id: string;
          amount: number;
          frequency: 'one_time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
          is_optional?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fee_structure_id?: string;
          fee_category_id?: string;
          amount?: number;
          frequency?: 'one_time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
          is_optional?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fee_structure_items_fee_structure_id_fkey";
            columns: ["fee_structure_id"];
            isOneToOne: false;
            referencedRelation: "fee_structures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structure_items_fee_category_id_fkey";
            columns: ["fee_category_id"];
            isOneToOne: false;
            referencedRelation: "fee_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      student_fee_assignments: {
        Row: {
          id: string;
          enrollment_id: string;
          fee_structure_id: string;
          discount_amount: number;
          discount_reason: string | null;
          custom_notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          enrollment_id: string;
          fee_structure_id: string;
          discount_amount?: number;
          discount_reason?: string | null;
          custom_notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          enrollment_id?: string;
          fee_structure_id?: string;
          discount_amount?: number;
          discount_reason?: string | null;
          custom_notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_fee_assignments_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "student_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_fee_assignments_fee_structure_id_fkey";
            columns: ["fee_structure_id"];
            isOneToOne: false;
            referencedRelation: "fee_structures";
            referencedColumns: ["id"];
          }
        ];
      };
      fee_obligations: {
        Row: {
          id: string;
          enrollment_id: string;
          student_id: string;
          fee_category_id: string;
          academic_year_id: string;
          fee_assignment_id: string | null;
          title: string;
          amount_due: number;
          amount_paid: number;
          due_date: string;
          billing_period_start: string | null;
          billing_period_end: string | null;
          status: 'unpaid' | 'partial' | 'paid' | 'waived' | 'overdue';
          remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          enrollment_id: string;
          student_id: string;
          fee_category_id: string;
          academic_year_id: string;
          fee_assignment_id?: string | null;
          title: string;
          amount_due: number;
          amount_paid?: number;
          due_date: string;
          billing_period_start?: string | null;
          billing_period_end?: string | null;
          status?: 'unpaid' | 'partial' | 'paid' | 'waived' | 'overdue';
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          enrollment_id?: string;
          student_id?: string;
          fee_category_id?: string;
          academic_year_id?: string;
          fee_assignment_id?: string | null;
          title?: string;
          amount_due?: number;
          amount_paid?: number;
          due_date?: string;
          billing_period_start?: string | null;
          billing_period_end?: string | null;
          status?: 'unpaid' | 'partial' | 'paid' | 'waived' | 'overdue';
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fee_obligations_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "student_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_obligations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_obligations_fee_category_id_fkey";
            columns: ["fee_category_id"];
            isOneToOne: false;
            referencedRelation: "fee_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_obligations_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_obligations_fee_assignment_id_fkey";
            columns: ["fee_assignment_id"];
            isOneToOne: false;
            referencedRelation: "student_fee_assignments";
            referencedColumns: ["id"];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          obligation_id: string;
          student_id: string;
          amount: number;
          payment_date: string;
          payment_method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'card' | 'other';
          reference_number: string | null;
          receipt_number: string;
          receipt_metadata: Json;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          obligation_id: string;
          student_id: string;
          amount: number;
          payment_date?: string;
          payment_method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'card' | 'other';
          reference_number?: string | null;
          receipt_number: string;
          receipt_metadata?: Json;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          obligation_id?: string;
          student_id?: string;
          amount?: number;
          payment_date?: string;
          payment_method?: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'card' | 'other';
          reference_number?: string | null;
          receipt_number?: string;
          receipt_metadata?: Json;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_obligation_id_fkey";
            columns: ["obligation_id"];
            isOneToOne: false;
            referencedRelation: "fee_obligations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      study_materials: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          material_type: 'notes' | 'chapter' | 'worksheet' | 'question_paper' | 'practice' | 'other';
          academic_year_id: string;
          board_id: string;
          class_level_id: string;
          stream_id: string | null;
          subject_id: string;
          batch_id: string | null;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size_bytes: number;
          uploader_profile_id: string;
          status: 'active' | 'archived';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          material_type: 'notes' | 'chapter' | 'worksheet' | 'question_paper' | 'practice' | 'other';
          academic_year_id: string;
          board_id: string;
          class_level_id: string;
          stream_id?: string | null;
          subject_id: string;
          batch_id?: string | null;
          file_name: string;
          storage_path: string;
          mime_type?: string;
          file_size_bytes: number;
          uploader_profile_id: string;
          status?: 'active' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          material_type?: 'notes' | 'chapter' | 'worksheet' | 'question_paper' | 'practice' | 'other';
          academic_year_id?: string;
          board_id?: string;
          class_level_id?: string;
          stream_id?: string | null;
          subject_id?: string;
          batch_id?: string | null;
          file_name?: string;
          storage_path?: string;
          mime_type?: string;
          file_size_bytes?: number;
          uploader_profile_id?: string;
          status?: 'active' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_materials_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_materials_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_materials_class_level_id_fkey";
            columns: ["class_level_id"];
            isOneToOne: false;
            referencedRelation: "class_levels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_materials_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_materials_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_materials_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_materials_uploader_profile_id_fkey";
            columns: ["uploader_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      assignments: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          academic_year_id: string;
          board_id: string;
          class_level_id: string;
          stream_id: string | null;
          subject_id: string;
          batch_id: string | null;
          teacher_id: string;
          status: 'draft' | 'published' | 'closed' | 'archived';
          due_at: string;
          max_marks: number | null;
          allow_late_submission: boolean;
          attachment_path: string | null;
          attachment_file_name: string | null;
          attachment_file_size: number | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          academic_year_id: string;
          board_id: string;
          class_level_id: string;
          stream_id?: string | null;
          subject_id: string;
          batch_id?: string | null;
          teacher_id: string;
          status?: 'draft' | 'published' | 'closed' | 'archived';
          due_at: string;
          max_marks?: number | null;
          allow_late_submission?: boolean;
          attachment_path?: string | null;
          attachment_file_name?: string | null;
          attachment_file_size?: number | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          academic_year_id?: string;
          board_id?: string;
          class_level_id?: string;
          stream_id?: string | null;
          subject_id?: string;
          batch_id?: string | null;
          teacher_id?: string;
          status?: 'draft' | 'published' | 'closed' | 'archived';
          due_at?: string;
          max_marks?: number | null;
          allow_late_submission?: boolean;
          attachment_path?: string | null;
          attachment_file_name?: string | null;
          attachment_file_size?: number | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_class_level_id_fkey";
            columns: ["class_level_id"];
            isOneToOne: false;
            referencedRelation: "class_levels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      assignment_submissions: {
        Row: {
          id: string;
          assignment_id: string;
          student_id: string;
          enrollment_id: string | null;
          submitted_at: string;
          status: 'pending' | 'submitted' | 'reviewed' | 'late';
          text_response: string | null;
          attachment_path: string | null;
          attachment_file_name: string | null;
          attachment_file_size: number | null;
          marks: number | null;
          feedback: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          student_id: string;
          enrollment_id?: string | null;
          submitted_at?: string;
          status?: 'pending' | 'submitted' | 'reviewed' | 'late';
          text_response?: string | null;
          attachment_path?: string | null;
          attachment_file_name?: string | null;
          attachment_file_size?: number | null;
          marks?: number | null;
          feedback?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          student_id?: string;
          enrollment_id?: string | null;
          submitted_at?: string;
          status?: 'pending' | 'submitted' | 'reviewed' | 'late';
          text_response?: string | null;
          attachment_path?: string | null;
          attachment_file_name?: string | null;
          attachment_file_size?: number | null;
          marks?: number | null;
          feedback?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_submissions_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "student_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_submissions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_teacher_assigned_to_batch: {
        Args: { p_batch_id: string; p_subject_id?: string | null };
        Returns: boolean;
      };
      is_teacher_authorized_for_material: {
        Args: {
          p_academic_year_id: string;
          p_board_id: string;
          p_class_level_id: string;
          p_subject_id: string;
          p_batch_id?: string | null;
        };
        Returns: boolean;
      };
      can_student_access_material: {
        Args: { p_material_id: string };
        Returns: boolean;
      };
      is_teacher_authorized_for_assignment: {
        Args: {
          p_academic_year_id: string;
          p_board_id: string;
          p_class_level_id: string;
          p_subject_id: string;
          p_batch_id?: string | null;
        };
        Returns: boolean;
      };
      can_student_access_assignment: {
        Args: { p_assignment_id: string };
        Returns: boolean;
      };
      generate_admission_number: {
        Args: { p_prefix?: string };
        Returns: string;
      };
      generate_employee_code: {
        Args: { p_prefix?: string };
        Returns: string;
      };
      generate_receipt_number: {
        Args: { p_prefix?: string };
        Returns: string;
      };
      submit_batch_attendance: {
        Args: {
          p_academic_year_id: string;
          p_batch_id: string;
          p_attendance_date: string;
          p_subject_id?: string | null;
          p_records: Json;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      get_student_attendance_summary: {
        Args: {
          p_student_id: string;
          p_academic_year_id?: string | null;
        };
        Returns: Json;
      };
      record_fee_payment: {
        Args: {
          p_obligation_id: string;
          p_amount: number;
          p_payment_method: string;
          p_reference_number?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      get_student_fee_summary: {
        Args: {
          p_student_id: string;
          p_academic_year_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
