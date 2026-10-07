// ONE-TIME CONVERSION (Oct 2026): fold a venue's generated surround (doc.backdrop) into its own shapes.
//   · every VISIBLE fixed shape is trimmed to the map line (VenueDoc.mapLine) — the part past it was never
//     drawn and the line is now where the venue's own land ends;
//   · the surround's land PAST the line becomes ordinary venue shapes (map-only by rule: VenueDoc.isMapOnly);
//   · hidden colliders and drifting ice are left exactly as they are; doc.backdrop is removed.
//   VENUES=river NODE_PATH=node_modules node regatta/eval/_convert_surround.js [--write]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const pc = require('polygon-clipping');
const WRITE = process.argv.includes('--write');
const VENUES = (process.env.VENUES || 'river').split(',');
const close = (r) => r.concat([r[0]]);
const open = (r) => (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) ? r.slice(0, -1) : r;
const area = (r) => Math.abs(r.reduce((t, p, i) => { const q = r[(i + 1) % r.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const R1 = (r) => open(r).map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.VenueDoc && window.VENUE_DOC && VenueDoc.mapLine);
    for (const venue of VENUES) {
        const file = `regatta/assets/venues/${venue}.venue.js`;
        const text = fs.readFileSync(file, 'utf8');
        const key = `window.VENUE_DOC[${JSON.stringify(venue)}] = `, at = text.indexOf(key);
        const doc = JSON.parse(text.slice(at + key.length).replace(/;\s*$/, ''));
        if (!doc.backdrop || !doc.backdrop.shapes) { console.log(venue, 'no surround'); continue; }
        const margin = doc.backdrop.margin || 1200;
        if (margin !== 1200) doc.world.mapMargin = margin;
        const info = await p.evaluate(({ doc }) => {
            const d = JSON.parse(JSON.stringify(doc));
            const L = VenueDoc.mapLine(d);
            const vis = d.shapes.map(sh => { const T = VenueDoc.traits(sh); return !!T && T.motion === 'fixed' && !T.hidden; });
            return { ring: L.ring, vis };
        }, { doc });
        // The venue's land is trimmed a little PAST the line (OVERLAP) so it tucks under the surround's
        // continuation instead of meeting it edge to edge — a shared edge anti-aliases into a hairline.
        const OVERLAP = 60;
        const L0 = info.ring; let mx = 0, my = 0; for (const q of L0) { mx += q[0]; my += q[1]; } mx /= L0.length; my /= L0.length;
        const ringOut = L0.map(q => { const dx = q[0] - mx, dy = q[1] - my, d = Math.hypot(dx, dy) || 1; return [q[0] + dx / d * OVERLAP, q[1] + dy / d * OVERLAP]; });
        const ringPoly = [[close(info.ring)]], ringOutPoly = [[close(ringOut)]];
        let trimmed = 0, dropped = 0, vBefore = 0, vAfter = 0;
        const shapes = [];
        doc.shapes.forEach((sh, i) => {
            vBefore += sh.outer.length;
            if (!info.vis[i]) { shapes.push(sh); vAfter += sh.outer.length; return; }
            const poly = [close(sh.outer)].concat((sh.holes || []).map(close));
            const inter = pc.intersection([poly], ringOutPoly);
            const diffOut = pc.difference([poly], ringOutPoly);
            if (!diffOut.length || diffOut.every(pp => area(pp[0]) < 1)) { shapes.push(sh); vAfter += sh.outer.length; return; }   // wholly inside: untouched
            trimmed++;
            if (!inter.length) { dropped++; return; }                                              // wholly past the line
            inter.forEach((pp, k) => {
                if (area(pp[0]) < 4) return;
                const nsh = Object.assign({}, sh, { id: k ? `${sh.id}-${k + 1}` : sh.id, outer: R1(pp[0]) });
                delete nsh.c; delete nsh.r;                                                         // re-derived at compile
                const holes = pp.slice(1).map(R1); if (holes.length) nsh.holes = holes; else delete nsh.holes;
                shapes.push(nsh); vAfter += nsh.outer.length;
            });
        });
        let added = 0;
        for (const sh of doc.backdrop.shapes) {
            const poly = [close(sh.outer)].concat((sh.holes || []).map(close));
            pc.difference([poly], ringPoly).forEach((pp, k) => {
                if (area(pp[0]) < 50 * 50) return;
                const nsh = { id: `${sh.id.replace(/^sr-/, 'sur-')}${k ? '-' + (k + 1) : ''}`, kind: sh.kind, outer: R1(pp[0]) };
                const holes = pp.slice(1).map(R1); if (holes.length) nsh.holes = holes;
                shapes.unshift(nsh); added++; vAfter += nsh.outer.length;                           // under the venue's land
            });
        }
        const before = doc.shapes.length;
        doc.shapes = shapes; delete doc.backdrop;
        const surVerts = shapes.filter(s => s.id.startsWith('sur-')).reduce((t, s) => t + s.outer.length, 0);
        console.log(venue, `shapes ${before} -> ${shapes.length}: ${trimmed} trimmed (${dropped} wholly past the line), ${added} added past the line; vertices race-side ${vAfter - surVerts}, map-only ${surVerts}`);
        if (WRITE) { fs.writeFileSync(file, text.slice(0, at) + key + JSON.stringify(doc, null, 2) + ';\n'); }
    }
    await b.close();
})();
