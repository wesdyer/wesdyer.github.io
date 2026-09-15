// OTTER WIND PRICER — sail the course three ways over the mean field: a corridor-constrained tacking
// simulator for the beat (polar × kelp drag, TACK seconds per tack, default 6 — an assumption, not a
// measurement) and a polar-priced polyline walker for the reach and the bay. Run from the REPO ROOT.
//   CAND=<doc> OUT=price.json TACK=6 NODE_PATH=node_modules node regatta/eval/_otter_wind_price.js
// STRATEGY PRICER — sail the Otter course three ways over the MEAN wind field (lees in, puffs off).
//   CAND=<doc.js> NODE_PATH=node_modules node pricer.js
// Beat: a corridor-constrained tacking simulator (polar speed × kelp drag, a fixed tack cost).
// Reach/bay: polyline priced by the polar at the local wind (VMG tacking/gybing when needed).
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve('.');
const CAND = process.env.CAND ? (() => { const t = fs.readFileSync(process.env.CAND, 'utf8'); const k = 'window.VENUE_DOC["otter"] = '; return JSON.parse(t.slice(t.indexOf(k) + k.length).trim().slice(0, -1)).wind; })() : null;
const TACK = +(process.env.TACK || 6);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data); }); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
  await page.goto(`http://127.0.0.1:${server.address().port}/regatta/index.html`);
  await page.waitForFunction(() => typeof state !== 'undefined' && state.boats && state.boats.length > 0, null, { timeout: 30000 });
  const res = await page.evaluate(([cand, TACK]) => {
    if (cand) window.VENUE_DOC.otter.wind = cand;
    let s = 7; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    selectVenue('otter'); resetGame(); startRace();
    for (let i = 0; i < 30; i++) update(1 / 30);
    WIND_MEAN_FIELD = true;
    const KT = 15;                                   // units/s per knot (planner.js)
    const wind = (x, y) => getWindAt(x, y);
    const kelp = (x, y) => VenueDoc.shoalField(state.course.islands, x, y);
    const norm = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    // best upwind / downwind angles at a wind speed
    const bestUp = (ws) => { let b = 0, ba = 0; for (let d = 30; d <= 70; d += 1) { const t = d * Math.PI / 180, v = getTargetSpeed(t, false, ws) * Math.cos(t); if (v > b) { b = v; ba = t; } } return { twa: ba, vmg: b }; };
    const bestDown = (ws) => { let b = 0, ba = 0; for (let d = 120; d <= 180; d += 1) { const t = d * Math.PI / 180, v = getTargetSpeed(t, d > 90, ws) * -Math.cos(t); if (v > b) { b = v; ba = t; } } return { twa: ba, vmg: b }; };
    const spd = (twa, ws) => getTargetSpeed(twa, Math.abs(twa) > Math.PI / 2, ws);

    // ── polyline pricer ──
    function pricePoly(pts, step = 30) {
      let secs = 0, dist = 0, upwindD = 0, minW = 99, sumW = 0, n = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy); if (d < 1) continue;
        const brg = Math.atan2(dx, -dy); const k = Math.max(1, Math.round(d / step)); const seg = d / k;
        for (let j = 0; j < k; j++) {
          const x = a[0] + dx * (j + 0.5) / k, y = a[1] + dy * (j + 0.5) / k;
          const w = wind(x, y); const twa = Math.abs(norm(brg - w.direction)); const km = kelp(x, y);
          minW = Math.min(minW, w.speed); sumW += w.speed; n++;
          let v; const up = bestUp(w.speed), dn = bestDown(w.speed);
          if (twa < up.twa) { v = up.vmg / Math.cos(twa); upwindD += seg; }          // must tack: time = d cosθ / VMG
          else if (twa > dn.twa) { v = dn.vmg / -Math.cos(twa); }                    // must gybe
          else v = spd(twa, w.speed);
          v *= km; secs += seg / (v * KT); dist += seg;
        }
      }
      return { secs: +secs.toFixed(1), dist: Math.round(dist), upwindD: Math.round(upwindD), minW: +minW.toFixed(1), meanW: +(sumW / n).toFixed(1) };
    }

    // ── beat simulator in a corridor measured from the REAL shore (the coast ring) ──
    const coast = VENUE_DOC.otter.shapes.find(sh => sh.id === 'coast').outer;
    const segs = coast.map((p, i) => [p, coast[(i + 1) % coast.length]]).filter(([a, b]) => a[1] < 3500 && a[0] < 4000);   // the part of the ring that faces the beat
    const dOff = (x, y) => { let best = 1e9; for (const [a, b] of segs) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1; let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2; t = Math.max(0, Math.min(1, t)); const ex = a[0] + dx * t - x, ey = a[1] + dy * t - y; const d = ex * ex + ey * ey; if (d < best) best = d; } return Math.sqrt(best); };
    const gradD = (x, y, hx, hy) => (dOff(x + hx * 20, y + hy * 20) - dOff(x, y)) / 20;
    function beat(start, dmin, dmax, mark, label) {
      let x = start[0], y = start[1], t = 0, tacks = 0, tack = null, trackPts = [[x, y]], minW = 99, sumW = 0, n = 0, kelpT = 0;
      const dt = 0.5; const goal = [mark[0] - 60, mark[1] + 120];       // approach point SW of the mark
      let fetching = false; let lastTack = -99;
      for (let it = 0; it < 4000; it++) {
        const w = wind(x, y); const up = bestUp(w.speed); const km = kelp(x, y); if (km < 0.999) kelpT += dt;
        minW = Math.min(minW, w.speed); sumW += w.speed; n++;
        const gx = goal[0] - x, gy = goal[1] + 0 - y; const gd = Math.hypot(gx, gy); if (gd < 80) break;
        const gb = Math.atan2(gx, -gy); const gtwa = norm(gb - w.direction);        // bearing to goal relative to wind-from
        if (tack === null) tack = -1;   // starboard first: it heads seaward from the line      // +1 = port (heading = wind + twa): drifts... choose by need: start heading seaward
        // can we fetch the goal on the current tack? (goal lies off the bow within the wind cone)
        const hdgP = w.direction + up.twa, hdgS = w.direction - up.twa;
        const fetchP = Math.abs(gtwa) >= up.twa && gtwa > 0, fetchS = Math.abs(gtwa) >= up.twa && gtwa < 0;
        let hdg, v;
        if ((tack > 0 && fetchP) || (tack < 0 && fetchS)) { hdg = gb; v = spd(Math.abs(gtwa), w.speed); fetching = true; }
        else {
          fetching = false;
          hdg = tack > 0 ? hdgP : hdgS; v = spd(up.twa, w.speed);
          const d = dOff(x, y);
          // corridor: tack when leaving it (only after a short cooldown so we don't chatter)
          const hx = Math.sin(hdg), hy = -Math.cos(hdg); const dDot = gradD(x, y, hx, hy);   // rate of change of dOff along heading
          if (t - lastTack > 8 && ((d > dmax && dDot > 0) || (d < dmin && dDot < 0))) { tack = -tack; tacks++; t += TACK; lastTack = t; hdg = tack > 0 ? hdgP : hdgS; }
        }
        v *= km; const hx = Math.sin(hdg), hy = -Math.cos(hdg);
        x += hx * v * KT * dt; y += hy * v * KT * dt; t += dt;
        if (it % 8 === 0) trackPts.push([Math.round(x), Math.round(y)]);
        if (it < 12 && label.startsWith('beat inshore')) dbg.push({ it, x: Math.round(x), y: Math.round(y), ws: +w.speed.toFixed(1), wd: Math.round(w.direction * 180 / Math.PI), twa: Math.round(up.twa * 180 / Math.PI), tack, hdg: Math.round(hdg * 180 / Math.PI), v: +v.toFixed(2), d: Math.round(dOff(x, y)), fetching });
      }
      return { label, secs: +t.toFixed(1), tacks, minW: +minW.toFixed(1), meanW: +(sumW / n).toFixed(1), kelpSecs: kelpT, end: [Math.round(x), Math.round(y)], track: trackPts };
    }
    const dbg = []; window.__dbg = dbg;
    const mark = [-3025, -3548];
    const pinD = dOff(198, 3207), boatD = dOff(1227, 2178);
    const beats = [
      beat([712, 2692], 150, 450, mark, 'beat hug (tack at 450 off)'),
      beat([712, 2692], 150, 800, mark, 'beat inshore (tack at 800)'),
      beat([712, 2692], 150, 1300, mark, 'beat mid (tack at 1300)'),
      beat([712, 2692], 150, 2200, mark, 'beat offshore (tack at 2200)'),
      beat([712, 2692], 150, 3500, mark, 'beat far (tack at 3500)')
    ];
    // ── the reach: mark → gate, three lines ──
    // offset a polyline to its LEFT (seaward for a line running west→east with the land to the south, y down)
    const offsetLine = (pts, D) => pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [p[0] + (dy / l) * D, p[1] - (dx / l) * D];
    });
    const hug = [[-3025, -3548], [-2700, -4300], [-1900, -5000], [-1000, -4700], [-300, -4500], [400, -4750], [1000, -4550], [1600, -4900], [2500, -4950], [3300, -5300], [3700, -5250], [4500, -4950], [5100, -5150], [5600, -5050], [6100, -4500], [6700, -4200], [7100, -4250], [7400, -4000]];
    const smooth = [[-3025, -3548], [-2700, -4300], [-1900, -5000], [-800, -4900], [400, -4800], [1600, -4900], [2500, -4950], [3500, -5250], [4500, -5000], [5100, -5150], [5600, -5050], [6300, -4600], [7100, -4300], [7400, -4000]];
    const reach = {
      'reach hug coast': [[-3025, -3548], [-2700, -4300], [-1900, -5000], [-1000, -4700], [-300, -4500], [400, -4750], [1000, -4550], [1600, -4900], [2500, -4950], [3300, -5300], [3700, -5250], [4500, -4950], [5100, -5150], [5600, -5050], [6100, -4500], [6700, -4200], [7100, -4250], [7400, -4000]],
      'reach coastal band': [[-3025, -3548], [-2600, -4600], [-1700, -5500], [-300, -5500], [1000, -5400], [2500, -5600], [3800, -5800], [5000, -5700], [6000, -5500], [6500, -4700], [7400, -4000]],
      'reach offshore lane': [[-3025, -3548], [-2600, -4600], [-2000, -6800], [0, -7500], [2500, -7800], [5000, -7700], [7500, -7000], [8800, -5500], [8600, -4200], [7400, -4000]],
      'reach smart': [[-3025, -3548], [-2650, -4500], [-1900, -5450], [-800, -5350], [400, -5250], [1600, -5350], [2500, -5400], [3500, -5650], [4500, -5450], [5100, -5600], [5700, -5550], [6500, -5300], [7300, -4800], [7400, -4000]]
    };
    for (const D of [300, 600, 900, 1200, 1500, 1800, 2200]) { const o = offsetLine(smooth, D); o[0] = [-3025, -3548]; o[o.length - 1] = [7400, -4000]; reach['reach tips+' + D] = o; }
    // the bay's west entrance is a 325u gap between the west point's rocks (x≈8100) and the islet (x≈8425)
    const gap = [8270, -3560];
    const bay = {
      'bay gap → west end (the hole)': [[7400, -4000], gap, [8120, -3000], [7999, -2455]],
      'bay gap → centre': [[7400, -4000], gap, [8375, -2356]],
      'bay gap → east end (the finger)': [[7400, -4000], gap, [8600, -3250], [8720, -2800], [8751, -2257]],
      'bay east of the islet → east end': [[7400, -4000], [8600, -4150], [9300, -3550], [9200, -2900], [8751, -2257]]
    };
    const probe = [[1000, 2400], [712, 2692], [350, 3050], [-1500, 500], [-3025, -3548]].map(p => [p, +wind(p[0], p[1]).speed.toFixed(1)]);
    const out = { probe, dbg, pinD: Math.round(pinD), boatD: Math.round(boatD), beats: beats.map(b => ({ ...b, track: undefined })), tracks: beats.map(b => b.track), reach: {}, bay: {} };
    for (const k in reach) out.reach[k] = pricePoly(reach[k]);
    for (const k in bay) out.bay[k] = pricePoly(bay[k]);
    out.reachPts = reach; out.bayPts = bay;
    return out;
  }, [CAND, TACK]);
  console.log('wind probe', JSON.stringify(res.probe)); console.log('dbg', JSON.stringify(res.dbg));
  console.log('corridor sign check: pin d=', res.pinD, 'boat d=', res.boatD, '(pin should be more seaward)');
  console.log('BEAT (start → mark)'); for (const b of res.beats) console.log(`  ${b.label.padEnd(36)} ${b.secs.toFixed(0).padStart(4)} s  tacks ${String(b.tacks).padStart(2)}  wind mean ${b.meanW} min ${b.minW}  kelp ${b.kelpSecs}s  end ${b.end}`);
  console.log('REACH (mark → gate)'); for (const k in res.reach) { const r = res.reach[k]; console.log(`  ${k.padEnd(36)} ${r.secs.toFixed(0).padStart(4)} s  dist ${r.dist}  wind mean ${r.meanW} min ${r.minW}`); }
  console.log('BAY (gate → finish)'); for (const k in res.bay) { const r = res.bay[k]; console.log(`  ${k.padEnd(36)} ${r.secs.toFixed(0).padStart(4)} s  dist ${r.dist}  wind mean ${r.meanW} min ${r.minW}`); }
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(res));
  console.log('ERRORS', errors.length ? errors.slice(0, 6).join('\n') : 'none');
  await browser.close(); server.close();
})();
