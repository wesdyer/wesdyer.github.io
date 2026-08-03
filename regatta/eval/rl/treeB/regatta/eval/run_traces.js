// Golden-trace driver.
//
//   node regatta/eval/run_traces.js                 verify against golden
//   node regatta/eval/run_traces.js --update        (re)write golden
//   node regatta/eval/run_traces.js --determinism   run each trace twice, compare
//   node regatta/eval/run_traces.js --venue arctic  restrict to one venue
//   node regatta/eval/run_traces.js --seeds 3       seeds per venue (default 2)
//
// Verify is the gate for any refactor that is supposed to preserve behaviour.
// A behaviorHash mismatch prints the first diverging checkpoint so the failure
// can be localized to a venue, a seed, a race time and a boat.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const has = (f) => ARGS.includes(f);
const val = (f, d) => { const i = ARGS.indexOf(f); return i >= 0 && ARGS[i + 1] ? ARGS[i + 1] : d; };

const MODE = has('--update') ? 'update' : has('--determinism') ? 'determinism' : 'verify';
const SEEDS_PER_VENUE = parseInt(val('--seeds', '2'), 10);
const TIME_LIMIT = parseInt(val('--time', '300'), 10);
const ONLY_VENUE = val('--venue', null);
const SEED_BASE = parseInt(val('--seed-base', '90210'), 10);
// Leg count is not persisted in settings, so the default 4 is all a trace ever
// sees unless asked. Legs 5+ exercise course logic that 4 legs cannot reach.
//
// ⚠️ A DESIGNED course authors its own leg count and overrides this — every venue does,
// now that every venue has a document. `--legs 6` therefore races 4 unless the venue's
// route says otherwise, and the run reports which venues ignored it rather than quietly
// writing a golden named for a leg count nobody sailed. To exercise longer courses,
// author a longer route in the editor.
const LEGS = parseInt(val('--legs', '4'), 10);

const GOLDEN = path.resolve(LEGS === 4
    ? 'regatta/eval/golden/traces.json'
    : `regatta/eval/golden/traces-${LEGS}leg.json`);

// Every venue. seatrials is the eval anchor and is deliberately included: it is
// the one that must never move.
const ALL_VENUES = ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean',
                    'redrock', 'glowtide', 'arctic', 'seatrials'];

function firstCheckpointDiff(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const A = a[i], B = b[i];
        if (JSON.stringify(A) === JSON.stringify(B)) continue;
        const lines = [`  first divergence at t=${A.t}s (checkpoint ${i})`];
        if (A.status !== B.status) lines.push(`    status ${A.status} -> ${B.status}`);
        if (A.wind !== B.wind) lines.push(`    wind ${A.wind} -> ${B.wind}`);
        for (let k = 0; k < Math.min(A.boats.length, B.boats.length); k++) {
            const ba = A.boats[k], bb = B.boats[k];
            if (JSON.stringify(ba) === JSON.stringify(bb)) continue;
            const d = [];
            for (const f of ['x', 'y', 'h', 's', 'leg', 'pen', 'fin']) {
                if (ba[f] !== bb[f]) d.push(`${f} ${ba[f]} -> ${bb[f]}`);
            }
            lines.push(`    boat ${ba.id}: ${d.join(', ')}`);
        }
        return lines.join('\n');
    }
    if (a.length !== b.length) return `  checkpoint count ${a.length} -> ${b.length} (race length changed)`;
    return '  checkpoints identical — divergence is in a field the checkpoint does not carry';
}

(async () => {
    const venues = ONLY_VENUE ? [ONLY_VENUE] : ALL_VENUES;
    console.log(`Golden traces — mode=${MODE}, venues=${venues.length}, seeds=${SEEDS_PER_VENUE}, ` +
                `limit=${TIME_LIMIT}s, legs=${LEGS}`);

    const browser = await chromium.launch();
    const HARNESS = fs.readFileSync('regatta/eval/trace_harness.js', 'utf8');

    // A FRESH PAGE PER TRACE. Traces must not depend on what raced before them,
    // or `--venue arctic` would disagree with arctic's entry in a full sweep and
    // the golden file would be order-dependent. Two real leaks (camera-driven
    // particle draws consuming the sim RNG, and Glacier Sound clobbering the
    // player's Course Distance setting) were found exactly this way and fixed —
    // isolation here means the golden stays trustworthy even if a third appears.
    async function tracePage(venue) {
        const page = await browser.newPage();
        page.on('pageerror', e => console.error('  PAGE ERROR:', e.message));
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.addScriptTag({ content: HARNESS });
        // resetGame() calls loadSettings(), so this takes effect on the next
        // trace. Only `venue` is set, so every other setting comes from
        // DEFAULT_SETTINGS — itself a determinism guarantee.
        await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
        return page;
    }
    const trace = (page, seed) => page.evaluate(
        ([sd, tl, lg]) => window.traceHarness.runTrace(sd, { timeLimit: tl, legs: lg }),
        [seed, TIME_LIMIT, LEGS]);

    const results = {};
    const t0 = Date.now();

    for (const venue of venues) {
        results[venue] = {};
        for (let s = 0; s < SEEDS_PER_VENUE; s++) {
            const seed = SEED_BASE + s;
            process.stdout.write(`  ${`${venue}/${seed}`.padEnd(22)}`);

            const page = await tracePage(venue);
            const r = await trace(page, seed);

            let note = '';
            if (MODE === 'determinism') {
                // Deliberately the SAME page: this mode exists to catch state
                // surviving from one race into the next, which fresh pages hide.
                const r2 = await trace(page, seed);
                const ok = r.behaviorHash === r2.behaviorHash && r.courseGeomHash === r2.courseGeomHash;
                note = ok ? '  DETERMINISTIC' : '  *** NON-DETERMINISTIC ***';
                if (!ok) {
                    note += '\n' + firstCheckpointDiff(r.checkpoints, r2.checkpoints);
                    if (r.courseGeomHash !== r2.courseGeomHash) {
                        note += `\n    course geometry also changed (${r.courseGeomHash} -> ${r2.courseGeomHash})` +
                                ` — the leak is in course setup, not the update loop`;
                    }
                    r._unstable = true;
                }
            }
            await page.close();

            results[venue][seed] = r;
            console.log(`${r.behaviorHash}  ${r.frames}f  ${r.summary.raceTime}s  ` +
                        `fin=${r.summary.finished} pen=${r.summary.penalties}${note}`);
        }
    }

    await browser.close();
    const mins = ((Date.now() - t0) / 60000).toFixed(1);

    // Say when the requested leg count did not happen. A designed course authors its own,
    // and the slider is a player preference the design overrides — so `--legs 6` can race
    // 4 and write a file called traces-6leg.json describing four-leg races. Silence there
    // is how a golden comes to mean something other than its name.
    const ignored = Object.entries(results)
        .map(([v, runs]) => [v, Object.values(runs)[0].summary.legs])
        .filter(([, n]) => n != null && n !== LEGS);
    if (ignored.length) {
        console.log(`\n  --legs ${LEGS} was overridden by the venue's own route on `
            + `${ignored.length}/${venues.length} venue(s): `
            + ignored.map(([v, n]) => `${v} sailed ${n}`).join(', '));
        console.log('  A course authors its leg count. To trace a longer one, author a longer route.');
    }

    // ---- Persist / compare -------------------------------------------------
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });

    if (MODE === 'update') {
        const anyResult = Object.values(results).flatMap(v => Object.values(v))[0];
        const out = {
            generatedAt: new Date().toISOString(),
            obsVersion: anyResult ? anyResult.obsVersion : null,
            timeLimit: TIME_LIMIT, seedBase: SEED_BASE, legs: LEGS, venues: {}
        };
        for (const v in results) {
            out.venues[v] = {};
            for (const s in results[v]) {
                const r = results[v][s];
                out.venues[v][s] = {
                    behaviorHash: r.behaviorHash,
                    courseGeomHash: r.courseGeomHash,
                    frames: r.frames,
                    eventCount: r.eventCount,
                    summary: r.summary,
                    checkpoints: r.checkpoints
                };
            }
        }
        fs.writeFileSync(GOLDEN, JSON.stringify(out, null, 2));
        console.log(`\nWrote ${path.relative(process.cwd(), GOLDEN)} (${mins} min)`);
        return;
    }

    if (MODE === 'determinism') {
        const unstable = [];
        for (const v in results) for (const s in results[v]) if (results[v][s]._unstable) unstable.push(`${v}/${s}`);
        console.log(unstable.length
            ? `\nFAIL — ${unstable.length} non-deterministic: ${unstable.join(', ')}  (${mins} min)`
            : `\nPASS — all traces deterministic (${mins} min)`);
        process.exitCode = unstable.length ? 1 : 0;
        return;
    }

    // verify
    if (!fs.existsSync(GOLDEN)) {
        console.error(`\nNo golden file at ${GOLDEN}. Run with --update first.`);
        process.exitCode = 1;
        return;
    }
    const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
    const gotObs = Object.values(results).flatMap(v => Object.values(v))[0];
    if (gotObs && golden.obsVersion != null && golden.obsVersion !== gotObs.obsVersion) {
        console.error(`\nGolden was recorded with observation version ${golden.obsVersion}, ` +
                      `harness now observes v${gotObs.obsVersion}.`);
        console.error(`Hashes are not comparable across observation changes — re-record with --update`);
        console.error(`from a known-good commit, then re-run verify.`);
        process.exitCode = 1;
        return;
    }
    if (golden.legs != null && golden.legs !== LEGS) {
        console.error(`\nGolden used --legs ${golden.legs}, this run used ${LEGS}. Not comparable.`);
        process.exitCode = 1;
        return;
    }
    if (golden.timeLimit !== TIME_LIMIT) {
        console.error(`\nGolden used --time ${golden.timeLimit}, this run used ${TIME_LIMIT}. Not comparable.`);
        process.exitCode = 1;
        return;
    }
    let fails = 0, checked = 0, missing = 0, geomOnly = 0;

    for (const v in results) {
        for (const s in results[v]) {
            const got = results[v][s];
            const want = golden.venues[v] && golden.venues[v][s];
            if (!want) { console.log(`  ${v}/${s}: no golden entry (new)`); missing++; continue; }
            checked++;
            if (got.behaviorHash !== want.behaviorHash) {
                fails++;
                console.log(`\nFAIL ${v}/${s}`);
                console.log(`  behaviorHash ${want.behaviorHash} -> ${got.behaviorHash}`);
                console.log(firstCheckpointDiff(want.checkpoints, got.checkpoints));
            } else if (got.courseGeomHash !== want.courseGeomHash) {
                geomOnly++;
                console.log(`\nNOTE ${v}/${s}: behaviour identical, course GEOMETRY changed`);
                console.log(`  courseGeomHash ${want.courseGeomHash} -> ${got.courseGeomHash}`);
                console.log(`  (expected when a course legitimately gains/loses marks)`);
            }
        }
    }

    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${checked} traces checked, ${fails} behaviour changes, ` +
                `${geomOnly} geometry-only, ${missing} new  (${mins} min)`);
    process.exitCode = fails ? 1 : 0;
})();
