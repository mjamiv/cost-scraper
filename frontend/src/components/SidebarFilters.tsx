import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { QueryFilters, CostDataRow, WBSTagFilters, Project } from '../api/types';
import { CostDataRowWithTags, getUniqueTagValues } from '../utils/wbsDataMerger';
import { fetchProjects } from '../api/costDataApi';

interface SidebarFiltersProps {
  filters: QueryFilters;
  onFilterChange: (filters: QueryFilters) => void;
  onSearch: () => void;
  isLoading: boolean;
  recordCount?: number;
  filteredCount?: number;
  isDemo?: boolean;
  data?: CostDataRow[] | CostDataRowWithTags[];
  mergedData?: CostDataRowWithTags[];
}

const DEFAULT_PROJECTS = '106073';

// Helper to count active WBS filters (now counts arrays with values)
function countActiveWBSFilters(wbsTags: WBSTagFilters): number {
  return Object.values(wbsTags).filter(v => v && v.length > 0).length;
}

// Count total selected values across all filters
function countTotalSelectedValues(wbsTags: WBSTagFilters): number {
  return Object.values(wbsTags).reduce((sum, v) => sum + (v?.length || 0), 0);
}

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

// Multi-select dropdown component
interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

function MultiSelectDropdown({ label, options, selectedValues, onChange }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const selectAll = () => onChange([...options]);
  const selectNone = () => onChange([]);

  const displayText = selectedValues.length === 0
    ? 'All'
    : selectedValues.length === options.length
      ? 'All selected'
      : `${selectedValues.length} selected`;

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">
        {label}
        <span className="text-neutral-500 font-normal normal-case ml-1">({options.length})</span>
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="sidebar-input text-sm w-full text-left flex items-center justify-between"
      >
        <span className={selectedValues.length > 0 ? 'text-gold' : 'text-neutral-400'}>
          {displayText}
        </span>
        <svg
          className={`w-4 h-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl max-h-48 overflow-auto">
          {/* Select All / None buttons */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-700 bg-neutral-900/50">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-gold hover:underline"
            >
              All
            </button>
            <span className="text-neutral-600">|</span>
            <button
              type="button"
              onClick={selectNone}
              className="text-xs text-neutral-400 hover:text-white hover:underline"
            >
              None
            </button>
          </div>

          {/* Options */}
          <div className="py-1">
            {options.map(option => (
              <label
                key={option}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={() => toggleValue(option)}
                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-gold focus:ring-gold focus:ring-offset-0"
                />
                <span className="text-sm text-neutral-200 truncate">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Project Search Dropdown with autocomplete
interface ProjectSearchDropdownProps {
  projects: Project[];
  selectedProjects: string[];
  onChange: (projects: string[]) => void;
  isLoadingProjects: boolean;
  onKeyPress?: (e: React.KeyboardEvent) => void;
}

function ProjectSearchDropdown({
  projects,
  selectedProjects,
  onChange,
  isLoadingProjects,
  onKeyPress,
}: ProjectSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter projects by search term
  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    const term = searchTerm.toLowerCase();
    return projects.filter(p =>
      p.PROJECT_NUMBER.toLowerCase().includes(term) ||
      (p.PROJECT_DESCRIPTION?.toLowerCase().includes(term) ?? false)
    );
  }, [projects, searchTerm]);

  const toggleProject = (projectNumber: string) => {
    if (selectedProjects.includes(projectNumber)) {
      onChange(selectedProjects.filter(p => p !== projectNumber));
    } else {
      onChange([...selectedProjects, projectNumber]);
    }
  };

  const selectAll = () => onChange(filteredProjects.map(p => p.PROJECT_NUMBER));
  const selectNone = () => onChange([]);

  const handleManualAdd = () => {
    const projects = manualValue.split(',').map(p => p.trim()).filter(Boolean);
    if (projects.length > 0) {
      onChange([...new Set([...selectedProjects, ...projects])]);
      setManualValue('');
      setShowManualInput(false);
    }
  };

  const displayText = selectedProjects.length === 0
    ? 'Select projects...'
    : selectedProjects.length === 1
      ? selectedProjects[0]
      : `${selectedProjects.length} projects selected`;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Selected projects display / trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="sidebar-input text-sm w-full text-left flex items-center justify-between min-h-[40px]"
      >
        <span className={selectedProjects.length > 0 ? 'text-gold' : 'text-neutral-400'}>
          {isLoadingProjects ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading projects...
            </span>
          ) : displayText}
        </span>
        <svg
          className={`w-4 h-4 text-neutral-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Selected project chips */}
      {selectedProjects.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedProjects.map(p => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gold/20 text-gold rounded-full border border-gold/30"
            >
              {p}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProject(p);
                }}
                className="hover:text-white"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl">
          {/* Search input */}
          <div className="p-2 border-b border-neutral-700">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredProjects.length === 1) {
                    toggleProject(filteredProjects[0].PROJECT_NUMBER);
                    setSearchTerm('');
                  }
                }
              }}
              placeholder="Search by number or description..."
              className="w-full px-2 py-1.5 text-sm bg-neutral-700 border border-neutral-600 rounded text-white placeholder-neutral-400 focus:outline-none focus:border-gold"
              autoFocus
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-700 bg-neutral-900/50">
            <div className="flex items-center gap-2">
              <button type="button" onClick={selectAll} className="text-xs text-gold hover:underline">
                All
              </button>
              <span className="text-neutral-600">|</span>
              <button type="button" onClick={selectNone} className="text-xs text-neutral-400 hover:text-white hover:underline">
                None
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs text-neutral-400 hover:text-gold"
            >
              + Manual
            </button>
          </div>

          {/* Manual entry input */}
          {showManualInput && (
            <div className="p-2 border-b border-neutral-700 bg-neutral-900/30">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualAdd();
                    }
                  }}
                  placeholder="Enter project numbers..."
                  className="flex-1 px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-white placeholder-neutral-400 focus:outline-none focus:border-gold font-mono"
                />
                <button
                  type="button"
                  onClick={handleManualAdd}
                  className="px-2 py-1 text-xs bg-gold text-black rounded hover:bg-gold/80"
                >
                  Add
                </button>
              </div>
              <p className="mt-1 text-[10px] text-neutral-500">Comma-separated for multiple</p>
            </div>
          )}

          {/* Project list */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredProjects.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-400 italic">
                {projects.length === 0 ? 'No projects available' : 'No matching projects'}
              </div>
            ) : (
              filteredProjects.map(project => (
                <label
                  key={project.PROJECT_NUMBER}
                  className="flex items-start gap-2 px-3 py-2 hover:bg-neutral-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(project.PROJECT_NUMBER)}
                    onChange={() => toggleProject(project.PROJECT_NUMBER)}
                    className="mt-0.5 w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-gold focus:ring-gold focus:ring-offset-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono text-gold">{project.PROJECT_NUMBER}</div>
                    {project.PROJECT_DESCRIPTION && (
                      <div className="text-xs text-neutral-400 truncate">{project.PROJECT_DESCRIPTION}</div>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>

          {/* Count footer */}
          <div className="px-3 py-1.5 text-[10px] text-neutral-500 border-t border-neutral-700 bg-neutral-900/50">
            {filteredProjects.length} of {projects.length} projects
          </div>
        </div>
      )}
    </div>
  );
}

export function SidebarFilters({ filters, onFilterChange, onSearch, isLoading, recordCount = 0, filteredCount, isDemo = false, data, mergedData }: SidebarFiltersProps) {
  const [wbsFiltersExpanded, setWbsFiltersExpanded] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectsFetched, setProjectsFetched] = useState(false);
  const projectInfo = getProjectInfo(data);
  const activeWBSFilterCount = countActiveWBSFilters(filters.wbsTags || {});
  const totalSelectedValues = countTotalSelectedValues(filters.wbsTags || {});

  // Fetch available projects on mount (once)
  useEffect(() => {
    if (projectsFetched) return;

    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const response = await fetchProjects(undefined, true);
        if (response.success) {
          setAvailableProjects(response.projects);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setIsLoadingProjects(false);
        setProjectsFetched(true);
      }
    };

    loadProjects();
  }, [projectsFetched]);

  // Parse current filter string to array of project numbers
  const selectedProjects = useMemo(() => {
    return filters.projectNumbers
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
  }, [filters.projectNumbers]);

  // Handle project selection changes from dropdown
  const handleProjectSelectionChange = useCallback((projects: string[]) => {
    onFilterChange({ ...filters, projectNumbers: projects.join(', ') });
  }, [filters, onFilterChange]);

  // Get unique tag values for dropdowns
  const tagOptions = {
    wbsElement: mergedData ? getUniqueTagValues(mergedData, 'WBS_ELEMENT') : [],
    area: mergedData ? getUniqueTagValues(mergedData, 'AREA') : [],
    phase: mergedData ? getUniqueTagValues(mergedData, 'PHASE') : [],
    dGroup: mergedData ? getUniqueTagValues(mergedData, 'D_GROUP') : [],
    accountCode: mergedData ? getUniqueTagValues(mergedData, 'ACCOUNT_CODE') : [],
    userDefined7: mergedData ? getUniqueTagValues(mergedData, 'USER_DEFINED_7') : [],
    districtSpecificTag16: mergedData ? getUniqueTagValues(mergedData, 'DISTRICT_SPECIFIC_TAG_16') : [],
    districtSpecificTag19: mergedData ? getUniqueTagValues(mergedData, 'DISTRICT_SPECIFIC_TAG_19') : [],
    userDefined12: mergedData ? getUniqueTagValues(mergedData, 'USER_DEFINED_12') : [],
    tag23: mergedData ? getUniqueTagValues(mergedData, 'TAG23') : [],
    tag25: mergedData ? getUniqueTagValues(mergedData, 'TAG25') : [],
  };

  const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, startMonth: e.target.value });
  };

  const handleWBSTagChange = (key: keyof WBSTagFilters, values: string[]) => {
    onFilterChange({
      ...filters,
      wbsTags: {
        ...filters.wbsTags,
        [key]: values.length > 0 ? values : undefined
      }
    });
  };

  const clearWBSFilters = () => {
    onFilterChange({
      ...filters,
      wbsTags: {}
    });
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
              {filteredCount !== undefined && filteredCount !== recordCount ? (
                <>
                  <span className="text-lg font-bold text-gold font-mono">{filteredCount.toLocaleString()}</span>
                  <span className="text-xs text-neutral-500">of {recordCount.toLocaleString()}</span>
                </>
              ) : (
                <>
                  <span className="text-lg font-bold text-gold font-mono">{recordCount.toLocaleString()}</span>
                  <span className="text-xs text-neutral-500 uppercase">records</span>
                </>
              )}
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

      {/* Project Numbers - Searchable Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-400 mb-2">
          Projects
          <span className="text-slate-500 text-xs ml-1">(active in last 12 months)</span>
        </label>
        <ProjectSearchDropdown
          projects={availableProjects}
          selectedProjects={selectedProjects}
          onChange={handleProjectSelectionChange}
          isLoadingProjects={isLoadingProjects}
          onKeyPress={handleKeyPress}
        />
      </div>

      {/* Start Month */}
      <div className="mb-4">
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

      {/* WBS Tag Filters - Collapsible */}
      <div className="mb-6 border border-neutral-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setWbsFiltersExpanded(!wbsFiltersExpanded)}
          className="w-full px-3 py-2 flex items-center justify-between bg-neutral-800/50 hover:bg-neutral-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="text-sm font-medium text-slate-300">Filters</span>
            {activeWBSFilterCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-bold bg-gold text-black rounded-full">
                {totalSelectedValues}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${wbsFiltersExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {wbsFiltersExpanded && (
          <div className="p-4 space-y-4 bg-neutral-900/50 max-h-[60vh] overflow-y-auto">
            {/* Clear filters button */}
            {activeWBSFilterCount > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={clearWBSFilters}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-400/30 hover:border-red-400/50 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Multi-select dropdowns for each tag filter */}
            {([
              { key: 'wbsElement', label: 'WBS Element', options: tagOptions.wbsElement },
              { key: 'area', label: 'Area', options: tagOptions.area },
              { key: 'phase', label: 'Phase', options: tagOptions.phase },
              { key: 'dGroup', label: 'Discipline', options: tagOptions.dGroup },
              { key: 'accountCode', label: 'Account Code', options: tagOptions.accountCode },
              { key: 'districtSpecificTag16', label: 'District', options: tagOptions.districtSpecificTag16 },
              { key: 'districtSpecificTag19', label: 'District Tag 19', options: tagOptions.districtSpecificTag19 },
              { key: 'userDefined7', label: 'Firm', options: tagOptions.userDefined7 },
              { key: 'userDefined12', label: 'Multiplier', options: tagOptions.userDefined12 },
              { key: 'tag23', label: 'Reimbursement Type', options: tagOptions.tag23 },
              { key: 'tag25', label: 'Cost Category', options: tagOptions.tag25 },
            ] as const).map(({ key, label, options }) => (
              options.length > 0 && (
                <MultiSelectDropdown
                  key={key}
                  label={label}
                  options={options}
                  selectedValues={filters.wbsTags?.[key] || []}
                  onChange={(values) => handleWBSTagChange(key, values)}
                />
              )
            ))}

            {/* Show message if no data loaded */}
            {!mergedData?.length && (
              <p className="text-xs text-neutral-500 italic">
                Load data first to see available filter options
              </p>
            )}
          </div>
        )}
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
