// The sailable grid's DEEP-IN-LAND shortcut (sailcheck.js buildGridRaw, PT-046) is exact: for every venue,
// the grid the full build asks for is built twice — as shipped, and with opts.noDeep (every land cell sampled
// the long way) — and nav, the tight tier and the archipelago-gated tier must agree cell for cell.
//   node regatta/eval/_grid_deep_check.js [venue ...]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = process.env.ROOT || path.resolve(__dirname, '../..');
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'otter', 'flats', 'volcanic', 'seatrials'];
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + ROOT + '/regatta/index.html');
    await p.waitForFunction(() => window.state && typeof selectVenue === 'function' && window.SailCheck);
    let bad = 0;
    for (const v of VENUES) {
        const r = await p.evaluate((v) => {
            const S = window.SailCheck, real = S.buildGrid; let args = null;
            resetGame(); settings.venue = v; selectVenue(v);
            S.buildGrid = function (land, arena, obstacles, opts) { args = [land, arena, obstacles, opts]; return real.apply(this, arguments); };
            try { loadVenueWorld(); }
            finally { S.buildGrid = real; }
            if (!args) return { v, none: true };
            const [land, arena, obstacles, opts] = args;
            const ref = Object.assign({}, opts || {}, { noDeep: true });
            let A, B, tA = Infinity, tB = Infinity;   // best of two each, alternated: warm-up lands on neither side
            for (let k = 0; k < 2; k++) {
                let t = performance.now(); B = S._buildGridRaw(land, arena, obstacles, ref); tB = Math.min(tB, performance.now() - t);
                t = performance.now(); A = S._buildGridRaw(land, arena, obstacles, opts); tA = Math.min(tA, performance.now() - t);
            }
            const diff = (x, y) => { if (!x || !y) return x === y ? 0 : -1; if (x.length !== y.length) return -1; let d = 0; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) d++; return d; };
            return { v, venue: state.course.venueKey, n: A.n, nav: diff(A.nav, B.nav), tight: diff(A._tight, B._tight), tightAll: diff(A._tightAll, B._tightAll), ms: Math.round(tA), ref: Math.round(tB) };
        }, v);
        if (r.none) { console.log(`${v.padEnd(10)} no grid built`); continue; }
        const ok = r.nav === 0 && r.tight === 0 && r.tightAll === 0 && r.venue === v;
        if (!ok) bad++;
        console.log(`${(ok ? 'ok  ' : 'FAIL')} ${v.padEnd(10)} ${r.n}x${r.n}  differ nav ${r.nav} tight ${r.tight} tightAll ${r.tightAll}   ${r.ref} -> ${r.ms} ms${r.venue !== v ? '  (built ' + r.venue + ')' : ''}`);
    }
    console.log(bad ? `FAIL — ${bad} venue(s) differ` : 'PASS — every grid identical');
    await b.close();
    process.exit(bad ? 1 : 0);
})();
