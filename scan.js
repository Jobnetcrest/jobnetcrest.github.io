import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

// Configuration
const TARGET_URL = 'https://jobnetcrest.github.io';
const OUTPUT_FILE = 'cookie-database.json';

async function scanCookies() {
    console.log(`🕵️ Scanning ${TARGET_URL}...`);
    
    const browser = await chromium.launch({ headless: true });
    
    // Clear out standard context constraints to isolate the run completely
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1
    });
    
    // Explicitly wipe the browser state clean to prevent shared cookie pollution
    await context.clearCookies();
    const page = await context.newPage();

    // Give the network elements up to 45 seconds to settle on virtual environments
    page.setDefaultTimeout(45000);

    // 1. Navigate to target URL
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    
    // 2. Wait explicitly for the CookieConsent banner to render
    try {
        const consentButton = page.locator([
            'button[data-cc="accept-all"]',
            'button:has-text("Accept All")',
            'button:has-text("Accept all")',
            'button:has-text("Allow All")',
            'button:has-text("Allow all cookies")',
            '#consent-accept'
        ].join(', ')).first();

        console.log("⏳ Waiting for cookie banner to render...");
        
        // Extended safety margin for CI server latency
        await consentButton.waitFor({ state: 'visible', timeout: 15000 });
        
        console.log("👆 Cookie consent banner detected. Clicking 'Accept all'...");
        await consentButton.click();
        
        // Give external tracking scripts time to execute and write cookies
        await page.waitForTimeout(5000); 
    } catch (consentError) {
        console.log("ℹ️ No cookie banner appeared within 15 seconds. Proceeding with backup evaluation...");

        // 🚨 NEW LOGGING TOOL: Print out the first 1000 characters of the live DOM
        const bodyHTML = await page.evaluate(() => document.body.innerHTML);
        console.log("📝 --- LIVE WORKSPACE RUNNER SNAPSHOT ---");
        console.log(bodyHTML.substring(0, 1000)); 
        console.log("📝 ---------------------------------------");
    }
    
    // 3. Force scroll interaction to trigger tracking scripts
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000); 

    // 4. Retrieve all cookies dropped into the browser session
    const cookies = await context.cookies();
    await browser.close();
    
    // Print out raw data before classification to ensure nothing gets filtered out
    console.log(`📋 Total Unfiltered Browser Cookies Found: ${cookies.length}`);
    if (cookies.length > 0) {
        console.log("🍪 Raw Cookie Names Found:", cookies.map(c => c.name));
    }
    
    // Categorisation bucket structure
    const categorised = { necessary: [], analytics: [], marketing: [] };
    
    for (const c of cookies) {
        const cookieData = {
            name: c.name,
            domain: c.domain,
            expiry: c.expires ? new Date(c.expires * 1000).toUTCString() : 'Session',
            description: 'Auto-detected during deployment audit.'
        };
        
        const name = c.name.toLowerCase();
        
        // Rule-based classification mapping
        if (['_ga', '_gid', '_gat', 'pk_'].some(x => name.includes(x))) {
            categorised.analytics.push(cookieData);
        } else if (['_fbp', 'ads', 'fbsr', 'uuid', 'pixel'].some(x => name.includes(x))) {
            categorised.marketing.push(cookieData);
        } else {
            categorised.necessary.push(cookieData);
        }
    }

    // Print Visual Progress to Workflow Logs
    console.log(`📊 Scanned Raw Count: ${cookies.length} cookies found.`);
    console.log(`   └─ Necessary: ${categorised.necessary.length} | Analytics: ${categorised.analytics.length} | Marketing: ${categorised.marketing.length}`);

    // Ensure target folder exists and write JSON using async fs/promises
    const dir = path.dirname(OUTPUT_FILE);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(categorised, null, 2), 'utf8');
    console.log(`💾 Fresh audit database deployed to ${OUTPUT_FILE}!`);
}

scanCookies().catch(err => {
    console.error('❌ Scan failed:', err);
    process.exit(1);
});
