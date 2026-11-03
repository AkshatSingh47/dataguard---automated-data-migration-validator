import { ValidationIssue, AiExplainResponse } from '../../src/types.js';
import { GoogleGenAI } from '@google/genai';

export class AiExplainerService {
  private static geminiClient: GoogleGenAI | null = null;

  private static getGeminiClient(): GoogleGenAI | null {
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

  static async explainIssue(issue: ValidationIssue): Promise<AiExplainResponse> {
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Try OpenAI if configured
    if (openaiKey && openaiKey.trim().length > 0) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are DataGuard AI, a Senior Database Migration Engineer. Analyze the detected data migration discrepancy and provide a concise explanation, 2-3 likely root causes, and 2-3 actionable investigation steps for a database engineer. Return pure JSON with keys: explanation, possibleCauses (array of strings), investigationTips (array of strings).',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  check_type: issue.check_type,
                  table: issue.table,
                  primary_key: issue.primary_key,
                  column: issue.column,
                  source_value: issue.source_value,
                  target_value: issue.target_value,
                  message: issue.message,
                }),
              },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 400,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const parsed = JSON.parse(data.choices[0].message.content);
          return {
            explanation: parsed.explanation || 'AI analysis completed.',
            possibleCauses: parsed.possibleCauses || [],
            investigationTips: parsed.investigationTips || [],
            provider: 'openai',
          };
        }
      } catch (err) {
        console.warn('OpenAI explanation failed, falling back...', err);
      }
    }

    // 2. Try Gemini if configured
    if (geminiKey && geminiKey.trim().length > 0) {
      try {
        const ai = this.getGeminiClient();
        if (ai) {
          const prompt = `Analyze this database migration validation issue:
Table: ${issue.table}
Check Type: ${issue.check_type}
Record ID: ${issue.primary_key || 'N/A'}
Column: ${issue.column || 'N/A'}
Source Value: ${issue.source_value}
Target Value: ${issue.target_value}
Error: ${issue.message}

Respond in strict JSON with:
{
  "explanation": "Clear explanation of what likely happened in ETL/pipeline",
  "possibleCauses": ["cause 1", "cause 2"],
  "investigationTips": ["step 1", "step 2"]
}`;

          const geminiResp = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          });

          if (geminiResp.text) {
            const parsed = JSON.parse(geminiResp.text);
            return {
              explanation: parsed.explanation,
              possibleCauses: parsed.possibleCauses || [],
              investigationTips: parsed.investigationTips || [],
              provider: 'gemini',
            };
          }
        }
      } catch (err) {
        console.warn('Gemini explanation failed, falling back...', err);
      }
    }

    // 3. High quality deterministic explanation engine (Default & Offline fallback)
    return this.getDeterministicExplanation(issue);
  }

  private static getDeterministicExplanation(issue: ValidationIssue): AiExplainResponse {
    switch (issue.check_type) {
      case 'VALUE_MISMATCH': {
        const s = Number(issue.source_value);
        const t = Number(issue.target_value);
        let ratioDesc = '';
        if (!isNaN(s) && !isNaN(t) && s !== 0) {
          const ratio = s / t;
          if (Math.abs(ratio - 10) < 0.1) {
            ratioDesc = 'The target value is exactly one-tenth (1/10) of the source value. ';
          } else if (Math.abs(ratio - 100) < 0.1) {
            ratioDesc = 'The target value is 1/100th of the source value (cents vs dollars/units). ';
          }
        }

        return {
          explanation: `${ratioDesc}The record exists in both databases, but the column '${issue.column}' values differ between source and target. This indicates data corruption or an erroneous transform during migration.`,
          possibleCauses: [
            'Unit or decimal transformation bug (e.g. division by 10, integer truncation, or currency parsing).',
            'Out-of-sync update: source record was modified after migration snapshot was taken.',
            'Type conversion truncation (e.g. converting float/decimal to integer).',
          ],
          investigationTips: [
            `Compare migration ETL script mappings specifically for column '${issue.table}.${issue.column}'.`,
            `Query transaction logs or timestamp audit columns around migration start time.`,
            `Verify data precision and scale definitions on the target database table.`,
          ],
          provider: 'deterministic',
        };
      }

      case 'MISSING_TARGET':
        return {
          explanation: `Record with primary key '${issue.primary_key}' is present in the source table '${issue.table}' but was omitted entirely from the target table.`,
          possibleCauses: [
            'Migration extract query had an accidental WHERE clause filter or boundary condition (e.g. status or date filter).',
            'Network failure or batch ingestion timeout dropped the specific batch.',
            'Target foreign-key constraint pre-check failed during initial load, causing row rollback.',
          ],
          investigationTips: [
            `Inspect ETL extraction logs for any rejected rows or unhandled exceptions during table '${issue.table}' load.`,
            `Check if record '${issue.primary_key}' meets active/soft-delete criteria filtered by migration scripts.`,
            `Re-run incremental sync targeting this primary key ID to test insert viability.`,
          ],
          provider: 'deterministic',
        };

      case 'EXTRA_TARGET':
        return {
          explanation: `Record with primary key '${issue.primary_key}' exists in target '${issue.table}' but has no corresponding source row.`,
          possibleCauses: [
            'Test records or seed data were injected into the target database prior to migration.',
            'Dual-write mechanism ran before legacy data migration was completed.',
            'Target primary key sequences were out of sync or generated synthetic keys.',
          ],
          investigationTips: [
            `Check the created_at / updated_at timestamps on the target record '${issue.primary_key}'.`,
            `Verify whether target database was completely wiped and empty before initiating migration.`,
          ],
          provider: 'deterministic',
        };

      case 'DUPLICATE_TARGET':
        return {
          explanation: `Primary key '${issue.primary_key}' occurs multiple times in target table '${issue.table}'. This is a critical data integrity violation.`,
          possibleCauses: [
            'Target table lacks a PRIMARY KEY or UNIQUE constraint in the target DDL.',
            'Migration pipeline was retried without idempotency or deduplication logic.',
            'Multiple concurrent migration worker threads processed overlapping partitions.',
          ],
          investigationTips: [
            `Verify that the target table schema has an enforced PRIMARY KEY constraint.`,
            `Implement UPSERT / ON CONFLICT DO UPDATE semantics in migration ingestion scripts.`,
            `Identify exact timestamps and sources of the duplicated records using database logs.`,
          ],
          provider: 'deterministic',
        };

      case 'NULL_MISMATCH':
        return {
          explanation: `Column '${issue.column}' has a valid populated value in source ('${issue.source_value}'), but was migrated as NULL in the target database.`,
          possibleCauses: [
            'ETL schema mapper failed to bind or parse this column during transformation.',
            'Default value or fallback rule mistakenly converted empty strings or special characters to NULL.',
            'Target column encoding or collation rejected characters, causing silent NULL fallback.',
          ],
          investigationTips: [
            `Check ETL pipeline column mappings for '${issue.table}.${issue.column}'.`,
            `Inspect character encoding (e.g., UTF-8 vs Latin-1) and string length constraints.`,
          ],
          provider: 'deterministic',
        };

      case 'FOREIGN_KEY_VIOLATION':
        return {
          explanation: `Orphan foreign-key record detected in '${issue.table}.${issue.column}'. The referenced parent record does not exist in the target database.`,
          possibleCauses: [
            'Tables were migrated in the wrong dependency order (child before parent).',
            'Parent table migration filtered out records that child tables actively reference.',
            'Target foreign-key constraints were disabled during migration and orphan rows were inserted.',
          ],
          investigationTips: [
            `Verify table load ordering: parent tables must always finish loading before child tables.`,
            `Investigate if the missing parent record was skipped due to an ETL error.`,
            `Re-enable and enforce target database foreign key constraints.`,
          ],
          provider: 'deterministic',
        };

      case 'AGGREGATE_MISMATCH':
        return {
          explanation: `Aggregate calculation mismatch on '${issue.table}.${issue.column}'. Source and target sums, minimums, or maximums do not match.`,
          possibleCauses: [
            'Underlying records are missing, duplicated, or have value disparities affecting the aggregate.',
            'Rounding discrepancies or precision loss between source and target column data types.',
            'Migration filter excluded high-value transactions or negative balance entries.',
          ],
          investigationTips: [
            `Run drill-down validation on records for '${issue.table}' to locate which rows contribute to the delta.`,
            `Check for floating-point rounding errors by validating numeric/decimal scale.`,
          ],
          provider: 'deterministic',
        };

      case 'ROW_COUNT_MISMATCH':
        return {
          explanation: `Total row count difference detected between source and target table '${issue.table}'.`,
          possibleCauses: [
            'Migration job was interrupted or terminated before all chunks finished copying.',
            'Selective migration queries filtered rows unintentionally.',
            'Duplicate inserts occurred on the target database.',
          ],
          investigationTips: [
            `Check the number of completed batches in migration execution logs.`,
            `Compare COUNT(*) by partition or date range to isolate the missing interval.`,
          ],
          provider: 'deterministic',
        };

      default:
        return {
          explanation: `Schema or structure discrepancy detected on table '${issue.table}'.`,
          possibleCauses: [
            'Target DDL creation script used incompatible data types or omitted constraints.',
            'Target database dialect differences between PostgreSQL and MySQL.',
          ],
          investigationTips: [
            `Review the DDL migration scripts applied to target database.`,
            `Use automated schema migration tools (e.g. Liquibase or Flyway) to enforce parity.`,
          ],
          provider: 'deterministic',
        };
    }
  }
}
