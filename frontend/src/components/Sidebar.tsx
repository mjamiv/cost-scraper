import { ReactNode } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Sidebar({ isOpen, onClose, children }: SidebarProps) {
  return (
    <aside className={`app-sidebar ${isOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-inner">
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-title">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>Filters</span>
          </div>
          <button onClick={onClose} className="sidebar-close" title="Close sidebar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="sidebar-content">
          {children}
        </div>
      </div>
    </aside>
  );
}

// Re-export types for backwards compatibility
export type SidebarTab = 'filters' | 'chart' | 'table' | 'export';
