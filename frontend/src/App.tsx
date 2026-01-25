import { useState, useCallback } from 'react';
import { Agentation } from 'agentation';
import { Sidebar } from './components/Sidebar';
import { RightPanel, RightPanelTab } from './components/RightPanel';
import { SidebarFilters } from './components/SidebarFilters';
import { DataTable } from './components/DataTable';
import { CostCharts } from './components/CostCharts';
import { DataExportPanel } from './components/DataExportPanel';
import { ChatInterface } from './components/ChatInterface';
import { fetchCostData, isStaticDeployment } from './api/costDataApi';
import { CostDataRow, QueryFilters } from './api/types';

const DEFAULT_FILTERS: QueryFilters = {
  projectNumbers: '106073',
  startMonth: '202101',
  districtId: '',
};

function App() {
  const [data, setData] = useState<CostDataRow[]>([]);
  const [filters, setFilters] = useState<QueryFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('chart');

  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchCostData(filters);
      setData(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred while fetching data';
      setError(message);
      setData([]);
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
            <div>
              <h1 className="text-lg font-bold tracking-tight">northstar.cost-chat</h1>
              <p className="text-xs text-neutral-500 hidden sm:block">chat with cost</p>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Demo Badge */}
          {isStaticDeployment && (
            <span className="demo-badge">Demo</span>
          )}

          {/* Record Count */}
          {data.length > 0 && (
            <div className="header-stat">
              <span className="header-stat-value">{data.length.toLocaleString()}</span>
              <span className="header-stat-label">records</span>
            </div>
          )}

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

          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="hidden sm:inline">Connected</span>
          </div>
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

      {/* Agentation - development only */}
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}

export default App;
