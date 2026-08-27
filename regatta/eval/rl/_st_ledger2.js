// THE START LEDGER v2 — THE START PUSH P1 census (2026-08-27, pre-registered
// in memory regatta-start-push-plan). Supersedes _start_ledger.js, which
// predates the ten-bot cut AND uses the EARLY venue write (standing rule 30 —
// wrong on river/lagoon/swamp, two of the three venues that matter here).
//
// THE QUESTION (registered before any candidate exists): the fleet crosses the
// line 0.7-17 s after the gun while he crosses in 1-3 s. Is that the estimator
// (`tCross` prices a NOMINAL 78u run from a stalled boat) or is it traffic
// bending the run (bay's 2026-08-06 answer)? The ledger splits it per boat.
//
//   estErr  = realized - (est78 + BUF)   -- the controller's own miss
//   blocked = seconds FROM THE COMMIT FRAME to the crossing in which avoidance
//             bent the course (|applyAvoidance out - in| > 0.12 rad)
//             ⚠ _st_recon counted only POST-GUN frames; this one counts from
//             the commit, which is the honest window.
//   estTrue = the SAME pure function on the boat's ACTUAL distance to the line
//             -- how much of the miss is the nominal distance alone.
//
// REGISTERED KILL BAR: river+swamp pooled, estErr >= 3x blocked at n >= 150
// boat-starts, else the estimator thread is DEAD PRE-BUILD.
// REGISTERED SECOND READ: share with behindCommit >= 1.5 * 78u must be >= 60%.
//
// Ten-bot conversion + LATE venue write + sequence replay from the bench seed0
// (rules 30/34); the race loop mirrors ocean_bench's so `fins` validate against
// the anchor JSON boat-for-boat.
//   node _st_ledger2.js <tree> <venue> <seed0> <nraces> [benchLabel]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const VENUE = process.argv[3] || 'river';
const SEED0 = parseInt(process.argv[4] || '9400');
const NRACES = parseInt(process.argv[5] || '8');
const BENCH = process.argv[6] || '';
// ST_FAST=1 — stop each race 60 s after the gun. Everything this ledger reads
// (commit, crossing, gun state, blocked, scrum) has resolved by then, so the
// mechanism screen costs a tenth of a full race. ⚠️ fins are NOT produced, so
// the replay self-validation is OFF: use FAST only for candidate-vs-control
// START statistics, never to publish a fleet number.
const FAST = process.env.ST_FAST === '1';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
    }, VENUE);
    const races = [];
    for (let race = 0; race < NRACES; race++) {
        const seed = SEED0 + race;
        const r = await page.evaluate(async ({ seed, fast }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false);
            pl.isPlayer = false; pl.manualTrim = false;
            {
                const nine = state.boats.filter(b => b !== pl);
                pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                    nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
                pl.ai.setupDist = 300;
            }
            const boats = state.boats.slice();
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const cosT = Math.cos(0.7);
            // ⚠️ THE CONTROLLER'S OWN STAGE, not the 60 the code says it wants.
            // repositionBoats does `boat.controller.startStageDepth = 60`, but the
            // controller is created lazily by updateAI AFTER repositionBoats runs,
            // so the write is DEAD and every bot keeps the constructor's 200
            // (_stage_check.js: controllers at reposition = 0, depths 200 x9, both
            // races of a process). Read it off the controller or the ledger prices
            // an estimate the controller never made (standing rule 18).
            const R = {};
            for (const b of boats) R[b.name] = {
                name: b.name, commit: null, atGun: false, est78: null, estTrue: null, buf: null,
                spCommit: null, twaCommit: null, behindCommit: null,
                ironsF: 0, stallF: 0, preF: 0, behind20: null,
                gunSp: null, gunTwa: null, gunBehind: null, gunOcs: false, everOcs: false, stage: null, gunPct: null,
                cross: null, blocked: 0, scrum: 0, fin: null
            };
            // crossing + start-scrum contacts off the engine's own events
            const inner = window.onRaceEvent; const CT = {};
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'leg_complete' && d && d.leg === 0 && d.boat && R[d.boat.name] && R[d.boat.name].cross == null)
                        R[d.boat.name].cross = +d.time;      // after the gun the timer counts UP
                    if (ty === 'collision_boat' && d && d.boat && R[d.boat.name]
                        && state.race.status === 'racing' && state.race.timer <= 30) {
                        const k = d.boat.name, t = state.race.timer;
                        if (CT[k] == null || t - CT[k] >= 0.5) { CT[k] = t; R[k].scrum++; }
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            for (const b of boats) {
                const c = b.controller; if (!c || !c.applyAvoidance || c.__w) continue;
                const orig = c.applyAvoidance.bind(c);
                c.applyAvoidance = (dh, sr) => { const o = orig(dh, sr); b._avDev = Math.abs(norm(o - dh)); return o; };
                c.__w = 1;
            }
            const dt = 1 / 60;
            const observe = () => {
                const pre = state.race.status === 'prestart';
                const t = state.race.timer;
                if (!pre && t > 60) return;   // everything this ledger reads resolves in the first minute
                const [m0, m1] = startLinePts();
                for (const b of boats) {
                    const r = R[b.name]; const c = b.controller; if (!r || !c) continue;
                    const behind = -hullLineOffset(b, m0, m1, true);
                    const w = getWindAt(b.x, b.y);
                    const twa = Math.abs(norm(b.heading - w.direction));
                    if (pre) {
                        if (t <= 20) {
                            r.preF++; if (twa < 0.55) r.ironsF++; if (b.speed * 4 < 1.0) r.stallF++;
                            if (r.behind20 == null) r.behind20 = behind;
                        }
                        if (r.commit == null && c.startCommitted) {
                            r.commit = +t.toFixed(2); r.spCommit = +(b.speed * 4).toFixed(2);
                            r.twaCommit = +twa.toFixed(3); r.behindCommit = +behind.toFixed(1);
                            r.buf = +(0.5 + (b.traits ? b.traits.startBufAdj : 0)).toFixed(2);
                            r.stage = c.startStageDepth || 60;
                            r.est78 = +c.getApproachTime(r.stage / cosT, b.speed, b.stats).toFixed(2);
                            r.estTrue = +c.getApproachTime(Math.max(0, behind) / cosT, b.speed, b.stats).toFixed(2);
                        }
                    } else {
                        if (r.commit == null && c.startCommitted) {
                            r.commit = 0; r.atGun = true; r.spCommit = +(b.speed * 4).toFixed(2);
                            r.twaCommit = +twa.toFixed(3); r.behindCommit = +behind.toFixed(1);
                            r.buf = +(0.5 + (b.traits ? b.traits.startBufAdj : 0)).toFixed(2);
                            r.stage = c.startStageDepth || 60;
                            r.est78 = +c.getApproachTime(r.stage / cosT, b.speed, b.stats).toFixed(2);
                            r.estTrue = +c.getApproachTime(Math.max(0, behind) / cosT, b.speed, b.stats).toFixed(2);
                        }
                        if (r.gunSp == null) {
                            r.gunSp = +(b.speed * 4).toFixed(2); r.gunTwa = +twa.toFixed(3);
                            r.gunBehind = +behind.toFixed(1); r.gunOcs = !!(b.raceState && b.raceState.ocs);
                            // where along the LINE she is at the gun: outside [0,1] means
                            // outside the segment, where a crossing does not count at all
                            // (getStartCommand's own lane comment records that failure).
                            r.gunPct = +(((b.x - m0.x) * (m1.x - m0.x) + (b.y - m0.y) * (m1.y - m0.y))
                                / (((m1.x - m0.x) ** 2 + (m1.y - m0.y) ** 2) || 1)).toFixed(3);
                        }
                    }
                    if (r.commit != null && r.cross == null && (b._avDev || 0) > 0.12) r.blocked += dt;
                    // ⚠️ OCS AT THE GUN, NOT OCS-EVER. The first version OR'd the flag in
                    // on every pre-start frame, so a boat that dipped over at T-15 and
                    // returned by T-5 counted as OCS — the same trap _start_all.js hit on
                    // 2026-08-14, and here it read 25-48% on candidates whose boats were
                    // 86 u behind the line at the gun. `everOcs` keeps the dip as its own
                    // column, because returning costs time either way.
                    if (pre && b.raceState && b.raceState.ocs) r.everOcs = true;
                }
            };
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                observe();
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer; if (t > 900) break;
                if (fast && t > 60) break;
                let all = true;
                for (const b of boats) {
                    const r = R[b.name];
                    if (b.raceState.finished) { if (r.fin == null) r.fin = Math.round(t); }
                    else all = false;
                }
                if (all) break;
            }
            return { seed, rows: Object.values(R) };
        }, { seed, fast: FAST });
        races.push(r);
        const fins = r.rows.filter(x => x.fin != null).map(x => x.fin).sort((a, b) => a - b);
        console.log(`  race ${race} seed ${seed}: ${fins.length} fins ${fins.join(',')}`);
    }
    await browser.close();

    // ── fins validation against the anchor bench (rule 34's self-check) ──
    if (BENCH && !FAST) {
        const f = path.join(__dirname, `ocean_bench_${BENCH}.json`);
        if (fs.existsSync(f)) {
            const bj = JSON.parse(fs.readFileSync(f, 'utf8'));
            let ok = 0, bad = 0;
            for (let i = 0; i < Math.min(bj.length, races.length); i++) {
                const bm = {}; for (const b of bj[i].info) bm[b.name] = b.fin;
                let same = true;
                for (const r of races[i].rows) if ((bm[r.name] === undefined ? null : bm[r.name]) !== r.fin) same = false;
                if (same) ok++; else bad++;
            }
            console.log(`\nFINS VALIDATION vs ${BENCH}: ${ok} match / ${bad} differ`);
            if (bad) console.log('  ⚠️ REPLAY DOES NOT MATCH THE BENCH — do not read this census.');
        } else console.log(`\n⚠️ bench ${BENCH} not found — replay unvalidated`);
    }

    const all = [].concat(...races.map(r => r.rows));
    const q = (a, p) => { const s = a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? +s[Math.floor(p * (s.length - 1))].toFixed(2) : NaN; };
    const col = k => all.map(r => r[k]);
    const realized = all.map(r => (r.commit != null && r.cross != null) ? r.commit + r.cross : null);
    const estErr = all.map((r, i) => (realized[i] != null && r.est78 != null) ? realized[i] - (r.est78 + r.buf) : null);
    const estErrTrue = all.map((r, i) => (realized[i] != null && r.estTrue != null) ? realized[i] - (r.estTrue + r.buf) : null);
    const stageMed = q(col('stage'), .5);
    const far = all.filter(r => r.behindCommit != null && r.stage != null && r.behindCommit >= 1.5 * (r.stage / Math.cos(0.7)));
    const drift = all.map(r => (r.behind20 != null && r.gunBehind != null) ? r.gunBehind - r.behind20 : null);
    console.log(`\n══ ${VENUE}  ${TREE}  n=${all.length} boat-starts (${races.length} races from seed ${SEED0})`);
    console.log(`  crossing after gun (s):   med ${q(col('cross'),.5)}  p25 ${q(col('cross'),.25)} p75 ${q(col('cross'),.75)} p90 ${q(col('cross'),.9)}`);
    console.log(`  commit (s before gun):    med ${q(col('commit'),.5)}   est78 med ${q(col('est78'),.5)}  estTrue med ${q(col('estTrue'),.5)}  BUF med ${q(col('buf'),.5)}`);
    console.log(`  AT COMMIT: speed ${q(col('spCommit'),.5)} kt   TWA ${q(col('twaCommit'),.5)} rad   behind line ${q(col('behindCommit'),.5)} u   [the controller's staged run = ${stageMed}/cos0.7 = ${(stageMed/Math.cos(0.7)).toFixed(0)} u]`);
    console.log(`  prestart last 20s: irons(TWA<0.55) ${q(col('ironsF').map((x,i)=>all[i].preF?100*x/all[i].preF:null),.5)}%   stalled(<1kt) ${q(col('stallF').map((x,i)=>all[i].preF?100*x/all[i].preF:null),.5)}%   drift back over the 20s ${q(drift,.5)} u`);
    console.log(`  AT THE GUN: speed ${q(col('gunSp'),.5)} kt  behind ${q(col('gunBehind'),.5)} u  OCS at the gun ${(100*all.filter(r=>r.gunOcs).length/all.length).toFixed(1)}%  (ever flagged in the pre-start ${(100*all.filter(r=>r.everOcs).length/all.length).toFixed(1)}%)`);
    console.log(`  realized run med ${q(realized,.5)} s`);
    console.log(`  ⭐ estErr (vs the controller's own staged estimate) med ${q(estErr,.5)} s   p75 ${q(estErr,.75)}`);
    console.log(`     estErr if the estimate had used the TRUE distance: med ${q(estErrTrue,.5)} s  ⇒ the nominal distance alone owns ${(q(estErr,.5)-q(estErrTrue,.5)).toFixed(2)} s`);
    console.log(`  ⭐ blocked (avoidance, commit→cross) med ${q(col('blocked'),.5)} s   p75 ${q(col('blocked'),.75)}   mean ${(col('blocked').reduce((a,b)=>a+b,0)/all.length).toFixed(2)}`);
    console.log(`  REGISTERED READ 2: behindCommit ≥ 1.5× the staged run in ${(100*far.length/all.length).toFixed(1)}% of starts (bar ≥60%)`);
    console.log(`  outside the start segment at the gun: ${(100*all.filter(r=>r.gunPct!=null && (r.gunPct<0||r.gunPct>1)).length/all.length).toFixed(1)}%  (pct med ${q(col('gunPct'),.5)})
  start-scrum boat contacts in the first 30 s: ${(col('scrum').reduce((a,b)=>a+b,0)/all.length).toFixed(2)} per boat`);
    fs.writeFileSync(path.join(__dirname, `_st_ledger2_${TREE}_${VENUE}_${SEED0}${FAST ? '_fast' : ''}.json`), JSON.stringify(races));
    console.log(`  saved _st_ledger2_${TREE}_${VENUE}_${SEED0}${FAST ? '_fast' : ''}.json`);
})();
