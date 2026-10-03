import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Safe error logging: no user tokens, passwords or sensitive state
    console.error('EduCamp ErrorBoundary caught an unhandled exception:', {
      name: error?.name,
      message: error?.message,
      componentStack: errorInfo?.componentStack?.slice(0, 500)
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F0C29',
          color: '#FFFFFF',
          padding: '24px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: 'rgba(25, 20, 60, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 20px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px'
            }}>
              ⚠️
            </div>

            <h1 style={{
              fontSize: '22px',
              fontWeight: 700,
              marginBottom: '12px',
              color: '#FFFFFF'
            }}>
              {this.props.fallbackTitle || 'Something Went Wrong'}
            </h1>

            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.6,
              marginBottom: '28px'
            }}>
              {this.props.fallbackMessage ||
                'An unexpected error occurred while loading this view. Your session and saved records are intact. Please try reloading or returning to your dashboard.'}
            </p>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  border: 'none',
                  transition: 'background 0.2s',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                }}
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  transition: 'background 0.2s'
                }}
              >
                Return to Dashboard
              </button>
            </div>

            {this.state.error && (
              <details style={{
                marginTop: '28px',
                textAlign: 'left',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.5)'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
                  Technical Details (Development Diagnostics)
                </summary>
                <p style={{ marginTop: '8px', fontFamily: 'monospace', color: '#FCA5A5' }}>
                  {this.state.error.toString()}
                </p>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
