import { SchemaValidator } from '../server/validators/schemaValidator';
import { RowCountValidator } from '../server/validators/rowCountValidator';
import { RecordValidator } from '../server/validators/recordValidator';
import { DuplicateValidator } from '../server/validators/duplicateValidator';
import { NullValidator } from '../server/validators/nullValidator';
import { ForeignKeyValidator } from '../server/validators/foreignKeyValidator';
import { AggregateValidator } from '../server/validators/aggregateValidator';
import { ValidationOrchestrator } from '../server/services/orchestrator';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✕ ${testName}`);
    failed++;
  }
}

console.log('\n=============================================');
console.log('Running DataGuard Automated Test Suite');
console.log('=============================================\n');

// 1. Schema Validator Test
console.log('[Test 1] Schema Validator');
const schemaValidator = new SchemaValidator();
const schemaIssues = schemaValidator.validate(
  [
    { name: 'customers', columns: [{ name: 'id', dataType: 'integer', isNullable: false }, { name: 'email', dataType: 'varchar', isNullable: true }] },
    { name: 'audit_log', columns: [{ name: 'id', dataType: 'integer', isNullable: false }] },
  ],
  [
    { name: 'customers', columns: [{ name: 'id', dataType: 'integer', isNullable: false }, { name: 'email', dataType: 'integer', isNullable: true }] },
  ]
);
assert(schemaIssues.some(i => i.check_type === 'SCHEMA_MISMATCH' && i.table === 'audit_log'), 'Detects missing table audit_log in target');
assert(schemaIssues.some(i => i.check_type === 'SCHEMA_MISMATCH' && i.column === 'email'), 'Detects data type difference for email (varchar vs integer)');

// 2. Row Count Validator Test
console.log('\n[Test 2] Row Count Validator');
const rowCountValidator = new RowCountValidator();
const countIssues = rowCountValidator.validate(
  [{ table: 'users', count: 100 }, { table: 'orders', count: 50 }],
  [{ table: 'users', count: 99 }, { table: 'orders', count: 50 }]
);
assert(countIssues.length === 1, 'Flags exactly 1 count mismatch');
assert(countIssues[0].check_type === 'ROW_COUNT_MISMATCH' && countIssues[0].table === 'users', 'Correctly identifies users table missing 1 row');

// 3. Record Comparator Test
console.log('\n[Test 3] Record Comparator');
const recordValidator = new RecordValidator();
const recordIssues = recordValidator.validate({
  tableName: 'accounts',
  primaryKeyColumn: 'id',
  sourceRows: [
    { id: 1, balance: 50000, status: 'ACTIVE' },
    { id: 2, balance: 20000, status: 'ACTIVE' },
  ],
  targetRows: [
    { id: 1, balance: 5000, status: 'ACTIVE' }, // value mismatch
    { id: 3, balance: 1000, status: 'PENDING' }, // extra in target
  ],
});
assert(recordIssues.some(i => i.check_type === 'VALUE_MISMATCH' && i.primary_key === '1' && i.column === 'balance'), 'Detects balance mismatch 50000 vs 5000');
assert(recordIssues.some(i => i.check_type === 'MISSING_TARGET' && i.primary_key === '2'), 'Detects record 2 missing in target');
assert(recordIssues.some(i => i.check_type === 'EXTRA_TARGET' && i.primary_key === '3'), 'Detects record 3 extra in target');

// 4. Duplicate Detection Test
console.log('\n[Test 4] Duplicate Detection');
const duplicateValidator = new DuplicateValidator();
const dupIssues = duplicateValidator.validate({
  tableName: 'customers',
  primaryKeyColumn: 'id',
  targetRows: [
    { id: 101, name: 'Alice' },
    { id: 102, name: 'Bob' },
    { id: 102, name: 'Bob Duplicate' },
  ],
});
assert(dupIssues.length === 1, 'Detects duplicate record');
assert(dupIssues[0].check_type === 'DUPLICATE_TARGET' && dupIssues[0].primary_key === '102', 'Identifies duplicated PK 102');

// 5. NULL Validator Test
console.log('\n[Test 5] NULL Validator');
const nullValidator = new NullValidator();
const nullIssues = nullValidator.validate({
  tableName: 'customers',
  primaryKeyColumn: 'id',
  sourceRows: [{ id: 1, email: 'alice@example.com' }],
  targetRows: [{ id: 1, email: null }],
});
assert(nullIssues.length === 1, 'Flags unexpected NULL in target');
assert(nullIssues[0].check_type === 'NULL_MISMATCH', 'Sets issue check_type to NULL_MISMATCH');

// 6. Referential Integrity Validator Test
console.log('\n[Test 6] Foreign Key / Referential Integrity');
const fkValidator = new ForeignKeyValidator();
const fkIssues = fkValidator.validate({
  rule: {
    childTable: 'transactions',
    childColumn: 'account_id',
    parentTable: 'accounts',
    parentColumn: 'id',
  },
  childRows: [{ id: 1001, account_id: 1 }, { id: 1002, account_id: 999 }],
  parentRows: [{ id: 1 }, { id: 2 }],
  childPrimaryKeyColumn: 'id',
});
assert(fkIssues.length === 1, 'Detects orphan child record');
assert(fkIssues[0].check_type === 'FOREIGN_KEY_VIOLATION' && fkIssues[0].column === 'account_id', 'Flags account_id 999 as orphan foreign key');

// 7. Aggregate Validator Test
console.log('\n[Test 7] Aggregate Validator');
const aggValidator = new AggregateValidator();
const aggIssues = aggValidator.validate({
  tableName: 'payments',
  column: 'amount',
  sourceRows: [{ amount: 100 }, { amount: 200 }, { amount: 300 }],
  targetRows: [{ amount: 100 }, { amount: 200 }, { amount: 250 }],
});
assert(aggIssues.some(i => i.check_type === 'AGGREGATE_MISMATCH' && i.message.includes('SUM')), 'Flags sum difference (600 vs 550)');

// 8. Health Score Calculation Test
console.log('\n[Test 8] Health Score Calculation');
const orchestrator = new ValidationOrchestrator();
// Clean run (100% score)
const cleanScore = (orchestrator as any).calculateHealthScore([], {
  schemaValidation: true,
  rowCountValidation: true,
  recordValidation: true,
  duplicateDetection: true,
  nullValidation: true,
  referentialIntegrity: true,
  aggregateValidation: true,
});
assert(cleanScore.overallScore === 100, 'Score is 100% when no issues exist');
assert(cleanScore.rating === 'HEALTHY', 'Rating is HEALTHY for clean migration');

// Run with severe flaws
const dirtyScore = (orchestrator as any).calculateHealthScore(
  [
    ...schemaIssues,
    ...countIssues,
    ...recordIssues,
    ...dupIssues,
    ...nullIssues,
    ...fkIssues,
    ...aggIssues,
  ],
  {
    schemaValidation: true,
    rowCountValidation: true,
    recordValidation: true,
    duplicateDetection: true,
    nullValidation: true,
    referentialIntegrity: true,
    aggregateValidation: true,
  }
);
assert(dirtyScore.overallScore < 75, `Flawed migration receives CRITICAL score (${dirtyScore.overallScore}%)`);
assert(dirtyScore.rating === 'CRITICAL', 'Rating is CRITICAL when major mismatches occur');

console.log('\n---------------------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('---------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All DataGuard automated tests PASSED successfully!\n');
}
