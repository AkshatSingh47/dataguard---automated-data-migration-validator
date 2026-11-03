import { ValidationIssue } from '../../src/types.js';

export interface ForeignKeyCheckRule {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
}

export interface ForeignKeyValidationInput {
  rule: ForeignKeyCheckRule;
  childRows: Record<string, any>[];
  parentRows: Record<string, any>[];
  childPrimaryKeyColumn?: string;
}

export class ForeignKeyValidator {
  validate(input: ForeignKeyValidationInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const { rule, childRows, parentRows, childPrimaryKeyColumn } = input;

    // Collect valid parent IDs
    const parentKeys = new Set<string>();
    for (const pRow of parentRows) {
      const val = pRow[rule.parentColumn];
      if (val !== null && val !== undefined && val !== '') {
        parentKeys.add(String(val));
      }
    }

    // Check each child row's foreign key
    for (const cRow of childRows) {
      const fkVal = cRow[rule.childColumn];
      if (fkVal === null || fkVal === undefined || fkVal === '') {
        continue; // Nullable FKs are permissible unless non-null constraint applies
      }

      const strFk = String(fkVal);
      if (!parentKeys.has(strFk)) {
        const childPk = childPrimaryKeyColumn ? String(cRow[childPrimaryKeyColumn] ?? '') : undefined;
        issues.push({
          id: `fk-violation-${rule.childTable}-${rule.childColumn}-${childPk || strFk}`,
          table: rule.childTable,
          check_type: 'FOREIGN_KEY_VIOLATION',
          status: 'FAIL',
          severity: 'HIGH',
          primary_key: childPk,
          column: rule.childColumn,
          source_value: `Referenced in ${rule.parentTable}.${rule.parentColumn}`,
          target_value: `Orphan: ${strFk}`,
          message: `Orphan foreign-key record detected in '${rule.childTable}.${rule.childColumn}' with value '${strFk}'. Referenced table '${rule.parentTable}' contains no matching record.`,
        });
      }
    }

    return issues;
  }
}
