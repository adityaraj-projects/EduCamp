import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { WifiOff } from 'lucide-react';

export const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* Offline notification banner */}
        {!isOnline && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: '#EF4444',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <WifiOff size={16} />
            <span>You are currently offline. Running on EduCamp offline shell.</span>
          </div>
        )}

        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
};
