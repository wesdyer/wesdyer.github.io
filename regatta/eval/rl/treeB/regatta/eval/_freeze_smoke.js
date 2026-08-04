// Does every frozen venue actually SAIL? A document that loads is not a course that races.
// Reports finishers, DNFs, penalties and elapsed times per venue so a venue that now
// strands its fleet behind a bank shows up as a number rather than as a golden-hash diff.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const val = (f, d) => { const i = ARGS.indexOf(f); return i >= 0 && ARGS[i + 1] ? ARGS[i + 1] : d; };
const SEEDS = parseInt(val('--seeds', '2'), 10);
const VENUES = ARGS.filter(a => !a.startsWith('--') && !/^\d+$/.test(a));
const ALL = VENUES.length ? VENUES : ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean',
                                      'redrock', 'glowtide', 'arctic', 'seatrials'];

(async () => {
    const browser = await chromium.launch();
    const HARNESS = fs.readFileSync('regatta/eval/trace_harness.js', 'utf8');
    console.log('venue      seed   fin  dns  dnf  pen   median s   wind   legs  doc');
    let bad = 0;
    for (const venue of ALL) {
        for (let s = 0; s < SEEDS; s++) {
            const seed = 90210 + s;
            const page = await browser.newPage();
            const errs = [];
            page.on('pageerror', e => errs.push(e.message));
            await page.goto('file://' + path.resolve('regatta/index.html'));
            await page.addScriptTag({ content: HARNESS });
            await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
            const r = await page.evaluate(([sd]) => {
                const t = window.traceHarness.runTrace(sd, { timeLimit: 420 });
                const B = window.state.boats;
                const times = B.filter(b => b.raceState.finished).map(b => b.raceState.finishTime).sort((a, b) => a - b);
                return {
                    fin: times.length,
                    dns: B.filter(b => !b.raceState.finished && b.raceState.leg === 0).length,
                    dnf: B.filter(b => !b.raceState.finished && b.raceState.leg > 0).length,
                    pen: B.reduce((a, b) => a + (b.raceState.penaltiesServed || 0), 0),
                    median: times.length ? times[times.length >> 1] : null,
                    wind: Math.round(window.state.wind.baseSpeed * 10) / 10,
                    legs: window.state.race.totalLegs,
                    doc: !!window.state.course.doc,
                    hash: t.behaviorHash
                };
            }, [seed]);
            if (errs.length) { console.log(`  PAGE ERROR ${venue}: ${errs[0]}`); bad++; }
            const flag = (r.fin < 8 || !r.doc) ? '  <<' : '';
            console.log(`${venue.padEnd(10)} ${seed}  ${String(r.fin).padStart(4)} ${String(r.dns).padStart(4)}`
                + ` ${String(r.dnf).padStart(4)} ${String(r.pen).padStart(4)}`
                + `   ${r.median == null ? '   —  ' : String(Math.round(r.median)).padStart(6)}`
                + `   ${String(r.wind).padStart(4)}  ${String(r.legs).padStart(4)}   ${r.doc ? 'yes' : 'NO '}${flag}`);
            if (r.fin < 8 || !r.doc) bad++;
            await page.close();
        }
    }
    await browser.close();
    console.log(bad ? `\n${bad} venue-race(s) need a look` : '\nevery venue races on its document');
    process.exit(bad ? 1 : 0);
})();
