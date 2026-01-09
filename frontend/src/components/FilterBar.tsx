import { QueryFilters } from '../api/types';

interface FilterBarProps {
  filters: QueryFilters;
  onFilterChange: (filters: QueryFilters) => void;
  onSearch: () => void;
  isLoading: boolean;
}

const DEFAULT_PROJECTS = '106049,104831,105553,104834,106073,106345,105119,104980';

export function FilterBar({ filters, onFilterChange, onSearch, isLoading }: FilterBarProps) {
  const handleProjectsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, projectNumbers: e.target.value });
  };

  const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, startMonth: e.target.value });
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, districtId: e.target.value });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="glass-card p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <h2 className="text-lg font-semibold text-slate-200">Query Filters</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Project Numbers */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Project Numbers
            <span className="text-slate-500 text-xs ml-2">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={filters.projectNumbers}
            onChange={handleProjectsChange}
            onKeyPress={handleKeyPress}
            placeholder={DEFAULT_PROJECTS}
            className="input-field font-mono text-sm"
          />
        </div>

        {/* Start Month */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Start Month
            <span className="text-slate-500 text-xs ml-2">(YYYYMM)</span>
          </label>
          <input
            type="text"
            value={filters.startMonth}
            onChange={handleStartMonthChange}
            onKeyPress={handleKeyPress}
            placeholder="202101"
            maxLength={6}
            className="input-field font-mono"
          />
        </div>

        {/* District ID */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            District ID
            <span className="text-slate-500 text-xs ml-2">(optional)</span>
          </label>
          <input
            type="text"
            value={filters.districtId}
            onChange={handleDistrictChange}
            onKeyPress={handleKeyPress}
            placeholder="e.g., SE5001"
            className="input-field font-mono"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Press <kbd className="px-2 py-0.5 bg-midnight-700 rounded text-slate-300 font-mono text-xs">Enter</kbd> or click Search to query
        </div>
        <button
          onClick={onSearch}
          disabled={isLoading}
          className="btn-primary flex items-center gap-2"
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
      </div>
    </div>
  );
}

