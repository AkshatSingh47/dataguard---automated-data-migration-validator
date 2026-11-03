import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ValidationRunDetail, ValidationIssue } from '../types';
import { api } from '../services/api';
import { ValidationSummary } from '../components/ValidationSummary';
import { HealthScore } from '../components/HealthScore';
import { IssueTable } from '../components/IssueTable';
import { IssueDetailsModal } from '../components/IssueDetailsModal';
import { GeminiChatbot } from '../components/GeminiChatbot';
import { ArrowLeft, RefreshCw, Download, Loader2, BarChart2, LayoutDashboard, Sparkles, MessageSquare } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ValidationResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [run, setRun] = useState<ValidationRunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<ValidationIssue | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    async function loadRun() {
      if (!id) {
        // Load latest from history if no id
        try {
          const history = await api.getHistory();
          if (history.length > 0) {
            navigate(`/results/${history[0].id}`, { replace: true });
            return;
          } else {
            navigate('/validate');
            return;
          }
        } catch (err) {
          navigate('/validate');
          return;
        }
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getRunDetail(id);
        setRun(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load validation report');
      } finally {
        setIsLoading(false);
      }
    }

    loadRun();
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">Loading validation report...</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-slate-100">Unable to Load Report</h2>
        <p className="text-xs text-slate-400">{error || 'Report not found'}</p>
        <Link
          to="/validate"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Go to Validation Setup
        </Link>
      </div>
    );
  }

  // Prepare chart data for discrepancy distribution across categories
  const chartData = Object.entries(run.categories)
    .filter(([_, data]) => (data as any).issuesCount > 0)
    .map(([catName, data]) => ({
      category: catName,
      issues: (data as any).issuesCount,
    }));

  const exportJsonReport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(run, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `dataguard-report-${run.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-8 text-slate-100">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Back to History"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Validation Results</h1>
            <p className="text-xs text-slate-400">Run ID: <span className="font-mono text-slate-300">{run.id}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {chartData.length > 0 && (
            <button
              type="button"
              onClick={() => setShowChart(!showChart)}
              className="px-3 py-1.5 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
              {showChart ? 'Hide Issue Chart' : 'Show Issue Chart'}
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-3 py-1.5 border border-indigo-900/60 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard View
          </button>

          <button
            type="button"
            onClick={() => setShowChatbot(!showChatbot)}
            className="px-3 py-1.5 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            {showChatbot ? 'Hide Copilot' : 'AI Copilot'}
          </button>

          <button
            type="button"
            onClick={exportJsonReport}
            className="px-3 py-1.5 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Export JSON
          </button>

          <a
            href={api.reportUrl(run.id, 'csv')}
            className="px-3 py-1.5 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Download Report
          </a>

          <button
            type="button"
            onClick={() => navigate('/validate')}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-md shadow-indigo-950/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New Validation
          </button>
        </div>
      </div>

      {/* Main Summary & Health Score Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ValidationSummary run={run} />
        </div>
        <div>
          <HealthScore health={run.healthBreakdown} />
        </div>
      </div>

      {/* Recharts Issue Distribution Chart (only displayed when toggle is on and issues exist) */}
      {showChart && chartData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-semibold text-slate-100 mb-1">Issue Distribution Across Categories</h3>
          <p className="text-xs text-slate-400 mb-4">Count of discrepancies detected per validation check</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderRadius: '10px',
                    border: '1px solid #1e293b',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Bar dataKey="issues" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Issues Table */}
      <IssueTable issues={run.issues} onSelectIssue={(issue) => setSelectedIssue(issue)} />

      {/* Details Modal */}
      <IssueDetailsModal issue={selectedIssue} onClose={() => setSelectedIssue(null)} />

      {/* Floating Gemini Copilot */}
      {showChatbot ? (
        <GeminiChatbot
          currentRun={run}
          isOpen={true}
          isFloating={true}
          onClose={() => setShowChatbot(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowChatbot(true)}
          className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold transition-all hover:scale-105 cursor-pointer shadow-indigo-950/60"
        >
          <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" />
          <span>Ask AI Copilot</span>
        </button>
      )}
    </div>
  );
};
