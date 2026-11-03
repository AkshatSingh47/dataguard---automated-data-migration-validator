import { ValidationIssue } from '../../src/types.js';

export interface ColumnDefinition {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey?: boolean;
  charMaxLength?: number | null;
  numericPrecision?: number | null;
}

export interface ForeignKeyDefinition {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
  primaryKeys?: string[];
  foreignKeys?: ForeignKeyDefinition[];
}

export class SchemaValidator {
  validate(sourceTables: TableSchema[], targetTables: TableSchema[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const sourceMap = new Map(sourceTables.map((t) => [t.name.toLowerCase(), t]));
    const targetMap = new Map(targetTables.map((t) => [t.name.toLowerCase(), t]));

    // Check tables missing in target
    for (const [sName, sTable] of sourceMap.entries()) {
      const tTable = targetMap.get(sName);
      if (!tTable) {
        issues.push({
          id: `schema-missing-table-${sName}`,
          table: sTable.name,
          check_type: 'SCHEMA_MISMATCH',
          status: 'FAIL',
          severity: 'HIGH',
          message: `Table '${sTable.name}' exists in source but is missing from target database.`,
          source_value: 'EXISTS',
          target_value: 'MISSING',
        });
        continue;
      }

      // Check primary key definitions
      const sPk = (sTable.primaryKeys || []).slice().sort().join(',');
      const tPk = (tTable.primaryKeys || []).slice().sort().join(',');
      if (sPk !== tPk) {
        issues.push({
          id: `schema-pk-${sName}`,
          table: sTable.name,
          check_type: 'SCHEMA_MISMATCH',
          status: 'FAIL',
          severity: 'HIGH',
          column: sPk || tPk,
          message: `Primary key definition mismatch on table '${sTable.name}'. Source: [${sPk}], Target: [${tPk}]`,
          source_value: sPk || 'NONE',
          target_value: tPk || 'NONE',
        });
      }

      const sColMap = new Map(sTable.columns.map((c) => [c.name.toLowerCase(), c]));
      const tColMap = new Map(tTable.columns.map((c) => [c.name.toLowerCase(), c]));

      // Check missing columns in target
      for (const [colName, sCol] of sColMap.entries()) {
        const tCol = tColMap.get(colName);
        if (!tCol) {
          issues.push({
            id: `schema-col-missing-${sName}-${colName}`,
            table: sTable.name,
            check_type: 'SCHEMA_MISMATCH',
            status: 'FAIL',
            severity: 'HIGH',
            column: sCol.name,
            message: `Column '${sCol.name}' exists in source '${sTable.name}' but is missing in target.`,
            source_value: sCol.dataType,
            target_value: 'MISSING',
          });
          continue;
        }

        // Compare normalized data type
        const normSourceType = this.normalizeType(sCol.dataType);
        const normTargetType = this.normalizeType(tCol.dataType);
        if (normSourceType !== normTargetType) {
          issues.push({
            id: `schema-col-type-${sName}-${colName}`,
            table: sTable.name,
            check_type: 'SCHEMA_MISMATCH',
            status: 'FAIL',
            severity: 'HIGH',
            column: sCol.name,
            message: `Data type mismatch for column '${sCol.name}'. Source is ${sCol.dataType}, but target is ${tCol.dataType}.`,
            source_value: sCol.dataType,
            target_value: tCol.dataType,
          });
        }

        // Compare nullability
        if (sCol.isNullable !== tCol.isNullable) {
          issues.push({
            id: `schema-col-nullability-${sName}-${colName}`,
            table: sTable.name,
            check_type: 'SCHEMA_MISMATCH',
            status: 'WARNING',
            severity: 'MEDIUM',
            column: sCol.name,
            message: `Nullability mismatch on '${sCol.name}'. Source: ${sCol.isNullable ? 'NULLABLE' : 'NOT NULL'}, Target: ${tCol.isNullable ? 'NULLABLE' : 'NOT NULL'}`,
            source_value: sCol.isNullable ? 'NULLABLE' : 'NOT NULL',
            target_value: tCol.isNullable ? 'NULLABLE' : 'NOT NULL',
          });
        }
      }

      // Check extra columns in target
      for (const [colName, tCol] of tColMap.entries()) {
        if (!sColMap.has(colName)) {
          issues.push({
            id: `schema-col-extra-${sName}-${colName}`,
            table: sTable.name,
            check_type: 'SCHEMA_MISMATCH',
            status: 'WARNING',
            severity: 'LOW',
            column: tCol.name,
            message: `Extra column '${tCol.name}' detected in target table '${sTable.name}'.`,
            source_value: 'NOT_PRESENT',
            target_value: tCol.dataType,
          });
        }
      }
    }

    return issues;
  }

  private normalizeType(typeStr: string): string {
    const t = typeStr.toLowerCase().replace(/\(.*\)/, '').trim();
    if (['int', 'integer', 'int4', 'int8', 'bigint', 'smallint', 'mediumint'].includes(t)) {
      return 'integer';
    }
    if (['varchar', 'character varying', 'text', 'char', 'string', 'nvarchar'].includes(t)) {
      return 'string';
    }
    if (['numeric', 'decimal', 'double', 'float', 'real'].includes(t)) {
      return 'numeric';
    }
    if (['timestamp', 'timestamptz', 'datetime', 'date'].includes(t)) {
      return 'temporal';
    }
    if (['bool', 'boolean'].includes(t)) {
      return 'boolean';
    }
    return t;
  }
}
