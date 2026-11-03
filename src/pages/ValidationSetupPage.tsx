import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DatabaseConnectionConfig, ValidationCheckSelection, DiscoveredTable } from '../types';
import { DatabaseForm } from '../components/DatabaseForm';
import { ValidationSelector } from '../components/ValidationSelector';
import { SchemaDiscoveryTable } from '../components/SchemaDiscoveryTable';
import { CustomDataWizard } from '../components/CustomDataWizard';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Play, Sparkles, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';

type AppMode = 'choose' | 'demo' | 'custom';

export const ValidationSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<AppMode>('choose');

  const [sourceConfig, setSourceConfig] = useState<DatabaseConnectionConfig>({
    type: 'demo',
    host: 'localhost',
    port: 5432,
    database: 'source_demo',
    username: 'postgres',
    password: '',
  });
  const [isTestingSource, setIsTestingSource] = useState(false);
  const [sourceStatus, setSourceStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sourceMessage, setSourceMessage] = useState<string>('');

  const [targetConfig, setTargetConfig] = useState<DatabaseConnectionConfig>({
    type: 'demo',
    host: 'localhost',
    port: 5432,
    database: 'target_demo',
    username: 'postgres',
    password: '',
  });
  const [isTestingTarget, setIsTestingTarget] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [targetMessage, setTargetMessage] = useState<string>('');

  const [options, setOptions] = useState<ValidationCheckSelection>({
    schemaValidation: true,
    rowCountValidation: true,
    recordValidation: true,
    duplicateDetection: true,
    nullValidation: true,
    referentialIntegrity: true,
    aggregateValidation: true,
  });

  const [discoveredTables, setDiscoveredTables] = useState<DiscoveredTable[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const startCustomData = () => {
    if (!user) {
      navigate('/login', { state: { from: '/validate?custom=true' } });
      return;
    }
    setMode('custom');
  };

  useEffect(() => {
    if (searchParams.get('demo') === 'true') {
      setMode('demo');
      loadDemoPreset();
      return;
    }
    if (searchParams.get('custom') === 'true') {
      if (authLoading) return;
      if (!user) {
        navigate('/login', { replace: true, state: { from: '/validate?custom=true' } });
        return;
      }
      setMode('custom');
    }
  }, [searchParams, user, authLoading, navigate]);

  const loadDemoPreset = () => {
    setSourceConfig({
      type: 'demo',
      host: 'localhost',
      database: 'source_demo',
      username: 'banking_admin',
      password: '',
    });
    setTargetConfig({
      type: 'demo',
      host: 'localhost',
      database: 'target_demo',
      username: 'banking_admin',
      password: '',
    });
    setSourceStatus('success');
    setSourceMessage('Connected to source banking database (Customers, Accounts, Transactions).');
    setTargetStatus('success');
    setTargetMessage('Connected to target migrated database (includes intentional test flaws).');

    fetchDiscovery(
      { type: 'demo', database: 'source_demo' },
      { type: 'demo', database: 'target_demo' }
    );
  };

  const handleTestSource = async () => {
    setIsTestingSource(true);
    setSourceStatus('idle');
    setSourceMessage('');
    try {
      const res = await api.testConnection(sourceConfig);
      setSourceStatus(res.success ? 'success' : 'error');
      setSourceMessage(res.message);
      if (res.success && targetStatus === 'success') {
        fetchDiscovery(sourceConfig, targetConfig);
      }
    } catch (err: any) {
      setSourceStatus('error');
      setSourceMessage(err.message || 'Unable to connect to source database.');
    } finally {
      setIsTestingSource(false);
    }
  };

  const handleTestTarget = async () => {
    setIsTestingTarget(true);
    setTargetStatus('idle');
    setTargetMessage('');
    try {
      const res = await api.testConnection(targetConfig);
      setTargetStatus(res.success ? 'success' : 'error');
      setTargetMessage(res.message);
      if (res.success && sourceStatus === 'success') {
        fetchDiscovery(sourceConfig, targetConfig);
      }
    } catch (err: any) {
      setTargetStatus('error');
      setTargetMessage(err.message || 'Unable to connect to target database.');
    } finally {
      setIsTestingTarget(false);
    }
  };

  const fetchDiscovery = async (sCfg: DatabaseConnectionConfig, tCfg: DatabaseConnectionConfig) => {
    setIsDiscovering(true);
    try {
      const disc = await api.discoverTables(sCfg, tCfg);
      if (disc.success) {
        setDiscoveredTables(disc.discoveredTables);
      }
    } catch (err) {
      console.warn('Discovery notice:', err);
    } finally {
      setIsDiscovering(false);
    }
  };

  const executeValidation = async () => {
    setShowConfirmModal(false);
    setIsValidating(true);
    setExecutionError(null);

    try {
      const detail = await api.startValidation(sourceConfig, targetConfig, options);
      navigate(`/results/${detail.id}`);
    } catch (err: any) {
      setExecutionError(err.message || 'Validation failed during execution.');
      setIsValidating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-8 text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Configure Migration Validation</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            DataGuard does not perform the migration. It validates the result of a migration.
          </p>
        </div>
      </div>

      {mode !== 'choose' && (
        <button
          type="button"
          onClick={() => {
            setMode('choose');
            setExecutionError(null);
          }}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          ← Choose validation mode
        </button>
      )}

      {mode === 'choose' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-100">How do you want to validate?</h2>
            <p className="text-xs text-slate-400 mt-1">Choose sample data or provide your own source and target.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setMode('demo');
                loadDemoPreset();
              }}
              className="text-left bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl transition-colors"
            >
              <Sparkles className="w-5 h-5 text-indigo-400 mb-3" />
              <h3 className="text-base font-semibold text-slate-100">Demo Mode</h3>
              <p className="text-xs text-slate-400 mt-1.5">
                No sign-in needed. Uses the embedded banking dataset with known migration errors.
              </p>
            </button>
            <button
              type="button"
              onClick={startCustomData}
              className="text-left bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl transition-colors"
            >
              <FileSpreadsheet className="w-5 h-5 text-indigo-400 mb-3" />
              <h3 className="text-base font-semibold text-slate-100">Custom Data</h3>
              <p className="text-xs text-slate-400 mt-1.5">
                Sign in to upload CSV files or connect PostgreSQL / MySQL databases.
              </p>
            </button>
          </div>
        </div>
      )}

      {mode === 'custom' && (
        <ProtectedRoute>
          <CustomDataWizard />
        </ProtectedRoute>
      )}

      {mode === 'demo' && (
        <>
          {executionError && (
            <div className="p-4 bg-rose-950/80 border border-rose-900 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <span className="font-semibold block text-rose-200">Validation Aborted</span>
                <span>{executionError}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={loadDemoPreset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 text-indigo-400 text-xs font-semibold rounded-xl hover:bg-slate-800 hover:border-slate-700 transition-colors shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Demo Banking DB
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DatabaseForm
              label="SECTION A — SOURCE DATABASE"
              badgeText="Original / Golden Data Source"
              config={sourceConfig}
              onChange={setSourceConfig}
              onTest={handleTestSource}
              isTesting={isTestingSource}
              testStatus={sourceStatus}
              testMessage={sourceMessage}
              onLoadDemoPreset={loadDemoPreset}
            />
            <DatabaseForm
              label="SECTION B — TARGET DATABASE"
              badgeText="Migrated / Destination Database"
              config={targetConfig}
              onChange={setTargetConfig}
              onTest={handleTestTarget}
              isTesting={isTestingTarget}
              testStatus={targetStatus}
              testMessage={targetMessage}
              onLoadDemoPreset={loadDemoPreset}
            />
          </div>

          <SchemaDiscoveryTable tables={discoveredTables} isLoading={isDiscovering} />
          <ValidationSelector options={options} onChange={setOptions} />

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Ready to execute comparative validation?</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Both databases will be safely read to compare schemas, counts, records, constraints, and aggregates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setExecutionError(null);
                setShowConfirmModal(true);
              }}
              disabled={isValidating}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-950/40 transition-all flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Databases...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Run Validation</span>
                </>
              )}
            </button>
          </div>

          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-base">
                  <AlertCircle className="w-5 h-5 text-indigo-400" />
                  <span>Confirm Validation Execution</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Validation will execute read-only queries against both configured databases to verify data parity. Continue?
                </p>
                <div className="p-3 bg-slate-950 rounded-lg text-xs text-slate-400 font-mono space-y-1 border border-slate-800">
                  <div>Source: {sourceConfig.database} ({sourceConfig.type})</div>
                  <div>Target: {targetConfig.database} ({targetConfig.type})</div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeValidation}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-md shadow-indigo-950/30"
                  >
                    Yes, Start Validation
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
