import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import type { SignupFormData, FormValidationErrors } from '../../types/auth';

const CLASS_OPTIONS = [
  { value: 'class-1', label: 'Class 1' },
  { value: 'class-2', label: 'Class 2' },
  { value: 'class-3', label: 'Class 3' },
  { value: 'class-4', label: 'Class 4' },
  { value: 'class-5', label: 'Class 5' },
  { value: 'class-6', label: 'Class 6' },
  { value: 'class-7', label: 'Class 7' },
  { value: 'class-8', label: 'Class 8' },
  { value: 'class-9', label: 'Class 9' },
  { value: 'class-10', label: 'Class 10' },
  { value: 'class-11', label: 'Class 11' },
  { value: 'class-12', label: 'Class 12' },
];

const BOARD_OPTIONS = [
  { value: 'cbse', label: 'CBSE' },
  { value: 'icse', label: 'ICSE' },
  { value: 'bseb', label: 'BSEB' },
  { value: 'state-board', label: 'State Board' },
  { value: 'foundation', label: 'Foundation' },
];

export const SignupScreen: React.FC = () => {
  const [formData, setFormData] = useState<SignupFormData>({
    fullName: '',
    email: '',
    mobileNumber: '',
    selectedClass: '',
    selectedBoard: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: FormValidationErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(formData.mobileNumber.replace(/\D/g, ''))) {
      newErrors.mobileNumber = 'Please enter a 10-digit mobile number';
    }
    if (!formData.selectedClass) {
      newErrors.selectedClass = 'Select a class';
    }
    if (!formData.selectedBoard) {
      newErrors.selectedBoard = 'Select a board';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Phase 1 UI submission without active backend user creation
    setIsLoading(true);
    setInfoMessage(null);
    setTimeout(() => {
      setIsLoading(false);
      setInfoMessage(
        'Phase 1 UI verified! Account creation will be connected with Supabase Auth in Phase 2.'
      );
    }, 800);
  };

  return (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
        {/* Top Emblem Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
            Create Account! <span role="img" aria-label="wave">👋</span>
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            Enter your details below to join your class dashboard.
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

        {/* Registration Form */}
        <form
          onSubmit={handleSignupSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          {/* Full Name */}
          <Input
            label="Full Name"
            name="fullName"
            placeholder="Enter your full name"
            value={formData.fullName}
            onChange={handleInputChange}
            error={errors.fullName}
            leadingIcon={<User size={18} />}
            autoComplete="name"
          />

          {/* Email Address */}
          <Input
            label="Email Address"
            name="email"
            type="email"
            placeholder="Enter your email address"
            value={formData.email}
            onChange={handleInputChange}
            error={errors.email}
            leadingIcon={<Mail size={18} />}
            autoComplete="email"
          />

          {/* Mobile Number */}
          <Input
            label="Mobile Number"
            name="mobileNumber"
            type="tel"
            placeholder="Enter 10-digit mobile number"
            value={formData.mobileNumber}
            onChange={handleInputChange}
            error={errors.mobileNumber}
            leadingIcon={<Phone size={18} />}
            autoComplete="tel"
          />

          {/* Two-Column: Select Class & Select Board (Side by Side) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select
              label="Select Class"
              name="selectedClass"
              placeholder="Select Class"
              options={CLASS_OPTIONS}
              value={formData.selectedClass}
              onChange={handleInputChange}
              error={errors.selectedClass}
            />

            <Select
              label="Select Board"
              name="selectedBoard"
              placeholder="Select Board"
              options={BOARD_OPTIONS}
              value={formData.selectedBoard}
              onChange={handleInputChange}
              error={errors.selectedBoard}
            />
          </div>

          {/* Password */}
          <Input
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleInputChange}
            error={errors.password}
            leadingIcon={<Lock size={18} />}
            autoComplete="new-password"
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

          {/* Confirm Password */}
          <Input
            label="Confirm Password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            error={errors.confirmPassword}
            leadingIcon={<Lock size={18} />}
            autoComplete="new-password"
            trailingIcon={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          {/* Primary SIGN UP Button */}
          <div style={{ marginTop: '12px' }}>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              SIGN UP
            </Button>
          </div>
        </form>

        {/* Login Navigation Footer */}
        <div style={{ textAlign: 'center', marginTop: '4px', paddingBottom: '24px' }}>
          <p style={{ fontSize: '13px', color: '#FFFFFF', margin: 0 }}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: 'var(--accent-pink)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};
