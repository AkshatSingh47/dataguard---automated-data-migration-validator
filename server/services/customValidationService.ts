import {
  ColumnMapping,
  ValidationCheckSelection,
  ValidationRunDetail,
} from '../../src/types.js';
import { ValidationOrchestrator } from './orchestrator.js';
import { CsvDataSource } from './dataSource.js';
import { parsedCsvToSchema, findEmptyPrimaryKeys, CsvParseError } from './csvParser.js';
import { applyColumnMappings, suggestMappings, validateMappings } from './columnMapper.js';
import { getParsedSides, destroyCsvSession } from './csvSessionStore.js';
import { TableSchema } from '../validators/schemaValidator.js';

const DEFAULT_OPTIONS: ValidationCheckSelection = {
  schemaValidation: true,
  rowCountValidation: true,
  recordValidation: true,
  duplicateDetection: true,
  nullValidation: true,
  referentialIntegrity: false,
  aggregateValidation: true,
};

export function suggestSessionMappings(sessionId: string) {
  const { source, target } = getParsedSides(sessionId);
  return {
    suggestedPrimaryKey: source.suggestedPrimaryKey || source.headers[0],
    mappings: suggestMappings(source.headers, target.headers),
    sourceHeaders: source.headers,
    targetHeaders: target.headers,
    numericColumns: source.headers.filter((h) => {
      const t = source.inferredTypes[h];
      return t === 'INTEGER' || t === 'NUMERIC';
    }),
  };
}

export function validateSessionMappings(
  sessionId: string,
  mappings: ColumnMapping[],
  primaryKey: string
) {
  const { source, target } = getParsedSides(sessionId);
  if (!primaryKey || !source.headers.includes(primaryKey)) {
    return {
      valid: false,
      errors: ['Select the column that uniquely identifies each record.'],
      warnings: [] as string[],
    };
  }
  return validateMappings(source.headers, target.headers, mappings, primaryKey);
}

function buildMappedTargetSchema(
  targetParsed: { inferredTypes: Record<string, string>; rows: Record<string, any>[] },
  mappings: ColumnMapping[],
  tableName: string,
  primaryKey: string
): TableSchema {
  return {
    name: tableName,
    columns: mappings
      .filter((m) => m.sourceColumn && m.targetColumn)
      .map((m) => ({
        name: m.sourceColumn,
        dataType: targetParsed.inferredTypes[m.targetColumn] || 'TEXT',
        isNullable: targetParsed.rows.some((r) => r[m.targetColumn] === null),
        isPrimaryKey: m.sourceColumn === primaryKey,
      })),
    primaryKeys: [primaryKey],
    foreignKeys: [],
  };
}

export async function runCsvValidation(params: {
  sessionId: string;
  mappings: ColumnMapping[];
  primaryKey: string;
  options?: ValidationCheckSelection;
  selectedAggregateColumns?: string[];
}): Promise<ValidationRunDetail> {
  const { sessionId, mappings, primaryKey, selectedAggregateColumns } = params;
  const { source, target } = getParsedSides(sessionId);

  if (!primaryKey || !source.headers.includes(primaryKey)) {
    throw new CsvParseError('Select the column that uniquely identifies each record.');
  }

  const mappingCheck = validateMappings(source.headers, target.headers, mappings, primaryKey);
  if (!mappingCheck.valid) {
    throw new CsvParseError(mappingCheck.errors[0] || 'Column mapping is incomplete.');
  }

  const emptySourcePk = findEmptyPrimaryKeys(source.rows, primaryKey);
  if (emptySourcePk > 0) {
    throw new CsvParseError(
      `Unable to process this CSV because the selected primary-key column '${primaryKey}' contains empty values.`
    );
  }

  const targetPkColumn = mappings.find((m) => m.sourceColumn === primaryKey)?.targetColumn;
  if (targetPkColumn) {
    const emptyTargetPk = findEmptyPrimaryKeys(target.rows, targetPkColumn);
    if (emptyTargetPk > 0) {
      throw new CsvParseError(
        'Unable to process this CSV because the selected primary-key column contains empty values in the target file.'
      );
    }
  }

  const tableName = source.datasetName || 'dataset';
  const remappedTargetRows = applyColumnMappings(target.rows, mappings);
  const sourceSchema = parsedCsvToSchema(source, tableName, primaryKey);
  const targetSchema = buildMappedTargetSchema(target, mappings, tableName, primaryKey);

  const sourceDs = new CsvDataSource({
    tables: [sourceSchema],
    rows: { [tableName]: source.rows },
    displayName: source.fileName,
  });
  const targetDs = new CsvDataSource({
    tables: [targetSchema],
    rows: { [tableName]: remappedTargetRows },
    displayName: target.fileName,
  });

  const sData = await sourceDs.extract();
  const tData = await targetDs.extract();

  const options: ValidationCheckSelection = { ...DEFAULT_OPTIONS, ...(params.options || {}) };
  options.referentialIntegrity = false;

  const orchestrator = new ValidationOrchestrator();
  const result = orchestrator.runValidation({
    sourceTables: sData.tables,
    targetTables: tData.tables,
    sourceRows: sData.rows,
    targetRows: tData.rows,
    options,
    sourceDbName: sData.displayName,
    targetDbName: tData.displayName,
    isDemo: false,
    dataSourceKind: 'csv',
    sourceFileName: source.fileName,
    targetFileName: target.fileName,
    primaryKey,
    columnMappings: mappings,
    selectedAggregateColumns,
  });

  destroyCsvSession(sessionId);
  return result;
}
