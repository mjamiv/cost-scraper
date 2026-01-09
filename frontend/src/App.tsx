import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { DataTable } from './components/DataTable';
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

  return (
    <div className="min-h-screen">
      {/* Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
        
        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1800px] mx-auto px-6 py-8">
        {/* Demo Banner for GitHub Pages */}
        {isStaticDeployment && (
          <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-amber-300">Demo Mode</h3>
                <p className="text-sm text-amber-200/70">
                  This is a static demo with simulated data. Connect to your Snowflake backend for live data.
                </p>
              </div>
            </div>
          </div>
        )}

        <Header totalRecords={data.length} />
        
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          onSearch={handleSearch}
          isLoading={isLoading}
        />

        {error && (
          <div className="glass-card p-4 mb-6 border-l-4 border-red-500 bg-red-500/10">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-medium text-red-400">Error Loading Data</h4>
                <p className="text-sm text-red-300/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        <DataTable data={data} isLoading={isLoading} />
        
        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>Cost Scraper v1.0 • Powered by Snowflake</p>
        </footer>
      </div>
    </div>
  );
}

export default App;

