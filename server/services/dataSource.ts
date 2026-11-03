import { DatabaseConnectionConfig } from '../../src/types.js';
import { TableSchema } from '../validators/schemaValidator.js';
import { DbConnector } from './dbConnector.js';
import { getSourceDemoData, getTargetDemoData } from './demoDatabase.js';

export type DataSourceKind = 'demo' | 'csv' | 'database';

export interface ExtractedDataset {
  tables: TableSchema[];
  rows: Record<string, Record<string, any>[]>;
  displayName: string;
  kind: DataSourceKind;
}

export interface DataSource {
  readonly kind: DataSourceKind;
  extract(): Promise<ExtractedDataset>;
}

export class DemoDataSource implements DataSource {
  readonly kind = 'demo' as const;

  constructor(private side: 'source' | 'target') {}

  async extract(): Promise<ExtractedDataset> {
    const data = this.side === 'target' ? getTargetDemoData() : getSourceDemoData();
    return {
      tables: data.tables,
      rows: data.rows,
      displayName: this.side === 'target' ? 'target_demo' : 'source_demo',
      kind: 'demo',
    };
  }
}

export class DatabaseDataSource implements DataSource {
  readonly kind = 'database' as const;

  constructor(private config: DatabaseConnectionConfig) {}

  async extract(): Promise<ExtractedDataset> {
    const data = await DbConnector.extractDatabaseData(this.config);
    return {
      tables: data.tables,
      rows: data.rows,
      displayName: this.config.database || 'database',
      kind: 'database',
    };
  }
}

export class CsvDataSource implements DataSource {
  readonly kind = 'csv' as const;

  constructor(private dataset: Omit<ExtractedDataset, 'kind'>) {}

  async extract(): Promise<ExtractedDataset> {
    return { ...this.dataset, kind: 'csv' };
  }
}

export function createDataSource(config: DatabaseConnectionConfig): DataSource {
  if (config.type === 'demo') {
    return new DemoDataSource(config.database === 'target_demo' ? 'target' : 'source');
  }
  return new DatabaseDataSource(config);
}
