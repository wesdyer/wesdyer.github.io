// START BENCH — how the bot fleet starts (PT-002, PT-068). Races are sailed headless only until
// the fleet has rounded the first mark, so a whole venue set runs in a couple of minutes.
//
//   node regatta/eval/start_bench.js [seeds=6] [seedBase=7100]     (VENUES=bay,lagoon to narrow)
//   JSON=out.json …                                                 also write the per-venue rows
//
// Per venue, over every bot in every race:
//   port10   share of the fleet on PORT 10 s before the gun (the approach the player meets)
//   kt@gun   speed at the gun (Wes arrives at 5–6 kt)
//   cross    seconds after the gun the hull crosses the line: fleet median and first boat
//   ocs      boats over early at the gun, per race
//   leg1     seconds from the gun to the first mark credited: fleet median and best
// The player's boat is parked off the course, as the rating bench leaves it undriven.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SEEDS = +(process.argv[2] || 6), BASE = +(process.argv[3] || 7100);
const VENUES = (process.env.VENUES || 'bay,seatrials,lake,lagoon,swamp,river,ocean,redrock,glowtide,arctic,otter,flats,volcanic').split(',');

(async () => {
    const browser = await chromium.launch();
    const results = await Promise.all(VENUES.map(async (venue) => {
        const page = await browser.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
        await page.addScriptTag({ content: fs.readFileSync('regatta/eval/rate_harness.js', 'utf8') });
        const r = await page.evaluate(({ SEEDS, BASE }) => {
            const H = window.rateHarness, rows = [];
            for (let k = 0; k < SEEDS; k++) {
                H.seed = BASE + k;
                resetGame(); startRace();
                const P = state.boats.find(b => b.isPlayer);
                const bots = state.boats.filter(b => !b.isPlayer);
                const rec = new Map(bots.map(b => [b, { port10: null, ktGun: null, ocs: 0, cross: null, leg1: null }]));
                let tookPort = false, tookGun = false;
                const dt = 1 / 60;
                for (let it = 0; it < 60 * 400; it++) {
                    if (P) { P.x = 1e6; P.y = 1e6; P.speed = 0; }
                    const before = state.race.status, tBefore = state.race.timer;
                    update(dt);
                    const t = state.race.timer;
                    // prestart: the clock counts DOWN to 0; racing: up from 0
                    if (state.race.status === 'prestart' && !tookPort && t <= 10) {
                        tookPort = true;
                        for (const b of bots) rec.get(b).port10 = (window.Rules && Rules.getTack(b) === -1) ? 1 : 0;
                    }
                    if (state.race.status === 'racing' && !tookGun) {
                        tookGun = true;
                        for (const b of bots) { const q = rec.get(b); q.ktGun = b.speed * 4; q.ocs = b.raceState.ocs ? 1 : 0; }
                    }
                    if (state.race.status === 'racing') {
                        for (const b of bots) {
                            const q = rec.get(b);
                            if (q.cross == null && b.raceState.leg >= 1) q.cross = t;
                            if (q.leg1 == null && b.raceState.leg >= 2) q.leg1 = t;
                        }
                        if (bots.every(b => rec.get(b).leg1 != null) || t > 300) break;
                    }
                }
                rows.push([...rec.values()]);
            }
            return rows;
        }, { SEEDS, BASE });
        await page.close();
        return { venue, rows: r, errs };
    }));
    await browser.close();
    const med = (a) => { const s = a.filter(x => x != null).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
    const mean = (a) => { const s = a.filter(x => x != null); return s.length ? s.reduce((p, q) => p + q, 0) / s.length : null; };
    const f = (x, d = 1) => x == null ? '  —  ' : x.toFixed(d).padStart(5);
    console.log(`START BENCH  ${SEEDS} races/venue from seed ${BASE}`);
    console.log('venue       port10  kt@gun  cross med/first   ocs/race  leg1 med/best  noStart');
    const all = [];
    for (const { venue, rows, errs } of results) {
        const flat = rows.flat(); all.push(...flat);
        const firsts = rows.map(rr => Math.min(...rr.map(q => q.cross == null ? Infinity : q.cross)));
        const bests = rows.map(rr => Math.min(...rr.map(q => q.leg1 == null ? Infinity : q.leg1)));
        console.log(`${venue.padEnd(10)}  ${(100 * mean(flat.map(q => q.port10))).toFixed(0).padStart(4)}%  ${f(mean(flat.map(q => q.ktGun)))}  ${f(med(flat.map(q => q.cross)))}/${f(med(firsts))}   ${f(mean(rows.map(rr => rr.reduce((a, q) => a + q.ocs, 0))))}    ${f(med(flat.map(q => q.leg1)))}/${f(med(bests))}  ${flat.filter(q => q.cross == null).length}${errs.length ? '  ERR ' + errs[0] : ''}`);
    }
    console.log(`ALL         ${(100 * mean(all.map(q => q.port10))).toFixed(0).padStart(4)}%  ${f(mean(all.map(q => q.ktGun)))}  ${f(med(all.map(q => q.cross)))}         ${f(mean(results.map(r => mean(r.rows.map(rr => rr.reduce((a, q) => a + q.ocs, 0))))))}    ${f(med(all.map(q => q.leg1)))}`);
    if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(results));
})();
