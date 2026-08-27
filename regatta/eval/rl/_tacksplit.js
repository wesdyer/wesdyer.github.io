// THE TACK-TIME SPLIT (2026-08-27, the last piece of the distance arithmetic).
// Path length = displacement / mean(cos(angle between velocity and the leg's
// chord)). Both helms sail the SAME |TWA| (38-39.5 deg) and the same cross-track,
// yet the fleet's path/straight ratio is 1.60 against his 1.43 — so the mean
// off-chord angle differs (51.3 deg against 44.5), and with equal tacking angles
// the only thing that can produce that is the SPLIT of time between the two
// tacks. A beat whose mark is off the wind axis has an optimal split; sailing
// 50/50 when the optimum is 80/20 costs distance without costing angle.
//   node _tacksplit.js <venue> <leg> <trials> <seed0> <tree> [fp]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3] || '1');
const TRIALS = parseInt(process.argv[4] || '6'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treeSPP');
const FP = process.argv[7] || null;
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const TD = path.join(__dirname, 'traj');
const hum = [];
for (const f of fs.readdirSync(TD).filter(x => x.startsWith('traj_' + VENUE + '_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (FP && String(j.venueFingerprint) !== FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 10) continue;
    const ax = gi(S[0], 'x'), ay = gi(S[0], 'y');
    const bx = gi(S[S.length - 1], 'x'), by = gi(S[S.length - 1], 'y');
    const ch = Math.atan2(bx - ax, -(by - ay));
    let stb = 0, prt = 0, cosSum = 0, n = 0;
    for (let i = 1; i < S.length; i++) {
        const tw = norm(gi(S[i], 'hdg') - gi(S[i], 'windDir'));
        const dt = gi(S[i], 't') - gi(S[i - 1], 't');
        if (Math.abs(tw) > 1.2) continue;
        (tw > 0 ? (stb += dt) : (prt += dt));
        cosSum += Math.cos(norm(gi(S[i], 'hdg') - ch)); n++;
    }
    if (stb + prt > 1) hum.push({ split: Math.max(stb, prt) / (stb + prt), cos: cosSum / n });
}
(async () => {
    const br = await chromium.launch(); const page = await br.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const bot = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const A = {}; const out = []; const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (const b of state.boats) {
                    if (b.raceState.finished) continue;
                    const a = A[b.name] = A[b.name] || { leg: null };
                    if (a.leg !== b.raceState.leg) {
                        if (a.leg === LEG && (a.stb + a.prt) > 1) {
                            const ch = Math.atan2(b.x - a.x0, -(b.y - a.y0));
                            out.push({ split: Math.max(a.stb, a.prt) / (a.stb + a.prt),
                                       cos: a.hs.reduce((p, h) => p + Math.cos(nm(h - ch)), 0) / a.hs.length });
                        }
                        a.leg = b.raceState.leg; a.stb = 0; a.prt = 0; a.x0 = b.x; a.y0 = b.y; a.hs = [];
                    }
                    if (b.raceState.leg !== LEG) continue;
                    const tw = nm(b.heading - getWindAt(b.x, b.y).direction);
                    if (Math.abs(tw) > 1.2) continue;
                    (tw > 0 ? (a.stb += dt) : (a.prt += dt));
                    if (a.hs.length < 6000) a.hs.push(b.heading);
                }
                if (state.boats.every(x => x.raceState.finished)) break;
            }
            return out;
        }, { seed: SEED0 + t, LEG });
        bot.push(...r);
    }
    await br.close();
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    console.log(`\n══ ${VENUE} leg ${LEG} — the tack-time split and the off-chord cosine`);
    console.log(`  HIM   n=${hum.length}  favoured-tack share med ${(med(hum.map(x=>x.split))*100).toFixed(1)}%   mean cos(off-chord) ${med(hum.map(x=>x.cos)).toFixed(3)}  ⇒ implied ratio ${(1/med(hum.map(x=>x.cos))).toFixed(3)}`);
    console.log(`  FLEET n=${bot.length}  favoured-tack share med ${(med(bot.map(x=>x.split))*100).toFixed(1)}%   mean cos(off-chord) ${med(bot.map(x=>x.cos)).toFixed(3)}  ⇒ implied ratio ${(1/med(bot.map(x=>x.cos))).toFixed(3)}`);
})();
