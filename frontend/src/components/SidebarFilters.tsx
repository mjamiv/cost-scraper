import { QueryFilters, CostDataRow } from '../api/types';

interface SidebarFiltersProps {
  filters: QueryFilters;
  onFilterChange: (filters: QueryFilters) => void;
  onSearch: () => void;
  isLoading: boolean;
  recordCount?: number;
  isDemo?: boolean;
  data?: CostDataRow[];
}

const DEFAULT_PROJECTS = '106073';

// Extract unique project info from data
function getProjectInfo(data: CostDataRow[] | undefined): { number: string; description: string }[] {
  if (!data || data.length === 0) return [];

  // Get root-level rows (empty CBS_HIERARCHY) which have project totals
  const rootRows = data.filter(row => !row.CBS_HIERARCHY || row.CBS_HIERARCHY === '');

  // Get unique projects with their descriptions
  const projectMap = new Map<string, string>();
  rootRows.forEach(row => {
    if (row.PROJECT_NUMBER && !projectMap.has(row.PROJECT_NUMBER)) {
      projectMap.set(row.PROJECT_NUMBER, row.WBS_DESCRIPTION || row.PROJECT_NUMBER);
    }
  });

  return Array.from(projectMap.entries()).map(([number, description]) => ({
    number,
    description
  }));
}

export function SidebarFilters({ filters, onFilterChange, onSearch, isLoading, recordCount = 0, isDemo = false, data }: SidebarFiltersProps) {
  const projectInfo = getProjectInfo(data);
  const handleProjectsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onFilterChange({ ...filters, projectNumbers: e.target.value });
  };

  const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, startMonth: e.target.value });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      onSearch();
    }
  };

  return (
    <div className="sidebar-filters">
      {/* Stats Section */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          {isDemo && (
            <span className="demo-badge">Demo</span>
          )}
          {recordCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gold font-mono">{recordCount.toLocaleString()}</span>
              <span className="text-xs text-neutral-500 uppercase">records</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs">Connected</span>
        </div>
      </div>

      {/* Project Info Section - shown when data is loaded */}
      {projectInfo.length > 0 && (
        <div className="mb-4 pb-4 border-b border-neutral-700">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Loaded Projects</h3>
          </div>
          <div className="space-y-2">
            {projectInfo.map(project => (
              <div key={project.number} className="rounded-lg bg-neutral-800/50 p-3 border border-neutral-700">
                <div className="text-xs text-gold font-mono mb-1">{project.number}</div>
                <div className="text-sm text-neutral-200 leading-tight">{project.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Query Filters</h3>
      </div>

      {/* Project Numbers */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-400 mb-2">
          Project Numbers
          <span className="text-slate-500 text-xs ml-1">(comma-separated)</span>
        </label>
        <textarea
          value={filters.projectNumbers}
          onChange={handleProjectsChange}
          onKeyPress={handleKeyPress}
          placeholder={DEFAULT_PROJECTS}
          rows={3}
          className="sidebar-input font-mono text-sm resize-none"
        />
      </div>

      {/* Start Month */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-400 mb-2">
          Start Month
          <span className="text-slate-500 text-xs ml-1">(YYYYMM)</span>
        </label>
        <input
          type="text"
          value={filters.startMonth}
          onChange={handleStartMonthChange}
          onKeyPress={handleKeyPress}
          placeholder="202101"
          maxLength={6}
          className="sidebar-input font-mono"
        />
      </div>

      {/* Search Button */}
      <button
        onClick={onSearch}
        disabled={isLoading}
        className="sidebar-search-btn w-full"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
          </>
        )}
      </button>

      {/* Help Text */}
      <p className="mt-4 text-xs text-slate-500">
        Or use chat commands: <code className="text-accent">/filter project 106049</code>
      </p>
    </div>
  );
}
