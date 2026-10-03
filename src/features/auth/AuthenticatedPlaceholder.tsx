import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LogOut, ShieldCheck, UserCheck, KeyRound, Sparkles, BookOpen, FileCheck, Award } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const AuthenticatedPlaceholder: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, role, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  const getRoleBadgeStyle = (userRole: string) => {
    switch (userRole) {
      case 'admin':
        return { bg: 'rgba(239, 68, 68, 0.2)', border: '#EF4444', text: '#FCA5A5' };
      case 'teacher':
        return { bg: 'rgba(245, 158, 11, 0.2)', border: '#F59E0B', text: '#FCD34D' };
      default:
        return { bg: 'rgba(99, 102, 241, 0.2)', border: '#6366F1', text: '#A5B4FC' };
    }
  };

  const badgeStyle = getRoleBadgeStyle(role || 'student');

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0B0826',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(22, 17, 58, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          padding: '36px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Emblem Badge */}
        <div
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            background: '#FFFFFF',
            padding: '3px',
          }}
        >
          <img
            src="/assets/branding/app_logo.png"
            alt="EduCamp Emblem Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Identity Headings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, fontFamily: 'var(--font-display)' }}>
            Welcome, {profile?.full_name || 'EduCamp Member'}!
          </h2>
          <p style={{ fontSize: '13.5px', color: '#9CA3AF', margin: 0 }}>
            {user?.email || 'Authenticated User'}
          </p>
        </div>

        {/* Role & Security Status Card */}
        <div
          style={{
            width: '100%',
            background: '#211A45',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: '#A09CB8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserCheck size={16} color="#EC4899" /> Assigned Role
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                background: badgeStyle.bg,
                border: `1px solid ${badgeStyle.border}`,
                color: badgeStyle.text,
                borderRadius: '12px',
                padding: '3px 10px',
              }}
            >
              {role || 'student'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: '#A09CB8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="#4CAF50" /> Session Status
            </span>
            <span style={{ fontSize: '12px', color: '#A5D6A7', fontWeight: 600 }}>
              Active (Supabase JWT)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: '#A09CB8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <KeyRound size={16} color="#6366F1" /> RLS Protection
            </span>
            <span style={{ fontSize: '12px', color: '#C7D2FE', fontWeight: 600 }}>
              Database-Enforced
            </span>
          </div>
        </div>

        {/* Phase 2 Informational Note */}
        <div
          style={{
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '12px',
            color: '#E0E7FF',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            textAlign: 'left',
          }}
        >
          <Sparkles size={16} color="#EC4899" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Phase 2 Complete:</strong> Authentication, session persistence, and role security verified. Role-based dashboards (Student, Teacher, Admin) will be connected in future phases.
          </span>
        </div>

        {/* Portal CTAs */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/attendance')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <span>OPEN ATTENDANCE SYSTEM</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/fees')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <span>OPEN FEES & LEDGER SYSTEM</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/materials')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <BookOpen size={16} />
            <span>OPEN STUDY MATERIALS</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/assignments')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #EC4899 0%, #F59E0B 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <FileCheck size={16} />
            <span>OPEN ASSIGNMENTS & HOMEWORK</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/exams')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <Award size={16} />
            <span>OPEN EXAMS & RESULTS</span>
          </button>

          {/* Secure Logout CTA */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleLogout}
            isLoading={isLoggingOut}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <LogOut size={16} />
              <span>SECURE LOGOUT</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};
