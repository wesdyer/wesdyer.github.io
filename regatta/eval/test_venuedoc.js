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
const doc = global.window.VENUE_DOC.holetest;

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
check('duplicate land id', mutate(d => { d.land[1].id = d.land[0].id; })
      .some(p => /duplicate land id/.test(p.msg)));
check('rounding references unknown land', mutate(d => { d.course.route[1].landId = 'nope'; })
      .some(p => /unknown land/.test(p.msg)));
check('bad rounding side', mutate(d => { d.course.route[1].side = 'sideways'; })
      .some(p => /side/.test(p.msg)));
check('route mark out of range', mutate(d => { d.course.route[0].marks = [0, 7]; })
      .some(p => /missing mark/.test(p.msg)));
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
check('rounding resolves to the granite shape',
      c.roundMark && c.roundMark.landId === 'granite-isle');

// The fixture is not a real venue; leave no loadable document behind.
fs.unlinkSync(DOC);
fs.unlinkSync(GEO);

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
process.exitCode = failures ? 1 : 0;
