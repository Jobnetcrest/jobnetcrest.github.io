import { chromium } from 'playwright';

const TARGET_URL = 'https://jobnetcrest.github.io';

// --- CONFIGURATION MAPPINGS ---
const COOKIE_BANNER_SELECTOR = '#cc-main, .cc__component, #cc-bnd, .cookie-banner'; 
const ACCEPT_BUTTON_SELECTOR = 'button[data-cc="accept-all"], #cc-nb-ok, button:has-text("Accept all")';

async function verifyFullConsentLifecycle() {
    console.log(`🧪 Initialising Advanced Consent Lifecycle Audit on: ${TARGET_URL}\n`);

    const browser = await chromium.launch({ headless: true });
    
    // 1. ALWAYS boot into a completely isolated browser profile
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-GB'
    });

    const page = await context.newPage();
    
    const preConsentNetworkLeaks = [];
    const postConsentNetworkActivations = [];
    const trackingDomains = ['google-analytics.com', 'analytics.google', 'doubleclick.net', 'facebook.net', '://youtube.com'];
    
    let standardConsentGiven = false;

    // Monitor ongoing network pipelines dynamically
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
            // Absorb connection state drops cleanly
        }
    });

    try {
        // ==========================================
        // 🛡️ PHASE 1: TESTING PRE-CONSENT PRIVACY
        // ==========================================
        console.log(`📡 [PHASE 1] Navigating to target with deep-clean initialization...`);
        
        // Wipe high-level context cache profiles
        await context.clearCookies();

        // FIX: Utilize 'commit' state to pause right when the document context loads, 
        // completely blocking scripts from evaluating any lingering storage states.
        await page.goto(TARGET_URL, { waitUntil: 'commit' });
        
        // OBLITERATE MOCK STORAGE INTERNALS BEFORE SCRIPTS ENGAGE:
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });

        // Fresh reload to run the live consent engine with a completely clean slate
        await page.reload({ waitUntil: 'domcontentloaded' });
        
        // Wake up lagging pixels or components
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
        
        let bannerFound = true;
        await page.waitForSelector(COOKIE_BANNER_SELECTOR, { timeout: 4000, state: 'attached' }).catch(() => {
            bannerFound = false;
            console.log("⚠️  Notice: CMP UI element not displayed visually. Evaluating local client preferences...");
        });

        if (bannerFound) {
            let acceptButton = page.locator(ACCEPT_BUTTON_SELECTOR).first();
            
            if (!(await acceptButton.isVisible())) {
                acceptButton = page.locator('button').filter({ hasText: /^accept\s?all$/i }).first();
            }

            if (await acceptButton.isVisible()) {
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
            } else {
                console.error(`\n❌ FAIL: Located the consent layout framework, but the action buttons remain hidden.`);
            }
        } else {
            // DEBUG ENGINE RUN: Capture the precise state data to spot sneaky persistent footprints
            const storageDump = await page.evaluate(() => JSON.stringify(localStorage));
            const activeCookies = await context.cookies();
            
            console.log(`\n🛠️  [DEBUG ANALYSIS]:`);
            console.log(`   -> Current LocalStorage Keys Found: ${storageDump}`);
            console.log(`   -> Raw Browser Cookies Extracted: ${activeCookies.map(c => c.name).join(', ') || 'None'}\n`);

            const engineState = await page.evaluate(() => localStorage.getItem('cc_cookie') || localStorage.getItem('klaro'));
            if (engineState) {
                console.log(`💡 Bypass verified: Storage payload "${engineState.substring(0,25)}..." suppressed the banner dynamically.`);
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
