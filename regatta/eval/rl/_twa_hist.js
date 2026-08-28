// POINTING vs DETOUR (2026-08-27). The atlas says the fleet sails 15-38%
// further than he does on every open-water leg while often being FASTER through
// the water. Two things produce that and they want opposite fixes:
//   POINTING — the fleet sails a wider angle to the wind, so every unit of
//              windward progress costs more distance (and buys speed);
//   DETOUR   — the fleet's track wanders off the direct line for reasons
//              (avoidance, tack churn) that have nothing to do with the angle.
// Separate them: histogram |TWA| over UNDISTURBED frames only — no avoidance
// deviation, not inside 4 s of a side change, not armed — and compare with his
// own frames on the same leg. Same filter cannot be applied to him (his
// recording has no avoidance state), so his is the unconditional distribution
// and the fleet's is the FAVOURABLE one: if the fleet still points wider there,
// the pointing gap is real and is a floor.
//   node _twa_hist.js <venue> <leg> <trials> <seed0> <tree> [fp]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3] || '1');
const TRIALS = parseInt(process.argv[4] || '8'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treeSPP');
const FP = process.argv[7] || null;
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const TD = path.join(__dirname, 'traj');
const hum = [];
for (const f of fs.readdirSync(TD).filter(x => x.startsWith('traj_' + VENUE + '_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (FP && String(j.venueFingerprint) !== FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    for (const s of j.samples) {
        if (gi(s, 'phase') !== 1 || gi(s, 'leg') !== LEG) continue;
        const twa = Math.abs(norm(gi(s, 'hdg') - gi(s, 'windDir'))) * 180 / Math.PI;
        if (gi(s, 'spd') * 4 > 1) hum.push({ twa, kt: gi(s, 'spd') * 4 });
    }
}
(async () => {
    const browser = await chromium.launch(); const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const bot = [], botAll = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(b => b !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            for (const b of state.boats) { const c = b.controller; if (!c || !c.applyAvoidance || c.__w) continue;
                const o = c.applyAvoidance.bind(c);
                c.applyAvoidance = (dh, sr) => { const r = o(dh, sr); b._avDev = Math.abs(nm(r - dh)); return r; }; c.__w = 1; }
            const clean = [], all = [], side = {}, lastFlip = {};
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const tm = state.race.timer; if (tm > 900) break;
                for (const b of state.boats) {
                    if (b.raceState.finished || b.raceState.leg !== LEG) continue;
                    const w = getWindAt(b.x, b.y);
                    const tw = nm(b.heading - w.direction), sd = tw > 0 ? 1 : -1;
                    if (side[b.name] !== undefined && sd !== side[b.name]) lastFlip[b.name] = tm;
                    side[b.name] = sd;
                    const kt = b.speed * 4; if (kt <= 1) continue;
                    const twa = Math.abs(tw) * 180 / Math.PI;
                    all.push({ twa, kt });
                    if ((b._avDev || 0) <= 0.02 && !b.raceState.roundArmed
                        && (lastFlip[b.name] == null || tm - lastFlip[b.name] > 4)) clean.push({ twa, kt });
                }
                if (state.boats.every(b => b.raceState.finished)) break;
            }
            return { clean, all };
        }, { seed: SEED0 + t, LEG });
        bot.push(...r.clean); botAll.push(...r.all);
    }
    await browser.close();
    const upw = a => a.filter(x => x.twa < 75);
    const show = (name, a) => {
        const u = upw(a);
        console.log(`  ${name.padEnd(22)} n=${String(u.length).padStart(6)}  |TWA| p10 ${q(u.map(x=>x.twa),.1).toFixed(1)}  p25 ${q(u.map(x=>x.twa),.25).toFixed(1)}  MED ${q(u.map(x=>x.twa),.5).toFixed(1)}  p75 ${q(u.map(x=>x.twa),.75).toFixed(1)}  |  kt med ${q(u.map(x=>x.kt),.5).toFixed(2)}  |  VMG med ${q(u.map(x=>x.kt*Math.cos(x.twa*Math.PI/180)),.5).toFixed(2)}`);
    };
    console.log(`\n══ ${VENUE} leg ${LEG} — UPWIND pointing (frames under 75° TWA, over 1 kt)`);
    show('HIM (all frames)', hum);
    show('fleet (undisturbed)', bot);
    show('fleet (all frames)', botAll);
})();
