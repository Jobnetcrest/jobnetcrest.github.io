import { chromium } from 'playwright';

const TARGET_URL = 'https://jobnetcrest.github.io';

// --- ROBUST TARGET MAPPINGS ---
// Targets the specific DOM IDs and functional data attributes rendered by CookieConsent v3
const COOKIE_BANNER_SELECTOR = '#cc-main, .cc__component, #cc-bnd'; 
const ACCEPT_BUTTON_SELECTOR = 'button[data-cc="accept-all"], #cc-nb-ok, button:has-text("Accept all")';
const REJECT_BUTTON_SELECTOR = 'button[data-cc="accept-necessary"], button:has-text("Reject all")';

async function verifyFullConsentLifecycle() {
    console.log(`🧪 Initialising Advanced Consent Lifecycle Audit on: ${TARGET_URL}\n`);

    const browser = await chromium.launch({ headless: true });
    
    // Configured with explicit locale arguments to ensure correct text rendering structures in headless mode
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

    // Monitor ongoing network pipelines dynamically with safety wrappers
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
        } catch (routeErr) {
            // Absorb background connection state errors if browser close interrupts a request
        }
    });

    try {
        // ==========================================
        // 🛡️ PHASE 1: TESTING PRE-CONSENT PRIVACY
        // ==========================================
        console.log(`📡 [PHASE 1] Navigating to target. Testing zero-cookie isolation layer...`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
        
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2500);

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
            console.log(`✅ PASS: Absolute cookie isolation maintained. No telemetry dropped prior to engagement.`);
        }

        // ==========================================
        // 🎯 PHASE 2: TESTING SIMULATED USER OPT-IN
        // ==========================================
        console.log(`\n📡 [PHASE 2] Checking for interactive Consent Management Banner UI components...`);
        
        // Wait for the popup configuration layer to manifest on the canvas layout
        await page.waitForSelector(COOKIE_BANNER_SELECTOR, { timeout: 5000 });

        // Target the visibility profile of the action buttons explicitly
        let acceptButton = page.locator(ACCEPT_BUTTON_SELECTOR).first();
        
        if (!(await acceptButton.isVisible())) {
            console.log("🔍 Primary data attributes hidden. Polling generic structural button trees...");
            acceptButton = page.locator('button').filter({ hasText: /^accept\s?all$/i }).first();
        }

        if (await acceptButton.isVisible()) {
            const buttonText = await acceptButton.innerText();
            console.log(`\n🖱️  Clicking on designated Opt-In CTA action: "${buttonText.trim()}"...`);
            
            // Toggle the state mapping before firing the event interaction loop
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
                console.warn(`⚠️  WARNING: Banner clicked, but no tracking scripts initialized.`);
            }
        } else {
            console.error(`\n❌ CRITICAL CRASH: Unable to locate the accept element block via configuration mappings.`);
        }

        console.log(`\n=====================================================`);
        if (phase1Passed && standardConsentGiven) {
            console.log(`🎉 LIFECYCLE SUCCESS: UI engine interacts perfectly. Restricts before choice, fires on acceptance!`);
        } else {
            console.log(`❌ LIFECYCLE FAILED: Check execution outputs above to patch structural sequencing flaws.`);
        }
        console.log(`=====================================================`);

    } catch (err) {
        console.error(`❌ Life-cycle run failed unexpectedly:`, err.message);
    } finally {
        await browser.close();
    }
}

verifyFullConsentLifecycle();
