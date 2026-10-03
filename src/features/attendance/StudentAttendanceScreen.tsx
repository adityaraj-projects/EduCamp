import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { studentService } from '../../services/studentService';
import { attendanceService } from '../../services/attendanceService';
import type { Student } from '../../types/student';
import type { AttendanceRecordDetail, StudentAttendanceSummary } from '../../types/attendance';
import { ArrowLeft, Calendar, Award, ShieldCheck } from 'lucide-react';

export const StudentAttendanceScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [student, setStudent] = useState<Student | null>(null);
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [history, setHistory] = useState<AttendanceRecordDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadStudentAttendance() {
      if (!user) return;
      setIsLoading(true);
      try {
        const studentRecord = await studentService.getStudentByProfileId(user.id);
        if (!isMounted) return;
        setStudent(studentRecord);

        if (studentRecord) {
          const [summaryData, historyData] = await Promise.all([
            attendanceService.getStudentAttendanceSummary(studentRecord.id),
            attendanceService.getStudentAttendanceHistory(studentRecord.id),
          ]);

          if (!isMounted) return;
          setSummary(summaryData);
          setHistory(historyData);
        }
      } catch (err) {
        console.error('Error loading student attendance:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStudentAttendance();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return { bg: 'rgba(16, 185, 129, 0.2)', border: '#10B981', text: '#34D399', label: 'Present' };
      case 'absent':
        return { bg: 'rgba(239, 68, 68, 0.2)', border: '#EF4444', text: '#F87171', label: 'Absent' };
      case 'late':
        return { bg: 'rgba(245, 158, 11, 0.2)', border: '#F59E0B', text: '#FBBF24', label: 'Late' };
      case 'leave':
        return { bg: 'rgba(59, 130, 246, 0.2)', border: '#3B82F6', text: '#60A5FA', label: 'Leave' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.2)', border: '#9CA3AF', text: '#D1D5DB', label: status };
    }
  };

  const getScoreColor = (pct: number) => {
    if (pct >= 85) return '#10B981';
    if (pct >= 75) return '#34D399';
    if (pct >= 65) return '#F59E0B';
    return '#EF4444';
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
      {/* Top Header */}
      <header
        style={{
          background: 'rgba(22, 17, 58, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
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
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)' }}>
            My Attendance Record
          </h1>
          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
            {profile?.full_name || 'Student Portal'} {student ? `• ${student.admission_number}` : ''}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '640px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
            <div className="spinner" style={{ margin: '0 auto 12px auto' }} />
            Loading attendance records...
          </div>
        ) : !student ? (
          <div
            style={{
              textAlign: 'center',
              padding: '36px 20px',
              background: 'rgba(26, 21, 64, 0.4)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#9CA3AF',
            }}
          >
            <ShieldCheck size={36} color="#EC4899" style={{ marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Student Profile Pending</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
              Your student profile has not been linked yet. Please contact administration for enrollment.
            </p>
          </div>
        ) : (
          <>
            {/* Overall Attendance Summary Score Card */}
            <section
              style={{
                background: 'rgba(26, 21, 64, 0.8)',
                borderRadius: '18px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#A09CB8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                    Overall Attendance
                  </span>
                  <div
                    style={{
                      fontSize: '36px',
                      fontWeight: 800,
                      color: getScoreColor(summary?.attendance_percentage || 0),
                      fontFamily: 'var(--font-display)',
                      marginTop: '4px',
                    }}
                  >
                    {summary?.attendance_percentage ?? 0}%
                  </div>
                </div>

                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Award size={28} color="#A5B4FC" />
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <div style={{ background: '#130E38', padding: '10px 8px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10.5px', color: '#9CA3AF' }}>Total</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                    {summary?.total_classes || 0}
                  </div>
                </div>

                <div style={{ background: '#130E38', padding: '10px 8px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10.5px', color: '#34D399' }}>Present</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#34D399', marginTop: '2px' }}>
                    {summary?.present || 0}
                  </div>
                </div>

                <div style={{ background: '#130E38', padding: '10px 8px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10.5px', color: '#F87171' }}>Absent</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#F87171', marginTop: '2px' }}>
                    {summary?.absent || 0}
                  </div>
                </div>

                <div style={{ background: '#130E38', padding: '10px 8px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10.5px', color: '#FBBF24' }}>Late/Lv</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#FBBF24', marginTop: '2px' }}>
                    {(summary?.late || 0) + (summary?.leave || 0)}
                  </div>
                </div>
              </div>
            </section>

            {/* Attendance History Section */}
            <section>
              <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#E0E7FF' }}>
                Daily History
              </h2>

              {history.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '36px 20px',
                    background: 'rgba(26, 21, 64, 0.4)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#9CA3AF',
                  }}
                >
                  <Calendar size={32} color="#6366F1" style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>No attendance sessions marked yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {history.map((record) => {
                    const badge = getStatusBadge(record.status);
                    return (
                      <div
                        key={record.id}
                        style={{
                          background: 'rgba(26, 21, 64, 0.7)',
                          borderRadius: '14px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                            {record.session?.attendance_date || 'Date'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                            {record.session?.batch?.name || 'Class Batch'}
                            {record.session?.subject ? ` • ${record.session.subject.name}` : ''}
                          </div>
                          {record.remarks && (
                            <div style={{ fontSize: '11px', color: '#A5B4FC', marginTop: '4px', fontStyle: 'italic' }}>
                              Note: {record.remarks}
                            </div>
                          )}
                        </div>

                        <span
                          style={{
                            background: badge.bg,
                            border: `1px solid ${badge.border}`,
                            color: badge.text,
                            padding: '4px 10px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            flexShrink: 0,
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};
