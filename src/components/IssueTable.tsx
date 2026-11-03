import React, { useState, useMemo } from 'react';
import { ValidationIssue, IssueSeverity, CheckType } from '../types';
import { Filter, Search, ChevronRight, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface IssueTableProps {
  issues: ValidationIssue[];
  onSelectIssue: (issue: ValidationIssue) => void;
}

export const IssueTable: React.FC<IssueTableProps> = ({ issues, onSelectIssue }) => {
  const [selectedTable, setSelectedTable] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract unique tables and check types for filters
  const tables = useMemo(() => {
    return Array.from(new Set(issues.map((i) => i.table))).sort();
  }, [issues]);

  const types = useMemo(() => {
    return Array.from(new Set(issues.map((i) => i.check_type))).sort();
  }, [issues]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (selectedTable !== 'ALL' && issue.table !== selectedTable) return false;
      if (selectedType !== 'ALL' && issue.check_type !== selectedType) return false;
      if (selectedSeverity !== 'ALL' && issue.severity !== selectedSeverity) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPk = issue.primary_key?.toLowerCase().includes(q);
        const matchCol = issue.column?.toLowerCase().includes(q);
        const matchMsg = issue.message.toLowerCase().includes(q);
        const matchTable = issue.table.toLowerCase().includes(q);
        if (!matchPk && !matchCol && !matchMsg && !matchTable) return false;
      }

      return true;
    });
  }, [issues, selectedTable, selectedType, selectedSeverity, searchQuery]);

  const getSeverityBadge = (severity: IssueSeverity) => {
    switch (severity) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-900">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-400 border border-amber-900">
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            LOW
          </span>
        );
    }
  };

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-600 italic">NULL</span>;
    const str = String(val);
    if (str.length > 30) return `${str.substring(0, 30)}...`;
    return str;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Detected Discrepancies & Issues</h3>
          <p className="text-xs text-slate-400">
            Showing {filteredIssues.length} of {issues.length} detected migration differences
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search record, column, error..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-slate-700"
          />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Table Filter */}
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-md text-slate-200 text-xs focus:outline-hidden focus:border-slate-700"
        >
          <option value="ALL">All Tables ({tables.length})</option>
          {tables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Issue Type Filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-md text-slate-200 text-xs focus:outline-hidden focus:border-slate-700"
        >
          <option value="ALL">All Types ({types.length})</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* Severity Filter */}
        <select
          value={selectedSeverity}
          onChange={(e) => setSelectedSeverity(e.target.value)}
          className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-md text-slate-200 text-xs focus:outline-hidden focus:border-slate-700"
        >
          <option value="ALL">All Severities</option>
          <option value="HIGH">High Severity</option>
          <option value="MEDIUM">Medium Severity</option>
          <option value="LOW">Low Severity</option>
        </select>

        {(selectedTable !== 'ALL' || selectedType !== 'ALL' || selectedSeverity !== 'ALL' || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setSelectedTable('ALL');
              setSelectedType('ALL');
              setSelectedSeverity('ALL');
              setSearchQuery('');
            }}
            className="text-slate-400 hover:text-slate-200 underline ml-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {issues.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-emerald-900/60 rounded-xl bg-emerald-950/20">
          <p className="text-sm font-semibold text-emerald-400">Validation Passed</p>
          <p className="text-xs text-slate-400 mt-1">
            No discrepancies were detected in the selected validation checks.
          </p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
          No discrepancies matched your current filter criteria.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Table</th>
                <th className="py-2.5 px-3">Check Type</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Record (PK)</th>
                <th className="py-2.5 px-3">Column</th>
                <th className="py-2.5 px-3">Source Value</th>
                <th className="py-2.5 px-3">Target Value</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredIssues.map((issue) => (
                <tr
                  key={issue.id}
                  onClick={() => onSelectIssue(issue)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-100">{issue.table}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-[11px] font-semibold text-slate-300 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded">
                      {issue.check_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">{getSeverityBadge(issue.severity)}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-200">
                    {issue.primary_key || <span className="text-slate-600">-</span>}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-200">
                    {issue.column || <span className="text-slate-600">-</span>}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-400 truncate max-w-[140px]">
                    {formatValue(issue.source_value)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-rose-400 font-medium truncate max-w-[140px]">
                    {formatValue(issue.target_value)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      className="text-slate-500 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
