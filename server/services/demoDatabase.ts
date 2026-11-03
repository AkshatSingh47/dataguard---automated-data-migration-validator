import { TableSchema } from '../validators/schemaValidator.js';

export interface DemoDatabaseData {
  tables: TableSchema[];
  rows: Record<string, Record<string, any>[]>;
}

export function getSourceDemoData(): DemoDatabaseData {
  return {
    tables: [
      {
        name: 'customers',
        columns: [
          { name: 'customer_id', dataType: 'INTEGER', isNullable: false, isPrimaryKey: true },
          { name: 'name', dataType: 'VARCHAR(100)', isNullable: false },
          { name: 'email', dataType: 'VARCHAR(150)', isNullable: false },
          { name: 'city', dataType: 'VARCHAR(80)', isNullable: true },
        ],
        primaryKeys: ['customer_id'],
        foreignKeys: [],
      },
      {
        name: 'accounts',
        columns: [
          { name: 'account_id', dataType: 'VARCHAR(20)', isNullable: false, isPrimaryKey: true },
          { name: 'customer_id', dataType: 'INTEGER', isNullable: false },
          { name: 'balance', dataType: 'NUMERIC(14,2)', isNullable: false },
          { name: 'status', dataType: 'VARCHAR(20)', isNullable: false },
        ],
        primaryKeys: ['account_id'],
        foreignKeys: [
          { column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' },
        ],
      },
      {
        name: 'transactions',
        columns: [
          { name: 'transaction_id', dataType: 'VARCHAR(20)', isNullable: false, isPrimaryKey: true },
          { name: 'account_id', dataType: 'VARCHAR(20)', isNullable: false },
          { name: 'amount', dataType: 'NUMERIC(14,2)', isNullable: false },
          { name: 'transaction_type', dataType: 'VARCHAR(20)', isNullable: false },
        ],
        primaryKeys: ['transaction_id'],
        foreignKeys: [
          { column: 'account_id', referencedTable: 'accounts', referencedColumn: 'account_id' },
        ],
      },
    ],
    rows: {
      customers: [
        { customer_id: 101, name: 'Rahul Sharma', email: 'rahul@gmail.com', city: 'Chennai' },
        { customer_id: 102, name: 'Priya Patel', email: 'priya@gmail.com', city: 'Mumbai' },
        { customer_id: 103, name: 'Arjun Verma', email: 'arjun@gmail.com', city: 'Delhi' },
        { customer_id: 104, name: 'Sneha Rao', email: 'sneha@gmail.com', city: 'Bangalore' },
      ],
      accounts: [
        { account_id: 'A001', customer_id: 101, balance: 50000, status: 'ACTIVE' },
        { account_id: 'A002', customer_id: 102, balance: 75000, status: 'ACTIVE' },
        { account_id: 'A003', customer_id: 103, balance: 30000, status: 'ACTIVE' },
      ],
      transactions: [
        { transaction_id: 'T001', account_id: 'A001', amount: 10000, transaction_type: 'CREDIT' },
        { transaction_id: 'T002', account_id: 'A001', amount: 5000, transaction_type: 'DEBIT' },
        { transaction_id: 'T003', account_id: 'A002', amount: 15000, transaction_type: 'CREDIT' },
      ],
    },
  };
}

export function getTargetDemoData(): DemoDatabaseData {
  return {
    tables: [
      {
        name: 'customers',
        columns: [
          { name: 'customer_id', dataType: 'INTEGER', isNullable: false, isPrimaryKey: true },
          { name: 'name', dataType: 'VARCHAR(100)', isNullable: false },
          { name: 'email', dataType: 'VARCHAR(150)', isNullable: true }, // Intentionally made nullable
          { name: 'city', dataType: 'VARCHAR(80)', isNullable: true },
        ],
        primaryKeys: ['customer_id'],
        foreignKeys: [],
      },
      {
        name: 'accounts',
        columns: [
          { name: 'account_id', dataType: 'VARCHAR(20)', isNullable: false, isPrimaryKey: true },
          { name: 'customer_id', dataType: 'INTEGER', isNullable: false },
          { name: 'balance', dataType: 'INTEGER', isNullable: false }, // Intentionally data type mismatch (INTEGER vs NUMERIC)
          { name: 'status', dataType: 'VARCHAR(20)', isNullable: false },
        ],
        primaryKeys: ['account_id'],
        foreignKeys: [
          { column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' },
        ],
      },
      {
        name: 'transactions',
        columns: [
          { name: 'transaction_id', dataType: 'VARCHAR(20)', isNullable: false, isPrimaryKey: true },
          { name: 'account_id', dataType: 'VARCHAR(20)', isNullable: false },
          { name: 'amount', dataType: 'NUMERIC(14,2)', isNullable: false },
          { name: 'transaction_type', dataType: 'VARCHAR(20)', isNullable: false },
        ],
        primaryKeys: ['transaction_id'],
        foreignKeys: [
          { column: 'account_id', referencedTable: 'accounts', referencedColumn: 'account_id' },
        ],
      },
    ],
    rows: {
      customers: [
        { customer_id: 101, name: 'Rahul Sharma', email: 'rahul@gmail.com', city: 'Chennai' },
        // Intentionally duplicate 102
        { customer_id: 102, name: 'Priya Patel', email: null, city: 'Mumbai' }, // Intentionally NULL email
        { customer_id: 102, name: 'Priya Patel', email: null, city: 'Mumbai' }, // Duplicate primary key
        // Customer 103 (Arjun) intentionally missing!
        { customer_id: 104, name: 'Sneha Rao', email: 'sneha@gmail.com', city: 'Bangalore' },
        // Customer 105 intentionally extra in target!
        { customer_id: 105, name: 'Rohan Deshmukh', email: 'rohan@gmail.com', city: 'Hyderabad' },
      ],
      accounts: [
        // Intentionally balance is 5000 instead of 50000 (VALUE_MISMATCH)
        { account_id: 'A001', customer_id: 101, balance: 5000, status: 'ACTIVE' },
        { account_id: 'A002', customer_id: 102, balance: 75000, status: 'ACTIVE' },
        { account_id: 'A003', customer_id: 103, balance: 30000, status: 'ACTIVE' },
      ],
      transactions: [
        // Intentionally amount is 9000 instead of 10000 (creates aggregate disparity)
        { transaction_id: 'T001', account_id: 'A001', amount: 9000, transaction_type: 'CREDIT' },
        { transaction_id: 'T002', account_id: 'A001', amount: 5000, transaction_type: 'DEBIT' },
        { transaction_id: 'T003', account_id: 'A002', amount: 15000, transaction_type: 'CREDIT' },
        // Intentionally orphaned transaction referencing non-existent account A999 (FK violation)
        { transaction_id: 'T004', account_id: 'A999', amount: 2500, transaction_type: 'DEBIT' },
      ],
    },
  };
}
