import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EducationalWatermark } from '../../components/layout/EducationalWatermark';

export const SplashScreen: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 2800);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      className="educamp-watermark-bg"
      onClick={() => navigate('/login')}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '60px 24px 48px',
        boxSizing: 'border-box',
        minHeight: '100vh',
      }}
    >
      <EducationalWatermark />

      {/* Top spacer */}
      <div style={{ flex: 1 }} />

      {/* Center Branding Block */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '24px',
        }}
      >
        {/* Emblem Logo */}
        <div
          style={{
            width: '190px',
            height: '190px',
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            animation: 'fadeInScale 0.8s ease-out',
          }}
        >
          <img
            src="/assets/branding/app_logo.png"
            alt="EduCamp Emblem Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Brand Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1
            style={{
              fontSize: '38px',
              fontWeight: 800,
              letterSpacing: '1px',
              lineHeight: 1.1,
              fontFamily: 'var(--font-display)',
              margin: 0,
            }}
          >
            <span style={{ color: '#FFFFFF' }}>EDU </span>
            <span style={{ color: 'var(--accent-pink)' }}>CAMP</span>
          </h1>

          <p
            style={{
              fontSize: '16px',
              fontWeight: 400,
              color: '#E5E7EB',
              letterSpacing: '0.3px',
              fontFamily: 'serif, var(--font-sans)',
              margin: 0,
            }}
          >
            Knowledge on your Fingertips
          </p>
        </div>
      </div>

      {/* Bottom spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom Loading Indicator */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* 3 Pills / Capsule Indicator matching Screenshot 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '14px',
              height: '5px',
              borderRadius: '3px',
              backgroundColor: '#2D225A',
            }}
          />
          <div
            style={{
              width: '36px',
              height: '5px',
              borderRadius: '3px',
              backgroundColor: 'var(--accent-pink)',
              boxShadow: '0 0 10px rgba(236, 72, 153, 0.6)',
            }}
          />
          <div
            style={{
              width: '14px',
              height: '5px',
              borderRadius: '3px',
              backgroundColor: '#2D225A',
            }}
          />
        </div>

        <span
          style={{
            fontSize: '13px',
            color: '#D1D5DB',
            letterSpacing: '0.4px',
          }}
        >
          Loading...
        </span>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};
