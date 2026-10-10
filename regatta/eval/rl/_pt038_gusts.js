// PT-038 (part 2) — GUSTS AND LULLS WHERE WES ASKED FOR THEM (Oct 2026).
//
// Wes, across the playtests: Otter "no gusts... there really should be gusts"; Emberfall "it's like a storm";
// Sockeye "at least occasionally"; Bluewater "the gust region should be larger on this offshore venue";
// Redrock "the gust should be larger", "more variability down these corridors"; Glacier "there probably
// should be more gusts", "not enough left to right"; and (Oct 10) add some to Lighthouse Cove, Glowtide and
// the Flats — but none at Clubhouse Point, and the Bayou stays as it is.
//
// New venues get one source over the water the course sails: the convex hull of the saved course paths,
// pushed out by MARGIN. Existing sources are re-tuned in place. Writes the document exactly as the editor's
// Save does (every file round-trips byte-for-byte through this format).
//   node _pt038_gusts.js [--dry]
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '../..'), DRY = process.argv.includes('--dry');
const HEAD = '// GENERATED ONCE by art/export_venue_doc.js — now the SOURCE OF TRUTH.\n// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.\n// Edited in editor.html.\nwindow.VENUE_DOC = window.VENUE_DOC || {};\n';
const load = (v) => { global.window = {}; eval(fs.readFileSync(path.join(ROOT, 'assets/venues', v + '.venue.js'), 'utf8')); return window.VENUE_DOC[v]; };
const save = (v, d) => { const s = HEAD + 'window.VENUE_DOC[' + JSON.stringify(v) + '] = ' + JSON.stringify(d, null, 2) + ';\n'; if (!DRY) fs.writeFileSync(path.join(ROOT, 'assets/venues', v + '.venue.js'), s); };
const hull = (P) => { P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = []; for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); } return lo.slice(0, -1).concat(hi.slice(0, -1)); };
// The course water: hull of every leg's saved path, each vertex pushed out from the centroid by MARGIN.
const courseRegion = (d, margin) => {
    const pts = []; for (const L of d.course.paths.legs) for (const p of L.pts) pts.push(p);
    const H = hull(pts), cx = H.reduce((a, p) => a + p[0], 0) / H.length, cy = H.reduce((a, p) => a + p[1], 0) / H.length;
    return H.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [Math.round((x + dx / l * margin) * 10) / 10, Math.round((y + dy / l * margin) * 10) / 10]; });
};
// ...or one source PER LEG (perLeg): the hull of each leg's own path. In a cove or down a winding river the
// whole course's hull is mostly land, and a cell born over land is painted over — wasted (first pass:
// Lighthouse Cove and Sockeye showed a key and no cells). Count is shared out across the legs.
const legRegions = (d, margin) => d.course.paths.legs.map(L => {
    const H = hull(L.pts), cx = H.reduce((a, p) => a + p[0], 0) / H.length, cy = H.reduce((a, p) => a + p[1], 0) / H.length;
    return H.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [Math.round((x + dx / l * margin) * 10) / 10, Math.round((y + dy / l * margin) * 10) / 10]; });
}).filter(P => P.length >= 3);
const NEW = {   // venue: [id, count, gustKt, sizeM, lifeS, bias (share that are gusts), veer, falloff, margin, perLeg]
    bay:      ['gust-course', 6, 5, 450, 70, 0.60, 15, 250, 300, true],
    glowtide: ['gust-course', 6, 4, 200, 70, 0.55, 15, 250, 300, true],   // 200 m: the map is 622 m across, and 400 m covered most of the course at once
    flats:    ['gust-course', 8, 5, 500, 70, 0.60, 15, 250, 300, true],
    volcanic: ['gust-storm', 10, 8, 450, 45, 0.75, 20, 300, 450],
    otter:    ['gust-course', 8, 5, 450, 70, 0.55, 15, 300, 400, true],
    river:    ['gust-course', 3, 5, 300, 40, 0.60, 10, 150, 150, true],
};
const RETUNE = {
    ocean:   (r) => Object.assign(r, { sizeM: 1300, count: 10, lifeS: 180, bias: 0.65 }),
    arctic:  (r) => Object.assign(r, { count: 7, sizeM: 450, bias: 0.65, veer: 25 }),
    redrock: (r) => Object.assign(r, { sizeM: 320, count: 5, bias: 0.65 }),
};
for (const [v, [id, count, gustKt, sizeM, lifeS, bias, veer, falloff, margin, perLeg]] of Object.entries(NEW)) {
    const d = load(v);
    d.gusts = d.gusts || { regions: [] }; d.gusts.regions = (d.gusts.regions || []).filter(r => !r.id.startsWith(id));
    const polys = perLeg ? legRegions(d, margin) : [courseRegion(d, margin)];
    // the count shared out: every source at least one, the rest to the longest legs first
    const n = polys.length, each = polys.map(() => Math.max(1, Math.floor(count / n)));
    let left = count - each.reduce((a, c) => a + c, 0);
    const order = polys.map((P, i) => [i, P.length]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    for (let k = 0; left > 0; k = (k + 1) % n, left--) each[order[k]]++;
    polys.forEach((poly, i) => d.gusts.regions.push({ id: perLeg ? `${id}-leg${i + 1}` : id, poly, falloff, count: each[i], gustKt, sizeM, lifeS, bias, veer }));
    save(v, d); console.log(`${v.padEnd(9)} + ${n} source(s) [${each.join('/')}]: ${gustKt} kt, ${sizeM} m, life ${lifeS} s, gusts ${Math.round(bias * 100)}%, veer ${veer}`);
}
for (const [v, f] of Object.entries(RETUNE)) {
    const d = load(v); for (const r of d.gusts.regions) f(r); save(v, d);
    console.log(`${v.padEnd(9)} ~ ${d.gusts.regions.map(r => `${r.id}: count ${r.count}, ${r.sizeM} m, gusts ${Math.round(r.bias * 100)}%, veer ${r.veer}`).join(' | ')}`);
}
if (DRY) console.log('(dry run — nothing written)');
