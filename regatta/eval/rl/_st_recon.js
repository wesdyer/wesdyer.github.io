// START RECON (2026-08-27) — the physical state of the prestart hold and the
// crossing run, per boat-start. Written to test ONE hypothesis before any
// candidate exists:
//   getStartCommand's pre-cross hold returns { heading: wd } = HEAD TO WIND
//   (TWA 0 is head-to-wind, standing rule 19), so the boat sits in irons with
//   no drive, while getApproachTime models the crossing run as if the boat
//   sails the close-hauled polar (TWA 0.7) from the first 100 ms step.
// If true, the estimate is short by the bear-away, and the miss scales with
// how long it takes to accelerate out of irons -> light air (swamp) and set
// (river) worst, breezy short runs (bay/seatrials) fine. THAT is the venue
// ordering of the measured leg-0 deficit, so the probe must confirm or kill it.
//
// Per boat-start it records: commit frame (startCommitted false->true), the
// controller's own estimate recomputed there, speed/TWA at commit, the last
// 20 prestart seconds of TWA/speed (irons share = TWA < 0.55, the engine's own
// no-go tax band), speed/TWA/line distance at the gun, first crossing, OCS at
// the gun, post-commit blocked seconds (avoidance deviation > 0.12 rad).
//
// TEN-BOT ERA (_tb_gates.md): the player boat is converted, not parked.
// LATE venue write (standing rule 30) so river/lagoon/swamp are reproducible.
//   node _st_recon.js <tree> <venue> <seed0> <nraces>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const VENUE = process.argv[3] || 'swamp';
const SEED0 = parseInt(process.argv[4] || '9400');
const NRACES = parseInt(process.argv[5] || '2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
    }, VENUE);
    const rows = [];
    for (let race = 0; race < NRACES; race++) {
        const seed = SEED0 + race;
        const out = await page.evaluate(async ({ seed }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            if (pl) {
                applyBoatIdentity(pl, playerCharacter(), false);
                pl.isPlayer = false; pl.manualTrim = false;
                const nine = state.boats.filter(b => b !== pl);
                pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                    nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
                pl.ai.setupDist = 300;
            }
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const rec = {};
            for (const b of state.boats) rec[b.name] = {
                name: b.name, commit: null, est: null, spCommit: null, twaCommit: null, behindCommit: null,
                ironsF: 0, totF: 0, spSum: 0, gunSp: null, gunTwa: null, gunOff: null, gunOcs: null,
                cross: null, blocked: 0, drift: 0, lastX: b.x, lastY: b.y, buf: null
            };
            let crossed = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'leg_complete' && d && d.leg === 0 && d.boat && rec[d.boat.name] && rec[d.boat.name].cross == null)
                    rec[d.boat.name].cross = d.time;   // after the gun the timer counts UP (elapsed)
                if (inner) return inner(ty, d);
            };
            // wrap avoidance to see post-commit deviation
            for (const bo of state.boats) {
                const c = bo.controller; if (!c || !c.applyAvoidance || c.__w) continue;
                const orig = c.applyAvoidance.bind(c);
                c.applyAvoidance = (dh, sr) => { const o = orig(dh, sr); bo._avDev = Math.abs(norm(o - dh)); return o; };
                c.__w = 1;
            }
            let gunDone = false;
            const step = () => {
                const t = state.race.timer;
                for (const b of state.boats) {
                    const r = rec[b.name]; if (!r) continue;
                    const c = b.controller; if (!c) continue;
                    const w = getWindAt(b.x, b.y);
                    const twa = Math.abs(norm(b.heading - w.direction));
                    const [M0, M1] = startLinePts();
                    const behindNow = -hullLineOffset(b, M0, M1, true);
                    if (r.commit == null && c.startCommitted) {
                        r.commitAtGun = !(t > 0);
                        {
                            r.commit = +(t > 0 ? t : 0).toFixed(2);
                            r.spCommit = +(b.speed * 4).toFixed(2);
                            r.twaCommit = +twa.toFixed(3);
                            r.behindCommit = +behindNow.toFixed(1);
                            r.buf = +(0.5 + (b.traits ? b.traits.startBufAdj : 0)).toFixed(2);
                            try { r.est = +c.getApproachTime(60 / Math.cos(0.7), b.speed, b.stats).toFixed(2); } catch (e) { r.est = null; }
                            try { r.estTrue = +c.getApproachTime(Math.max(0, behindNow) / Math.cos(0.7), b.speed, b.stats).toFixed(2); } catch (e) { r.estTrue = null; }
                        }
                    }
                    if (t > 0) {
                        if (t < 20) { r.totF++; if (twa < 0.55) r.ironsF++; r.spSum += b.speed * 4; }
                    } else {
                        if (!gunDone) {
                            r.gunSp = +(b.speed * 4).toFixed(2); r.gunTwa = +twa.toFixed(3);
                            const [m0, m1] = [M0, M1];
                            r.gunOff = +hullLineOffset(b, m0, m1, true).toFixed(1); r.gunBehind = +behindNow.toFixed(1);
                            r.gunOcs = !!(b.raceState && b.raceState.ocs);
                        }
                        if (r.cross == null && r.commit != null && (b._avDev || 0) > 0.12) r.blocked += 1 / 60;
                    }
                    if (t > 0 && t < 20) r.drift += Math.hypot(b.x - r.lastX, b.y - r.lastY);
                    r.lastX = b.x; r.lastY = b.y;
                }
                if (state.race.timer <= 0) gunDone = true;
            };
            const origUpdate = window.update;
            window.update = (dt) => { origUpdate(dt); step(); };
            let guard = 0;
            while (state.race.status !== 'finished' && guard < 60 * 90) { window.update(1 / 60); guard++; }
            window.update = origUpdate;
            const wind = getWindAt(state.boats[0].x, state.boats[0].y);
            return { seed, wind: +wind.speed.toFixed(2), rows: Object.values(rec).map(r => ({
                name: r.name, commit: r.commit, est: r.est, buf: r.buf, spCommit: r.spCommit,
                twaCommit: r.twaCommit, behindCommit: r.behindCommit,
                ironsPct: r.totF ? +(100 * r.ironsF / r.totF).toFixed(0) : null,
                spPre: r.totF ? +(r.spSum / r.totF).toFixed(2) : null,
                driftPre: +r.drift.toFixed(0),
                gunSp: r.gunSp, gunTwa: r.gunTwa, gunOff: r.gunOff, gunOcs: r.gunOcs,
                estTrue: r.estTrue, commitAtGun: !!r.commitAtGun, gunBehind: r.gunBehind,
                cross: r.cross == null ? null : +r.cross.toFixed(2), blocked: +r.blocked.toFixed(2)
            })) };
        }, { seed });
        rows.push(out);
        console.log(`race ${race} seed ${seed} wind ${out.wind}kt`);
    }
    await browser.close();
    const all = [].concat(...rows.map(r => r.rows));
    const q = (a, p) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? +s[Math.floor(p * (s.length - 1))].toFixed(2) : NaN; };
    const col = k => all.map(r => r[k]);
    console.log(`\n== ${VENUE} ${TREE} n=${all.length} boat-starts, wind ${rows.map(r=>r.wind).join('/')}kt`);
    console.log(`  irons share of last 20 prestart s (TWA<0.55): med ${q(col('ironsPct'),.5)}%  p25 ${q(col('ironsPct'),.25)} p75 ${q(col('ironsPct'),.75)}`);
    console.log(`  mean prestart speed (kt):        med ${q(col('spPre'),.5)}   drift over last 20s (u): med ${q(col('driftPre'),.5)}`);
    console.log(`  commit timer (s before gun):     med ${q(col('commit'),.5)}   estimate: med ${q(col('est'),.5)}  BUF med ${q(col('buf'),.5)}`);
    console.log(`  speed AT COMMIT (kt):            med ${q(col('spCommit'),.5)}   TWA at commit (rad): med ${q(col('twaCommit'),.5)}`);
    console.log(`  behind line AT COMMIT (u):       med ${q(col('behindCommit'),.5)}  p75 ${q(col('behindCommit'),.75)}   [the estimator ASSUMES 78u]`);
    console.log(`  estimate on the TRUE distance:   med ${q(col('estTrue'),.5)}s vs nominal-78u estimate med ${q(col('est'),.5)}s`);
    console.log(`  committed only AT the gun:       ${(100*all.filter(r=>r.commitAtGun).length/all.length).toFixed(0)}% of boats`);
    console.log(`  behind line AT THE GUN (u):      med ${q(col('gunBehind'),.5)}  p75 ${q(col('gunBehind'),.75)}`);
    console.log(`  AT THE GUN: speed med ${q(col('gunSp'),.5)}kt  TWA med ${q(col('gunTwa'),.5)}  line offset med ${q(col('gunOff'),.5)}u  OCS ${(100*all.filter(r=>r.gunOcs).length/all.length).toFixed(0)}%`);
    console.log(`  CROSSING (s after gun):          med ${q(col('cross'),.5)}  p25 ${q(col('cross'),.25)} p75 ${q(col('cross'),.75)} p90 ${q(col('cross'),.9)}`);
    const realized = all.filter(r => r.commit != null && r.cross != null).map(r => r.commit + r.cross);
    const estErr = all.filter(r => r.commit != null && r.cross != null && r.est != null).map(r => (r.commit + r.cross) - (r.est + r.buf));
    console.log(`  realized run (commit->cross):    med ${q(realized,.5)}s   estErr (realized - est - BUF): med ${q(estErr,.5)}s  p75 ${q(estErr,.75)}`);
    console.log(`  blocked seconds post-commit:     med ${q(col('blocked'),.5)}s  p75 ${q(col('blocked'),.75)}`);
    fs.writeFileSync(path.join(__dirname, `_st_recon_${TREE}_${VENUE}_${SEED0}.json`), JSON.stringify(rows, null, 1));
})();
