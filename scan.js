import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const TARGET_URL = 'https://jobnetcrest.github.io';
const OUTPUT_FILE = 'cookie-database.json';
const CONCURRENCY_LIMIT = 3; // Number of pages to process at the exact same time

async function scanCookies() {
    console.log(`🕵️ Starting Scalable Multi-Page Crawler on ${TARGET_URL}...`);
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    });
    
    // Set up standard workspace context and pre-inject consent
    const seedPage = await context.newPage();
    await seedPage.goto(TARGET_URL, { waitUntil: 'commit' });
    try {
        await seedPage.evaluate(() => {
            const mockConsentPayload = {
                categories: ["necessary", "analytics", "marketing"],
                revision: 0,
                data: null,
                consentTimestamp: new Date().toISOString(),
                consentId: "ff177da1-f350-43d8-af09-b9e56758585f",
                services: { necessary: [], analytics: [], marketing: [] },
                languageCode: "en"
            };
            localStorage.setItem('cc_cookie', JSON.stringify(mockConsentPayload));
            localStorage.setItem('klaro', JSON.stringify(mockConsentPayload));
            localStorage.setItem('cookie_consent', JSON.stringify(mockConsentPayload));
        });
    } catch (e) {
        console.log("⚠️ Consent injection warning:", e.message);
    }
    await seedPage.close();

    // Tracking queues
    const visitedUrls = new Set();
    const urlsToScan = [TARGET_URL];

    // Helper worker to scan a single page and pull its links
    async function auditPage(url) {
        if (visitedUrls.has(url)) return [];
        visitedUrls.add(url);

        // Optimization: Immediately skip scraping asset footprints or broken template URLs
        const lowCaseUrl = url.toLowerCase();
        if (
            lowCaseUrl.endsWith('.docx') || 
            lowCaseUrl.endsWith('.pdf') || 
            lowCaseUrl.endsWith('.jpg') || 
            lowCaseUrl.endsWith('.jpeg') || 
            lowCaseUrl.endsWith('.png') ||
            lowCaseUrl.includes('target=')
        ) {
            return [];
        }
        
        console.log(`🚗 Auditing: ${url}`);
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        
        try {
            // Speed up tracking pixel loads by blocking large graphic binary downloads
            await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,mp4,webm}', route => route.abort());

            await page.goto(url, { waitUntil: 'networkidle' });
            
            // Wake up tracking pixels
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1500); 

            // Extract all internal links found on this subpage
            const discoveredLinks = await page.evaluate((baseUrl) => {
                return Array.from(document.querySelectorAll('a[href]'))
                    .map(a => {
                        try {
                            return new URL(a.getAttribute('href'), window.location.href).href.split('#')[0];
                        } catch {
                            return null;
                        }
                    })
                    .filter(href => href && href.startsWith(baseUrl));
            }, TARGET_URL);

            await page.close();
            return discoveredLinks;
        } catch (err) {
            console.log(`⚠️ Skipped ${url} due to error:`, err.message);
            await page.close();
            return [];
        }
    }

    // Main crawling orchestrator loop
    while (urlsToScan.length > 0) {
        // Pull a batch of URLs based on your concurrency limit
        const batch = [];
        while (urlsToScan.length > 0 && batch.length < CONCURRENCY_LIMIT) {
            const currentUrl = urlsToScan.shift();
            if (!visitedUrls.has(currentUrl)) {
                batch.push(currentUrl);
            }
        }

        if (batch.length === 0) continue;

        console.log(`⚡ Processing batch of ${batch.length} pages concurrently...`);
        // Run the batch in parallel
        const results = await Promise.all(batch.map(url => auditPage(url)));

        // Flatten results and queue up new undiscovered links
        for (const foundLinks of results) {
            for (const link of foundLinks) {
                if (!visitedUrls.has(link) && !urlsToScan.includes(link)) {
                    urlsToScan.push(link);
                }
            }
        }
    }

    console.log(`🏁 Crawl finished. Audited ${visitedUrls.size} unique pages.`);

    // 4. Capture and structure the unified cookie database
    const cookies = await context.cookies();
    await browser.close();
    
    // Dictionary mapping specific cookie patterns to compliance descriptions
    const COOKIE_DICTIONARY = {
        '_ga': 'Google Analytics persistent identifier used to distinguish unique site users.',
        '_gid': 'Google Analytics session identifier used to track daily user journey habits.',
        '_gat': 'Google Analytics throttle wrapper used to regulate high-volume tracking requests.',
        'ysc': 'YouTube tracking identifier embedded to register video player interaction history.',
        'visitor_info1_live': 'YouTube bandwidth metrics tracker used to measure stream quality across embedded frames.',
        'visitor_privacy_metadata': 'YouTube compliance tracking state used to store user privacy choices regarding embedded video playback.',
        '__secure-ynid': 'Secure security and profile preference handler managed by embedded YouTube integrations.',
        '__secure-rollout_token': 'Secure tracking token deployed by YouTube to optimize infrastructure rollouts on embedded players.',
        'nid': 'Google user profiling cookie utilized to customize advertisement delivery across integrated web structures.',
        '_cfuvid': 'Elfsight security and request validation rate-limiter managed through the Cloudflare network proxy framework.'
    };

    // Ensure ALL possible target arrays are initialized first
    const categorised = {
        necessary: [],
        analytics: [],
        preferences: [],
        marketing: []
    };

    // Track total metrics across all categories
    const counts = { necessary: 0, analytics: 0, preferences: 0, marketing: 0 };
    
    for (const c of cookies) {
        const name = c.name.toLowerCase();
        const domain = c.domain.toLowerCase();

        // Check if we have an explicit dictionary entry, otherwise use a professional fallback description
        let matchedDescription = 'Auto-detected during deployment multi-page audit loop.';
        for (const [key, desc] of Object.entries(COOKIE_DICTIONARY)) {
            if (name.includes(key)) {
                matchedDescription = desc;
                break;
            }
        }

        // 1. Establish current time context to check against expired values
        const currentUnixTimestamp = Math.floor(Date.now() / 1000);

        // 2. Validate that expires exists, is a positive number, and is not already historical
        const isValidFutureExpiry = c.expires && typeof c.expires === 'number' && c.expires > currentUnixTimestamp;

        const cookieData = {
            name: c.name,
            domain: c.domain,
            // Safely output UTC string or mark cleanly as a browser Session cookie
            expiry: isValidFutureExpiry ? new Date(c.expires * 1000).toUTCString() : 'Session',
            description: matchedDescription
        };
        
        // --- COMPLIANT ROUTING ENGINE ---

        // 1. STRICTLY NECESSARY (Infrastructure, Security, and Consent Management)
        if (
            ['_cfuvid', 'rollout_token', 'visitor_privacy_metadata'].some(x => name.includes(x)) ||
            name === 'cookie_consent' || name === 'xcookie'
        ) {
            categorised.necessary.push(cookieData);
            counts.necessary++;
        }
        
        // 2. PERFORMANCE & ANALYTICS (User Behavior Telemetry & Streaming Bitrate)
        else if (
            ['_ga', '_gid', '_gat', 'pk_', 'ysc', 'visitor_info1_live'].some(x => name.includes(x))
        ) {
            categorised.analytics.push(cookieData);
            counts.analytics++;
        }

        // 3. USER PREFERENCES (UI Customization)
        else if (
            ['__secure-ynid'].some(x => name.includes(x))
        ) {
            categorised.preferences.push(cookieData); 
            counts.preferences++;
        }
        
        // 4. MARKETING & BEHAVIORAL ADVERTISING (Cross-site profiles and pixel arrays)
        else if (
            ['nid', 'pixel', 'ads', '_fbp'].some(x => name.includes(x)) || 
            name.includes('__secure-3p')
        ) {
            categorised.marketing.push(cookieData);
            counts.marketing++;
        } 
        
        // 5. COMPLIANT FALLBACK
        else {
            categorised.necessary.push(cookieData);
            counts.necessary++;
        // Highlight unmapped cookies so you can easily update your COOKIE_DICTIONARY or routing arrays
            console.log(`⚠️  [UNCLASSIFIED COOKIE]: Found "${c.name}" on domain "${c.domain}". Routed to Necessary fallback.`);

        }
    }

        // Print summary report metrics to console
        const totalCookies = cookies.length;
        console.log(`\n📊 Cookie Discovery Audit Summary:`);
        console.log(`   Total Identified : ${totalCookies}`);
        console.log(`   🔒 Necessary    : ${counts.necessary}`);
        console.log(`   📈 Analytics    : ${counts.analytics}`);
        console.log(`   ⚙️ Preferences  : ${counts.preferences}`);
        console.log(`   🎯 Marketing    : ${counts.marketing}\n`);

      // Write final output structured storage configuration to disk
    try {
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(categorised, null, 4), 'utf-8');
        console.log(`💾 Cookie database successfully written to ${OUTPUT_FILE}`);
    } catch (writeErr) {
        console.error(`❌ Failed to write JSON output database:`, writeErr.message);
    }
}

scanCookies().catch(err => {
    console.error("❌ Critical execution crash encountered:", err);
    process.exit(1);
});
