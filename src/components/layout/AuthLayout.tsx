import React from 'react';
import { EducationalWatermark } from './EducationalWatermark';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="educamp-watermark-bg">
      <EducationalWatermark />
      <main className="auth-viewport-wrapper">
        <div className="auth-mobile-container">
          {children}
        </div>
      </main>
    </div>
  );
};
