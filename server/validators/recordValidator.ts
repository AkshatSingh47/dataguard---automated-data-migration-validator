import { ValidationIssue } from '../../src/types.js';

export interface RecordComparisonInput {
  tableName: string;
  primaryKeyColumn: string;
  sourceRows: Record<string, any>[];
  targetRows: Record<string, any>[];
  numericTolerance?: number; // default 0.001
}

export class RecordValidator {
  validate(input: RecordComparisonInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const tolerance = input.numericTolerance ?? 0.001;
    const pk = input.primaryKeyColumn;

    const sourceMap = new Map<string, Record<string, any>>();
    const targetMap = new Map<string, Record<string, any>>();

    for (const row of input.sourceRows) {
      const keyVal = String(row[pk] ?? '');
      if (keyVal) sourceMap.set(keyVal, row);
    }

    for (const row of input.targetRows) {
      const keyVal = String(row[pk] ?? '');
      if (keyVal) targetMap.set(keyVal, row);
    }

    // 1. Missing records in target
    for (const [key, sRow] of sourceMap.entries()) {
      if (!targetMap.has(key)) {
        issues.push({
          id: `missing-rec-${input.tableName}-${key}`,
          table: input.tableName,
          check_type: 'MISSING_TARGET',
          status: 'FAIL',
          severity: 'HIGH',
          primary_key: key,
          message: `Record with primary key '${key}' exists in source table '${input.tableName}' but is completely missing in target.`,
          source_value: JSON.stringify(sRow),
          target_value: null,
        });
        continue;
      }

      // 2. Value mismatches for matching records
      const tRow = targetMap.get(key)!;
      for (const col of Object.keys(sRow)) {
        if (col === pk) continue;
        const sVal = sRow[col];
        const tVal = tRow[col];

        // If either is null and other is not, handled by NullValidator or as value mismatch
        if (sVal === null && tVal === null) continue;
        if (sVal === undefined && tVal === undefined) continue;

        if (this.isNumeric(sVal) && this.isNumeric(tVal)) {
          const numS = Number(sVal);
          const numT = Number(tVal);
          if (Math.abs(numS - numT) > tolerance) {
            issues.push({
              id: `val-mismatch-${input.tableName}-${key}-${col}`,
              table: input.tableName,
              check_type: 'VALUE_MISMATCH',
              status: 'FAIL',
              severity: 'HIGH',
              primary_key: key,
              column: col,
              message: `Value mismatch on record '${key}', column '${col}'. Source is ${sVal}, but target is ${tVal}.`,
              source_value: sVal,
              target_value: tVal,
            });
          }
        } else if (String(sVal ?? '') !== String(tVal ?? '')) {
          // If null disparity, note it if not already handled
          if ((sVal === null && tVal !== null) || (sVal !== null && tVal === null)) {
            // Null validator will catch this separately or we log as value mismatch if null check isn't alone
            issues.push({
              id: `val-mismatch-${input.tableName}-${key}-${col}`,
              table: input.tableName,
              check_type: 'VALUE_MISMATCH',
              status: 'FAIL',
              severity: 'HIGH',
              primary_key: key,
              column: col,
              message: `Value mismatch on record '${key}', column '${col}'. Source is '${sVal}', Target is '${tVal}'.`,
              source_value: sVal ?? 'NULL',
              target_value: tVal ?? 'NULL',
            });
          } else {
            issues.push({
              id: `val-mismatch-${input.tableName}-${key}-${col}`,
              table: input.tableName,
              check_type: 'VALUE_MISMATCH',
              status: 'FAIL',
              severity: 'HIGH',
              primary_key: key,
              column: col,
              message: `Value mismatch on record '${key}', column '${col}'. Source is '${sVal}', Target is '${tVal}'.`,
              source_value: sVal,
              target_value: tVal,
            });
          }
        }
      }
    }

    // 3. Extra records in target
    for (const [key, tRow] of targetMap.entries()) {
      if (!sourceMap.has(key)) {
        issues.push({
          id: `extra-rec-${input.tableName}-${key}`,
          table: input.tableName,
          check_type: 'EXTRA_TARGET',
          status: 'WARNING',
          severity: 'MEDIUM',
          primary_key: key,
          message: `Unexpected extra record with primary key '${key}' detected in target table '${input.tableName}'.`,
          source_value: null,
          target_value: JSON.stringify(tRow),
        });
      }
    }

    return issues;
  }

  private isNumeric(val: any): boolean {
    if (val === null || val === undefined || typeof val === 'boolean') return false;
    return !isNaN(Number(val)) && typeof val !== 'object';
  }
}
