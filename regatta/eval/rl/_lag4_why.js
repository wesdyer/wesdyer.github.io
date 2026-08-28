// LAGOON LEG 4 — WHY IS THE FLEET SLOW WHERE HE IS FAST? (2026-08-27)
// The atlas: leg 4 costs +13.0 s, of which 5.6 s is SPEED and 4.2 s distance,
// and _gap_grid says 100% NAV helm ownership in every top cell — no avoidance,
// no contact, no reflex, no slow-detector. In the x = 1375..1875 band the fleet
// runs 76-89 u/s where he runs 110+. He also takes a much WIDER line
// (cross-track 770 u against their 303) and wins by 13 s, which is the opposite
// of every other venue.
// So compare the two, in the same x-bands, on the quantities that decide boat
// speed: TWA, the local breeze, and the local set.
//   node _lag4_why.js <trials> <seed0> <tree> [fp]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2] || '6'), SEED0 = parseInt(process.argv[3] || '9400');
const ROOT = path.join(__dirname, process.argv[4] || 'treeSPP');
const FP = process.argv[5] || '3acc77de:61737';
const LEG = 4;
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const BANDS = [[-2000, -500], [-500, 500], [500, 1250], [1250, 1750], [1750, 3000]];
const bandOf = x => BANDS.findIndex(b => x >= b[0] && x < b[1]);

const TD = path.join(__dirname, 'traj');
const H = BANDS.map(() => []);
for (const f of fs.readdirSync(TD).filter(x => x.startsWith('traj_lagoon_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (String(j.venueFingerprint) !== FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const SS = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    for (let i = 1; i < SS.length; i++) {
        const s = SS[i];
        const b = bandOf(gi(s, 'x')); if (b < 0) continue;
        const dt = Math.max(1e-3, gi(s, 't') - gi(SS[i - 1], 't'));
        const turn = Math.abs(norm(gi(s, 'hdg') - gi(SS[i - 1], 'hdg'))) * 180 / Math.PI / dt;
        H[b].push({ kt: gi(s, 'spd') * 4, twa: Math.abs(norm(gi(s, 'hdg') - gi(s, 'windDir'))) * 180 / Math.PI,
                    w: gi(s, 'windSpd'), y: gi(s, 'y'), turn });
    }
}
(async () => {
    const br = await chromium.launch(); const page = await br.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: 'lagoon', character: AI_CONFIG[0].name })));
    const B = BANDS.map(() => []);
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG, BANDS }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const bandOf = x => BANDS.findIndex(b => x >= b[0] && x < b[1]);
            const out = []; const lastH = {}; const lastT = {};
            for (let it = 0; it < 60 * 940; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (it % 30) continue;
                for (const b of state.boats) {
                    if (b.raceState.finished || b.raceState.leg !== LEG) continue;
                    const k = bandOf(b.x); if (k < 0) continue;
                    const w = getWindAt(b.x, b.y), c = getCurrentAt(b.x, b.y);
                    const tgt = getTargetSpeed(Math.abs(nm(b.heading - w.direction)), b.raceState.spinnaker, w.speed);
                    const now = state.race.timer;
                    let turn = null;
                    if (lastH[b.name] != null && now > lastT[b.name])
                        turn = Math.abs(nm(b.heading - lastH[b.name])) * 180 / Math.PI / (now - lastT[b.name]);
                    lastH[b.name] = b.heading; lastT[b.name] = now;
                    out.push({ k, kt: +(b.speed * 4).toFixed(2), twa: +(Math.abs(nm(b.heading - w.direction)) * 180 / Math.PI).toFixed(1),
                        w: +w.speed.toFixed(2), cur: c ? +(c.speed * 4).toFixed(2) : 0, y: Math.round(b.y),
                        polar: +tgt.toFixed(2), luff: +(b.ai && b.ai.forcedLuff || 0).toFixed(2),
                        turn, trim: +(b.trimEfficiency != null ? b.trimEfficiency : 1).toFixed(2) });
                }
                if (state.boats.every(x => x.raceState.finished)) break;
            }
            return out;
        }, { seed: SEED0 + t, LEG, BANDS });
        for (const o of r) B[o.k].push(o);
    }
    await br.close();
    console.log('\n══ lagoon leg 4 — him vs the fleet, by x-band');
    console.log('x band            |  HIM: n   kt   TWA  turn |  FLEET: n    kt   TWA   wind  polar  set  luff  turn  trim');
    BANDS.forEach((bd, i) => {
        const h = H[i], b = B[i];
        const f = (a, k, d = 1) => a.length ? med(a.map(x => x[k])).toFixed(d) : '  -';
        console.log(`${(bd[0]+'..'+bd[1]).padEnd(17)} | ${String(h.length).padStart(7)} ${f(h,'kt',2).padStart(5)} ${f(h,'twa').padStart(5)} ${f(h,'turn',1).padStart(6)} | ${String(b.length).padStart(8)} ${f(b,'kt',2).padStart(5)} ${f(b,'twa').padStart(5)} ${f(b,'w',1).padStart(6)} ${f(b,'polar',2).padStart(6)} ${f(b,'cur',2).padStart(5)} ${f(b,'luff',2).padStart(5)} ${f(b,'turn',1).padStart(5)} ${f(b,'trim',2).padStart(5)}`);
    });
})();
