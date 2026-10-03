import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { assignmentService } from '../../services/assignmentService';
import { materialService, TeacherAssignmentContext } from '../../services/materialService';
import type {
  AssignmentDetail,
  AssignmentSubmissionDetail,
  AssignmentStatus,
} from '../../types/assignment';
import { DEFAULT_PAGE_SIZE } from '../../types/assignment';
import {
  ArrowLeft,
  Plus,
  Search,
  ExternalLink,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Upload,
  FileCheck,
  Users,
  X,
  FileText,
} from 'lucide-react';

export const TeacherAssignmentsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const isAdmin = role === 'admin';

  // Assignments & Filter State
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Teacher Assignments Contexts
  const [contexts, setContexts] = useState<TeacherAssignmentContext[]>([]);
  const [selectedContextId, setSelectedContextId] = useState<string>('');

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [createDueDate, setCreateDueDate] = useState<string>('');
  const [createMaxMarks, setCreateMaxMarks] = useState<string>('20');
  const [createAllowLate, setCreateAllowLate] = useState<boolean>(false);
  const [createApplyAllBatches, setCreateApplyAllBatches] = useState<boolean>(false);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Review Submissions Modal State
  const [activeAssignmentForReview, setActiveAssignmentForReview] = useState<AssignmentDetail | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmissionDetail[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState<boolean>(false);
  const [reviewMarksMap, setReviewMarksMap] = useState<Record<string, string>>({});
  const [reviewFeedbackMap, setReviewFeedbackMap] = useState<Record<string, string>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState<string | null>(null);

  // 1. Load Teaching Assignments Context
  useEffect(() => {
    let isMounted = true;
    async function loadTeacherContexts() {
      if (!user) return;
      try {
        const list = await materialService.getTeacherAssignments(user.id, isAdmin);
        if (isMounted) {
          setContexts(list);
          if (list.length > 0 && !selectedContextId) {
            setSelectedContextId(list[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load contexts:', err);
      }
    }
    loadTeacherContexts();
    return () => {
      isMounted = false;
    };
  }, [user, isAdmin]);

  // 2. Load Assignments
  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await assignmentService.getAssignments({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        searchQuery: searchQuery.trim() || undefined,
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
      });

      setAssignments(res.data);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.count);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading assignments';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery, currentPage]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Handle Create Assignment
  const handleCreateAssignment = async (status: 'draft' | 'published') => {
    if (!user) return;
    if (!createTitle.trim()) {
      setCreateError('Please enter an assignment title.');
      return;
    }
    if (!createDueDate) {
      setCreateError('Please choose a valid submission deadline.');
      return;
    }

    const context = contexts.find((c) => c.id === selectedContextId);
    if (!context) {
      setCreateError('Please select a valid academic class assignment.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const maxMarksVal = createMaxMarks ? parseFloat(createMaxMarks) : null;
      await assignmentService.createAssignment(
        {
          title: createTitle.trim(),
          description: createDescription.trim() || undefined,
          academic_year_id: context.academic_year_id,
          board_id: context.board_id,
          class_level_id: context.class_level_id,
          stream_id: context.stream_id,
          subject_id: context.subject_id,
          batch_id: createApplyAllBatches ? null : context.batch_id,
          due_at: new Date(createDueDate).toISOString(),
          max_marks: maxMarksVal,
          allow_late_submission: createAllowLate,
          status,
        },
        createFile,
        user.id
      );

      // Reset
      setIsCreateModalOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateDueDate('');
      setCreateFile(null);
      loadAssignments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create assignment';
      setCreateError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  // Status Change (Publish / Close / Archive)
  const handleUpdateStatus = async (assignmentId: string, newStatus: AssignmentStatus) => {
    try {
      await assignmentService.updateAssignmentStatus(assignmentId, newStatus);
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, status: newStatus } : a))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      alert(msg);
    }
  };

  // Open Submissions Review Drawer
  const handleOpenReview = async (assignment: AssignmentDetail) => {
    setActiveAssignmentForReview(assignment);
    setIsLoadingSubmissions(true);
    setReviewError(null);
    setReviewSuccessMessage(null);
    try {
      const list = await assignmentService.getSubmissionsForAssignment(assignment.id);
      setSubmissions(list);

      // Pre-fill existing marks and feedback maps
      const marksMap: Record<string, string> = {};
      const feedbackMap: Record<string, string> = {};
      list.forEach((s) => {
        if (s.marks !== null) marksMap[s.id] = String(s.marks);
        if (s.feedback) feedbackMap[s.id] = s.feedback;
      });
      setReviewMarksMap(marksMap);
      setReviewFeedbackMap(feedbackMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load submissions';
      setReviewError(msg);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Save Single Submission Review
  const handleSaveReview = async (submissionId: string) => {
    if (!user || !activeAssignmentForReview) return;
    const rawMarks = reviewMarksMap[submissionId];
    const feedback = reviewFeedbackMap[submissionId] || '';

    let marksNum: number | null = null;
    if (rawMarks !== undefined && rawMarks.trim() !== '') {
      marksNum = parseFloat(rawMarks);
      if (isNaN(marksNum) || marksNum < 0) {
        setReviewError('Marks must be a non-negative number.');
        return;
      }
      if (
        activeAssignmentForReview.max_marks !== null &&
        marksNum > activeAssignmentForReview.max_marks
      ) {
        setReviewError(
          `Marks cannot exceed maximum marks (${activeAssignmentForReview.max_marks}).`
        );
        return;
      }
    }

    setSavingSubmissionId(submissionId);
    setReviewError(null);
    try {
      const updated = await assignmentService.reviewSubmission(
        {
          submission_id: submissionId,
          marks: marksNum,
          feedback,
        },
        user.id
      );

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? { ...s, marks: updated.marks, feedback: updated.feedback, status: 'reviewed' }
            : s
        )
      );
      setReviewSuccessMessage('Evaluation saved successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save review';
      setReviewError(msg);
    } finally {
      setSavingSubmissionId(null);
    }
  };

  // Open Attachment in new tab
  const handleOpenAttachment = async (path: string) => {
    try {
      const url = await assignmentService.getAttachmentDownloadUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load document';
      alert(msg);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0B0826',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        paddingBottom: '40px',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: 'rgba(22, 17, 58, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '10px',
              padding: '8px',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.3px',
              }}
            >
              Assignments & Evaluation
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
              {isAdmin ? 'Academic Administration' : 'Faculty Coursework Portal'} • {totalCount} total
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            setIsCreateModalOpen(true);
            setCreateError(null);
          }}
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 14px',
            color: '#FFFFFF',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
          }}
        >
          <Plus size={16} />
          <span>New Assignment</span>
        </button>
      </header>

      <main
        style={{
          maxWidth: '820px',
          width: '100%',
          margin: '0 auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxSizing: 'border-box',
        }}
      >
        {/* Search & Filter Bar */}
        <div
          style={{
            background: 'rgba(22, 17, 58, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '14px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              flex: '1 1 240px',
              display: 'flex',
              alignItems: 'center',
              background: '#0B0826',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '8px 12px',
              gap: '10px',
            }}
          >
            <Search size={16} color="#9CA3AF" />
            <input
              type="text"
              placeholder="Search assignments by title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13px',
                width: '100%',
                outline: 'none',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            style={{
              background: '#0B0826',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '12.5px',
              outline: 'none',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #EF4444',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#FCA5A5',
              fontSize: '13px',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Assignments List */}
        {isLoading ? (
          <div
            style={{
              padding: '48px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: '#9CA3AF',
            }}
          >
            <Loader2 size={32} className="animate-spin" color="#8B5CF6" />
            <span style={{ fontSize: '13px' }}>Loading assignments catalog...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div
            style={{
              background: 'rgba(22, 17, 58, 0.5)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <FileText size={40} color="#6B7280" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>No Assignments Created</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF' }}>
              Click "New Assignment" above to draft or publish your first coursework task.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {assignments.map((a) => {
              const isPastDue = new Date() > new Date(a.due_at);

              return (
                <div
                  key={a.id}
                  style={{
                    background: 'rgba(22, 17, 58, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Top Bar: Subject, Class, Status */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Status Badge */}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background:
                            a.status === 'published'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : a.status === 'draft'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(107, 114, 128, 0.2)',
                          border: `1px solid ${
                            a.status === 'published'
                              ? '#10B981'
                              : a.status === 'draft'
                              ? '#F59E0B'
                              : '#6B7280'
                          }`,
                          color:
                            a.status === 'published'
                              ? '#34D399'
                              : a.status === 'draft'
                              ? '#FCD34D'
                              : '#9CA3AF',
                          borderRadius: '8px',
                          padding: '2px 8px',
                        }}
                      >
                        {a.status}
                      </span>

                      {a.board && a.class_level && (
                        <span
                          style={{
                            fontSize: '11.5px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#E0E7FF',
                            padding: '2px 8px',
                            borderRadius: '8px',
                          }}
                        >
                          {a.board.code} • {a.class_level.display_name}
                        </span>
                      )}

                      {a.subject && (
                        <span
                          style={{
                            fontSize: '11.5px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#A5B4FC',
                            padding: '2px 8px',
                            borderRadius: '8px',
                          }}
                        >
                          {a.subject.name}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: isPastDue ? '#FCA5A5' : '#A09CB8',
                      }}
                    >
                      <Clock size={13} />
                      <span>
                        Due: {new Date(a.due_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>{a.title}</h3>
                    {a.description && (
                      <p style={{ margin: 0, fontSize: '12.5px', color: '#A09CB8', lineHeight: 1.4 }}>
                        {a.description}
                      </p>
                    )}
                  </div>

                  {/* Attachment & Batch Details */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '11.5px',
                      color: '#9CA3AF',
                    }}
                  >
                    <div>
                      {a.batch ? (
                        <span style={{ color: '#F472B6' }}>Target Batch: {a.batch.name}</span>
                      ) : (
                        <span style={{ color: '#6EE7B7' }}>Available to All Batches</span>
                      )}
                      {a.max_marks && (
                        <>
                          <span style={{ margin: '0 8px' }}>•</span>
                          <span style={{ color: '#FCD34D' }}>Max Marks: {a.max_marks}</span>
                        </>
                      )}
                    </div>

                    {a.attachment_path && (
                      <button
                        type="button"
                        onClick={() => handleOpenAttachment(a.attachment_path!)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#A5B4FC',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          textDecoration: 'underline',
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>{a.attachment_file_name || 'View Brief PDF'}</span>
                      </button>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      paddingTop: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {a.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(a.id, 'published')}
                          style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid #10B981',
                            borderRadius: '8px',
                            padding: '4px 10px',
                            color: '#34D399',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Publish to Students
                        </button>
                      )}

                      {a.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(a.id, 'closed')}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid #EF4444',
                            borderRadius: '8px',
                            padding: '4px 10px',
                            color: '#FCA5A5',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Close Submissions
                        </button>
                      )}
                    </div>

                    {/* Review Submissions CTA */}
                    <button
                      type="button"
                      onClick={() => handleOpenReview(a)}
                      style={{
                        background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 10px rgba(236, 72, 153, 0.3)',
                      }}
                    >
                      <Users size={14} />
                      <span>Review Submissions</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '16px 0',
            }}
          >
            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: currentPage <= 1 ? '#6B7280' : '#FFFFFF',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
              }}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: currentPage >= totalPages ? '#6B7280' : '#FFFFFF',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
              }}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>

      {/* CREATE ASSIGNMENT MODAL */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#16113A',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Create New Coursework Assignment
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #EF4444',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#FCA5A5',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} />
                <span>{createError}</span>
              </div>
            )}

            {/* Academic Context */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB' }}>
                Academic Context / Subject Assignment <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={selectedContextId}
                onChange={(e) => setSelectedContextId(e.target.value)}
                style={{
                  background: '#0B0826',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              >
                {contexts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.board_name} • {c.class_name} • {c.subject_name} ({c.batch_name})
                  </option>
                ))}
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#D1D5DB' }}>
              <input
                type="checkbox"
                checked={createApplyAllBatches}
                onChange={(e) => setCreateApplyAllBatches(e.target.checked)}
                style={{ accentColor: '#8B5CF6' }}
              />
              <span>Target all batches of this class level</span>
            </label>

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB' }}>
                Title <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Chapter 4: Quadratic Equations Problem Set"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                style={{
                  background: '#0B0826',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB' }}>
                Instructions / Description
              </label>
              <textarea
                rows={2}
                placeholder="Detailed instructions, formatting guidelines or reference questions..."
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                style={{
                  background: '#0B0826',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Due Date & Max Marks */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB' }}>
                  Submission Deadline <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                  style={{
                    background: '#0B0826',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB' }}>
                  Max Marks
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={createMaxMarks}
                  onChange={(e) => setCreateMaxMarks(e.target.value)}
                  style={{
                    background: '#0B0826',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#D1D5DB' }}>
              <input
                type="checkbox"
                checked={createAllowLate}
                onChange={(e) => setCreateAllowLate(e.target.checked)}
                style={{ accentColor: '#8B5CF6' }}
              />
              <span>Allow late submissions after deadline</span>
            </label>

            {/* Optional Assignment Brief PDF */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB' }}>
                Attach Question Paper / Brief PDF (Optional, max 25 MB)
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setCreateFile(f);
                }}
                style={{ fontSize: '12px', color: '#9CA3AF' }}
              />
              {createFile && (
                <div style={{ fontSize: '11.5px', color: '#34D399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FileCheck size={14} />
                  <span>{createFile.name} ({(createFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => handleCreateAssignment('draft')}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                }}
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isCreating}
                onClick={() => handleCreateAssignment('published')}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {isCreating ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                <span>Publish Immediately</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW SUBMISSIONS MODAL */}
      {activeAssignmentForReview && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#16113A',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 2px 0', fontSize: '17px', fontWeight: 700 }}>
                  Submission Evaluation & Grading
                </h2>
                <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                  {activeAssignmentForReview.title} • Max Marks:{' '}
                  {activeAssignmentForReview.max_marks || '-'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveAssignmentForReview(null)}
                style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {reviewSuccessMessage && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10B981',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  color: '#34D399',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{reviewSuccessMessage}</span>
              </div>
            )}

            {reviewError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #EF4444',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  color: '#FCA5A5',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} />
                <span>{reviewError}</span>
              </div>
            )}

            {isLoadingSubmissions ? (
              <div style={{ padding: '36px 0', textAlign: 'center', color: '#9CA3AF' }}>
                <Loader2 size={28} className="animate-spin" color="#EC4899" />
                <div style={{ marginTop: '8px', fontSize: '13px' }}>Loading student submissions...</div>
              </div>
            ) : submissions.length === 0 ? (
              <div
                style={{
                  background: 'rgba(22, 17, 58, 0.4)',
                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px',
                  padding: '30px',
                  textAlign: 'center',
                  color: '#9CA3AF',
                  fontSize: '13px',
                }}
              >
                No student submissions have been recorded for this assignment yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {submissions.map((s) => {
                  const isSaving = savingSubmissionId === s.id;

                  return (
                    <div
                      key={s.id}
                      style={{
                        background: 'rgba(22, 17, 58, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '14px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      {/* Student Info & Submission Status */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#FFFFFF' }}>
                            {s.student?.profile?.full_name || 'Enrolled Student'}
                          </span>
                          <span style={{ fontSize: '11.5px', color: '#9CA3AF', marginLeft: '6px' }}>
                            ({s.student?.admission_number})
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background:
                                s.status === 'reviewed'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : s.status === 'late'
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : 'rgba(245, 158, 11, 0.2)',
                              border: `1px solid ${
                                s.status === 'reviewed'
                                  ? '#10B981'
                                  : s.status === 'late'
                                  ? '#EF4444'
                                  : '#F59E0B'
                              }`,
                              color:
                                s.status === 'reviewed'
                                  ? '#34D399'
                                  : s.status === 'late'
                                  ? '#FCA5A5'
                                  : '#FCD34D',
                              borderRadius: '6px',
                              padding: '2px 6px',
                            }}
                          >
                            {s.status}
                          </span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                            {new Date(s.submitted_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Written Response */}
                      {s.text_response && (
                        <div
                          style={{
                            background: '#0B0826',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '8px',
                            padding: '10px',
                            fontSize: '12.5px',
                            color: '#E0E7FF',
                            lineHeight: 1.4,
                          }}
                        >
                          {s.text_response}
                        </div>
                      )}

                      {/* Attachment PDF button */}
                      {s.attachment_path && (
                        <div>
                          <button
                            type="button"
                            onClick={() => handleOpenAttachment(s.attachment_path!)}
                            style={{
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              padding: '4px 10px',
                              color: '#A5B4FC',
                              fontSize: '11.5px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            <ExternalLink size={12} />
                            <span>
                              {s.attachment_file_name || 'Open Student PDF Submission'}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Grading Inputs */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          paddingTop: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <label style={{ fontSize: '11.5px', color: '#D1D5DB', fontWeight: 600 }}>
                            Marks:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={activeAssignmentForReview.max_marks || 500}
                            placeholder={`/ ${activeAssignmentForReview.max_marks || 'Marks'}`}
                            value={reviewMarksMap[s.id] ?? ''}
                            onChange={(e) =>
                              setReviewMarksMap((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                            style={{
                              width: '80px',
                              background: '#0B0826',
                              color: '#FFFFFF',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '8px',
                              padding: '5px 8px',
                              fontSize: '12px',
                              outline: 'none',
                            }}
                          />
                        </div>

                        <div style={{ flex: '1 1 180px' }}>
                          <input
                            type="text"
                            placeholder="Feedback (e.g. Good work! Re-check question 3 calculation)"
                            value={reviewFeedbackMap[s.id] ?? ''}
                            onChange={(e) =>
                              setReviewFeedbackMap((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                            style={{
                              width: '100%',
                              background: '#0B0826',
                              color: '#FFFFFF',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '8px',
                              padding: '5px 10px',
                              fontSize: '12px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveReview(s.id)}
                          style={{
                            background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isSaving ? 'Saving...' : 'Save Evaluation'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
