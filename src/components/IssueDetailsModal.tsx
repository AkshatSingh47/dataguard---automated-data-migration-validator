import React, { useState } from 'react';
import { ValidationIssue, AiExplainResponse } from '../types';
import { api } from '../services/api';
import { X, Sparkles, AlertCircle, Wrench, Database, HelpCircle, Loader2, Copy, Check } from 'lucide-react';

interface IssueDetailsModalProps {
  issue: ValidationIssue | null;
  onClose: () => void;
}

export const IssueDetailsModal: React.FC<IssueDetailsModalProps> = ({ issue, onClose }) => {
  const [aiData, setAiData] = useState<AiExplainResponse | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!issue) return null;

  const handleRequestAi = async () => {
    setIsLoadingAi(true);
    try {
      const resp = await api.explainIssue(issue);
      setAiData(resp);
    } catch (err) {
      console.error('Failed to get AI explanation', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const copyDiagnosticSql = () => {
    let sql = '';
    if (issue.primary_key && issue.column) {
      sql = `SELECT "${issue.column}" FROM "${issue.table}" WHERE "${issue.column ? 'id' : 'key'}" = '${issue.primary_key}';`;
    } else {
      sql = `SELECT * FROM "${issue.table}" LIMIT 10;`;
    }
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-600 text-white shadow-sm">
              {issue.check_type}
            </span>
            <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-md border border-slate-700 text-slate-300 bg-slate-800">
              {issue.severity} SEVERITY
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-slate-100">
          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block uppercase font-medium text-[10px]">Table</span>
              <span className="font-mono font-semibold text-slate-200">{issue.table}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-medium text-[10px]">Record ID</span>
              <span className="font-mono font-semibold text-slate-200">{issue.primary_key || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-medium text-[10px]">Column</span>
              <span className="font-mono font-semibold text-slate-200">{issue.column || 'N/A'}</span>
            </div>
          </div>

          {/* Value Comparison */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 text-xs divide-x divide-slate-800">
              <div className="p-3.5 bg-slate-950/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Source Value</span>
                <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap break-all">
                  {issue.source_value !== null && issue.source_value !== undefined
                    ? String(issue.source_value)
                    : 'NULL'}
                </pre>
              </div>
              <div className="p-3.5 bg-rose-950/30">
                <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1">Target Value</span>
                <pre className="font-mono text-xs text-rose-300 font-semibold whitespace-pre-wrap break-all">
                  {issue.target_value !== null && issue.target_value !== undefined
                    ? String(issue.target_value)
                    : 'NULL'}
                </pre>
              </div>
            </div>
          </div>

          {/* Direct Validation Message */}
          <div className="text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-100 block mb-1">Deterministic Finding:</span>
            <p className="leading-relaxed text-slate-300">{issue.message}</p>
          </div>

          {/* AI / Diagnostic Section */}
          <div className="border border-slate-800 rounded-xl p-4 space-y-3 bg-slate-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Root Cause & Engineering Analysis
                </h4>
              </div>
              {!aiData && (
                <button
                  type="button"
                  onClick={handleRequestAi}
                  disabled={isLoadingAi}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors inline-flex items-center gap-1.5 shadow-md shadow-indigo-950/30"
                >
                  {isLoadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isLoadingAi ? 'Analyzing...' : 'Generate Analysis'}
                </button>
              )}
            </div>

            {aiData ? (
              <div className="space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 leading-relaxed">
                  <p>{aiData.explanation}</p>
                </div>

                {aiData.possibleCauses && aiData.possibleCauses.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-200 block mb-1 text-[11px] uppercase">
                      Likely Causes:
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-slate-400">
                      {aiData.possibleCauses.map((cause, idx) => (
                        <li key={idx}>{cause}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiData.investigationTips && aiData.investigationTips.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-200 block mb-1 text-[11px] uppercase">
                      Recommended Engineering Actions:
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-slate-400">
                      {aiData.investigationTips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-500">
                  <span>Engine: {aiData.provider.toUpperCase()} Diagnostic Mode</span>
                  <button
                    onClick={copyDiagnosticSql}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-100 font-medium"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied Query' : 'Copy Debug SQL'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Click "Generate Analysis" to review detailed root causes, migration pipeline bug patterns, and resolution steps for this issue.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
