import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const TARGET_URL = 'https://jobnetcrest.github.io';
const OUTPUT_FILE = 'cookie-database.json';

async function scanCookies() {
    console.log(`🕵️ Scanning ${TARGET_URL}...`);
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1
    });
    
    await context.clearCookies();
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // 1. Navigate to the page shell (this establishes the domain workspace context)
    await page.goto(TARGET_URL, { waitUntil: 'commit' });
    
    // 2. FORCE INJECT THE ACCEPTED COOKIE CONSENT STATE INTO LOCAL STORAGE
    try {
        console.log("💉 Pre-injecting accepted cookie consent state into LocalStorage...");
        await page.evaluate(() => {
            const mockConsentPayload = {
                categories: ["necessary", "analytics", "marketing"],
                revision: 0,
                data: null,
                consentTimestamp: new Date().toISOString(),
                consentId: "ff177da1-f350-43d8-af09-b9e56758585f",
                services: { necessary: [], analytics: [], marketing: [] },
                languageCode: "en"
            };
            
            // Populate the standard storage targets used by vanilla-cookieconsent/klaro
            localStorage.setItem('cc_cookie', JSON.stringify(mockConsentPayload));
            localStorage.setItem('klaro', JSON.stringify(mockConsentPayload));
            localStorage.setItem('cookie_consent', JSON.stringify(mockConsentPayload));
        });
    } catch (injectError) {
        console.log("⚠️ Storage injection warning:", injectError.message);
    }

    // 3. Reload the site so it evaluates the pre-approved cookie state
    console.log("🔄 Reloading site with consent active...");
    await page.reload({ waitUntil: 'networkidle' });
    
    // Give tracking pixels time to trigger and drop their assets
    await page.waitForTimeout(6000); 
    
    // 4. Force a scrolling motion to wake up tracking scripts
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000); 

    // 5. Catch and log the resulting cookies array
    const cookies = await context.cookies();
    await browser.close();
    
    console.log(`📋 Total Unfiltered Browser Cookies Found: ${cookies.length}`);
    if (cookies.length > 0) {
        console.log("🍪 Raw Cookie Names Found:", cookies.map(c => c.name));
    }
    
    const categorised = { necessary: [], analytics: [], marketing: [] };
    
    for (const c of cookies) {
        const cookieData = {
            name: c.name,
            domain: c.domain,
            expiry: c.expires ? new Date(c.expires * 1000).toUTCString() : 'Session',
            description: 'Auto-detected during deployment audit.'
        };
        
        const name = c.name.toLowerCase();
        if (['_ga', '_gid', '_gat', 'pk_'].some(x => name.includes(x))) {
            categorised.analytics.push(cookieData);
        } else if (['_fbp', 'ads', 'fbsr', 'uuid', 'pixel'].some(x => name.includes(x))) {
            categorised.marketing.push(cookieData);
        } else {
            categorised.necessary.push(cookieData);
        }
    }

    console.log(`📊 Scanned Raw Count: ${cookies.length} cookies found.`);
    console.log(`   └─ Necessary: ${categorised.necessary.length} | Analytics: ${categorised.analytics.length} | Marketing: ${categorised.marketing.length}`);

    const dir = path.dirname(OUTPUT_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(categorised, null, 2), 'utf8');
    console.log(`💾 Fresh audit database deployed to ${OUTPUT_FILE}!`);
}

scanCookies().catch(err => {
    console.error('❌ Scan failed:', err);
    process.exit(1);
});
