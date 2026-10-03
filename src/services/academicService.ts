import { supabase } from '../lib/supabaseClient';
import type {
  AcademicYear,
  Board,
  ClassLevel,
  Stream,
  Subject,
} from '../types/academic';

/**
 * Academic Master Data Service
 * Provides lightweight, selective-column queries for academic hierarchy
 */
export const academicService = {
  /**
   * Fetch the current active academic session
   */
  async getActiveAcademicYear(): Promise<AcademicYear | null> {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, name, start_date, end_date, is_active, created_at, updated_at')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('[EduCamp AcademicService] Error fetching active academic year:', error.message);
      return null;
    }
    return data;
  },

  /**
   * Fetch all active educational boards (e.g. CBSE, ICSE, BSEB)
   */
  async getActiveBoards(): Promise<Board[]> {
    const { data, error } = await supabase
      .from('boards')
      .select('id, code, name, description, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) {
      console.warn('[EduCamp AcademicService] Error fetching boards:', error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Fetch all active class levels (Classes 1 through 12, ordered by sort_order)
   */
  async getActiveClassLevels(): Promise<ClassLevel[]> {
    const { data, error } = await supabase
      .from('class_levels')
      .select('id, class_number, display_name, sort_order, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('[EduCamp AcademicService] Error fetching class levels:', error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Fetch available streams for Senior Secondary (Classes 11 & 12)
   */
  async getActiveStreams(): Promise<Stream[]> {
    const { data, error } = await supabase
      .from('streams')
      .select('id, code, name, description, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('[EduCamp AcademicService] Error fetching streams:', error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Fetch master subjects catalog
   */
  async getActiveSubjects(): Promise<Subject[]> {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, code, name, description, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('[EduCamp AcademicService] Error fetching subjects:', error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Fetch board-class specific offerings
   */
  async getBoardClasses(boardId?: string) {
    let query = supabase
      .from('board_classes')
      .select(`
        id,
        board_id,
        class_level_id,
        is_active,
        boards (id, code, name),
        class_levels (id, class_number, display_name, sort_order)
      `)
      .eq('is_active', true);

    if (boardId) {
      query = query.eq('board_id', boardId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[EduCamp AcademicService] Error fetching board classes:', error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Fetch coaching batches for an offering in an academic session
   */
  async getBatchesForBoardClass(academicYearId: string, boardClassId: string) {
    const { data, error } = await supabase
      .from('batches')
      .select('id, academic_year_id, board_class_id, stream_id, name, code, max_capacity, is_active')
      .eq('academic_year_id', academicYearId)
      .eq('board_class_id', boardClassId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('[EduCamp AcademicService] Error fetching batches:', error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Fetch mapped curriculum subjects for a specific board-class offering
   */
  async getCurriculumSubjects(boardClassId: string, streamId?: string | null) {
    let query = supabase
      .from('board_class_subjects')
      .select(`
        id,
        board_class_id,
        subject_id,
        stream_id,
        is_core,
        sort_order,
        is_active,
        subjects (id, code, name, description)
      `)
      .eq('board_class_id', boardClassId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (streamId) {
      query = query.eq('stream_id', streamId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[EduCamp AcademicService] Error fetching curriculum subjects:', error.message);
      return [];
    }
    return data || [];
  },
};
