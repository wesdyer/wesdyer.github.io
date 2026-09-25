// Probe: a chart of a venue as built, for the venue-objectives design phase. Land (grey), the
// current field (blue, darker = faster), rapids (white hatching), marks, a few named props, the
// fleet's tracks from `_venue_survey.js` (TRACKS dumps, thin orange) and Wes's own recorded races
// (eval/rl/traj/traj_<venue>_*.json, red; only the current layout's fingerprint unless ALL=1).
//   node regatta/eval/_venue_map.js <venue> <out.png> [tracks.json ...]   (from the repo root)
// Env: FP=<fp,fp> picks Wes's races by fingerprint; PROPS=<regex> labels matching prop kinds; BOX=x0,y0,x1,y1 crops to a world box.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
    const [venue, out, ...trackFiles] = process.argv.slice(2);
    const fleet = trackFiles.flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')).map(t => t.tr));
    const TRAJ = 'regatta/eval/rl/traj';
    const wes = fs.readdirSync(TRAJ).filter(f => f.startsWith(`traj_${venue}_`)).map(f => JSON.parse(fs.readFileSync(path.join(TRAJ, f), 'utf8')));
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.VenueDoc && typeof resetGame === 'function');
    const png = await p.evaluate(({ venue, fleet, wes, all, propRe, box, fps }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const fp = (typeof VenueDoc.fingerprint === 'function') ? VenueDoc.fingerprint(VENUE_DOC[venue]) : null;
        const races = wes.filter(j => all || !fp || String(j.venueFingerprint).split(':')[0] === String(fp).split(':')[0]);
        const useRaces = fps ? wes.filter(j => fps.includes(String(j.venueFingerprint).split(':')[0])) : (races.length ? races : wes);
        const doc = VENUE_DOC[venue];
        let [x0, y0, x1, y1] = box || (() => {
            const pts = [...doc.course.marks.map(m => [m.x, m.y]), ...fleet.flat(), ...useRaces.flatMap(j => j.samples.map(s => [s[2], s[3]]))];
            const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
            return [Math.min(...xs) - 600, Math.min(...ys) - 600, Math.max(...xs) + 600, Math.max(...ys) + 600];
        })();
        const W = 1600, sc = W / (x1 - x0), H = Math.round((y1 - y0) * sc);
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
        const X = x => (x - x0) * sc, Y = y => (y - y0) * sc;
        const step = 8, turb = typeof rapidsTurbAt === 'function' ? rapidsTurbAt : () => 0;
        for (let py = 0; py < H; py += step) for (let px = 0; px < W; px += step) {
            const wx = x0 + px / sc, wy = y0 + py / sc;
            if (pointOnLand(wx, wy)) { g.fillStyle = '#9a9a92'; g.fillRect(px, py, step, step); continue; }
            const c = getCurrentAt(wx, wy), v = c ? c.speed : 0;
            const k = Math.min(1, v / 5);
            g.fillStyle = `rgb(${Math.round(225 - 190 * k)},${Math.round(238 - 150 * k)},${Math.round(250 - 60 * k)})`; g.fillRect(px, py, step, step);
            const tv = turb(wx, wy), rv = typeof tv === 'number' ? tv : (tv && tv.turb) || 0;
            if (rv > 0.2 && ((px + py) / step) % 3 === 0) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(px, py, step, step); }
        }
        // current arrows
        g.strokeStyle = 'rgba(10,40,90,0.55)'; g.lineWidth = 1.2;
        for (let py = 20; py < H; py += 60) for (let px = 20; px < W; px += 60) {
            const wx = x0 + px / sc, wy = y0 + py / sc; if (pointOnLand(wx, wy)) continue;
            const c = getCurrentAt(wx, wy); if (!c || c.speed < 0.3) continue;
            const L = 6 + c.speed * 5, dx = Math.sin(c.direction), dy = -Math.cos(c.direction);
            g.beginPath(); g.moveTo(px - dx * L / 2, py - dy * L / 2); g.lineTo(px + dx * L / 2, py + dy * L / 2); g.stroke();
            g.beginPath(); g.arc(px + dx * L / 2, py + dy * L / 2, 2, 0, 7); g.fillStyle = 'rgba(10,40,90,0.7)'; g.fill();
        }
        const line = (tr, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); tr.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.stroke(); };
        for (const tr of fleet) line(tr, 'rgba(240,140,20,0.45)', 1.2);
        for (const j of useRaces) line(j.samples.map(s => [s[2], s[3]]), 'rgba(210,20,40,0.8)', 2);
        g.font = 'bold 14px sans-serif';
        for (const m of doc.course.marks) { g.fillStyle = '#e8b400'; g.beginPath(); g.arc(X(m.x), Y(m.y), 6, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillText(m.id.replace('mark-', 'M'), X(m.x) + 8, Y(m.y) - 6); }
        if (propRe) { const re = new RegExp(propRe); g.font = '11px sans-serif';
            for (const q of doc.props) if (re.test(q.kind)) { g.fillStyle = '#5a2d00'; g.fillRect(X(q.x) - 3, Y(q.y) - 3, 6, 6); g.fillText(q.id.replace('prop-', 'p') + ' ' + q.kind.replace(/^[a-z]+-/, ''), X(q.x) + 5, Y(q.y) + 4); } }
        g.font = 'bold 12px sans-serif'; g.fillStyle = '#222';
        for (const s of doc.shapes) { const r = s.outer || []; if (!r.length) continue; const cx = r.reduce((a, q) => a + q[0], 0) / r.length, cy = r.reduce((a, q) => a + q[1], 0) / r.length; if (cx > x0 && cx < x1 && cy > y0 && cy < y1 && /cobble|lane|shoal|bar/.test(s.kind)) g.fillText(s.id.replace('shape-', 's') + ' ' + s.kind, X(cx), Y(cy)); }
        // rapids outlines, labelled with id and turbulence
        g.strokeStyle = 'rgba(120,0,160,0.9)'; g.lineWidth = 1.5; g.font = 'bold 13px sans-serif';
        for (const r of (doc.rapids && doc.rapids.regions) || []) { g.beginPath(); r.poly.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.closePath(); g.stroke();
            const cx = r.poly.reduce((a, q) => a + q[0], 0) / r.poly.length, cy = r.poly.reduce((a, q) => a + q[1], 0) / r.poly.length; g.fillStyle = 'rgb(120,0,160)'; g.fillText(r.id.replace('rapids-', 'R') + ' ' + r.turbulence, X(cx), Y(cy)); }
        g.fillStyle = '#000'; g.font = '13px sans-serif';
        g.fillText(`${venue}  x ${Math.round(x0)}..${Math.round(x1)}  y ${Math.round(y0)}..${Math.round(y1)}  1px=${(1 / sc).toFixed(1)}u  Wes races ${useRaces.length} (fp ${fp})  fleet tracks ${fleet.length}`, 10, 18);
        return cv.toDataURL('image/png');
    }, { venue, fleet, wes, all: !!process.env.ALL, propRe: process.env.PROPS || '', box: process.env.BOX ? process.env.BOX.split(',').map(Number) : null, fps: process.env.FP ? process.env.FP.split(',') : null });
    fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
    await b.close();
    console.log('wrote', out);
})();
