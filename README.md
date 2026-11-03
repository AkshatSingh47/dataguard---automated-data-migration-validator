# DataGuard — Automated Data Migration Validator

> **Final-Year CSE Project**  
> An automated, production-grade validation platform that compares a **SOURCE database** and a **TARGET database** after migration to identify structural, integrity, and data discrepancies.

---

## 1. Project Purpose

When organizations move data from an on-premise or legacy database to a modern cloud database, the migration scripts frequently report "successful" execution even when data is silently lost, truncated, corrupted, or structurally misaligned.

**DataGuard does NOT perform the migration.** It is a dedicated post-migration quality assurance tool that answers one critical question:

> *"Was the data migrated from the source database to the target database correctly?"*

```
SOURCE DATABASE (Golden / Source of Truth)
    ↓
[Migration Pipeline / ETL / Tool]
    ↓
TARGET DATABASE (Destination / Migrated)
    ↓
DATAGUARD VALIDATOR
    ↓
Automated Comparison & Anomaly Detection
    ↓
Audit Report & Migration Health Score
```

---

## 2. Core Validation Modules

DataGuard runs 7 deterministic validation checks across both databases:

| # | Validation Module | What It Checks |
|---|---|---|
| 1 | **Schema Validation** | Compares table presence, column names, normalized data types, nullable constraints, and primary key definitions. |
| 2 | **Row Count Validation** | Compares total rows per matching table. Flags count disparities and calculates relative delta percentages. |
| 3 | **Record Validation** | Performs primary-key-based row alignment to identify missing records, extra records, and individual cell value mismatches with configurable numerical tolerance. |
| 4 | **Duplicate Detection** | Verifies primary key uniqueness in target tables to detect duplicate rows introduced by non-idempotent migration scripts. |
| 5 | **NULL Validation** | Flags unexpected NULL conversions where valid source data became NULL, or non-null fields populated in target. |
| 6 | **Referential Integrity** | Verifies foreign key constraints and flags orphan child records that point to non-existent parent rows. |
| 7 | **Aggregate Validation** | Computes statistical aggregates (`SUM`, `MIN`, `MAX`, `DISTINCT COUNT`, `NULL COUNT`) on key columns to catch subtle data drift. |

---

## 3. Migration Health Score Formula

DataGuard calculates a **strictly deterministic** health score between **0.0%** and **100.0%**. AI is never used to determine whether data matches or to compute scores.

$$\text{Health Score} = (S \times 0.20) + (C \times 0.25) + (A \times 0.25) + (R \times 0.15) + (G \times 0.15)$$

- **Schema Integrity ($S$, 20% weight)**: $100 - (\text{Schema Errors} \times 20)$
- **Data Completeness ($C$, 25% weight)**: $100 - (\text{Count Mismatches} \times 15) - (\text{Missing Rows} \times 5)$
- **Record Accuracy ($A$, 25% weight)**: $100 - (\text{Value Mismatches} \times 5) - (\text{Duplicate Rows} \times 10) - (\text{NULL Mismatches} \times 5)$
- **Relationship Integrity ($R$, 15% weight)**: $100 - (\text{Foreign Key Violations} \times 15)$
- **Aggregate Consistency ($G$, 15% weight)**: $100 - (\text{Aggregate Mismatches} \times 20)$

### Score Ratings
- **90.0% – 100.0%**: `HEALTHY` (Safe to proceed to cutover)
- **75.0% – 89.9%**: `NEEDS REVIEW` (Minor warnings or non-critical schema differences)
- **Below 75.0%**: `CRITICAL` (Migration contains data loss, duplicate keys, or corrupted values)

---

## 4. Architecture & Technology Stack

- **Backend**: Node.js, Express, TypeScript, `pg` (PostgreSQL client), `mysql2` (MySQL client).
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Recharts.
- **AI Diagnostics (Optional & Guarded)**: Google Gemini API / OpenAI API.
  - *Strict Boundary*: AI only explains already-detected discrepancies, highlights likely root causes (e.g. character encoding, precision loss, network timeout), and generates copyable diagnostic SQL queries.
  - If no API key is configured, DataGuard provides complete deterministic engineering explanations without failing.

---

## 5. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status and version. |
| `POST` | `/api/connections/test` | Tests connectivity and credentials for PostgreSQL, MySQL, or Demo DB. |
| `POST` | `/api/connections/discover` | Discovers schemas, tables, columns, and keys across both databases. |
| `POST` | `/api/validation/start` | Executes selected validation checks and computes migration health. |
| `GET` | `/api/validation/history` | Retrieves previous validation run summaries. |
| `GET` | `/api/validation/:id` | Returns complete details, issues, and category breakdowns for a run. |
| `POST` | `/api/ai/explain` | Generates root cause hypothesis and diagnostic query for a specific issue. |

---

## 6. Embedded Banking Demo Dataset

To enable immediate testing without setting up external database instances, DataGuard includes an embedded in-memory banking dataset containing intentional real-world migration errors:

- **Source Database (`source_demo`)**:
  - `customers`: 4 records (Aarav, Priya, Arjun, Sneha) with valid balances and emails.
  - `accounts`: 3 accounts linked to customer IDs.
  - `transactions`: 3 transactions linked to valid accounts.
- **Target Database (`target_demo`)**:
  - `customers`: Missing Arjun (record 103), Duplicate Priya (record 102), NULL email for Sneha, and Balance scaling error on Aarav (50,000 in source vs 5,000 in target).
  - `accounts`: Data type mismatch (`balance` migrated as `varchar` instead of `numeric`).
  - `transactions`: Orphan record referencing non-existent `account_id: 999`.

---

## 7. Running Automated Tests

DataGuard includes an automated test suite covering all 7 validators and the health scoring algorithm:

```bash
npm test
```

All 18 test assertions verify error detection, issue structure, and score calculation.

---

## 8. Development & Production Build

```bash
# Start development server
npm run dev

# Run TypeScript type check
npm run lint

# Build for production
npm run build

# Start production server
npm start
```
