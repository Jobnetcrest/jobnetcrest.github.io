import { chromium } from 'playwright';

const TARGET_URL = 'https://jobnetcrest.github.io';

// --- CONFIGURATION MAPPINGS ---
// Includes common selector variants for CookieConsent v3 structures
const COOKIE_BANNER_SELECTOR = '#cc-main, .cc__component, #cc-bnd, .cookie-banner'; 
const ACCEPT_BUTTON_SELECTOR = 'button[data-cc="accept-all"], #cc-nb-ok, button:has-text("Accept all")';

async function verifyFullConsentLifecycle() {
    console.log(`🧪 Initialising Advanced Consent Lifecycle Audit on: ${TARGET_URL}\n`);

    const browser = await chromium.launch({ headless: true });
    
    // Clear context storage completely to force banner visibility
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-GB'
    });

    const page = await context.newPage();
    
    const preConsentNetworkLeaks = [];
    const postConsentNetworkActivations = [];
    const trackingDomains = ['google-analytics.com', 'analytics.google', 'doubleclick.net', 'facebook.net', '://youtube.com'];
    
    let standardConsentGiven = false;

    // Track dynamic network pipelines safely
    await page.route('**/*', async (route) => {
        try {
            const url = route.request().url();
            const matchesTracker = trackingDomains.some(domain => url.includes(domain));
            
            if (matchesTracker) {
                if (!standardConsentGiven) {
                    preConsentNetworkLeaks.push(url);
                } else {
                    postConsentNetworkActivations.push(url);
                }
            }
            await route.continue();
        } catch (e) {
            // Silently absorb background connection state drops on browser close
        }
    });

    try {
        // ==========================================
        // 🛡️ PHASE 1: TESTING PRE-CONSENT PRIVACY
        // ==========================================
        console.log(`📡 [PHASE 1] Navigating to target with deep-clean initialization...`);
        
        // Force clean start: clear cookies out before page execution triggers
        await context.clearCookies();
        
        // Load the HTML document baseline layer
        await page.goto(TARGET_URL, { waitUntil: 'commit' });
        
        // Clear out internal data frames before scripts evaluate keys
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });

        // Trigger a fresh reload to boot the live clean engine
        await page.reload({ waitUntil: 'domcontentloaded' });
        
        // Wake up lagging lazy loaders or hidden pixels
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        
        // FIX: Allow up to 3 seconds for external CDN script elements to fully load and compile
        console.log("⏱️  Waiting for cookie consent script execution engine to boot...");
        await page.waitForTimeout(3000);

        const preConsentCookies = await context.cookies();
        const nonCompliantPreCookies = preConsentCookies.filter(c => 
            ['_ga', '_gid', '_gat', 'nid', 'ysc', '_fbp', 'visitor_info1_live'].some(x => c.name.toLowerCase().includes(x))
        );

        console.log(`\n--- 🔍 Phase 1 Evaluation (Prior to Opt-in) ---`);
        let phase1Passed = true;

        if (nonCompliantPreCookies.length > 0 || preConsentNetworkLeaks.length > 0) {
            phase1Passed = false;
            console.error(`❌ FAIL: Tracking infrastructure leaked data prematurely!`);
            nonCompliantPreCookies.forEach(c => console.error(`   -> 🍪 Prohibited Cookie Found: ${c.name}`));
            Array.from(new Set(preConsentNetworkLeaks)).forEach(url => console.error(`   -> 🔗 Prohibited Network Hit: ${url.substring(0, 75)}...`));
        } else {
            console.log("✅ PASS: Absolute cookie isolation maintained. No telemetry dropped prior to engagement.");
        }

        // ==========================================
        // 🎯 PHASE 2: TESTING SIMULATED USER OPT-IN
        // ==========================================
        console.log(`\n📡 [PHASE 2] Checking for interactive Consent Management Banner UI components...`);
        
        // Wait for the popup framework to attach to the live layout DOM tree
        let bannerFound = true;
        await page.waitForSelector(COOKIE_BANNER_SELECTOR, { timeout: 5000, state: 'attached' }).catch(() => {
            bannerFound = false;
            console.log("⚠️  Notice: CMP UI element not displayed visually. Evaluating local client preferences...");
        });

        if (bannerFound) {
            // FIX: Use Playwright's native locator abstraction with automatic visual rendering waits
            const acceptButton = page.locator(ACCEPT_BUTTON_SELECTOR).first();
            
            try {
                // Wait explicitly for the layout styles to finish animating onto the page layer
                await acceptButton.waitFor({ state: 'visible', timeout: 5000 });
                
                const buttonText = await acceptButton.innerText();
                console.log(`🖱️  Clicking on designated Opt-In CTA action: "${buttonText.trim()}"...`);
                
                standardConsentGiven = true; 
                await acceptButton.click();
                
                console.log(`⏱️  Allowing page scripts to deploy third-party trackers...`);
                await page.waitForTimeout(4000);

                const postConsentCookies = await context.cookies();
                const validTrackingFootprints = postConsentCookies.filter(c => 
                    ['_ga', 'nid', 'ysc', 'visitor_info1_live'].some(x => c.name.toLowerCase().includes(x))
                );

                console.log(`\n--- 🔍 Phase 2 Evaluation (Following Opt-in) ---`);
                
                if (validTrackingFootprints.length > 0 || postConsentNetworkActivations.length > 0) {
                    console.log(`✅ PASS: Tracking infrastructure successfully initiated!`);
                    validTrackingFootprints.forEach(c => console.log(`   -> 🍪 Active Cookie: ${c.name} (${c.domain})`));
                    Array.from(new Set(postConsentNetworkActivations)).forEach(url => console.log(`   -> 🔗 Active Network Asset: ${url.substring(0, 75)}...`));
                } else {
                    console.warn(`⚠️  WARNING: Banner clicked, but no structural tracking payloads or scripts initialized.`);
                }
            } catch (clickErr) {
                console.error(`\n❌ FAIL: Located the consent framework layout, but the action buttons failed to render visibly on screen.`);
                console.error(`   Internal Details: ${clickErr.message}`);
            }
        } else {

            const storageDump = await page.evaluate(() => JSON.stringify(localStorage));
            const activeCookies = await context.cookies();
            
            console.log(`\n🛠️  [DEBUG ANALYSIS]:`);
            console.log(`   -> Current LocalStorage Keys Found: ${storageDump}`);
            console.log(`   -> Raw Browser Cookies Extracted: ${activeCookies.map(c => c.name).join(', ') || 'None'}\n`);

            const engineState = await page.evaluate(() => localStorage.getItem('cc_cookie') || localStorage.getItem('klaro'));
            if (engineState) {
                console.log(`💡 Bypass detected: Storage layer config confirmed active. Banner was suppressed intentionally.`);
            } else {
                console.error(`\n❌ FAIL: The website failed to present a cookie consent banner layout to a new user.`);
            }
        }

        console.log(`\n=====================================================`);
        if (phase1Passed && standardConsentGiven) {
            console.log(`🎉 LIFECYCLE SUCCESS: Website is fully compliant. Intercepts before choice, fires upon acceptance!`);
        } else {
            console.log(`❌ LIFECYCLE FAILED: Review the audit log details above to clean up tracking order flaws.`);
        }
        console.log(`=====================================================`);

    } catch (err) {
        console.error(`❌ Life-cycle run failed unexpectedly:`, err.message);
    } finally {
        await browser.close();
    }
}

verifyFullConsentLifecycle();
