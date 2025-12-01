import { BaseService } from './BaseService';
import { ScraperResult } from '../types';
export declare class ScraperService extends BaseService {
    private readonly CHARTINK_URL;
    constructor();
    scrapeAllStocks(): Promise<ScraperResult>;
    private launchBrowser;
    private setupPage;
    private navigateToUrl;
    private getTotalStockCount;
    private extractAllStocks;
    private extractPageStocks;
    private navigateToNextPage;
}
//# sourceMappingURL=ScraperService.d.ts.map