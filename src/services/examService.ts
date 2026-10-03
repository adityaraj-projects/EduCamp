import { supabase } from '../lib/supabaseClient';
import type {
  Exam,
  ExamDetail,
  ExamSubjectDetail,
  ExamFilters,
  CreateExamPayload,
  SaveMarksRowPayload,
  StudentExamReport,
  StudentSubjectScore,
  ExamStatus,
} from '../types/exam';
import { calculateGrade, DEFAULT_PAGE_SIZE } from '../types/exam';

export interface PaginatedExamsResult {
  data: ExamDetail[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExamSubjectRosterItem {
  student_id: string;
  enrollment_id: string;
  admission_number: string;
  roll_number: string | null;
  student_name: string;
  attendance_status: 'present' | 'absent' | 'exempted';
  obtained_marks: number | null;
  result_status: 'pending' | 'evaluated' | 'passed' | 'failed' | 'absent' | 'exempted';
  remarks: string;
  existing_result_id: string | null;
}

export const examService = {
  /**
   * Fetch paginated list of exams with server-side filters
   */
  async getExams(filters: ExamFilters = {}): Promise<PaginatedExamsResult> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize || DEFAULT_PAGE_SIZE));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase
        .from('exams')
        .select(
          `
          id,
          title,
          description,
          exam_type,
          academic_year_id,
          board_id,
          class_level_id,
          stream_id,
          batch_id,
          exam_date,
          start_time,
          end_time,
          status,
          created_by,
          created_at,
          updated_at,
          board:boards(id, code, name),
          class_level:class_levels(id, class_number, display_name),
          stream:streams(id, code, name),
          batch:batches(id, name, code),
          exam_subjects:exam_subjects(
            id,
            exam_id,
            subject_id,
            max_marks,
            passing_marks,
            subject_date,
            start_time,
            end_time,
            created_at,
            updated_at,
            subject:subjects(id, code, name)
          )
        `,
          { count: 'exact' }
        );

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.exam_type && filters.exam_type !== 'all') {
        query = query.eq('exam_type', filters.exam_type);
      }

      if (filters.academic_year_id) {
        query = query.eq('academic_year_id', filters.academic_year_id);
      }

      if (filters.board_id) {
        query = query.eq('board_id', filters.board_id);
      }

      if (filters.class_level_id) {
        query = query.eq('class_level_id', filters.class_level_id);
      }

      if (filters.batch_id) {
        query = query.or(`batch_id.eq.${filters.batch_id},batch_id.is.null`);
      }

      if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const term = filters.searchQuery.trim().replace(/[%_]/g, '');
        query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
      }

      query = query
        .order('exam_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error('[EduCamp ExamService] getExams error:', error.message);
        throw new Error(`Failed to load exams: ${error.message}`);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: (data as unknown as ExamDetail[]) || [],
        count: totalCount,
        page,
        pageSize,
        totalPages,
      };
    } catch (err: any) {
      console.error('[EduCamp ExamService] Exception in getExams:', err);
      throw err;
    }
  },

  /**
   * Fetch single exam by ID with joined details and subjects
   */
  async getExamById(id: string): Promise<ExamDetail | null> {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select(
          `
          id,
          title,
          description,
          exam_type,
          academic_year_id,
          board_id,
          class_level_id,
          stream_id,
          batch_id,
          exam_date,
          start_time,
          end_time,
          status,
          created_by,
          created_at,
          updated_at,
          board:boards(id, code, name),
          class_level:class_levels(id, class_number, display_name),
          stream:streams(id, code, name),
          batch:batches(id, name, code),
          exam_subjects:exam_subjects(
            id,
            exam_id,
            subject_id,
            max_marks,
            passing_marks,
            subject_date,
            start_time,
            end_time,
            created_at,
            updated_at,
            subject:subjects(id, code, name)
          )
        `
        )
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[EduCamp ExamService] getExamById error:', error.message);
        throw new Error(`Failed to fetch exam: ${error.message}`);
      }

      return (data as unknown as ExamDetail) || null;
    } catch (err: any) {
      console.error('[EduCamp ExamService] Exception in getExamById:', err);
      throw err;
    }
  },

  /**
   * Create an Exam and its associated ExamSubjects atomically
   */
  async createExam(payload: CreateExamPayload, creatorProfileId: string): Promise<ExamDetail> {
    if (!payload.title || payload.title.trim().length === 0) {
      throw new Error('Exam title is required.');
    }
    if (!payload.exam_date) {
      throw new Error('Exam date is required.');
    }
    if (!payload.subjects || payload.subjects.length === 0) {
      throw new Error('At least one subject must be configured for the exam.');
    }

    // Validate subject configurations
    for (const subj of payload.subjects) {
      if (subj.max_marks <= 0) {
        throw new Error(`Max marks must be greater than 0.`);
      }
      if (subj.passing_marks < 0) {
        throw new Error(`Passing marks cannot be negative.`);
      }
      if (subj.passing_marks > subj.max_marks) {
        throw new Error(
          `Passing marks (${subj.passing_marks}) cannot exceed maximum marks (${subj.max_marks}).`
        );
      }
    }

    // 1. Insert Exam header
    const examId = crypto.randomUUID();
    const { error: examError } = await supabase
      .from('exams')
      .insert({
        id: examId,
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        exam_type: payload.exam_type,
        academic_year_id: payload.academic_year_id,
        board_id: payload.board_id,
        class_level_id: payload.class_level_id,
        stream_id: payload.stream_id || null,
        batch_id: payload.batch_id || null,
        exam_date: payload.exam_date,
        start_time: payload.start_time || null,
        end_time: payload.end_time || null,
        status: payload.status || 'draft',
        created_by: creatorProfileId,
      });

    if (examError) {
      console.error('[EduCamp ExamService] createExam header error:', examError.message);
      throw new Error(`Failed to create exam: ${examError.message}`);
    }

    // 2. Insert Exam Subjects
    const examSubjectsRows = payload.subjects.map((subj) => ({
      id: crypto.randomUUID(),
      exam_id: examId,
      subject_id: subj.subject_id,
      max_marks: subj.max_marks,
      passing_marks: subj.passing_marks,
      subject_date: subj.subject_date || payload.exam_date,
      start_time: subj.start_time || null,
      end_time: subj.end_time || null,
    }));

    const { error: subjectsError } = await supabase
      .from('exam_subjects')
      .insert(examSubjectsRows);

    if (subjectsError) {
      console.error('[EduCamp ExamService] createExam subjects error:', subjectsError.message);
      // Clean up orphaned exam header
      await supabase.from('exams').delete().eq('id', examId);
      throw new Error(`Failed to configure exam subjects: ${subjectsError.message}`);
    }

    const created = await this.getExamById(examId);
    if (!created) {
      throw new Error('Exam created but failed to retrieve details.');
    }
    return created;
  },

  /**
   * Update status of an exam (e.g. draft -> scheduled -> completed -> published -> archived)
   */
  async updateExamStatus(examId: string, status: ExamStatus): Promise<Exam> {
    // If publishing, perform validation
    if (status === 'published') {
      const exam = await this.getExamById(examId);
      if (!exam) {
        throw new Error('Exam not found.');
      }
      if (!exam.exam_subjects || exam.exam_subjects.length === 0) {
        throw new Error('Cannot publish exam without configured subjects.');
      }
    }

    const { data, error } = await supabase
      .from('exams')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', examId)
      .select()
      .single();

    if (error) {
      console.error('[EduCamp ExamService] updateExamStatus error:', error.message);
      throw new Error(`Failed to update exam status: ${error.message}`);
    }

    return data as Exam;
  },

  /**
   * Archive an exam safely (retaining all historical student results)
   */
  async archiveExam(examId: string): Promise<Exam> {
    return this.updateExamStatus(examId, 'archived');
  },

  /**
   * Get student roster for entering marks in a specific exam subject
   */
  async getExamSubjectRoster(
    examId: string,
    examSubjectId: string
  ): Promise<{
    exam: ExamDetail;
    subject: ExamSubjectDetail;
    roster: ExamSubjectRosterItem[];
  }> {
    const exam = await this.getExamById(examId);
    if (!exam) {
      throw new Error('Exam not found.');
    }

    const subject = exam.exam_subjects?.find((s) => s.id === examSubjectId);
    if (!subject) {
      throw new Error('Exam subject not found.');
    }

    // Fetch board_class matching exam board and class_level
    const { data: boardClass, error: bcError } = await supabase
      .from('board_classes')
      .select('id')
      .eq('board_id', exam.board_id)
      .eq('class_level_id', exam.class_level_id)
      .maybeSingle();

    if (bcError || !boardClass) {
      throw new Error('Board class association not found for this exam.');
    }

    // Query active enrollments matching academic targeting
    let enrollmentsQuery = supabase
      .from('student_enrollments')
      .select(
        `
        id,
        student_id,
        roll_number,
        student:students!student_enrollments_student_id_fkey(
          id,
          admission_number,
          status,
          profile:profiles!students_profile_id_fkey(
            id,
            full_name
          )
        )
      `
      )
      .eq('academic_year_id', exam.academic_year_id)
      .eq('board_class_id', boardClass.id)
      .eq('is_current', true);

    if (exam.stream_id) {
      enrollmentsQuery = enrollmentsQuery.eq('stream_id', exam.stream_id);
    }

    if (exam.batch_id) {
      enrollmentsQuery = enrollmentsQuery.eq('batch_id', exam.batch_id);
    }

    enrollmentsQuery = enrollmentsQuery.order('roll_number', { ascending: true });

    const { data: enrollments, error: enrollmentsError } = await enrollmentsQuery;

    if (enrollmentsError) {
      console.error('[EduCamp ExamService] getExamSubjectRoster enrollments error:', enrollmentsError.message);
      throw new Error(`Failed to fetch student enrollments: ${enrollmentsError.message}`);
    }

    // Query existing marks rows for this subject
    const { data: existingResults, error: resultsError } = await supabase
      .from('exam_results')
      .select('id, student_id, attendance_status, obtained_marks, result_status, remarks')
      .eq('exam_subject_id', examSubjectId);

    if (resultsError) {
      console.error('[EduCamp ExamService] getExamSubjectRoster results error:', resultsError.message);
      throw new Error(`Failed to fetch existing marks: ${resultsError.message}`);
    }

    const resultsMap = new Map<string, any>();
    if (existingResults) {
      for (const res of existingResults) {
        resultsMap.set(res.student_id, res);
      }
    }

    const roster: ExamSubjectRosterItem[] = (enrollments || []).map((enr: any) => {
      const existing = resultsMap.get(enr.student_id);
      return {
        student_id: enr.student_id,
        enrollment_id: enr.id,
        admission_number: enr.student?.admission_number || 'N/A',
        roll_number: enr.roll_number || null,
        student_name: enr.student?.profile?.full_name || 'Enrolled Student',
        attendance_status: existing ? existing.attendance_status : 'present',
        obtained_marks: existing ? existing.obtained_marks : null,
        result_status: existing ? existing.result_status : 'pending',
        remarks: existing?.remarks || '',
        existing_result_id: existing?.id || null,
      };
    });

    return {
      exam,
      subject,
      roster,
    };
  },

  /**
   * Bulk save marks for an exam subject
   */
  async saveExamSubjectMarks(
    examId: string,
    examSubjectId: string,
    rows: SaveMarksRowPayload[],
    evaluatorProfileId: string
  ): Promise<{ savedCount: number }> {
    if (!rows || rows.length === 0) {
      return { savedCount: 0 };
    }

    // Fetch subject max & passing marks for validation
    const { data: subject, error: subjError } = await supabase
      .from('exam_subjects')
      .select('max_marks, passing_marks')
      .eq('id', examSubjectId)
      .single();

    if (subjError || !subject) {
      throw new Error('Subject details not found for marks validation.');
    }

    const validatedRows = rows.map((row) => {
      let obtained = row.obtained_marks;
      let status: 'pending' | 'evaluated' | 'passed' | 'failed' | 'absent' | 'exempted' = 'pending';

      if (row.attendance_status === 'absent') {
        obtained = null; // Explicit rule: ABSENT != 0
        status = 'absent';
      } else if (row.attendance_status === 'exempted') {
        obtained = null;
        status = 'exempted';
      } else {
        // Attendance status is 'present'
        if (obtained !== null && obtained !== undefined) {
          const num = Number(obtained);
          if (isNaN(num)) {
            throw new Error(`Invalid marks value for student.`);
          }
          if (num < 0) {
            throw new Error(`Marks cannot be negative.`);
          }
          if (num > subject.max_marks) {
            throw new Error(`Obtained marks (${num}) exceed max marks (${subject.max_marks}).`);
          }
          obtained = num;
          status = num >= subject.passing_marks ? 'passed' : 'failed';
        } else {
          status = 'pending';
        }
      }

      return {
        exam_id: examId,
        exam_subject_id: examSubjectId,
        student_id: row.student_id,
        enrollment_id: row.enrollment_id || null,
        attendance_status: row.attendance_status,
        obtained_marks: obtained,
        result_status: status,
        remarks: row.remarks?.trim() || null,
        evaluated_by: evaluatorProfileId,
        evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabase
      .from('exam_results')
      .upsert(validatedRows, {
        onConflict: 'exam_subject_id,student_id',
      });

    if (upsertError) {
      console.error('[EduCamp ExamService] saveExamSubjectMarks error:', upsertError.message);
      throw new Error(`Failed to save marks: ${upsertError.message}`);
    }

    return { savedCount: validatedRows.length };
  },

  /**
   * Fetch comprehensive report for a student in a specific exam
   */
  async getStudentExamReport(examId: string, studentProfileId: string): Promise<StudentExamReport> {
    // 1. Find student record from profile
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', studentProfileId)
      .maybeSingle();

    if (studentError || !student) {
      throw new Error('Student record not found for this profile.');
    }

    // 2. Fetch exam details with subjects
    const exam = await this.getExamById(examId);
    if (!exam) {
      throw new Error('Exam not found.');
    }

    // 3. Fetch results for this student in this exam
    const { data: results, error: resultsError } = await supabase
      .from('exam_results')
      .select(
        `
        id,
        exam_subject_id,
        attendance_status,
        obtained_marks,
        result_status,
        remarks,
        exam_subject:exam_subjects(
          id,
          max_marks,
          passing_marks,
          subject:subjects(id, code, name)
        )
      `
      )
      .eq('exam_id', examId)
      .eq('student_id', student.id);

    if (resultsError) {
      console.error('[EduCamp ExamService] getStudentExamReport results error:', resultsError.message);
      throw new Error(`Failed to fetch student results: ${resultsError.message}`);
    }

    const resultMap = new Map<string, any>();
    if (results) {
      for (const res of results) {
        resultMap.set(res.exam_subject_id, res);
      }
    }

    // 4. Compile subject scores
    const subject_scores: StudentSubjectScore[] = (exam.exam_subjects || []).map((es) => {
      const res = resultMap.get(es.id);
      return {
        exam_subject_id: es.id,
        subject_name: es.subject?.name || 'Subject',
        subject_code: es.subject?.code || '',
        max_marks: es.max_marks,
        passing_marks: es.passing_marks,
        attendance_status: res ? res.attendance_status : 'present',
        obtained_marks: res ? res.obtained_marks : null,
        result_status: res ? res.result_status : 'pending',
        remarks: res?.remarks || null,
      };
    });

    // 5. Compute totals and completion status
    let total_max = 0;
    let total_obtained: number | null = 0;
    let is_complete = true;
    let has_any_failure = false;
    let has_any_present = false;
    let all_absent = true;
    let all_exempted = true;

    for (const score of subject_scores) {
      total_max += score.max_marks;

      if (score.attendance_status === 'present') {
        all_absent = false;
        all_exempted = false;
        has_any_present = true;
        if (score.obtained_marks === null || score.result_status === 'pending') {
          is_complete = false;
        } else {
          total_obtained = (total_obtained || 0) + score.obtained_marks;
          if (score.result_status === 'failed') {
            has_any_failure = true;
          }
        }
      } else if (score.attendance_status === 'absent') {
        all_exempted = false;
      } else if (score.attendance_status === 'exempted') {
        all_absent = false;
      }
    }

    if (!is_complete) {
      total_obtained = null;
    }

    let percentage: number | null = null;
    if (is_complete && has_any_present && total_max > 0 && total_obtained !== null) {
      percentage = Math.round((total_obtained / total_max) * 10000) / 100;
    }

    let overall_status: 'PASSED' | 'FAILED' | 'INCOMPLETE' | 'ABSENT' | 'EXEMPTED' = 'INCOMPLETE';
    if (!is_complete) {
      overall_status = 'INCOMPLETE';
    } else if (all_absent && subject_scores.length > 0) {
      overall_status = 'ABSENT';
    } else if (all_exempted && subject_scores.length > 0) {
      overall_status = 'EXEMPTED';
    } else if (has_any_failure) {
      overall_status = 'FAILED';
    } else {
      overall_status = 'PASSED';
    }

    const overall_grade = is_complete && has_any_present
      ? calculateGrade(percentage, overall_status === 'PASSED')
      : null;

    return {
      exam_id: exam.id,
      exam_title: exam.title,
      exam_type: exam.exam_type,
      exam_date: exam.exam_date,
      status: exam.status,
      board_name: exam.board?.name,
      class_name: exam.class_level?.display_name,
      batch_name: exam.batch?.name || undefined,
      subject_scores,
      total_obtained,
      total_max,
      percentage,
      overall_grade,
      overall_status,
      is_complete,
    };
  },

  /**
   * Fetch published exams accessible to the student
   */
  async getStudentPublishedExams(studentProfileId: string): Promise<ExamDetail[]> {
    // 1. Get student enrollment context
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(
        `
        id,
        student_enrollments!student_enrollments_student_id_fkey(
          academic_year_id,
          board_class_id,
          stream_id,
          batch_id,
          is_current,
          board_class:board_classes!student_enrollments_board_class_id_fkey(
            board_id,
            class_level_id
          )
        )
      `
      )
      .eq('profile_id', studentProfileId)
      .maybeSingle();

    if (studentError || !student) {
      return [];
    }

    const currentEnrollment = (student as any).student_enrollments?.find(
      (enr: any) => enr.is_current === true
    );

    if (!currentEnrollment || !currentEnrollment.board_class) {
      return [];
    }

    const boardId = currentEnrollment.board_class.board_id;
    const classLevelId = currentEnrollment.board_class.class_level_id;

    // 2. Query published exams for this academic context
    let query = supabase
      .from('exams')
      .select(
        `
        id,
        title,
        description,
        exam_type,
        academic_year_id,
        board_id,
        class_level_id,
        stream_id,
        batch_id,
        exam_date,
        start_time,
        end_time,
        status,
        created_by,
        created_at,
        updated_at,
        board:boards(id, code, name),
        class_level:class_levels(id, class_number, display_name),
        stream:streams(id, code, name),
        batch:batches(id, name, code),
        exam_subjects:exam_subjects(
          id,
          exam_id,
          subject_id,
          max_marks,
          passing_marks,
          subject_date,
          start_time,
          end_time,
          subject:subjects(id, code, name)
        )
      `
      )
      .eq('status', 'published')
      .eq('academic_year_id', currentEnrollment.academic_year_id)
      .eq('board_id', boardId)
      .eq('class_level_id', classLevelId);

    if (currentEnrollment.stream_id) {
      query = query.or(`stream_id.eq.${currentEnrollment.stream_id},stream_id.is.null`);
    } else {
      query = query.is('stream_id', null);
    }

    if (currentEnrollment.batch_id) {
      query = query.or(`batch_id.eq.${currentEnrollment.batch_id},batch_id.is.null`);
    } else {
      query = query.is('batch_id', null);
    }

    query = query.order('exam_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[EduCamp ExamService] getStudentPublishedExams error:', error.message);
      return [];
    }

    return (data as unknown as ExamDetail[]) || [];
  },
};
