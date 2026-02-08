import { useState } from 'react';
import { PRESETS } from './layoutPresets';
import { useAppStore } from '../store/appStore';
import { WidgetPicker } from './WidgetPicker';

export function DashboardToolbar() {
  const [pickerOpen, setPickerOpen] = useState(false);

  const locked = useAppStore(s => s.dashboardLocked);
  const activePresetId = useAppStore(s => s.activePresetId);
  const dashboardWidgets = useAppStore(s => s.dashboardWidgets);
  const setDashboardLocked = useAppStore(s => s.setDashboardLocked);
  const applyPreset = useAppStore(s => s.applyPreset);
  const addWidget = useAppStore(s => s.addWidget);
  const saveDashboardLayout = useAppStore(s => s.saveDashboardLayout);

  return (
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-left">
        <select
          className="dashboard-preset-select"
          value={activePresetId || ''}
          onChange={(e) => {
            if (e.target.value) applyPreset(e.target.value);
          }}
        >
          <option value="" disabled>Select Preset</option>
          {PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <button
          className="dashboard-toolbar-btn"
          onClick={() => setPickerOpen(true)}
          title="Add widget"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add</span>
        </button>
      </div>

      <div className="dashboard-toolbar-right">
        <button
          className={`dashboard-toolbar-btn ${!locked ? 'active' : ''}`}
          onClick={() => setDashboardLocked(!locked)}
          title={locked ? 'Unlock layout for editing' : 'Lock layout'}
        >
          {locked ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          )}
          <span>{locked ? 'Locked' : 'Unlocked'}</span>
        </button>

        <button
          className="dashboard-toolbar-btn"
          onClick={saveDashboardLayout}
          title="Save current layout"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span>Save</span>
        </button>
      </div>

      {pickerOpen && (
        <WidgetPicker
          activeWidgets={dashboardWidgets}
          onAdd={addWidget}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
