import { useMemo, useState, useRef, useEffect } from 'react';
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
  VisibilityState,
} from '@tanstack/react-table';
import { CostDataRow, HierarchicalCostDataRow } from '../api/types';
import { buildHierarchicalData } from '../utils/hierarchyUtils';

interface DataTableProps {
  data: CostDataRow[];
  isLoading: boolean;
}

// Column groups configuration
const COLUMN_GROUPS = [
  { id: 'identification', label: 'Identification', columns: ['expander', 'FISCAL_YEAR_MONTH_NO', 'PROJECT_NUMBER', 'LEAD_DISTRICT', 'WBS_ELEMENT', 'CBS_HIERARCHY', 'WBS_DESCRIPTION'], className: 'group-identification' },
  { id: 'budget', label: 'Budget', columns: ['CB_QTY', 'CB_AMT', 'CB_UNIT_COST'], className: 'group-budget' },
  { id: 'period', label: 'Period', columns: ['PER_QTY', 'PER_PERC_COMP', 'PER_PF', 'PER_CF', 'PER_SPEND'], className: 'group-period' },
  { id: 'jtd', label: 'JTD', columns: ['JTD_QTY', 'JTD_PERC_COMP', 'JTD_PF', 'JTD_CF', 'JTD_SPEND'], className: 'group-jtd' },
  { id: 'forecast', label: 'Forecast', columns: ['FORECAST_PF', 'FORECAST_CF', 'FORECAST_AMOUNT', 'FORECAST_REMAINING_AMOUNT', 'FORECAST_CHANGE', 'SL_VARIANCE'], className: 'group-forecast' },
];

// Default hidden columns
const DEFAULT_HIDDEN_COLUMNS: Record<string, boolean> = {
  LEAD_DISTRICT: false,
  WBS_ELEMENT: false,
  CB_UNIT_COST: false,
  PER_QTY: false,
  JTD_QTY: false,
  FORECAST_REMAINING_PF: false,
  FORECAST_REMAINING_CF: false,
};

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

// Variance formatting with symbols for accessibility
function formatVariance(value: number | null): { text: string; className: string } {
  if (value === null || value === undefined) {
    return { text: '—', className: 'text-slate-500' };
  }

  const formatted = formatCurrency(Math.abs(value));

  if (value > 0) {
    return { text: `+${formatted.replace('$', '$')}`, className: 'variance-favorable' };
  }
  if (value < 0) {
    return { text: `▼ ${formatted}`, className: 'variance-unfavorable' };
  }
  return { text: formatted, className: 'variance-neutral' };
}

// PF/CF formatting - values > 1.0 are unfavorable (over budget/behind schedule)
function formatFactor(value: number | null): { text: string; className: string } {
  if (value === null || value === undefined) {
    return { text: '—', className: 'text-slate-500' };
  }

  const formatted = value.toFixed(2);

  if (value > 1.0) {
    return { text: formatted, className: 'text-red-400' };
  }
  if (value < 1.0) {
    return { text: formatted, className: 'text-emerald-400' };
  }
  return { text: formatted, className: 'text-slate-300' };
}

export function DataTable({ data, isLoading }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_HIDDEN_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        meta: { group: 'identification' },
      },
      // Identification columns
      {
        header: 'Period',
        accessorKey: 'FISCAL_YEAR_MONTH_NO',
        cell: ({ getValue }) => (
          <span className="text-accent font-semibold">{getValue() as string}</span>
        ),
        size: 80,
        meta: { group: 'identification' },
      },
      {
        header: 'Project',
        accessorKey: 'PROJECT_NUMBER',
        cell: ({ getValue }) => (
          <span className="font-semibold">{getValue() as string}</span>
        ),
        size: 90,
        meta: { group: 'identification' },
      },
      {
        header: 'District',
        accessorKey: 'LEAD_DISTRICT',
        cell: ({ getValue }) => getValue() || '—',
        size: 120,
        meta: { group: 'identification' },
      },
      {
        header: 'WBS Element',
        accessorKey: 'WBS_ELEMENT',
        size: 140,
        meta: { group: 'identification' },
      },
      {
        header: 'CBS Hierarchy',
        accessorKey: 'CBS_HIERARCHY',
        cell: ({ row, getValue }) => {
          const depth = row.original.depth;
          const isAggregated = row.original.isAggregated;
          const hasChildren = row.subRows && row.subRows.length > 0;
          const value = getValue() as string | null;

          return (
            <div
              className="tree-indent"
              style={{ paddingLeft: depth * 40 }}
            >
              <span
                className={`text-xs ${
                  isAggregated || hasChildren ? 'text-amber-400 font-bold' : ''
                }`}
              >
                {value || '—'}
              </span>
            </div>
          );
        },
        size: 200,
        meta: { group: 'identification' },
      },
      {
        header: 'Description',
        accessorKey: 'WBS_DESCRIPTION',
        cell: ({ row, getValue }) => {
          const isAggregated = row.original.isAggregated;
          const hasChildren = row.subRows && row.subRows.length > 0;
          const value = getValue() as string | null;

          return (
            <span
              className={`text-xs truncate max-w-[200px] block ${
                isAggregated || hasChildren ? 'text-amber-400/80 italic font-semibold' : ''
              }`}
              title={value || ''}
            >
              {value || '—'}
            </span>
          );
        },
        size: 200,
        meta: { group: 'identification' },
      },

      // Current Budget columns
      {
        header: 'CB Qty',
        accessorKey: 'CB_QTY',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatNumber(getValue() as number | null)}</span>
        ),
        meta: { group: 'budget', align: 'right' },
        size: 80,
      },
      {
        header: 'CB Amount',
        accessorKey: 'CB_AMT',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatCurrency(getValue() as number | null)}</span>
        ),
        meta: { group: 'budget', align: 'right' },
        size: 100,
      },
      {
        header: 'CB Unit Cost',
        accessorKey: 'CB_UNIT_COST',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatCurrency(getValue() as number | null)}</span>
        ),
        meta: { group: 'budget', align: 'right' },
        size: 100,
      },

      // Period columns
      {
        header: 'Per Qty',
        accessorKey: 'PER_QTY',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatNumber(getValue() as number | null)}</span>
        ),
        meta: { group: 'period', align: 'right' },
        size: 80,
      },
      {
        header: 'Per % Comp',
        accessorKey: 'PER_PERC_COMP',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatPercent(getValue() as number | null)}</span>
        ),
        meta: { group: 'period', align: 'right' },
        size: 90,
      },
      {
        header: 'Per PF',
        accessorKey: 'PER_PF',
        cell: ({ getValue }) => {
          const { text, className } = formatFactor(getValue() as number | null);
          return <span className={`text-right tabular-nums block ${className}`}>{text}</span>;
        },
        meta: { group: 'period', align: 'right' },
        size: 70,
      },
      {
        header: 'Per CF',
        accessorKey: 'PER_CF',
        cell: ({ getValue }) => {
          const { text, className } = formatFactor(getValue() as number | null);
          return <span className={`text-right tabular-nums block ${className}`}>{text}</span>;
        },
        meta: { group: 'period', align: 'right' },
        size: 70,
      },
      {
        header: 'Per Spend',
        accessorKey: 'PER_SPEND',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatCurrency(getValue() as number | null)}</span>
        ),
        meta: { group: 'period', align: 'right' },
        size: 100,
      },

      // JTD columns
      {
        header: 'JTD Qty',
        accessorKey: 'JTD_QTY',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatNumber(getValue() as number | null)}</span>
        ),
        meta: { group: 'jtd', align: 'right' },
        size: 80,
      },
      {
        header: 'JTD % Comp',
        accessorKey: 'JTD_PERC_COMP',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatPercent(getValue() as number | null)}</span>
        ),
        meta: { group: 'jtd', align: 'right' },
        size: 90,
      },
      {
        header: 'JTD PF',
        accessorKey: 'JTD_PF',
        cell: ({ getValue }) => {
          const { text, className } = formatFactor(getValue() as number | null);
          return <span className={`text-right tabular-nums block ${className}`}>{text}</span>;
        },
        meta: { group: 'jtd', align: 'right' },
        size: 70,
      },
      {
        header: 'JTD CF',
        accessorKey: 'JTD_CF',
        cell: ({ getValue }) => {
          const { text, className } = formatFactor(getValue() as number | null);
          return <span className={`text-right tabular-nums block ${className}`}>{text}</span>;
        },
        meta: { group: 'jtd', align: 'right' },
        size: 70,
      },
      {
        header: 'JTD Spend',
        accessorKey: 'JTD_SPEND',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatCurrency(getValue() as number | null)}</span>
        ),
        meta: { group: 'jtd', align: 'right' },
        size: 100,
      },

      // Forecast columns
      {
        header: 'Fcst PF',
        accessorKey: 'FORECAST_PF',
        cell: ({ getValue }) => {
          const { text, className } = formatFactor(getValue() as number | null);
          return <span className={`text-right tabular-nums block ${className}`}>{text}</span>;
        },
        meta: { group: 'forecast', align: 'right' },
        size: 70,
      },
      {
        header: 'Fcst CF',
        accessorKey: 'FORECAST_CF',
        cell: ({ getValue }) => {
          const { text, className } = formatFactor(getValue() as number | null);
          return <span className={`text-right tabular-nums block ${className}`}>{text}</span>;
        },
        meta: { group: 'forecast', align: 'right' },
        size: 70,
      },
      {
        header: 'Fcst Amount',
        accessorKey: 'FORECAST_AMOUNT',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatCurrency(getValue() as number | null)}</span>
        ),
        meta: { group: 'forecast', align: 'right' },
        size: 110,
      },
      {
        header: 'Fcst Remain',
        accessorKey: 'FORECAST_REMAINING_AMOUNT',
        cell: ({ getValue }) => (
          <span className="text-right tabular-nums block">{formatCurrency(getValue() as number | null)}</span>
        ),
        meta: { group: 'forecast', align: 'right' },
        size: 110,
      },
      {
        header: 'Fcst Change',
        accessorKey: 'FORECAST_CHANGE',
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          const { text, className } = formatVariance(val);
          return <span className={`text-right tabular-nums block ${className}`}>{text}</span>;
        },
        meta: { group: 'forecast', align: 'right' },
        size: 100,
      },
      {
        header: 'SL Variance',
        accessorKey: 'SL_VARIANCE',
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          const { text, className } = formatVariance(val);
          return <span className={`text-right tabular-nums block ${className}`}>{text}</span>;
        },
        meta: { group: 'forecast', align: 'right' },
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
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
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
    const isAggregated = row.original.isAggregated;
    const hasChildren = row.subRows && row.subRows.length > 0;
    const depth = row.original.depth;

    let classes = '';

    if (isAggregated || hasChildren) {
      classes += ' hierarchy-parent-row';
      if (depth === 0) {
        classes += ' hierarchy-depth-0';
      } else if (depth === 1) {
        classes += ' hierarchy-depth-1';
      } else {
        classes += ' hierarchy-depth-2';
      }
    }

    return classes;
  };

  // Calculate totals from root-level rows only
  const totals = useMemo(() => {
    const rootRows = hierarchicalData;
    return {
      CB_AMT: rootRows.reduce((sum, row) => sum + (parseFloat(String(row.CB_AMT)) || 0), 0),
      PER_SPEND: rootRows.reduce((sum, row) => sum + (parseFloat(String(row.PER_SPEND)) || 0), 0),
      JTD_SPEND: rootRows.reduce((sum, row) => sum + (parseFloat(String(row.JTD_SPEND)) || 0), 0),
      FORECAST_AMOUNT: rootRows.reduce((sum, row) => sum + (parseFloat(String(row.FORECAST_AMOUNT)) || 0), 0),
      FORECAST_CHANGE: rootRows.reduce((sum, row) => sum + (parseFloat(String(row.FORECAST_CHANGE)) || 0), 0),
      SL_VARIANCE: rootRows.reduce((sum, row) => sum + (parseFloat(String(row.SL_VARIANCE)) || 0), 0),
    };
  }, [hierarchicalData]);

  // Get visible column groups with their spans
  const visibleColumnGroups = useMemo(() => {
    const headerGroup = table.getHeaderGroups()[0];
    if (!headerGroup) return [];

    const visibleHeaders = headerGroup.headers;
    const groups: { id: string; label: string; className: string; span: number }[] = [];

    for (const group of COLUMN_GROUPS) {
      const visibleInGroup = visibleHeaders.filter(h => {
        const meta = h.column.columnDef.meta as { group?: string } | undefined;
        return meta?.group === group.id || group.columns.includes(h.column.id);
      });

      if (visibleInGroup.length > 0) {
        groups.push({
          id: group.id,
          label: group.label,
          className: group.className,
          span: visibleInGroup.length,
        });
      }
    }

    return groups;
  }, [table.getHeaderGroups(), columnVisibility]);

  // Column labels for visibility menu
  const columnLabels: Record<string, string> = {
    FISCAL_YEAR_MONTH_NO: 'Period',
    PROJECT_NUMBER: 'Project',
    LEAD_DISTRICT: 'District',
    WBS_ELEMENT: 'WBS Element',
    CBS_HIERARCHY: 'CBS Hierarchy',
    WBS_DESCRIPTION: 'Description',
    CB_QTY: 'CB Qty',
    CB_AMT: 'CB Amount',
    CB_UNIT_COST: 'CB Unit Cost',
    PER_QTY: 'Period Qty',
    PER_PERC_COMP: 'Period % Complete',
    PER_PF: 'Period PF',
    PER_CF: 'Period CF',
    PER_SPEND: 'Period Spend',
    JTD_QTY: 'JTD Qty',
    JTD_PERC_COMP: 'JTD % Complete',
    JTD_PF: 'JTD PF',
    JTD_CF: 'JTD CF',
    JTD_SPEND: 'JTD Spend',
    FORECAST_PF: 'Forecast PF',
    FORECAST_CF: 'Forecast CF',
    FORECAST_AMOUNT: 'Forecast Amount',
    FORECAST_REMAINING_AMOUNT: 'Forecast Remaining',
    FORECAST_CHANGE: 'Forecast Change',
    SL_VARIANCE: 'SL Variance',
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

          {/* Column Visibility Dropdown */}
          <div className="column-visibility-dropdown" ref={columnMenuRef}>
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="btn-secondary text-sm px-3 py-1.5"
              title="Show/hide columns"
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
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              Columns
            </button>
            {showColumnMenu && (
              <div className="column-visibility-menu">
                <div className="px-4 py-2 border-b border-midnight-600 text-xs font-semibold text-slate-400 uppercase">
                  Toggle Columns
                </div>
                {table.getAllLeafColumns()
                  .filter(col => col.id !== 'expander')
                  .map(column => (
                    <label key={column.id} className="column-visibility-item">
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                      />
                      <span>{columnLabels[column.id] || column.id}</span>
                    </label>
                  ))}
              </div>
            )}
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
            {/* Column Group Header Row */}
            <tr className="column-group-header">
              {visibleColumnGroups.map(group => (
                <th
                  key={group.id}
                  colSpan={group.span}
                  className={group.className}
                >
                  {group.label}
                </th>
              ))}
            </tr>
            {/* Individual Column Headers */}
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
          {/* Totals Footer */}
          <tfoot>
            <tr>
              {/* Span for identification columns */}
              <td colSpan={table.getVisibleLeafColumns().filter(c => {
                const meta = c.columnDef.meta as { group?: string } | undefined;
                return meta?.group === 'identification' || ['expander', 'FISCAL_YEAR_MONTH_NO', 'PROJECT_NUMBER', 'LEAD_DISTRICT', 'WBS_ELEMENT', 'CBS_HIERARCHY', 'WBS_DESCRIPTION'].includes(c.id);
              }).length} className="text-accent uppercase text-sm">
                Total
              </td>
              {/* Budget columns */}
              {columnVisibility.CB_QTY !== false && <td></td>}
              {columnVisibility.CB_AMT !== false && (
                <td className="text-right tabular-nums">{formatCurrency(totals.CB_AMT)}</td>
              )}
              {columnVisibility.CB_UNIT_COST !== false && <td></td>}
              {/* Period columns */}
              {columnVisibility.PER_QTY !== false && <td></td>}
              {columnVisibility.PER_PERC_COMP !== false && <td></td>}
              {columnVisibility.PER_PF !== false && <td></td>}
              {columnVisibility.PER_CF !== false && <td></td>}
              {columnVisibility.PER_SPEND !== false && (
                <td className="text-right tabular-nums">{formatCurrency(totals.PER_SPEND)}</td>
              )}
              {/* JTD columns */}
              {columnVisibility.JTD_QTY !== false && <td></td>}
              {columnVisibility.JTD_PERC_COMP !== false && <td></td>}
              {columnVisibility.JTD_PF !== false && <td></td>}
              {columnVisibility.JTD_CF !== false && <td></td>}
              {columnVisibility.JTD_SPEND !== false && (
                <td className="text-right tabular-nums">{formatCurrency(totals.JTD_SPEND)}</td>
              )}
              {/* Forecast columns */}
              {columnVisibility.FORECAST_PF !== false && <td></td>}
              {columnVisibility.FORECAST_CF !== false && <td></td>}
              {columnVisibility.FORECAST_AMOUNT !== false && (
                <td className="text-right tabular-nums">{formatCurrency(totals.FORECAST_AMOUNT)}</td>
              )}
              {columnVisibility.FORECAST_REMAINING_AMOUNT !== false && <td></td>}
              {columnVisibility.FORECAST_CHANGE !== false && (
                <td className={`text-right tabular-nums ${totals.FORECAST_CHANGE >= 0 ? 'variance-favorable' : 'variance-unfavorable'}`}>
                  {totals.FORECAST_CHANGE >= 0 ? '+' : '▼ '}{formatCurrency(Math.abs(totals.FORECAST_CHANGE))}
                </td>
              )}
              {columnVisibility.SL_VARIANCE !== false && (
                <td className={`text-right tabular-nums ${totals.SL_VARIANCE >= 0 ? 'variance-favorable' : 'variance-unfavorable'}`}>
                  {totals.SL_VARIANCE >= 0 ? '+' : '▼ '}{formatCurrency(Math.abs(totals.SL_VARIANCE))}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
