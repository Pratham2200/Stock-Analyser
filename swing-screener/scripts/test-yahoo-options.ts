import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function fetchNiftyOptions() {
    console.log('Fetching Nifty 22800CE options data via Yahoo Finance API...\n');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        console.log('1. Establishing Yahoo Finance session...');
        await page.goto('https://finance.yahoo.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));
        console.log('   Session established.\n');

        // Test 1: ^NSEI options
        console.log('2. Fetching ^NSEI (Nifty 50) options...');
        const niftyResult = await page.evaluate(async () => {
            try {
                const crumbResp = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { credentials: 'include' });
                const crumb = await crumbResp.text();
                
                const resp = await fetch(
                    `https://query1.finance.yahoo.com/v7/finance/options/%5ENSEI?crumb=${crumb}`,
                    { credentials: 'include', headers: { 'Accept': 'application/json' } }
                );
                
                if (!resp.ok) return { error: `HTTP ${resp.status}`, status: resp.status };
                return { data: await resp.json(), status: resp.status };
            } catch (e: any) {
                return { error: e.message, status: 0 };
            }
        });

        if (niftyResult.error) {
            console.log(`   ^NSEI options: FAILED (${niftyResult.error})`);
            console.log('   Yahoo Finance does NOT serve options chains for Indian indices.\n');
        } else {
            const optData = niftyResult.data?.optionChain?.result?.[0];
            if (optData) {
                console.log(`   ^NSEI options: SUCCESS`);
                console.log(`   Underlying: ${optData.underlyingSymbol}`);
                console.log(`   Price: ${optData.quote?.regularMarketPrice}`);
                console.log(`   Expiry dates: ${optData.expirationDates?.length}`);
                
                const chain = optData.options?.[0];
                if (chain) {
                    const target = chain.calls?.find((c: any) => c.strike === 22800);
                    if (target) {
                        console.log(`\n   === NIFTY 22800 CE ===`);
                        console.log(`   Strike: ${target.strike}`);
                        console.log(`   Last Price: ${target.lastPrice}`);
                        console.log(`   Bid: ${target.bid}`);
                        console.log(`   Ask: ${target.ask}`);
                        console.log(`   Volume: ${target.volume}`);
                        console.log(`   Open Interest: ${target.openInterest}`);
                        console.log(`   Implied Volatility: ${(target.impliedVolatility * 100).toFixed(2)}%`);
                    } else {
                        console.log(`   22800 strike not found. Available strikes (sample): ${chain.calls?.slice(0, 5).map((c: any) => c.strike).join(', ')}`);
                    }
                }
            } else {
                console.log('   ^NSEI: No option chain data in response.');
            }
        }

        // Test 2: NIFTY (NSE ticker with .NS suffix)
        console.log('\n3. Trying alternate symbol NIFTY_50.NS...');
        const niftyNSResult = await page.evaluate(async () => {
            try {
                const crumbResp = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { credentials: 'include' });
                const crumb = await crumbResp.text();

                const resp = await fetch(
                    `https://query1.finance.yahoo.com/v7/finance/options/%5ENSEI?crumb=${crumb}&straddle=true`,
                    { credentials: 'include', headers: { 'Accept': 'application/json' } }
                );

                if (!resp.ok) return { error: `HTTP ${resp.status}`, status: resp.status };
                return { data: await resp.json(), status: resp.status };
            } catch (e: any) {
                return { error: e.message, status: 0 };
            }
        });

        if (niftyNSResult.error) {
            console.log(`   NIFTY_50.NS straddle: FAILED (${niftyNSResult.error})`);
        } else {
            const straddles = niftyNSResult.data?.optionChain?.result?.[0]?.options?.[0]?.straddles;
            if (straddles && straddles.length > 0) {
                console.log(`   Straddle data found: ${straddles.length} entries`);
            } else {
                console.log(`   No straddle data available.`);
            }
        }

        // Test 3: A known US equity with options (AAPL for comparison)
        console.log('\n4. Fetching AAPL options (for comparison)...');
        const aaplResult = await page.evaluate(async () => {
            try {
                const crumbResp = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { credentials: 'include' });
                const crumb = await crumbResp.text();

                const resp = await fetch(
                    `https://query1.finance.yahoo.com/v7/finance/options/AAPL?crumb=${crumb}`,
                    { credentials: 'include', headers: { 'Accept': 'application/json' } }
                );

                if (!resp.ok) return { error: `HTTP ${resp.status}`, status: resp.status };
                return { data: await resp.json(), status: resp.status };
            } catch (e: any) {
                return { error: e.message, status: 0 };
            }
        });

        if (aaplResult.error) {
            console.log(`   AAPL options: FAILED (${aaplResult.error})`);
        } else {
            const optData = aaplResult.data?.optionChain?.result?.[0];
            if (optData) {
                console.log(`   AAPL options: SUCCESS`);
                console.log(`   Expiry dates: ${optData.expirationDates?.length}`);
                console.log(`   Calls loaded: ${optData.options?.[0]?.calls?.length || 0}`);
                console.log(`   Puts loaded: ${optData.options?.[0]?.puts?.length || 0}`);
            }
        }

        console.log('\n=== SUMMARY ===');
        console.log(`^NSEI (Nifty 50): ${niftyResult.error ? '❌ NOT AVAILABLE' : '✅ AVAILABLE'}`);
        console.log(`AAPL (US equity): ${aaplResult.error ? '❌ NOT AVAILABLE' : '✅ AVAILABLE'}`);

    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        if (browser) await browser.close();
    }
}

fetchNiftyOptions().then(() => process.exit(0));
