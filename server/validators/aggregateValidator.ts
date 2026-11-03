import { ValidationIssue } from '../../src/types.js';

export interface AggregateComparisonInput {
  tableName: string;
  column: string;
  sourceRows: Record<string, any>[];
  targetRows: Record<string, any>[];
  numericTolerance?: number; // default 0.001
}

export interface MetricSummary {
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
  nullCount: number;
  distinctCount: number;
}

export class AggregateValidator {
  validate(input: AggregateComparisonInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const tolerance = input.numericTolerance ?? 0.001;

    const sourceMetrics = this.calculateMetrics(input.sourceRows, input.column);
    const targetMetrics = this.calculateMetrics(input.targetRows, input.column);

    // Compare SUM
    const sumDiff = Math.abs(sourceMetrics.sum - targetMetrics.sum);
    if (sumDiff > tolerance) {
      issues.push({
        id: `agg-sum-${input.tableName}-${input.column}`,
        table: input.tableName,
        check_type: 'AGGREGATE_MISMATCH',
        status: 'FAIL',
        severity: 'HIGH',
        column: input.column,
        message: `Aggregate SUM disparity on '${input.tableName}.${input.column}'. Source SUM: ${sourceMetrics.sum.toLocaleString()}, Target SUM: ${targetMetrics.sum.toLocaleString()} (Discrepancy: ${sumDiff.toFixed(2)}).`,
        source_value: `SUM: ${sourceMetrics.sum}`,
        target_value: `SUM: ${targetMetrics.sum}`,
      });
    }

    // Compare MIN
    if (sourceMetrics.min !== null && targetMetrics.min !== null) {
      if (Math.abs(sourceMetrics.min - targetMetrics.min) > tolerance) {
        issues.push({
          id: `agg-min-${input.tableName}-${input.column}`,
          table: input.tableName,
          check_type: 'AGGREGATE_MISMATCH',
          status: 'WARNING',
          severity: 'MEDIUM',
          column: input.column,
          message: `Aggregate MIN disparity on '${input.tableName}.${input.column}'. Source MIN: ${sourceMetrics.min}, Target MIN: ${targetMetrics.min}.`,
          source_value: `MIN: ${sourceMetrics.min}`,
          target_value: `MIN: ${targetMetrics.min}`,
        });
      }
    }

    // Compare MAX
    if (sourceMetrics.max !== null && targetMetrics.max !== null) {
      if (Math.abs(sourceMetrics.max - targetMetrics.max) > tolerance) {
        issues.push({
          id: `agg-max-${input.tableName}-${input.column}`,
          table: input.tableName,
          check_type: 'AGGREGATE_MISMATCH',
          status: 'WARNING',
          severity: 'MEDIUM',
          column: input.column,
          message: `Aggregate MAX disparity on '${input.tableName}.${input.column}'. Source MAX: ${sourceMetrics.max}, Target MAX: ${targetMetrics.max}.`,
          source_value: `MAX: ${sourceMetrics.max}`,
          target_value: `MAX: ${targetMetrics.max}`,
        });
      }
    }

    // Compare DISTINCT COUNT
    if (sourceMetrics.distinctCount !== targetMetrics.distinctCount) {
      issues.push({
        id: `agg-distinct-${input.tableName}-${input.column}`,
        table: input.tableName,
        check_type: 'AGGREGATE_MISMATCH',
        status: 'WARNING',
        severity: 'LOW',
        column: input.column,
        message: `Distinct count mismatch on '${input.tableName}.${input.column}'. Source has ${sourceMetrics.distinctCount} unique values, Target has ${targetMetrics.distinctCount}.`,
        source_value: `Distinct: ${sourceMetrics.distinctCount}`,
        target_value: `Distinct: ${targetMetrics.distinctCount}`,
      });
    }

    return issues;
  }

  private calculateMetrics(rows: Record<string, any>[], column: string): MetricSummary {
    let count = 0;
    let sum = 0;
    let min: number | null = null;
    let max: number | null = null;
    let nullCount = 0;
    const distinctSet = new Set<any>();

    for (const row of rows) {
      const val = row[column];
      if (val === null || val === undefined || val === '') {
        nullCount++;
      } else {
        const num = Number(val);
        if (!isNaN(num)) {
          count++;
          sum += num;
          if (min === null || num < min) min = num;
          if (max === null || num > max) max = num;
          distinctSet.add(num);
        }
      }
    }

    return {
      count,
      sum,
      min,
      max,
      nullCount,
      distinctCount: distinctSet.size,
    };
  }
}
