import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DatabaseConnectionConfig,
  ValidationCheckSelection,
  DiscoveredTable,
  CsvPreview,
  ColumnMapping,
} from '../types';
import { api } from '../services/api';
import { DatabaseForm } from './DatabaseForm';
import { ValidationSelector } from './ValidationSelector';
import { SchemaDiscoveryTable } from './SchemaDiscoveryTable';
import { CsvUploadPanel } from './CsvUploadPanel';
import { ColumnMappingTable } from './ColumnMappingTable';
import { CustomDataStepper } from './CustomDataStepper';
import { FileSpreadsheet, Database, Play, Loader2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

type Provision = 'csv' | 'database' | null;

const DEFAULT_OPTIONS: ValidationCheckSelection = {
  schemaValidation: true,
  rowCountValidation: true,
  recordValidation: true,
  duplicateDetection: true,
  nullValidation: true,
  referentialIntegrity: true,
  aggregateValidation: true,
};

const CSV_OPTIONS: ValidationCheckSelection = {
  ...DEFAULT_OPTIONS,
  referentialIntegrity: false,
};

export const CustomDataWizard: React.FC = () => {
  const navigate = useNavigate();
  const [provision, setProvision] = useState<Provision>(null);
  const [step, setStep] = useState(1);

  // CSV
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sourcePreview, setSourcePreview] = useState<CsvPreview | undefined>();
  const [targetPreview, setTargetPreview] = useState<CsvPreview | undefined>();
  const [primaryKey, setPrimaryKey] = useState('');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [numericColumns, setNumericColumns] = useState<string[]>([]);
  const [selectedAggregates, setSelectedAggregates] = useState<string[]>([]);

  // Database
  const [sourceConfig, setSourceConfig] = useState<DatabaseConnectionConfig>({
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
  });
  const [targetConfig, setTargetConfig] = useState<DatabaseConnectionConfig>({
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
  });
  const [isTestingSource, setIsTestingSource] = useState(false);
  const [isTestingTarget, setIsTestingTarget] = useState(false);
  const [sourceStatus, setSourceStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [targetStatus, setTargetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sourceMessage, setSourceMessage] = useState('');
  const [targetMessage, setTargetMessage] = useState('');
  const [discoveredTables, setDiscoveredTables] = useState<DiscoveredTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const [options, setOptions] = useState<ValidationCheckSelection>(CSV_OPTIONS);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (provision !== 'csv') return;
    let cancelled = false;
    api.createCustomSession()
      .then((res) => {
        if (!cancelled) setSessionId(res.sessionId);
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [provision]);

  const handleCsvUploaded = async (side: 'source' | 'target', preview: CsvPreview) => {
    if (side === 'source') setSourcePreview(preview);
    else setTargetPreview(preview);
    setError(null);
  };

  const loadMapping = async () => {
    if (!sessionId || !sourcePreview || !targetPreview) return;
    setError(null);
    try {
      const suggested = await api.suggestMapping(sessionId);
      setMappings(suggested.mappings);
      setPrimaryKey(suggested.suggestedPrimaryKey);
      setNumericColumns(suggested.numericColumns);
      setSelectedAggregates(suggested.numericColumns.filter((c) => c !== suggested.suggestedPrimaryKey && !c.toLowerCase().endsWith('_id')));
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const continueFromMapping = async () => {
    if (!sessionId) return;
    try {
      const result = await api.validateMapping(sessionId, mappings, primaryKey);
      if (!result.valid) {
        setMappingErrors(result.errors);
        return;
      }
      setMappingErrors([]);
      setStep(3);
    } catch (err: any) {
      setMappingErrors([err.message]);
    }
  };

  const fetchDiscovery = async (sCfg: DatabaseConnectionConfig, tCfg: DatabaseConnectionConfig) => {
    setIsDiscovering(true);
    try {
      const disc = await api.discoverTables(sCfg, tCfg);
      if (disc.success) {
        setDiscoveredTables(disc.discoveredTables);
        setSelectedTables(disc.discoveredTables.filter((t) => t.inSource && t.inTarget).map((t) => t.name));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleTestSource = async () => {
    setIsTestingSource(true);
    setSourceStatus('idle');
    try {
      const res = await api.testConnection(sourceConfig);
      setSourceStatus(res.success ? 'success' : 'error');
      setSourceMessage(res.message);
      if (res.success && targetStatus === 'success') fetchDiscovery(sourceConfig, targetConfig);
    } catch (err: any) {
      setSourceStatus('error');
      setSourceMessage(err.message);
    } finally {
      setIsTestingSource(false);
    }
  };

  const handleTestTarget = async () => {
    setIsTestingTarget(true);
    setTargetStatus('idle');
    try {
      const res = await api.testConnection(targetConfig);
      setTargetStatus(res.success ? 'success' : 'error');
      setTargetMessage(res.message);
      if (res.success && sourceStatus === 'success') fetchDiscovery(sourceConfig, targetConfig);
    } catch (err: any) {
      setTargetStatus('error');
      setTargetMessage(err.message);
    } finally {
      setIsTestingTarget(false);
    }
  };

  const runCsv = async () => {
    if (!sessionId) return;
    setIsValidating(true);
    setError(null);
    try {
      const result = await api.startCsvValidation(sessionId, mappings, primaryKey, options, selectedAggregates);
      navigate(`/results/${result.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsValidating(false);
    }
  };

  const runDatabase = async () => {
    setIsValidating(true);
    setError(null);
    try {
      const result = await api.startValidation(sourceConfig, targetConfig, options, selectedTables);
      navigate(`/results/${result.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsValidating(false);
    }
  };

  if (!provision) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-100">How do you want to provide your data?</h2>
          <p className="text-xs text-slate-400 mt-1">
            DataGuard does not perform the migration. It validates the result of a migration.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setProvision('csv');
              setOptions(CSV_OPTIONS);
              setStep(1);
            }}
            className="text-left bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 shadow-xl transition-colors"
          >
            <FileSpreadsheet className="w-5 h-5 text-indigo-400 mb-3" />
            <h3 className="text-sm font-semibold text-slate-100">Upload CSV Files</h3>
            <p className="text-xs text-slate-400 mt-1">No database required. Upload source and target CSV files.</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setProvision('database');
              setOptions(DEFAULT_OPTIONS);
              setStep(1);
            }}
            className="text-left bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 shadow-xl transition-colors"
          >
            <Database className="w-5 h-5 text-indigo-400 mb-3" />
            <h3 className="text-sm font-semibold text-slate-100">Connect Databases</h3>
            <p className="text-xs text-slate-400 mt-1">PostgreSQL or MySQL. Test connections, then discover tables.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <CustomDataStepper step={step} />
        <button
          type="button"
          onClick={() => {
            setProvision(null);
            setStep(1);
            setError(null);
          }}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          Change data source
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-900 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {provision === 'csv' && step === 1 && (
        <div className="space-y-4">
          <CsvUploadPanel
            sessionId={sessionId}
            sourcePreview={sourcePreview}
            targetPreview={targetPreview}
            onUploaded={handleCsvUploaded}
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!sourcePreview || !targetPreview}
              onClick={loadMapping}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2"
            >
              Continue to Validation
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {provision === 'csv' && step === 2 && sourcePreview && targetPreview && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">Select the column that uniquely identifies each record.</h3>
            <select
              value={primaryKey}
              onChange={(e) => setPrimaryKey(e.target.value)}
              className="w-full sm:w-80 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono"
            >
              {sourcePreview.headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                  {sourcePreview.suggestedPrimaryKey === h ? ' (suggested)' : ''}
                </option>
              ))}
            </select>
          </div>

          <ColumnMappingTable
            sourceHeaders={sourcePreview.headers}
            targetHeaders={targetPreview.headers}
            mappings={mappings}
            onChange={setMappings}
            errors={mappingErrors}
          />

          {numericColumns.filter((c) => c !== primaryKey).length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">Numeric columns for aggregate comparison</h3>
              <div className="flex flex-wrap gap-2">
                {numericColumns
                  .filter((c) => c !== primaryKey)
                  .map((col) => {
                    const checked = selectedAggregates.includes(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() =>
                          setSelectedAggregates((prev) =>
                            checked ? prev.filter((c) => c !== col) : [...prev, col]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${
                          checked
                            ? 'bg-indigo-950 border-indigo-700 text-indigo-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {col}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="text-xs text-slate-400 inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={continueFromMapping}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {provision === 'csv' && step === 3 && (
        <div className="space-y-4">
          <ValidationSelector options={options} onChange={setOptions} />
          <div className="flex justify-between items-center">
            <button type="button" onClick={() => setStep(2)} className="text-xs text-slate-400 inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={runCsv}
              disabled={isValidating}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2"
            >
              {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              {isValidating ? 'Analyzing…' : 'Run Validation'}
            </button>
          </div>
        </div>
      )}

      {provision === 'database' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DatabaseForm
              label="SOURCE DATABASE"
              badgeText="Original / Golden Data Source"
              config={sourceConfig}
              onChange={setSourceConfig}
              onTest={handleTestSource}
              isTesting={isTestingSource}
              testStatus={sourceStatus}
              testMessage={sourceMessage}
              hideDemoOption
            />
            <DatabaseForm
              label="TARGET DATABASE"
              badgeText="Migrated / Destination Database"
              config={targetConfig}
              onChange={setTargetConfig}
              onTest={handleTestTarget}
              isTesting={isTestingTarget}
              testStatus={targetStatus}
              testMessage={targetMessage}
              hideDemoOption
            />
          </div>

          <SchemaDiscoveryTable tables={discoveredTables} isLoading={isDiscovering} />

          {discoveredTables.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">Select tables to validate</h3>
              <div className="flex flex-wrap gap-2">
                {discoveredTables.map((table) => {
                  const checked = selectedTables.includes(table.name);
                  return (
                    <button
                      key={table.name}
                      type="button"
                      onClick={() =>
                        setSelectedTables((prev) =>
                          checked ? prev.filter((n) => n !== table.name) : [...prev, table.name]
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${
                        checked
                          ? 'bg-indigo-950 border-indigo-700 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {table.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <ValidationSelector options={options} onChange={setOptions} />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={runDatabase}
              disabled={isValidating || sourceStatus !== 'success' || targetStatus !== 'success'}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2"
            >
              {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              {isValidating ? 'Analyzing Databases…' : 'Run Validation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
