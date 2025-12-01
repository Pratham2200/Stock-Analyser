"use strict";
// src/repositories/BaseRepository.ts - Base repository class
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const BaseService_1 = require("../services/BaseService");
class BaseRepository extends BaseService_1.BaseService {
    constructor(pool, repositoryName) {
        super(repositoryName);
        this.pool = pool;
    }
    async query(text, params = [], options = {}) {
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
            }
            finally {
                client.release();
            }
        }, retries, retryDelay);
    }
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    buildInsertQuery(table, data, returning = ['*']) {
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
    buildUpdateQuery(table, data, where, returning = ['*']) {
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
    buildSelectQuery(table, columns = ['*'], where, orderBy, limit, offset) {
        let text = `SELECT ${columns.join(', ')} FROM ${table}`;
        const values = [];
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
    async exists(table, where) {
        const { text, values } = this.buildSelectQuery(table, ['1'], where, undefined, 1);
        const result = await this.query(text, values);
        return result.rows.length > 0;
    }
    async count(table, where) {
        const { text, values } = this.buildSelectQuery(table, ['COUNT(*) as count'], where);
        const result = await this.query(text, values);
        return parseInt(result.rows[0].count);
    }
    sanitizeTableName(name) {
        return name.replace(/[^a-zA-Z0-9_]/g, '');
    }
    sanitizeColumnName(name) {
        return name.replace(/[^a-zA-Z0-9_]/g, '');
    }
}
exports.BaseRepository = BaseRepository;
//# sourceMappingURL=BaseRepository.js.map