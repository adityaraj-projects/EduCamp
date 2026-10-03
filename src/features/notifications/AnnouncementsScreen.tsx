import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { TeacherAnnouncementsScreen } from './TeacherAnnouncementsScreen';
import { NotificationCenterScreen } from './NotificationCenterScreen';

/**
 * AnnouncementsScreen: Role dispatcher for Phase 10 Communications & Announcements
 * Teachers and administrators access the announcement creation, audience targeting, and lifecycle management dashboard.
 * Enrolled students access the Notification Center to view published communications and updates.
 */
export const AnnouncementsScreen: React.FC = () => {
  const { role } = useAuth();

  if (role === 'admin' || role === 'teacher') {
    return <TeacherAnnouncementsScreen />;
  }

  return <NotificationCenterScreen />;
};
