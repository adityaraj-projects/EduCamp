import React, { Suspense, lazy } from 'react';
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
import { ErrorBoundary } from '../components/layout/ErrorBoundary';

// Code-split heavy feature screens for optimal bundle performance
const AttendanceScreen = lazy(() =>
  import('../features/attendance/AttendanceScreen').then((m) => ({ default: m.AttendanceScreen }))
);
const FeesScreen = lazy(() =>
  import('../features/fees/FeesScreen').then((m) => ({ default: m.FeesScreen }))
);
const MaterialsScreen = lazy(() =>
  import('../features/materials/MaterialsScreen').then((m) => ({ default: m.MaterialsScreen }))
);
const AssignmentsScreen = lazy(() =>
  import('../features/assignments/AssignmentsScreen').then((m) => ({ default: m.AssignmentsScreen }))
);
const ExamsScreen = lazy(() =>
  import('../features/exams/ExamsScreen').then((m) => ({ default: m.ExamsScreen }))
);
const NotificationCenterScreen = lazy(() =>
  import('../features/notifications/NotificationCenterScreen').then((m) => ({
    default: m.NotificationCenterScreen,
  }))
);
const AnnouncementsScreen = lazy(() =>
  import('../features/notifications/AnnouncementsScreen').then((m) => ({
    default: m.AnnouncementsScreen,
  }))
);

const RouteLoadingFallback: React.FC = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0B0826',
      color: '#FFFFFF',
      gap: '16px',
    }}
  >
    <div
      style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(236, 72, 153, 0.2)',
        borderTopColor: '#EC4899',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <span style={{ fontSize: '13px', color: '#D1D5DB', letterSpacing: '0.4px' }}>
      Loading EduCamp Module...
    </span>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoadingFallback />}>
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

          {/* Phase 5 Attendance System */}
          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <AttendanceScreen />
              </ProtectedRoute>
            }
          />

          {/* Phase 6 Fees System */}
          <Route
            path="/fees"
            element={
              <ProtectedRoute>
                <FeesScreen />
              </ProtectedRoute>
            }
          />

          {/* Phase 7 Study Materials System */}
          <Route
            path="/materials"
            element={
              <ProtectedRoute>
                <MaterialsScreen />
              </ProtectedRoute>
            }
          />

          {/* Phase 8 Assignments System */}
          <Route
            path="/assignments"
            element={
              <ProtectedRoute>
                <AssignmentsScreen />
              </ProtectedRoute>
            }
          />

          {/* Phase 9 Exam & Result Management System */}
          <Route
            path="/exams"
            element={
              <ProtectedRoute>
                <ExamsScreen />
              </ProtectedRoute>
            }
          />

          {/* Phase 10 Communications & Notification System */}
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationCenterScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements"
            element={
              <ProtectedRoute>
                <AnnouncementsScreen />
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};
