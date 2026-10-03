import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { TeacherMaterialsScreen } from './TeacherMaterialsScreen';
import { StudentMaterialsScreen } from './StudentMaterialsScreen';

/**
 * MaterialsScreen: Role-based entry point for Study Materials System
 * Directs teachers and administrators to the upload & management portal,
 * and students to their authorized document browsing interface.
 */
export const MaterialsScreen: React.FC = () => {
  const { role } = useAuth();

  if (role === 'admin' || role === 'teacher') {
    return <TeacherMaterialsScreen />;
  }

  return <StudentMaterialsScreen />;
};
