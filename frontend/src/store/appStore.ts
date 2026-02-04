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

// ============================================================================
// Types
// ============================================================================

export type RightPanelTab = 'chart' | 'table' | 'export';

interface UIState {
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  aboutOpen: boolean;
  voiceChatOpen: boolean;
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

interface AppState extends UIState, DataState, ChatState {
  // UI Actions
  setLeftSidebarOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setAboutOpen: (open: boolean) => void;
  setVoiceChatOpen: (open: boolean) => void;
  toggleLeftSidebar: () => void;
  toggleRightPanel: () => void;
  
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
      (set) => ({
        // Initial State
        ...DEFAULT_UI_STATE,
        ...DEFAULT_DATA_STATE,
        ...DEFAULT_CHAT_STATE,

        // UI Actions
        setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
        setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
        setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
        setAboutOpen: (open) => set({ aboutOpen: open }),
        setVoiceChatOpen: (open) => set({ voiceChatOpen: open }),
        
        toggleLeftSidebar: () => set((state) => ({ 
          leftSidebarOpen: !state.leftSidebarOpen 
        })),
        
        toggleRightPanel: () => set((state) => ({ 
          rightPanelOpen: !state.rightPanelOpen 
        })),

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
        // Only persist filters, not data
        partialize: (state) => ({
          filters: state.filters,
          rightPanelTab: state.rightPanelTab,
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
}));

export const useUIActions = () => useAppStore((state) => ({
  setLeftSidebarOpen: state.setLeftSidebarOpen,
  setRightPanelOpen: state.setRightPanelOpen,
  setRightPanelTab: state.setRightPanelTab,
  setAboutOpen: state.setAboutOpen,
  setVoiceChatOpen: state.setVoiceChatOpen,
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
