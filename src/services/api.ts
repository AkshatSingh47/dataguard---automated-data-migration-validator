import {
  DatabaseConnectionConfig,
  ValidationCheckSelection,
  ValidationRunDetail,
  ValidationRunSummary,
  ValidationIssue,
  ConnectionTestResult,
  AiExplainResponse,
  DiscoveredTable,
  CsvPreview,
  ColumnMapping,
  MappingValidationResult,
  AuthUser,
} from '../types';

export const api = {
  async testConnection(config: DatabaseConnectionConfig): Promise<ConnectionTestResult> {
    const res = await fetch('/api/connections/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to connect to database');
    }
    return res.json();
  },

  async discoverTables(
    sourceConfig: DatabaseConnectionConfig,
    targetConfig: DatabaseConnectionConfig
  ): Promise<{ success: boolean; discoveredTables: DiscoveredTable[] }> {
    const res = await fetch('/api/connections/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceConfig, targetConfig }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to discover tables');
    }
    return res.json();
  },

  async startValidation(
    sourceConfig: DatabaseConnectionConfig,
    targetConfig: DatabaseConnectionConfig,
    options: ValidationCheckSelection,
    selectedTables?: string[]
  ): Promise<ValidationRunDetail> {
    const res = await fetch('/api/validation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceConfig, targetConfig, options, selectedTables }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Validation execution failed');
    }
    return res.json();
  },

  async getHistory(): Promise<ValidationRunSummary[]> {
    const res = await fetch('/api/validation/history');
    if (!res.ok) {
      throw new Error('Failed to fetch validation history');
    }
    return res.json();
  },

  async getRunDetail(id: string): Promise<ValidationRunDetail> {
    const res = await fetch(`/api/validation/${id}`);
    if (!res.ok) {
      throw new Error('Failed to load validation run');
    }
    return res.json();
  },

  async getLatestRunDetail(): Promise<ValidationRunDetail> {
    const res = await fetch('/api/validation/latest/detail');
    if (!res.ok) {
      throw new Error('Failed to load latest validation run');
    }
    return res.json();
  },

  async quickRun(options?: ValidationCheckSelection): Promise<ValidationRunDetail> {
    const res = await fetch('/api/validation/quick-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'demo', options }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Quick validation execution failed');
    }
    return res.json();
  },

  async sendChatMessage(
    messages: { role: 'user' | 'assistant' | 'model'; content: string }[],
    context?: any,
    model?: string
  ): Promise<{ text: string; provider: 'gemini' | 'context-engine' }> {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context, model }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to communicate with AI Copilot');
    }
    return res.json();
  },

  async explainIssue(issue: ValidationIssue): Promise<AiExplainResponse> {
    const res = await fetch('/api/ai/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate explanation');
    }
    return res.json();
  },

  async createCustomSession(): Promise<{ sessionId: string; maxUploadMb: number }> {
    const res = await fetch('/api/custom/session', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to start upload session');
    }
    return res.json();
  },

  async uploadCsv(sessionId: string, side: 'source' | 'target', file: File): Promise<CsvPreview> {
    const res = await fetch(`/api/custom/upload/${side}`, {
      method: 'POST',
      headers: {
        'X-Session-Id': sessionId,
        'X-Filename': file.name,
        'Content-Type': file.type || 'text/csv',
      },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to upload ${side} CSV`);
    }
    return data.preview;
  },

  async getCsvPreview(sessionId: string): Promise<{ source?: CsvPreview; target?: CsvPreview }> {
    const res = await fetch(`/api/custom/preview?sessionId=${encodeURIComponent(sessionId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to load CSV preview');
    return data;
  },

  async suggestMapping(sessionId: string): Promise<{
    suggestedPrimaryKey: string;
    mappings: ColumnMapping[];
    sourceHeaders: string[];
    targetHeaders: string[];
    numericColumns: string[];
  }> {
    const res = await fetch('/api/custom/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to suggest column mapping');
    return data;
  },

  async validateMapping(
    sessionId: string,
    mappings: ColumnMapping[],
    primaryKey: string
  ): Promise<MappingValidationResult> {
    const res = await fetch('/api/custom/mapping/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, mappings, primaryKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to validate mapping');
    return data;
  },

  async startCsvValidation(
    sessionId: string,
    mappings: ColumnMapping[],
    primaryKey: string,
    options: ValidationCheckSelection,
    selectedAggregateColumns?: string[]
  ): Promise<ValidationRunDetail> {
    const res = await fetch('/api/custom/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, mappings, primaryKey, options, selectedAggregateColumns }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Custom validation failed');
    return data;
  },

  reportUrl(id: string, format: 'json' | 'csv' = 'csv'): string {
    return `/api/validation/${id}/report?format=${format}`;
  },

  async register(name: string, email: string, password: string): Promise<AuthUser> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Unable to create account (${res.status}). Is the server running the latest code?`);
    }
    return data.user;
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Unable to sign in');
    return data.user;
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  },

  async me(): Promise<AuthUser | null> {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.user || null;
  },
};
