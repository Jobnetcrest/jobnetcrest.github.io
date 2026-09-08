import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

// Configuration
const TARGET_URL = 'https://jobnetcrest.github.io';
const OUTPUT_FILE = './public/cookie-database.json';

async function scanCookies() {
    console.log(`🕵️ Scanning ${TARGET_URL}...`);
    
    // Launch headless browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate and wait until network requests settle down
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    
    // Simulate user behavior (scroll to trigger lazy-loaded trackers/pixels)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 3000)); 

    // Retrieve all cookies dropped into the browser session
    const cookies = await context.cookies();
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
    
    // Ensure target folder exists and write JSON asynchronously
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(categorised, null, 2));
    console.log(`💾 Fresh audit database deployed to ${OUTPUT_FILE}!`);
}

scanCookies().catch(err => {
    console.error('❌ Scan failed:', err);
    process.exit(1);
});
