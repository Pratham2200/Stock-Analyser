// src/repositories/BaseRepository.ts - Base repository class

import { Pool, PoolClient } from 'pg';
import { BaseService } from '../services/BaseService';
import { DatabaseQueryResult, QueryOptions } from '../types/database';

export abstract class BaseRepository extends BaseService {
  protected pool: Pool;

  constructor(pool: Pool, repositoryName: string) {
    super(repositoryName);
    this.pool = pool;
  }

  protected async query<T = any>(
    text: string, 
    params: any[] = [], 
    options: QueryOptions = {}
  ): Promise<DatabaseQueryResult<T>> {
    const { retries = 3, retryDelay = 1000 } = options;
    
    return this.executeWithRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(text, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount || 0,
          command: result.command
        };
      } finally {
        client.release();
      }
    }, retries, retryDelay);
  }

  protected async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  protected buildInsertQuery(
    table: string, 
    data: Record<string, any>, 
    returning: string[] = ['*']
  ): { text: string; values: any[] } {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    
    const text = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING ${returning.join(', ')}
    `;
    
    return { text, values };
  }

  protected buildUpdateQuery(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>,
    returning: string[] = ['*']
  ): { text: string; values: any[] } {
    const updateColumns = Object.keys(data);
    const updateValues = Object.values(data);
    const whereColumns = Object.keys(where);
    const whereValues = Object.values(where);
    
    const setClause = updateColumns.map((col, index) => `${col} = $${index + 1}`).join(', ');
    const whereClause = whereColumns.map((col, index) => `${col} = $${updateColumns.length + index + 1}`).join(' AND ');
    
    const text = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING ${returning.join(', ')}
    `;
    
    return { text, values: [...updateValues, ...whereValues] };
  }

  protected buildSelectQuery(
    table: string,
    columns: string[] = ['*'],
    where?: Record<string, any>,
    orderBy?: string,
    limit?: number,
    offset?: number
  ): { text: string; values: any[] } {
    let text = `SELECT ${columns.join(', ')} FROM ${table}`;
    const values: any[] = [];
    let paramIndex = 1;

    if (where) {
      const whereClause = Object.keys(where).map(col => {
        values.push(where[col]);
        return `${col} = $${paramIndex++}`;
      }).join(' AND ');
      text += ` WHERE ${whereClause}`;
    }

    if (orderBy) {
      text += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      text += ` LIMIT ${limit}`;
    }

    if (offset) {
      text += ` OFFSET ${offset}`;
    }

    return { text, values };
  }

  protected async exists(table: string, where: Record<string, any>): Promise<boolean> {
    const { text, values } = this.buildSelectQuery(table, ['1'], where, undefined, 1);
    const result = await this.query(text, values);
    return result.rows.length > 0;
  }

  protected async count(table: string, where?: Record<string, any>): Promise<number> {
    const { text, values } = this.buildSelectQuery(table, ['COUNT(*) as count'], where);
    const result = await this.query(text, values);
    return parseInt(result.rows[0].count);
  }

  protected sanitizeTableName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '');
  }

  protected sanitizeColumnName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '');
  }
}
