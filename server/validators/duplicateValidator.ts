import { ValidationIssue } from '../../src/types.js';

export interface DuplicateCheckInput {
  tableName: string;
  primaryKeyColumn: string;
  targetRows: Record<string, any>[];
}

export class DuplicateValidator {
  validate(input: DuplicateCheckInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const pk = input.primaryKeyColumn;
    const frequency = new Map<string, number>();

    for (const row of input.targetRows) {
      const keyVal = String(row[pk] ?? '');
      if (keyVal) {
        frequency.set(keyVal, (frequency.get(keyVal) || 0) + 1);
      }
    }

    for (const [key, count] of frequency.entries()) {
      if (count > 1) {
        issues.push({
          id: `duplicate-target-${input.tableName}-${key}`,
          table: input.tableName,
          check_type: 'DUPLICATE_TARGET',
          status: 'FAIL',
          severity: 'HIGH',
          primary_key: key,
          column: pk,
          message: `Duplicate primary key '${key}' detected in target table '${input.tableName}'. Occurrences: ${count}.`,
          source_value: '1 (Unique)',
          target_value: `${count} occurrences`,
        });
      }
    }

    return issues;
  }
}
