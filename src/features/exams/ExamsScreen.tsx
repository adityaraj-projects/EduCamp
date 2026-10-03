import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { TeacherExamsScreen } from './TeacherExamsScreen';
import { StudentExamsScreen } from './StudentExamsScreen';

/**
 * ExamsScreen: Role dispatcher for Phase 9 Exam & Result Management System
 * Teachers and administrators access the exam creation, scheduling, offline marks entry, and publication portal.
 * Enrolled students access their verified report cards, subject scores, totals, percentages, and teacher remarks.
 */
export const ExamsScreen: React.FC = () => {
  const { role } = useAuth();

  if (role === 'admin' || role === 'teacher') {
    return <TeacherExamsScreen />;
  }

  return <StudentExamsScreen />;
};
