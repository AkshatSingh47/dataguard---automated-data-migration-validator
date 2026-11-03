import {
  ValidationCheckSelection,
  ValidationIssue,
  DiscoveredTable,
  ValidationRunDetail,
  CategorySummary,
  HealthScoreBreakdown,
} from '../../src/types.js';
import { SchemaValidator, TableSchema } from '../validators/schemaValidator.js';
import { RowCountValidator, TableRowCount } from '../validators/rowCountValidator.js';
import { RecordValidator } from '../validators/recordValidator.js';
import { DuplicateValidator } from '../validators/duplicateValidator.js';
import { NullValidator } from '../validators/nullValidator.js';
import { ForeignKeyValidator } from '../validators/foreignKeyValidator.js';
import { AggregateValidator } from '../validators/aggregateValidator.js';
import { TypeFormatValidator } from '../validators/typeFormatValidator.js';
import { ColumnMapping, DataSourceKind, TableStat } from '../../src/types.js';

export interface OrchestratorInput {
  sourceTables: TableSchema[];
  targetTables: TableSchema[];
  sourceRows: Record<string, Record<string, any>[]>;
  targetRows: Record<string, Record<string, any>[]>;
  options: ValidationCheckSelection;
  sourceDbName: string;
  targetDbName: string;
  isDemo: boolean;
  dataSourceKind?: DataSourceKind;
  sourceFileName?: string;
  targetFileName?: string;
  primaryKey?: string;
  columnMappings?: ColumnMapping[];
  selectedTables?: string[];
  selectedAggregateColumns?: string[];
}

export class ValidationOrchestrator {
  private schemaValidator = new SchemaValidator();
  private rowCountValidator = new RowCountValidator();
  private recordValidator = new RecordValidator();
  private duplicateValidator = new DuplicateValidator();
  private nullValidator = new NullValidator();
  private foreignKeyValidator = new ForeignKeyValidator();
  private aggregateValidator = new AggregateValidator();
  private typeFormatValidator = new TypeFormatValidator();

  runValidation(input: OrchestratorInput): ValidationRunDetail {
    const runId = `run-${Date.now()}`;
    const allIssues: ValidationIssue[] = [];

    const selected = input.selectedTables?.map((n) => n.toLowerCase());
    const sourceTableMap = new Map(
      input.sourceTables
        .filter((t) => !selected || selected.includes(t.name.toLowerCase()))
        .map((t) => [t.name.toLowerCase(), t])
    );
    const targetTableMap = new Map(
      input.targetTables
        .filter((t) => !selected || selected.includes(t.name.toLowerCase()))
        .map((t) => [t.name.toLowerCase(), t])
    );

    // 1. Build Discovered Tables
    const discoveredTables: DiscoveredTable[] = [];
    const allTableNames = Array.from(
      new Set([...sourceTableMap.keys(), ...targetTableMap.keys()])
    );

    for (const name of allTableNames) {
      const inSource = sourceTableMap.has(name);
      const inTarget = targetTableMap.has(name);
      const sTable = sourceTableMap.get(name);
      const tTable = targetTableMap.get(name);

      let status: 'MATCH' | 'MISSING_SOURCE' | 'MISSING_TARGET' = 'MATCH';
      if (inSource && !inTarget) status = 'MISSING_TARGET';
      else if (!inSource && inTarget) status = 'MISSING_SOURCE';

      discoveredTables.push({
        name: sTable?.name || tTable?.name || name,
        inSource,
        inTarget,
        status,
        sourceColumnsCount: sTable?.columns.length,
        targetColumnsCount: tTable?.columns.length,
        primaryKey: sTable?.primaryKeys[0] || tTable?.primaryKeys[0] || 'id',
      });
    }

    let recordsChecked = 0;
    let tablesChecked = 0;
    const tableStats: TableStat[] = [];

    // Track category issue tallies
    const categoryTallies: Record<string, { issues: number; checked: boolean }> = {
      Schema: { issues: 0, checked: input.options.schemaValidation },
      'Row Count': { issues: 0, checked: input.options.rowCountValidation },
      Records: { issues: 0, checked: input.options.recordValidation },
      Duplicates: { issues: 0, checked: input.options.duplicateDetection },
      'NULL Validation': { issues: 0, checked: input.options.nullValidation },
      Relationships: { issues: 0, checked: input.options.referentialIntegrity },
      Aggregates: { issues: 0, checked: input.options.aggregateValidation },
    };

    // 2. Schema Validation
    if (input.options.schemaValidation) {
      const schemaIssues = this.schemaValidator.validate(
        Array.from(sourceTableMap.values()),
        Array.from(targetTableMap.values())
      );
      allIssues.push(...schemaIssues);
      categoryTallies['Schema'].issues += schemaIssues.length;
    }

    // 3. Row Count Validation
    if (input.options.rowCountValidation) {
      const countInputs: TableRowCount[] = [];
      for (const [name, sTable] of sourceTableMap.entries()) {
        const sRows = input.sourceRows[sTable.name] || [];
        const tRows = input.targetRows[sTable.name] || [];
        countInputs.push({
          tableName: sTable.name,
          sourceCount: sRows.length,
          targetCount: tRows.length,
        });
      }
      const countIssues = this.rowCountValidator.validate(countInputs);
      allIssues.push(...countIssues);
      categoryTallies['Row Count'].issues += countIssues.length;
    }

    // 4. Per-table Data Validations (Record, Duplicate, Null, Aggregate)
    for (const [name, sTable] of sourceTableMap.entries()) {
      const tTable = targetTableMap.get(name);
      if (!tTable) continue;

      tablesChecked++;
      const sRows = input.sourceRows[sTable.name] || input.sourceRows[name] || [];
      const tRows = input.targetRows[tTable.name] || input.targetRows[name] || [];
      recordsChecked += Math.max(sRows.length, tRows.length);
      tableStats.push({ name: sTable.name, sourceRows: sRows.length, targetRows: tRows.length });

      const pkCol = input.primaryKey || sTable.primaryKeys[0] || tTable.primaryKeys[0] || 'id';

      // Record Validation (Value Mismatches, Missing in Target, Extra in Target)
      if (input.options.recordValidation) {
        const recIssues = this.recordValidator.validate({
          tableName: sTable.name,
          primaryKeyColumn: pkCol,
          sourceRows: sRows,
          targetRows: tRows,
          numericTolerance: 0.001,
        });
        allIssues.push(...recIssues);
        categoryTallies['Records'].issues += recIssues.length;
      }

      // Duplicate Detection in Target
      if (input.options.duplicateDetection) {
        const dupIssues = this.duplicateValidator.validate({
          tableName: tTable.name,
          primaryKeyColumn: pkCol,
          targetRows: tRows,
        });
        allIssues.push(...dupIssues);
        categoryTallies['Duplicates'].issues += dupIssues.length;
      }

      // NULL Validation
      if (input.options.nullValidation) {
        const nullIssues = this.nullValidator.validate({
          tableName: sTable.name,
          primaryKeyColumn: pkCol,
          sourceRows: sRows,
          targetRows: tRows,
        });
        allIssues.push(...nullIssues);
        categoryTallies['NULL Validation'].issues += nullIssues.length;
      }

      // Aggregate Validation for numeric columns
      if (input.options.aggregateValidation) {
        const selectedAggs = input.selectedAggregateColumns?.map((c) => c.toLowerCase());
        for (const col of sTable.columns) {
          const typeStr = col.dataType.toLowerCase();
          const isNumericCol =
            typeStr.includes('int') ||
            typeStr.includes('num') ||
            typeStr.includes('dec') ||
            typeStr.includes('float') ||
            typeStr.includes('double') ||
            typeStr.includes('amount') ||
            typeStr.includes('balance') ||
            typeStr.includes('price');

          const isSelected = !selectedAggs || selectedAggs.includes(col.name.toLowerCase());
          if (isNumericCol && isSelected && col.name !== pkCol && !col.name.toLowerCase().endsWith('_id')) {
            const aggIssues = this.aggregateValidator.validate({
              tableName: sTable.name,
              column: col.name,
              sourceRows: sRows,
              targetRows: tRows,
              numericTolerance: 0.001,
            });
            allIssues.push(...aggIssues);
            categoryTallies['Aggregates'].issues += aggIssues.length;
          }
        }
      }

      if (input.options.schemaValidation) {
        const sourceTypes: Record<string, string> = {};
        for (const col of sTable.columns) sourceTypes[col.name] = col.dataType;
        const formatIssues = this.typeFormatValidator.validate({
          tableName: sTable.name,
          primaryKeyColumn: pkCol,
          sourceRows: sRows,
          targetRows: tRows,
          sourceTypes,
        });
        allIssues.push(...formatIssues);
        categoryTallies['Schema'].issues += formatIssues.length;
      }
    }

    // 5. Referential Integrity (Foreign Keys)
    if (input.options.referentialIntegrity) {
      for (const tTable of targetTableMap.values()) {
        const childRows = input.targetRows[tTable.name] || [];
        for (const fk of tTable.foreignKeys || []) {
          const parentRows = input.targetRows[fk.referencedTable] || [];
          const childPk = tTable.primaryKeys[0];
          const fkIssues = this.foreignKeyValidator.validate({
            rule: {
              childTable: tTable.name,
              childColumn: fk.column,
              parentTable: fk.referencedTable,
              parentColumn: fk.referencedColumn,
            },
            childRows,
            parentRows,
            childPrimaryKeyColumn: childPk,
          });
          allIssues.push(...fkIssues);
          categoryTallies['Relationships'].issues += fkIssues.length;
        }
      }
    }

    // 6. Build Category Summaries
    const categories: Record<string, CategorySummary> = {};
    for (const [catName, data] of Object.entries(categoryTallies)) {
      if (!data.checked) {
        categories[catName] = { name: catName, status: 'SKIPPED', issuesCount: 0 };
      } else if (data.issues === 0) {
        categories[catName] = { name: catName, status: 'PASS', issuesCount: 0 };
      } else {
        const hasHigh = allIssues.some(
          (i) => i.severity === 'HIGH' && this.mapCheckToCategory(i.check_type) === catName
        );
        categories[catName] = {
          name: catName,
          status: hasHigh ? 'FAIL' : 'WARNING',
          issuesCount: data.issues,
        };
      }
    }

    // 7. Calculate Deterministic Health Score
    const healthBreakdown = this.calculateHealthScore(allIssues, input.options);

    // Issue counters
    const passedChecksCount = Object.values(categories).filter((c) => c.status === 'PASS').length;
    const warningChecksCount = allIssues.filter((i) => i.status === 'WARNING').length;
    const failedChecksCount = allIssues.filter((i) => i.status === 'FAIL').length;

    let overallStatus: 'PASSED' | 'FAILED' | 'WARNINGS' = 'PASSED';
    if (failedChecksCount > 0 || healthBreakdown.rating === 'CRITICAL') {
      overallStatus = 'FAILED';
    } else if (warningChecksCount > 0 || healthBreakdown.rating === 'NEEDS REVIEW') {
      overallStatus = 'WARNINGS';
    }

    return {
      id: runId,
      timestamp: new Date().toISOString(),
      overallStatus,
      healthScore: healthBreakdown.overallScore,
      healthRating: healthBreakdown.rating,
      tablesChecked,
      recordsChecked,
      passedChecksCount,
      warningChecksCount,
      failedChecksCount,
      categories,
      healthBreakdown,
      issues: allIssues,
      discoveredTables,
      selectedOptions: input.options,
      sourceDbName: input.sourceDbName,
      targetDbName: input.targetDbName,
      isDemo: input.isDemo,
      dataSourceKind: input.dataSourceKind || (input.isDemo ? 'demo' : 'database'),
      sourceFileName: input.sourceFileName,
      targetFileName: input.targetFileName,
      primaryKey: input.primaryKey,
      columnMappings: input.columnMappings,
      tableStats,
    };
  }

  private mapCheckToCategory(checkType: string): string {
    switch (checkType) {
      case 'SCHEMA_MISMATCH':
      case 'DATA_TYPE_FORMAT':
        return 'Schema';
      case 'ROW_COUNT_MISMATCH':
        return 'Row Count';
      case 'MISSING_TARGET':
      case 'EXTRA_TARGET':
      case 'VALUE_MISMATCH':
        return 'Records';
      case 'DUPLICATE_TARGET':
        return 'Duplicates';
      case 'NULL_MISMATCH':
        return 'NULL Validation';
      case 'FOREIGN_KEY_VIOLATION':
        return 'Relationships';
      case 'AGGREGATE_MISMATCH':
        return 'Aggregates';
      default:
        return 'Records';
    }
  }

  private calculateHealthScore(
    issues: ValidationIssue[],
    options: ValidationCheckSelection
  ): HealthScoreBreakdown {
    // 1. Schema Integrity (Weight: 20%)
    const schemaIssues = issues.filter((i) => i.check_type === 'SCHEMA_MISMATCH').length;
    const formatIssues = issues.filter((i) => i.check_type === 'DATA_TYPE_FORMAT').length;
    const schemaScore = Math.max(0, 100 - schemaIssues * 20 - formatIssues * 10);

    // 2. Data Completeness (Weight: 25%) - missing records, extra records, row count
    const missingRecs = issues.filter((i) => i.check_type === 'MISSING_TARGET').length;
    const extraRecs = issues.filter((i) => i.check_type === 'EXTRA_TARGET').length;
    const rowDiffs = issues.filter((i) => i.check_type === 'ROW_COUNT_MISMATCH').length;
    const completenessScore = Math.max(0, 100 - (missingRecs * 25 + rowDiffs * 15 + extraRecs * 5));

    // 3. Record Accuracy (Weight: 25%) - value mismatches, null mismatches, duplicates
    const valMismatches = issues.filter((i) => i.check_type === 'VALUE_MISMATCH').length;
    const nullMismatches = issues.filter((i) => i.check_type === 'NULL_MISMATCH').length;
    const duplicates = issues.filter((i) => i.check_type === 'DUPLICATE_TARGET').length;
    const accuracyScore = Math.max(0, 100 - (valMismatches * 20 + nullMismatches * 15 + duplicates * 15));

    // 4. Relationship Integrity (Weight: 15%) - foreign key violations
    const fkViolations = issues.filter((i) => i.check_type === 'FOREIGN_KEY_VIOLATION').length;
    const relationshipScore = Math.max(0, 100 - fkViolations * 35);

    // 5. Aggregate Consistency (Weight: 15%) - aggregate mismatches
    const aggIssues = issues.filter((i) => i.check_type === 'AGGREGATE_MISMATCH').length;
    const aggregateScore = Math.max(0, 100 - aggIssues * 25);

    // Weighted Overall Score
    const overall =
      schemaScore * 0.2 +
      completenessScore * 0.25 +
      accuracyScore * 0.25 +
      relationshipScore * 0.15 +
      aggregateScore * 0.15;

    const roundedOverall = Math.round(overall * 10) / 10;

    let rating: 'HEALTHY' | 'NEEDS REVIEW' | 'CRITICAL' = 'HEALTHY';
    if (roundedOverall < 75.0) {
      rating = 'CRITICAL';
    } else if (roundedOverall < 90.0) {
      rating = 'NEEDS REVIEW';
    }

    const formulaDescription =
      'Health Score = (Schema Integrity × 20%) + (Data Completeness × 25%) + (Record Accuracy × 25%) + (Relationship Integrity × 15%) + (Aggregate Consistency × 15%). Deterministic score between 0.0% and 100.0%.';

    return {
      overallScore: roundedOverall,
      rating,
      schemaIntegrity: schemaScore,
      dataCompleteness: completenessScore,
      recordAccuracy: accuracyScore,
      relationshipIntegrity: relationshipScore,
      aggregateConsistency: aggregateScore,
      formulaDescription,
    };
  }
}
