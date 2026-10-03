import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from './AuthContext';

export const ResetPasswordScreen: React.FC = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a new password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    const result = await updatePassword(password);
    setIsLoading(false);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } else {
      setError(result.error || 'Failed to update password. Recovery link may have expired.');
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
            Set New Password
          </h2>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            Enter your new secure password below to regain access to your account.
          </p>
        </div>

        {/* Success Banner */}
        {isSuccess ? (
          <div
            style={{
              background: 'rgba(76, 175, 80, 0.15)',
              border: '1px solid rgba(76, 175, 80, 0.4)',
              borderRadius: '12px',
              padding: '20px',
              color: '#A5D6A7',
              fontSize: '13px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CheckCircle size={36} color="#4CAF50" />
            <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>Password Updated!</strong>
            <span>Your password has been successfully updated. Redirecting to login...</span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <Input
              label="New Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password (min. 6 characters)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              leadingIcon={<Lock size={19} />}
              autoComplete="new-password"
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ display: 'flex', alignItems: 'center', color: '#9CA3AF', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <Input
              label="Confirm New Password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError('');
              }}
              error={error}
              leadingIcon={<Lock size={19} />}
              autoComplete="new-password"
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ display: 'flex', alignItems: 'center', color: '#9CA3AF', cursor: 'pointer' }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <div style={{ marginTop: '8px' }}>
              <Button type="submit" variant="primary" isLoading={isLoading}>
                UPDATE PASSWORD
              </Button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              <Link
                to="/login"
                style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}
              >
                Cancel and Return to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};
