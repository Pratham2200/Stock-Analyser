import { Pool } from 'pg';
import { DatabaseConfig } from '../types';
export declare function createDatabaseConnection(config: DatabaseConfig): Pool;
export declare function testConnection(pool: Pool): Promise<boolean>;
//# sourceMappingURL=connection.d.ts.map