import { ColumnMapping, MappingValidationResult } from '../../src/types.js';
import { ParsedCsv } from './csvParser.js';

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenSet(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
}

function similarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.86;

  const ta = tokenSet(a);
  const tb = tokenSet(b);
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  const tokenScore = overlap / Math.max(ta.size, tb.size, 1);

  let same = 0;
  const max = Math.max(na.length, nb.length);
  for (let i = 0; i < Math.min(na.length, nb.length); i++) {
    if (na[i] === nb[i]) same++;
  }
  const prefixScore = same / max;
  return Math.max(tokenScore * 0.9, prefixScore * 0.7);
}

const ALIAS_GROUPS: string[][] = [
  ['id', 'pk', 'key', 'customer_id', 'account_id', 'transaction_id', 'userid', 'user_id'],
  ['name', 'customer_name', 'full_name', 'fullname', 'username'],
  ['email', 'email_address', 'emailaddress', 'mail'],
  ['phone', 'phone_number', 'mobile', 'contact'],
  ['balance', 'account_balance', 'amount', 'total', 'salary'],
  ['status', 'state', 'account_status'],
  ['city', 'town', 'location'],
];

function aliasBoost(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  for (const group of ALIAS_GROUPS) {
    const normalized = group.map(normalizeName);
    if (normalized.includes(na) && normalized.includes(nb)) return 0.92;
  }
  return 0;
}

export function suggestMappings(sourceHeaders: string[], targetHeaders: string[]): ColumnMapping[] {
  const usedTargets = new Set<string>();
  const mappings: ColumnMapping[] = [];

  for (const source of sourceHeaders) {
    let best: { target: string; score: number } | null = null;
    for (const target of targetHeaders) {
      if (usedTargets.has(target)) continue;
      const score = Math.max(similarity(source, target), aliasBoost(source, target));
      if (!best || score > best.score) best = { target, score };
    }
    if (best && best.score >= 0.55) {
      usedTargets.add(best.target);
      mappings.push({ sourceColumn: source, targetColumn: best.target });
    } else {
      mappings.push({ sourceColumn: source, targetColumn: '' });
    }
  }

  return mappings;
}

export function validateMappings(
  sourceHeaders: string[],
  targetHeaders: string[],
  mappings: ColumnMapping[],
  primaryKey?: string
): MappingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceSet = new Set(sourceHeaders);
  const targetSet = new Set(targetHeaders);
  const mappedSources = new Set<string>();
  const mappedTargets = new Set<string>();

  for (const mapping of mappings) {
    if (!mapping.sourceColumn) continue;
    if (!sourceSet.has(mapping.sourceColumn)) {
      errors.push(`Source column '${mapping.sourceColumn}' does not exist in the uploaded source file.`);
      continue;
    }
    mappedSources.add(mapping.sourceColumn);

    if (!mapping.targetColumn) {
      errors.push(`Please map source column '${mapping.sourceColumn}' before continuing.`);
      continue;
    }
    if (!targetSet.has(mapping.targetColumn)) {
      errors.push(`Target column '${mapping.targetColumn}' does not exist in the uploaded target file.`);
      continue;
    }
    if (mappedTargets.has(mapping.targetColumn)) {
      errors.push(
        `Target column '${mapping.targetColumn}' is mapped more than once. Each target column can only be used once.`
      );
    }
    mappedTargets.add(mapping.targetColumn);
  }

  for (const header of sourceHeaders) {
    if (!mappedSources.has(header)) {
      errors.push(`Please map source column '${header}' before continuing.`);
    }
  }

  if (primaryKey) {
    const pkMap = mappings.find((m) => m.sourceColumn === primaryKey);
    if (!pkMap || !pkMap.targetColumn) {
      errors.push(`Primary key mapping exists is required. Please map source column '${primaryKey}'.`);
    }
  }

  const unusedTargets = targetHeaders.filter((h) => !mappedTargets.has(h));
  if (unusedTargets.length > 0) {
    warnings.push(`Target column(s) not used in mapping: ${unusedTargets.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function applyColumnMappings(
  targetRows: Record<string, any>[],
  mappings: ColumnMapping[]
): Record<string, any>[] {
  return targetRows.map((row) => {
    const mapped: Record<string, any> = {};
    for (const { sourceColumn, targetColumn } of mappings) {
      if (!sourceColumn || !targetColumn) continue;
      mapped[sourceColumn] = Object.prototype.hasOwnProperty.call(row, targetColumn) ? row[targetColumn] : null;
    }
    return mapped;
  });
}

export function mappedTargetCsv(parsed: ParsedCsv, mappings: ColumnMapping[], tableName: string, primaryKey: string) {
  const rows = applyColumnMappings(parsed.rows, mappings);
  const headers = mappings.filter((m) => m.sourceColumn && m.targetColumn).map((m) => m.sourceColumn);
  const inferredTypes: Record<string, string> = {};
  for (const header of headers) {
    const originalTarget = mappings.find((m) => m.sourceColumn === header)?.targetColumn;
    inferredTypes[header] = originalTarget ? parsed.inferredTypes[originalTarget] || 'TEXT' : 'TEXT';
  }
  return {
    tableName,
    headers,
    rows,
    inferredTypes,
    primaryKey,
  };
}
