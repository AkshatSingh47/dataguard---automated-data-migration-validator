import { parseCsvBuffer, assertCsvFileAllowed, CsvParseError, findEmptyPrimaryKeys, parsedCsvToSchema } from '../server/services/csvParser';
import { suggestMappings, validateMappings, applyColumnMappings } from '../server/services/columnMapper';
import { createCsvSession, storeUploadedCsv } from '../server/services/csvSessionStore';
import { runCsvValidation } from '../server/services/customValidationService';
import { ValidationOrchestrator } from '../server/services/orchestrator';
import { getSourceDemoData, getTargetDemoData } from '../server/services/demoDatabase';
import { createDataSource } from '../server/services/dataSource';
import { DbConnector } from '../server/services/dbConnector';
import { TypeFormatValidator } from '../server/validators/typeFormatValidator';

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

function buf(text: string) {
  return Buffer.from(text, 'utf8');
}

console.log('\n=============================================');
console.log('Running DataGuard Custom Data Test Suite');
console.log('=============================================\n');

console.log('[Test 1] Valid CSV upload');
const valid = parseCsvBuffer(buf('id,name,email\n1,Alice,a@test.com\n2,Bob,b@test.com\n'), 'people.csv');
assert(valid.headers.length === 3 && valid.rows.length === 2, 'Parses headers and 2 data rows');
assert(valid.rows[0].name === 'Alice', 'Reads cell values dynamically from file contents');

console.log('\n[Test 2] Invalid CSV');
try {
  parseCsvBuffer(buf('id,name\n"unclosed,quote'), 'bad.csv');
  assert(false, 'Rejects unclosed quoted field');
} catch (err: any) {
  assert(err instanceof CsvParseError && err.message.toLowerCase().includes('quoted'), 'Rejects unclosed quoted field');
}

console.log('\n[Test 3] Empty CSV');
try {
  parseCsvBuffer(buf('   '), 'empty.csv');
  assert(false, 'Rejects empty file');
} catch (err: any) {
  assert(err instanceof CsvParseError, 'Rejects empty file');
}

console.log('\n[Test 4] Missing headers');
try {
  parseCsvBuffer(buf(',,\n1,2,3\n'), 'no-headers.csv');
  assert(false, 'Rejects missing headers');
} catch (err: any) {
  assert(err instanceof CsvParseError && err.message.toLowerCase().includes('header'), 'Rejects missing/empty headers');
}

console.log('\n[Test 5] Duplicate headers');
try {
  parseCsvBuffer(buf('id,name,id\n1,A,2\n'), 'dup-headers.csv');
  assert(false, 'Rejects duplicate headers');
} catch (err: any) {
  assert(err instanceof CsvParseError && err.message.toLowerCase().includes('duplicated'), 'Rejects duplicate headers');
}

console.log('\n[Test 6] Primary key selection');
const pkParsed = parseCsvBuffer(buf('customer_id,name,email\n101,Rahul,r@x.com\n'), 'customers_source.csv');
assert(pkParsed.suggestedPrimaryKey === 'customer_id', 'Suggests customer_id as primary key');

console.log('\n[Test 7-12] Acceptance CSV (missing, extra, duplicate, value mismatch)');
const sourceCsv = `id,name,email,balance
1,Alice,alice@test.com,1000
2,Bob,bob@test.com,2000
3,Charlie,charlie@test.com,3000
4,David,david@test.com,4000
`;
const targetCsv = `id,name,email,balance
1,Alice,alice@test.com,1000
2,Bob,bob@test.com,2500
3,Charlie,charlie@test.com,3000
3,Charlie,charlie@test.com,3000
5,Eve,eve@test.com,5000
`;

const sessionId = createCsvSession();
storeUploadedCsv(sessionId, 'source', buf(sourceCsv), 'customers_source.csv');
storeUploadedCsv(sessionId, 'target', buf(targetCsv), 'customers_target.csv');
const acceptance = await runCsvValidation({
  sessionId,
  primaryKey: 'id',
  mappings: [
    { sourceColumn: 'id', targetColumn: 'id' },
    { sourceColumn: 'name', targetColumn: 'name' },
    { sourceColumn: 'email', targetColumn: 'email' },
    { sourceColumn: 'balance', targetColumn: 'balance' },
  ],
  selectedAggregateColumns: ['balance'],
});

assert(
  acceptance.issues.some((i) => i.check_type === 'VALUE_MISMATCH' && i.primary_key === '2' && i.column === 'balance'),
  'Record 2 VALUE_MISMATCH 2000 vs 2500'
);
assert(
  acceptance.issues.some((i) => i.check_type === 'DUPLICATE_TARGET' && i.primary_key === '3'),
  'Record 3 DUPLICATE_TARGET'
);
assert(
  acceptance.issues.some((i) => i.check_type === 'MISSING_TARGET' && i.primary_key === '4'),
  'Record 4 MISSING_TARGET'
);
assert(
  acceptance.issues.some((i) => i.check_type === 'EXTRA_TARGET' && i.primary_key === '5'),
  'Record 5 EXTRA_TARGET'
);
assert(acceptance.tableStats?.[0]?.sourceRows === 4, 'Source record count is 4 (dynamic)');
assert(acceptance.tableStats?.[0]?.targetRows === 5, 'Target record count is 5 (dynamic)');
assert(acceptance.isDemo === false && acceptance.dataSourceKind === 'csv', 'Run is stored as custom CSV, not demo');

console.log('\n[Test 13] Column mapping with different names');
const mappedSession = createCsvSession();
storeUploadedCsv(
  mappedSession,
  'source',
  buf('customer_id,name,email,balance\n101,Rahul,rahul@gmail.com,50000\n103,Arjun,arjun@gmail.com,30000\n'),
  'source.csv'
);
storeUploadedCsv(
  mappedSession,
  'target',
  buf('id,name,email_address,account_balance\n101,Rahul,rahul@gmail.com,5000\n104,Arjun,arjun@gmail.com,30000\n'),
  'target.csv'
);
const auto = suggestMappings(
  ['customer_id', 'name', 'email', 'balance'],
  ['id', 'name', 'email_address', 'account_balance']
);
assert(auto.find((m) => m.sourceColumn === 'email')?.targetColumn === 'email_address', 'Suggests email → email_address');
assert(auto.find((m) => m.sourceColumn === 'balance')?.targetColumn === 'account_balance', 'Suggests balance → account_balance');

const mappingErrors = validateMappings(
  ['customer_id', 'name', 'email', 'balance'],
  ['id', 'name', 'email_address', 'account_balance'],
  [
    { sourceColumn: 'customer_id', targetColumn: 'id' },
    { sourceColumn: 'name', targetColumn: 'name' },
    { sourceColumn: 'email', targetColumn: '' },
    { sourceColumn: 'balance', targetColumn: 'account_balance' },
  ],
  'customer_id'
);
assert(
  mappingErrors.errors.some((e) => e.includes("Please map source column 'email'")),
  'Blocks continue when a source column is unmapped'
);

const mappedRun = await runCsvValidation({
  sessionId: mappedSession,
  primaryKey: 'customer_id',
  mappings: [
    { sourceColumn: 'customer_id', targetColumn: 'id' },
    { sourceColumn: 'name', targetColumn: 'name' },
    { sourceColumn: 'email', targetColumn: 'email_address' },
    { sourceColumn: 'balance', targetColumn: 'account_balance' },
  ],
});
assert(mappedRun.issues.some((i) => i.check_type === 'MISSING_TARGET' && i.primary_key === '103'), 'Mapped PK finds missing 103');
assert(mappedRun.issues.some((i) => i.check_type === 'EXTRA_TARGET' && i.primary_key === '104'), 'Mapped PK finds extra 104');
assert(
  mappedRun.issues.some((i) => i.check_type === 'VALUE_MISMATCH' && i.primary_key === '101' && i.column === 'balance'),
  'Mapped balance column detects 50000 vs 5000'
);

console.log('\n[Test 14] NULL mismatch after mapping');
const nullSession = createCsvSession();
storeUploadedCsv(nullSession, 'source', buf('id,email\n101,rahul@gmail.com\n'), 's.csv');
storeUploadedCsv(nullSession, 'target', buf('id,email\n101,NULL\n'), 't.csv');
const nullRun = await runCsvValidation({
  sessionId: nullSession,
  primaryKey: 'id',
  mappings: [
    { sourceColumn: 'id', targetColumn: 'id' },
    { sourceColumn: 'email', targetColumn: 'email' },
  ],
});
assert(nullRun.issues.some((i) => i.check_type === 'NULL_MISMATCH' && i.primary_key === '101'), 'Detects NULL mismatch dynamically');

console.log('\n[Test 15] Aggregate mismatch');
assert(
  acceptance.issues.some((i) => i.check_type === 'AGGREGATE_MISMATCH' && String(i.column) === 'balance'),
  'Detects aggregate difference on numeric balance'
);

console.log('\n[Test 16] Empty primary-key values');
const emptyPk = parseCsvBuffer(buf('id,name\n,Alice\n2,Bob\n'), 'empty-pk.csv');
assert(findEmptyPrimaryKeys(emptyPk.rows, 'id') > 0, 'Counts empty primary-key values');

console.log('\n[Test 17] Large file handling');
try {
  assertCsvFileAllowed('huge.csv', 101 * 1024 * 1024);
  assert(false, 'Rejects files over the configured size limit');
} catch (err: any) {
  assert(err instanceof CsvParseError && err.message.includes('too large'), 'Rejects files over the configured size limit');
}

console.log('\n[Test 18] Type / format issue is conservative');
const fmt = new TypeFormatValidator().validate({
  tableName: 'customers',
  primaryKeyColumn: 'id',
  sourceRows: [{ id: 1, balance: 1000 }],
  targetRows: [{ id: 1, balance: 'N/A' }],
  sourceTypes: { id: 'INTEGER', balance: 'INTEGER' },
});
assert(fmt.some((i) => i.check_type === 'DATA_TYPE_FORMAT'), 'Flags incompatible non-numeric target value');
const fmtOk = new TypeFormatValidator().validate({
  tableName: 'customers',
  primaryKeyColumn: 'id',
  sourceRows: [{ id: 1, balance: 1000 }],
  targetRows: [{ id: 1, balance: 1000.0 }],
  sourceTypes: { id: 'INTEGER', balance: 'INTEGER' },
});
assert(fmtOk.length === 0, 'Does not flag legitimate numeric differences as format issues');

console.log('\n[Test 19] Demo Mode still works');
const demo = new ValidationOrchestrator().runValidation({
  sourceTables: getSourceDemoData().tables,
  targetTables: getTargetDemoData().tables,
  sourceRows: getSourceDemoData().rows,
  targetRows: getTargetDemoData().rows,
  options: {
    schemaValidation: true,
    rowCountValidation: true,
    recordValidation: true,
    duplicateDetection: true,
    nullValidation: true,
    referentialIntegrity: true,
    aggregateValidation: true,
  },
  sourceDbName: 'source_demo',
  targetDbName: 'target_demo',
  isDemo: true,
});
assert(demo.isDemo === true, 'Demo run is marked isDemo');
assert(demo.issues.some((i) => i.check_type === 'MISSING_TARGET' && i.primary_key === '103'), 'Demo still detects missing customer 103');
assert(demo.issues.some((i) => i.check_type === 'DUPLICATE_TARGET' && i.primary_key === '102'), 'Demo still detects duplicate 102');
assert(demo.issues.some((i) => i.check_type === 'FOREIGN_KEY_VIOLATION'), 'Demo still detects orphan foreign key');

console.log('\n[Test 20] Database / DataSource abstraction still works');
const demoSource = createDataSource({ type: 'demo', database: 'source_demo' });
const extracted = await demoSource.extract();
assert(extracted.kind === 'demo' && extracted.tables.length === 3, 'Demo DataSource still extracts banking tables');
const conn = await DbConnector.testConnection({ type: 'demo', database: 'source_demo' });
assert(conn.success === true, 'Existing database test endpoint still succeeds for demo connections');

const remapped = applyColumnMappings([{ id: 101, account_balance: 5 }], [{ sourceColumn: 'balance', targetColumn: 'account_balance' }]);
assert(remapped[0].balance === 5, 'applyColumnMappings rewrites target keys to source names');

const schema = parsedCsvToSchema(valid, 'people', 'id');
assert(schema.primaryKeys?.[0] === 'id', 'CSV schema uses the user-selected primary key');

console.log('\n---------------------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('---------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All DataGuard custom-data tests PASSED successfully!\n');
}
