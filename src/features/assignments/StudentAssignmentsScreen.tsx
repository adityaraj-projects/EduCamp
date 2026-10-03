import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { assignmentService } from '../../services/assignmentService';
import { materialService, StudentEnrollmentContext } from '../../services/materialService';
import type { AssignmentDetail, AssignmentSubmission } from '../../types/assignment';
import { DEFAULT_PAGE_SIZE } from '../../types/assignment';
import {
  ArrowLeft,
  Search,
  ExternalLink,
  BookOpen,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  FileCheck,
  Award,
  X,
} from 'lucide-react';

export const StudentAssignmentsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [enrollment, setEnrollment] = useState<StudentEnrollmentContext | null>(null);
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, AssignmentSubmission>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpeningAttachment, setIsOpeningAttachment] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'submitted' | 'reviewed'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Submission Modal
  const [activeAssignmentForSubmission, setActiveAssignmentForSubmission] = useState<AssignmentDetail | null>(null);
  const [submissionText, setSubmissionText] = useState<string>('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionModalError, setSubmissionModalError] = useState<string | null>(null);
  const [submissionSuccessMessage, setSubmissionSuccessMessage] = useState<string | null>(null);

  // 1. Fetch Student Enrollment
  useEffect(() => {
    let isMounted = true;
    async function loadStudentEnrollment() {
      if (!user) return;
      try {
        const enroll = await materialService.getStudentEnrollment(user.id);
        if (isMounted) setEnrollment(enroll);
      } catch (err) {
        console.error('Failed to load student enrollment:', err);
      }
    }
    loadStudentEnrollment();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // 2. Fetch Assignments & Existing Submissions
  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await assignmentService.getAssignments({
        academic_year_id: enrollment?.academic_year_id,
        board_id: enrollment?.board_id,
        class_level_id: enrollment?.class_level_id,
        batch_id: enrollment?.batch_id,
        searchQuery: searchQuery.trim() || undefined,
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
      });

      setAssignments(res.data);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.count);

      // Fetch user's submission state for each visible assignment
      if (user && res.data.length > 0) {
        const map: Record<string, AssignmentSubmission> = {};
        await Promise.all(
          res.data.map(async (asgn) => {
            const sub = await assignmentService.getStudentSubmission(asgn.id, user.id);
            if (sub) {
              map[asgn.id] = sub;
            }
          })
        );
        setSubmissionsMap(map);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading assignments';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [enrollment, searchQuery, currentPage, user]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Open Brief Attachment
  const handleOpenAttachment = async (path: string, id: string) => {
    setIsOpeningAttachment(id);
    try {
      const url = await assignmentService.getAttachmentDownloadUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to open attachment';
      alert(msg);
    } finally {
      setIsOpeningAttachment(null);
    }
  };

  // Open Submission Modal
  const handleOpenSubmitModal = (assignment: AssignmentDetail) => {
    setActiveAssignmentForSubmission(assignment);
    const existing = submissionsMap[assignment.id];
    setSubmissionText(existing?.text_response || '');
    setSubmissionFile(null);
    setSubmissionModalError(null);
    setSubmissionSuccessMessage(null);
  };

  // Submit Homework
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeAssignmentForSubmission) return;

    if (!submissionText.trim() && !submissionFile) {
      setSubmissionModalError('Please enter your written answer or upload a homework PDF.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionModalError(null);
    try {
      const result = await assignmentService.submitAssignment(
        {
          assignment_id: activeAssignmentForSubmission.id,
          text_response: submissionText.trim() || undefined,
        },
        submissionFile,
        user.id
      );

      setSubmissionsMap((prev) => ({ ...prev, [activeAssignmentForSubmission.id]: result }));
      setSubmissionSuccessMessage('Homework submitted successfully!');
      setTimeout(() => {
        setActiveAssignmentForSubmission(null);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setSubmissionModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client Filter by submission status
  const filteredAssignments = assignments.filter((a) => {
    const sub = submissionsMap[a.id];
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return !sub;
    if (statusFilter === 'submitted') return sub && sub.status !== 'reviewed';
    if (statusFilter === 'reviewed') return sub && sub.status === 'reviewed';
    return true;
  });

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
      {/* Top Header */}
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
              Assignments & Homework
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
              Submit coursework, view deadlines & teacher evaluation
            </p>
          </div>
        </div>

        {/* Security Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10B981',
            borderRadius: '20px',
            padding: '4px 10px',
            fontSize: '11px',
            color: '#34D399',
            fontWeight: 600,
          }}
        >
          <ShieldCheck size={14} />
          <span>Encrypted Submissions</span>
        </div>
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
        {/* Enrolled Context Badge */}
        {enrollment && (
          <div
            style={{
              background: 'rgba(33, 26, 69, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={16} color="#EC4899" />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                {enrollment.board_name} • {enrollment.class_name}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  background: 'rgba(236, 72, 153, 0.2)',
                  color: '#F472B6',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                {enrollment.batch_name}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
              {totalCount} {totalCount === 1 ? 'assignment' : 'assignments'} published
            </span>
          </div>
        )}

        {/* Search & Status Filter Tabs */}
        <div
          style={{
            background: 'rgba(22, 17, 58, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
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
              placeholder="Search assignments by topic or title..."
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

          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'pending', label: 'Pending Submission' },
              { id: 'submitted', label: 'Submitted / Awaiting Review' },
              { id: 'reviewed', label: 'Reviewed & Graded' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '10px',
                  border: statusFilter === tab.id ? '1px solid #8B5CF6' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: statusFilter === tab.id ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  color: statusFilter === tab.id ? '#DDD6FE' : '#9CA3AF',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
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

        {/* Assignment List */}
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
            <Loader2 size={32} className="animate-spin" color="#EC4899" />
            <span style={{ fontSize: '13px' }}>Loading coursework assignments...</span>
          </div>
        ) : filteredAssignments.length === 0 ? (
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
            <CheckCircle2 size={40} color="#10B981" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>No Assignments Found</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', maxWidth: '380px' }}>
              You are all caught up! When teachers assign new homework or problem sets, they will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredAssignments.map((a) => {
              const sub = submissionsMap[a.id];
              const isOverdue = new Date() > new Date(a.due_at) && !sub;

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
                  {/* Top Badges */}
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
                      {a.subject && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid #6366F1',
                            color: '#A5B4FC',
                            borderRadius: '8px',
                            padding: '2px 8px',
                          }}
                        >
                          {a.subject.name}
                        </span>
                      )}

                      {/* Submission Status Badge */}
                      {sub ? (
                        sub.status === 'reviewed' ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.2)',
                              border: '1px solid #10B981',
                              color: '#34D399',
                              borderRadius: '8px',
                              padding: '2px 8px',
                            }}
                          >
                            Evaluated
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'rgba(245, 158, 11, 0.2)',
                              border: '1px solid #F59E0B',
                              color: '#FCD34D',
                              borderRadius: '8px',
                              padding: '2px 8px',
                            }}
                          >
                            Submitted ({sub.status === 'late' ? 'Late' : 'On Time'})
                          </span>
                        )
                      ) : isOverdue ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid #EF4444',
                            color: '#FCA5A5',
                            borderRadius: '8px',
                            padding: '2px 8px',
                          }}
                        >
                          Overdue
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            background: 'rgba(107, 114, 128, 0.2)',
                            border: '1px solid #6B7280',
                            color: '#D1D5DB',
                            borderRadius: '8px',
                            padding: '2px 8px',
                          }}
                        >
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Deadline */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        color: isOverdue ? '#F87171' : '#A09CB8',
                      }}
                    >
                      <Clock size={13} />
                      <span>
                        Due:{' '}
                        {new Date(a.due_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Title & Instructions */}
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700 }}>{a.title}</h3>
                    {a.description && (
                      <p style={{ margin: 0, fontSize: '12.5px', color: '#A09CB8', lineHeight: 1.4 }}>
                        {a.description}
                      </p>
                    )}
                  </div>

                  {/* Attachment & Max Marks Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      fontSize: '12px',
                      color: '#9CA3AF',
                    }}
                  >
                    {a.attachment_path && (
                      <button
                        type="button"
                        disabled={isOpeningAttachment === a.id}
                        onClick={() => handleOpenAttachment(a.attachment_path!, a.id)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          color: '#E0E7FF',
                          fontSize: '11.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>
                          {a.attachment_file_name || 'Download Assignment Brief (PDF)'}
                        </span>
                      </button>
                    )}

                    {a.max_marks && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FCD34D' }}>
                        <Award size={14} />
                        Max Marks: {a.max_marks}
                      </span>
                    )}
                  </div>

                  {/* Teacher Evaluation Result Card if Reviewed */}
                  {sub && sub.status === 'reviewed' && (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#34D399' }}>
                          Faculty Evaluation
                        </span>
                        {sub.marks !== null && (
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#34D399' }}>
                            Score: {sub.marks} / {a.max_marks || '-'}
                          </span>
                        )}
                      </div>
                      {sub.feedback && (
                        <p style={{ margin: 0, fontSize: '12px', color: '#D1FAE5', fontStyle: 'italic' }}>
                          "{sub.feedback}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Footer Action */}
                  <div
                    style={{
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      paddingTop: '10px',
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenSubmitModal(a)}
                      style={{
                        background: sub
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '7px 16px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Send size={13} />
                      <span>{sub ? 'Update / Resubmit Work' : 'Submit Homework'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
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

      {/* Submission Modal */}
      {activeAssignmentForSubmission && (
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
              maxWidth: '520px',
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
                Submit Assignment
              </h2>
              <button
                type="button"
                onClick={() => setActiveAssignmentForSubmission(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#E0E7FF' }}>
                {activeAssignmentForSubmission.title}
              </div>
              <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                Subject: {activeAssignmentForSubmission.subject?.name} • Due:{' '}
                {new Date(activeAssignmentForSubmission.due_at).toLocaleDateString()}
              </div>
            </div>

            {submissionSuccessMessage && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10B981',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#34D399',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{submissionSuccessMessage}</span>
              </div>
            )}

            {submissionModalError && (
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
                <span>{submissionModalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitWork} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Written Text Response */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB' }}>
                  Written Response / Explanation
                </label>
                <textarea
                  rows={4}
                  placeholder="Type your notes, solution summary, or response..."
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  style={{
                    background: '#0B0826',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '10px',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* PDF Document Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB' }}>
                  Upload Homework PDF (Optional, Max 25 MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSubmissionFile(f);
                  }}
                  style={{
                    fontSize: '12px',
                    color: '#9CA3AF',
                  }}
                />
                {submissionFile && (
                  <div style={{ fontSize: '11.5px', color: '#34D399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileCheck size={14} />
                    <span>{submissionFile.name} ({(submissionFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Uploading & Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Confirm & Submit Work</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
