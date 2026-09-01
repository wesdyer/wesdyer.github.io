// Sandy shoals: the bar you sail OVER.
//
//   node regatta/eval/test_shoal.js
//
// A shoal is the first shape that is neither land nor scenery — it does not collide, it is
// not an obstacle to the router, and it casts no lee, but crossing it costs real seconds.
// That makes it the shape with the most ways to be half-implemented, so the checks here are
// about the SEAMS rather than the feature: the picture, the physics and the routing all
// read one function, and every existing venue has to be untouched by the whole thing.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
let failures = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log(`  ok    ${name}`); }
    else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures++; }
};
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-6 : eps);

global.window = {};
const load = (f) => new Function('window', fs.readFileSync(path.join(ROOT, 'regatta/js', f), 'utf8'))(global.window);
load('arena.js');
load('venuedoc.js');
const V = global.window.VenueDoc;

// ── Fixture ─────────────────────────────────────────────────────────────────
// A square bar 800u across, centred on the origin, inside an arena big enough that nothing
// clips it. Square rather than round so the distance-to-edge maths has a known answer: at
// the centre the nearest edge is exactly 400u away, which is past any feather.
const BAR = [[-400, -400], [400, -400], [400, 400], [-400, 400]];
// A real windward-leeward, because compileVenueDoc walks the route to derive the course
// axis and the cutoff — an empty one is not a smaller document, it is an invalid one.
const COURSE = () => ({
    marks: [{ id: 'sf-pin', x: -300, y: 1400, kind: 'can' }, { id: 'sf-boat', x: 300, y: 1400, kind: 'can' },
            { id: 'wg-port', x: -300, y: -1400, kind: 'can' }, { id: 'wg-stbd', x: 300, y: -1400, kind: 'can' }],
    lines: [{ id: 'sf', marks: ['sf-pin', 'sf-boat'] }, { id: 'wg', marks: ['wg-port', 'wg-stbd'] }],
    route: [{ kind: 'line', lineId: 'sf', dir: 1, role: 'start' },
            { kind: 'gate', lineId: 'wg', dir: 1, role: 'windward' },
            { kind: 'gate', lineId: 'sf', dir: -1, role: 'leeward', finish: true }]
});
const mkShapes = (shapes) => ({
    schema: 1, venue: 'shoaltest',
    card: { name: 'Shoal Test', tag: 'Test', blurb: '', conditions: '', hazards: '' },
    world: { size: 4000, boundary: { poly: [[-2000, -2000], [2000, -2000], [2000, 2000], [-2000, 2000]], circle: null } },
    shapes, course: COURSE(), gusts: { regions: [] },
    // Outside a wind region there is no breeze at all, so a document with none is not a
    // simpler fixture — it is an unsailable one, and the validator says so.
    wind: { regions: [{ id: 'w', direction: 0, speed: 12, poly: [[-2000, -2000], [2000, -2000], [2000, 2000], [-2000, 2000]] }] }
});
const mkDoc = (shape) => mkShapes([Object.assign({ id: 'bar', outer: BAR, holes: [] }, shape)]);

console.log('the kind exists and validates');
const errs = V.validate(mkDoc({ kind: 'shoal' })).filter(e => (e.level || e) !== 'warn');
check('a document with a shoal in it validates', errs.length === 0,
      errs.map(e => e.msg || e.detail || JSON.stringify(e)).join(' · '));
check('shoal is in the shared kind table', !!V.KINDS.shoal);

console.log('\nwhat a shoal IS');
const T = V.traits({ kind: 'shoal', outer: BAR });
check('it is awash', T.awash === true);
check('it does not ground you', T.hard === false);
// Retuned 2026-08-08 (0.5 -> 0.65 -> 0.8): a bar crossing should be a decision, not a
// nuisance, and the deep floor is what carries that now that the feather is long again.
// Pinned exactly so a drive-by change gets caught; the field checks below read the
// floor FROM the kind, so only this line states the number.
check('it takes 80% of your speed at its heart', near(T.drag, 0.8));
check('it stays in the A* graph — the router has to know it is there', T.nav === true);
check('it does not drift', T.motion === 'fixed');
// The one that would be easy to get wrong: an awash shape carrying a height from a kind
// swap would quietly acquire a 300 m wind shadow off a sandbar.
const tall = V.compile(mkDoc({ kind: 'shoal', height: 60, windShadow: 900, currentShadow: 900 }));
const tallBar = tall.islands.find(i => i.id === 'bar');
check('an authored height cannot give a shoal a lee', tallBar.height === 0);
check('...nor can an authored wind shadow', tallBar.windShadow === 0);
check('...nor an authored wake', tallBar.currentShadow === 0);

console.log('\ndrag is clamped, not trusted');
check('a drag over 0.9 is pulled back to it — nothing traps a boat in water it floats on',
      near(V.traits({ kind: 'shoal', drag: 5 }).drag, 0.9));
check('a negative drag is 0', near(V.traits({ kind: 'shoal', drag: -1 }).drag, 0));
check('drag is overridable per shape', near(V.traits({ kind: 'shoal', drag: 0.25 }).drag, 0.25));
check('...and means nothing on a shape that is not awash',
      V.traits({ kind: 'granite', drag: 0.5 }).awash === false);

console.log('\nthe depth field');
const c = V.compile(mkDoc({ kind: 'shoal' }));
const bar = c.islands.find(i => i.id === 'bar');
check('the compiled shape is awash', bar.awash === true);
check('its multiplier at the heart is the kind\'s floor', near(bar.shoalMul, 1 - T.drag));
const at = (x, y) => V.shoalMul(bar, x, y);
check('deep water outside it is untouched', near(at(1200, 0), 1) && near(at(0, -900), 1));
check('the shallowest part is the floor', near(at(0, 0), bar.shoalMul));
// The seam that matters most: the picture fades to nothing exactly where the drag does, so
// the edge you can see is the edge you can feel.
check('the outline itself costs nothing — no step to hit', near(at(399.99, 0), 1, 2e-3), `${at(399.99, 0)}`);
check('...and just inside it, it has begun', at(390, 0) < 1 && at(390, 0) > bar.shoalMul, `${at(390, 0)}`);
check('full drag by one feather in', near(at(400 - bar.shoalFeather, 0), bar.shoalMul, 1e-6),
      `${at(400 - bar.shoalFeather, 0)}`);
let monotone = true, prev = 1;
for (let d = 0; d <= 200; d += 2) {
    const m = at(400 - d, 0);
    if (m > prev + 1e-9) monotone = false;
    prev = m;
}
check('it only ever gets slower on the way in', monotone);
// Smoothstep, not a ramp: zero gradient where it meets deep water, so a boat sitting on the
// rim does not have its speed oscillate with its own leeway.
// The mid sample sits at HALF the feather — the ramp's steepest point wherever the
// feather ends up — not at a fixed depth that a shorter feather turns into flat floor.
const fh = bar.shoalFeather / 2;
const g1 = at(400 - 2, 0) - at(400 - 0, 0), g2 = at(400 - fh - 1, 0) - at(400 - fh + 1, 0);
check('the ramp eases in rather than starting with a corner', Math.abs(g1) < Math.abs(g2) / 3,
      `edge ${g1.toFixed(5)} vs mid ${g2.toFixed(5)}`);

console.log('\nthe feather never swallows a small bar');
const small = V.compile(mkDoc({ kind: 'shoal', outer: [[-60, -60], [60, -60], [60, 60], [-60, 60]] }));
const sBar = small.islands.find(i => i.id === 'bar');
check('a small shoal shortens its own ramp', sBar.shoalFeather < bar.shoalFeather, `${sBar.shoalFeather}`);
check('...and still reaches full drag somewhere', near(V.shoalMul(sBar, 0, 0), sBar.shoalMul, 1e-6),
      `${V.shoalMul(sBar, 0, 0)}`);

console.log('\nholes are water, not shallows');
const holed = V.compile(mkDoc({ kind: 'shoal', holes: [[[-150, -150], [150, -150], [150, 150], [-150, 150]]] }));
const hBar = holed.islands.find(i => i.id === 'bar');
check('a hole in a bar is deep water', near(V.shoalMul(hBar, 0, 0), 1));
check('...and the sand around it still drags', V.shoalMul(hBar, 280, 0) < 1);
// The keyholed trace cuts a zero-width slit to reach the hole. Measuring depth against it
// would lay a false strip of deep water across the bar, which is why shoalRings is the
// unkeyholed set.
check('the keyhole slit is not a channel', V.shoalMul(hBar, 280, 5) < 1 && V.shoalMul(hBar, 280, -5) < 1);

console.log('\noverlapping bars are one bottom');
const two = V.compile(mkShapes([
    { id: 'a', kind: 'shoal', outer: BAR, holes: [] },
    { id: 'b', kind: 'shoal', drag: 0.3, outer: BAR.map(p => [p[0] + 200, p[1]]), holes: [] }
]));
const both = V.shoalField(two.islands, 0, 0);
check('the shallowest wins rather than the two multiplying', near(both, 1 - T.drag), `${both}`);
check('...so no pair can invent water shallower than either', both >= 1 - T.drag - 1e-9);

console.log('\nnothing is awash by accident');
// This began as "no shipped venue names the kind", which was true on the day the kind
// landed and became false the moment Sockeye Run was redrawn with nine bars — reporting a
// venue ADOPTING the feature as a regression in it. The additive claim was only ever a
// proxy: what has to hold forever is that a shape is awash IF AND ONLY IF its own kind or
// its own override says so. That allows a venue to use shoals and still catches the thing
// worth catching — ordinary land quietly acquiring the trait, losing its collider and its
// lee because a default leaked.
const VENUES = fs.readdirSync(path.join(ROOT, 'regatta/assets/venues')).filter(f => f.endsWith('.venue.js'));
for (const f of VENUES) {
    delete require.cache[require.resolve(path.join(ROOT, 'regatta/assets/venues', f))];
    require(path.join(ROOT, 'regatta/assets/venues', f));
}
const wrong = [];
let shapesSeen = 0, awashSeen = 0;
for (const key of Object.keys(global.window.VENUE_DOC)) {
    if (key === 'shoaltest') continue;
    const dv = V.get(key);
    const want = new Map();
    for (const s of V.shapes(dv)) want.set(s.id, V.traits(s).awash);
    for (const isl of V.compile(dv).islands) {
        // CONTACT PROPS COMPILE TO HIDDEN `.hit` SHAPES by design (venuedoc compile:
        // hard -> a hidden isle, soft -> a hidden SHOAL carrying the prop's drag, so
        // collision, the drag field and the router meet them as ordinary shapes). They
        // have no document shape to compare against — the doc-vs-runtime match below is
        // about AUTHORED shapes keeping their trait through compile, and a soft float's
        // awash shoal is the compiler doing its job, not a drifted trait (bay's cove
        // floats and dinghies, 2026-08-31).
        if (/\.hit$/.test(isl.id) && !want.has(isl.id)) continue;
        shapesSeen++;
        if (isl.awash) awashSeen++;
        const expect = !!want.get(isl.id);
        if (!!isl.awash !== expect) wrong.push(`${key}/${isl.id}: doc says ${expect}, runtime says ${!!isl.awash}`);
        // The multiplier and the flag are one decision; a solid shape carrying a drag would
        // be taxed on water it also blocks.
        if (!isl.awash && isl.shoalMul !== 1) wrong.push(`${key}/${isl.id}: solid but shoalMul ${isl.shoalMul}`);
    }
}
check(`awash matches the document in ${VENUES.length} venues `
      + `(${shapesSeen} shapes, ${awashSeen} genuinely awash)`, wrong.length === 0,
      wrong.slice(0, 4).join(' · '));

console.log(failures ? `\nFAIL — ${failures} failure(s)` : '\nAll shoal checks passed');
process.exit(failures ? 1 : 0);
