import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LogOut, ShieldCheck, UserCheck, KeyRound, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const AuthenticatedPlaceholder: React.FC = () => {
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

        {/* Secure Logout CTA */}
        <div style={{ width: '100%', marginTop: '8px' }}>
          <Button
            type="button"
            variant="primary"
            onClick={handleLogout}
            isLoading={isLoggingOut}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <LogOut size={18} />
              <span>SECURE LOGOUT</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};
