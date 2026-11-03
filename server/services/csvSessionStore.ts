import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { ParsedCsv, parseCsvFile, sanitizeFilename, toCsvPreview, MAX_UPLOAD_MB } from './csvParser.js';
import { CsvPreview } from '../../src/types.js';

export const UPLOAD_TTL_MS = Number(process.env.DATAGUARD_UPLOAD_TTL_MINUTES || 60) * 60 * 1000;
export const UPLOAD_DIR = process.env.DATAGUARD_UPLOAD_DIR
  ? path.resolve(process.env.DATAGUARD_UPLOAD_DIR)
  : path.join(os.tmpdir(), 'dataguard-uploads');

interface StoredSide {
  filePath: string;
  originalName: string;
  parsed: ParsedCsv;
  preview: CsvPreview;
}

interface SessionRecord {
  id: string;
  createdAt: number;
  source?: StoredSide;
  target?: StoredSide;
}

const sessions = new Map<string, SessionRecord>();

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
  }
}

function deleteFileSilent(filePath?: string) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // temp cleanup is best-effort
  }
}

export function createCsvSession(): string {
  ensureUploadDir();
  const id = crypto.randomUUID();
  sessions.set(id, { id, createdAt: Date.now() });
  return id;
}

export function getCsvSession(sessionId: string): SessionRecord | undefined {
  return sessions.get(sessionId);
}

export function storeUploadedCsv(sessionId: string, side: 'source' | 'target', buffer: Buffer, originalName: string): CsvPreview {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Upload session expired or was not found. Please start again.');
  }

  const safeName = sanitizeFilename(originalName);
  const filePath = path.join(UPLOAD_DIR, `${sessionId}-${side}-${Date.now()}-${safeName}`);
  fs.writeFileSync(filePath, buffer, { mode: 0o600 });

  try {
    const parsed = parseCsvFile(filePath, safeName);
    const preview = toCsvPreview(parsed);
    deleteFileSilent(session[side]?.filePath);
    session[side] = { filePath, originalName: safeName, parsed, preview };
    return preview;
  } catch (err) {
    deleteFileSilent(filePath);
    throw err;
  }
}

export function getSessionPreviews(sessionId: string): { sessionId: string; source?: CsvPreview; target?: CsvPreview } {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Upload session expired or was not found. Please start again.');
  }
  return {
    sessionId,
    source: session.source?.preview,
    target: session.target?.preview,
  };
}

export function getParsedSides(sessionId: string): { source: ParsedCsv; target: ParsedCsv } {
  const session = sessions.get(sessionId);
  if (!session?.source || !session.target) {
    throw new Error('Please upload both a source CSV and a target CSV before continuing.');
  }
  return { source: session.source.parsed, target: session.target.parsed };
}

export function destroyCsvSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  deleteFileSilent(session.source?.filePath);
  deleteFileSilent(session.target?.filePath);
  sessions.delete(sessionId);
}

export function cleanupExpiredCsvSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > UPLOAD_TTL_MS) {
      destroyCsvSession(id);
    }
  }
}

ensureUploadDir();
setInterval(cleanupExpiredCsvSessions, 5 * 60 * 1000).unref?.();

export { MAX_UPLOAD_MB };
