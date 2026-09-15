import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

// Configuration
const TARGET_URL = 'https://jobnetcrest.github.io';
const OUTPUT_FILE = 'cookie-database.json';

async function scanCookies() {
    console.log(`🕵️ Scanning ${TARGET_URL}...`);
    
    // Launch headless browser
 //   const browser = await chromium.launch({ headless: true });
 //   const context = await browser.newContext();
 //   const page = await context.newPage();

    // Launch headless browser with realistic desktop metrics
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1
    });
    const page = await context.newPage();


    // Set a strict 30-second timeout to prevent the GitHub action from hanging forever
    page.setDefaultTimeout(30000);
    
    // Navigate and wait until network requests settle down
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    
    // Simulate user behavior (scroll to trigger lazy-loaded trackers/pixels)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 3000)); 

    // Retrieve all cookies dropped into the browser session
    const cookies = await context.cookies();
    // Add this line temporarily to verify that Git detects changes

    // added  Force a Fake Cookie to Test the Workflow Pipeline
    cookies.push({ name: '_ga_TEST_COOKIE', domain: '.github.io', expires: Math.floor(Date.now() / 1000) + 3600 });

    await browser.close();
    
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
    
    // Ensure target folder exists and write JSON using async fs/promises
    const dir = path.dirname(OUTPUT_FILE);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(categorised, null, 2), 'utf8');
    console.log(`💾 Fresh audit database deployed to ${OUTPUT_FILE}!`);
}
// Print Visual Progress to Workflow Logs
console.log(`📊 Scanned Raw Count: ${cookies.length} cookies found.`);
console.log(`   └─ Necessary: ${categorised.necessary.length} | Analytics: ${categorised.analytics.length} | Marketing: ${categorised.marketing.length}`);

scanCookies().catch(err => {
    console.error('❌ Scan failed:', err);
    process.exit(1);
});

