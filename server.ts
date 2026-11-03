import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  DatabaseConnectionConfig,
  ValidationCheckSelection,
  ValidationRunDetail,
  ValidationRunSummary,
} from './src/types.js';
import { DbConnector } from './server/services/dbConnector.js';
import { ValidationOrchestrator } from './server/services/orchestrator.js';
import { AiExplainerService } from './server/services/aiExplainer.js';
import { GeminiChatService } from './server/services/geminiChat.js';
import { getSourceDemoData, getTargetDemoData } from './server/services/demoDatabase.js';
import { createDataSource } from './server/services/dataSource.js';
import { CsvParseError } from './server/services/csvParser.js';
import {
  createCsvSession,
  storeUploadedCsv,
  getSessionPreviews,
  MAX_UPLOAD_MB,
} from './server/services/csvSessionStore.js';
import {
  suggestSessionMappings,
  validateSessionMappings,
  runCsvValidation,
} from './server/services/customValidationService.js';
import { buildCsvReport, buildJsonReport } from './server/services/reportBuilder.js';
import { connectMongo } from './server/db/mongo.js';
import { registerAuthRoutes } from './server/auth/authRoutes.js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
registerAuthRoutes(app);

// In-memory persistent history store for validation runs
const validationRuns: Map<string, ValidationRunDetail> = new Map();

// Helper to generate seed initial run
function seedInitialRun() {
  const orchestrator = new ValidationOrchestrator();
  const sData = getSourceDemoData();
  const tData = getTargetDemoData();

  const defaultOptions: ValidationCheckSelection = {
    schemaValidation: true,
    rowCountValidation: true,
    recordValidation: true,
    duplicateDetection: true,
    nullValidation: true,
    referentialIntegrity: true,
    aggregateValidation: true,
  };

  const initialDetail = orchestrator.runValidation({
    sourceTables: sData.tables,
    targetTables: tData.tables,
    sourceRows: sData.rows,
    targetRows: tData.rows,
    options: defaultOptions,
    sourceDbName: 'banking_core_prod (Source)',
    targetDbName: 'banking_core_cloud (Target)',
    isDemo: true,
  });

  validationRuns.set(initialDetail.id, initialDetail);
}

seedInitialRun();

// ----------------------------------------------------
// API ROUTES FIRST
// ----------------------------------------------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DataGuard Migration Validator',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// 2. Test Connection
app.post('/api/connections/test', async (req, res) => {
  try {
    const config: DatabaseConnectionConfig = req.body;
    if (!config || !config.type) {
      return res.status(400).json({ success: false, message: 'Database type is required.' });
    }

    const result = await DbConnector.testConnection(config);
    return res.json({
      success: result.success,
      message: result.message,
      databaseType: config.type,
      discoveredTables: result.tables,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Connection test error: ${err.message || 'Unknown error'}`,
    });
  }
});

// 3. Schema Discovery for both databases
app.post('/api/connections/discover', async (req, res) => {
  try {
    const { sourceConfig, targetConfig } = req.body;
    if (!sourceConfig || !targetConfig) {
      return res.status(400).json({ success: false, message: 'Both source and target configs are required.' });
    }

    const sTest = await DbConnector.testConnection(sourceConfig);
    const tTest = await DbConnector.testConnection(targetConfig);

    if (!sTest.success) {
      return res.status(400).json({ success: false, message: `Source DB: ${sTest.message}` });
    }
    if (!tTest.success) {
      return res.status(400).json({ success: false, message: `Target DB: ${tTest.message}` });
    }

    const sTableNames = new Set((sTest.tables || []).map((t) => t.name.toLowerCase()));
    const tTableNames = new Set((tTest.tables || []).map((t) => t.name.toLowerCase()));
    const allNames = Array.from(new Set([...sTableNames, ...tTableNames]));

    const combined = allNames.map((name) => {
      const inSource = sTableNames.has(name);
      const inTarget = tTableNames.has(name);
      let status: 'MATCH' | 'MISSING_SOURCE' | 'MISSING_TARGET' = 'MATCH';
      if (inSource && !inTarget) status = 'MISSING_TARGET';
      else if (!inSource && inTarget) status = 'MISSING_SOURCE';

      return {
        name,
        inSource,
        inTarget,
        status,
      };
    });

    return res.json({ success: true, discoveredTables: combined });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Start Validation Run
app.post('/api/validation/start', async (req, res) => {
  try {
    const { sourceConfig, targetConfig, options, selectedTables } = req.body;
    if (!sourceConfig || !targetConfig) {
      return res.status(400).json({ success: false, message: 'Source and Target configs are required.' });
    }

    const effectiveOptions: ValidationCheckSelection = options || {
      schemaValidation: true,
      rowCountValidation: true,
      recordValidation: true,
      duplicateDetection: true,
      nullValidation: true,
      referentialIntegrity: true,
      aggregateValidation: true,
    };

    const sourceDs = createDataSource(sourceConfig);
    const targetDs = createDataSource(targetConfig);
    const sData = await sourceDs.extract();
    const tData = await targetDs.extract();

    const orchestrator = new ValidationOrchestrator();
    const result = orchestrator.runValidation({
      sourceTables: sData.tables,
      targetTables: tData.tables,
      sourceRows: sData.rows,
      targetRows: tData.rows,
      options: effectiveOptions,
      sourceDbName: sourceConfig.database || sData.displayName || 'Source DB',
      targetDbName: targetConfig.database || tData.displayName || 'Target DB',
      isDemo: sourceConfig.type === 'demo',
      dataSourceKind: sourceConfig.type === 'demo' ? 'demo' : 'database',
      selectedTables,
    });

    validationRuns.set(result.id, result);

    return res.json(result);
  } catch (err: any) {
    console.error('Validation start error:', err);
    return res.status(500).json({
      success: false,
      message: `Validation failed: ${err.message || 'Internal error'}`,
    });
  }
});

// 5. Get Validation History
app.get('/api/validation/history', (req, res) => {
  const summaries: ValidationRunSummary[] = Array.from(validationRuns.values())
    .map((run) => {
      const { issues, discoveredTables, ...summary } = run;
      return summary;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json(summaries);
});

// 6. Get Validation Run Details
app.get('/api/validation/:id', (req, res) => {
  const run = validationRuns.get(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Validation run not found' });
  }
  res.json(run);
});

// 7. Get Validation Issues
app.get('/api/validation/:id/results', (req, res) => {
  const run = validationRuns.get(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Validation run not found' });
  }
  res.json({
    id: run.id,
    issues: run.issues,
    total: run.issues.length,
  });
});

// 8. Get Validation Summary
app.get('/api/validation/:id/summary', (req, res) => {
  const run = validationRuns.get(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Validation run not found' });
  }
  const { issues, discoveredTables, ...summary } = run;
  res.json(summary);
});

// 9. Get Latest Validation Run (for Dashboard instant load)
app.get('/api/validation/latest/detail', (req, res) => {
  const sorted = Array.from(validationRuns.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  if (sorted.length === 0) {
    seedInitialRun();
    const fresh = Array.from(validationRuns.values())[0];
    return res.json(fresh);
  }
  return res.json(sorted[0]);
});

// 10. Trigger Quick Validation Run (One-click execution from Dashboard)
app.post('/api/validation/quick-run', async (req, res) => {
  try {
    const { mode = 'demo', options } = req.body;
    const effectiveOptions: ValidationCheckSelection = options || {
      schemaValidation: true,
      rowCountValidation: true,
      recordValidation: true,
      duplicateDetection: true,
      nullValidation: true,
      referentialIntegrity: true,
      aggregateValidation: true,
    };

    const sData = getSourceDemoData();
    const tData = getTargetDemoData();

    const orchestrator = new ValidationOrchestrator();
    const result = orchestrator.runValidation({
      sourceTables: sData.tables,
      targetTables: tData.tables,
      sourceRows: sData.rows,
      targetRows: tData.rows,
      options: effectiveOptions,
      sourceDbName: 'banking_core_prod (Source)',
      targetDbName: 'banking_core_cloud (Target)',
      isDemo: true,
      dataSourceKind: 'demo',
    });

    validationRuns.set(result.id, result);
    return res.json(result);
  } catch (err: any) {
    console.error('Quick run error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 11. AI Assistance / Single Error Explanation
app.post('/api/ai/explain', async (req, res) => {
  try {
    const { issue } = req.body;
    if (!issue) {
      return res.status(400).json({ error: 'Issue object is required.' });
    }

    const explanation = await AiExplainerService.explainIssue(issue);
    res.json(explanation);
  } catch (err: any) {
    console.error('AI explanation error:', err);
    res.status(500).json({ error: err.message || 'Failed to explain issue' });
  }
});

// 12. Gemini Multi-Turn AI Chatbot Copilot
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, context, model } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const chatResponse = await GeminiChatService.handleChat(messages, context, model);
    return res.json(chatResponse);
  } catch (err: any) {
    console.error('Gemini chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to complete chat interaction' });
  }
});

function jsonError(res: express.Response, err: any, fallbackStatus = 500) {
  const message = err?.message || 'Unexpected error';
  const status = err instanceof CsvParseError ? 400 : fallbackStatus;
  return res.status(status).json({ success: false, message });
}

// 13. Custom CSV session
app.post('/api/custom/session', (_req, res) => {
  const sessionId = createCsvSession();
  res.json({ success: true, sessionId, maxUploadMb: MAX_UPLOAD_MB });
});

// 14. Upload source or target CSV (raw body — not loaded in the browser)
app.post(
  '/api/custom/upload/:side',
  express.raw({ type: () => true, limit: `${MAX_UPLOAD_MB}mb` }),
  (req, res) => {
    try {
      const side = req.params.side === 'target' ? 'target' : req.params.side === 'source' ? 'source' : null;
      if (!side) {
        return res.status(400).json({ success: false, message: 'Upload side must be source or target.' });
      }
      const sessionId = String(req.headers['x-session-id'] || '');
      const fileName = String(req.headers['x-filename'] || 'upload.csv');
      if (!sessionId) {
        return res.status(400).json({ success: false, message: 'Missing upload session. Please start again.' });
      }
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
      const preview = storeUploadedCsv(sessionId, side, buffer, fileName);
      return res.json({ success: true, side, preview });
    } catch (err: any) {
      return jsonError(res, err, 400);
    }
  }
);

// 15. CSV preview (first 10 rows only — full file stays on the server)
app.get('/api/custom/preview', (req, res) => {
  try {
    const sessionId = String(req.query.sessionId || '');
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required.' });
    }
    return res.json({ success: true, ...getSessionPreviews(sessionId) });
  } catch (err: any) {
    return jsonError(res, err, 400);
  }
});

// 16. Suggested column mapping + primary key
app.post('/api/custom/mapping', (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required.' });
    }
    return res.json({ success: true, ...suggestSessionMappings(sessionId) });
  } catch (err: any) {
    return jsonError(res, err, 400);
  }
});

app.post('/api/custom/mapping/validate', (req, res) => {
  try {
    const { sessionId, mappings, primaryKey } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required.' });
    }
    const result = validateSessionMappings(sessionId, mappings || [], primaryKey);
    return res.json({ success: result.valid, ...result });
  } catch (err: any) {
    return jsonError(res, err, 400);
  }
});

// 17. Run custom CSV validation through the existing engine
app.post('/api/custom/validate', async (req, res) => {
  try {
    const { sessionId, mappings, primaryKey, options, selectedAggregateColumns } = req.body || {};
    if (!sessionId || !primaryKey) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and primaryKey are required.',
      });
    }
    const result = await runCsvValidation({
      sessionId,
      mappings: mappings || [],
      primaryKey,
      options,
      selectedAggregateColumns,
    });
    validationRuns.set(result.id, result);
    return res.json(result);
  } catch (err: any) {
    return jsonError(res, err, 400);
  }
});

// 18. Downloadable report (JSON / CSV) — never includes database passwords
app.get('/api/validation/:id/report', (req, res) => {
  const run = validationRuns.get(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Validation run not found' });
  }
  const format = String(req.query.format || 'json').toLowerCase();
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dataguard-report-${run.id}.csv"`);
    return res.send(buildCsvReport(run));
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="dataguard-report-${run.id}.json"`);
  return res.json(buildJsonReport(run));
});

// ----------------------------------------------------
// VITE OR STATIC ASSETS
// ----------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DataGuard server running on http://0.0.0.0:${PORT}`);
    connectMongo().catch((err: any) => {
      console.error('MongoDB startup error:', err.message);
    });
  });
}

start();
