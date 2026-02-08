import { useState } from 'react';
import { WIDGET_REGISTRY, CATEGORY_LABELS } from './widgetRegistry';

interface WidgetPickerProps {
  activeWidgets: string[];
  onAdd: (widgetId: string) => void;
  onClose: () => void;
}

export function WidgetPicker({ activeWidgets, onAdd, onClose }: WidgetPickerProps) {
  const [filter, setFilter] = useState<string>('all');

  const categories = ['all', ...new Set(WIDGET_REGISTRY.map(w => w.category))];

  const filtered = filter === 'all'
    ? WIDGET_REGISTRY
    : WIDGET_REGISTRY.filter(w => w.category === filter);

  return (
    <div className="widget-picker-overlay" onClick={onClose}>
      <div className="widget-picker" onClick={e => e.stopPropagation()}>
        <div className="widget-picker-header">
          <h3>Add Widget</h3>
          <button className="widget-picker-close" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="widget-picker-categories">
          {categories.map(cat => (
            <button
              key={cat}
              className={`widget-picker-cat-btn ${filter === cat ? 'active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>

        <div className="widget-picker-grid">
          {filtered.map(widget => {
            const isActive = activeWidgets.includes(widget.id);
            return (
              <button
                key={widget.id}
                className={`widget-picker-item ${isActive ? 'already-added' : ''}`}
                onClick={() => {
                  if (!isActive) {
                    onAdd(widget.id);
                    onClose();
                  }
                }}
                disabled={isActive}
              >
                <div className="widget-picker-item-icon">
                  {getCategoryIcon(widget.category)}
                </div>
                <span className="widget-picker-item-title">{widget.title}</span>
                <span className="widget-picker-item-size">
                  {widget.defaultW}x{widget.defaultH}
                </span>
                {isActive && <span className="widget-picker-item-badge">Added</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'evm':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'cost':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'workforce':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'data':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    default:
      return null;
  }
}
