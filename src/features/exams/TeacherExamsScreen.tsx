import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { examService, ExamSubjectRosterItem } from '../../services/examService';
import { materialService, TeacherAssignmentContext } from '../../services/materialService';
import { supabase } from '../../lib/supabaseClient';
import type {
  ExamDetail,
  ExamSubjectDetail,
  ExamStatus,
  ExamType,
  CreateExamPayload,
  SaveMarksRowPayload,
} from '../../types/exam';
import {
  EXAM_TYPE_OPTIONS,
  EXAM_STATUS_OPTIONS,
  DEFAULT_PAGE_SIZE,
} from '../../types/exam';
import {
  ArrowLeft,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Users,
  X,
  Award,
  BookOpen,
  Calendar,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  Globe,
  Archive,
  RefreshCw,
} from 'lucide-react';

interface NewSubjectRow {
  subject_id: string;
  max_marks: number;
  passing_marks: number;
  subject_date: string;
}

export const TeacherExamsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  // Exams State
  const [exams, setExams] = useState<ExamDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExamStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ExamType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Teaching Contexts
  const [contexts, setContexts] = useState<TeacherAssignmentContext[]>([]);
  const [selectedContextId, setSelectedContextId] = useState<string>('');
  const [availableSubjects, setAvailableSubjects] = useState<{ id: string; name: string; code: string }[]>([]);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [createType, setCreateType] = useState<ExamType>('unit_test');
  const [createDate, setCreateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [createStartTime, setCreateStartTime] = useState<string>('09:00');
  const [createEndTime, setCreateEndTime] = useState<string>('11:00');
  const [createTargetScope, setCreateTargetScope] = useState<'batch' | 'class'>('batch');
  const [createSubjectRows, setCreateSubjectRows] = useState<NewSubjectRow[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Marks Entry Modal State
  const [activeExamForMarks, setActiveExamForMarks] = useState<ExamDetail | null>(null);
  const [selectedExamSubjectId, setSelectedExamSubjectId] = useState<string>('');
  const [activeSubjectDetail, setActiveSubjectDetail] = useState<ExamSubjectDetail | null>(null);
  const [roster, setRoster] = useState<ExamSubjectRosterItem[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [isSavingMarks, setIsSavingMarks] = useState<boolean>(false);
  const [marksSuccessMessage, setMarksSuccessMessage] = useState<string | null>(null);

  // Status Action Loading State
  const [transitioningExamId, setTransitioningExamId] = useState<string | null>(null);

  // 1. Load Teaching Assignments Context & Master Subjects
  useEffect(() => {
    let isMounted = true;
    async function loadMasterContexts() {
      if (!user) return;
      try {
        const [contextList, subjectsRes] = await Promise.all([
          materialService.getTeacherAssignments(user.id, isAdmin),
          supabase.from('subjects').select('id, name, code').eq('is_active', true),
        ]);

        if (isMounted) {
          setContexts(contextList);
          if (contextList.length > 0 && !selectedContextId) {
            setSelectedContextId(contextList[0].id);
          }
          if (subjectsRes.data) {
            setAvailableSubjects(subjectsRes.data);
            if (createSubjectRows.length === 0 && subjectsRes.data.length > 0) {
              setCreateSubjectRows([
                {
                  subject_id: subjectsRes.data[0].id,
                  max_marks: 100,
                  passing_marks: 40,
                  subject_date: new Date().toISOString().split('T')[0],
                },
              ]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load contexts or master subjects:', err);
      }
    }
    loadMasterContexts();
    return () => {
      isMounted = false;
    };
  }, [user, isAdmin]);

  // 2. Load Paginated Exams
  const loadExams = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await examService.getExams({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        exam_type: typeFilter !== 'all' ? typeFilter : undefined,
        searchQuery: searchQuery.trim() || undefined,
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
      });

      setExams(res.data);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.count);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading exams';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, searchQuery, currentPage]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  // Handle Create Subject Rows
  const handleAddSubjectRow = () => {
    if (availableSubjects.length === 0) return;
    setCreateSubjectRows((prev) => [
      ...prev,
      {
        subject_id: availableSubjects[0].id,
        max_marks: 100,
        passing_marks: 40,
        subject_date: createDate,
      },
    ]);
  };

  const handleRemoveSubjectRow = (index: number) => {
    if (createSubjectRows.length <= 1) return;
    setCreateSubjectRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubjectRowChange = (index: number, field: keyof NewSubjectRow, value: any) => {
    setCreateSubjectRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Submit Create Exam
  const handleCreateExam = async () => {
    if (!user) return;
    if (!createTitle.trim()) {
      setCreateError('Please enter an exam title.');
      return;
    }
    if (!createDate) {
      setCreateError('Please select a valid exam date.');
      return;
    }

    const context = contexts.find((c) => c.id === selectedContextId);
    if (!context) {
      setCreateError('Please select an authorized academic context.');
      return;
    }

    if (createSubjectRows.length === 0) {
      setCreateError('At least one subject must be added to the exam.');
      return;
    }

    for (const row of createSubjectRows) {
      if (row.max_marks <= 0) {
        setCreateError('Maximum marks must be greater than 0.');
        return;
      }
      if (row.passing_marks < 0) {
        setCreateError('Passing marks cannot be negative.');
        return;
      }
      if (row.passing_marks > row.max_marks) {
        setCreateError(
          `Passing marks (${row.passing_marks}) cannot exceed maximum marks (${row.max_marks}).`
        );
        return;
      }
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const payload: CreateExamPayload = {
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        exam_type: createType,
        academic_year_id: context.academic_year_id,
        board_id: context.board_id,
        class_level_id: context.class_level_id,
        stream_id: context.stream_id || null,
        batch_id: createTargetScope === 'batch' ? context.batch_id : null,
        exam_date: createDate,
        start_time: createStartTime || null,
        end_time: createEndTime || null,
        status: 'draft',
        subjects: createSubjectRows.map((s) => ({
          subject_id: s.subject_id,
          max_marks: Number(s.max_marks),
          passing_marks: Number(s.passing_marks),
          subject_date: s.subject_date || createDate,
        })),
      };

      await examService.createExam(payload, user.id);

      setIsCreateModalOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      loadExams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create exam';
      setCreateError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  // Status transitions
  const handleUpdateStatus = async (examId: string, nextStatus: ExamStatus) => {
    setTransitioningExamId(examId);
    try {
      await examService.updateExamStatus(examId, nextStatus);
      await loadExams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update exam status';
      alert(`Action failed: ${msg}`);
    } finally {
      setTransitioningExamId(null);
    }
  };

  // Open Marks Entry Modal
  const handleOpenMarksEntry = async (exam: ExamDetail, subjectId?: string) => {
    setActiveExamForMarks(exam);
    const targetSubjId = subjectId || (exam.exam_subjects && exam.exam_subjects[0]?.id) || '';
    setSelectedExamSubjectId(targetSubjId);
    await loadSubjectRoster(exam.id, targetSubjId);
  };

  const loadSubjectRoster = async (examId: string, examSubjectId: string) => {
    if (!examSubjectId) return;
    setIsLoadingRoster(true);
    setRosterError(null);
    setMarksSuccessMessage(null);
    try {
      const data = await examService.getExamSubjectRoster(examId, examSubjectId);
      setActiveSubjectDetail(data.subject);
      setRoster(data.roster);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load roster';
      setRosterError(msg);
    } finally {
      setIsLoadingRoster(false);
    }
  };

  const handleRosterAttendanceChange = (
    studentId: string,
    newStatus: 'present' | 'absent' | 'exempted'
  ) => {
    setRoster((prev) =>
      prev.map((item) => {
        if (item.student_id !== studentId) return item;
        const obtained = newStatus === 'present' ? item.obtained_marks : null;
        let resStatus: any = newStatus;
        if (newStatus === 'present') {
          if (obtained !== null && activeSubjectDetail) {
            resStatus = obtained >= activeSubjectDetail.passing_marks ? 'passed' : 'failed';
          } else {
            resStatus = 'pending';
          }
        }
        return {
          ...item,
          attendance_status: newStatus,
          obtained_marks: obtained,
          result_status: resStatus,
        };
      })
    );
  };

  const handleRosterMarksChange = (studentId: string, marksValue: string) => {
    setRoster((prev) =>
      prev.map((item) => {
        if (item.student_id !== studentId) return item;
        if (marksValue === '') {
          return {
            ...item,
            obtained_marks: null,
            result_status: 'pending',
          };
        }
        const num = Number(marksValue);
        const max = activeSubjectDetail?.max_marks || 100;
        const pass = activeSubjectDetail?.passing_marks || 40;
        const isValid = !isNaN(num) && num >= 0 && num <= max;
        return {
          ...item,
          obtained_marks: isNaN(num) ? null : num,
          result_status: isValid ? (num >= pass ? 'passed' : 'failed') : 'pending',
        };
      })
    );
  };

  const handleRosterRemarksChange = (studentId: string, remarks: string) => {
    setRoster((prev) =>
      prev.map((item) => (item.student_id === studentId ? { ...item, remarks } : item))
    );
  };

  const handleSaveMarks = async () => {
    if (!user || !activeExamForMarks || !selectedExamSubjectId) return;

    // Validate marks before sending
    const maxMarks = activeSubjectDetail?.max_marks || 100;
    for (const r of roster) {
      if (r.attendance_status === 'present' && r.obtained_marks !== null) {
        if (r.obtained_marks < 0 || r.obtained_marks > maxMarks) {
          setRosterError(
            `Marks for ${r.student_name} (${r.obtained_marks}) must be between 0 and ${maxMarks}.`
          );
          return;
        }
      }
    }

    setIsSavingMarks(true);
    setRosterError(null);
    setMarksSuccessMessage(null);

    try {
      const payloadRows: SaveMarksRowPayload[] = roster.map((r) => ({
        exam_id: activeExamForMarks.id,
        exam_subject_id: selectedExamSubjectId,
        student_id: r.student_id,
        enrollment_id: r.enrollment_id,
        attendance_status: r.attendance_status,
        obtained_marks: r.obtained_marks,
        remarks: r.remarks,
      }));

      await examService.saveExamSubjectMarks(
        activeExamForMarks.id,
        selectedExamSubjectId,
        payloadRows,
        user.id
      );

      setMarksSuccessMessage('Student marks and attendance saved successfully.');
      setTimeout(() => setMarksSuccessMessage(null), 4000);
      await loadSubjectRoster(activeExamForMarks.id, selectedExamSubjectId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save marks';
      setRosterError(msg);
    } finally {
      setIsSavingMarks(false);
    }
  };

  const getStatusColor = (status: ExamStatus) => {
    const found = EXAM_STATUS_OPTIONS.find((s) => s.value === status);
    return found ? found.color : '#6B7280';
  };

  const getExamTypeLabel = (type: string) => {
    const found = EXAM_TYPE_OPTIONS.find((t) => t.value === type);
    return found ? found.label : type.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Return to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <Award className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Exam & Result Management
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Exam
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Filters and Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search exam title..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Lifecycles</option>
                {EXAM_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Exam Type Filter */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Exam Types</option>
                {EXAM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh */}
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={loadExams}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Loading examination records...</p>
          </div>
        ) : exams.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-lg mx-auto">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No Examinations Found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
              No exams match your current filter parameters. You can create a new assessment or adjust your filters.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-5 inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create First Exam
            </button>
          </div>
        ) : (
          /* Exam Cards List */
          <div className="space-y-4">
            {exams.map((exam) => {
              const statusOption = EXAM_STATUS_OPTIONS.find((s) => s.value === exam.status);
              return (
                <div
                  key={exam.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {getExamTypeLabel(exam.exam_type)}
                      </span>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: `${getStatusColor(exam.status)}15`,
                          color: getStatusColor(exam.status),
                        }}
                      >
                        {statusOption?.label || exam.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {exam.exam_date}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 truncate">{exam.title}</h3>

                    {exam.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{exam.description}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center space-x-1 font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {exam.board?.name} • {exam.class_level?.display_name}{' '}
                          {exam.batch ? `(${exam.batch.name})` : '(All Batches)'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 font-medium text-slate-500">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {exam.exam_subjects?.length || 0}{' '}
                          {exam.exam_subjects?.length === 1 ? 'Subject' : 'Subjects'} Configured
                        </span>
                      </div>
                    </div>

                    {/* Subjects Badges */}
                    {exam.exam_subjects && exam.exam_subjects.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {exam.exam_subjects.map((es) => (
                          <button
                            key={es.id}
                            onClick={() => handleOpenMarksEntry(exam, es.id)}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition-colors"
                            title="Click to enter marks for this subject"
                          >
                            <span className="font-semibold mr-1">{es.subject?.name}:</span>
                            <span className="text-slate-500">Max {es.max_marks} (Pass {es.passing_marks})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-wrap md:flex-col items-stretch justify-end gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5 min-w-[170px]">
                    <button
                      onClick={() => handleOpenMarksEntry(exam)}
                      className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Enter / View Marks
                    </button>

                    {/* Status Transitions */}
                    {exam.status === 'draft' && (
                      <button
                        onClick={() => handleUpdateStatus(exam.id, 'scheduled')}
                        disabled={transitioningExamId === exam.id}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Clock className="w-3.5 h-3.5 mr-1" /> Schedule Exam
                      </button>
                    )}

                    {exam.status === 'scheduled' && (
                      <button
                        onClick={() => handleUpdateStatus(exam.id, 'completed')}
                        disabled={transitioningExamId === exam.id}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Conducted
                      </button>
                    )}

                    {exam.status === 'completed' && (
                      <button
                        onClick={() => handleUpdateStatus(exam.id, 'published')}
                        disabled={transitioningExamId === exam.id}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <Globe className="w-3.5 h-3.5 mr-1" /> Publish Results
                      </button>
                    )}

                    {exam.status === 'published' && (
                      <span className="text-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                        Visible to Students
                      </span>
                    )}

                    {exam.status !== 'archived' && (
                      <button
                        onClick={() => {
                          if (confirm('Archive this exam? Historical marks will remain preserved.')) {
                            handleUpdateStatus(exam.id, 'archived');
                          }
                        }}
                        disabled={transitioningExamId === exam.id}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xs font-medium transition-colors"
                        title="Archive Exam (Preserves Historical Results)"
                      >
                        <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm text-sm">
            <span className="text-slate-500">
              Showing page <strong className="text-slate-900">{currentPage}</strong> of{' '}
              <strong className="text-slate-900">{totalPages}</strong> ({totalCount} total exams)
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* CREATE EXAM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold">Create New Examination</h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {createError && (
                <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Academic Context Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Academic Context (Board / Class / Batch) *
                </label>
                {contexts.length === 0 ? (
                  <p className="text-xs text-amber-600">
                    No active teaching assignments found. Please ensure class assignments exist.
                  </p>
                ) : (
                  <select
                    value={selectedContextId}
                    onChange={(e) => setSelectedContextId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {contexts.map((ctx) => (
                      <option key={ctx.id} value={ctx.id}>
                        {ctx.board_name} — {ctx.class_name} {ctx.stream_name ? `(${ctx.stream_name})` : ''} • Batch: {ctx.batch_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Target Scope */}
              <div className="flex items-center space-x-6">
                <label className="flex items-center text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={createTargetScope === 'batch'}
                    onChange={() => setCreateTargetScope('batch')}
                    className="text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  Specific Batch Only
                </label>
                <label className="flex items-center text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={createTargetScope === 'class'}
                    onChange={() => setCreateTargetScope('class')}
                    className="text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  All Batches in this Class
                </label>
              </div>

              {/* Title & Exam Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Exam Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Midterm Comprehensive Exam"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Exam Type *
                  </label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {EXAM_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Times */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Exam Date *
                  </label>
                  <input
                    type="date"
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={createStartTime}
                    onChange={(e) => setCreateStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={createEndTime}
                    onChange={(e) => setCreateEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Description / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional notes for offline exam conducting or syllabus coverage..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Exam Subjects Configuration */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Exam Subjects & Marks Configuration *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSubjectRow}
                    className="inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Subject
                  </button>
                </div>

                <div className="space-y-2">
                  {createSubjectRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <div className="flex-1 min-w-[140px]">
                        <select
                          value={row.subject_id}
                          onChange={(e) => handleSubjectRowChange(idx, 'subject_id', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                        >
                          {availableSubjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name} ({sub.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-20">
                        <label className="block text-[10px] text-slate-400 font-semibold uppercase">Max</label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={row.max_marks}
                          onChange={(e) => handleSubjectRowChange(idx, 'max_marks', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                        />
                      </div>

                      <div className="w-20">
                        <label className="block text-[10px] text-slate-400 font-semibold uppercase">Pass</label>
                        <input
                          type="number"
                          min={0}
                          max={row.max_marks}
                          value={row.passing_marks}
                          onChange={(e) => handleSubjectRowChange(idx, 'passing_marks', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSubjectRow(idx)}
                        disabled={createSubjectRows.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-20 transition-colors mt-3"
                        title="Remove Subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateExam}
                disabled={isCreating}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-50 inline-flex items-center"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Exam...
                  </>
                ) : (
                  'Create Exam'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MARKS ENTRY MODAL */}
      {activeExamForMarks && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[94vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Edit3 className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold">Marks & Attendance Evaluation</h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeExamForMarks.title} • {activeExamForMarks.board?.name} • {activeExamForMarks.class_level?.display_name}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveExamForMarks(null);
                  setRoster([]);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subject Selector Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Select Subject:
                </span>
                <select
                  value={selectedExamSubjectId}
                  onChange={(e) => {
                    setSelectedExamSubjectId(e.target.value);
                    loadSubjectRoster(activeExamForMarks.id, e.target.value);
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none"
                >
                  {(activeExamForMarks.exam_subjects || []).map((es) => (
                    <option key={es.id} value={es.id}>
                      {es.subject?.name} (Max: {es.max_marks} | Pass: {es.passing_marks})
                    </option>
                  ))}
                </select>
              </div>

              {activeSubjectDetail && (
                <div className="text-xs text-slate-600 flex items-center space-x-3">
                  <span className="font-semibold text-slate-800">
                    Max Marks: <strong className="text-indigo-600">{activeSubjectDetail.max_marks}</strong>
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-slate-800">
                    Passing: <strong className="text-emerald-700">{activeSubjectDetail.passing_marks}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Alerts & Messages */}
            <div className="px-6 pt-3">
              {rosterError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{rosterError}</span>
                </div>
              )}
              {marksSuccessMessage && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs border border-emerald-200 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{marksSuccessMessage}</span>
                </div>
              )}
            </div>

            {/* Student Roster Table */}
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingRoster ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-medium text-slate-600">Loading student roster and existing scores...</p>
                </div>
              ) : roster.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-sm font-medium">No eligible students found enrolled in this academic context.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Roll</th>
                        <th className="py-2.5 px-4">Student</th>
                        <th className="py-2.5 px-3">Attendance</th>
                        <th className="py-2.5 px-3 text-center">Marks</th>
                        <th className="py-2.5 px-3 text-center">Pass/Fail</th>
                        <th className="py-2.5 px-4">Teacher Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {roster.map((row) => {
                        const isPresent = row.attendance_status === 'present';
                        const max = activeSubjectDetail?.max_marks || 100;
                        const isInvalidMarks =
                          isPresent &&
                          row.obtained_marks !== null &&
                          (row.obtained_marks < 0 || row.obtained_marks > max);

                        return (
                          <tr key={row.student_id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-xs font-semibold text-slate-500">
                              {row.roll_number || '—'}
                            </td>
                            <td className="py-2.5 px-4">
                              <p className="font-semibold text-slate-900 leading-tight">{row.student_name}</p>
                              <p className="text-[11px] text-slate-400">{row.admission_number}</p>
                            </td>
                            <td className="py-2.5 px-3">
                              <select
                                value={row.attendance_status}
                                onChange={(e) =>
                                  handleRosterAttendanceChange(row.student_id, e.target.value as any)
                                }
                                className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-semibold focus:outline-none"
                              >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="exempted">Exempted</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isPresent ? (
                                <div className="inline-flex flex-col items-center">
                                  <input
                                    type="number"
                                    min={0}
                                    max={max}
                                    placeholder={`/ ${max}`}
                                    value={row.obtained_marks !== null ? row.obtained_marks : ''}
                                    onChange={(e) =>
                                      handleRosterMarksChange(row.student_id, e.target.value)
                                    }
                                    className={`w-20 px-2 py-1 text-center font-bold text-sm border rounded-lg focus:outline-none ${
                                      isInvalidMarks
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : 'border-slate-200 bg-white text-slate-900'
                                    }`}
                                  />
                                  {isInvalidMarks && (
                                    <span className="text-[10px] text-red-600 font-bold mt-0.5">
                                      Max {max}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-500">
                                  {row.attendance_status.toUpperCase()}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {row.result_status === 'passed' ? (
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  PASS
                                </span>
                              ) : row.result_status === 'failed' ? (
                                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                  FAIL
                                </span>
                              ) : row.result_status === 'absent' ? (
                                <span className="text-xs text-red-500 font-semibold">ABSENT</span>
                              ) : row.result_status === 'exempted' ? (
                                <span className="text-xs text-slate-500 font-semibold">EXEMPT</span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                placeholder="Optional feedback..."
                                value={row.remarks || ''}
                                onChange={(e) =>
                                  handleRosterRemarksChange(row.student_id, e.target.value)
                                }
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-700"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer with Actions */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {roster.length} students enrolled in this examination roster
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveExamForMarks(null);
                    setRoster([]);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveMarks}
                  disabled={isSavingMarks || roster.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-50 inline-flex items-center"
                >
                  {isSavingMarks ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Marks...
                    </>
                  ) : (
                    'Save Marks'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
