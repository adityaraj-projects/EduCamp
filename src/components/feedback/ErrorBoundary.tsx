import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[EduCamp Application Error]', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#0B0826',
            color: '#FFFFFF',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '400px',
              background: '#16113A',
              padding: '32px 24px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '20px' }}>
              An unexpected error occurred. Please refresh or return to the main screen.
            </p>
            <button
              onClick={() => window.location.assign('/')}
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '24px',
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
