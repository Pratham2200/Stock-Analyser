"use strict";
// src/repositories/PortfolioRepository.ts - Portfolio data repository
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
class PortfolioRepository extends BaseRepository_1.BaseRepository {
    constructor(pool) {
        super(pool, 'PortfolioRepository');
    }
    async getPortfolioSummary() {
        const text = `
      SELECT 
        COUNT(*) as total_positions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_positions,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_positions,
        SUM(CASE WHEN status = 'active' THEN quantity * current_price ELSE 0 END) as total_value,
        SUM(CASE WHEN status = 'active' THEN quantity * (current_price - entry_price) ELSE 0 END) as unrealized_pnl,
        SUM(CASE WHEN status = 'closed' THEN quantity * (current_price - entry_price) ELSE 0 END) as realized_pnl
      FROM portfolio_positions
    `;
        const result = await this.query(text);
        return result.rows[0] || {
            total_positions: 0,
            active_positions: 0,
            closed_positions: 0,
            total_value: 0,
            unrealized_pnl: 0,
            realized_pnl: 0
        };
    }
    async getPortfolioPerformance() {
        const text = `
      SELECT 
        symbol,
        name,
        entry_price,
        current_price,
        quantity,
        (current_price - entry_price) as price_change,
        ((current_price - entry_price) / entry_price * 100) as price_change_percent,
        quantity * (current_price - entry_price) as pnl,
        status,
        created_at,
        updated_at
      FROM portfolio_positions
      ORDER BY created_at DESC
    `;
        const result = await this.query(text);
        return result.rows;
    }
}
exports.PortfolioRepository = PortfolioRepository;
//# sourceMappingURL=PortfolioRepository.js.map