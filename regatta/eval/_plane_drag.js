// PLANING INTO DRAG — how fast does the plane break, and how fast does the speed go?
//
//   node regatta/eval/_plane_drag.js [venue ...]      (from the repo root)
//
// Wes, Sep 28 2026: drag should break the plane RAPIDLY — not instantly, faster the more drag
// — but only once the water is "in the red" (the flats sounder's red band, a speed multiplier
// under ~0.47). Grazing a feathered rim keeps the plane. Broken water and boils count too.
//
// A controlled crossing: the wind is replaced by a steady 16 kt, the player is held on a 130°
// broad reach with the sheet at its optimum every frame, and started PLANING at full speed
// ~250 u outside a drag area, pointed through its heart. Logged per crossing: the drag it met
// (the lowest multiplier / strongest broken water), when it first entered the red, when the
// plane broke (s and u after the red), and the speed 1 s / 2 s into the red.
const { chromium } = require('playwright');
const path = require('path');

const VENUES = process.argv.slice(2).length ? process.argv.slice(2)
    : ['lagoon', 'otter', 'flats', 'swamp', 'lake', 'river', 'volcanic'];

(async () => {
    const browser = await chromium.launch();
    for (const venue of VENUES) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const errs = [];
        page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })), venue);
        await page.reload();
        await page.waitForTimeout(700);
        const res = await page.evaluate(() => {
            window.requestAnimationFrame = () => 0;
            let s = 90210;
            Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace();
            for (let i = 0; i < 30; i++) update(1 / 60);
            const P = state.boats.find(b => b.isPlayer);
            // Park the rest of the fleet far away so nobody's dirty air or hull gets in the way.
            for (const b of state.boats) if (b !== P) { b.x = 1e6 + b.id * 500; b.y = 1e6; b.speed = 0; }
            state.race.status = 'racing';

            // What the water does here: the bottom (shoal × tide) and the broken water.
            const bottom = (x, y) => {
                let m = state.course._hasShoals ? VenueDoc.shoalField(state.course.islands, x, y) : 1;
                if (state.tide && window.Tide) { const d = Tide.depthAt(x, y); m *= d < state.tide.draft ? 0 : Tide.mulForDepth(d); }
                return m;
            };
            // broken water at its own level, as physics.js PLANE_DRAG counts it
            const broken = (x, y) => Math.max(rapidsTurbAt(x, y),
                (state.volcano && window.Volcano) ? Volcano.boilAt(x, y) * BOIL_DRAG / RAPIDS_DRAG : 0);
            const drag = (x, y) => Math.max(1 - bottom(x, y), broken(x, y));

            // Candidate hearts: the strongest drag inside each awash shape, rapid and vent.
            const hearts = [];
            for (const isl of state.course.islands) {
                if (!isl.awash || !isl.shoalRings || isl.shoalMul >= 0.999) continue;
                const R = isl.radius; let best = null;
                for (let gx = -R; gx <= R; gx += 25) for (let gy = -R; gy <= R; gy += 25) {
                    const x = isl.x + gx, y = isl.y + gy, d = drag(x, y);
                    if (d > 0 && (!best || d > best.d)) best = { x, y, d };
                }
                if (best && best.d > 0.3) hearts.push({ ...best, what: (isl.kind || 'shoal') + ' ' + (isl.id || '') });
            }
            for (const r of (state.course.rapidsRegions || [])) {
                const bb = r.bb; let best = null;
                for (let x = bb.minX; x <= bb.maxX; x += 25) for (let y = bb.minY; y <= bb.maxY; y += 25) {
                    const d = drag(x, y); if (!best || d > best.d) best = { x, y, d };
                }
                if (best && best.d > 0.3) hearts.push({ ...best, what: 'rapids ' + (r.id || '') });
            }
            if (state.volcano) for (const b of (state.volcano.vents || [])) {
                // the boil breathes (0.6-1.0): take the vent's own centre, its strongest point
                hearts.push({ x: b.x, y: b.y, d: drag(b.x, b.y), what: 'boil ' + ((b.p && b.p.id) || '') });
            }
            // The flats: sail each passage over its crest with the tide set so the crest has
            // 0.1 m under the keel — red water, still afloat (the mud around a red cell dries,
            // so a random red cell is a grounding test, not a planing one).
            if (state.tide && window.Tide) {
                const T = state.tide;
                for (const pz of (T.passages || []).slice(0, 4)) {
                    let crest = null;
                    for (let k = 1; k < pz.pts.length; k++) {
                        const a = pz.pts[k - 1], b = pz.pts[k];
                        for (let f = 0; f < 1; f += 0.05) {
                            const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = Tide.groundAt(x, y);
                            if (!crest || z > crest.z) crest = { x, y, z, hd: Math.atan2(b[0] - a[0], -(b[1] - a[1])) };
                        }
                    }
                    if (crest) hearts.push({ x: crest.x, y: crest.y, d: 0.9, what: 'flats ' + pz.id, heading: crest.hd,
                        setTide: () => { T.mid += (crest.z + T.draft + 0.1) - Tide.level(); } });
                }
            }
            hearts.sort((a, b) => b.d - a.d);
            const mid0 = state.tide ? state.tide.mid : 0;

            const SPEED0 = 13.2 / 4, TWS = 16, TWA = 130 * Math.PI / 180, RED = 0.53;
            const realWind = getWindAt;
            const save = { x: P.x, y: P.y };
            const cross = (h, heading) => {
                const windDir = normalizeAngle(heading - TWA);
                window.getWindAt = () => ({ speed: TWS, direction: windDir });
                // back up along the ray until the drag is gone, then 250 u more
                const ux = Math.sin(heading), uy = -Math.cos(heading);
                let back = 0; while (back < 3000 && drag(h.x - ux * back, h.y - uy * back) > 0.001) back += 10;
                P.x = h.x - ux * (back + 250); P.y = h.y - uy * (back + 250);
                P.heading = P.prevHeading = heading; P.targetHeading = heading;
                P.speed = SPEED0; P.velocity = { x: ux * SPEED0, y: uy * SPEED0 };
                P.raceState.isPlaning = true; P.raceState.planingTimer = 0; P.raceState.planingFactor = 1;
                P.aground = false; delete P.planeHold;
                const log = []; let t = 0, dist = 0, tRed = null, dRed = null, tBreak = null, dBreak = null, maxD = 0, hit = false, px = P.x, py = P.y, tIn = null, dIn = null;
                for (let f = 0; f < 60 * 14; f++) {
                    P.heading = P.targetHeading = heading;
                    if (P.optimalSailAngle != null) P.manualSailAngle = P.optimalSailAngle;
                    update(1 / 60); t += 1 / 60;
                    dist += Math.hypot(P.x - px, P.y - py); px = P.x; py = P.y;
                    if (P.collided || (P.ai && P.ai.collisionData && P.ai.collisionData.type === 'island' && !P.ai.collisionData.aground)) hit = true;
                    const d = drag(P.x, P.y); if (d > maxD) maxD = d;
                    if (tIn == null && d > 0.001) { tIn = t; dIn = dist; }
                    if (tRed == null && d > RED) { tRed = t; dRed = dist; }
                    if (tBreak == null && !P.raceState.isPlaning) { tBreak = t; dBreak = dist; }
                    log.push({ t, kt: P.speed * 4, d });
                    if (tIn != null && d === 0 && t - tIn > 2 && dist - dIn > 200) break;
                }
                const at = (tt) => { const e = log.find(q => q.t >= tt); return e ? +e.kt.toFixed(1) : null; };
                return {
                    what: h.what, heading: Math.round(heading * 180 / Math.PI), maxDrag: +maxD.toFixed(2), hit,
                    red: tRed != null,
                    breakAfterRed: tBreak == null ? null : tRed == null ? 'broke outside red' : { s: +(tBreak - tRed).toFixed(2), u: Math.round(dBreak - dRed) },
                    breakAfterEntry: tBreak == null ? null : { s: +(tBreak - tIn).toFixed(2), u: Math.round(dBreak - dIn) },
                    ktAtRed: tRed == null ? null : at(tRed), kt1s: tRed == null ? null : at(tRed + 1), kt2s: tRed == null ? null : at(tRed + 2),
                    minKt: +Math.min(...log.map(q => q.kt)).toFixed(1),
                };
            };
            const out = [];
            const seen = new Set();
            for (const h of hearts) {
                const key = h.what.split(' ')[0] + Math.round(h.d * 10);
                if (seen.has(key) && out.length >= 3) continue; seen.add(key);
                if (out.length >= 5) break;
                // try headings until one crosses without touching land
                // prefer an approach that is afloat all the way in (the flats' red water is
                // ringed by mud that dries: a ray from the wrong side starts aground)
                const clearIn = (hd) => { const ux = Math.sin(hd), uy = -Math.cos(hd); for (let b = 0; b < 3000; b += 10) { const d = drag(h.x - ux * b, h.y - uy * b); if (d >= 0.999) return false; if (d < 0.001) return true; } return false; };
                let r = null;
                if (state.tide) state.tide.mid = mid0;
                if (h.setTide) { h.setTide(); out.push(cross(h, h.heading)); continue; }
                const order = [...Array(24).keys()].map(k => k * Math.PI / 12).sort((a, b) => clearIn(b) - clearIn(a));
                for (const hd of order.slice(0, 12)) { r = cross(h, hd); if (!r.hit && r.maxDrag > 0) break; }
                out.push(r);
            }
            window.getWindAt = realWind; P.x = save.x; P.y = save.y;
            return out;
        });
        console.log(`\n${venue.toUpperCase()}`);
        for (const r of res) {
            const b = r.breakAfterRed;
            console.log(`  ${r.what.padEnd(28)} drag ${String(r.maxDrag).padEnd(4)} ${r.red ? 'RED' : '   '}  plane broke ${b == null ? 'never           ' : typeof b === 'string' ? b.padEnd(16) : (b.s + ' s / ' + b.u + ' u after red').padEnd(16)}  kt at red ${r.ktAtRed} → +1s ${r.kt1s} → +2s ${r.kt2s}, min ${r.minKt}${r.hit ? '  (touched land)' : ''}`);
        }
        if (errs.length) console.log('  page errors:', errs.slice(0, 3));
        await page.close();
    }
    await browser.close();
})();
