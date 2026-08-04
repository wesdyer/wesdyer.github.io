// Venue-document tests: hole support and polygon validation.
//
//   node regatta/eval/test_venuedoc.js
//
// These exist because the Arctic mask cannot exercise either path. Its water
// reaches the image edge, so its land is simply connected and it has no holes —
// which means hole handling and the topology validators would ship untested. The
// fixture below is a synthetic mask with a lagoon fully enclosed by land.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const MASK = path.join(ROOT, 'regatta/assets/images/venues/masks/holetest-mask.png');
const GEO = path.join(ROOT, 'regatta/assets/images/venues/masks/holetest-geo.js');
const DOC = path.join(ROOT, 'regatta/assets/venues/holetest.venue.js');

let failures = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log(`  ok    ${name}`); }
    else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures++; }
};

// ── Fixture: navy sea, a white ANNULUS of land with an enclosed lagoon ───────
if (!fs.existsSync(MASK)) {
    console.log('regenerating fixture mask...');
    execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw
n=600
im=Image.new('RGB',(n,n),(52,63,114))
d=ImageDraw.Draw(im)
d.ellipse([150,150,450,450], fill=(255,255,255))
d.ellipse([240,240,360,360], fill=(52,63,114))
d.ellipse([60,480,140,560],  fill=(141,141,141))
d.line([470,90,560,150], fill=(0,255,0), width=3)
im.save(${JSON.stringify(MASK)})
`], { cwd: ROOT, stdio: 'inherit' });
}

console.log('bake + import');
execFileSync('python3', ['regatta/art/bake_mask.py', 'holetest'], { cwd: ROOT, stdio: 'pipe' });
execFileSync('node', ['regatta/art/export_venue_doc.js', 'holetest'], { cwd: ROOT, stdio: 'pipe' });

global.window = {};
delete require.cache[require.resolve(DOC)];
require(DOC);
// Arena first: compileVenueDoc asks it for the bounding circle of a polygon
// boundary, which painted venues now have by default.
new Function('window', fs.readFileSync(path.join(ROOT, 'regatta/js/arena.js'), 'utf8'))(global.window);
new Function('window', fs.readFileSync(path.join(ROOT, 'regatta/js/venuedoc.js'), 'utf8'))(global.window);
const V = global.window.VenueDoc;
// get() migrates on the way out, which is how every consumer sees a document — so the
// test reads it the same way rather than validating a form nothing actually loads.
const doc = V.migrate(global.window.VENUE_DOC.holetest);

console.log('\nhole detection');
const withHole = doc.land.filter(l => l.holes.length);
check('exactly one shape has a hole', withHole.length === 1, `got ${withHole.length}`);
check('the hole has >= 4 vertices', withHole[0] && withHole[0].holes[0].length >= 4);
check('granite has no hole', (doc.land.find(l => l.cls === 'granite') || {}).holes.length === 0);

// Area sanity: land disc r=150 minus lagoon r=60, scaled from 600px to the world.
if (withHole[0]) {
    const outerA = Math.abs(V.ringArea(withHole[0].outer));
    const holeA = Math.abs(V.ringArea(withHole[0].holes[0]));
    check('hole area is ~16% of the outer ring', Math.abs(holeA / outerA - 0.16) < 0.06,
          `ratio ${(holeA / outerA).toFixed(3)}`);
}

console.log('\nbaked centroid/radius agree with the vertices');
// bake_mask.py rounds c, r and ring INDEPENDENTLY, so an importer that carries the
// baked pair over produces a document whose r disagrees with its own outer ring by
// up to 0.04 world units — and the first edit then silently corrects it, shifting an
// island radius that feeds placement, wind shadow and pathfinding.
{
    let worst = 0;
    for (const l of doc.land) {
        const n = l.outer.length;
        const cx = l.outer.reduce((a, p) => a + p[0], 0) / n;
        const cy = l.outer.reduce((a, p) => a + p[1], 0) / n;
        const r = Math.max.apply(null, l.outer.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
        worst = Math.max(worst, Math.abs(r - l.r), Math.abs(cx - l.c[0]), Math.abs(cy - l.c[1]));
    }
    check('c and r are derivable from outer', worst < 1e-9, `max delta ${worst}`);
}

console.log('\nvalidation accepts a sound document');
check('no problems reported', V.validate(doc).length === 0,
      V.validate(doc).map(p => p.msg).join('; '));

console.log('\nvalidation rejects what it should');
const mutate = (fn) => { const d = JSON.parse(JSON.stringify(doc)); fn(d); return V.validate(d).filter(p => p.level === 'error'); };
check('escaped hole vertex', mutate(d => { d.land.find(l => l.holes.length).holes[0][0] = [9e5, 9e5]; })
      .some(p => /not contained/.test(p.msg)));
check('duplicate shape id', mutate(d => { d.land[1].id = d.land[0].id; })
      .some(p => /duplicate shape id/.test(p.msg)));
// This whole fixture is a document in the OLD land[] + ice[] form — export_venue_doc.js
// still writes that, and so does anyone's copy saved before shapes existed. It validating
// and compiling at all is the migration working; these say what it turned into.
{
    const shapes = V.shapes(doc);
    check('an old land[] document migrates to shapes[]',
          shapes.length === doc.land.length && shapes.every(sh => !!V.KINDS[sh.kind]),
          shapes.map(sh => sh.kind).join(','));
    check('...granite stays the hard one, and nothing else is',
          shapes.filter(sh => V.traits(sh).hard).every(sh => sh.kind === 'granite'),
          shapes.filter(sh => V.traits(sh).hard).map(sh => sh.kind).join(','));
    check('...and the compiled islands come out in document order',
          V.compile(doc).islands.map(i => i.id).join(',') === doc.land.map(l => l.id).join(','));
}
check('rounding references a missing mark', mutate(d => { d.course.route[1].markId = 'nope'; })
      .some(p => /missing mark/.test(p.msg)));
check('a rounding that still names land is rejected',
      mutate(d => { d.course.route[1].landId = 'granite-isle'; })
      .some(p => /names a MARK/.test(p.msg)));
check('bad rounding side', mutate(d => { d.course.route[1].side = 'sideways'; })
      .some(p => /side/.test(p.msg)));
check('line references a missing mark', mutate(d => { d.course.lines[0].marks[1] = 'nope'; })
      .some(p => /missing mark/.test(p.msg)));
check('leg references a missing line', mutate(d => { d.course.route[0].lineId = 'nope'; })
      .some(p => /unusable line/.test(p.msg)));
check('a line with the same mark at both ends', mutate(d => { d.course.lines[0].marks[1] = d.course.lines[0].marks[0]; })
      .some(p => /same mark/.test(p.msg)));
check('duplicate mark id', mutate(d => { d.course.marks[1].id = d.course.marks[0].id; })
      .some(p => /duplicate mark id/.test(p.msg)));
check('degenerate outer ring', mutate(d => { d.land[0].outer = [[0, 0], [1, 0]]; })
      .some(p => />= 3 points/.test(p.msg)));
check('wrong schema', mutate(d => { d.schema = 99; }).some(p => /schema/.test(p.msg)));

console.log('\nself-intersection detection');
check('bowtie detected', V.ringSelfIntersects([[0, 0], [100, 100], [100, 0], [0, 100]]) !== null);
check('square accepted', V.ringSelfIntersects([[0, 0], [100, 0], [100, 100], [0, 100]]) === null);
check('concave L accepted',
      V.ringSelfIntersects([[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]]) === null);

console.log('\ncompile carries holes to the runtime island');
const c = V.compile(doc);
check('compiled island keeps its hole', c.islands.some(i => (i.holes || []).length === 1));
check('granite island gets facets', (c.islands.find(i => i.isRock) || {}).facets !== undefined);
// The rounding is a MARK now. What it stands on is discovered by the checks, not declared
// by the route — so what compile must get right is the mark and its size.
check('rounding resolves to its mark', c.roundMark && c.roundMark.markIdx != null,
      JSON.stringify(c.roundMark && { markIdx: c.roundMark.markIdx, radius: c.roundMark.radius }));
check('the rounding mark sits on the granite island', (() => {
    const g = doc.land.find(l => l.cls === 'granite');
    return g && c.roundMark && Math.hypot(c.roundMark.x - g.c[0], c.roundMark.y - g.c[1]) < 1;
})());
check('the rounding zone captures the island it stands on', (() => {
    const g = doc.land.find(l => l.cls === 'granite');
    return g && c.roundMark && c.roundMark.zone > g.r;
})(), c.roundMark && `zone ${Math.round(c.roundMark.zone)}`);

// The fixture is not a real venue; leave no loadable document behind.
fs.unlinkSync(DOC);
fs.unlinkSync(GEO);

// A designed course's leg count must not leak into the next venue. Glacier Sound has 2
// legs; a windward-leeward has the player's setting. Racing one then the other used to
// leave the second on 2 laps — the same shape of leak as legLength.
console.log('\nleg count does not leak between venues');
{
    const { execFileSync } = require('child_process');
    const out = execFileSync('node', ['-e', `
        const { chromium } = require('playwright');
        const path = require('path');
        (async () => {
            const b = await chromium.launch();
            const p = await b.newPage();
            await p.goto('file://' + path.resolve('regatta/index.html'));
            const r = await p.evaluate(() => {
                let s = 90210;
                Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
                    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
                const at = (v) => { localStorage.setItem('regatta_settings', JSON.stringify({venue:v}));
                                    resetGame(); return state.race.totalLegs; };
                const bayFirst = at('bay');
                const arctic = at('arctic');
                const bayAfter = at('bay');
                return { bayFirst, arctic, bayAfter };
            });
            await b.close();
            console.log(JSON.stringify(r));
        })();
    `], { cwd: ROOT, encoding: 'utf8' }).trim();
    const legs = JSON.parse(out.split('\n').pop());
    check('an island course reports its own leg count', legs.arctic === 2, String(legs.arctic));
    check('the next venue keeps the player setting', legs.bayAfter === legs.bayFirst,
          `bay was ${legs.bayFirst}, after arctic ${legs.bayAfter}`);
}

// ── Every venue is authored ─────────────────────────────────────────────────
// The engine used to take the document path only when the venue carried the `mask` fx —
// a flag only Glacier Sound had. The editor would happily open, edit and save a document
// for any of the other nine, and the game would ignore it and generate a course instead.
// Nothing failed; the work simply had no effect, which is the worst way for it to break.
{
    console.log('\nevery venue is a document, and the game races it');
    const ALL = ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock',
                 'glowtide', 'arctic', 'seatrials'];
    const out = execFileSync('node', ['-e', `
        const { chromium } = require('playwright');
        const path = require('path');
        (async () => {
            const b = await chromium.launch();
            const p = await b.newPage();
            const errs = [];
            p.on('pageerror', e => errs.push(e.message));
            await p.goto('file://' + path.resolve('regatta/index.html'));
            const r = await p.evaluate((all) => {
                let s = 90210;
                Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
                    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
                const o = {};
                for (const v of all) {
                    localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
                    resetGame();
                    const c = state.course;
                    o[v] = {
                        doc: c.doc ? c.doc.venue : null,
                        type: c.type,
                        marks: (c.marks || []).length,
                        legs: state.race.totalLegs,
                        poly: !!(c.boundary && c.boundary.poly),
                        land: (c.landShapes || []).length,
                        // A frozen course must not move when the wind rolls differently.
                        mark0: Math.round(c.marks[0].x) + ',' + Math.round(c.marks[0].y)
                    };
                }
                return o;
            }, ${JSON.stringify(ALL)});
            await b.close();
            console.log(JSON.stringify({ r, errs }));
        })();
    `], { cwd: ROOT, encoding: 'utf8' }).trim();
    const { r: got, errs } = JSON.parse(out.split('\n').pop());
    const missing = ALL.filter(v => got[v].doc !== v);
    check('every venue races on its own document', missing.length === 0, missing.join(', '));
    check('no page errors loading any of them', errs.length === 0, errs.slice(0, 2).join(' | '));
    // The type used to be hardcoded to islandRound in the document branch, which was only
    // ever right because Glacier Sound was the only document. A beat authored as lines and
    // gates has to report itself as a beat, or the laylines, the zone circles and the HUD
    // waypoint all read the wrong course.
    check('a rounding course says islandRound, a beat says wl',
          got.arctic.type === 'islandRound' && ALL.filter(v => v !== 'arctic')
              .every(v => got[v].type === 'wl'),
          ALL.map(v => `${v}:${got[v].type}`).join(' '));
    check('every arena is a polygon', ALL.every(v => got[v].poly), 
          ALL.filter(v => !got[v].poly).join(', '));
    check('the river kept its 82 banks', got.river.land === 82, String(got.river.land));
    check('Glacier Sound still rounds two legs', got.arctic.legs === 2, String(got.arctic.legs));
}

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
process.exitCode = failures ? 1 : 0;
