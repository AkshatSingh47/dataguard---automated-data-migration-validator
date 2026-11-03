import React from 'react';
import { ValidationRunSummary } from '../types';
import { ShieldCheck, AlertTriangle, XCircle, ArrowRight, Calendar, Database } from 'lucide-react';

interface HistoryTableProps {
  runs: ValidationRunSummary[];
  onSelectRun: (id: string) => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ runs, onSelectRun }) => {
  if (!runs || runs.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        <Database className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-200">No validation runs recorded yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Perform a validation run to track migration health history.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: ValidationRunSummary['overallStatus']) => {
    switch (status) {
      case 'PASSED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900">
            <ShieldCheck className="w-3.5 h-3.5" /> PASSED
          </span>
        );
      case 'WARNINGS':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-amber-950 text-amber-400 border border-amber-900">
            <AlertTriangle className="w-3.5 h-3.5" /> WARNINGS
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-rose-950 text-rose-400 border border-rose-900">
            <XCircle className="w-3.5 h-3.5" /> FAILED
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Run Identifier</th>
              <th className="py-3 px-4">Execution Date & Time</th>
              <th className="py-3 px-4">Source → Target</th>
              <th className="py-3 px-4 text-center">Health Score</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Discrepancies</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {runs.map((run, idx) => {
              const runNumber = runs.length - idx;
              const date = new Date(run.timestamp);
              const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

              return (
                <tr
                  key={run.id}
                  onClick={() => onSelectRun(run.id)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">Run #{runNumber}</span>
                      {run.isDemo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 font-mono border border-indigo-900">
                          Demo
                        </span>
                      )}
                      {run.dataSourceKind === 'csv' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                          CSV
                        </span>
                      )}
                      {run.dataSourceKind === 'database' && !run.isDemo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                          Database
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 block mt-0.5">{run.id}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formattedDate}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-200">
                    {run.sourceDbName} <span className="text-slate-500">→</span> {run.targetDbName}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`text-sm font-bold ${
                        run.healthScore >= 90
                          ? 'text-emerald-400'
                          : run.healthScore >= 75
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {run.healthScore.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(run.overallStatus)}</td>
                  <td className="py-3 px-4 text-center font-mono">
                    <span className="text-rose-400 font-semibold">{run.failedChecksCount}</span>
                    <span className="text-slate-600 mx-1">/</span>
                    <span className="text-amber-400">{run.warningChecksCount}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRun(run.id);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700"
                    >
                      View Report
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
