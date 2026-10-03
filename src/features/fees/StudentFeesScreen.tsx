import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { studentService } from '../../services/studentService';
import { feeService } from '../../services/feeService';
import type { Student } from '../../types/student';
import type {
  FeeObligationDetail,
  PaymentDetail,
  StudentFeeSummary,
  PaymentReceiptMetadata,
} from '../../types/fee';
import {
  ArrowLeft,
  Receipt,
  FileText,
  CheckCircle2,
  ShieldCheck,
  X,
} from 'lucide-react';

export const StudentFeesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [student, setStudent] = useState<Student | null>(null);
  const [summary, setSummary] = useState<StudentFeeSummary | null>(null);
  const [obligations, setObligations] = useState<FeeObligationDetail[]>([]);
  const [payments, setPayments] = useState<PaymentDetail[]>([]);
  const [activeTab, setActiveTab] = useState<'obligations' | 'payments'>('obligations');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewingReceipt, setViewingReceipt] = useState<PaymentReceiptMetadata | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadStudentFees() {
      if (!user) return;
      setIsLoading(true);
      try {
        const studentRecord = await studentService.getStudentByProfileId(user.id);
        if (!isMounted) return;
        setStudent(studentRecord);

        if (studentRecord) {
          const [summaryData, obligationsData, paymentsData] = await Promise.all([
            feeService.getStudentFeeSummary(studentRecord.id),
            feeService.getStudentFeeObligations(studentRecord.id),
            feeService.getStudentPaymentHistory(studentRecord.id),
          ]);

          if (!isMounted) return;
          setSummary(summaryData);
          setObligations(obligationsData);
          setPayments(paymentsData);
        }
      } catch (err) {
        console.error('Error loading student fees:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStudentFees();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: 'rgba(16, 185, 129, 0.2)', border: '#10B981', text: '#34D399', label: 'Paid' };
      case 'partial':
        return { bg: 'rgba(245, 158, 11, 0.2)', border: '#F59E0B', text: '#FBBF24', label: 'Partial' };
      case 'unpaid':
        return { bg: 'rgba(239, 68, 68, 0.2)', border: '#EF4444', text: '#F87171', label: 'Unpaid' };
      case 'overdue':
        return { bg: 'rgba(239, 68, 68, 0.3)', border: '#DC2626', text: '#FCA5A5', label: 'Overdue' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.2)', border: '#9CA3AF', text: '#D1D5DB', label: status };
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
          zIndex: 40,
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
            Fee Ledger & Receipts
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
            Loading financial records...
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
              Your student profile has not been linked to financial obligations yet.
            </p>
          </div>
        ) : (
          <>
            {/* Overall Fee Summary Score Card */}
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
              <span style={{ fontSize: '11.5px', color: '#A09CB8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                Total Outstanding Balance
              </span>
              <div
                style={{
                  fontSize: '34px',
                  fontWeight: 800,
                  color: (summary?.outstanding_amount || 0) > 0 ? '#F87171' : '#34D399',
                  fontFamily: 'var(--font-display)',
                  marginTop: '4px',
                }}
              >
                ₹{summary?.outstanding_amount ?? 0}
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                <div style={{ background: '#130E38', padding: '10px 14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Total Expected</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                    ₹{summary?.total_due || 0}
                  </div>
                </div>

                <div style={{ background: '#130E38', padding: '10px 14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#34D399' }}>Total Paid</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#34D399', marginTop: '2px' }}>
                    ₹{summary?.total_paid || 0}
                  </div>
                </div>
              </div>
            </section>

            {/* Sub-tabs: Obligations vs Payments */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                background: 'rgba(26, 21, 64, 0.6)',
                padding: '4px',
                borderRadius: '12px',
                marginBottom: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('obligations')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeTab === 'obligations' ? '#EC4899' : 'transparent',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <FileText size={15} />
                <span>Obligations ({obligations.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('payments')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeTab === 'payments' ? '#EC4899' : 'transparent',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Receipt size={15} />
                <span>Payment Receipts ({payments.length})</span>
              </button>
            </div>

            {/* Tab 1: Obligations List */}
            {activeTab === 'obligations' && (
              <div>
                {obligations.length === 0 ? (
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
                    <CheckCircle2 size={32} color="#10B981" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>No pending fee obligations recorded.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {obligations.map((ob) => {
                      const badge = getStatusBadge(ob.status);
                      return (
                        <div
                          key={ob.id}
                          style={{
                            background: 'rgba(26, 21, 64, 0.7)',
                            borderRadius: '14px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>{ob.title}</div>
                            <div style={{ fontSize: '11.5px', color: '#9CA3AF', marginTop: '2px' }}>
                              Due Date: {ob.due_date}
                            </div>
                            <div style={{ fontSize: '11px', color: '#A09CB8', marginTop: '4px' }}>
                              Paid: ₹{ob.amount_paid} of ₹{ob.amount_due}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                            <span
                              style={{
                                background: badge.bg,
                                border: `1px solid ${badge.border}`,
                                color: badge.text,
                                padding: '3px 8px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.6px',
                              }}
                            >
                              {badge.label}
                            </span>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: ob.remaining_balance > 0 ? '#FCD34D' : '#34D399' }}>
                              {ob.remaining_balance > 0 ? `₹${ob.remaining_balance} Due` : 'Settled'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Payments & Receipts */}
            {activeTab === 'payments' && (
              <div>
                {payments.length === 0 ? (
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
                    <Receipt size={32} color="#6366F1" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>No payment receipts found.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          background: 'rgba(26, 21, 64, 0.7)',
                          borderRadius: '14px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#FCD34D' }}>
                            {p.receipt_number}
                          </div>
                          <div style={{ fontSize: '12px', color: '#FFFFFF', marginTop: '2px' }}>
                            {p.obligation?.title || 'Fee Payment'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                            {p.payment_date} • via {p.payment_method.toUpperCase()}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#34D399' }}>
                            ₹{p.amount}
                          </div>

                          <button
                            type="button"
                            onClick={() => setViewingReceipt(p.receipt_metadata)}
                            style={{
                              background: 'rgba(99, 102, 241, 0.2)',
                              border: '1px solid #6366F1',
                              color: '#C7D2FE',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            View Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Receipt Metadata Modal */}
      {viewingReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 60,
          }}
        >
          <div
            style={{
              background: '#1A1540',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              maxWidth: '400px',
              width: '100%',
              padding: '24px',
              boxSizing: 'border-box',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} color="#EC4899" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Fee Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                background: '#130E38',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '12.5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9CA3AF' }}>Receipt No:</span>
                <span style={{ fontWeight: 700, color: '#FCD34D' }}>{viewingReceipt.receipt_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9CA3AF' }}>Student:</span>
                <span style={{ fontWeight: 600 }}>{viewingReceipt.student_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9CA3AF' }}>Admission No:</span>
                <span>{viewingReceipt.admission_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9CA3AF' }}>Obligation:</span>
                <span>{viewingReceipt.obligation_title}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9CA3AF' }}>Payment Date:</span>
                <span>{viewingReceipt.payment_date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9CA3AF' }}>Payment Mode:</span>
                <span style={{ textTransform: 'uppercase' }}>{viewingReceipt.payment_method}</span>
              </div>
              {viewingReceipt.reference_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9CA3AF' }}>Reference:</span>
                  <span>{viewingReceipt.reference_number}</span>
                </div>
              )}
              <div
                style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  paddingTop: '8px',
                  marginTop: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                }}
              >
                <span style={{ fontWeight: 700, color: '#FFFFFF' }}>Amount Paid:</span>
                <span style={{ fontWeight: 800, color: '#34D399' }}>₹{viewingReceipt.payment_amount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#9CA3AF' }}>Remaining Balance:</span>
                <span style={{ color: '#FCD34D' }}>₹{viewingReceipt.remaining_balance}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewingReceipt(null)}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
