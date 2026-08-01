// Per-character strength measurement, and the tier bands derived from it.
//
// Why not character_eval.js: that script ranks by integer points (10 - placement)
// and averages RAW finish times. Raw time is dominated by the per-seed condition
// draw — a light-air race and a windy one differ by more than any character does —
// so averaging it across different seeds measures the weather, not the boat. And
// integer placement in a 10-boat fleet throws away most of the signal.
//
// The metric here is the leave-one-out fleet delta:
//
//     delta_i = finishTime_i - mean(finishTime_j) for the other AI boats j in that race
//
// Every boat is scored against the fleet it actually raced, in the conditions it
// actually got, so the per-race condition term cancels. Continuous, in seconds,
// signed so that NEGATIVE = faster than the fleet it raced against. Because the
// 9-boat fleet is drawn at random from AI_CONFIG, the expectation is unbiased.
//
// A delta is only meaningful WITHIN a venue. The harness pins 'seatrials', so an
// unqualified number here is bare-course ability on the benchmark venue and
// nothing more — different courses reward different attributes, and a boat that
// is fast on a beat-heavy course need not be fast where the legs are reachy or
// the water is full of ice. Pass --venue to measure elsewhere; keep shards from
// different venues in separate merges.
//
// Usage:
//   node regatta/eval/tier_eval.js <trials> <seedBase> [--venue KEY] --out shard.json
//   node regatta/eval/tier_eval.js --merge shard1.json shard2.json ...
//
// Shards are additive: run several concurrently with different seed bases (the
// seeds must not overlap or the same races get counted twice), then merge.

const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const TIME_LIMIT = 600;

// ---------------------------------------------------------------- merge mode

function emptyChar() {
    return { races: 0, sumDelta: 0, sumSqDelta: 0, sumRank: 0, wins: 0, top3: 0,
             dnf: 0, penalties: 0, sumRawTime: 0 };
}

function mergeShards(files) {
    const chars = {};
    let trials = 0;
    let venue = null;
    for (const f of files) {
        const shard = JSON.parse(fs.readFileSync(f, 'utf8'));
        // Deltas from different courses are not the same quantity — averaging
        // them silently would produce a number that describes no race anyone
        // can sail. Merge per venue, compare afterwards.
        const v = shard.venue || 'seatrials';
        if (venue === null) venue = v;
        else if (venue !== v) throw new Error(`shard venue mismatch: ${venue} vs ${v} (${f})`);
        trials += shard.trials;
        for (const [name, s] of Object.entries(shard.chars)) {
            const c = chars[name] || (chars[name] = emptyChar());
            for (const k of Object.keys(c)) c[k] += s[k];
        }
    }
    return { trials, venue, chars };
}

function report(merged) {
    const rows = Object.entries(merged.chars).map(([name, s]) => {
        const n = s.races;
        const mean = n ? s.sumDelta / n : 0;
        // Sample sd of the per-race deltas, then the standard error of the mean.
        const varr = n > 1 ? Math.max(0, (s.sumSqDelta - n * mean * mean) / (n - 1)) : 0;
        const se = n > 1 ? Math.sqrt(varr / n) : 0;
        return {
            name, races: n,
            delta: mean, se, sd: Math.sqrt(varr),
            rank: n ? s.sumRank / n : 0,
            winPct: n ? 100 * s.wins / n : 0,
            top3Pct: n ? 100 * s.top3 / n : 0,
            dnfPct: n ? 100 * s.dnf / n : 0,
            pens: n ? s.penalties / n : 0,
        };
    });
    // Fastest first. delta is "seconds behind the fleet", so ascending = strongest.
    rows.sort((a, b) => a.delta - b.delta);
    return rows;
}

// Tier bands. The design list's own tier shape is preserved as PROPORTIONS
// (S 12%, A 21%, B 33%, C 21%, D 12% — the counts in the original 66-character
// sketch), but membership is re-derived from measured speed. That keeps "S tier"
// meaning "top ~12% of the fleet" rather than an absolute stat total, so the
// bands stay meaningful as the roster grows.
const TIER_SHAPE = [['S', 0.12], ['A', 0.21], ['B', 0.33], ['C', 0.21], ['D', 0.13]];

function assignTiers(rows) {
    const n = rows.length;
    let i = 0;
    for (const [tier, frac] of TIER_SHAPE) {
        const count = Math.round(frac * n);
        for (let k = 0; k < count && i < n; k++, i++) rows[i].tier = tier;
    }
    while (i < n) rows[i++].tier = 'D';
    return rows;
}

function printReport(rows, merged) {
    console.log(`\n=== CHARACTER STRENGTH — venue ${merged.venue}, ${merged.trials} races, ${rows.length} characters ===`);
    console.log('delta = seconds vs the fleet each boat actually raced (negative = faster)\n');
    console.log('  #  Tier Name            Delta     ±SE   Races  AvgRank  Win%  Top3%  Pen  DNF%');
    console.log('-'.repeat(84));
    rows.forEach((r, i) => {
        console.log(
            String(i + 1).padStart(3) + '  ' +
            (r.tier || '-').padEnd(4) + ' ' +
            r.name.padEnd(15) +
            (r.delta >= 0 ? '+' : '') + r.delta.toFixed(2).padStart(6) + '  ' +
            ('±' + r.se.toFixed(2)).padStart(6) + '  ' +
            String(r.races).padStart(5) + '  ' +
            r.rank.toFixed(2).padStart(7) + '  ' +
            r.winPct.toFixed(1).padStart(4) + '  ' +
            r.top3Pct.toFixed(1).padStart(5) + '  ' +
            r.pens.toFixed(2).padStart(4) + '  ' +
            r.dnfPct.toFixed(1).padStart(4)
        );
    });
}

if (ARGS[0] === '--merge') {
    const merged = mergeShards(ARGS.slice(1).filter(a => a.endsWith('.json') && a !== ARGS[ARGS.indexOf('--report') + 1]));
    const rows = assignTiers(report(merged));
    printReport(rows, merged);
    const outIdx2 = ARGS.indexOf('--report');
    const out = outIdx2 >= 0 ? ARGS[outIdx2 + 1] : 'regatta/eval/tier_report.json';
    fs.writeFileSync(out, JSON.stringify({ trials: merged.trials, venue: merged.venue, rows }, null, 2));
    console.log(`\nSaved to ${out}`);
    return;
}

// ---------------------------------------------------------------- measure mode

const NUM_TRIALS = parseInt(ARGS[0]) || 50;
const SEED_BASE = parseInt(ARGS[1]) || 1000;
const outIdx = ARGS.indexOf('--out');
const OUT_FILE = outIdx >= 0 ? ARGS[outIdx + 1] : 'regatta/eval/tier_shard.json';
const venIdx = ARGS.indexOf('--venue');
const VENUE = venIdx >= 0 ? ARGS[venIdx + 1] : 'seatrials';
// --char '{"traitsOff":1}' strips archetype traits at Boat construction, leaving
// a pure stats-only fleet. Running the SAME seeds with and without it isolates
// what each archetype's traits are worth: any archetype coefficient surviving in
// the traits-off fit is stat-correlation, not behaviour.
const charIdx = ARGS.indexOf('--char');
const CHAR = charIdx >= 0 ? ARGS[charIdx + 1] : null;

(async () => {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('file://' + path.resolve('regatta/index.html'));
    // Set BEFORE the harness loads: its init() only defaults to 'seatrials' when
    // regatta_settings is absent, so writing it first is what makes the pin
    // yield. Only `venue` is set, so every other setting comes from
    // DEFAULT_SETTINGS and stays identical across venues.
    await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
    if (CHAR) await page.evaluate(c => { window.__CHAR = JSON.parse(c); }, CHAR);

    const chars = {};
    const t0 = Date.now();

    for (let i = 0; i < NUM_TRIALS; i++) {
        const seed = SEED_BASE + i;
        const result = await page.evaluate(
            ({ seed, limit }) => window.evalHarness.runTrial(seed, limit),
            { seed, limit: TIME_LIMIT }
        );

        const ai = result.boats.filter(b => b.name !== 'Player');
        const finishers = ai.filter(b => b.finished && b.finishTime > 0);
        // A race that lost most of its fleet says nothing reliable about the
        // survivors' relative speed, so drop it rather than let it skew a mean.
        if (finishers.length < 5) continue;

        const byTime = [...finishers].sort((a, b) => a.finishTime - b.finishTime);
        const total = finishers.reduce((s, b) => s + b.finishTime, 0);

        for (const b of ai) {
            const c = chars[b.name] || (chars[b.name] = emptyChar());
            if (!b.finished || !(b.finishTime > 0)) { c.dnf++; c.races++; continue; }
            // Leave-one-out: compare against the OTHER boats, never against a
            // mean this boat is itself inside — that would shrink every delta
            // toward zero by a factor of (n-1)/n and compress the whole table.
            const others = (total - b.finishTime) / (finishers.length - 1);
            const delta = b.finishTime - others;
            const rank = byTime.findIndex(x => x.id === b.id) + 1;

            c.races++;
            c.sumDelta += delta;
            c.sumSqDelta += delta * delta;
            c.sumRank += rank;
            c.sumRawTime += b.finishTime;
            if (rank === 1) c.wins++;
            if (rank <= 3) c.top3++;
            c.penalties += b.penalties || 0;
        }

        if ((i + 1) % 25 === 0) {
            const rate = (Date.now() - t0) / (i + 1) / 1000;
            const eta = Math.round(rate * (NUM_TRIALS - i - 1));
            process.stdout.write(`[${SEED_BASE}] ${i + 1}/${NUM_TRIALS}  ETA ${eta}s\n`);
        }
    }

    await browser.close();
    fs.writeFileSync(OUT_FILE, JSON.stringify({ trials: NUM_TRIALS, seedBase: SEED_BASE, venue: VENUE, chars }, null, 2));
    console.log(`[${VENUE}/${SEED_BASE}] wrote ${OUT_FILE}`);
})();
