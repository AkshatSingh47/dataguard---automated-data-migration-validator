import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Database, FileCheck, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24 text-slate-100">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Automated Migration Quality Assurance
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
          Validate Your Database Migration
        </h1>

        <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
          Automatically compare source and target databases and detect migration errors before they reach production.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/validate?demo=true')}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-950/40 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-indigo-200" />
            Try Demo Validation
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(user ? '/validate?custom=true' : '/login', {
                state: { from: '/validate?custom=true' },
              })
            }
            className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium text-sm rounded-xl transition-colors cursor-pointer"
          >
            Custom Data
          </button>

          <button
            type="button"
            onClick={() => navigate('/history')}
            className="w-full sm:w-auto px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 font-medium text-sm rounded-xl transition-colors cursor-pointer"
          >
            History
          </button>
        </div>
      </div>

      {/* Three Core Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {/* Card 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl transition-all hover:border-slate-700">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 mb-4">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-100 mb-1.5">Schema Validation</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Check whether database structures match. Verifies tables, columns, primary keys, and data types across engines.
          </p>
        </div>

        {/* Card 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl transition-all hover:border-slate-700">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 mb-4">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-100 mb-1.5">Data Validation</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Find missing, duplicate and mismatched records. Checks row counts, key uniqueness, NULL discrepancies, and foreign keys.
          </p>
        </div>

        {/* Card 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl transition-all hover:border-slate-700">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 mb-4">
            <FileCheck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-100 mb-1.5">Migration Report</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Get a clear summary of migration health. Review deterministic health scores, granular issue tables, and actionable diagnostics.
          </p>
        </div>
      </div>

      {/* Mode callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-950 border border-indigo-900 text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Demo Mode</h4>
              <p className="text-xs text-slate-400">
                Use sample migration data to understand how DataGuard works.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/validate?demo=true')}
            className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-indigo-950/30"
          >
            Try Demo Validation
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-indigo-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Custom Data</h4>
              <p className="text-xs text-slate-400">
                Sign in to validate your own source and target data as CSV files or databases.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate(user ? '/validate?custom=true' : '/login', {
                state: { from: '/validate?custom=true' },
              })
            }
            className="shrink-0 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold rounded-lg transition-colors"
          >
            {user ? 'Validate My Data' : 'Sign in for Custom Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
