import { ValidationIssue } from '../../src/types.js';

export interface TableRowCount {
  tableName: string;
  sourceCount: number;
  targetCount: number;
}

export class RowCountValidator {
  validate(
    sourceOrCombined: TableRowCount[] | { table: string; count: number }[],
    targetCounts?: { table: string; count: number }[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    let combined: TableRowCount[] = [];

    if (targetCounts && Array.isArray(targetCounts)) {
      const targetMap = new Map<string, number>();
      for (const t of targetCounts) {
        targetMap.set(t.table.toLowerCase(), t.count);
      }
      for (const s of sourceOrCombined as { table: string; count: number }[]) {
        combined.push({
          tableName: s.table,
          sourceCount: s.count,
          targetCount: targetMap.get(s.table.toLowerCase()) ?? 0,
        });
      }
    } else {
      combined = (sourceOrCombined as any[]).map((c) => ({
        tableName: c.tableName || c.table,
        sourceCount: c.sourceCount ?? c.source ?? c.count ?? 0,
        targetCount: c.targetCount ?? c.target ?? 0,
      }));
    }

    for (const item of combined) {
      const sCount = Number(item.sourceCount) || 0;
      const tCount = Number(item.targetCount) || 0;
      const diff = sCount - tCount;

      if (diff !== 0) {
        const severity = Math.abs(diff) > 100 || (sCount > 0 && Math.abs(diff) / sCount > 0.05)
          ? 'HIGH'
          : 'MEDIUM';

        issues.push({
          id: `row-count-${item.tableName}`,
          table: item.tableName,
          check_type: 'ROW_COUNT_MISMATCH',
          status: 'FAIL',
          severity,
          message: `Row count disparity on table '${item.tableName}': Source has ${sCount.toLocaleString()} rows, Target has ${tCount.toLocaleString()} rows (Difference: ${Math.abs(diff)}).`,
          source_value: sCount,
          target_value: tCount,
        });
      }
    }

    return issues;
  }
}
