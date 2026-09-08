// Run 'npm install puppeteer' locally to test, or let GitHub handle it
const puppeteer = require('puppeteer');
const fs = require('fs');

const TARGET_URL = 'https://yourwebsite.com'; // <-- Swap out for your live site URL

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log(`Starting automated scan on ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

    // Extract all cookies set during the session
    const cookies = await page.cookies();
    
    const structuredCookies = cookies.map(c => {
        // Basic automatic classification rules based on common tracker domains
        let category = 'necessary';
        if (c.domain.includes('google-analytics') || c.domain.includes('ga')) category = 'analytics';
        if (c.domain.includes('facebook') || c.domain.includes('doubleclick')) category = 'marketing';

        return {
            name: c.name,
            domain: c.domain,
            category: category
        };
    });

    // Write the scanned cookies array to cookies.json
    fs.writeFileSync('./cookies.json', JSON.stringify(structuredCookies, null, 2));
    console.log(`Scan finished. Found ${structuredCookies.length} cookies. Written to cookies.json.`);
    
    await browser.close();
})();
