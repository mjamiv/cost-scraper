import { useState, useCallback, useMemo, useEffect } from 'react';
import { Agentation } from 'agentation';
import { Sidebar } from './components/Sidebar';
import { RightPanel, RightPanelTab } from './components/RightPanel';
import { SidebarFilters } from './components/SidebarFilters';
import { DataTable } from './components/DataTable';
import { CostCharts } from './components/CostCharts';
import { DataExportPanel } from './components/DataExportPanel';
import { ChatInterface } from './components/ChatInterface';
import { VoiceChatPanel } from './components/VoiceChatPanel';
// WBSDataInspector removed - functionality integrated into main flow
import { fetchCostData, fetchWBSData, isStaticDeployment } from './api/costDataApi';
import { CostDataRow, QueryFilters, WBSDataRow } from './api/types';
import { mergeCostDataWithTags, filterByWBSTags, CostDataRowWithTags } from './utils/wbsDataMerger';

const DEFAULT_FILTERS: QueryFilters = {
  projectNumbers: '106073',
  startMonth: '202101',
  districtId: '',
  wbsTags: {},
};

function App() {
  // Raw data from API (before filtering)
  const [rawCostData, setRawCostData] = useState<CostDataRow[]>([]);
  const [wbsTagData, setWbsTagData] = useState<WBSDataRow[]>([]);

  const [filters, setFilters] = useState<QueryFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [sidebarAutoCloseTimer, setSidebarAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('chart');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [voiceChatOpen, setVoiceChatOpen] = useState(false);

  // Auto-collapse sidebar after 5 seconds of inactivity
  useEffect(() => {
    if (leftSidebarOpen) {
      // Clear any existing timer
      if (sidebarAutoCloseTimer) {
        clearTimeout(sidebarAutoCloseTimer);
      }
      // Set new timer to auto-close after 5 seconds
      const timer = setTimeout(() => {
        setLeftSidebarOpen(false);
      }, 5000);
      setSidebarAutoCloseTimer(timer);

      return () => clearTimeout(timer);
    }
  }, [leftSidebarOpen]);

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

  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch both cost data and WBS tag data in parallel
      const [costResponse, wbsResponse] = await Promise.all([
        fetchCostData(filters),
        fetchWBSData(filters.projectNumbers, 10000)
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
  }, [filters]);

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
  }, [handleSearch]);

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="flex items-center gap-3">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className="header-menu-btn"
            title={leftSidebarOpen ? 'Close filters' : 'Open filters'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Northstar" className="header-logo-img" />
            <h1 className="text-lg font-bold tracking-tight">northstar.cost-chat</h1>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Voice Chat Button - Chat bubble with dollar sign */}
          <button
            onClick={() => setVoiceChatOpen(true)}
            className="header-menu-btn"
            title="Voice Cost Assistant"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 7v2m0 4v2m-2-6c0-1 .5-2 2-2s2 1 2 2-.5 1.5-2 2c-1.5.5-2 1-2 2s.5 2 2 2 2-1 2-2" strokeLinecap="round" />
            </svg>
          </button>

          {/* About Button */}
          <button
            onClick={() => setAboutOpen(true)}
            className="header-menu-btn"
            title="About this application"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Right Panel Toggle */}
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className={`header-menu-btn ${rightPanelOpen ? 'active' : ''}`}
            title={rightPanelOpen ? 'Close panel' : 'Open chart/table'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Left Sidebar - Filters */}
        <Sidebar isOpen={leftSidebarOpen} onClose={() => setLeftSidebarOpen(false)}>
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

        {/* Main Chat Area */}
        <main className="app-main">
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
          <ChatInterface
            data={data}
            onCommand={handleChatCommand}
          />
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
              {data.length > 0 ? (
                <CostCharts data={data} />
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
                <DataTable data={data} isLoading={isLoading} />
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
                <DataExportPanel data={data} />
              ) : (
                <div className="panel-empty-state">
                  <p>No data loaded. Use filters to load project data.</p>
                </div>
              )}
            </div>
          )}
        </RightPanel>
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
      <VoiceChatPanel
        data={data}
        isOpen={voiceChatOpen}
        onClose={() => setVoiceChatOpen(false)}
      />

      {/* Agentation - development only */}
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}

export default App;
