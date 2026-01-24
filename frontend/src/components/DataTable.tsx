import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  ExpandedState,
  Row,
} from '@tanstack/react-table';
import { CostDataRow, HierarchicalCostDataRow } from '../api/types';
import { buildHierarchicalData } from '../utils/hierarchyUtils';

interface DataTableProps {
  data: CostDataRow[];
  isLoading: boolean;
}

function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function getValueClass(value: number | null): string {
  if (value === null) return 'text-slate-500';
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-300';
}

export function DataTable({ data, isLoading }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Transform flat data to hierarchical structure
  const hierarchicalData = useMemo(() => buildHierarchicalData(data), [data]);

  const columns = useMemo<ColumnDef<HierarchicalCostDataRow>[]>(
    () => [
      // Expander column
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => {
          const canExpand = row.subRows && row.subRows.length > 0;
          if (!canExpand) {
            return <span className="w-6 inline-block" />;
          }
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              className="w-6 h-6 flex items-center justify-center hover:bg-midnight-600 rounded transition-colors"
            >
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  row.getIsExpanded() ? 'rotate-90' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          );
        },
        size: 40,
      },
      // Identification columns
      {
        header: 'Period',
        accessorKey: 'FISCAL_YEAR_MONTH_NO',
        cell: ({ getValue }) => (
          <span className="text-accent font-semibold">{getValue() as string}</span>
        ),
        size: 80,
      },
      {
        header: 'Project',
        accessorKey: 'PROJECT_NUMBER',
        cell: ({ getValue }) => (
          <span className="font-semibold">{getValue() as string}</span>
        ),
        size: 90,
      },
      {
        header: 'District',
        accessorKey: 'LEAD_DISTRICT',
        cell: ({ getValue }) => getValue() || '—',
        size: 120,
      },
      {
        header: 'WBS Element',
        accessorKey: 'WBS_ELEMENT',
        size: 140,
      },
      {
        header: 'CBS Hierarchy',
        accessorKey: 'CBS_HIERARCHY',
        cell: ({ row, getValue }) => {
          const depth = row.original.depth;
          const isAggregated = row.original.isAggregated;
          const value = getValue() as string | null;

          return (
            <div style={{ paddingLeft: depth * 20 }}>
              <span
                className={`text-xs ${
                  isAggregated ? 'text-amber-400 font-medium' : ''
                }`}
              >
                {value || '—'}
              </span>
            </div>
          );
        },
        size: 200,
      },
      {
        header: 'Description',
        accessorKey: 'WBS_DESCRIPTION',
        cell: ({ row, getValue }) => {
          const isAggregated = row.original.isAggregated;
          const value = getValue() as string | null;

          return (
            <span
              className={`text-xs truncate max-w-[200px] block ${
                isAggregated ? 'text-amber-400/80 italic' : ''
              }`}
              title={value || ''}
            >
              {value || '—'}
            </span>
          );
        },
        size: 200,
      },

      // Current Budget columns
      {
        header: 'CB Qty',
        accessorKey: 'CB_QTY',
        cell: ({ getValue }) => formatNumber(getValue() as number | null),
        meta: { group: 'budget' },
        size: 80,
      },
      {
        header: 'CB Amount',
        accessorKey: 'CB_AMT',
        cell: ({ getValue }) => formatCurrency(getValue() as number | null),
        meta: { group: 'budget' },
        size: 100,
      },
      {
        header: 'CB Unit Cost',
        accessorKey: 'CB_UNIT_COST',
        cell: ({ getValue }) => formatCurrency(getValue() as number | null),
        meta: { group: 'budget' },
        size: 100,
      },

      // Period columns
      {
        header: 'Per Qty',
        accessorKey: 'PER_QTY',
        cell: ({ getValue }) => formatNumber(getValue() as number | null),
        meta: { group: 'period' },
        size: 80,
      },
      {
        header: 'Per % Comp',
        accessorKey: 'PER_PERC_COMP',
        cell: ({ getValue }) => formatPercent(getValue() as number | null),
        meta: { group: 'period' },
        size: 90,
      },
      {
        header: 'Per Spend',
        accessorKey: 'PER_SPEND',
        cell: ({ getValue }) => formatCurrency(getValue() as number | null),
        meta: { group: 'period' },
        size: 100,
      },

      // JTD columns
      {
        header: 'JTD Qty',
        accessorKey: 'JTD_QTY',
        cell: ({ getValue }) => formatNumber(getValue() as number | null),
        meta: { group: 'jtd' },
        size: 80,
      },
      {
        header: 'JTD % Comp',
        accessorKey: 'JTD_PERC_COMP',
        cell: ({ getValue }) => formatPercent(getValue() as number | null),
        meta: { group: 'jtd' },
        size: 90,
      },
      {
        header: 'JTD Spend',
        accessorKey: 'JTD_SPEND',
        cell: ({ getValue }) => formatCurrency(getValue() as number | null),
        meta: { group: 'jtd' },
        size: 100,
      },

      // Forecast columns
      {
        header: 'Fcst Amount',
        accessorKey: 'FORECAST_AMOUNT',
        cell: ({ getValue }) => formatCurrency(getValue() as number | null),
        meta: { group: 'forecast' },
        size: 110,
      },
      {
        header: 'Fcst Remain',
        accessorKey: 'FORECAST_REMAINING_AMOUNT',
        cell: ({ getValue }) => formatCurrency(getValue() as number | null),
        meta: { group: 'forecast' },
        size: 110,
      },
      {
        header: 'Fcst Change',
        accessorKey: 'FORECAST_CHANGE',
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return <span className={getValueClass(val)}>{formatCurrency(val)}</span>;
        },
        meta: { group: 'forecast' },
        size: 100,
      },
      {
        header: 'SL Variance',
        accessorKey: 'SL_VARIANCE',
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return <span className={getValueClass(val)}>{formatCurrency(val)}</span>;
        },
        meta: { group: 'forecast' },
        size: 100,
      },
    ],
    []
  );

  const table = useReactTable({
    data: hierarchicalData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  const handleExpandAll = () => {
    table.toggleAllRowsExpanded(true);
  };

  const handleCollapseAll = () => {
    table.toggleAllRowsExpanded(false);
  };

  const getRowClassName = (row: Row<HierarchicalCostDataRow>): string => {
    const baseClass = '';
    const isAggregated = row.original.isAggregated;
    const hasChildren = row.subRows && row.subRows.length > 0;

    if (isAggregated || hasChildren) {
      return `${baseClass} bg-midnight-700/40`;
    }

    return baseClass;
  };

  if (isLoading) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-midnight-600 border-t-accent rounded-full animate-spin loading-glow" />
        <p className="mt-4 text-slate-400">Loading cost data...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <svg
          className="w-16 h-16 mx-auto text-slate-600 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="text-lg font-medium text-slate-300">No Data Available</h3>
        <p className="text-slate-500 mt-2">
          Enter project numbers and click Search to load cost data.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Table Controls */}
      <div className="p-4 border-b border-midnight-600 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-400">
            <span className="text-accent font-semibold">
              {table.getFilteredRowModel().rows.length.toLocaleString()}
            </span>{' '}
            records
          </div>
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search all columns..."
            className="input-field w-64 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleExpandAll}
              className="btn-secondary text-sm px-3 py-1.5"
              title="Expand all rows"
            >
              <svg
                className="w-4 h-4 mr-1 inline"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              Expand All
            </button>
            <button
              onClick={handleCollapseAll}
              className="btn-secondary text-sm px-3 py-1.5"
              title="Collapse all rows"
            >
              <svg
                className="w-4 h-4 mr-1 inline"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
              Collapse All
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="btn-secondary text-sm"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400 px-3">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="btn-secondary text-sm"
          >
            Next
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer hover:bg-midnight-600 select-none"
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <span className="text-accent">↑</span>,
                        desc: <span className="text-accent">↓</span>,
                      }[header.column.getIsSorted() as string] ?? (
                        <span className="text-slate-600 opacity-0 group-hover:opacity-100">
                          ↕
                        </span>
                      )}
                    </div>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={getRowClassName(row)}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
