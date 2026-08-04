// Arctic eval instrument. Runs the game from a given tree (default: the
// session snapshot) pinned to venue 'arctic', and reports the metrics that
// matter for this effort: DNS%, DNF%, median/max race time, plus failure
// detail (where and how each DNS/DNF boat ended up) and per-character times.
//
// Usage: node arctic_eval.js <label> <trials> <seed0> <repoRoot> [--json out.json]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LABEL = process.argv[2] || 'run';
const TRIALS = parseInt(process.argv[3]) || 20;
const SEED0 = parseInt(process.argv[4]) || 4242;
const ROOT = process.argv[5] || path.join(__dirname, 'treeA');
const jsonIdx = process.argv.indexOf('--json');
const JSON_OUT = jsonIdx > 0 ? process.argv[jsonIdx + 1] : null;
const LIMIT = 600;

const q = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y);
    const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    const NOFLOES = process.argv.includes('--nofloes');
    await page.addInitScript((nf) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
        if (nf) window.__NOFLOES = true;
    }, NOFLOES);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    // count ice/island groundings separately
    await page.evaluate(() => {
        const inner = window.evalHarness.handleEvent.bind(window.evalHarness);
        window.__ice = [];
        window.evalHarness.handleEvent = (type, data) => {
            if (type === 'collision_island' && data && data.boat) window.__ice.push(data.boat.id);
            return inner(type, data);
        };
    });

    const perBoat = [];   // one row per (trial, non-player boat)
    const raw = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ({ seed, limit }) => {
            window.__ice = [];
            const out = await window.evalHarness.runTrial(seed, limit);
            const iceCounts = {};
            window.__ice.forEach(id => iceCounts[id] = (iceCounts[id] || 0) + 1);
            return { out, iceCounts, venue: settings.venue };
        }, { seed, limit: LIMIT });
        if (i === 0) console.log(`  venue=${r.venue} boats=${r.out.boats.length}`);
        raw.push({ seed, ...r.out, iceCounts: r.iceCounts });

        const started = new Set(r.out.events.filter(e => e.type === 'start_cross').map(e => e.boatId));
        for (const b of r.out.boats) {
            if (b.isPlayer) continue;
            const st = started.has(b.id);
            const fin = b.finished && b.finishTime != null && st;
            perBoat.push({
                seed, id: b.id, char: b.character,
                status: !st ? 'DNS' : (fin ? 'FIN' : 'DNF'),
                t: fin ? b.finishTime : null,
                leg: b.leg, x: b.x, y: b.y, spd: b.speed,
                pen: b.penalties || 0, ice: r.iceCounts[b.id] || 0,
                ocs: b.ocs, phase: b.prestartPhase,
                trackTail: b.diagTrack ? b.diagTrack.slice(-4) : undefined,
            });
        }
    }
    await browser.close();

    const n = perBoat.length;
    const dns = perBoat.filter(b => b.status === 'DNS');
    const dnf = perBoat.filter(b => b.status === 'DNF');
    const fin = perBoat.filter(b => b.status === 'FIN').map(b => b.t);
    const pens = perBoat.reduce((s, b) => s + b.pen, 0) / n;
    const ices = perBoat.reduce((s, b) => s + b.ice, 0) / n;

    console.log(`\n=== ${LABEL} — arctic ${TRIALS}t seeds ${SEED0}.. (${n} boat-races) ===`);
    console.log(`DNS ${(dns.length / n * 100).toFixed(2)}% (${dns.length})   DNF ${(dnf.length / n * 100).toFixed(2)}% (${dnf.length})`);
    console.log(`race time  med ${q(fin, .5).toFixed(1)}  p90 ${q(fin, .9).toFixed(1)}  max ${Math.max(...fin).toFixed(1)}  mean ${(fin.reduce((a, b) => a + b, 0) / fin.length).toFixed(1)}  (n=${fin.length})`);
    console.log(`pen/boat ${pens.toFixed(2)}   groundings/boat ${ices.toFixed(2)}`);

    if (dns.length) {
        console.log('\nDNS boats:');
        dns.forEach(b => console.log(`  seed ${b.seed} ${b.char.padEnd(12)} pos(${b.x},${b.y}) spd ${b.spd} ocs=${b.ocs} phase=${b.phase} tail=${JSON.stringify(b.trackTail || []).slice(0, 300)}`));
    }
    if (dnf.length) {
        console.log('\nDNF boats:');
        dnf.forEach(b => console.log(`  seed ${b.seed} ${b.char.padEnd(12)} leg ${b.leg} pos(${b.x},${b.y}) spd ${b.spd} pen ${b.pen} ice ${b.ice}`));
    }

    // per-character medians (only chars with >=3 races)
    const byChar = {};
    perBoat.forEach(b => { (byChar[b.char] = byChar[b.char] || []).push(b); });
    const rows = Object.entries(byChar).map(([c, bs]) => {
        const t = bs.filter(b => b.t != null).map(b => b.t);
        return { c, n: bs.length, med: q(t, .5), bad: bs.filter(b => b.status !== 'FIN').length };
    }).sort((a, b) => (b.med || 0) - (a.med || 0));
    console.log('\nslowest characters (med):');
    rows.slice(0, 8).forEach(r => console.log(`  ${r.c.padEnd(14)} n=${r.n} med ${r.med ? r.med.toFixed(1) : '-'} fails ${r.bad}`));

    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ label: LABEL, trials: TRIALS, seed0: SEED0, perBoat, raw }, null, 1));
})();
