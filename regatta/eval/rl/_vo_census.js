// VOLCANIC CENSUS — Emberfall's attribution instrument (2026-09-13, THE VOLCANO PUSH).
// Ten-bot replay of an ocean_bench set (same conversion, LATE venue write, sequence from
// seed0 — standing rules 30/34), fins-validated boat-for-boat against the bench JSON.
// Counts EPISODES, not frames (rule 2), sampled at 10 Hz, and prices each one on the
// CLOCK: progress made good along the leg's route polyline (CoursePath.project, summed
// over legs into one course odometer) during the episode, against the counterfactual at
// the boat's OWN rate over the 3 s before onset. lost_s = lost_u / rate_pre.
//   FRY   Volcano.fryOf(boat): the outage. Leg, |TWA| and speed at onset/end, irons
//         (<0.55) and luff (<0.75) share during, min speed, heading vs wind drift over
//         the outage, progress lost, contacts during, a tack/gybe within 3 s of the
//         reboot (a DEFERRED manoeuvre), whether a dodge preceded it, restarts.
//   DODGE controller._dodgeGo with _dodgeKey set while not fried: the helm answering a
//         marked strike. Duration, progress lost, aimed-at-me, the fry that followed.
//   BOIL  boat.boil > 0.1.   DEAD  Volcano.windMul(x,y) < 0.6.
//   START per boat: commit time, the wind's signed offset from the line's course-side
//         normal at commit, est78+BUF vs realized, behind/speed/TWA at the gun, tack at
//         gun+1 s and its heading's angle off the normal, OCS at the gun, ever-OCS,
//         OCS while racing (the return), crossing time.
//   node _vo_census.js <tree> <seed0> <nraces> [benchLabel] [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeVO0';
const ROOT = path.join(__dirname, TREE);
const SEED0 = parseInt(process.argv[3] || '9400');
const NRACES = parseInt(process.argv[4] || '8');
const BENCH = process.argv[5] || '';
const VENUE = process.argv[6] || 'volcanic';   // the start section is venue-generic; the weather episodes are empty elsewhere
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
        const r = await page.evaluate(async ({ seed }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false);
            pl.isPlayer = false; pl.manualTrim = false;
            {
                const nine = state.boats.filter(b => b !== pl);
                pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
                pl.ai.setupDist = 300;
            }
            const boats = state.boats.slice();
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const legs = state.course.dmc.legs, nLegs = legs.length;
            const legLen = legs.map(l => l.length || 0);
            const cum = []; { let a = 0; for (let i = 0; i < nLegs; i++) { cum[i] = a; a += legLen[i]; } }
            const [m0, m1] = startLinePts();
            const ldx = m1.x - m0.x, ldy = m1.y - m0.y, lL = Math.hypot(ldx, ldy) || 1;
            const sgn = startCrossSign();
            const nx = sgn * ldy / lL, ny = -sgn * ldx / lL;          // course-side normal (d = n·(p-m0))
            const normalDir = Math.atan2(nx, -ny);                    // heading 0 = -y
            const wdOff = (wd) => { const ux = Math.sin(wd), uy = -Math.cos(wd); return Math.atan2(nx * uy - ny * ux, nx * ux + ny * uy); };
            const cosT = Math.cos(0.7);
            const R = {}, S = {};
            for (const b of boats) {
                R[b.name] = { name: b.name, fin: null, legT: {}, cross: null, preFries: 0,
                              start: { commit: null, wdOffC: null, spC: null, behindC: null, est: null, buf: null,
                                       gunBehind: null, gunSp: null, gunOcs: null, gunTwa: null, wdOffGun: null,
                                       tack1: null, hdgOff1: null, everOcs: false, ocsRacing: false, ocsClearT: null, wsC: null, wsG: null, wsX: null, crossSp: null, clearSp: null, clearTwa: null, clearBehind: null, tgs: null, accelMod: null, run: [] },
                              fries: [], dodges: [], boils: [], deads: [] };
                S[b.name] = { hist: [], hint: {}, ep: { fry: null, dodge: null, boil: null, dead: null }, posts: [], col: [], lastDodgeEnd: -99, lastFryRef: null };
            }
            const inner = window.onRaceEvent; const CT = {};
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'leg_complete' && d && d.leg === 0 && d.boat && R[d.boat.name] && R[d.boat.name].cross == null)
                        { R[d.boat.name].cross = +d.time; R[d.boat.name].start.wsX = +getWindAt(d.boat.x, d.boat.y).speed.toFixed(1); R[d.boat.name].start.crossSp = +(d.boat.speed * 4).toFixed(2); }
                    if (d && d.boat && R[d.boat.name] && state.race.status === 'racing'
                        && (ty === 'collision_boat' || ty === 'collision_mark' || ty === 'collision_island' || ty === 'collision_boundary')) {
                        const cat = ty === 'collision_boat' ? 'boat' : ty === 'collision_mark' ? 'mark' : ty === 'collision_island' ? 'land' : 'bounds';
                        const k = d.boat.name + ':' + cat, t = state.race.timer;
                        if (CT[k] == null || t - CT[k] >= 0.5) { CT[k] = t; S[d.boat.name].col.push({ t, cat }); }
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const prog = (b, s) => {
                const lg = b.raceState.leg;
                if (lg < 1 || lg >= nLegs || !legs[lg]) return null;
                const p = CoursePath.project(legs[lg], b.x, b.y, s.hint[lg] != null ? s.hint[lg] : null);
                s.hint[lg] = p;
                return cum[lg] + p;
            };
            const ratePre = (s, t, P) => {
                // the sample nearest 3 s back, needing at least 1.5 s of history
                let best = null;
                for (let i = s.hist.length - 1; i >= 0; i--) { const h = s.hist[i]; if (t - h.t >= 3) { best = h; break; } best = h; }
                if (!best || t - best.t < 1.5 || best.P == null) return null;
                return (P - best.P) / (t - best.t);
            };
            const open = (kind, b, s, t, P, extra) => {
                const wd = getWindAt(b.x, b.y).direction, twa = norm(b.heading - wd);
                const ep = { kind, t0: +t.toFixed(1), lg0: b.raceState.leg, P0: P, twa0: +Math.abs(twa).toFixed(3), spd0: +(b.speed * 4).toFixed(2),
                             hdg0: b.heading, wd0: wd, armed0: !!b.raceState.roundArmed, rate0: ratePre(s, t, P),
                             minTwa: Math.abs(twa), ironsN: 0, luffN: 0, n: 0, minSpd: b.speed * 4, tacksDuring: 0, lastSign: twa >= 0 ? 1 : -1,
                             wiggleN: 0, ...extra };
                return ep;
            };
            const tick = (ep, b, wd) => {
                const twa = norm(b.heading - wd), a = Math.abs(twa);
                ep.n++; if (a < 0.55) ep.ironsN++; if (a < 0.75) ep.luffN++; if (a < ep.minTwa) ep.minTwa = a;
                const kt = b.speed * 4; if (kt < ep.minSpd) ep.minSpd = kt;
                const sg = twa >= 0 ? 1 : -1; if (sg !== ep.lastSign) { ep.tacksDuring++; ep.lastSign = sg; }
                if (b.controller && b.controller.wiggleActive) ep.wiggleN++;
            };
            const close = (ep, b, s, t, P) => {
                const wd = getWindAt(b.x, b.y).direction;
                ep.t1 = +t.toFixed(1); ep.dur = +(t - ep.t0).toFixed(1); ep.lg1 = b.raceState.leg;
                ep.twa1 = +Math.abs(norm(b.heading - wd)).toFixed(3); ep.spd1 = +(b.speed * 4).toFixed(2);
                ep.hdgDrift = +Math.abs(norm(b.heading - ep.hdg0)).toFixed(3); ep.wdDrift = +Math.abs(norm(wd - ep.wd0)).toFixed(3);
                ep.dP = (P != null && ep.P0 != null) ? +(P - ep.P0).toFixed(0) : null;
                ep.lost_u = (ep.dP != null && ep.rate0 != null) ? +(ep.rate0 * ep.dur - ep.dP).toFixed(0) : null;
                ep.lost_s = (ep.lost_u != null && ep.rate0 > 20) ? +(ep.lost_u / ep.rate0).toFixed(2) : null;
                ep.rate0 = ep.rate0 != null ? +ep.rate0.toFixed(1) : null;
                ep.minTwa = +ep.minTwa.toFixed(3); ep.minSpd = +ep.minSpd.toFixed(2);
                ep.col = { boat: 0, land: 0, mark: 0, bounds: 0 };
                for (const c of s.col) if (c.t >= ep.t0 && c.t <= t) ep.col[c.cat]++;
                delete ep.hdg0; delete ep.wd0; delete ep.lastSign; delete ep.P0;
                ep.deferred = false; ep.ratePost = null;
                s.posts.push({ ep, t1: t, P1: P, lastSign: norm(b.heading - wd) >= 0 ? 1 : -1, fryChecked: false });
                return ep;
            };
            const dt = 1 / 60;
            let gunSeen = false, sampleN = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                const st = state.race.status;
                if (st === 'finished') break;
                if (st === 'prestart') {
                    const tm = state.race.timer;
                    for (const b of boats) {
                        const r = R[b.name], c = b.controller; if (!c) continue;
                        if (b.raceState && b.raceState.ocs) r.start.everOcs = true;
                        if (r.start.commit == null && c.startCommitted) {
                            const tx = m0.x + ldx * c.startLinePct, ty = m0.y + ldy * c.startLinePct;
                            const wd = getWindAt(tx, ty).direction;
                            r.start.commit = +tm.toFixed(2); r.start.wdOffC = +wdOff(wd).toFixed(3);
                            r.start.spC = +(b.speed * 4).toFixed(2); r.start.behindC = +(-hullLineOffset(b, m0, m1, true)).toFixed(1);
                            r.start.buf = +(0.5 + (b.traits ? b.traits.startBufAdj : 0)).toFixed(2);
                            r.start.est = +c.getApproachTime((c.startStageDepth || 60) / cosT, b.speed, b.stats).toFixed(2);
                            r.start.wsC = +getWindAt(b.x, b.y).speed.toFixed(1);
                            r.start.tgs = +(getTargetSpeed(0.7, false, getWindAt(b.x, b.y).speed) * 0.25).toFixed(4); r.start.accelMod = +(1 + (b.stats.acceleration || 0) * 0.024).toFixed(3); r.start._t0 = tm;
                        }
                        if (r.start.commit != null && r.cross == null && it % 6 === 0 && r.start.run.length < 400) { const wdr = getWindAt(b.x, b.y).direction; r.start.run.push([+(r.start._t0 - tm).toFixed(1), +Math.abs(norm(b.heading - wdr)).toFixed(2), +(b.speed * 4).toFixed(2), +(-hullLineOffset(b, m0, m1, true)).toFixed(0)]); }
                        if (it % 6 === 0 && state.volcano && Volcano.fryOf(b)) { const f = Volcano.fryOf(b); const s = S[b.name]; if (s.lastFryRef !== f) { s.lastFryRef = f; r.preFries++; } }
                    }
                    continue;
                }
                if (st !== 'racing') continue;
                const t = state.race.timer; if (t > 900) break;
                if (!gunSeen) {
                    gunSeen = true;
                    for (const b of boats) {
                        const r = R[b.name]; const wd = getWindAt(b.x, b.y).direction;
                        r.start.gunBehind = +(-hullLineOffset(b, m0, m1, true)).toFixed(1); r.start.gunSp = +(b.speed * 4).toFixed(2);
                        r.start.gunOcs = !!(b.raceState && b.raceState.ocs); r.start.gunTwa = +norm(b.heading - wd).toFixed(3); r.start.wsG = +getWindAt(b.x, b.y).speed.toFixed(1);
                        r.start.wdOffGun = +wdOff(getWindAt(m0.x + ldx * (b.controller ? b.controller.startLinePct : 0.5), m0.y + ldy * (b.controller ? b.controller.startLinePct : 0.5)).direction).toFixed(3);
                        if (b.controller && b.controller.startCommitted && r.start.commit == null) {
                            r.start.commit = 0; r.start.spC = r.start.gunSp; r.start.behindC = r.start.gunBehind; r.start.wdOffC = r.start.wdOffGun;
                            r.start.buf = +(0.5 + (b.traits ? b.traits.startBufAdj : 0)).toFixed(2);
                            r.start.est = +b.controller.getApproachTime((b.controller.startStageDepth || 60) / cosT, b.speed, b.stats).toFixed(2);
                        }
                    }
                }
                let all = true;
                for (const b of boats) {
                    const r = R[b.name];
                    if (b.raceState.finished) { if (r.fin == null) r.fin = Math.round(t); continue; }
                    all = false;
                    const lg = b.raceState.leg; if (r.legT[lg] == null) r.legT[lg] = +t.toFixed(1);
                    if (b.raceState.ocs) { r.start.ocsRacing = true; }
                    else if (r.start.ocsRacing && r.start.ocsClearT == null) { r.start.ocsClearT = +t.toFixed(1); const wdc = getWindAt(b.x, b.y).direction; r.start.clearSp = +(b.speed * 4).toFixed(2); r.start.clearTwa = +Math.abs(norm(b.heading - wdc)).toFixed(3); r.start.clearBehind = +(-hullLineOffset(b, m0, m1, true)).toFixed(1); }
                    if (r.start.commit != null && r.cross == null && it % 6 === 0 && r.start.run.length < 400 && r.start._t0 != null) { const wdr = getWindAt(b.x, b.y).direction; r.start.run.push([+(r.start._t0 + t).toFixed(1), +Math.abs(norm(b.heading - wdr)).toFixed(2), +(b.speed * 4).toFixed(2), +(-hullLineOffset(b, m0, m1, true)).toFixed(0)]); }
                    if (t >= 1.0 && r.start.tack1 == null) {
                        const wd = getWindAt(b.x, b.y).direction; const twa = norm(b.heading - wd);
                        r.start.tack1 = twa >= 0 ? 1 : -1; r.start.hdgOff1 = +Math.abs(norm(b.heading - normalDir)).toFixed(3);
                    }
                }
                if (all) break;
                if (it % 6 !== 0) continue;
                sampleN++;
                const v = state.volcano;
                for (const b of boats) {
                    if (b.raceState.finished) continue;
                    const r = R[b.name], s = S[b.name], c = b.controller;
                    const P = prog(b, s);
                    const wd = getWindAt(b.x, b.y).direction;
                    // post-watches: deferred manoeuvre inside 3 s, rate over 5 s, fry after a dodge inside 0.5 s
                    for (let i = s.posts.length - 1; i >= 0; i--) {
                        const p = s.posts[i]; const age = t - p.t1;
                        if (age <= 3) { const sg = norm(b.heading - wd) >= 0 ? 1 : -1; if (sg !== p.lastSign) { p.ep.deferred = true; p.lastSign = sg; } }
                        if (p.ep.kind === 'dodge' && !p.fryChecked && age <= 0.6) { const f = v && Volcano.fryOf(b); if (f) { p.ep.fryAfter = +f.dur.toFixed(1); p.fryChecked = true; } }
                        if (age >= 5) { if (P != null && p.P1 != null) p.ep.ratePost = +((P - p.P1) / age).toFixed(1); if (p.ep.kind === 'dodge' && p.ep.fryAfter == null) p.ep.fryAfter = 0; s.posts.splice(i, 1); }
                    }
                    // FRY
                    const f = v ? Volcano.fryOf(b) : null;
                    if (f && !s.ep.fry) {
                        const dodged = (s.ep.dodge != null) || (t - s.lastDodgeEnd <= 3);
                        s.ep.fry = open('fry', b, s, t, P, { durNominal: +f.dur.toFixed(1), restarts: 0, dodged, ref: f });
                    } else if (f && s.ep.fry && s.ep.fry.ref !== f) { s.ep.fry.restarts++; s.ep.fry.ref = f; }
                    else if (!f && s.ep.fry) { const ep = s.ep.fry; delete ep.ref; r.fries.push(close(ep, b, s, t, P)); s.ep.fry = null; }
                    if (s.ep.fry) tick(s.ep.fry, b, wd);
                    // DODGE
                    const dodging = !f && c && c._dodgeGo && c._dodgeKey != null;
                    if (dodging && !s.ep.dodge) {
                        let pend = null; for (const st2 of (v.strikers || [])) if (st2.pending && st2.pending.seed === c._dodgeKey) pend = st2.pending;
                        s.ep.dodge = open('dodge', b, s, t, P, { aimed: pend ? !!pend.aimed : null, isMe: pend ? pend.boat === b : null,
                            d0: pend ? +Math.hypot(b.x - pend.x, b.y - pend.y).toFixed(0) : null, lead: pend ? +(pend.at - v.t).toFixed(2) : null });
                    } else if (!dodging && s.ep.dodge) { r.dodges.push(close(s.ep.dodge, b, s, t, P)); s.ep.dodge = null; s.lastDodgeEnd = t; }
                    if (s.ep.dodge) tick(s.ep.dodge, b, wd);
                    // BOIL
                    const boil = (b.boil || 0) > 0.1;
                    if (boil && !s.ep.boil) s.ep.boil = open('boil', b, s, t, P, { boilMax: b.boil, x0: Math.round(b.x), y0: Math.round(b.y), onPlan: (c && c.navTarget) ? +Math.hypot(c.navTarget.x - b.x, c.navTarget.y - b.y).toFixed(0) : null });
                    else if (!boil && s.ep.boil) { r.boils.push(close(s.ep.boil, b, s, t, P)); s.ep.boil = null; }
                    if (s.ep.boil) { tick(s.ep.boil, b, wd); if (b.boil > s.ep.boil.boilMax) s.ep.boil.boilMax = +b.boil.toFixed(2); }
                    // DEAD AIR
                    const dead = v ? Volcano.windMul(b.x, b.y) < 0.6 : false;
                    if (dead && !s.ep.dead) s.ep.dead = open('dead', b, s, t, P, {});
                    else if (!dead && s.ep.dead) { r.deads.push(close(s.ep.dead, b, s, t, P)); s.ep.dead = null; }
                    if (s.ep.dead) tick(s.ep.dead, b, wd);
                    s.hist.push({ t, P }); if (s.hist.length > 60) s.hist.shift();
                }
            }
            // close what is still open at the end
            const tEnd = state.race.timer;
            for (const b of boats) {
                const r = R[b.name], s = S[b.name];
                const P = b.raceState.finished ? cum[nLegs - 1] + legLen[nLegs - 1] : prog(b, s);
                for (const k of ['fry', 'dodge', 'boil', 'dead']) if (s.ep[k]) { const ep = s.ep[k]; delete ep.ref; ep.openAtEnd = true; r[k === 'fry' ? 'fries' : k + 's'].push(close(ep, b, s, tEnd, P)); }
                for (const p of s.posts) if (p.ep.kind === 'dodge' && p.ep.fryAfter == null) p.ep.fryAfter = 0;
                r.mans = b.raceState.legManeuvers ? b.raceState.legManeuvers.slice() : null;
            }
            return { seed, sampleN, rows: Object.values(R) };
        }, { seed });
        races.push(r);
        const fins = r.rows.filter(x => x.fin != null).map(x => x.fin).sort((a, b) => a - b);
        const nf = r.rows.reduce((a, x) => a + x.fries.length, 0), nd = r.rows.reduce((a, x) => a + x.dodges.length, 0);
        console.log(`  race ${race} seed ${seed}: ${fins.length} fins ${fins.join(',')}  fries ${nf} dodges ${nd}`);
    }
    await browser.close();
    const out = path.join(__dirname, `_vo_census_${TREE}_${VENUE === 'volcanic' ? '' : VENUE + '_'}${SEED0}.json`);
    fs.writeFileSync(out, JSON.stringify(races));
    // ── fins validation ──
    if (BENCH) {
        const f = path.join(__dirname, `ocean_bench_${BENCH}.json`);
        if (fs.existsSync(f)) {
            const bj = JSON.parse(fs.readFileSync(f, 'utf8')); let ok = 0, bad = 0;
            for (let i = 0; i < Math.min(bj.length, races.length); i++) {
                const bm = {}; for (const b of bj[i].info) bm[b.name] = b.fin;
                let same = true; for (const r of races[i].rows) if ((bm[r.name] === undefined ? null : bm[r.name]) !== r.fin) same = false;
                if (same) ok++; else bad++;
            }
            console.log(`\nFINS VALIDATION vs ${BENCH}: ${ok} match / ${bad} differ${bad ? '   ⚠️ REPLAY DOES NOT MATCH THE BENCH — do not read this census.' : ''}`);
        } else console.log(`\n⚠️ bench ${BENCH} not found — replay unvalidated`);
    }
    console.log(`saved ${path.basename(out)}   (summarise with: node _vo_census_sum.js ${path.basename(out)})`);
})();
