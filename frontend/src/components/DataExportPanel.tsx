import { useState, useMemo } from 'react';
import { CostDataRow } from '../api/types';
import { generateExport, ExportFormat } from '../utils/llmDataFormatter';

interface DataExportPanelProps {
  data: CostDataRow[];
}

export function DataExportPanel({ data }: DataExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportContent = useMemo(() => {
    return generateExport(data, format);
  }, [data, format]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const extensions: Record<ExportFormat, string> = {
      json: 'json',
      markdown: 'md',
      csv: 'csv',
    };
    const mimeTypes: Record<ExportFormat, string> = {
      json: 'application/json',
      markdown: 'text/markdown',
      csv: 'text/csv',
    };

    const blob = new Blob([exportContent], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-report-${new Date().toISOString().split('T')[0]}.${extensions[format]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!data.length) return null;

  return (
    <div className="export-panel mb-6">
      {/* Header */}
      <div className="export-panel-header">
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          <span className="text-slate-200 font-medium">Data Export</span>
          <span className="text-xs text-slate-500">for LLM / Analysis</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Format Tabs */}
          <div className="export-format-tabs">
            <button
              className={`export-format-tab ${format === 'json' ? 'active' : ''}`}
              onClick={() => setFormat('json')}
            >
              JSON
            </button>
            <button
              className={`export-format-tab ${format === 'markdown' ? 'active' : ''}`}
              onClick={() => setFormat('markdown')}
            >
              Markdown
            </button>
            <button
              className={`export-format-tab ${format === 'csv' ? 'active' : ''}`}
              onClick={() => setFormat('csv')}
            >
              CSV
            </button>
          </div>

          {/* Actions */}
          <div className="export-actions">
            <button
              onClick={handleCopy}
              className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="btn-secondary text-sm px-3 py-1.5"
            >
              {isExpanded ? 'Hide' : 'Preview'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      {isExpanded && (
        <div className="p-4 border-t border-midnight-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              {format === 'json' && 'Structured JSON (LLM-Ready)'}
              {format === 'markdown' && 'Markdown Summary'}
              {format === 'csv' && 'CSV Data'}
            </span>
            <span className="text-xs text-slate-500">
              {(exportContent.length / 1024).toFixed(1)} KB
            </span>
          </div>
          <pre className="export-preview whitespace-pre-wrap break-words">
            {exportContent.length > 10000
              ? exportContent.substring(0, 10000) + '\n\n... [truncated for preview]'
              : exportContent}
          </pre>
        </div>
      )}

      {/* Format Descriptions (collapsed) */}
      {!isExpanded && (
        <div className="px-4 py-2 border-t border-midnight-700 bg-midnight-900/30">
          <p className="text-xs text-slate-500">
            {format === 'json' && 'Structured data with metadata, summaries by project/period, and top variance items. Ideal for LLM context.'}
            {format === 'markdown' && 'Human-readable summary with tables. Good for reports and documentation.'}
            {format === 'csv' && 'Raw data export for spreadsheet analysis.'}
          </p>
        </div>
      )}
    </div>
  );
}
