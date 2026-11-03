import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ValidationRunSummary } from '../types';
import { api } from '../services/api';
import { HistoryTable } from '../components/HistoryTable';
import { History, Play, Loader2, RefreshCw } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<ValidationRunSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getHistory();
      setRuns(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve validation history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-8 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Validation History</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Audit logs of past migration runs. Track iterative fixes and health improvements over time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadHistory}
            className="p-2 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-colors shadow-sm"
            title="Refresh History"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/validate')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-md shadow-indigo-950/30"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            New Validation
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">Loading history logs...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-950/80 border border-rose-900 rounded-2xl text-center text-xs text-rose-300">
          {error}
        </div>
      ) : (
        <HistoryTable runs={runs} onSelectRun={(id) => navigate(`/results/${id}`)} />
      )}
    </div>
  );
};
