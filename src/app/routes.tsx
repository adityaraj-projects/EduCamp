import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SplashScreen } from '../features/auth/SplashScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { SignupScreen } from '../features/auth/SignupScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../features/auth/ResetPasswordScreen';
import { AuthCallback } from '../features/auth/AuthCallback';
import { AuthenticatedPlaceholder } from '../features/auth/AuthenticatedPlaceholder';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { PublicOnlyRoute } from '../components/layout/PublicOnlyRoute';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Brand Splash Screen */}
      <Route path="/" element={<SplashScreen />} />

      {/* Public Auth Routes (Redirects to /dashboard if already logged in) */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginScreen />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <SignupScreen />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPasswordScreen />
          </PublicOnlyRoute>
        }
      />

      {/* Password Reset Callback / Update Route */}
      <Route path="/reset-password" element={<ResetPasswordScreen />} />

      {/* OAuth & Auth Callback */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected Authenticated Portal */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AuthenticatedPlaceholder />
          </ProtectedRoute>
        }
      />

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
