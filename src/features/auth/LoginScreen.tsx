import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import type { LoginFormData, FormValidationErrors } from '../../types/auth';

export const LoginScreen: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    identifier: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: FormValidationErrors = {};

    if (!formData.identifier.trim()) {
      newErrors.identifier = 'Please enter your email or mobile number';
    }
    if (!formData.password) {
      newErrors.password = 'Please enter your password';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Phase 1: Visual validation feedback without active backend auth
    setIsLoading(true);
    setInfoMessage(null);
    setTimeout(() => {
      setIsLoading(false);
      setInfoMessage(
        'Phase 1 UI verified! Real authentication will be connected in Phase 2.'
      );
    }, 800);
  };

  const handleGoogleClick = () => {
    setInfoMessage('Google OAuth provider will be connected in Phase 2.');
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setInfoMessage('Password recovery workflow will be connected in Phase 2.');
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
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: 0,
            }}
          >
            Welcome Back! <span role="img" aria-label="wave">👋</span>
          </h2>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            Login to continue your learning journey.
          </p>
        </div>

        {/* Feedback message banner */}
        {infoMessage && (
          <div
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '12px',
              padding: '12px 14px',
              fontSize: '12.5px',
              color: '#C7D2FE',
              lineHeight: 1.4,
            }}
          >
            {infoMessage}
          </div>
        )}

        {/* Login Form */}
        <form
          onSubmit={handleLoginSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {/* Email or Mobile Number Input */}
          <Input
            name="identifier"
            placeholder="Email or Mobile Number"
            value={formData.identifier}
            onChange={handleInputChange}
            error={errors.identifier}
            leadingIcon={<User size={19} />}
            autoComplete="username"
          />

          {/* Password Input with Visibility Toggle */}
          <div>
            <Input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              error={errors.password}
              leadingIcon={<Lock size={19} />}
              autoComplete="current-password"
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: '#9CA3AF',
                    cursor: 'pointer',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            {/* Forgot Password Link */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--accent-pink)',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                Forgot Password?
              </button>
            </div>
          </div>

          {/* Primary LOGIN Button */}
          <div style={{ marginTop: '8px' }}>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              LOGIN
            </Button>
          </div>
        </form>

        {/* OR Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '4px 0',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }}
          />
          <span style={{ fontSize: '13px', color: '#8882A3', fontWeight: 500 }}>
            or
          </span>
          <div
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }}
          />
        </div>

        {/* Continue with Google */}
        <Button
          type="button"
          variant="google"
          onClick={handleGoogleClick}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Google G Logo SVG */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#1F2937' }}>
              Continue with Google
            </span>
          </div>
        </Button>

        {/* Sign Up Navigation Footer */}
        <div style={{ textAlign: 'center', marginTop: '8px', paddingBottom: '16px' }}>
          <p style={{ fontSize: '13px', color: '#FFFFFF', margin: 0 }}>
            Don't have an account?{' '}
            <Link
              to="/signup"
              style={{
                color: 'var(--accent-pink)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};
