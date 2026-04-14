import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { BaseService } from './BaseService';

// Add stealth plugin
puppeteer.use(StealthPlugin());

export interface YahooSession {
    cookie: string;
    crumb: string;
    userAgent: string;
}

export class YahooSessionService extends BaseService {
    private session: YahooSession | null = null;
    private sessionPromise: Promise<YahooSession> | null = null;

    constructor() {
        super('YahooSessionService');
    }

    /**
     * Get or create a session. Caches the result.
     */
    public async getSession(): Promise<YahooSession> {
        // Return cached session
        if (this.session) {
            return this.session;
        }

        // Return pending session fetch
        if (this.sessionPromise) {
            return this.sessionPromise;
        }

        // Create new session
        this.sessionPromise = this.fetchNewSession();
        try {
            this.session = await this.sessionPromise;
            return this.session;
        } finally {
            this.sessionPromise = null;
        }
    }

    private async fetchNewSession(): Promise<YahooSession> {
        this.logger.info('Launching browser to fetch valid Yahoo Finance session...');
        let browser;

        const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

        try {
            browser = await puppeteer.launch({
                headless: "new",
                ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
                }),
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920,1080'
                ]
            });

            const page = await browser.newPage();
            await page.setUserAgent(userAgent);
            await page.setViewport({ width: 1920, height: 1080 });

            // Navigate to Yahoo Finance
            this.logger.info('Navigating to Yahoo Finance...');
            await page.goto('https://finance.yahoo.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 45000
            });

            // Wait for cookies to settle
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Get cookies
            const cookies = await page.cookies();
            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            this.logger.info(`Cookies obtained. Count: ${cookies.length}`);

            if (cookies.length === 0) {
                throw new Error('No cookies were set by Yahoo Finance');
            }

            // Fetch crumb from within the browser context
            this.logger.info('Fetching crumb...');
            const crumb = await page.evaluate(async () => {
                const response = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error(`Crumb response: ${response.status}`);
                }
                return await response.text();
            });

            if (!crumb || crumb.length === 0) {
                throw new Error('Crumb was empty or null');
            }

            this.logger.info(`Session obtained! Crumb: ${crumb.substring(0, 10)}...`);
            return { cookie: cookieString, crumb, userAgent };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get Yahoo session: ${errorMessage}`);
            throw new Error(`Yahoo session error: ${errorMessage}`);
        } finally {
            if (browser) {
                await browser.close().catch(() => { });
            }
        }
    }

    /**
     * Invalidate session (for retry logic)
     */
    public invalidateSession(): void {
        this.session = null;
    }
}
