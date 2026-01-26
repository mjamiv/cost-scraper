import { useState, useCallback } from 'react';
import { fetchWBSData, fetchWBSSnapshot } from '../api/costDataApi';
import { WBSDataResponse } from '../api/types';

interface WBSDataInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  projectNumbers: string;
  fiscalMonth?: string;
}

type ViewType = 'wbs' | 'snapshot';

export function WBSDataInspector({ isOpen, onClose, projectNumbers, fiscalMonth }: WBSDataInspectorProps) {
  const [viewType, setViewType] = useState<ViewType>('wbs');
  const [data, setData] = useState<WBSDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(100);

  const handleFetchData = useCallback(async () => {
    if (!projectNumbers.trim()) {
      setError('Please enter at least one project number');
      return;
    }

    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      let result: WBSDataResponse;
      if (viewType === 'wbs') {
        result = await fetchWBSData(projectNumbers, 1000);
      } else {
        result = await fetchWBSSnapshot(projectNumbers, fiscalMonth, 1000);
      }
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [projectNumbers, fiscalMonth, viewType]);

  const handleViewTypeChange = (newType: ViewType) => {
    setViewType(newType);
    setData(null);
    setError(null);
  };

  if (!isOpen) return null;

  const displayedRows = data?.rows.slice(0, displayLimit) || [];
  const hasMoreRows = (data?.row_count || 0) > displayLimit;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h2 className="text-lg font-bold text-white">WBS Data Inspector</h2>
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-neutral-800 rounded-lg p-1">
              <button
                onClick={() => handleViewTypeChange('wbs')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'wbs'
                    ? 'bg-gold text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                WBS
              </button>
              <button
                onClick={() => handleViewTypeChange('snapshot')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'snapshot'
                    ? 'bg-gold text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                WBS Snapshot
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Query Info */}
        <div className="px-6 py-3 bg-neutral-800/50 border-b border-neutral-700 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-neutral-400">
              Projects: <span className="text-gold font-mono">{projectNumbers || 'None'}</span>
            </span>
            {viewType === 'snapshot' && fiscalMonth && (
              <span className="text-neutral-400">
                Month: <span className="text-gold font-mono">{fiscalMonth}</span>
              </span>
            )}
          </div>

          <button
            onClick={handleFetchData}
            disabled={isLoading || !projectNumbers.trim()}
            className="px-4 py-2 bg-gold text-black font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Fetch Data
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 mb-4">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Empty State */}
          {!data && !error && !isLoading && (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-lg font-medium mb-2">No Data Loaded</p>
              <p className="text-sm">Click "Fetch Data" to load WBS information</p>
            </div>
          )}

          {/* Data Display */}
          {data && data.rows.length > 0 && (
            <div>
              {/* Stats */}
              <div className="flex items-center gap-6 mb-4 text-sm">
                <span className="text-neutral-400">
                  View: <span className="text-white font-mono text-xs">{data.view_name}</span>
                </span>
                <span className="text-neutral-400">
                  Rows: <span className="text-gold font-bold">{data.row_count.toLocaleString()}</span>
                </span>
                <span className="text-neutral-400">
                  Time: <span className="text-green-400">{data.timing_ms.toFixed(0)}ms</span>
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-neutral-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-800 sticky top-0">
                    <tr>
                      {data.columns.map((col, idx) => (
                        <th
                          key={idx}
                          className="px-3 py-2 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider whitespace-nowrap border-b border-neutral-700"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {displayedRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-neutral-800/50">
                        {data.columns.map((col, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-3 py-2 text-neutral-300 whitespace-nowrap font-mono text-xs"
                          >
                            {(row as Record<string, unknown>)[col] != null
                              ? String((row as Record<string, unknown>)[col])
                              : <span className="text-neutral-600">null</span>
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Load More */}
              {hasMoreRows && (
                <div className="mt-4 flex items-center justify-center">
                  <button
                    onClick={() => setDisplayLimit(prev => prev + 100)}
                    className="px-4 py-2 text-sm text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition-colors"
                  >
                    Show More (showing {displayLimit} of {data.row_count})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* No Results */}
          {data && data.rows.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium mb-2">No Results</p>
              <p className="text-sm">No WBS data found for the specified projects</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
