import React, { useState } from 'react';
import { DatabaseConnectionConfig } from '../types';
import { Database, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';

interface DatabaseFormProps {
  label: string;
  badgeText: string;
  config: DatabaseConnectionConfig;
  onChange: (config: DatabaseConnectionConfig) => void;
  onTest: () => Promise<void>;
  isTesting: boolean;
  testStatus: 'idle' | 'success' | 'error';
  testMessage?: string;
  onLoadDemoPreset?: () => void;
  hideDemoOption?: boolean;
}

export const DatabaseForm: React.FC<DatabaseFormProps> = ({
  label,
  badgeText,
  config,
  onChange,
  onTest,
  isTesting,
  testStatus,
  testMessage,
  onLoadDemoPreset,
  hideDemoOption,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const handleTypeChange = (type: DatabaseConnectionConfig['type']) => {
    let port = config.port;
    if (type === 'postgresql') port = 5432;
    if (type === 'mysql') port = 3306;

    onChange({
      ...config,
      type,
      port,
      host: type === 'demo' ? 'localhost' : config.host || 'localhost',
      database:
        type === 'demo'
          ? label.toLowerCase().includes('source')
            ? 'source_demo'
            : 'target_demo'
          : config.database || (type === 'postgresql' ? 'postgres' : 'test_db'),
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-indigo-400 flex items-center justify-center font-medium">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">{label}</h3>
            <span className="text-xs text-slate-400">{badgeText}</span>
          </div>
        </div>

        {onLoadDemoPreset && (
          <button
            type="button"
            onClick={onLoadDemoPreset}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-400 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 transition-colors"
            title="Load in-memory banking dataset"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Load Demo Data
          </button>
        )}
      </div>

      <div className="space-y-4 text-sm">
        {/* Database Type */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Database Type</label>
          <select
            value={config.type}
            onChange={(e) => handleTypeChange(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-hidden focus:border-slate-700"
          >
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            {!hideDemoOption && <option value="demo">Demo Database (In-Memory Banking)</option>}
          </select>
        </div>

        {config.type === 'demo' ? (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400 leading-relaxed">
            <p className="font-semibold text-slate-200 mb-1">In-Memory Demo Mode Active</p>
            {label.toLowerCase().includes('source') ? (
              <p>Contains authentic source schema: Customers (4 rows), Accounts (3 rows), Transactions (3 rows) with correct balances and relationship keys.</p>
            ) : (
              <p>Contains migrated target database with intentional anomalies: missing record (103), duplicate record (102), NULL email, corrupted balance, orphan FK, and aggregate delta.</p>
            )}
          </div>
        ) : (
          <>
            {/* Host & Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Host</label>
                <input
                  type="text"
                  placeholder="localhost or db.example.com"
                  value={config.host || ''}
                  onChange={(e) => onChange({ ...config, host: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Port</label>
                <input
                  type="number"
                  placeholder={config.type === 'postgresql' ? '5432' : '3306'}
                  value={config.port || ''}
                  onChange={(e) => onChange({ ...config, port: parseInt(e.target.value) || undefined })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-slate-700"
                />
              </div>
            </div>

            {/* Database Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Database Name</label>
              <input
                type="text"
                placeholder="production_db"
                value={config.database}
                onChange={(e) => onChange({ ...config, database: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-slate-700"
              />
            </div>

            {/* Username & Password */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  placeholder="postgres / root"
                  value={config.username || ''}
                  onChange={(e) => onChange({ ...config, username: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={config.password || ''}
                    onChange={(e) => onChange({ ...config, password: e.target.value })}
                    className="w-full pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Test Connection Button & Status */}
        <div className="pt-2">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onTest}
              disabled={isTesting || !config.database}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-2"
            >
              {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
              {isTesting ? 'Connecting...' : `Test ${label.split(' ')[0]} Connection`}
            </button>

            {testStatus === 'success' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Connection successful
              </span>
            )}

            {testStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-950/80 px-2.5 py-1 rounded-md border border-rose-900">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Connection failed
              </span>
            )}
          </div>

          {testMessage && (
            <p className={`mt-2 text-xs ${testStatus === 'error' ? 'text-rose-400' : 'text-slate-400'}`}>
              {testMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
