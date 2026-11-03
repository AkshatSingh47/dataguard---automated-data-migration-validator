import { ValidationRunDetail } from '../../src/types.js';

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function countType(run: ValidationRunDetail, type: string): number {
  return run.issues.filter((i) => i.check_type === type).length;
}

/** Build a downloadable JSON report. Never includes database passwords. */
export function buildJsonReport(run: ValidationRunDetail) {
  return {
    validationDate: run.timestamp,
    runId: run.id,
    source: run.sourceFileName || run.sourceDbName,
    target: run.targetFileName || run.targetDbName,
    dataSourceKind: run.dataSourceKind || (run.isDemo ? 'demo' : 'database'),
    primaryKey: run.primaryKey || null,
    columnMappings: run.columnMappings || [],
    tablesChecked: run.tablesChecked,
    recordsChecked: run.recordsChecked,
    tableStats: run.tableStats || [],
    sourceRecords: run.tableStats?.reduce((s, t) => s + t.sourceRows, 0) ?? run.recordsChecked,
    targetRecords: run.tableStats?.reduce((s, t) => s + t.targetRows, 0) ?? run.recordsChecked,
    missingRecords: countType(run, 'MISSING_TARGET'),
    extraRecords: countType(run, 'EXTRA_TARGET'),
    duplicateRecords: countType(run, 'DUPLICATE_TARGET'),
    valueMismatches: countType(run, 'VALUE_MISMATCH'),
    nullMismatches: countType(run, 'NULL_MISMATCH'),
    aggregateMismatches: countType(run, 'AGGREGATE_MISMATCH'),
    schemaMismatches: countType(run, 'SCHEMA_MISMATCH'),
    typeFormatIssues: countType(run, 'DATA_TYPE_FORMAT'),
    healthScore: run.healthScore,
    overallStatus: run.overallStatus,
    healthRating: run.healthRating,
    issues: run.issues,
  };
}

export function buildCsvReport(run: ValidationRunDetail): string {
  const report = buildJsonReport(run);
  const summaryLines = [
    ['Field', 'Value'],
    ['Validation date', report.validationDate],
    ['Run ID', run.id],
    ['Source filename', report.source],
    ['Target filename', report.target],
    ['Primary key', report.primaryKey || ''],
    ['Source records', report.sourceRecords],
    ['Target records', report.targetRecords],
    ['Missing records', report.missingRecords],
    ['Extra records', report.extraRecords],
    ['Duplicate records', report.duplicateRecords],
    ['Value mismatches', report.valueMismatches],
    ['NULL mismatches', report.nullMismatches],
    ['Aggregate mismatches', report.aggregateMismatches],
    ['Health score', report.healthScore],
    ['Overall status', report.overallStatus],
  ]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');

  const issueHeader = ['Type', 'Record ID', 'Table', 'Column', 'Source Value', 'Target Value', 'Severity', 'Message'];
  const issueRows = run.issues.map((issue) =>
    [
      issue.check_type,
      issue.primary_key ?? '',
      issue.table,
      issue.column ?? '',
      issue.source_value ?? '',
      issue.target_value ?? '',
      issue.severity,
      issue.message,
    ].map(csvEscape).join(',')
  );

  return `${summaryLines}\n\n${[issueHeader.map(csvEscape).join(','), ...issueRows].join('\n')}\n`;
}
