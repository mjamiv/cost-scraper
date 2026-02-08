import { useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { RightPanel } from './components/RightPanel';
import { SidebarFilters } from './components/SidebarFilters';
import { fetchCostData, fetchWBSData, isStaticDeployment, ChartRequest } from './api/costDataApi';
import { WBSDataRow } from './api/types';
import { mergeCostDataWithTags, filterByWBSTags, CostDataRowWithTags } from './utils/wbsDataMerger';
import { useAppStore } from './store/appStore';
import { HealthScorecard } from './components/HealthScorecard';
import { SCurveChart } from './components/SCurveChart';
import { DashboardView } from './dashboard';

// Lazy load heavy components for better initial load performance
const DataTable = lazy(() => import('./components/DataTable').then(m => ({ default: m.DataTable })));
const CostCharts = lazy(() => import('./components/CostCharts').then(m => ({ default: m.CostCharts })));
const MetricTrendChart = lazy(() => import('./components/ChatCharts').then(m => ({ default: m.MetricTrendChart })));
const DataExportPanel = lazy(() => import('./components/DataExportPanel').then(m => ({ default: m.DataExportPanel })));
const ChatInterface = lazy(() => import('./components/ChatInterface').then(m => ({ default: m.ChatInterface })));
const VoiceChatPanel = lazy(() => import('./components/VoiceChatPanel').then(m => ({ default: m.VoiceChatPanel })));

// Loading fallback component
function LoadingFallback({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-neutral-400">{message}</span>
      </div>
    </div>
  );
}

function App() {
  const queryClient = useQueryClient();

  // Zustand store state
  const rawCostData = useAppStore(s => s.rawCostData);
  const wbsTagData = useAppStore(s => s.wbsTagData);
  const filters = useAppStore(s => s.filters);
  const isLoading = useAppStore(s => s.isLoading);
  const error = useAppStore(s => s.error);
  const leftSidebarOpen = useAppStore(s => s.leftSidebarOpen);
  const rightPanelOpen = useAppStore(s => s.rightPanelOpen);
  const rightPanelTab = useAppStore(s => s.rightPanelTab);
  const aboutOpen = useAppStore(s => s.aboutOpen);
  const voiceChatOpen = useAppStore(s => s.voiceChatOpen);
  const chatChartRequest = useAppStore(s => s.chatChartRequest);
  const viewMode = useAppStore(s => s.viewMode);

  // Zustand store actions
  const setRawCostData = useAppStore(s => s.setRawCostData);
  const setWbsTagData = useAppStore(s => s.setWbsTagData);
  const setFilters = useAppStore(s => s.setFilters);
  const setIsLoading = useAppStore(s => s.setIsLoading);
  const setError = useAppStore(s => s.setError);
  const setLeftSidebarOpen = useAppStore(s => s.setLeftSidebarOpen);
  const setRightPanelOpen = useAppStore(s => s.setRightPanelOpen);
  const setRightPanelTab = useAppStore(s => s.setRightPanelTab);
  const setAboutOpen = useAppStore(s => s.setAboutOpen);
  const setVoiceChatOpen = useAppStore(s => s.setVoiceChatOpen);
  const setChatChartRequest = useAppStore(s => s.setChatChartRequest);
  const setViewMode = useAppStore(s => s.setViewMode);

  // Local ref for sidebar auto-close timer
  const sidebarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset sidebar auto-close timer (called on user activity)
  const resetSidebarTimer = useCallback(() => {
    if (sidebarTimerRef.current) {
      clearTimeout(sidebarTimerRef.current);
    }
    if (leftSidebarOpen) {
      sidebarTimerRef.current = setTimeout(() => {
        setLeftSidebarOpen(false);
      }, 5000);
    }
  }, [leftSidebarOpen, setLeftSidebarOpen]);

  // Start/stop sidebar timer when sidebar opens/closes
  useEffect(() => {
    if (leftSidebarOpen) {
      resetSidebarTimer();
    } else if (sidebarTimerRef.current) {
      clearTimeout(sidebarTimerRef.current);
      sidebarTimerRef.current = null;
    }
    return () => {
      if (sidebarTimerRef.current) {
        clearTimeout(sidebarTimerRef.current);
      }
    };
  }, [leftSidebarOpen, resetSidebarTimer]);

  // Merge cost data with WBS tags (memoized)
  const mergedData = useMemo<CostDataRowWithTags[]>(() => {
    if (rawCostData.length === 0) return [];
    return mergeCostDataWithTags(rawCostData, wbsTagData);
  }, [rawCostData, wbsTagData]);

  // Apply WBS tag filters client-side (memoized)
  const data = useMemo<CostDataRowWithTags[]>(() => {
    if (mergedData.length === 0) return [];
    const hasFilters = Object.values(filters.wbsTags || {}).some(v => v && v.length > 0);
    if (!hasFilters) return mergedData;
    return filterByWBSTags(mergedData, filters.wbsTags || {});
  }, [mergedData, filters.wbsTags]);

  // Search handler: uses React Query's fetchQuery for caching + deduplication
  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [costResponse, wbsResponse] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['cost-data', filters.projectNumbers, filters.startMonth, filters.districtId],
          queryFn: () => fetchCostData(filters),
          staleTime: 5 * 60 * 1000,
        }),
        queryClient.fetchQuery({
          queryKey: ['wbs-data', filters.projectNumbers],
          queryFn: () => fetchWBSData(filters.projectNumbers, 10000),
          staleTime: 5 * 60 * 1000,
        }),
      ]);

      setRawCostData(costResponse.data);
      setWbsTagData(wbsResponse.rows as WBSDataRow[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred while fetching data';
      setError(message);
      setRawCostData([]);
      setWbsTagData([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, queryClient, setIsLoading, setError, setRawCostData, setWbsTagData]);

  // Handle chat commands
  const handleChatCommand = useCallback((command: string) => {
    const lowerCommand = command.toLowerCase();
    const parts = command.split(/\s+/);

    // /filter project 106049,104831
    if (lowerCommand.startsWith('/filter project')) {
      const projectValue = command.replace(/\/filter\s+project\s*/i, '').trim();
      if (projectValue) {
        setFilters(prev => ({ ...prev, projectNumbers: projectValue }));
      }
      return;
    }

    // /filter month 202301
    if (lowerCommand.startsWith('/filter month')) {
      const monthValue = parts[2] || '';
      if (monthValue) {
        setFilters(prev => ({ ...prev, startMonth: monthValue }));
      }
      return;
    }

    // /filter district D01
    if (lowerCommand.startsWith('/filter district')) {
      const districtValue = parts[2] || '';
      setFilters(prev => ({ ...prev, districtId: districtValue }));
      return;
    }

    // /search
    if (lowerCommand === '/search') {
      handleSearch();
      return;
    }

    // /show chart
    if (lowerCommand === '/show chart') {
      setRightPanelOpen(true);
      setRightPanelTab('chart');
      return;
    }

    // /show table
    if (lowerCommand === '/show table') {
      setRightPanelOpen(true);
      setRightPanelTab('table');
      return;
    }

    // /show filters
    if (lowerCommand === '/show filters') {
      setLeftSidebarOpen(true);
      return;
    }

    // /export
    if (lowerCommand === '/export') {
      setRightPanelOpen(true);
      setRightPanelTab('export');
      return;
    }
  }, [handleSearch, setFilters, setRightPanelOpen, setRightPanelTab, setLeftSidebarOpen]);

  const handleChatChartRequest = useCallback((request: ChartRequest) => {
    setChatChartRequest(request);
    setRightPanelOpen(true);
    setRightPanelTab('chart');
  }, [setChatChartRequest, setRightPanelOpen, setRightPanelTab]);

  const filterHints = useMemo(() => ({
    project_numbers: filters.projectNumbers
      .split(',')
      .map(p => p.trim())
      .filter(Boolean),
    start_month: filters.startMonth || undefined,
    district_id: filters.districtId || undefined,
    wbs_tags: (filters.wbsTags || {}) as Record<string, string[]>,
  }), [filters]);

  return (
    <div className="app-layout">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById('main-content');
          if (main) {
            main.focus();
            main.scrollIntoView();
          }
        }}
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="app-header" role="banner">
        <div className="flex items-center gap-3">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className="header-menu-btn"
            aria-label={leftSidebarOpen ? 'Close filters panel' : 'Open filters panel'}
            aria-expanded={leftSidebarOpen}
            aria-controls="sidebar-filters"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="header-logo-img" aria-hidden="true" />
            <h1 className="text-lg font-bold tracking-tight">northstar.cost-chat</h1>
          </div>
        </div>

        {/* Right side navigation */}
        <nav className="flex items-center gap-4" role="navigation" aria-label="Main navigation">
          {/* View Mode Toggle */}
          <div className="header-view-toggle">
            <button
              onClick={() => setViewMode('chat')}
              className={`header-view-toggle-btn ${viewMode === 'chat' ? 'active' : ''}`}
              aria-label="Chat view"
              title="Chat view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('dashboard')}
              className={`header-view-toggle-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
              aria-label="Dashboard view"
              title="Dashboard view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </button>
          </div>

          {/* Voice Chat Button */}
          <button
            onClick={() => setVoiceChatOpen(true)}
            className="header-menu-btn"
            aria-label="Open voice cost assistant"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 7v2m0 4v2m-2-6c0-1 .5-2 2-2s2 1 2 2-.5 1.5-2 2c-1.5.5-2 1-2 2s.5 2 2 2 2-1 2-2" strokeLinecap="round" />
            </svg>
          </button>

          {/* About Button */}
          <button
            onClick={() => setAboutOpen(true)}
            className="header-menu-btn"
            aria-label="About this application"
            aria-haspopup="dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Right Panel Toggle */}
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className={`header-menu-btn ${rightPanelOpen ? 'active' : ''}`}
            aria-label={rightPanelOpen ? 'Close chart and table panel' : 'Open chart and table panel'}
            aria-expanded={rightPanelOpen}
            aria-controls="right-panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        </nav>
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Left Sidebar - Filters */}
        <Sidebar isOpen={leftSidebarOpen} onClose={() => setLeftSidebarOpen(false)} onActivity={resetSidebarTimer}>
          <SidebarFilters
            filters={filters}
            onFilterChange={setFilters}
            onSearch={handleSearch}
            isLoading={isLoading}
            recordCount={mergedData.length}
            filteredCount={data.length}
            isDemo={isStaticDeployment}
            data={data}
            mergedData={mergedData}
          />
        </Sidebar>

        {viewMode === 'dashboard' ? (
          /* Dashboard View - Full Width Grid */
          <main className="app-main app-main-dashboard" id="main-content" tabIndex={-1} role="main" aria-label="Dashboard">
            <DashboardView data={data} isLoading={isLoading} />
          </main>
        ) : (
          <>
            {/* Main Chat Area */}
            <main className="app-main" id="main-content" tabIndex={-1} role="main" aria-label="Chat interface">
              {/* Health Scorecard - shown when data is loaded */}
              {mergedData.length > 0 && (
                <HealthScorecard
                  projectNumbers={filters.projectNumbers}
                  startMonth={filters.startMonth}
                />
              )}

              {/* Error Alert */}
              {error && (
                <div className="chat-error-alert">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-red-400">Error Loading Data</h4>
                    <p className="text-sm text-red-300/80">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Chat Interface */}
              <Suspense fallback={<LoadingFallback message="Loading chat..." />}>
                <ChatInterface
                  data={mergedData}
                  onCommand={handleChatCommand}
                  filterHints={filterHints}
                  onChartRequest={handleChatChartRequest}
                />
              </Suspense>
            </main>

            {/* Right Panel - Chart/Table/Export */}
            <RightPanel
              isOpen={rightPanelOpen}
              activeTab={rightPanelTab}
              onTabChange={setRightPanelTab}
              onClose={() => setRightPanelOpen(false)}
              activeFilters={filters.wbsTags}
            >
              {rightPanelTab === 'chart' && (
                <div className="right-panel-chart-container">
                  {mergedData.length > 0 ? (
                    <>
                      <Suspense fallback={<LoadingFallback message="Loading charts..." />}>
                        {chatChartRequest?.type === 'metric-trend' ? (
                          <MetricTrendChart
                            data={mergedData}
                            dateRange={chatChartRequest?.dateRange || undefined}
                            projects={chatChartRequest?.projects || undefined}
                            tags={chatChartRequest?.tags || filters.wbsTags}
                            metric={chatChartRequest?.metric || undefined}
                            groupBy={chatChartRequest?.groupBy || undefined}
                            style={chatChartRequest?.style || undefined}
                          />
                        ) : (
                          <CostCharts data={mergedData} chartRequest={chatChartRequest} activeFilters={filters.wbsTags} />
                        )}
                      </Suspense>
                      <div className="mt-4">
                        <SCurveChart projectNumbers={filters.projectNumbers} startMonth={filters.startMonth} />
                      </div>
                    </>
                  ) : (
                    <div className="panel-empty-state">
                      <p>No data loaded. Use filters to load project data.</p>
                    </div>
                  )}
                </div>
              )}
              {rightPanelTab === 'table' && (
                <div className="right-panel-table-container">
                  {data.length > 0 ? (
                    <Suspense fallback={<LoadingFallback message="Loading table..." />}>
                      <DataTable data={data} isLoading={isLoading} />
                    </Suspense>
                  ) : (
                    <div className="panel-empty-state">
                      <p>No data loaded. Use filters to load project data.</p>
                    </div>
                  )}
                </div>
              )}
              {rightPanelTab === 'export' && (
                <div className="right-panel-export-container">
                  {data.length > 0 ? (
                    <Suspense fallback={<LoadingFallback message="Loading export..." />}>
                      <DataExportPanel data={data} />
                    </Suspense>
                  ) : (
                    <div className="panel-empty-state">
                      <p>No data loaded. Use filters to load project data.</p>
                    </div>
                  )}
                </div>
              )}
            </RightPanel>
          </>
        )}
      </div>

      {/* About Modal */}
      {aboutOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAboutOpen(false)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Northstar" className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-bold text-white">northstar.cost-chat</h2>
                  <p className="text-sm text-neutral-400">Project Cost Analytics</p>
                </div>
              </div>
              <button onClick={() => setAboutOpen(false)} className="text-neutral-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-neutral-300">
              <p>
                <strong className="text-white">northstar.cost-chat</strong> is an AI-powered cost analysis assistant that helps you explore and understand project cost data.
              </p>

              <div>
                <h3 className="text-white font-semibold mb-2">Key Features:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Natural language queries about project costs and budgets</li>
                  <li>Interactive charts for spend trends, variances, and comparisons</li>
                  <li>Hierarchical data tables with drill-down capabilities</li>
                  <li>Voice input and audio responses</li>
                  <li>Data export in multiple formats (CSV, Excel, PDF)</li>
                  <li>Earned value analysis and forecasting metrics</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">How to Use:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Open <strong>Settings</strong> to configure project filters and load data</li>
                  <li>Ask questions in the chat like "What's our budget status?"</li>
                  <li>Use commands like <code className="text-gold">/chart spend</code> for visualizations</li>
                  <li>Type <code className="text-gold">/help</code> for all available commands</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-700 text-xs text-neutral-500 text-center">
              Powered by Snowflake + OpenAI
            </div>
          </div>
        </div>
      )}

      {/* Voice Chat Panel */}
      {voiceChatOpen && (
        <Suspense fallback={<LoadingFallback message="Loading voice chat..." />}>
          <VoiceChatPanel
            data={mergedData}
            isOpen={voiceChatOpen}
            onClose={() => setVoiceChatOpen(false)}
          />
        </Suspense>
      )}

    </div>
  );
}

export default App;
