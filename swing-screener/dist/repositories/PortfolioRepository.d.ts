import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
export declare class PortfolioRepository extends BaseRepository {
    constructor(pool: Pool);
    getPortfolioSummary(): Promise<any>;
    getPortfolioPerformance(): Promise<any[]>;
}
//# sourceMappingURL=PortfolioRepository.d.ts.map