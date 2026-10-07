// THE MAP LINE — a venue's shapes may run past the race boundary; those wholly past the map line
// (VenueDoc.mapLine: the boundary pushed out world.mapMargin, default 1200 u) are map-only scenery.
//
//   node regatta/eval/test_mapline.js
//
//   race     no map-only shape compiles into the race (islands), every one into the backdrop the maps draw
//   hash     recordsHash and courseSig ignore map-only shapes (adding scenery resets no record book)
//   saved    every venue's saved course paths are still current (courseSig matches)
//   budget   the race-side vertex count stays near the ~2.5k budget (2.7k hard ceiling; Gatorgrass sits at 2.53k)
const { chromium } = require('playwright'); const path = require('path');
let fails = 0;
const check = (n, ok, d) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); if (!ok) fails++; };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.VenueDoc && window.VENUE_DOC && VenueDoc.mapLine);
    const r = await p.evaluate(() => VENUE_ORDER.map(v => {
        const doc = VenueDoc.get(v), c = VenueDoc.compile(doc, true);
        const mapOnly = doc.shapes.filter(s => VenueDoc.isMapOnly(doc, s) && VenueDoc.traits(s).motion !== 'drift');   // drifting ice always races
        const ids = new Set(c.islands.map(i => i.id)), bd = new Set((c.backdrop || []).map(i => i.id));
        const leaked = mapOnly.filter(s => ids.has(s.id)).length, missing = mapOnly.filter(s => !bd.has(s.id)).length;
        // a scenery shape added far out must not move the hash or the sig
        const d2 = JSON.parse(JSON.stringify(doc)); const L = VenueDoc.mapLine(d2);
        const far = L.radiusAt(L.cx + 1, L.cy) + 3000;
        d2.shapes.push({ id: 'probe', kind: doc.shapes.find(s => VenueDoc.traits(s) && !VenueDoc.traits(s).awash && !VenueDoc.traits(s).hidden)?.kind || 'isle',
                         outer: [[L.cx + far, L.cy - 200], [L.cx + far + 400, L.cy - 200], [L.cx + far + 400, L.cy + 200], [L.cx + far, L.cy + 200]] });
        const raceVerts = VenueDoc.raceShapes(doc).reduce((t, s) => t + s.outer.length + (s.holes || []).reduce((a, h) => a + h.length, 0), 0);
        return { v, mapOnly: mapOnly.length, leaked, missing,
                 hashSame: VenueDoc.recordsHash(d2) === VenueDoc.recordsHash(doc), sigSame: VenueDoc.courseSig(d2) === VenueDoc.courseSig(doc),
                 saved: !!VenueDoc.savedPaths(doc), raceVerts };
    }));
    for (const x of r) {
        check(`${x.v}: ${x.mapOnly} map-only shapes kept out of the race and drawn on the maps`, !x.leaked && !x.missing, `${x.leaked} leaked, ${x.missing} missing`);
        check(`${x.v}: far scenery leaves recordsHash and courseSig alone`, x.hashSame && x.sigSame);
        check(`${x.v}: saved course paths current`, x.saved);
        check(`${x.v}: race-side vertices within budget`, x.raceVerts <= 2700, `${x.raceVerts}`);
    }
    check('no page errors', !errs.length, errs.slice(0, 2).join(' | '));
    await b.close();
    console.log(fails ? `FAIL — ${fails} failure(s)` : 'PASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
