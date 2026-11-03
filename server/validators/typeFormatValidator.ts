import { ValidationIssue } from '../../src/types.js';

export interface TypeFormatInput {
  tableName: string;
  primaryKeyColumn: string;
  sourceRows: Record<string, any>[];
  targetRows: Record<string, any>[];
  sourceTypes: Record<string, string>;
  targetTypes?: Record<string, string>;
}

const NUMERIC_TYPES = new Set(['INTEGER', 'NUMERIC', 'INT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'NUMBER']);

function isNumericType(typeStr: string | undefined): boolean {
  if (!typeStr) return false;
  const t = typeStr.toUpperCase();
  return NUMERIC_TYPES.has(t) || t.includes('INT') || t.includes('NUM') || t.includes('DEC') || t.includes('FLOAT');
}

function isNumericValue(val: any): boolean {
  if (val === null || val === undefined || val === '') return true;
  if (typeof val === 'number' && Number.isFinite(val)) return true;
  if (typeof val === 'boolean') return false;
  return /^-?\d+(\.\d+)?$/.test(String(val).trim());
}

/**
 * Conservative cell-level format check.
 * Flags a target value only when the source column is clearly numeric and the
 * target cell is a non-empty incompatible (non-numeric) value.
 */
export class TypeFormatValidator {
  validate(input: TypeFormatInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const pk = input.primaryKeyColumn;

    const sourceMap = new Map<string, Record<string, any>>();
    const targetMap = new Map<string, Record<string, any>>();
    for (const row of input.sourceRows) {
      const key = String(row[pk] ?? '');
      if (key) sourceMap.set(key, row);
    }
    for (const row of input.targetRows) {
      const key = String(row[pk] ?? '');
      if (key) targetMap.set(key, row);
    }

    const numericColumns = Object.keys(input.sourceTypes).filter((col) => col !== pk && isNumericType(input.sourceTypes[col]));
    if (numericColumns.length === 0) return issues;

    for (const [key, sRow] of sourceMap.entries()) {
      const tRow = targetMap.get(key);
      if (!tRow) continue;

      for (const col of numericColumns) {
        const sVal = sRow[col];
        const tVal = tRow[col];
        if (tVal === null || tVal === undefined || tVal === '') continue;
        if (!isNumericValue(sVal)) continue;
        if (isNumericValue(tVal)) continue;

        issues.push({
          id: `type-format-${input.tableName}-${key}-${col}`,
          table: input.tableName,
          check_type: 'DATA_TYPE_FORMAT',
          status: 'WARNING',
          severity: 'MEDIUM',
          primary_key: key,
          column: col,
          message: `Data type / format issue on record '${key}', column '${col}'. Source appears numeric (${sVal}) but target contains incompatible value '${tVal}'.`,
          source_value: sVal,
          target_value: String(tVal),
        });
      }
    }

    return issues;
  }
}
