import fs from 'fs';
import path from 'path';
import { CsvPreview } from '../../src/types.js';
import { TableSchema } from '../validators/schemaValidator.js';

export const MAX_UPLOAD_MB = Number(process.env.DATAGUARD_MAX_UPLOAD_MB || 100);
export const MAX_CSV_ROWS = Number(process.env.DATAGUARD_MAX_CSV_ROWS || 100000);

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export interface ParsedCsv {
  fileName: string;
  datasetName: string;
  headers: string[];
  rows: Record<string, any>[];
  inferredTypes: Record<string, string>;
  suggestedPrimaryKey: string | null;
}

const NULLISH = new Set(['', 'null', 'NULL', 'Null']);

export function sanitizeFilename(original: string): string {
  const base = path.basename(original || 'upload.csv');
  const cleaned = base.replace(/[^\w.\- ()]/g, '_').replace(/_{2,}/g, '_').slice(0, 120);
  return cleaned || 'upload.csv';
}

export function assertCsvFileAllowed(fileName: string, byteLength: number): void {
  const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
  if (byteLength === 0) {
    throw new CsvParseError('Unable to process this CSV because the file is empty.');
  }
  if (byteLength > maxBytes) {
    throw new CsvParseError(
      `File is too large (${(byteLength / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${MAX_UPLOAD_MB} MB.`
    );
  }
  const ext = path.extname(fileName).toLowerCase();
  if (ext && ext !== '.csv' && ext !== '.txt') {
    throw new CsvParseError('Only CSV files are supported. Please upload a .csv file.');
  }
}

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

/** RFC 4180-style CSV parser that keeps quoted commas and escaped quotes. */
export function parseCsvTextToMatrix(text: string): string[][] {
  const source = stripBom(text);
  if (!source.trim()) {
    throw new CsvParseError('Unable to process this CSV because the file is empty.');
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.length > 0) || rows.length === 0) {
        rows.push(row);
      }
      row = [];
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  if (inQuotes) {
    throw new CsvParseError('Unable to process this CSV because a quoted field is not closed. Check the file format.');
  }

  row.push(field);
  if (row.some((cell) => cell.length > 0) || rows.length === 0) {
    rows.push(row);
  }

  return rows;
}

function normalizeCell(raw: string): any {
  const trimmed = raw.trim();
  if (NULLISH.has(trimmed)) return null;
  return trimmed;
}

function looksLikeInteger(value: string): boolean {
  return /^-?\d+$/.test(value);
}

function looksLikeDecimal(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value);
}

function looksLikeBoolean(value: string): boolean {
  const v = value.toLowerCase();
  return v === 'true' || v === 'false' || v === '0' || v === '1' || v === 'yes' || v === 'no';
}

function looksLikeDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(value) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)) {
    return false;
  }
  const t = Date.parse(value);
  return !Number.isNaN(t);
}

export function inferColumnType(values: any[]): string {
  const samples = values.filter((v) => v !== null && v !== undefined).slice(0, 200).map((v) => String(v));
  if (samples.length === 0) return 'TEXT';

  if (samples.every(looksLikeInteger)) return 'INTEGER';
  if (samples.every(looksLikeDecimal)) return 'NUMERIC';
  if (samples.every(looksLikeBoolean) && samples.some((s) => ['true', 'false', 'yes', 'no'].includes(s.toLowerCase()))) {
    return 'BOOLEAN';
  }
  if (samples.every(looksLikeDate)) return 'DATE';
  return 'TEXT';
}

export function suggestPrimaryKey(headers: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  const preferred = ['id', 'customer_id', 'account_id', 'transaction_id', 'pk', 'uuid'];
  for (const name of preferred) {
    const idx = lower.indexOf(name);
    if (idx >= 0) return headers[idx];
  }
  const suffix = lower.findIndex((h) => h.endsWith('_id'));
  if (suffix >= 0) return headers[suffix];
  return headers[0] || null;
}

export function datasetNameFromFile(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  const cleaned = base
    .replace(/_?(source|target|src|tgt)$/i, '')
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return cleaned || 'dataset';
}

export function parseCsvBuffer(buffer: Buffer, originalName: string): ParsedCsv {
  assertCsvFileAllowed(originalName, buffer.length);

  let text: string;
  try {
    text = buffer.toString('utf8');
  } catch {
    throw new CsvParseError('Unable to process this CSV because of an encoding problem. Please save the file as UTF-8 and try again.');
  }

  if (text.includes('\uFFFD') && (text.match(/\uFFFD/g) || []).length > 20) {
    throw new CsvParseError('Unable to process this CSV because of an encoding problem. Please save the file as UTF-8 and try again.');
  }

  const matrix = parseCsvTextToMatrix(text);
  if (matrix.length === 0) {
    throw new CsvParseError('Unable to process this CSV because the file is empty.');
  }

  const headers = matrix[0].map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => !h)) {
    throw new CsvParseError('Unable to process this CSV because it is missing a header row.');
  }
  if (headers.some((h) => !h)) {
    throw new CsvParseError('Unable to process this CSV because one or more column headers are empty.');
  }

  const seen = new Set<string>();
  for (const header of headers) {
    const key = header.toLowerCase();
    if (seen.has(key)) {
      throw new CsvParseError(`Unable to process this CSV because the header '${header}' is duplicated.`);
    }
    seen.add(key);
  }

  const dataLines = matrix.slice(1).filter((r) => r.some((cell) => String(cell).trim().length > 0));
  if (dataLines.length === 0) {
    throw new CsvParseError('Unable to process this CSV because it contains headers but no data rows.');
  }
  if (dataLines.length > MAX_CSV_ROWS) {
    throw new CsvParseError(
      `This CSV has ${dataLines.length.toLocaleString()} rows, which exceeds the maximum of ${MAX_CSV_ROWS.toLocaleString()}.`
    );
  }

  const rows: Record<string, any>[] = dataLines.map((line) => {
    const obj: Record<string, any> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = normalizeCell(line[c] ?? '');
    }
    return obj;
  });

  const inferredTypes: Record<string, string> = {};
  for (const header of headers) {
    inferredTypes[header] = inferColumnType(rows.map((r) => r[header]));
  }

  const fileName = sanitizeFilename(originalName);
  return {
    fileName,
    datasetName: datasetNameFromFile(fileName),
    headers,
    rows,
    inferredTypes,
    suggestedPrimaryKey: suggestPrimaryKey(headers),
  };
}

export function parseCsvFile(filePath: string, originalName: string): ParsedCsv {
  const buffer = fs.readFileSync(filePath);
  return parseCsvBuffer(buffer, originalName);
}

export function toCsvPreview(parsed: ParsedCsv): CsvPreview {
  return {
    fileName: parsed.fileName,
    datasetName: parsed.datasetName,
    headers: parsed.headers,
    rowCount: parsed.rows.length,
    columnCount: parsed.headers.length,
    previewRows: parsed.rows.slice(0, 10),
    inferredTypes: parsed.inferredTypes,
    suggestedPrimaryKey: parsed.suggestedPrimaryKey,
    numericColumns: parsed.headers.filter((h) => {
      const t = parsed.inferredTypes[h];
      return t === 'INTEGER' || t === 'NUMERIC';
    }),
  };
}

export function parsedCsvToSchema(parsed: ParsedCsv, tableName: string, primaryKey: string): TableSchema {
  return {
    name: tableName,
    columns: parsed.headers.map((name) => ({
      name,
      dataType: parsed.inferredTypes[name] || 'TEXT',
      isNullable: parsed.rows.some((r) => r[name] === null),
      isPrimaryKey: name === primaryKey,
    })),
    primaryKeys: [primaryKey],
    foreignKeys: [],
  };
}

export function findEmptyPrimaryKeys(rows: Record<string, any>[], primaryKey: string): number {
  return rows.filter((r) => r[primaryKey] === null || r[primaryKey] === undefined || String(r[primaryKey]).trim() === '').length;
}
