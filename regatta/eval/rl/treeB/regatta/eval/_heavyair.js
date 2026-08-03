// HEAVY-AIR RIG — the bench for the overpowered work (guidelines/overpowered-plan.md).
//
// Bluewater Bonanza with the breeze turned up. It is the right bench because it is the
// plainest thing in the game: a 4-leg windward-leeward, ONE uniform wind region, and NOT
// ONE PIECE OF LAND — so anything that moves is the boat model, not navigation. Glacier
// Sound would confound this badly; its fleet cannot get round the ice yet, and a change
// that made boats faster would show up as "fewer finishes" for a reason that has nothing
// to do with wind.
//
// The wind is raised AT RUNTIME rather than by editing the document: the venue on disk
// stays the venue the player races, and the knots are a parameter of the experiment.
//
//   node regatta/eval/_heavyair.js [knots...]        default: 12 18 25 32
//   node regatta/eval/_heavyair.js --seeds 4 25
//
// Reports, per wind speed:
//   AWS/AWA against TWS/TWA by point of sail   — is the apparent model right at all
//   sheeting angle vs boat speed at fixed TWA  — did phase 0 close the loop
//   speed by point of sail                     — the thing phases 1-3 are meant to change
//   finishes / penalties / elapsed             — did the fleet survive the change
const { chromium } = require('playwright');
const path = require('path');

const argv = process.argv.slice(2);
let seeds = 2;
const si = argv.indexOf('--seeds');
if (si >= 0) { seeds = +argv[si + 1]; argv.splice(si, 2); }
const WINDS = argv.length ? argv.map(Number) : [12, 18, 25, 32];

// Points of sail, by TRUE wind angle — the buckets a sailor would name.
const BANDS = [
    ['beat  30-55', 30, 55], ['close 55-80', 55, 80], ['beam  80-110', 80, 110],
    ['broad 110-150', 110, 150], ['run   150-180', 150, 180]
];

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: 'ocean', legLength: 800 })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(2500);

    const out = await page.evaluate(async ({ WINDS, BANDS, seeds }) => {
        const D = 180 / Math.PI;
        const results = [];

        // Turn the breeze up. Every venue's wind is stated by REGIONS now, so the region is
        // the thing to set — and `state.wind.baseSpeed` is derived from them, so it has to
        // move with them or `regionWindAt`'s leftover-weight term drags the field back down.
        const setWind = (kt) => {
            for (const r of (state.course.windRegions || [])) r.speed = kt;
            state.wind.baseSpeed = kt;
            state.wind.speed = kt;
        };

        // Same Mulberry32 the traces and the AI eval use, so a run here is comparable
        // with a run there on the same seed.
        let _s = 0;
        Math.random = () => {
            let t = _s += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        if (window.settings) { settings.soundEnabled = false; settings.bgSoundEnabled = false; }

        for (const kt of WINDS) {
            const row = { kt, fin: 0, pen: 0, elapsed: [], bands: {}, sheet: [], runGap: [] };
            for (const b of BANDS) row.bands[b[0]] = { n: 0, tws: 0, twa: 0, aws: 0, awa: 0, spd: 0, kite: 0, luff: 0, mid: 0, tog: 0, trim: 0, fl: 0, plane: 0, slim: 0, opt: 0, act: 0, gap: 0, heel: 0, over: 0 };

            for (let s = 0; s < seeds; s++) {
                _s = 90210 + s;
                resetGame();
                setWind(kt);                       // after reset — resetGame rebuilds the course
                startRace();
                while (state.race.status === 'prestart') update(1 / 60);
                setWind(kt);

                for (let f = 0; f < 60 * 60 * 6 && state.race.status === 'racing'; f++) {
                    update(1 / 60);
                    if (f % 7) continue;
                    for (const boat of state.boats) {
                        if (boat.raceState.finished || boat.raceState.leg < 1) continue;
                        const w = getWindAt(boat.x, boat.y);
                        const twa = Math.abs(normalizeAngle(boat.heading - w.direction)) * D;
                        const aw = boat.apparentWind || w;
                        const awa = Math.abs(normalizeAngle(boat.heading - aw.direction)) * D;
                        const kts = boat.speed / 0.25;

                        for (const [name, lo, hi] of BANDS) {
                            if (twa < lo || twa >= hi) continue;
                            const t = row.bands[name];
                            t.n++; t.tws += w.speed; t.twa += twa; t.aws += aw.speed; t.awa += awa; t.spd += kts;
                            t.trim += (boat.trimEfficiency !== undefined ? boat.trimEfficiency : 1);
                            t.fl += ((boat.ai && boat.ai.forcedLuff) || 0);
                            t.heel += (boat.heel || 0);
                            t.over += (boat.heel || 0) > 1 ? 1 : 0;
                            t.opt += (boat.optimalSailAngle || 0) * D;
                            t.act += Math.abs(boat.manualSailAngle || 0) * D;
                            t.gap += Math.abs(Math.abs(boat.manualSailAngle || 0) - (boat.optimalSailAngle || 0)) * D;
                            t.plane += boat.raceState.isPlaning ? 1 : 0;
                            t.slim += (boat._slim !== undefined ? boat._slim : 1);
                            t.kite += boat.spinnaker ? 1 : 0; t.luff += (boat.luffIntensity || 0);
                            // MID-HOIST: between 0.05 and 0.95 of deploy progress, where
                            // jibFactor and spinFactor BOTH collapse toward zero — the boat
                            // is carrying neither sail. A flickering kite decision lives here.
                            const dp = boat.spinnakerDeployProgress || 0;
                            if (dp > 0.05 && dp < 0.95) t.mid++;
                            if (boat._wasKite !== undefined && boat._wasKite !== boat.spinnaker) t.tog++;
                        }
                        // Does the sheet come in as the boat accelerates? Sampled on the beat,
                        // where TWA is nearly constant so boat speed is the only variable left.
                        // MAGNITUDE, not the signed angle: `sailAngle` carries `boomSide`,
                        // so port-tack samples are negative and cancel the starboard ones —
                        // the correlation of the signed value is meaningless.
                        // Run-band forensics: WHERE the sheet is when it is 20 degrees off.
                        if (twa >= 150 && row.runGap.length < 40000) {
                            row.runGap.push([
                                +((boat.optimalSailAngle || 0) * D).toFixed(1),
                                +(Math.abs(boat.sailAngle || 0) * D).toFixed(1),
                                boat.raceState.leg, boat.boomSide,
                                +((boat.spinnakerDeployProgress || 0)).toFixed(2)]);
                        }
                        if (twa > 38 && twa < 48 && boat.sailAngle !== undefined) {
                            row.sheet.push([+kts.toFixed(2), +(Math.abs(boat.sailAngle) * D).toFixed(2), +awa.toFixed(1)]);
                        }
                        boat._wasKite = boat.spinnaker;
                    }
                }
                for (const b of state.boats) {
                    if (b.raceState.finished) { row.fin++; row.elapsed.push(b.raceState.finishTime); }
                    row.pen += (b.raceState.totalPenalties || 0);
                }
            }
            results.push(row);
        }
        return results;
    }, { WINDS, BANDS, seeds });
    await browser.close();

    // Pearson correlation — the sign is the whole question for the sheet check.
    const corr = (xs, ys) => {
        const n = xs.length; if (n < 3) return NaN;
        const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
        let sxy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
        return sxy / (Math.sqrt(sxx * syy) || 1);
    };

    console.log('HEAVY AIR — Bluewater Bonanza (W/L, no land, uniform breeze)\n');
    for (const r of out) {
        const el = r.elapsed.length ? (r.elapsed.reduce((a, b) => a + b) / r.elapsed.length).toFixed(1) : '—';
        console.log(`── ${r.kt} kt ──  finishes ${r.fin}  penalties ${r.pen}  mean elapsed ${el}s`);
        console.log('   point of sail      TWS   TWA  |   AWS   AWA  |  boat   AWS/TWS  kite%  luff   mid%  trim   heel  over%');
        for (const [name] of BANDS) {
            const t = r.bands[name];
            if (!t.n) { console.log(`   ${name.padEnd(16)}  (never sailed)`); continue; }
            const f = k => (t[k] / t.n);
            console.log(`   ${name.padEnd(16)} ${f('tws').toFixed(1).padStart(5)} ${f('twa').toFixed(0).padStart(5)}  | ` +
                `${f('aws').toFixed(1).padStart(5)} ${f('awa').toFixed(0).padStart(5)}  | ` +
                `${f('spd').toFixed(2).padStart(5)}  ${(f('aws') / f('tws')).toFixed(2).padStart(5)}  ` +
                `${(f('kite') * 100).toFixed(0).padStart(4)}%  ${f('luff').toFixed(3)}  ${(f('mid') * 100).toFixed(0).padStart(4)}%  ${f('trim').toFixed(3)}  ${f('heel').toFixed(2).padStart(4)}  ${(f('over') * 100).toFixed(0).padStart(4)}%`);
        }
        const sp = r.sheet.map(s => s[0]), sa = r.sheet.map(s => s[1]), aw = r.sheet.map(s => s[2]);
        if (sp.length > 3) {
            const rng = a => `${Math.min(...a).toFixed(1)}–${Math.max(...a).toFixed(1)}`;
            console.log(`   on a beat (TWA 38-48, n=${sp.length}): boat ${rng(sp)} kt, AWA ${rng(aw)}°, sheet ${rng(sa)}°`);
            console.log(`   corr(boat speed, sheet angle) = ${corr(sp, sa).toFixed(3)}   ` +
                `[expect NEGATIVE: faster boat -> apparent forward -> sheet in]`);
        }
        if (r.runGap && r.runGap.length) {
            const g = r.runGap.map(v => Math.abs(v[1] - v[0])).sort((a, b) => a - b);
            const q = f => g[Math.min(g.length - 1, Math.floor(g.length * f))];
            console.log(`   run-band sheet gap  p50 ${q(.5).toFixed(1)}°  p75 ${q(.75).toFixed(1)}°  ` +
                `p90 ${q(.9).toFixed(1)}°  p99 ${q(.99).toFixed(1)}°   (n=${g.length})`);
            const bad = r.runGap.filter(v => Math.abs(v[1] - v[0]) > 15);
            if (bad.length) {
                const mean = (a, i) => (a.reduce((s, v) => s + v[i], 0) / a.length).toFixed(1);
                console.log(`   of the ${bad.length} worst (>15°): mean optimal ${mean(bad, 0)}°, ` +
                    `mean actual ${mean(bad, 1)}°, mean hoist ${mean(bad, 4)}, ` +
                    `boomSide ${[...new Set(bad.map(v => v[3]))].join('/')}`);
                const sheetedIn = bad.filter(v => v[1] < 10).length;
                console.log(`   ...and ${(sheetedIn / bad.length * 100).toFixed(0)}% of those have the sheet ` +
                    `HARD IN (<10°) while optimal says ease`);
            }
        }
        console.log('');
    }
    if (errs.length) console.log('PAGE ERRORS:', errs.slice(0, 3).join(' | '));
})();
