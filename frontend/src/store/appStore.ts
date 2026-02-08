/**
 * Zustand store for application state management.
 *
 * Replaces prop drilling with centralized state.
 * Provides better state organization and debugging.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { CostDataRow, QueryFilters, WBSDataRow } from '../api/types';
import { ChartRequest } from '../api/costDataApi';
import { DEFAULT_PRESET_ID, getPresetById } from '../dashboard/layoutPresets';
import { WIDGET_MAP } from '../dashboard/widgetRegistry';
interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

// ============================================================================
// Types
// ============================================================================

export type RightPanelTab = 'chart' | 'table' | 'export';
export type ViewMode = 'chat' | 'dashboard';

interface DashboardLayouts {
  lg: Layout[];
  md: Layout[];
  sm: Layout[];
}

interface UIState {
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  aboutOpen: boolean;
  voiceChatOpen: boolean;
  viewMode: ViewMode;
}

interface DashboardState {
  dashboardWidgets: string[];
  dashboardLayouts: DashboardLayouts;
  dashboardLocked: boolean;
  activePresetId: string | null;
}

interface DataState {
  rawCostData: CostDataRow[];
  wbsTagData: WBSDataRow[];
  filters: QueryFilters;
  isLoading: boolean;
  error: string | null;
}

interface ChatState {
  chatChartRequest: ChartRequest | null;
}

interface AppState extends UIState, DashboardState, DataState, ChatState {
  // UI Actions
  setLeftSidebarOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setAboutOpen: (open: boolean) => void;
  setVoiceChatOpen: (open: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleLeftSidebar: () => void;
  toggleRightPanel: () => void;

  // Dashboard Actions
  setDashboardWidgets: (widgets: string[]) => void;
  setDashboardLayouts: (layouts: DashboardLayouts) => void;
  setDashboardLocked: (locked: boolean) => void;
  applyPreset: (presetId: string) => void;
  addWidget: (widgetId: string) => void;
  removeWidget: (widgetId: string) => void;
  saveDashboardLayout: () => void;

  // Data Actions
  setRawCostData: (data: CostDataRow[]) => void;
  setWbsTagData: (data: WBSDataRow[]) => void;
  setFilters: (filters: QueryFilters | ((prev: QueryFilters) => QueryFilters)) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearData: () => void;

  // Chat Actions
  setChatChartRequest: (request: ChartRequest | null) => void;

  // Combined Actions
  updateFilter: (key: keyof QueryFilters, value: string | Record<string, string[]>) => void;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FILTERS: QueryFilters = {
  projectNumbers: '106073',
  startMonth: '202101',
  districtId: '',
  wbsTags: {},
};

const DEFAULT_UI_STATE: UIState = {
  leftSidebarOpen: false,
  rightPanelOpen: false,
  rightPanelTab: 'chart',
  aboutOpen: false,
  voiceChatOpen: false,
  viewMode: 'chat',
};

const defaultPreset = getPresetById(DEFAULT_PRESET_ID)!;

const DEFAULT_DASHBOARD_STATE: DashboardState = {
  dashboardWidgets: defaultPreset.widgets,
  dashboardLayouts: {
    lg: defaultPreset.layouts,
    md: [],
    sm: [],
  },
  dashboardLocked: true,
  activePresetId: DEFAULT_PRESET_ID,
};

const DEFAULT_DATA_STATE: DataState = {
  rawCostData: [],
  wbsTagData: [],
  filters: DEFAULT_FILTERS,
  isLoading: false,
  error: null,
};

const DEFAULT_CHAT_STATE: ChatState = {
  chatChartRequest: null,
};

// ============================================================================
// Store
// ============================================================================

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        ...DEFAULT_UI_STATE,
        ...DEFAULT_DASHBOARD_STATE,
        ...DEFAULT_DATA_STATE,
        ...DEFAULT_CHAT_STATE,

        // UI Actions
        setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
        setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
        setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
        setAboutOpen: (open) => set({ aboutOpen: open }),
        setVoiceChatOpen: (open) => set({ voiceChatOpen: open }),
        setViewMode: (mode) => set({ viewMode: mode }),

        toggleLeftSidebar: () => set((state) => ({
          leftSidebarOpen: !state.leftSidebarOpen
        })),

        toggleRightPanel: () => set((state) => ({
          rightPanelOpen: !state.rightPanelOpen
        })),

        // Dashboard Actions
        setDashboardWidgets: (widgets) => set({ dashboardWidgets: widgets }),
        setDashboardLayouts: (layouts) => set({ dashboardLayouts: layouts }),
        setDashboardLocked: (locked) => set({ dashboardLocked: locked }),

        applyPreset: (presetId) => {
          const preset = getPresetById(presetId);
          if (!preset) return;
          set({
            dashboardWidgets: preset.widgets,
            dashboardLayouts: { lg: preset.layouts, md: [], sm: [] },
            activePresetId: presetId,
          });
        },

        addWidget: (widgetId) => {
          const state = get();
          if (state.dashboardWidgets.includes(widgetId)) return;

          const def = WIDGET_MAP.get(widgetId);
          const newLayout: Layout = {
            i: widgetId,
            x: 0,
            y: Infinity, // place at bottom
            w: def?.defaultW || 6,
            h: def?.defaultH || 4,
            minW: def?.minW || 3,
            minH: def?.minH || 2,
          };

          set({
            dashboardWidgets: [...state.dashboardWidgets, widgetId],
            dashboardLayouts: {
              ...state.dashboardLayouts,
              lg: [...state.dashboardLayouts.lg, newLayout],
            },
            activePresetId: null,
          });
        },

        removeWidget: (widgetId) => {
          const state = get();
          set({
            dashboardWidgets: state.dashboardWidgets.filter(w => w !== widgetId),
            dashboardLayouts: {
              lg: state.dashboardLayouts.lg.filter(l => l.i !== widgetId),
              md: state.dashboardLayouts.md.filter(l => l.i !== widgetId),
              sm: state.dashboardLayouts.sm.filter(l => l.i !== widgetId),
            },
            activePresetId: null,
          });
        },

        saveDashboardLayout: () => {
          // Layout is auto-persisted via the persist middleware partialize
          // This is a no-op action that signals intent; the persist middleware
          // handles actual saving. We trigger a state write to ensure persistence.
          const state = get();
          set({
            dashboardLayouts: { ...state.dashboardLayouts },
          });
        },

        // Data Actions
        setRawCostData: (data) => set({ rawCostData: data }),
        setWbsTagData: (data) => set({ wbsTagData: data }),

        setFilters: (filters) => set((state) => ({
          filters: typeof filters === 'function'
            ? filters(state.filters)
            : filters
        })),

        setIsLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),

        clearData: () => set({
          rawCostData: [],
          wbsTagData: [],
          error: null,
        }),

        // Chat Actions
        setChatChartRequest: (request) => set({ chatChartRequest: request }),

        // Combined Actions
        updateFilter: (key, value) => set((state) => ({
          filters: {
            ...state.filters,
            [key]: value,
          }
        })),
      }),
      {
        name: 'cost-scraper-store',
        // Persist filters, panel tab, and dashboard state
        partialize: (state) => ({
          filters: state.filters,
          rightPanelTab: state.rightPanelTab,
          viewMode: state.viewMode,
          dashboardWidgets: state.dashboardWidgets,
          dashboardLayouts: state.dashboardLayouts,
          dashboardLocked: state.dashboardLocked,
          activePresetId: state.activePresetId,
        }),
      }
    ),
    { name: 'CostScraperStore' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

// Use selectors for derived state to avoid unnecessary re-renders
export const selectIsDataLoaded = (state: AppState) => state.rawCostData.length > 0;

export const selectProjectNumbers = (state: AppState) =>
  state.filters.projectNumbers
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

export const selectFilterHints = (state: AppState) => ({
  project_numbers: selectProjectNumbers(state),
  start_month: state.filters.startMonth || undefined,
  district_id: state.filters.districtId || undefined,
  wbs_tags: state.filters.wbsTags || {},
});

// ============================================================================
// Hooks for specific state slices
// ============================================================================

export const useUIState = () => useAppStore((state) => ({
  leftSidebarOpen: state.leftSidebarOpen,
  rightPanelOpen: state.rightPanelOpen,
  rightPanelTab: state.rightPanelTab,
  aboutOpen: state.aboutOpen,
  voiceChatOpen: state.voiceChatOpen,
  viewMode: state.viewMode,
}));

export const useUIActions = () => useAppStore((state) => ({
  setLeftSidebarOpen: state.setLeftSidebarOpen,
  setRightPanelOpen: state.setRightPanelOpen,
  setRightPanelTab: state.setRightPanelTab,
  setAboutOpen: state.setAboutOpen,
  setVoiceChatOpen: state.setVoiceChatOpen,
  setViewMode: state.setViewMode,
  toggleLeftSidebar: state.toggleLeftSidebar,
  toggleRightPanel: state.toggleRightPanel,
}));

export const useDataState = () => useAppStore((state) => ({
  rawCostData: state.rawCostData,
  wbsTagData: state.wbsTagData,
  filters: state.filters,
  isLoading: state.isLoading,
  error: state.error,
}));

export const useDataActions = () => useAppStore((state) => ({
  setRawCostData: state.setRawCostData,
  setWbsTagData: state.setWbsTagData,
  setFilters: state.setFilters,
  setIsLoading: state.setIsLoading,
  setError: state.setError,
  clearData: state.clearData,
  updateFilter: state.updateFilter,
}));

export const useChatState = () => useAppStore((state) => ({
  chatChartRequest: state.chatChartRequest,
  setChatChartRequest: state.setChatChartRequest,
}));

export const useDashboardState = () => useAppStore((state) => ({
  dashboardWidgets: state.dashboardWidgets,
  dashboardLayouts: state.dashboardLayouts,
  dashboardLocked: state.dashboardLocked,
  activePresetId: state.activePresetId,
}));

export const useDashboardActions = () => useAppStore((state) => ({
  setDashboardWidgets: state.setDashboardWidgets,
  setDashboardLayouts: state.setDashboardLayouts,
  setDashboardLocked: state.setDashboardLocked,
  applyPreset: state.applyPreset,
  addWidget: state.addWidget,
  removeWidget: state.removeWidget,
  saveDashboardLayout: state.saveDashboardLayout,
}));
