import pg from 'pg';
import mysql from 'mysql2/promise';
import { DatabaseConnectionConfig, DiscoveredTable } from '../../src/types.js';
import { TableSchema } from '../validators/schemaValidator.js';
import { getSourceDemoData, getTargetDemoData } from './demoDatabase.js';

const { Client: PgClient } = pg;

export class DbConnector {
  static async testConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; message: string; tables: DiscoveredTable[] }> {
    if (config.type === 'demo') {
      const demoData = config.database === 'target_demo' ? getTargetDemoData() : getSourceDemoData();
      const discovered: DiscoveredTable[] = demoData.tables.map((t) => ({
        name: t.name,
        inSource: true,
        inTarget: true,
        status: 'MATCH',
        sourceColumnsCount: t.columns.length,
        targetColumnsCount: t.columns.length,
        primaryKey: t.primaryKeys[0] || 'id',
      }));
      return {
        success: true,
        message: 'Successfully connected to demo in-memory relational database.',
        tables: discovered,
      };
    }

    if (config.type === 'postgresql') {
      const client = new PgClient({
        host: config.host || 'localhost',
        port: config.port || 5432,
        database: config.database,
        user: config.username,
        password: config.password,
        connectionTimeoutMillis: 5000,
      });

      try {
        await client.connect();
        const res = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `);
        await client.end();

        const tables: DiscoveredTable[] = res.rows.map((r: any) => ({
          name: r.table_name,
          inSource: true,
          inTarget: false,
          status: 'MATCH',
        }));

        return {
          success: true,
          message: `Connected successfully to PostgreSQL '${config.database}'. Discovered ${tables.length} tables.`,
          tables,
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Unable to connect to PostgreSQL: ${err.message || 'Connection timeout or invalid credentials'}`,
          tables: [],
        };
      }
    }

    if (config.type === 'mysql') {
      try {
        const connection = await mysql.createConnection({
          host: config.host || 'localhost',
          port: config.port || 3306,
          database: config.database,
          user: config.username,
          password: config.password,
          connectTimeout: 5000,
        });

        const [rows]: any = await connection.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = ? AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `, [config.database]);
        await connection.end();

        const tables: DiscoveredTable[] = (rows || []).map((r: any) => ({
          name: r.TABLE_NAME || r.table_name,
          inSource: true,
          inTarget: false,
          status: 'MATCH',
        }));

        return {
          success: true,
          message: `Connected successfully to MySQL '${config.database}'. Discovered ${tables.length} tables.`,
          tables,
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Unable to connect to MySQL: ${err.message || 'Connection timeout or invalid credentials'}`,
          tables: [],
        };
      }
    }

    return {
      success: false,
      message: `Unsupported database type: ${config.type}`,
      tables: [],
    };
  }

  static async extractDatabaseData(config: DatabaseConnectionConfig): Promise<{ tables: TableSchema[]; rows: Record<string, Record<string, any>[]> }> {
    if (config.type === 'demo') {
      return config.database === 'target_demo' ? getTargetDemoData() : getSourceDemoData();
    }

    if (config.type === 'postgresql') {
      return this.extractPostgreSql(config);
    }

    if (config.type === 'mysql') {
      return this.extractMySql(config);
    }

    throw new Error(`Unsupported database type '${config.type}'`);
  }

  private static async extractPostgreSql(config: DatabaseConnectionConfig): Promise<{ tables: TableSchema[]; rows: Record<string, Record<string, any>[]> }> {
    const client = new PgClient({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
      connectionTimeoutMillis: 8000,
    });

    await client.connect();
    try {
      // 1. Get Tables
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      const tableNames = tablesRes.rows.map((r: any) => r.table_name);

      const tableSchemas: TableSchema[] = [];
      const tableRows: Record<string, Record<string, any>[]> = {};

      for (const tName of tableNames) {
        // Columns
        const colRes = await client.query(`
          SELECT column_name, data_type, is_nullable, character_maximum_length, numeric_precision
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [tName]);

        // Primary keys
        const pkRes = await client.query(`
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = $1;
        `, [tName]);
        const primaryKeys = pkRes.rows.map((r: any) => r.column_name);

        // Foreign keys
        const fkRes = await client.query(`
          SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1;
        `, [tName]);
        const foreignKeys = fkRes.rows.map((r: any) => ({
          column: r.column_name,
          referencedTable: r.foreign_table_name,
          referencedColumn: r.foreign_column_name,
        }));

        tableSchemas.push({
          name: tName,
          columns: colRes.rows.map((c: any) => ({
            name: c.column_name,
            dataType: c.data_type,
            isNullable: c.is_nullable === 'YES',
            isPrimaryKey: primaryKeys.includes(c.column_name),
            charMaxLength: c.character_maximum_length,
            numericPrecision: c.numeric_precision,
          })),
          primaryKeys,
          foreignKeys,
        });

        // Fetch rows (safe limit for validation)
        const rowsRes = await client.query(`SELECT * FROM "${tName}" LIMIT 10000;`);
        tableRows[tName] = rowsRes.rows;
      }

      return { tables: tableSchemas, rows: tableRows };
    } finally {
      await client.end();
    }
  }

  private static async extractMySql(config: DatabaseConnectionConfig): Promise<{ tables: TableSchema[]; rows: Record<string, Record<string, any>[]> }> {
    const connection = await mysql.createConnection({
      host: config.host || 'localhost',
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password: config.password,
      connectTimeout: 8000,
    });

    try {
      const [tableRowsRes]: any = await connection.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `, [config.database]);

      const tableNames = (tableRowsRes || []).map((r: any) => r.TABLE_NAME || r.table_name);
      const tableSchemas: TableSchema[] = [];
      const tableRows: Record<string, Record<string, any>[]> = {};

      for (const tName of tableNames) {
        const [colRows]: any = await connection.query(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION
          FROM information_schema.columns
          WHERE table_schema = ? AND table_name = ?
          ORDER BY ORDINAL_POSITION;
        `, [config.database, tName]);

        const primaryKeys: string[] = [];
        const columns = (colRows || []).map((c: any) => {
          const isPk = (c.COLUMN_KEY || '').toUpperCase() === 'PRI';
          if (isPk) primaryKeys.push(c.COLUMN_NAME);
          return {
            name: c.COLUMN_NAME,
            dataType: c.DATA_TYPE,
            isNullable: (c.IS_NULLABLE || '').toUpperCase() === 'YES',
            isPrimaryKey: isPk,
            charMaxLength: c.CHARACTER_MAXIMUM_LENGTH,
            numericPrecision: c.NUMERIC_PRECISION,
          };
        });

        const [fkRows]: any = await connection.query(`
          SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL;
        `, [config.database, tName]);

        const foreignKeys = (fkRows || []).map((f: any) => ({
          column: f.COLUMN_NAME,
          referencedTable: f.REFERENCED_TABLE_NAME,
          referencedColumn: f.REFERENCED_COLUMN_NAME,
        }));

        tableSchemas.push({
          name: tName,
          columns,
          primaryKeys,
          foreignKeys,
        });

        const [dataRows]: any = await connection.query(`SELECT * FROM \`${tName}\` LIMIT 10000;`);
        tableRows[tName] = dataRows || [];
      }

      return { tables: tableSchemas, rows: tableRows };
    } finally {
      await connection.end();
    }
  }
}
