import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors anywhere in the child
 * component tree, logs those errors to Sentry, and displays a fallback UI.
 * 
 * Usage:
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * 
 * With custom fallback:
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to Sentry
    const eventId = Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack
      }
    });

    this.setState({ errorId: eventId });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Also log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    });
  };

  handleReportFeedback = (): void => {
    if (this.state.errorId) {
      Sentry.showReportDialog({ eventId: this.state.errorId });
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">
              <svg 
                className="w-16 h-16 text-red-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>

            <h2 className="error-boundary-title">Something went wrong</h2>
            
            <p className="error-boundary-message">
              We're sorry, but something unexpected happened. The error has been 
              automatically reported to our team.
            </p>

            {this.state.error && (
              <div className="error-boundary-details">
                <code>{this.state.error.message}</code>
              </div>
            )}

            <div className="error-boundary-actions">
              <button 
                onClick={this.handleRetry}
                className="error-boundary-btn error-boundary-btn-primary"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>

              <button 
                onClick={() => window.location.reload()}
                className="error-boundary-btn error-boundary-btn-secondary"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reload Page
              </button>

              {this.state.errorId && (
                <button 
                  onClick={this.handleReportFeedback}
                  className="error-boundary-btn error-boundary-btn-outline"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Report Feedback
                </button>
              )}
            </div>

            {this.state.errorId && (
              <p className="error-boundary-ref">
                Error ID: <code>{this.state.errorId}</code>
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap a component with an ErrorBoundary.
 * 
 * Usage:
 * const SafeComponent = withErrorBoundary(MyComponent);
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

/**
 * Inline error fallback component for smaller sections of UI.
 */
export function InlineErrorFallback({ 
  error, 
  onRetry 
}: { 
  error?: Error; 
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="inline-error-fallback">
      <div className="flex items-center gap-2 text-red-400">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-medium">Something went wrong</span>
      </div>
      {error && (
        <p className="text-sm text-neutral-400 mt-1">{error.message}</p>
      )}
      {onRetry && (
        <button 
          onClick={onRetry}
          className="mt-2 text-sm text-gold hover:text-gold/80 underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
