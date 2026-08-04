// FREEZE a generated venue into a venue DOCUMENT.
//
//   node regatta/art/freeze_venue_doc.js bay
//   node regatta/art/freeze_venue_doc.js --all
//   node regatta/art/freeze_venue_doc.js river --seed 90210
//
// Nine of the ten venues were built by `initCourse`'s generator: a windward-leeward laid
// along whatever direction the race rolled for the wind, with islands scattered by the
// seed. Nothing about them could be authored, so the editor could open a document they
// would never race. This runs the generator ONCE, at a fixed seed, and writes down what
// it made. From then on the venue is designed and the editor is the way to change it.
//
// The generator STAYS. It is the fallback for a venue with no document, and it is what
// produced every layout here — this is a freeze, not a replacement.
//
// Run in a real browser, because the generator is the game: island placement rejects
// candidates against the course, the river's banks are laid on the wind axis, and every
// one of those paths lives in script.js. Deriving the geometry a second time in Node is
// how the last migration exporter went subtly wrong (see export_venue_doc.js).
//
// NO ROUNDING of geometry. Rounding mark positions to 6 decimals moved boat headings by
// 1e-4 within three minutes of race time — the simulation is chaotic. JSON.stringify
// already emits the shortest round-trippable form of a double.
//
// WHAT CHANGES when a venue is frozen, stated plainly because it is the point:
//   · the course no longer rotates to a freshly rolled wind each race — the layout is the
//     layout, which is what a real venue is, and what makes a course worth designing;
//   · the Laps and Course Distance sliders stop reshaping it (`state.course.doc` already
//     gated those — the design wins over the preference);
//   · island layout stops varying by seed;
//   · the venue blows its characteristic strength every race instead of drawing one from
//     a range — see the note on `speedVar` below for why that is not recoverable by
//     setting a variance, and what it would actually take.
// Gusts, shifts, fleet traits, weed beds, brash and the river's stream all still come from
// the race seed, so the pressure still moves around the course and no two races are the
// same. What is fixed is the geography.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const val = (f, d) => { const i = ARGS.indexOf(f); return i >= 0 && ARGS[i + 1] ? ARGS[i + 1] : d; };
const SEED = parseInt(val('--seed', '90210'), 10);
const ALL = ARGS.includes('--all');
// arctic is absent on purpose: it was imported from a painted mask and has been authored
// since. Freezing it would overwrite hand edits with a generator that never made it.
const GENERATED = ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock',
                   'glowtide', 'seatrials'];
const VENUES = ALL ? GENERATED : ARGS.filter(a => !a.startsWith('--') && GENERATED.includes(a));
if (!VENUES.length) {
    console.error(`usage: freeze_venue_doc.js <venue|--all> [--seed N]\n  venues: ${GENERATED.join(', ')}`);
    process.exit(1);
}

// The arena as a POLYGON, always — one arena model everywhere, which is the model the
// editor edits. The generated arena is a circle, so it is emitted as an inscribed-free
// 64-gon: at that count the polygon's inradius is 0.9988r, i.e. under six units of the
// 4500-unit arena, which is less than a hull length.
//
// A circle twin is deliberately NOT kept alongside it. `Arena.sample` has a two-draw
// analytic path for circles and rejection-samples polygons, so the two disagree about
// how much RNG a gust placement consumes; a stale twin would leave that fast path
// describing the wrong shape. One shape, one answer.
const ARENA_SIDES = 64;

(async () => {
    const browser = await chromium.launch();
    for (const venue of VENUES) {
        const page = await browser.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(e.message));
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.evaluate(k => localStorage.setItem('regatta_settings', JSON.stringify({ venue: k })), venue);

        const doc = await page.evaluate(([venue, seed, sides]) => {
            // The generator must run WITHOUT a document, or it would freeze whatever it
            // last froze — the self-re-export trap that broke the mask exporter.
            const saved = window.VENUE_DOC && window.VENUE_DOC[venue];
            if (saved) delete window.VENUE_DOC[venue];
            const real = Math.random; Math.random = mulberry32(seed);
            try { resetGame(); } finally { Math.random = real; if (saved) window.VENUE_DOC[venue] = saved; }

            const course = state.course, V = VENUES[venue];
            if (course.doc) throw new Error('froze a document, not the generator');
            const b = course.boundary;

            // ── Arena ───────────────────────────────────────────────────────
            let arena;
            if (state.race.riverCurrent) {
                // The river's sailable water is the bank CORRIDOR, not the circle: the
                // physics clamp has always used a rectangle in river coordinates and the
                // circle was never what bounded a boat here. Authoring the rectangle
                // makes the arena the thing it has been all along — and visible, so a
                // designer can see and move the wall the fleet actually hits.
                // Limits copied from the clamp in updateBoatPhysics.
                const rc = state.race.riverCurrent, LAT = 1120, ALONG = rc.dist / 2 + 1370;
                arena = [[-ALONG, -LAT], [ALONG, -LAT], [ALONG, LAT], [-ALONG, LAT]]
                    .map(([a, l]) => [rc.cx + rc.ux * a + rc.rx * l, rc.cy + rc.uy * a + rc.ry * l]);
            } else {
                arena = [];
                for (let i = 0; i < sides; i++) {
                    const t = (i / sides) * Math.PI * 2;
                    arena.push([b.x + Math.cos(t) * b.radius, b.y + Math.sin(t) * b.radius]);
                }
            }

            // ── Land ────────────────────────────────────────────────────────
            // Every generated island. `vegVertices`, `trees` and `rocks` are dressing that
            // compile derives or fills, so only the ring, the class and the two opt-outs
            // are written down.
            const land = (course.islands || []).map((isl, i) => {
                const outer = isl.vertices.map(v => [v.x, v.y]);
                const cx = outer.reduce((a, q) => a + q[0], 0) / outer.length;
                const cy = outer.reduce((a, q) => a + q[1], 0) / outer.length;
                const e = {
                    id: isl.isBank ? `bank-${i + 1}` : `isle-${i + 1}`,
                    cls: isl.style || 'tropical',
                    style: isl.style || 'tropical',
                    soft: !!isl.soft,
                    // Derived from `outer`, and re-derived by the editor on every edit, so
                    // the two can never drift apart.
                    c: [cx, cy],
                    r: Math.max.apply(null, outer.map(q => Math.hypot(q[0] - cx, q[1] - cy))),
                    outer, holes: []
                };
                // The river's banks are invisible colliders behind one continuous drawn
                // shore, and are kept out of the A* graph — 82 of them once caused
                // multi-hundred-ms replan spikes.
                if (isl.isBank) { e.hidden = true; e.nav = false; }
                return e;
            });

            // ── Course ──────────────────────────────────────────────────────
            // The generated windward-leeward, written as the objects it always was: a
            // start/finish line, a windward gate, and a route that names each crossing.
            // `marks[0..3]` was this course encoded as an array index; the document says
            // it out loud.
            const m = course.marks;
            const marks = [
                { id: 'sf-pin',  name: 'Pin',    x: m[0].x, y: m[0].y, kind: 'inflatable' },
                { id: 'sf-boat', name: 'Boat',   x: m[1].x, y: m[1].y, kind: 'inflatable' },
                { id: 'wg-port', name: 'Port',   x: m[2].x, y: m[2].y, kind: 'can' },
                { id: 'wg-stbd', name: 'Starboard', x: m[3].x, y: m[3].y, kind: 'can' }
            ];
            const lines = [
                { id: 'sf', name: 'Start / finish line', marks: ['sf-pin', 'sf-boat'] },
                { id: 'wg', name: 'Windward gate',       marks: ['wg-port', 'wg-stbd'] }
            ];
            // Mirrors buildRoute('wl', totalLegs) exactly, minus the two entries it
            // generates PAST the finish: `legs` is derived from route length here, so a
            // tail would race two legs too many.
            const legs = state.race.totalLegs;
            const route = [];
            for (let leg = 0; leg <= legs; leg++) {
                const up = leg === 0 || leg % 2 !== 0;
                route.push({
                    kind: leg === 0 ? 'line' : 'gate',
                    lineId: (leg % 2 !== 0) ? 'wg' : 'sf',
                    dir: up ? 1 : -1,
                    role: leg === 0 ? 'start' : (leg % 2 !== 0 ? 'windward' : 'leeward'),
                    ...(leg === legs ? { finish: true } : {})
                });
            }

            // ── Wind ────────────────────────────────────────────────────────
            // One region over the whole map: "the same everywhere" is a region, because
            // there is no base wind any more — a region states a speed or the water is
            // calm. The direction is the one this course was laid along, so start line
            // and windward gate mean what they say.
            //
            // The SPEED is the venue's own range at its MIDPOINT, not the value this seed
            // happened to roll — a rolled value is an accident of the freeze.
            //
            // `speedVar` is 0, and that is deliberate. It is NOT per-race variety: getWindAt
            // reads it as an oscillation amplitude with an explicit time scale, so setting it
            // to half the venue's range gives the whole map a ±5 kn pulse every `period`
            // seconds — a weather system this game does not have, invented by misreading a
            // field. "6 to 12 knots" means a race draws one of those; it does not mean the
            // wind swings between them and back twice a minute.
            //
            // So freezing DOES cost per-race wind strength: every race here now blows the
            // venue's characteristic mean. Gusts and shifts still come from the seed, so the
            // pressure still moves around the course. Glacier Sound, the one hand-authored
            // document, states its wind exactly this way.
            const range = (V && V.wind) || [8, 18];      // resetGame's own 8 + rand*10
            const mid = (range[0] + range[1]) / 2;
            const S = Math.ceil(Math.max.apply(null,
                arena.flatMap(p => [Math.abs(p[0]), Math.abs(p[1])])) / 500) * 500 * 2;

            return {
                schema: 1,
                venue,
                // ⚠️ NO `name`. `doc.name` is an OVERRIDE — editor.js `venueName()` prefers it
                // over `VENUES[key].name` so one venue can carry several differently-named
                // courses. Writing the stock name here overrode nothing and quietly broke
                // renaming: when Sea Trial Bay became Clubhouse Point the game followed and
                // the editor did not, because the frozen document still said the old name.
                // editor.js already refuses to store a name equal to the stock one; the
                // freezer has to keep the same rule.
                note: `Frozen from the course generator at seed ${seed} by art/freeze_venue_doc.js. `
                    + 'AUTHORED from here on — edit in editor.html. Re-freezing discards edits.',
                world: {
                    size: S,
                    boundary: { poly: arena, circle: null }
                },
                land,
                course: {
                    description: `Windward-leeward, ${legs} legs. Start and finish on the same line.`,
                    marks, lines, route
                },
                wind: {
                    regions: [{
                        id: 'wind-all', name: 'Course wind',
                        poly: [[-S, -S], [S, -S], [S, S], [-S, S]],
                        falloff: 400,
                        direction: state.wind.baseDirection,
                        dirVar: 0,
                        speed: mid, speedVar: 0, period: 30
                    }]
                }
            };
        }, [venue, SEED, ARENA_SIDES]);

        if (errs.length) { console.error(`  PAGE ERRORS on ${venue}:`, errs.slice(0, 3)); process.exit(1); }

        const out = path.resolve(`regatta/assets/venues/${venue}.venue.js`);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        // THE CARD SURVIVES A RE-FREEZE. The card block (name, tag, blurb, conditions,
        // hazards) is authored copy, not generator output — a freeze replaces the
        // geometry and the weather, not what the clubhouse calls the place.
        if (fs.existsSync(out)) {
            const prev = fs.readFileSync(out, 'utf8').match(/^  "card": (\{[\s\S]*?\n  \}),?\n/m);
            if (prev) {
                try { doc.card = JSON.parse(prev[1]); } catch (e) { /* malformed: freeze without it */ }
            }
        }
        fs.writeFileSync(out,
            '// GENERATED ONCE by art/freeze_venue_doc.js — now the SOURCE OF TRUTH.\n'
            + '// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.\n'
            + '// Edited in editor.html.\n'
            + 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
            + `window.VENUE_DOC[${JSON.stringify(venue)}] = ${JSON.stringify(doc, null, 2)};\n`);

        const verts = doc.land.reduce((a, l) => a + l.outer.length, 0);
        const w = doc.wind.regions[0];
        console.log(`${venue.padEnd(9)} land ${String(doc.land.length).padStart(3)} shapes / `
            + `${String(verts).padStart(4)} verts   arena ${doc.world.boundary.poly.length}-gon   `
            + `${doc.course.route.length - 1} legs   `
            + `wind ${Math.round(w.direction * 180 / Math.PI)}° ${w.speed}±${w.speedVar}kn`);
        await page.close();
    }
    await browser.close();
})();
