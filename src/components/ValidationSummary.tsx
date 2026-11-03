import React from 'react';
import { ValidationRunDetail, CategorySummary } from '../types';
import { Check, X, AlertTriangle, Minus, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ValidationSummaryProps {
  run: ValidationRunDetail;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ run }) => {
  const getOverallBadge = (status: ValidationRunDetail['overallStatus']) => {
    switch (status) {
      case 'PASSED':
        return {
          icon: CheckCircle2,
          text: 'PASSED',
          color: 'text-emerald-400 bg-emerald-950 border-emerald-900',
        };
      case 'WARNINGS':
        return {
          icon: AlertCircle,
          text: 'WARNINGS',
          color: 'text-amber-400 bg-amber-950 border-amber-900',
        };
      case 'FAILED':
      default:
        return {
          icon: XCircle,
          text: 'FAILED',
          color: 'text-rose-400 bg-rose-950 border-rose-900',
        };
    }
  };

  const overall = getOverallBadge(run.overallStatus);
  const OverallIcon = overall.icon;

  const renderCategoryIcon = (status: CategorySummary['status']) => {
    switch (status) {
      case 'PASS':
        return <Check className="w-4 h-4 text-emerald-400 font-bold" />;
      case 'FAIL':
        return <X className="w-4 h-4 text-rose-400 font-bold" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'SKIPPED':
      default:
        return <Minus className="w-4 h-4 text-slate-600" />;
    }
  };

  const countType = (type: string) => run.issues.filter((i) => i.check_type === type).length;
  const sourceRecords = run.tableStats?.reduce((s, t) => s + t.sourceRows, 0);
  const targetRecords = run.tableStats?.reduce((s, t) => s + t.targetRows, 0);

  const categoriesList = [
    { name: 'Schema', key: 'Schema' },
    { name: 'Row Count', key: 'Row Count' },
    { name: 'Records', key: 'Records' },
    { name: 'Duplicates', key: 'Duplicates' },
    { name: 'NULL Validation', key: 'NULL Validation' },
    { name: 'Relationships', key: 'Relationships' },
    { name: 'Aggregates', key: 'Aggregates' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Migration Validation Report
          </span>
          <h2 className="text-xl font-bold text-slate-100 mt-0.5">
            {run.sourceDbName} <span className="text-slate-500 font-normal">→</span> {run.targetDbName}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Run ID: <span className="font-mono text-slate-300">{run.id}</span> • Completed at{' '}
            {new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl border font-bold text-sm flex items-center gap-2 ${overall.color}`}>
            <OverallIcon className="w-5 h-5" />
            <span>{overall.text}</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Health Score</span>
          <p className="text-2xl font-bold text-slate-100 mt-0.5">{run.healthScore.toFixed(1)}%</p>
          <span className="text-[10px] text-slate-500">{run.healthRating}</span>
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Tables Checked</span>
          <p className="text-2xl font-bold text-slate-100 mt-0.5">{run.tablesChecked}</p>
          <span className="text-[10px] text-slate-500">Discovered schemas</span>
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Records Analyzed</span>
          <p className="text-2xl font-bold text-slate-100 mt-0.5">{run.recordsChecked.toLocaleString()}</p>
          <span className="text-[10px] text-slate-500">Target & Source rows</span>
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Discrepancies</span>
          <p className="text-2xl font-bold text-rose-400 mt-0.5">{run.failedChecksCount + run.warningChecksCount}</p>
          <span className="text-[10px] text-slate-500">
            {run.failedChecksCount} fails • {run.warningChecksCount} warnings
          </span>
        </div>
      </div>

      {/* Issue type counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
        {[
          ['Source rows', sourceRecords ?? run.recordsChecked],
          ['Target rows', targetRecords ?? run.recordsChecked],
          ['Missing', countType('MISSING_TARGET')],
          ['Extra', countType('EXTRA_TARGET')],
          ['Duplicates', countType('DUPLICATE_TARGET')],
          ['Value mismatches', countType('VALUE_MISMATCH')],
          ['NULL mismatches', countType('NULL_MISMATCH')],
        ].map(([label, value]) => (
          <div key={String(label)} className="p-2.5 rounded-xl border border-slate-800 bg-slate-950">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">{label}</span>
            <p className="text-sm font-bold text-slate-100 mt-0.5">{Number(value).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 py-3 px-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-400 font-medium">PASSED:</span>
          <span className="font-bold text-slate-100">{run.passedChecksCount}</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-slate-400 font-medium">WARNINGS:</span>
          <span className="font-bold text-slate-100">{run.warningChecksCount}</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span className="text-slate-400 font-medium">FAILED:</span>
          <span className="font-bold text-slate-100">{run.failedChecksCount}</span>
        </div>
      </div>

      {/* Validation Categories Breakdown */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Validation Checks Breakdown
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {categoriesList.map((cat) => {
            const summary = run.categories[cat.key] || {
              name: cat.name,
              status: 'SKIPPED',
              issuesCount: 0,
            };
            return (
              <div
                key={cat.key}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300 truncate">{cat.name}</span>
                  {renderCategoryIcon(summary.status)}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="capitalize">{summary.status.toLowerCase()}</span>
                  {summary.issuesCount > 0 && (
                    <span className="font-mono text-rose-400 font-semibold">{summary.issuesCount}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
