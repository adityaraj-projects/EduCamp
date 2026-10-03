import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const handleAuthCallback = async () => {
      try {
        // Exchange auth code or hash for session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          if (isMounted) setErrorMsg(error.message);
          return;
        }

        // Check if this was a password recovery callback
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
          navigate('/reset-password', { replace: true });
          return;
        }

        if (data.session) {
          navigate('/dashboard', { replace: true });
        } else {
          // Allow onAuthStateChange a moment to process before fallback
          const timer = setTimeout(() => {
            if (isMounted) navigate('/login', { replace: true });
          }, 1500);
          return () => clearTimeout(timer);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Authentication callback processing failed');
        }
      }
    };

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0B0826',
        color: '#FFFFFF',
        gap: '20px',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(236, 72, 153, 0.2)',
          borderTopColor: '#EC4899',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
        Authenticating with EduCamp
      </h2>
      <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
        Please wait while we complete your secure session verification...
      </p>

      {errorMsg && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#F87171',
            fontSize: '13px',
            maxWidth: '380px',
            marginTop: '8px',
          }}
        >
          {errorMsg}
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={() => navigate('/login', { replace: true })}
              style={{
                color: '#FFFFFF',
                background: '#EC4899',
                borderRadius: '18px',
                padding: '6px 16px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Return to Login
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
