import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from './AuthContext';

export const ForgotPasswordScreen: React.FC = () => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    const result = await requestPasswordReset(email);
    setIsLoading(false);

    if (result.success) {
      setIsSubmitted(true);
    } else {
      // Show error without exposing sensitive system internals
      setError(result.error || 'Unable to process reset request. Please try again.');
    }
  };

  return (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%' }}>
        {/* Top Emblem Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
            }}
          >
            <img
              src="/assets/branding/app_logo.png"
              alt="EduCamp Emblem Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* Headings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: '#FFFFFF',
              fontFamily: 'var(--font-display)',
              margin: 0,
            }}
          >
            Reset Password
          </h2>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            Enter your registered email address and we'll send you a password recovery link.
          </p>
        </div>

        {/* Success Banner */}
        {isSubmitted ? (
          <div
            style={{
              background: 'rgba(76, 175, 80, 0.15)',
              border: '1px solid rgba(76, 175, 80, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              color: '#A5D6A7',
              fontSize: '13px',
              lineHeight: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <strong>Recovery Link Sent</strong>
            <span>
              If an account with that email exists, a password reset link has been dispatched. Please check your inbox and spam folder.
            </span>
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#FFFFFF',
                fontWeight: 600,
                marginTop: '4px',
              }}
            >
              <ArrowLeft size={16} /> Return to Login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
          >
            <Input
              name="email"
              type="email"
              placeholder="Enter your registered email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              error={error}
              leadingIcon={<Mail size={19} />}
              autoComplete="email"
            />

            <Button type="submit" variant="primary" isLoading={isLoading}>
              SEND RESET LINK
            </Button>

            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <ArrowLeft size={16} /> Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};
