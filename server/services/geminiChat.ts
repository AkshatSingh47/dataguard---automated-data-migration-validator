import { GoogleGenAI } from '@google/genai';

export interface ChatMessagePayload {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface ChatContextPayload {
  runId?: string;
  sourceDbName?: string;
  targetDbName?: string;
  healthScore?: number;
  healthRating?: string;
  totalIssues?: number;
  tablesEvaluated?: number;
  recordsCompared?: number;
  topIssues?: {
    table: string;
    check_type: string;
    message: string;
    severity: string;
    source_value?: any;
    target_value?: any;
    primary_key?: any;
  }[];
  tableSummaries?: {
    name: string;
    sourceRows: number;
    targetRows: number;
    issuesCount: number;
    status: string;
  }[];
}

export class GeminiChatService {
  private static geminiClient: GoogleGenAI | null = null;

  private static getClient(): GoogleGenAI | null {
    if (!this.geminiClient && process.env.GEMINI_API_KEY) {
      this.geminiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.geminiClient;
  }

  static async handleChat(
    messages: ChatMessagePayload[],
    context?: ChatContextPayload,
    modelName: string = 'gemini-3.8-flash'
  ): Promise<{ text: string; provider: 'gemini' | 'context-engine' }> {
    const geminiKey = process.env.GEMINI_API_KEY;

    // Build rich system instruction with migration context
    let systemInstruction = `You are DataGuard Copilot, an elite Database Migration Engineer & Data Integrity Specialist.
Your purpose is to help database administrators, data engineers, and QA leads diagnose migration anomalies, understand schema and record drift, and generate safe, idempotent SQL remediation scripts and ETL fixes.

Guidelines:
1. Speak with professional authority, precision, and technical clarity.
2. Whenever recommending fixes, provide copyable, safe SQL scripts (e.g. using transactions, BEGIN/COMMIT, and WHERE conditions on Primary Keys).
3. If explaining an anomaly (e.g. 10x value disparity, missing foreign key parent, unexpected NULL), explain the likely root cause in the ETL extraction, serialization, or load pipeline.
4. Keep answers concise, actionable, and formatted nicely in Markdown with headings, bullet points, and code blocks.`;

    if (context) {
      systemInstruction += `\n\n--- CURRENT ACTIVE VALIDATION RUN TELEMETRY ---
Run ID: ${context.runId || 'N/A'}
Source Database: ${context.sourceDbName || 'Source'}
Target Database: ${context.targetDbName || 'Target'}
Migration Health Score: ${context.healthScore !== undefined ? context.healthScore.toFixed(1) + '%' : 'N/A'} (${context.healthRating || 'Unknown'})
Total Discrepancies Detected: ${context.totalIssues ?? 0}
Tables Evaluated: ${context.tablesEvaluated ?? 0}
Records Compared: ${context.recordsCompared ?? 0}`;

      if (context.tableSummaries && context.tableSummaries.length > 0) {
        systemInstruction += `\n\nTable Parity Summary:\n` +
          context.tableSummaries.map(t => `- Table '${t.name}': Status=${t.status}, Source=${t.sourceRows} rows, Target=${t.targetRows} rows, Issues=${t.issuesCount}`).join('\n');
      }

      if (context.topIssues && context.topIssues.length > 0) {
        systemInstruction += `\n\nDetected Validation Discrepancies:\n` +
          context.topIssues.map((iss, i) =>
            `${i + 1}. [${iss.severity}] Table '${iss.table}' (${iss.check_type}): ${iss.message}${iss.primary_key ? ` | PK: ${iss.primary_key}` : ''}${iss.source_value !== undefined ? ` | Source: ${iss.source_value} -> Target: ${iss.target_value}` : ''}`
          ).join('\n');
      }
    }

    // Try Gemini API if API key exists
    if (geminiKey && geminiKey.trim().length > 0) {
      try {
        const client = this.getClient();
        if (client) {
          // Normalize model name (supported: gemini-3.8-flash, gemini-3.5-flash, gemini-3.1-pro-preview, gemini-3.1-flash-lite)
          const validModels = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'];
          const targetModel = validModels.includes(modelName) ? modelName : 'gemini-3.8-flash';

          // Format contents for multi-turn chat
          const contents = messages.map((m) => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

          const response = await client.models.generateContent({
            model: targetModel,
            contents,
            config: {
              systemInstruction,
              temperature: 0.4,
            },
          });

          if (response.text) {
            return {
              text: response.text,
              provider: 'gemini',
            };
          }
        }
      } catch (err) {
        console.warn('Gemini chat request failed, falling back to deterministic context engine:', err);
      }
    }

    // Context-Engine fallback for offline / keyless development
    const latestUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const fallbackText = this.generateContextualResponse(latestUserMsg, context);
    return {
      text: fallbackText,
      provider: 'context-engine',
    };
  }

  private static generateContextualResponse(query: string, context?: ChatContextPayload): string {
    const q = query.toLowerCase();

    // 1. Balance mismatch / Customer 101 question
    if (q.includes('balance') || q.includes('101') || q.includes('5000') || q.includes('50,000') || q.includes('scaling')) {
      return `### Root Cause Analysis: Balance Value Discrepancy (Customer #101)

**Detected Problem:**
- **Table:** \`customers\`
- **Column:** \`balance\`
- **Source Value:** \`50,000\`
- **Target Value:** \`5,000\`
- **Discrepancy:** Target is exactly **1/10th** of the source value ($45,000 variance).

**Root Cause:**
This is a classic **decimal scaling / unit transformation defect** in the ETL ingestion step. Migration scripts frequently divide by 10 or treat currency figures as integers with mismatched implied cents.

**Recommended Remediation SQL:**
\`\`\`sql
-- 1. Check current corrupted record
SELECT customer_id, name, balance FROM customers WHERE customer_id = 101;

-- 2. Apply compensating atomic update
BEGIN;
UPDATE customers 
SET balance = 50000.00,
    updated_at = NOW()
WHERE customer_id = 101 AND balance = 5000.00;

-- 3. Verify parity
SELECT customer_id, name, balance FROM customers WHERE customer_id = 101;
COMMIT;
\`\`\`

**Pipeline Prevention:**
Inspect the migration schema transform for \`balance\`. Ensure \`DECIMAL(12, 2)\` is not cast to \`FLOAT\` or divided by a scale multiplier during batch ingestion.`;
    }

    // 2. Foreign key / orphan records
    if (q.includes('foreign key') || q.includes('orphan') || q.includes('transaction') || q.includes('account_id') || q.includes('referential')) {
      return `### Referential Integrity Breach: Orphan Records in \`transactions\`

**Detected Problem:**
- **Child Table:** \`transactions\`
- **Column:** \`account_id\`
- **Orphan Value:** \`999\`
- **Violation:** Record references parent account \`999\`, which does **not exist** in the target \`accounts\` table.

**Why this happened:**
1. **Load Order Inversion:** The \`transactions\` table was migrated before parent \`accounts\` finished replicating.
2. **Filtered Extract:** Account \`999\` may have been closed or soft-deleted, but was excluded by an ETL \`WHERE is_active = TRUE\` filter while child transactions were still copied.

**Recommended Remediation SQL:**
\`\`\`sql
-- Option A: Find all orphan transactions
SELECT t.transaction_id, t.account_id, t.amount, t.created_at
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.account_id
WHERE a.account_id IS NULL;

-- Option B: Re-sync missing parent account
INSERT INTO accounts (account_id, customer_id, account_type, balance, status)
VALUES (999, 101, 'SAVINGS', 0.00, 'ARCHIVED')
ON CONFLICT (account_id) DO NOTHING;

-- Option C: If transactions are invalid historical noise
-- DELETE FROM transactions WHERE account_id = 999;
\`\`\``;
    }

    // 3. Row count mismatch / missing audit_log
    if (q.includes('audit') || q.includes('missing table') || q.includes('row count') || q.includes('count')) {
      return `### Schema & Row Count Discrepancy Overview

${context?.healthScore !== undefined ? `Current migration health score is **${context.healthScore.toFixed(1)}% (${context.healthRating})**.` : ''}

**Key Observations from Run:**
1. **Missing Table \`audit_log\`:**
   - Exists in Source DB with **12,400 rows**.
   - **Completely absent in Target DB DDL.**
   - *Impact:* Critical compliance & auditing risk. The target database cannot track administrative events.
2. **Row Count Mismatch in \`users\` / \`customers\`:**
   - Source: 5,000 rows | Target: 4,999 rows (Delta: **-1 row**).
   - Record ID \`2\` was omitted due to an interrupted batch or filter condition.

**Remediation Action:**
\`\`\`sql
-- 1. Create missing audit_log table in target PostgreSQL
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stream missing data chunk from source
-- pg_dump --data-only -t audit_log source_db | psql target_db
\`\`\``;
    }

    // 4. General migration summary / health assessment
    return `### DataGuard Migration Assessment Summary

${context ? `
- **Evaluated Databases:** \`${context.sourceDbName || 'Source'}\` → \`${context.targetDbName || 'Target'}\`
- **Migration Health Score:** **${context.healthScore !== undefined ? context.healthScore.toFixed(1) + '%' : '82.5%'}** (${context.healthRating || 'NEEDS REVIEW'})
- **Total Discrepancies:** **${context.totalIssues ?? 4} anomalies** across tables
` : ''}

**Executive Recommendations:**
1. **Block Production Cutover:** The target database currently contains value disparities in financial tables and missing parent-child constraints.
2. **Re-run Incremental Sync:** Patch the \`customers.balance\` scaling error and the missing record \`#2\`.
3. **Execute DDL Patch:** Create the \`audit_log\` table on target before directing live traffic.

Feel free to ask me for specific SQL repair scripts, column comparisons, or pipeline architecture suggestions!`;
  }
}
