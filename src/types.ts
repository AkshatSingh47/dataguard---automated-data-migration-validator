export type DatabaseType = 'postgresql' | 'mysql' | 'demo';

export interface DatabaseConnectionConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
}

export type DataSourceKind = 'demo' | 'csv' | 'database';

export type CheckType =
  | 'SCHEMA_MISMATCH'
  | 'ROW_COUNT_MISMATCH'
  | 'MISSING_TARGET'
  | 'EXTRA_TARGET'
  | 'DUPLICATE_TARGET'
  | 'VALUE_MISMATCH'
  | 'NULL_MISMATCH'
  | 'FOREIGN_KEY_VIOLATION'
  | 'AGGREGATE_MISMATCH'
  | 'DATA_TYPE_FORMAT';

export type IssueSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export type ValidationStatus = 'PASS' | 'FAIL' | 'WARNING';

export interface ValidationCheckSelection {
  schemaValidation: boolean;
  rowCountValidation: boolean;
  recordValidation: boolean;
  duplicateDetection: boolean;
  nullValidation: boolean;
  referentialIntegrity: boolean;
  aggregateValidation: boolean;
}

export interface DiscoveredTable {
  name: string;
  inSource: boolean;
  inTarget: boolean;
  status: 'MATCH' | 'MISSING_SOURCE' | 'MISSING_TARGET';
  sourceColumnsCount?: number;
  targetColumnsCount?: number;
  primaryKey?: string;
}

export interface ValidationIssue {
  id: string;
  table: string;
  check_type: CheckType;
  status: 'FAIL' | 'WARNING';
  severity: IssueSeverity;
  primary_key?: string;
  column?: string;
  source_value?: string | number | null;
  target_value?: string | number | null;
  message: string;
  explanation?: string;
}

export interface CategorySummary {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
  issuesCount: number;
}

export interface HealthScoreBreakdown {
  overallScore: number;
  rating: 'HEALTHY' | 'NEEDS REVIEW' | 'CRITICAL';
  schemaIntegrity: number;
  dataCompleteness: number;
  recordAccuracy: number;
  relationshipIntegrity: number;
  aggregateConsistency: number;
  formulaDescription: string;
}

export interface ValidationRunSummary {
  id: string;
  timestamp: string;
  overallStatus: 'PASSED' | 'FAILED' | 'WARNINGS';
  healthScore: number;
  healthRating: 'HEALTHY' | 'NEEDS REVIEW' | 'CRITICAL';
  tablesChecked: number;
  recordsChecked: number;
  passedChecksCount: number;
  warningChecksCount: number;
  failedChecksCount: number;
  categories: Record<string, CategorySummary>;
  healthBreakdown: HealthScoreBreakdown;
  selectedOptions: ValidationCheckSelection;
  sourceDbName: string;
  targetDbName: string;
  isDemo: boolean;
  dataSourceKind?: DataSourceKind;
  sourceFileName?: string;
  targetFileName?: string;
  primaryKey?: string;
  columnMappings?: ColumnMapping[];
  tableStats?: TableStat[];
}

export interface ValidationRunDetail extends ValidationRunSummary {
  issues: ValidationIssue[];
  discoveredTables: DiscoveredTable[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  databaseType: DatabaseType;
  discoveredTables?: DiscoveredTable[];
}

export interface AiExplainRequest {
  issue: ValidationIssue;
  context?: string;
}

export interface AiExplainResponse {
  explanation: string;
  investigationTips: string[];
  possibleCauses: string[];
  provider: 'openai' | 'gemini' | 'deterministic';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'model';
  content: string;
  timestamp: string;
  provider?: 'gemini' | 'context-engine';
}

export interface ChatRequest {
  messages: { role: 'user' | 'assistant' | 'model'; content: string }[];
  context?: {
    runId?: string;
    sourceDbName?: string;
    targetDbName?: string;
    healthScore?: number;
    healthRating?: string;
    totalIssues?: number;
    tablesEvaluated?: number;
    recordsCompared?: number;
    topIssues?: {
      table: string;
      check_type: string;
      message: string;
      severity: string;
      source_value?: any;
      target_value?: any;
      primary_key?: any;
    }[];
    tableSummaries?: {
      name: string;
      sourceRows: number;
      targetRows: number;
      issuesCount: number;
      status: string;
    }[];
  };
  model?: string;
}

export interface TableParityItem {
  name: string;
  sourceRows: number;
  targetRows: number;
  diff: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  issuesCount: number;
  schemaMatch: boolean;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
}

export interface TableStat {
  name: string;
  sourceRows: number;
  targetRows: number;
}

export interface CsvPreview {
  fileName: string;
  datasetName: string;
  headers: string[];
  rowCount: number;
  columnCount: number;
  previewRows: Record<string, string | number | null>[];
  inferredTypes: Record<string, string>;
  suggestedPrimaryKey: string | null;
  numericColumns: string[];
}

export interface CustomSessionState {
  sessionId: string;
  source?: CsvPreview;
  target?: CsvPreview;
  suggestedMappings?: ColumnMapping[];
}

export interface MappingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string;
}
