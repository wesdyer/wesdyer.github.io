// River (Sockeye Run) land-contact attribution — WHERE do the 22k bank-grind
// frames come from, and is the boat aiming right in heading-space while the
// stream sets it onto the bank (current-set compensation hypothesis)?
// Episodes: first contact frame opens an episode; 1s with no contact closes it.
// At episode OPEN we snapshot the controller's intent vs the ground truth.
//   node _river_attrib.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treePH0');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            // land-contact bookkeeping per bot
            const open = {};   // name -> episode
            const eps = [];
            let contactFrames = 0;
            const prevPos = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe
                        && state.race.status === 'racing' && !d.boat.raceState.finished) {
                        contactFrames++;
                        const b = d.boat, nm = b.name, t = state.race.timer;
                        if (open[nm]) { open[nm].last = t; open[nm].frames++; return inner && inner(ty, d); }
                        // OPEN a new episode: snapshot intent vs ground truth
                        const c = b.controller || {};
                        const cur = getCurrentAt(b.x, b.y) || { speed: 0, direction: 0 };
                        const tgt = (c._lastNav && c._lastNav.x != null) ? c._lastNav : null;
                        const mk = legTargetPoint(b.raceState.leg);
                        const bear = tgt ? Math.atan2(tgt.x - b.x, -(tgt.y - b.y)) : null;
                        const pv = prevPos[nm];
                        const vx = b.velocity.x, vy = b.velocity.y;
                        const sog = Math.hypot(vx, vy);
                        const cogd = sog > 0.01 ? Math.atan2(vx, -vy) : b.heading;
                        const cross = bear != null ? Math.sin(norm(cur.direction - bear)) * cur.speed : null;
                        const wd = getWindAt(b.x, b.y).direction;
                        open[nm] = {
                            seed, name: nm, t0: t, last: t, frames: 1,
                            leg: b.raceState.leg,
                            x: +b.x.toFixed(0), y: +b.y.toFixed(0),
                            dMark: mk ? Math.hypot(mk.x - b.x, mk.y - b.y) : null,
                            curKt: +cur.speed.toFixed(2),
                            curDir: +(cur.direction * 180 / Math.PI).toFixed(0),
                            crossKt: cross == null ? null : +cross.toFixed(2),
                            hdgErr: bear != null ? +(norm(b.heading - bear) * 180 / Math.PI).toFixed(1) : null,
                            cogErr: bear != null ? +(norm(cogd - bear) * 180 / Math.PI).toFixed(1) : null,
                            twa: +(Math.abs(norm(b.heading - wd)) * 180 / Math.PI).toFixed(0),
                            sogKt: +(sog * 4 * 60 / 60).toFixed(2),
                            spd: +b.speed.toFixed(2),
                            av: (c.lastAvoidDeviation || 0) * 180 / Math.PI > 2 ? 1 : 0,
                            live: c.livenessState || '?',
                        };
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60;
            let botFrames = 0;
            for (let it = 0; it < 60 * 700; it++) {
                for (const b of bots) prevPos[b.name] = { x: b.x, y: b.y };
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                for (const b of bots) if (!b.raceState.finished) botFrames++;
                // close stale episodes
                for (const nm of Object.keys(open)) {
                    if (t - open[nm].last > 1.0) { eps.push(open[nm]); delete open[nm]; }
                }
                if (t > 700) break;
                if (bots.every(b => b.raceState.finished)) break;
            }
            for (const nm of Object.keys(open)) eps.push(open[nm]);
            const fins = bots.filter(b => b.raceState.finished).length;
            return { seed, eps, contactFrames, botFrames, bots: bots.length, fins };
        }, seed);
        all.push(r);
        console.log(`seed ${seed}: episodes ${r.eps.length} contactFrames ${r.contactFrames} (${(r.contactFrames / r.bots).toFixed(0)}/boat) fins ${r.fins}/${r.bots}`);
    }
    fs.writeFileSync(path.join(__dirname, 'river_attrib.json'), JSON.stringify(all));
    // ---- aggregate ----
    const eps = [].concat(...all.map(r => r.eps));
    const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '-';
    console.log(`\nTOTAL episodes ${eps.length} over ${TRIALS} seeds (${(eps.length / TRIALS / all[0].bots).toFixed(1)}/boat-race)`);
    const byLeg = {};
    for (const e of eps) byLeg[e.leg] = (byLeg[e.leg] || 0) + 1;
    console.log('by leg:', JSON.stringify(byLeg));
    console.log('episode frames med', med(eps.map(e => e.frames)), 'p90', [...eps.map(e => e.frames)].sort((a, b) => a - b)[Math.floor(eps.length * 0.9)]);
    const nearMark = eps.filter(e => e.dMark != null && e.dMark < 250);
    console.log('near-mark (<250u):', pct(nearMark.length, eps.length), ' mid-leg:', pct(eps.length - nearMark.length, eps.length));
    console.log('avoidance-active at open:', pct(eps.filter(e => e.av).length, eps.length));
    const lv = {}; for (const e of eps) lv[e.live] = (lv[e.live] || 0) + 1;
    console.log('liveness at open:', JSON.stringify(lv));
    console.log('boat speed at open: med', med(eps.map(e => e.spd)));
    console.log('current at open: med', med(eps.map(e => e.curKt)), 'kt; |cross| med', med(eps.map(e => Math.abs(e.crossKt ?? 0))));
    // the hypothesis class: aiming fine in heading space (|hdgErr|<25deg) while
    // the GROUND track is off by far more (|cogErr|-|hdgErr| > 15deg) with real cross-set
    const hclass = eps.filter(e => e.hdgErr != null && Math.abs(e.hdgErr) < 25
        && Math.abs(e.cogErr) - Math.abs(e.hdgErr) > 15 && Math.abs(e.crossKt ?? 0) > 0.3);
    console.log('SET-CLASS (aim ok, ground track blown out by cross-set):', pct(hclass.length, eps.length));
    const hdg = eps.filter(e => e.hdgErr != null);
    console.log('|hdgErr| med', med(hdg.map(e => Math.abs(e.hdgErr))), ' |cogErr| med', med(hdg.map(e => Math.abs(e.cogErr))));
    console.log('TWA at open: med', med(eps.map(e => e.twa)), ' SOG kt med', med(eps.map(e => e.sogKt)));
    // where along the run (leg 3 goes y -270 -> 9476) and which bank (x sign-ish)
    const l3 = eps.filter(e => e.leg === 3);
    const hist = {};
    for (const e of l3) { const b = Math.floor((e.y + 500) / 1000) * 1000; hist[b] = (hist[b] || 0) + 1; }
    console.log('leg-3 y-histogram (1000u bins):', JSON.stringify(hist));
    const xs = l3.map(e => e.x).sort((a, b) => a - b);
    console.log('leg-3 x: p10', xs[Math.floor(xs.length * .1)], 'med', xs[Math.floor(xs.length * .5)], 'p90', xs[Math.floor(xs.length * .9)]);
    const dirs = {};
    for (const e of l3) { const d = Math.round(e.curDir / 30) * 30; dirs[d] = (dirs[d] || 0) + 1; }
    console.log('current dir at open (30deg bins):', JSON.stringify(dirs));
    await browser.close();
})();
