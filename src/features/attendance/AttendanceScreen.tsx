import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { TeacherAttendanceScreen } from './TeacherAttendanceScreen';
import { StudentAttendanceScreen } from './StudentAttendanceScreen';

export const AttendanceScreen: React.FC = () => {
  const { role } = useAuth();

  if (role === 'teacher' || role === 'admin') {
    return <TeacherAttendanceScreen />;
  }

  return <StudentAttendanceScreen />;
};
