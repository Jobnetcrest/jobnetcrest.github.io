import { chromium } from 'playwright';

const TARGET_URL = 'https://jobnetcrest.github.io';

// --- CONFIGURATION ---
// Update these selectors to match your specific Cookie Banner/CMP markup
const COOKIE_BANNER_SELECTOR = '#cc-bnd, .cookie-banner, #klaro, .cm-wrapper'; 
const ACCEPT_BUTTON_SELECTOR = 'button:has-text("Accept All"), button:has-text("Allow all"), .cm-btn-success';

async function verifyFullConsentLifecycle() {
    console.log(`🧪 Initialising Advanced Consent Lifecycle Audit on: ${TARGET_URL}\n`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
        viewport: { width: 1200, height: 800 }
    });

    const page = await context.newPage();
    
    // Tracking Arrays
    const preConsentNetworkLeaks = [];
    const postConsentNetworkActivations = [];
    const trackingDomains = ['google-analytics.com', 'analytics.google', 'doubleclick.net', 'facebook.net', '://youtube.com'];
    
    let standardConsentGiven = false;

    // Monitor ongoing network pipelines dynamically
    await page.route('**/*', async (route) => {
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
    });

    try {
        // ==========================================
        // 🛡️ PHASE 1: TESTING PRE-CONSENT PRIVACY
        // ==========================================
        console.log(`📡 [PHASE 1] Navigating to target. Testing zero-cookie isolation layer...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
        
        // Wake up delayed tracking elements
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
        
        // Ensure the layout elements are fully visible on screen before attempting an interactive action
        await page.waitForSelector(COOKIE_BANNER_SELECTOR, { timeout: 5000 }).catch(() => {
            console.log("⚠️  Notice: Custom CMP wrapper selector not instantly identified. Checking generic button mappings...");
        });

        const acceptButton = page.locator(ACCEPT_BUTTON_SELECTOR).first();
        
        if (await acceptButton.isVisible()) {
            console.log(`🖱️  Clicking on designated Opt-In CTA action: "${await acceptButton.innerText()}"...`);
            
            // Set flag to transition network routing buckets
            standardConsentGiven = true; 
            
            // Fire opt-in click
            await acceptButton.click();
            
            // Wait for dynamic tags to mount into the DOM infrastructure and register
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
                console.warn(`   Verify whether your CMP is actually triggering tag injection callbacks correctly.`);
            }
        } else {
            console.error(`\n❌ CRITICAL CRASH: Unable to find an accessible cookie accept button using the selector.`);
            console.error(`   Please verify that your button markup matches: '${ACCEPT_BUTTON_SELECTOR}'`);
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

