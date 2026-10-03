import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { TeacherAssignmentsScreen } from './TeacherAssignmentsScreen';
import { StudentAssignmentsScreen } from './StudentAssignmentsScreen';

/**
 * AssignmentsScreen: Role dispatcher for Phase 8 Assignments & Homework System
 * Teachers and administrators access the assignment creation and submission evaluation portal.
 * Enrolled students access their task list, deadlines, submission dialog, and grading feedback.
 */
export const AssignmentsScreen: React.FC = () => {
  const { role } = useAuth();

  if (role === 'admin' || role === 'teacher') {
    return <TeacherAssignmentsScreen />;
  }

  return <StudentAssignmentsScreen />;
};
