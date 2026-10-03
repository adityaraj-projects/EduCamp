import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { AdminFeeManagementScreen } from './AdminFeeManagementScreen';
import { StudentFeesScreen } from './StudentFeesScreen';

export const FeesScreen: React.FC = () => {
  const { role } = useAuth();

  if (role === 'admin' || role === 'teacher') {
    return <AdminFeeManagementScreen />;
  }

  return <StudentFeesScreen />;
};
