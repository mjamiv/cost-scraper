import { Component, ReactNode } from 'react';
import { WIDGET_MAP } from './widgetRegistry';

interface DashboardWidgetProps {
  widgetId: string;
  locked: boolean;
  onRemove: (id: string) => void;
  children: ReactNode;
}

interface ErrorState {
  hasError: boolean;
  error?: Error;
}

class WidgetErrorBoundary extends Component<{ widgetId: string; children: ReactNode }, ErrorState> {
  state: ErrorState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dashboard-widget-error">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Widget error</p>
          <button
            className="text-xs text-gold hover:underline"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function DashboardWidget({ widgetId, locked, onRemove, children }: DashboardWidgetProps) {
  const def = WIDGET_MAP.get(widgetId);
  const title = def?.title || widgetId;

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <div className="flex items-center gap-2">
          {!locked && (
            <div className="dashboard-widget-drag-handle" title="Drag to reorder">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          )}
          <span className="dashboard-widget-title">{title}</span>
        </div>
        {!locked && (
          <button
            className="dashboard-widget-remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(widgetId);
            }}
            title="Remove widget"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="dashboard-widget-body">
        <WidgetErrorBoundary widgetId={widgetId}>
          {children}
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
