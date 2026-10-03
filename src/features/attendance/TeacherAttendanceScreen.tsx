import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { academicService } from '../../services/academicService';
import { attendanceService } from '../../services/attendanceService';
import type { Batch, AcademicYear } from '../../types/academic';
import type { BatchStudentRosterItem, AttendanceStatus } from '../../types/attendance';
import { ArrowLeft, CheckCircle2, AlertCircle, Save, Users, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const TeacherAttendanceScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedSubjectId] = useState<string>('');

  const [roster, setRoster] = useState<BatchStudentRosterItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Load initial academic year and batches
  useEffect(() => {
    let isMounted = true;
    async function loadMasterData() {
      setIsLoadingBatches(true);
      try {
        const year = await academicService.getActiveAcademicYear();
        if (!isMounted) return;
        setAcademicYear(year);

        if (year) {
          // Fetch batches for this year
          const fetchedBatches = await academicService.getAllActiveBatches(year.id);
          if (!isMounted) return;
          setBatches(fetchedBatches);
          if (fetchedBatches.length > 0) {
            setSelectedBatchId(fetchedBatches[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load attendance master data:', err);
      } finally {
        if (isMounted) setIsLoadingBatches(false);
      }
    }

    loadMasterData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Load roster when batch, date, or subject changes
  const loadRoster = useCallback(async () => {
    if (!selectedBatchId || !selectedDate) return;
    setIsLoadingRoster(true);
    setMessage(null);
    try {
      const { session, roster: items } = await attendanceService.getBatchRosterForDate(
        selectedBatchId,
        selectedDate,
        selectedSubjectId || null
      );
      setRoster(items);
      setNotes(session?.notes || '');
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load students' });
    } finally {
      setIsLoadingRoster(false);
    }
  }, [selectedBatchId, selectedDate, selectedSubjectId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Status counters
  const counts = {
    total: roster.length,
    present: roster.filter((r) => r.status === 'present').length,
    absent: roster.filter((r) => r.status === 'absent').length,
    late: roster.filter((r) => r.status === 'late').length,
    leave: roster.filter((r) => r.status === 'leave').length,
    unmarked: roster.filter((r) => r.status === 'unmarked').length,
  };

  // Mark individual student
  const handleMarkStatus = (enrollmentId: string, status: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((item) =>
        item.enrollment_id === enrollmentId ? { ...item, status } : item
      )
    );
    setHasUnsavedChanges(true);
  };

  // Mark all unmarked students as Present
  const handleMarkAllPresent = () => {
    setRoster((prev) =>
      prev.map((item) => ({
        ...item,
        status: item.status === 'unmarked' ? 'present' : item.status,
      }))
    );
    setHasUnsavedChanges(true);
  };

  // Submit attendance atomically
  const handleSubmit = async () => {
    if (!academicYear || !selectedBatchId) return;

    if (counts.unmarked > 0) {
      if (!window.confirm(`There are still ${counts.unmarked} unmarked students. Proceed to submit?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    setMessage(null);

    const validRecords = roster
      .filter((r) => r.status !== 'unmarked')
      .map((r) => ({
        enrollment_id: r.enrollment_id,
        student_id: r.student_id,
        status: r.status as AttendanceStatus,
        remarks: r.remarks || null,
      }));

    if (validRecords.length === 0) {
      setMessage({ type: 'error', text: 'Please mark at least one student before submitting.' });
      setIsSubmitting(false);
      return;
    }

    const res = await attendanceService.submitBatchAttendance({
      academic_year_id: academicYear.id,
      batch_id: selectedBatchId,
      attendance_date: selectedDate,
      subject_id: selectedSubjectId || null,
      records: validRecords,
      notes: notes || null,
    });

    setIsSubmitting(false);

    if (res.success) {
      setMessage({
        type: 'success',
        text: `Attendance saved successfully (${res.recordsMarked} records).`,
      });
      setHasUnsavedChanges(false);
    } else {
      setMessage({
        type: 'error',
        text: res.error || 'Failed to submit attendance. Please verify permissions.',
      });
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
        paddingBottom: '80px',
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
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              Mark Batch Attendance
            </h1>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
              Session: {academicYear?.name || 'Loading...'}
            </p>
          </div>
        </div>

        {hasUnsavedChanges && (
          <span
            style={{
              fontSize: '11px',
              color: '#FCD34D',
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid #F59E0B',
              padding: '4px 8px',
              borderRadius: '12px',
              fontWeight: 600,
            }}
          >
            Unsaved Changes
          </span>
        )}
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '640px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
        {/* Controls Card: Batch & Date Picker */}
        <section
          style={{
            background: 'rgba(26, 21, 64, 0.7)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Batch Selector */}
            <div>
              <label style={{ fontSize: '12px', color: '#A09CB8', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                Select Batch
              </label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                disabled={isLoadingBatches}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#130E38',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  outline: 'none',
                }}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selector */}
            <div>
              <label style={{ fontSize: '12px', color: '#A09CB8', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                Attendance Date
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#130E38',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Status Feedback Toast */}
        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${message.type === 'success' ? '#10B981' : '#EF4444'}`,
              color: message.type === 'success' ? '#A7F3D0' : '#FECACA',
              fontSize: '13px',
            }}
          >
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Counter Summary Bar */}
        <section
          style={{
            background: 'rgba(26, 21, 64, 0.5)',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Total: <strong>{counts.total}</strong></span>
            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>
              P: {counts.present}
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.2)', color: '#F87171', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>
              A: {counts.absent}
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>
              L: {counts.late}
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>
              Lv: {counts.leave}
            </span>
          </div>

          {counts.unmarked > 0 && (
            <button
              type="button"
              onClick={handleMarkAllPresent}
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid #6366F1',
                color: '#C7D2FE',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Sparkles size={12} />
              Mark Rest Present
            </button>
          )}
        </section>

        {/* Student Roster List */}
        {isLoadingRoster ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
            <div className="spinner" style={{ margin: '0 auto 12px auto' }} />
            Loading batch roster...
          </div>
        ) : roster.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: 'rgba(26, 21, 64, 0.4)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#9CA3AF',
            }}
          >
            <Users size={36} color="#6366F1" style={{ marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No enrolled students found</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
              Verify that students have active enrollments in this batch for session {academicYear?.name}.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {roster.map((student, idx) => (
              <div
                key={student.enrollment_id}
                style={{
                  background: 'rgba(26, 21, 64, 0.7)',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                {/* Student Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#130E38',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#A5B4FC',
                      flexShrink: 0,
                    }}
                  >
                    {student.roll_number || idx + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {student.student_name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      {student.admission_number}
                    </div>
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {/* Present */}
                  <button
                    type="button"
                    onClick={() => handleMarkStatus(student.enrollment_id, 'present')}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: student.status === 'present' ? '2px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: student.status === 'present' ? '#10B981' : 'rgba(16, 185, 129, 0.1)',
                      color: student.status === 'present' ? '#FFFFFF' : '#34D399',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    P
                  </button>

                  {/* Absent */}
                  <button
                    type="button"
                    onClick={() => handleMarkStatus(student.enrollment_id, 'absent')}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: student.status === 'absent' ? '2px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: student.status === 'absent' ? '#EF4444' : 'rgba(239, 68, 68, 0.1)',
                      color: student.status === 'absent' ? '#FFFFFF' : '#F87171',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    A
                  </button>

                  {/* Late */}
                  <button
                    type="button"
                    onClick={() => handleMarkStatus(student.enrollment_id, 'late')}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: student.status === 'late' ? '2px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: student.status === 'late' ? '#F59E0B' : 'rgba(245, 158, 11, 0.1)',
                      color: student.status === 'late' ? '#FFFFFF' : '#FBBF24',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    L
                  </button>

                  {/* Leave */}
                  <button
                    type="button"
                    onClick={() => handleMarkStatus(student.enrollment_id, 'leave')}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: student.status === 'leave' ? '2px solid #3B82F6' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: student.status === 'leave' ? '#3B82F6' : 'rgba(59, 130, 246, 0.1)',
                      color: student.status === 'leave' ? '#FFFFFF' : '#60A5FA',
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Lv
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Sticky Bottom Action Bar */}
      {roster.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(22, 17, 58, 0.95)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div style={{ maxWidth: '640px', width: '100%' }}>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              isLoading={isSubmitting}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Save size={18} />
                <span>SAVE ATTENDANCE ({counts.total - counts.unmarked}/{counts.total})</span>
              </div>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
