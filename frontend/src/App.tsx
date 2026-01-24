import { useState, useCallback } from 'react';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { SidebarFilters } from './components/SidebarFilters';
import { DataTable } from './components/DataTable';
import { CostCharts } from './components/CostCharts';
import { DataExportPanel } from './components/DataExportPanel';
import { ChatInterface } from './components/ChatInterface';
import { fetchCostData, isStaticDeployment } from './api/costDataApi';
import { CostDataRow, QueryFilters } from './api/types';

const DEFAULT_FILTERS: QueryFilters = {
  projectNumbers: '106049,104831,105553,104834,106073,106345,105119,104980',
  startMonth: '202101',
  districtId: '',
};

function App() {
  const [data, setData] = useState<CostDataRow[]>([]);
  const [filters, setFilters] = useState<QueryFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('filters');

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
      setSidebarOpen(true);
      setSidebarTab('chart');
      return;
    }

    // /show table
    if (lowerCommand === '/show table') {
      setSidebarOpen(true);
      setSidebarTab('table');
      return;
    }

    // /show filters
    if (lowerCommand === '/show filters') {
      setSidebarOpen(true);
      setSidebarTab('filters');
      return;
    }

    // /export
    if (lowerCommand === '/export') {
      setSidebarOpen(true);
      setSidebarTab('export');
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
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="header-menu-btn"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="header-logo">
              <svg className="w-5 h-5 text-midnight-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">northstar.bd</h1>
              <p className="text-xs text-slate-400 hidden sm:block">Cost Analysis Assistant</p>
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

          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Connected</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
        >
          {sidebarTab === 'filters' && (
            <SidebarFilters
              filters={filters}
              onFilterChange={setFilters}
              onSearch={handleSearch}
              isLoading={isLoading}
            />
          )}
          {sidebarTab === 'chart' && (
            <div className="sidebar-chart-container">
              {data.length > 0 ? (
                <CostCharts data={data} />
              ) : (
                <div className="sidebar-empty-state">
                  <p>No data loaded. Use filters to load project data.</p>
                </div>
              )}
            </div>
          )}
          {sidebarTab === 'table' && (
            <div className="sidebar-table-container">
              {data.length > 0 ? (
                <DataTable data={data} isLoading={isLoading} />
              ) : (
                <div className="sidebar-empty-state">
                  <p>No data loaded. Use filters to load project data.</p>
                </div>
              )}
            </div>
          )}
          {sidebarTab === 'export' && (
            <div className="sidebar-export-container">
              {data.length > 0 ? (
                <DataExportPanel data={data} />
              ) : (
                <div className="sidebar-empty-state">
                  <p>No data loaded. Use filters to load project data.</p>
                </div>
              )}
            </div>
          )}
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
      </div>
    </div>
  );
}

export default App;
