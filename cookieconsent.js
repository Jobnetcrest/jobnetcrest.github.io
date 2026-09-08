import { run } from 'vanilla-cookieconsent';

async function initCompliantBanner() {
    // 1. Grab your free dynamic file from your server or GitHub Pages raw endpoint
    const response = await fetch('/public/cookie-database.json');
    const cookieDb = await response.json();

    // Helper to structure cookie data arrays into HTML rows
    const generateTableRows = (items) => {
        if (!items || items.length === 0) return '<tr><td colspan="3">None detected.</td></tr>';
        return items.map(item => `
            <tr>
                <td><strong>${item.name}</strong></td>
                <td>${item.domain}</td>
                <td>${item.expiry}</td>
            </tr>
        `).join('');
    };

    // 2. Instantiate Vanilla JS CookieConsent
    run({
        categories: {
            necessary: { enabled: true, readOnly: true },
            analytics: { enabled: false },
            marketing: { enabled: false }
        },
        language: {
            default: 'en',
            translations: {
                en: {
                    consentModal: {
                        title: 'We value your privacy',
                        description: 'We use a self-hosted pipeline to monitor tracking code loops transparently.',
                        acceptAllBtn: 'Accept all',
                        acceptNecessaryBtn: 'Reject all',
                        showPreferencesBtn: 'Manage individual settings'
                    },
                    preferencesModal: {
                        title: 'Privacy Preference Centre',
                        sections: [
                            {
                                title: 'Analytics Cookies',
                                description: `These files allow us to audit traffic metrics dynamically without tracking identities.`,
                                linkedCategory: 'analytics',
                                cookieTable: {
                                    headers: { name: 'Cookie Name', domain: 'Source Domain', expiration: 'Lifespan' },
                                    body: generateTableRows(cookieDb.analytics)
                                }
                            },
                            {
                                title: 'Marketing Cookies',
                                description: `Used to measure targeted cross-site conversions.`,
                                linkedCategory: 'marketing',
                                cookieTable: {
                                    headers: { name: 'Cookie Name', domain: 'Source Domain', expiration: 'Lifespan' },
                                    body: generateTableRows(cookieDb.marketing)
                                }
                            }
                        ]
                    }
                }
            }
        }
    });
}

// Fire initialization on mount
initCompliantBanner();
