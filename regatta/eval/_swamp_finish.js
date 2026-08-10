// Gatorgrass Bayou finish audit: can the AI actually get round this course?
// Reports % finishers, median and best finish time, and where the non-finishers stopped.
//
//   node regatta/eval/_swamp_finish.js [trials] [seed0]
//
// A FINISHER IS `finished && !resultStatus`, which is the game's own test (fleetGapScale).
// `finished` alone is not it: at the cutoff the race marks EVERY boat still out there
// finished, stamps finishTime with the cutoff and adds resultStatus DNF (or DNS if it never
// crossed the line). Counting the flag alone reported 100% finishers at a median of exactly
// 5:00 — the giveaway being that the median WAS the cutoff, to the second.
//
// TWO PASSES, because the race cannot outlive its own cutoff. A boat that misses it has
// either sailed slowly or stopped sailing, and those are different bugs. Pass 1 runs the
// venue as authored; pass 2 raises state.course.cutoff so the stragglers can be timed. A
// fleet that is 40% at the real cutoff and 100% with room is slow; one that is 40% both
// times is stuck, and the leg counts say where.
//
// THE PLAYER IS EXCLUDED. Nobody drives it here, so it sits on the line and times out; the
// harness's own note records that counting it once dragged every fleet mean it appeared in.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const TRIALS = parseInt(process.argv[2]) || 12;
const SEED0 = parseInt(process.argv[3]) || 4242;
const LONG_CUTOFF = 900;            // pass 2: enough rope to time even a bad lap

const pct = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const med = a => pct(a, 0.5);
const mmss = t => Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}` : '—';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp' }));
    });
    await page.goto('file://' + path.resolve(REPO, 'regatta/index.html'));
    await page.waitForTimeout(1500);
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(REPO, 'regatta/eval/eval_harness.js'), 'utf8') });

    const meta = await page.evaluate(() => ({
        venue: settings.venue,
        cutoff: (window.VENUE_DOC[settings.venue].course || {}).cutoff,
        fleet: state.boats.length,
        legs: (window.VENUE_DOC[settings.venue].course.route || []).length,
    }));
    console.log(`venue ${meta.venue}  fleet ${meta.fleet}  route legs ${meta.legs}  cutoff ${meta.cutoff}s (${mmss(meta.cutoff)})`);
    console.log(`${TRIALS} trials from seed ${SEED0}`);

    async function pass(label, cutoff) {
        const times = [], legs = {}; let boats = 0, fin = 0, dnf = 0, dns = 0, pens = 0;
        console.log(`── ${label} (cutoff ${mmss(cutoff)}) ${'─'.repeat(28)}`);
        for (let i = 0; i < TRIALS; i++) {
            const r = await page.evaluate(({ seed, cut }) => {
                window.__cut = cut;
                const oldReset = window.resetGame;
                window.resetGame = function () { oldReset.apply(this, arguments);
                    if (window.__cut) state.course.cutoff = window.__cut; };
                const out = window.evalHarness.runTrial(seed, cut + 120);
                window.resetGame = oldReset;
                return out;
            }, { seed: SEED0 + i, cut: cutoff });
            const field = r.boats.filter(b => !b.isPlayer);
            const t = [];
            for (const b of field) {
                boats++; pens += b.penalties || 0;
                if (b.finished && !b.resultStatus) { fin++; t.push(b.finishTime); }
                else { (b.resultStatus === 'DNS' ? (dns++) : (dnf++)); legs[b.leg] = (legs[b.leg] || 0) + 1; }
            }
            times.push(...t);
            process.stdout.write(`  seed ${SEED0 + i}: ${t.length}/${field.length} home, median ${mmss(med(t))}\n`);
        }
        return { times, boats, fin, dnf, dns, pens, legs };
    }
    const A = await pass('PASS 1 — the venue as authored', meta.cutoff);
    const B = await pass('PASS 2 — cutoff raised, to time the stragglers', LONG_CUTOFF);

    const report = (label, R, cutoff) => {
        console.log(`\n${label}  —  ${TRIALS} trials, ${R.boats} AI boats, cutoff ${mmss(cutoff)}`);
        console.log(`  FINISHED   ${R.fin}/${R.boats}  (${(100 * R.fin / R.boats).toFixed(0)}%)     DNF ${R.dnf}   DNS ${R.dns}`);
        if (R.times.length) {
            console.log(`  best   ${mmss(Math.min(...R.times))}`);
            console.log(`  median ${mmss(med(R.times))}`);
            console.log(`  p90    ${mmss(pct(R.times, 0.9))}`);
        }
        console.log(`  penalties per boat ${(R.pens / R.boats).toFixed(2)}`);
        const ls = Object.entries(R.legs).sort();
        if (ls.length) console.log(`  non-finishers by leg reached: ${ls.map(([k, v]) => `leg ${k}: ${v}`).join('   ')}`);
    };
    report('PASS 1  venue as authored', A, meta.cutoff);
    report('PASS 2  cutoff raised', B, LONG_CUTOFF);
    console.log(`\n  verdict: ${(100 * A.fin / A.boats).toFixed(0)}% get round inside the authored cutoff; `
        + `${(100 * B.fin / B.boats).toFixed(0)}% get round at all.`);
    await browser.close();
})();
