import { Pool, PoolClient } from 'pg';
import { BaseService } from '../services/BaseService';
import { DatabaseQueryResult, QueryOptions } from '../types/database';
export declare abstract class BaseRepository extends BaseService {
    protected pool: Pool;
    constructor(pool: Pool, repositoryName: string);
    protected query<T = any>(text: string, params?: any[], options?: QueryOptions): Promise<DatabaseQueryResult<T>>;
    protected transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    protected buildInsertQuery(table: string, data: Record<string, any>, returning?: string[]): {
        text: string;
        values: any[];
    };
    protected buildUpdateQuery(table: string, data: Record<string, any>, where: Record<string, any>, returning?: string[]): {
        text: string;
        values: any[];
    };
    protected buildSelectQuery(table: string, columns?: string[], where?: Record<string, any>, orderBy?: string, limit?: number, offset?: number): {
        text: string;
        values: any[];
    };
    protected exists(table: string, where: Record<string, any>): Promise<boolean>;
    protected count(table: string, where?: Record<string, any>): Promise<number>;
    protected sanitizeTableName(name: string): string;
    protected sanitizeColumnName(name: string): string;
}
//# sourceMappingURL=BaseRepository.d.ts.map