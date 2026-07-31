// Run the venue checks headlessly over every venue that has a document.
//
//   node regatta/eval/check_venues.js          # report; exit 1 on any error
//   node regatta/eval/check_venues.js --warn   # also fail on warnings
//
// The editor shows these in a panel, but a panel only helps someone who opens it.
// This is the same engine as a gate, so a document that breaks its own course
// cannot land quietly.
const { chromium } = require('playwright');
const path = require('path');

const STRICT = process.argv.includes('--warn');
const COLOR = { error: '\x1b[31m', warn: '\x1b[33m', ok: '\x1b[32m', off: '\x1b[0m' };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('  PAGE ERROR:', e.message));
    await page.goto('file://' + path.resolve('regatta/editor.html'));
    await page.waitForTimeout(1200);

    const venues = await page.evaluate(() => Object.keys(window.VENUE_DOC || {}));
    if (!venues.length) { console.error('No venue documents found.'); await browser.close(); process.exitCode = 1; return; }
    console.log(`Venue checks — ${venues.length} document(s): ${venues.join(', ')}\n`);

    let errors = 0, warns = 0;
    for (const v of venues) {
        // Drive the editor's own loader so the checks see exactly the course the
        // game builds, not a second interpretation of the document.
        const findings = await page.evaluate((venue) => {
            const sel = document.getElementById('venue-select');
            sel.value = venue;
            sel.dispatchEvent(new Event('change'));
            // Read the editor's own findings array rather than scraping its markup: this
            // scraped `.find` elements, and when the redesign renamed the class it reported
            // zero findings and PASSED. A gate that can silently measure nothing is not a gate.
            return (window.EditorApp._state().findings || []).map(f => ({
                level: f.level, title: f.title, detail: f.detail
            }));
        }, v);

        if (!findings.length) {
            console.error(`\n${v}: the check engine returned NOTHING. That is a broken harness,`
                        + ' not a clean venue — every venue has passing checks to report.');
            process.exitCode = 1;
            await browser.close();
            return;
        }
        const e = findings.filter(f => f.level === 'error').length;
        const w = findings.filter(f => f.level === 'warn').length;
        errors += e; warns += w;
        console.log(`${v}  —  ${e} error, ${w} warn, ${findings.filter(f => f.level === 'ok').length} ok`);
        for (const f of findings) {
            if (f.level === 'ok') continue;
            console.log(`  ${COLOR[f.level]}${f.level.toUpperCase().padEnd(5)}${COLOR.off} ${f.title}: ${f.detail}`);
        }
        console.log('');
    }

    await browser.close();
    const bad = errors > 0 || (STRICT && warns > 0);
    console.log(`${bad ? 'FAIL' : 'PASS'} — ${errors} error(s), ${warns} warning(s)`
        + (STRICT ? ' (strict: warnings fail)' : ''));
    process.exitCode = bad ? 1 : 0;
})();
