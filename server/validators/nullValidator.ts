import { ValidationIssue } from '../../src/types.js';

export interface NullCheckInput {
  tableName: string;
  primaryKeyColumn: string;
  sourceRows: Record<string, any>[];
  targetRows: Record<string, any>[];
}

export class NullValidator {
  validate(input: NullCheckInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const pk = input.primaryKeyColumn;

    const sourceMap = new Map<string, Record<string, any>>();
    const targetMap = new Map<string, Record<string, any>>();

    for (const r of input.sourceRows) {
      const k = String(r[pk] ?? '');
      if (k) sourceMap.set(k, r);
    }
    for (const r of input.targetRows) {
      const k = String(r[pk] ?? '');
      if (k) targetMap.set(k, r);
    }

    for (const [key, sRow] of sourceMap.entries()) {
      const tRow = targetMap.get(key);
      if (!tRow) continue; // Missing record handled by RecordValidator

      for (const col of Object.keys(sRow)) {
        if (col === pk) continue;
        const sVal = sRow[col];
        const tVal = tRow[col];

        const sIsNull = sVal === null || sVal === undefined || sVal === '';
        const tIsNull = tVal === null || tVal === undefined || tVal === '';

        if (!sIsNull && tIsNull) {
          issues.push({
            id: `null-mismatch-${input.tableName}-${key}-${col}`,
            table: input.tableName,
            check_type: 'NULL_MISMATCH',
            status: 'FAIL',
            severity: 'HIGH',
            primary_key: key,
            column: col,
            message: `NULL mismatch on column '${col}' for record '${key}'. Source has valid value '${sVal}', but target was populated with NULL.`,
            source_value: String(sVal),
            target_value: 'NULL',
          });
        } else if (sIsNull && !tIsNull) {
          issues.push({
            id: `null-mismatch-inverse-${input.tableName}-${key}-${col}`,
            table: input.tableName,
            check_type: 'NULL_MISMATCH',
            status: 'WARNING',
            severity: 'MEDIUM',
            primary_key: key,
            column: col,
            message: `NULL mismatch on column '${col}' for record '${key}'. Source is NULL, but target was populated with '${tVal}'.`,
            source_value: 'NULL',
            target_value: String(tVal),
          });
        }
      }
    }

    return issues;
  }
}
