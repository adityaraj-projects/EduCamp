import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { feeService } from '../../services/feeService';
import type {
  FeeObligationDetail,
  FeeStructure,
  PaymentMethod,
} from '../../types/fee';
import {
  ArrowLeft,
  CreditCard,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const AdminFeeManagementScreen: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'pending' | 'structures'>('pending');
  const [pendingObligations, setPendingObligations] = useState<FeeObligationDetail[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedObligation, setSelectedObligation] = useState<FeeObligationDetail | null>(null);

  // Payment modal state
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; receiptNo?: string } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      if (activeTab === 'pending') {
        const data = await feeService.getPendingObligations(50);
        setPendingObligations(data);
      } else if (activeTab === 'structures') {
        const data = await feeService.getFeeStructures();
        setFeeStructures(data);
      }
    } catch (err) {
      console.error('Failed to load fee management data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenPayModal = (obligation: FeeObligationDetail) => {
    setSelectedObligation(obligation);
    setPaymentAmount(obligation.remaining_balance.toString());
    setPaymentMethod('cash');
    setReferenceNumber('');
    setPaymentNotes('');
    setFeedback(null);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObligation) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ type: 'error', message: 'Enter a valid payment amount greater than zero.' });
      return;
    }

    if (amountNum > selectedObligation.remaining_balance) {
      setFeedback({
        type: 'error',
        message: `Payment amount (₹${amountNum}) cannot exceed outstanding balance (₹${selectedObligation.remaining_balance}).`,
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const res = await feeService.recordPayment({
      obligation_id: selectedObligation.id,
      amount: amountNum,
      payment_method: paymentMethod,
      reference_number: referenceNumber || null,
      notes: paymentNotes || null,
    });

    setIsSubmitting(false);

    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Payment of ₹${amountNum} recorded successfully!`,
        receiptNo: res.receiptNumber,
      });
      setSelectedObligation(null);
      // Reload pending obligations list
      loadData();
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Failed to record payment.',
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
            Fee Management Portal
          </h1>
          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
            Institute Cashier & Accounting Foundation
          </p>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '680px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
        {/* Sub-tabs Navigation */}
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
            onClick={() => setActiveTab('pending')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'pending' ? '#EC4899' : 'transparent',
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
            <CreditCard size={15} />
            <span>Pending Fees</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('structures')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'structures' ? '#EC4899' : 'transparent',
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
            <Layers size={15} />
            <span>Fee Structures</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${feedback.type === 'success' ? '#10B981' : '#EF4444'}`,
              color: feedback.type === 'success' ? '#A7F3D0' : '#FECACA',
              fontSize: '13px',
            }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />}
            <div>
              <div>{feedback.message}</div>
              {feedback.receiptNo && (
                <div style={{ marginTop: '4px', fontWeight: 700, color: '#FFFFFF' }}>
                  Receipt Number: <span style={{ color: '#FCD34D' }}>{feedback.receiptNo}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Pending Collections */}
        {activeTab === 'pending' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#E0E7FF' }}>
                Pending Student Obligations
              </h2>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                {pendingObligations.length} unpaid / partial
              </span>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                <div className="spinner" style={{ margin: '0 auto 12px auto' }} />
                Loading fee records...
              </div>
            ) : pendingObligations.length === 0 ? (
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
                <CheckCircle2 size={36} color="#10B981" style={{ marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No pending fee obligations</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                  All generated fee obligations have been settled or no active obligations exist.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingObligations.map((ob) => (
                  <div
                    key={ob.id}
                    style={{
                      background: 'rgba(26, 21, 64, 0.7)',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                        {ob.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                        {ob.student?.profile?.full_name || 'Student'} • {ob.student?.admission_number || 'ADM'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#F87171', marginTop: '4px', fontWeight: 600 }}>
                        Due Date: {ob.due_date}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#FCD34D' }}>
                          ₹{ob.remaining_balance}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                          of ₹{ob.amount_due}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenPayModal(ob)}
                        style={{
                          background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Collect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Master Fee Structures */}
        {activeTab === 'structures' && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#E0E7FF' }}>
              Master Fee Templates
            </h2>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                <div className="spinner" style={{ margin: '0 auto 12px auto' }} />
                Loading fee structures...
              </div>
            ) : feeStructures.length === 0 ? (
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
                <Layers size={36} color="#6366F1" style={{ marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No fee structures configured</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {feeStructures.map((st) => (
                  <div
                    key={st.id}
                    style={{
                      background: 'rgba(26, 21, 64, 0.7)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '16px',
                    }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>{st.name}</div>
                    {st.description && (
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                        {st.description}
                      </div>
                    )}

                    <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                      <div style={{ fontSize: '11.5px', color: '#A5B4FC', fontWeight: 600, marginBottom: '6px' }}>
                        STRUCTURE BREAKDOWN:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {st.items?.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '12.5px',
                              background: '#130E38',
                              padding: '6px 10px',
                              borderRadius: '8px',
                            }}
                          >
                            <span>{item.category?.name || 'Category'}</span>
                            <span style={{ fontWeight: 700, color: '#34D399' }}>
                              ₹{item.amount} / {item.frequency}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Payment Recording Modal / Overlay */}
      {selectedObligation && (
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
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxSizing: 'border-box',
              position: 'relative',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                Record Payment
              </h3>
              <button
                type="button"
                onClick={() => setSelectedObligation(null)}
                style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Obligation Snapshot */}
            <div
              style={{
                background: '#130E38',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '12.5px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{selectedObligation.title}</div>
              <div style={{ color: '#9CA3AF', marginTop: '2px' }}>
                {selectedObligation.student?.profile?.full_name} ({selectedObligation.student?.admission_number})
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '6px' }}>
                <span>Remaining Due:</span>
                <span style={{ fontWeight: 800, color: '#FCD34D' }}>₹{selectedObligation.remaining_balance}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#A09CB8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Amount to Pay (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedObligation.remaining_balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#0B0826',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#A09CB8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#0B0826',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
                  <option value="bank_transfer">Bank Transfer / NEFT / IMPS</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Debit / Credit Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#A09CB8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Reference No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI UTR, Cheque No, Transaction ID"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#0B0826',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginTop: '8px' }}>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Send size={16} />
                    <span>CONFIRM & GENERATE RECEIPT</span>
                  </div>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
