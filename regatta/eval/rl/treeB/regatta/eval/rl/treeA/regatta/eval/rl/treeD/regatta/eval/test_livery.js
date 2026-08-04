// Livery checks — the boat's paint job, which nothing else guards.
//
// Every rule here exists because it was broken at least once during the roster
// rework, and none of them fail loudly at runtime: a kite whose accent equals its
// base renders as a plain sail, a three-colour pattern with no third colour
// silently renders two-tone, and a hull-and-kite that are both near-black leaves
// the profile band with nothing to draw. They look like design choices until you
// put the numbers side by side, which is exactly what this file does.
//
//   node regatta/eval/test_livery.js

const { chromium } = require('playwright');
const path = require('path');

let failures = 0;
function check(label, ok, detail) {
    if (ok) { console.log('  ok    ' + label); }
    else { failures++; console.log('  FAIL  ' + label + (detail ? ' — ' + detail : '')); }
}

const lum = (c) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b;
};
const hsl = (c) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
        if (mx === r) h = ((g - b) / d) % 6;
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
    }
    const l = (mx + mn) / 2;
    return { h: (h * 60 + 360) % 360, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => { failures++; console.log('  PAGE ERROR: ' + e.message); });
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(1500);

    const fleet = await page.evaluate(() => AI_CONFIG.map(c => ({
        name: c.name,
        hull: c.hull, spin: c.spinnaker, spin2: c.spinnaker2, spin3: c.spinnaker3,
        sail: c.sail, cockpit: c.cockpit,
        pattern: (typeof SPIN_LOOKS !== 'undefined' && SPIN_LOOKS[c.name]) || 'solid',
        colors: typeof spinColorCount === 'function' ? spinColorCount(
            (typeof SPIN_LOOKS !== 'undefined' && SPIN_LOOKS[c.name]) || 'solid') : 1,
    })));
    const patterns = await page.evaluate(() => Object.keys(SPIN_PATTERNS));

    console.log('\nlivery — ' + fleet.length + ' competitors');

    // A pattern that isn't registered renders as a plain tint, silently.
    const unknown = fleet.filter(c => !patterns.includes(c.pattern));
    check('every kite pattern exists in SPIN_PATTERNS',
          unknown.length === 0, unknown.map(c => c.name + ':' + c.pattern).join(' '));

    // A three-colour pattern with no third colour falls back to two-tone.
    const noThird = fleet.filter(c => c.colors === 3 && !c.spin3);
    check('every 3-colour pattern has a spinnaker3',
          noThird.length === 0, noThird.map(c => c.name).join(' '));

    // Bands painted the same colour as what is under them are invisible.
    const dupe = fleet.filter(c => c.pattern !== 'solid' && (
        (c.spin2 && c.spin.toUpperCase() === c.spin2.toUpperCase()) ||
        (c.colors === 3 && c.spin3 && c.spin3.toUpperCase() === c.spin2.toUpperCase())));
    check('no kite band is painted over its own colour',
          dupe.length === 0, dupe.map(c => c.name).join(' '));

    // competitorProfileHTML uses the hull unless its luma is <50 or >200, then the
    // spinnaker. If BOTH are extreme the band has no usable colour.
    const band = fleet.filter(c => (lum(c.hull) < 50 || lum(c.hull) > 200) &&
                                   (lum(c.spin) < 50 || lum(c.spin) > 200));
    check('every competitor has a mid-tone hull or kite for the profile band',
          band.length === 0, band.map(c => c.name).join(' '));

    // Hull and kite are the two biggest shapes on the boat. If they share a hue and
    // a value, the kite stops reading as a separate thing at race scale.
    const flat = fleet.filter(c => {
        const a = hsl(c.hull), b = hsl(c.spin);
        if (a.s < 0.15 || b.s < 0.15) return false;
        const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
        return dh < 40 && Math.abs(lum(c.hull) - lum(c.spin)) < 60;
    });
    check('every kite reads against its own hull',
          flat.length === 0, flat.map(c => c.name).join(' '));

    // Sails are white or black by house rule (visual-style.md 8). Near-whites pass.
    const odd = fleet.filter(c => { const l = lum(c.sail); return l > 30 && l < 225; });
    check('sails are white or black', odd.length === 0,
          odd.map(c => c.name + ':' + c.sail).join(' '));

    // Two boats with the same kite are indistinguishable on the water.
    const seen = new Map();
    for (const c of fleet) {
        const k = [c.pattern, c.spin, c.spin2, c.spin3].join('|').toUpperCase();
        seen.set(k, (seen.get(k) || []).concat(c.name));
    }
    const clash = [...seen.values()].filter(v => v.length > 1);
    check('no two competitors share an identical kite',
          clash.length === 0, clash.map(v => v.join('=')).join(' '));

    // Every pattern should actually produce a sprite for the colours it is given.
    const broken = await page.evaluate(() => Object.keys(SPIN_PATTERNS).filter(k =>
        !getSpinnakerSprite(k, '#ff0000', '#00ff00', '#0000ff')));
    check('every pattern renders a sprite', broken.length === 0, broken.join(' '));

    await browser.close();
    console.log(failures ? `\nFAIL — ${failures} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(failures ? 1 : 0);
})();
