// regatta/js/render/world.js — the static world and its cached strata: props
// (placement, wash, drifting-prop integrator — ⚠ wall-clock, called from
// draw()), harbor-traffic wakes and hulls, island/mark shadows and bodies,
// boundary ring, island styles + shoal/shallows/vegetation/reef bakes, the
// world-tile cache layer, and drawIslands. Classic script; global scope.
// Extracted verbatim from script.js (refactor 2026-08-24).
const WASH_ALPHA  = 0.26;   // peak whiteness of a lap
const WASH_POOL   = 0.20;   // peak darkness of the pool at the base
const WASH_PERIOD = 3.4;    // seconds per breath — slow enough never to read as a pulse
function drawPropWash(ctx) {
    const props = state.course && state.course.props;
    if (!props || !props.length) return;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const camX = state.camera.x, camY = state.camera.y;
    const viewRadius = cullRadius(ctx);
    const t = state.time;
    // Stable per-object phase, so two trunks never breathe in step and no trunk crawls
    // between sessions. Same trick drawSurf uses, and it touches no RNG stream.
    const hash = (u, v) => { const h = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453; return h - Math.floor(h); };
    ctx.save();
    ctx.lineCap = 'round';
    for (const p of props) {
        const k = reg[p.kind];
        if (!k || !k.wash) continue;
        const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
        const r = (k.world || 40) * (p.scale || 1) * k.wash;
        if ((x - camX) ** 2 + (y - camY) ** 2 > (viewRadius + r * 3) ** 2) continue;

        // The pool. Transparent at the very centre because the trunk covers that anyway,
        // strongest just outside the wood, gone by 1.6r.
        const pool = ctx.createRadialGradient(x, y, r * 0.35, x, y, r * 1.6);
        pool.addColorStop(0, `rgba(18,26,12,${WASH_POOL})`);
        pool.addColorStop(0.45, `rgba(18,26,12,${(WASH_POOL * 0.5).toFixed(3)})`);
        pool.addColorStop(1, 'rgba(18,26,12,0)');
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // ⚠️ WHICH FIELD PUSHES THE WATER — WIND FOR A PILING, CURRENT FOR A ROCK.
        // The default is wind, and it is right for everything this was written for: a cypress
        // trunk or a channel buoy stands in near-still water, so the side that whitens is the
        // side the BREEZE piles water against, and `up` is therefore the direction the wind
        // comes from.
        //
        // A boulder in a river is the opposite case. The water is moving fast past a fixed
        // obstruction, so what a helmsman reads is the boil DOWNSTREAM of it, not a lap on the
        // upstream face — and on this venue the current runs to 2.4 kn where the ambient
        // breeze does almost nothing to the surface. A kind opts in with
        // `washFrom: 'current'`; getCurrentAt's `direction` is where the water is going, which
        // is where the foam goes, so it is used WITHOUT the +PI the wind case needs.
        // `push` is 0..1: how hard whichever field is driving this is pushing. The two are
        // on different scales — wind runs to ~8 units, this venue's current to 2.4 knots —
        // so each is normalised against its own before the lap alpha reads it.
        let up, push;
        if (k.washFrom === 'current' && typeof getCurrentAt === 'function') {
            const cur = getCurrentAt(x, y);
            if (!cur || !cur.speed) continue;      // slack water makes no boil
            up = cur.direction;
            push = cur.speed / 2.4;
        } else {
            const w = regionWindAt(x, y);
            up = w.direction + Math.PI;
            push = w.speed / 8;
        }
        const seed = hash(x, y);
        for (let i = 0; i < 3; i++) {
            // Spread the arcs round the trunk, weighted toward windward rather than pinned
            // to it — a piling laps all round, just harder on one side.
            const spread = (i - 1) * 1.15 + (hash(x + i * 37, y - i * 19) - 0.5) * 0.7;
            const mid = up + spread;
            const lean = Math.cos(spread);                        // 1 windward, -1 lee
            const phase = (t / WASH_PERIOD + seed + i * 0.37) % 1;
            // In and out, never a hard on/off: sin gives the arc a swell and a retreat.
            const breath = Math.sin(phase * Math.PI);
            const a = WASH_ALPHA * breath * (0.35 + 0.65 * Math.max(0, lean))
                    * Math.max(0.35, Math.min(1, push));
            if (a <= 0.004) continue;
            const rr = r * (1.02 + 0.05 * breath);                // the lap runs up and back
            const half = 0.5 + 0.22 * breath;                     // and widens as it comes
            ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
            ctx.lineWidth = Math.max(0.8, r * 0.13);
            ctx.beginPath();
            ctx.arc(x, y, rr, mid - half, mid + half);
            ctx.stroke();
        }
    }
    ctx.restore();
}

// ── A CROWN YOU CAN SEE YOUR BOAT THROUGH ───────────────────────────────────
// The canopy plane is defined as the one drawn OVER the fleet, which is exactly what makes
// it the one plane able to lose a boat. Measured on a cypress crown parked over the player:
// 77% of the visible hull went, and the crowns are effectively solid discs (interior alpha
// holes are 0.0%, 0.0% and 0.4% on the three bayou canopies), so "you can see a bit through
// the leaves" was not true — nothing came through at all.
//
// So a crown fades while a hull is under it. This is the ordinary game answer to an
// occluder and it is deliberately NOT tied to land or water: a boat vanishing is a
// legibility problem wherever it happens, and the live oak roots on high ground overhanging
// the exact corner a boat wants to cut. Tying opacity to the ground underneath would also
// make a crown straddling a shoreline half-transparent along an arbitrary line.
//
// Driven by DISTANCE, so it eases in and out on its own with no timers and no popping, and
// A STRAIGHT LINE IN BOAT LENGTHS, not a curve fitted to the crown (designer, 2026-08-09):
// full opacity at TWENTY hull lengths out, fully clear with the hull dead under the stem,
// linear between. Stated in boat lengths because that is the unit the player actually reads
// distance in, and it makes the ramp identical for every tree — a tupelo and a live oak
// clear at the same range even though one crown is half again the other's width.
//
// THE FLOOR IS ZERO, AND THE TRUNK IS WHY THAT IS HONEST. Earlier versions held the crown at
// 34% and then 5%, on the argument that a hull sailing through empty air where a tree stands
// trades one lie for another. But the tree does not vanish when the crown does: the stem
// keeps drawing on the SURFACE plane at full opacity and keeps its collider, so what is left
// under your boat is the wood you are about to hit with the leaves out of the way. That is a
// truer picture than a ghost crown, not a compromise between two.
//
// TWENTY LENGTHS IS A LONG RAMP, and it is doing something broader than uncovering your hull:
// at 1120u a tree ten lengths off still sits at 50%, so the whole neighbourhood thins around
// the player and the wood closes back in behind. Nothing pops, nothing switches state, and
// there is no edge anywhere at which a crown becomes solid. On a venue carrying 1500 trees
// that means roughly ninety crowns are partly open at any moment — which is the look being
// asked for, an opening that travels with the boat rather than a tree that blinks.
const CANOPY_FADE_MIN = 0.0;     // crown left with the hull dead under the stem
const BOAT_LEN = 56;             // hull in world units; the manifest's scale anchor

// HOW FAST THE BOAT'S SPEED CHASES ITS TARGET, per frame at 60fps. These were
// literals inside updateBoat; they are named here because the ROUTER now has to
// price what they imply, and a copied constant that drifts out of sync is the
// exact bug the shoal pricing exists to fix (see the grid's shoal cost). One
// source, two readers: the speed integrator and the router's shoal cost.
//   tau = -1 / (60 * ln DECAY)  =>  UP ~5.5s (accelerating), DOWN ~9.25s.
// Change either number, or make it shoal-specific, and the router's price
// follows automatically — that is the whole point of naming them.
const SPEED_DECAY_UP = 0.9970;    // accelerating, ~5.5s
const SPEED_DECAY_DOWN = 0.9982;  // decelerating, ~9.25s — carries its way
const SPEED_TAU_DOWN = -1 / (60 * Math.log(SPEED_DECAY_DOWN));
const CANOPY_FADE_RANGE = 20 * BOAT_LEN;
// THE PLAYER'S BOAT ONLY, and that asymmetry is the point rather than an oversight. The fade
// exists to solve one problem — you must never lose your own hull under a tree — and every
// crown it opens is a crown that stopped being scenery. Letting the whole fleet trigger it
// costs twice: crowns flicker all race as the AI sails through them, and a dimming treetop
// becomes a free radar pip announcing a rival you could not otherwise see. A competitor
// disappearing under the leaves is the venue working correctly.
// ⚠️ THE FLOOR IS PER-KIND, BECAUSE CANOPY_FADE_MIN's ARGUMENT DOES NOT HOLD FOR EVERYTHING.
// It is 0.0 — a crown vanishes completely with the hull under it — and the comment above earns
// that: "the tree does not vanish when the crown does: the stem keeps drawing on the SURFACE
// plane at full opacity and keeps its collider, so what is left under your boat is the wood you
// are about to hit with the leaves out of the way."
//
// A BRIDGE HAS NO STEM. `river-footbridge` is a single canopy sprite with nothing on any other
// plane, so at floor 0 it does not open — it disappears, and a landmark the player sails under
// stops existing at exactly the moment they are under it. So a kind may declare `fadeMin` in
// PROP_KINDS and keep a floor of its own. Absent, the tree behaviour is unchanged, which is
// every existing kind.
function canopyAlpha(p, floor) {
    const boats = state.boats;
    if (!boats || !boats.length) return 1;
    const me = boats.find(b => b.isPlayer);
    if (!me) return 1;
    const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
    const d = Math.hypot(me.x - x, me.y - y);
    if (d >= CANOPY_FADE_RANGE) return 1;
    const lo = (typeof floor === 'number' && floor >= 0 && floor < 1) ? floor : CANOPY_FADE_MIN;
    return lo + (1 - lo) * (d / CANOPY_FADE_RANGE);
}

// ── WHICH CROWNS ARE ALLOWED TO FADE ────────────────────────────────────────
// A crown fades for exactly one reason: it can hide the player's hull. A hull is only ever
// on WATER, so a tree whose crown lies entirely over land can never hide one — and fading it
// costs the venue a tree for nothing. Every crown that opens is a crown that stopped being
// scenery, so the fade is spent only where it buys something.
//
// That makes the test a plain boolean rather than a proportion, and the reasoning is worth
// keeping: it is tempting to fade in proportion to how much of the crown overhangs water, so
// neighbouring trees do not fade by different amounts. But a crown that is one tenth over
// water can still have the boat under that tenth, and a tenth of a fade would not clear it.
// Any overhang at all is enough to hide a hull, so any overhang at all earns the full rule.
//
// ⚠️ ISLAND RINGS ARE {x, y} OBJECTS, NOT [x, y] PAIRS. VenueDoc.pointInRing reads ring[i][0]
// and is for the DOCUMENT's rings; the compiled course carries vertices the other way round.
// Handing island vertices to pointInRing returns false for every point in silence, which
// reads as "all water" and fades the whole wood. Hence the local test below.
function pointInVerts(x, y, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x, yi = verts[i].y, xj = verts[j].x, yj = verts[j].y;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

// AWASH SHAPES ARE WATER. A shoal, a lily bed, a weed bed is something you sail over, so a
// crown reaching across one is still reaching over water and still has to get out of the way.
function pointOnLand(x, y) {
    const islands = (state.course && state.course.islands) || [];
    for (const isl of islands) {
        if (isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
        const dx = x - isl.x, dy = y - isl.y;
        if (dx * dx + dy * dy > isl.radius * isl.radius) continue;   // bounding circle first
        if (!pointInVerts(x, y, isl.vertices)) continue;
        let inHole = false;
        for (const h of (isl.holes || [])) {
            if (h && h.length >= 3 && pointInVerts(x, y, h)) { inHole = true; break; }
        }
        if (!inHole) return true;
    }
    return false;
}

// The stem, sixteen points round the rim, and eight at two thirds out. The rim is where the
// answer usually lives — a tree rooted well inland whose crown still reaches past the shore is
// exactly the case this must catch, and its stem sample says "land". The inner ring is for the
// other shape of the same question: a crown big enough to cover a whole pond or a narrow
// channel, where the rim is on land all the way round and the water is underneath the middle.
//
// ⚠️ THE SAMPLE COUNT IS CHOSEN BY WHICH WAY IT FAILS, not by cost. A false "over water" costs
// one tree a little transparency near the player. A false "on land" leaves a SOLID crown over
// open water, which can swallow the hull — the one thing the whole fade exists to prevent. So
// this errs toward detecting overlap: at sixteen points a 198u white pine samples its rim every
// 39u, finer than the 56u hull that has to stay visible under it.
const CANOPY_RIM_SAMPLES = 16;
const CANOPY_INNER_SAMPLES = 8;
function crownOverWater(p, worldW) {
    if (p._overWater !== undefined) return p._overWater;
    const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
    const r = worldW * 0.5;
    let over = !pointOnLand(x, y);
    for (let k = 0; !over && k < CANOPY_RIM_SAMPLES; k++) {
        const a = (k / CANOPY_RIM_SAMPLES) * Math.PI * 2;
        if (!pointOnLand(x + r * Math.cos(a), y + r * Math.sin(a))) over = true;
    }
    for (let k = 0; !over && k < CANOPY_INNER_SAMPLES; k++) {
        const a = (k + 0.5) / CANOPY_INNER_SAMPLES * Math.PI * 2;   // offset off the rim spokes
        if (!pointOnLand(x + r * 0.66 * Math.cos(a), y + r * 0.66 * Math.sin(a))) over = true;
    }
    if (p.motion !== 'drift') p._overWater = over;   // a drifter's answer moves with it
    return over;
}

// WHICH SPRITE THIS PROP SHOWS IN THIS PLANE, which is not always its own.
//
// A TWO-PLANE KIND draws in both passes from ONE placement. A whole tree is the case: the
// stem belongs under the fleet and the crown over it, so a designer who drops "Live oak
// tree" in the channel should get a hull that passes beneath the leaves and stops on the
// wood — without having to know the sprite is really two, or place them twice and trust
// they line up. The kind names its halves in `parts` (VenueDoc.PROP_KINDS) and this returns
// the half for the pass being drawn; the parts are cut from the same master by treesplit.py
// and share a frame, so they register exactly.
//
// Everything else answers with its own sprite in its own plane, exactly as before. The
// separate `-trunk` and `-canopy` kinds stay placeable for the cases the pair cannot cover:
// a bare snag with no crown, or a crown reaching in from a tree rooted off the map.
function propSpriteFor(p, plane) {
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const parts = (reg[p.kind] || {}).parts;
    if (parts) return parts[plane] ? propSprite(parts[plane]) : null;
    return (p.plane || 'surface') === plane ? propSprite(p.kind) : null;
}

// THE EXACT CULL RADIUS IS HALF THE DIAGONAL, not 0.6 of it. The camera rotates, so the
// region a player can see is the canvas turned about its centre, and the circle that
// contains it has radius diag/2 — that is the whole requirement. A sprite is visible when
// its own half-width reaches that circle.
//
// The old test asked `0.6*diag + full width`, over-reaching by 0.1*diag plus another half
// width. On the planted bayou, where a crown can be 440u across, that admitted a circle
// 1.9x the area it needed to and about half of every prop drawn was off screen. Measured
// after: 116 prop draw calls a frame fell to 63 with nothing changing on screen.
//
// Kept as a named helper because drawVegetation, drawShoals and drawPropWash all had the
// same 0.6 in them, and a cull constant that drifts between layers is how one layer starts
// popping in at the corner of the screen while its neighbour does not.
function cullRadius(ctx) {
    return Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.5;
}

// ── SPATIAL INDEX OVER THE PROPS ────────────────────────────────────────────
// Walking every prop in every pass is fine for a venue with a dozen; the planted bayou has
// 1555, and four passes over it is 6220 slots visited to find the ~56 that draw. That work
// is invisible while a software rasteriser dominates the frame, and it is NOT invisible on a
// GPU, where the fill collapses and whatever the CPU does per frame is what is left.
//
// So: bucket props into a coarse grid once, and visit only the buckets the view touches.
// Rebuilt when the props array identity changes, which is once per course compile — props do
// not move (the only motion is `drift`, and that is a visual offset well under one cell).
const PROP_CELL = 600;
function propGrid() {
    const course = state.course;
    if (!course || !course.props) return null;
    if (course._propGrid && course._propGrid.src === course.props) return course._propGrid;
    const cells = new Map();
    course.props.forEach((p, i) => {
        const key = `${Math.floor(p.x / PROP_CELL)},${Math.floor(p.y / PROP_CELL)}`;
        let a = cells.get(key);
        if (!a) cells.set(key, a = []);
        a.push(i);
    });
    return (course._propGrid = { src: course.props, cells });
}

// `filter(p, w)`: optional predicate the world-tile caches use to split a plane into its
// cacheable (static) and live (fading/drifting) populations — see drawCanopyCached.
// `pending`: optional array; sprites whose image has not finished loading are pushed so a
// tile baked too early knows to rebake when the art lands. Returns the number drawn.
function drawProps(ctx, plane, filter, pending) {
    const props = state.course && state.course.props;
    if (!props || !props.length) return 0;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const viewRadius = cullRadius(ctx);
    const camX = state.camera.x, camY = state.camera.y;
    // Reach one cell beyond the view so a big crown centred just outside still draws; the
    // per-prop test below is what actually decides, this only narrows the search.
    const grid = propGrid();
    const pad = viewRadius + 460;
    const visit = [];
    if (grid) {
        const cx0 = Math.floor((camX - pad) / PROP_CELL), cx1 = Math.floor((camX + pad) / PROP_CELL);
        const cy0 = Math.floor((camY - pad) / PROP_CELL), cy1 = Math.floor((camY + pad) / PROP_CELL);
        for (let cy = cy0; cy <= cy1; cy++)
            for (let cx = cx0; cx <= cx1; cx++) {
                const a = grid.cells.get(`${cx},${cy}`);
                if (a) for (let k = 0; k < a.length; k++) visit.push(a[k]);
            }
        // BACK TO DOCUMENT ORDER. The grid hands props back cell by cell, and painting in
        // that order silently hands z-order to the spatial index: two overlapping props
        // would swap which is on top depending on which bucket they fell in, and it would
        // change as the camera moved across a cell boundary. Within a plane the stacking is
        // the DESIGNER'S, in the order the document lists them — the same guarantee
        // compileVenueDoc's shapeOrder makes for shapes. Sorting a few dozen indices a frame
        // is nothing next to what the cull just saved.
        visit.sort((a, b) => a - b);
    }
    const list = grid ? visit.map(i => props[i]) : props;
    let drawn = 0;
    for (const p of list) {
        // A `scatter` kind is a GROUP, not a sprite: one placement stands for a drift of
        // several animals that its own renderer draws and animates. Drawing the bell here
        // as well would put a motionless extra one at the placement point.
        if ((reg[p.kind] || {}).scatter) continue;
        const s = propSpriteFor(p, plane);
        if (!s) continue;
        if (!s.img.complete || !s.img.naturalWidth) {
            // ⚠️ Only a STILL-LOADING image goes on the tile's pending list. A failed load
            // is complete=true/naturalWidth=0, and pending-listing one made `landed` true
            // every frame — the tile rebaked its ~5 screens of fill per frame, and the
            // caches benched SLOWER than the live paths they replaced.
            if (pending && !s.img.complete) pending.push(s.img);
            continue;
        }
        const w = s.world * (p.scale || 1);
        if (filter && !filter(p, w)) continue;
        const limit = viewRadius + w * 0.5;
        const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
        if ((x - camX) ** 2 + (y - camY) ** 2 > limit ** 2) continue;
        // A crown the player is sitting under fades to nothing, and a fully transparent
        // drawImage still costs the composite. Worth an explicit skip on a venue holding
        // 1500 trees: the fade reaches twenty hull lengths, so the crowns nearest the
        // camera — the big ones, the expensive ones — are exactly the ones at zero.
        // ...and only a crown that OVERHANGS WATER fades at all: one standing wholly on land
        // cannot hide a hull, so it stays a solid tree. See crownOverWater.
        const alpha = (PROP_PLANE_ALPHA[plane] || 1)
                    * (plane === 'canopy' && crownOverWater(p, w)
                       ? canopyAlpha(p, (reg[p.kind] || {}).fadeMin) : 1);
        if (alpha <= 0.004) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        if (p.heading) ctx.rotate(p.heading);
        drawSpriteBoxed(ctx, plane === 'seabed' ? submergedSprite(s) : s.img, s, w);
        ctx.restore();
        drawn++;
    }
    return drawn;
}

// Drift, for props whose motion says so: they ride the same current the boats feel,
// with a touch of windage, accumulated in `_dx/_dy` so the AUTHORED position stays
// what the document says. Purely visual by construction — the traits force a drifting
// prop's contact to none, so nothing physical ever reads the drifted position.
// Sim-clocked: called from update(dt) (leak fixes 2026-08-24 — it used to run from
// draw() on performance.now(), so headless runs had frozen flotsam and pause didn't
// pause it). RNG-free, so it cannot move the seeded stream.
function updateDriftingProps(dt) {
    const props = state.course && state.course.props;
    if (!props || !props.length) return;
    if (!(dt > 0)) return;
    for (const p of props) {
        if (p.motion !== 'drift') continue;
        const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
        const cur = (typeof getCurrentAt === 'function') ? getCurrentAt(x, y) : null;
        let vx = 0, vy = 0;
        // (-sin, +cos) is DOWN-STREAM in this engine — the gust drift convention. The
        // first version had the signs mirrored and flotsam crept upwind.
        if (cur && cur.speed) {
            vx += -Math.sin(cur.direction) * cur.speed;
            vy += Math.cos(cur.direction) * cur.speed;
        }
        // ~3% windage: flotsam moves downwind even on slack water.
        if (state.wind) {
            vx += -Math.sin(state.wind.direction) * state.wind.speed * 0.03;
            vy += Math.cos(state.wind.direction) * state.wind.speed * 0.03;
        }
        p._dx = (p._dx || 0) + vx * dt;
        p._dy = (p._dy || 0) + vy * dt;
    }
}

// ── TRAFFIC: VESSELS ON RAILS ────────────────────────────────────────────────────────
// The cove's promised mechanic — "slow, utterly predictable" shipping the player has to
// time. The path maths lives in js/traffic.js; this is the lifecycle and the draw.
//
// EVERY VESSEL IS A PURE FUNCTION OF THE RACE CLOCK. There is no integrator here and no
// accumulated position: given t, the compiled tables say where the hull is, which way it
// points and how fast it is going. That is what makes it predictable in the sense the
// design means — the same seed puts the ship in the same place at the same second, and it
// is in that place whether the frame rate was 30 or 144. It also makes restarts, pauses
// and the prestart free: nothing to reset, because nothing was ever accumulated.
const KELVIN_TAN = 1 / (2 * Math.SQRT2);   // tan(19.47 deg), exactly
const WAKE_SPAN = 2.2;        // ship-lengths of track the wake covers — length scales with
                              // the hull, so the same constant suits a tug and a cruise ship
const WAKE_STEPS = 26;        // quads per arm
const WAKE_FULL_KT = 3.0;     // knots at which the wake reaches full strength
// The other wake a vessel can wear: the fleet's own. drawWakes calls it a ribbon — "tapered
// two-tone ribbons along each boat's recent stern track" — so this does too rather than
// inventing a second word for a thing that already has one.
//
// WHICH ONE IS RIGHT IS A QUESTION ABOUT THE HULL, not a preference. The Kelvin wedge is
// what a DISPLACEMENT hull throws: slow, heavy, pushing water aside. A small craft up on the
// plane leaves a narrow churned trail instead, and the wedge drawn behind a motorboat claims
// a tonnage it does not have.
const RIBBON_SPAN = 1.8;      // hull-lengths of track the ribbon covers

// NO HISTORY BUFFER. The boats keep a wakeTrail because nothing else knows where they have
// been; a vessel on rails has its whole past in the path it is sailing, so the wake is read
// straight off it with atArc(). That also means the wake is exactly as curved as the track
// really was, and costs nothing to carry between frames.
function drawTrafficWakes(ctx) {
    const list = state.traffic;
    if (!list || !list.length) return;
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = cullRadius(ctx);
    ctx.save();
    for (const v of list) {
        if (!v.active) continue;
        // A STATIONARY VESSEL HAS NO WAKE, and the berthing case falls out of it: a hull
        // authored to stop sheds its wake as it slows, so it comes alongside clean with no
        // special case anywhere.
        // NOTHING WHILE GOING ASTERN. A hull backing down does churn water in life, but it
        // is a slow, close, propeller-driven mess and nothing like the Kelvin wedge a bow
        // throws — drawing the wedge behind a ship moving the other way would read as the
        // hull travelling in the direction it is pointing, which is the one thing the
        // manoeuvre exists to contradict.
        const style = v.wake.style;
        if (style === 'none') continue;
        // A HULL WITH TWO BOWS IS NOT BACKING DOWN. Everything else suppresses its wake
        // astern — a ship going backwards churns with its propeller rather than throwing a
        // bow wave — but a double-ender running the other way is simply under way, and makes
        // its wake from the end that is now leading. Which end that is needs no special case
        // at all: the wake trails DOWN the track behind the direction of travel, and the
        // direction of travel is a fact about arc length, not about which way the bow points.
        if (v.astern && !v.wake.symmetric) continue;
        const str = Math.min(1, v.knots / WAKE_FULL_KT);
        if (str <= 0.02) continue;
        const spr = propSprite(v.kind);
        if (!spr) continue;
        const w = spr.world * v.scale;
        const halfHull = v.hullLen * 0.5;
        // A pingpong vessel on its return leg is sailing the path BACKWARDS, so its wake
        // trails toward increasing arc length. One sign carries that everywhere below;
        // without it the return leg draws its wake out in front of the bow.
        const dir = v.reverse ? -1 : 1;
        const bowS = v.s + dir * halfHull;
        // Never longer than the water actually sailed — a vessel that just spawned trails a
        // short wake that grows, rather than arriving with a mile of history behind it.
        // A LOOPING VESSEL HAS ALWAYS BEEN SAILING. Bounding the wake by "how far along the
        // path am I" is right for a one-shot passage and wrong for a lap: it would trim the
        // wake back to nothing every time the arc length wrapped, announcing exactly where
        // the seam is on a curve built specifically not to have one.
        const sailed = v.path.closed ? Infinity
                     : (v.reverse ? v.path.length - v.s : v.s);
        const span = Math.min(sailed + halfHull, WAKE_SPAN * v.hullLen);
        if (span < v.hullLen * 0.2) continue;
        if ((v.x - camX) ** 2 + (v.y - camY) ** 2 > (viewR + w + span) ** 2) continue;

        const beam = v.hullBeam;

        // ── THE FLEET'S RIBBON ───────────────────────────────────────────────────────
        // The same two-pass taper drawWakes gives a boat — outer band, then a brighter core
        // — but read off the PATH rather than a remembered trail, and sized from the hull
        // instead of the 56-unit dinghy those constants were tuned against.
        if (style === 'ribbon') {
            const rSpan = Math.min(sailed - halfHull, RIBBON_SPAN * v.hullLen);
            if (rSpan <= v.hullLen * 0.1) continue;
            const sternR = v.s - dir * halfHull;
            const rp = [];
            for (let k = 0; k <= WAKE_STEPS; k++) {
                const d = rSpan * k / WAKE_STEPS;
                const q = v.path.atArc(sternR - dir * d);
                rp.push({ x: q.x, y: q.y, px: Math.cos(q.heading), py: Math.sin(q.heading), d });
            }
            // ONE TRAIL PER HULL. A catamaran is not a wide monohull: it leaves two narrow
            // wakes with clear water between them, and drawing one broad band across the
            // whole beam claims a displacement hull that is not there. The offsets are
            // applied per SAMPLE, along each sample's own perpendicular, so the pair follows
            // the track round a turn instead of sliding across it.
            const rw = v.wakeBeam * 0.42;
            for (const off of v.wakeHulls) {
                for (let pass = 0; pass < 2; pass++) {
                    const wS = pass === 0 ? 1 : 0.42, aS = pass === 0 ? 0.35 : 0.50;
                    for (let k = 0; k < WAKE_STEPS; k++) {
                        const a = rp[k], b = rp[k + 1];
                        const alpha = Math.pow(1 - a.d / rSpan, 1.25) * aS * str;
                        if (alpha <= 0.01) continue;
                        const wa = (rw + a.d * 0.055) * wS, wb = (rw + b.d * 0.055) * wS;
                        const ax = a.x + a.px * off, ay = a.y + a.py * off;
                        const bx = b.x + b.px * off, by = b.y + b.py * off;
                        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                        ctx.beginPath();
                        ctx.moveTo(ax + a.px * wa, ay + a.py * wa);
                        ctx.lineTo(bx + b.px * wb, by + b.py * wb);
                        ctx.lineTo(bx - b.px * wb, by - b.py * wb);
                        ctx.lineTo(ax - a.px * wa, ay - a.py * wa);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }
            continue;
        }

        const pts = [];
        for (let k = 0; k <= WAKE_STEPS; k++) {
            const d = span * k / WAKE_STEPS;
            const p = v.path.atArc(bowS - dir * d);
            pts.push({ x: p.x, y: p.y, px: Math.cos(p.heading), py: Math.sin(p.heading), d });
        }

        const fade = (d) => Math.pow(1 - d / span, 1.5) * str;

        // 1. THE SCAR — churned water, and it starts at the TRANSOM, not the stem. Run from
        // the bow and the ship gets a white stripe painted down its own deck.
        const sternS = v.s - dir * halfHull;
        const scarSpan = Math.min(sailed - halfHull, v.hullLen * 1.5);
        if (scarSpan > v.hullLen * 0.1) {
            const sc = [];
            for (let k = 0; k <= WAKE_STEPS; k++) {
                const d = scarSpan * k / WAKE_STEPS;
                const p = v.path.atArc(sternS - dir * d);
                sc.push({ x: p.x, y: p.y, px: Math.cos(p.heading), py: Math.sin(p.heading), d });
            }
            for (let pass = 0; pass < 2; pass++) {
                const wS = pass === 0 ? 1 : 0.45, aS = pass === 0 ? 0.10 : 0.13;
                for (let k = 0; k < WAKE_STEPS; k++) {
                    const a = sc[k], b = sc[k + 1];
                    const alpha = Math.pow(1 - a.d / scarSpan, 1.4) * str * aS;
                    if (alpha <= 0.008) continue;
                    const wa = (beam * 0.5 + a.d * 0.05) * wS, wb = (beam * 0.5 + b.d * 0.05) * wS;
                    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x + a.px * wa, a.y + a.py * wa);
                    ctx.lineTo(b.x + b.px * wb, b.y + b.py * wb);
                    ctx.lineTo(b.x - b.px * wb, b.y - b.py * wb);
                    ctx.lineTo(a.x - a.px * wa, a.y - a.py * wa);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }

        // 2. THE DIVERGENT ARMS — the wedge. Lateral offset grows as d * tan(19.47), which
        // on a straight track is the Kelvin wedge exactly and through a turn bends with the
        // hull, because every sample carries the heading the ship actually had there.
        //
        // THIN. The wedge is genuinely this wide — 560 units off the track by the tail on a
        // 720-unit hull — so anything but a fine crest line fills a third of the screen with
        // flat white and reads as fog rather than water. The width is physics; the weight of
        // the line is what keeps it legible.
        const armW = v.hullLen * 0.014;
        for (const side of [1, -1]) {
            for (let k = 0; k < WAKE_STEPS; k++) {
                const a = pts[k], b = pts[k + 1];
                const alpha = fade(a.d) * 0.30;
                if (alpha <= 0.008) continue;
                const oa = a.d * KELVIN_TAN * side, ob = b.d * KELVIN_TAN * side;   // side-symmetric, so no dir here
                const ax = a.x + a.px * oa, ay = a.y + a.py * oa;
                const bx = b.x + b.px * ob, by = b.y + b.py * ob;
                // Thicken astern: a crest that has run further has spread further.
                const ta = armW * (0.6 + 0.7 * a.d / span), tb = armW * (0.6 + 0.7 * b.d / span);
                const sdx = bx - ax, sdy = by - ay;
                const sl = Math.hypot(sdx, sdy) || 1;
                const nx = -sdy / sl, ny = sdx / sl;
                ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(ax + nx * ta, ay + ny * ta);
                ctx.lineTo(bx + nx * tb, by + ny * tb);
                ctx.lineTo(bx - nx * tb, by - ny * tb);
                ctx.lineTo(ax - nx * ta, ay - ny * ta);
                ctx.closePath();
                ctx.fill();
            }
        }

        // 3. THE BOW WAVE — the manifest is explicit that the sprite carries no baked
        // disturbance, so the water piling up at the stem has to be drawn or it is absent.
        //
        // ⚠️ ONE FRAME, AND IT IS THE HULL'S. This mixed two: the lateral axis came from the
        // path tangent at `atArc(bowS)` while the longitudinal came from `v.heading` at the
        // ship's centre. On a straight lane they agree and it looked right. In a turn they
        // do not — measured on the cove's lane, up to 23.8 degrees apart — so the two axes
        // stopped being perpendicular and the crescent SKEWED, bulging on one bow while it
        // tightened on the other. The anchor was wrong too: `atArc` walks half a hull along
        // the CURVE, which in a turn lands up to 75 units (43% of the beam) off the stem the
        // sprite is actually drawn with.
        //
        // The hull is drawn at (v.x, v.y) rotated by v.heading and nothing else, so the wave
        // that belongs to it must be built from exactly that and nothing else.
        // ⚠️ THE LEADING END, WHICH IS NOT ALWAYS THE BOW. A double-ender running astern
        // travels the way her stern points, and the water piles up at the end going first.
        // `lead` is the only place that distinction is needed — everything else about the
        // wake is measured along the track, which already knows which way she is going.
        const lead = v.astern ? -1 : 1;
        const fx = Math.sin(v.heading) * lead, fy = -Math.cos(v.heading) * lead;
        const rx = Math.cos(v.heading), ry = Math.sin(v.heading);    // abeam, square to it
        const bx = v.x + fx * halfHull, by = v.y + fy * halfHull;    // the end going first
        ctx.fillStyle = `rgba(255,255,255,${(0.5 * str).toFixed(3)})`;
        for (const side of [1, -1]) {
            const o = (lat, lon) => [bx + rx * side * beam * lat - fx * v.hullLen * lon,
                                     by + ry * side * beam * lat - fy * v.hullLen * lon];
            const c1 = o(0.46, -0.01), p1 = o(0.60, 0.20), c2 = o(0.30, 0.06);
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]);
            ctx.quadraticCurveTo(c2[0], c2[1], bx, by);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.restore();
}

// Drawn with the surface props, under the marks and the fleet. The sprite's own bow points
// -y in its frame — the game's heading convention exactly — so the tangent goes straight
// into rotate() with no offset. (Measured on all three cove hulls: the stern is the wider
// end, and it is at +y on every one.)
function drawTraffic(ctx) {
    const list = state.traffic;
    if (!list || !list.length) return;
    const viewRadius = cullRadius(ctx);
    const camX = state.camera.x, camY = state.camera.y;
    for (const v of list) {
        if (!v.active) continue;
        const s = propSprite(v.kind);
        if (!s || !s.img.complete || !s.img.naturalWidth) continue;
        const w = s.world * v.scale;
        const limit = viewRadius + w * 0.5;
        if ((v.x - camX) ** 2 + (v.y - camY) ** 2 > limit ** 2) continue;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.heading);
        drawSpriteBoxed(ctx, s.img, s, w);
        ctx.restore();
    }
}

function drawIslandShadows(ctx) {
    if (!state.course.islands) return;
    const windDir = state.wind.direction;
    const shadowAngle = Math.atan2(Math.cos(windDir), -Math.sin(windDir));

    // Viewport Culling
    const camX = state.camera.x;
    const camY = state.camera.y;
    // Approx viewport radius
    const viewRadius = Math.max(ctx.canvas.width, ctx.canvas.height);

    for (const isl of state.course.islands) {
        // Culling (Simple distance check including shadow length)
        const distSq = (isl.x - camX)**2 + (isl.y - camY)**2;
        if (distSq > (viewRadius + isl.radius * 9)**2) continue;

        ctx.save();
        ctx.translate(isl.x, isl.y);
        ctx.rotate(shadowAngle);

        const shadowLen = isl.radius * 5;
        const startWidth = isl.radius;
        const endWidth = isl.radius * (1.0 + shadowLen / 500);

        const grad = ctx.createLinearGradient(0, 0, shadowLen, 0);
        // Lull color: rgba(92, 201, 255, alpha)
        grad.addColorStop(0, 'rgba(92, 201, 255, 0.25)');
        grad.addColorStop(1, 'rgba(92, 201, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -startWidth);
        ctx.lineTo(shadowLen, -endWidth);
        ctx.quadraticCurveTo(shadowLen + endWidth * 0.5, 0, shadowLen, endWidth);
        ctx.lineTo(0, startWidth);
        ctx.quadraticCurveTo(-startWidth * 0.5, 0, 0, -startWidth);
        ctx.fill();
        ctx.restore();
    }
}

function drawMarkShadows(ctx) {
    for (const m of state.course.marks) {
        if (m.kind === 'none') continue;          // nothing there to cast one
        ctx.save(); ctx.translate(m.drawX != null ? m.drawX : m.x, m.drawY != null ? m.drawY : m.y);
        // Sized to the mark's VISIBLE width (~29px at W=30), so it reads as a contact
        // shadow rather than a disc sticking out from under it. Cosmetic only.
        const body = m.body;
        if (body) {
            // A hull is not a disc: shadow the capsule, or the boat floats on a coin.
            ctx.rotate(m.heading || 0);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            for (const d of [-22, 0, 22]) { ctx.beginPath(); ctx.arc(3, -d + 3, 19, 0, Math.PI * 2); ctx.fill(); }
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(3, 3, 13, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

function drawMarkBodies(ctx) {
    const player = state.boats[0];
    // EVERY mark in the array is part of the course. This used to skip all but the
    // first two on an island course, because `islandRound` parked two placeholder
    // marks that were not real — they are long gone, and the skip was hiding the
    // rounding mark itself once roundings became ordinary marks.
    for (let i = 0; i < state.course.marks.length; i++) {
        const m = state.course.marks[i];
        // A mark with no buoy is a POSITION — an island you round, a transit — so it
        // gets an indicator rather than a sprite. Drawn in drawMarkZones, which already
        // owns the "here is what the course asks of you" layer.
        if (m.kind === 'none') continue;
        const sp = markSprite(m.kind);
        // The sprite is fill-normalized at ingest, so the frame size IS the declared
        // world size and the art's own fill decides what you see: 30 -> ~29px for the
        // tetrahedron, 92 -> 37x85px for the committee boat.
        const W = sp.world, H = W * (sp.img.naturalHeight / (sp.img.naturalWidth || 1)) || W;
        // A committee boat is drawn at its outboard nudge, clear of the line; a buoy
        // sits on its point.
        ctx.save(); ctx.translate(m.drawX != null ? m.drawX : m.x, m.drawY != null ? m.drawY : m.y);
        // Very subtle bob: slow breathing scale + faint rotation wobble, phased
        // per mark by position (deterministic — no RNG in the render path)
        const phase = m.x * 0.013 + m.y * 0.007;
        const bob = 1 + Math.sin(state.time * 7 + phase) * 0.02;
        // gentle circular sway at anchor + a slow rotation wobble
        ctx.translate(Math.sin(state.time * 4.1 + phase) * 2.2, Math.cos(state.time * 3.4 + phase * 1.7) * 2.2);
        // A buoy has no "up", so its angle is an arbitrary per-position scramble. A
        // VESSEL has one, frozen by orientCourseMarks() from the line it defines — the
        // scramble would point a 30ft boat wherever its coordinates happened to land.
        // The wobble stays either way: on a hull it reads as lying to an anchor.
        const base = (m.heading != null) ? m.heading : (m.x * 7.3 + m.y * 3.1) % 6.283;
        ctx.rotate(base + Math.sin(state.time * 5.3 + phase) * 0.06);
        ctx.scale(bob, bob);

        let active = false;
        if (state.race.status !== 'finished') {
            const act = legMarks(player.raceState.leg) || [];
            if (act.indexOf(i) !== -1) active = true;
            // A ROUNDING leg has no `marks` pair — legMarks() is null — so the very mark
            // being rounded was failing this test and drawing grey while active.
            const e = routeLeg(player.raceState.leg);
            if (e && e.kind === 'round' && e.mark && e.mark.markIdx === i) active = true;
        }
        // The slate tint says "not the mark you are sailing to". That is a statement
        // about a piece of course furniture, and a crewed vessel is not one — a greyed
        // committee boat reads as a rendering fault, and its orange flag marks where the
        // line is for the whole race, not just while you are on the line. Vessels stay
        // in colour; buoys still grey out.
        if (m.body) active = true;

        if (sp.img.complete && sp.img.naturalWidth) {
            const img = active ? sp.img : (getMarkImgGray(m.kind) || sp.img);
            if (!active) ctx.globalAlpha = 0.92;
            ctx.drawImage(img, -W / 2, -H / 2, W, H);
        } else {
            // fallback while the sprite loads
            ctx.fillStyle = active ? '#f97316' : '#94a3b8';
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

// ── THE SAILING LIMIT ───────────────────────────────────────────────────────
// The club-branded band: a wide white stroke with the burgee and "Salty Critter Yacht Club"
// repeating along it. It used to be drawn as a CIRCLE of `b.radius` — which is the arena's
// BOUNDING circle, so on a designed course with a polygon arena it painted a huge ellipse
// well outside the water anyone could sail to, while the real limit was invisible.
//
// So it walks the RING instead. One polyline covers both shapes: a polygon uses its own
// points, a circle is sampled into some, and everything below — the band, the cull, the
// lettering — is arc-length work along that line. A circle therefore looks exactly as it did.
// Cached in a WeakMap rather than on the boundary itself: the compiled boundary is compared
// and serialised elsewhere, and a renderer has no business leaving fields on it.
const _ringCache = new WeakMap();
function boundaryRing(b) {
    const hit = _ringCache.get(b);
    if (hit) return hit;
    let pts;
    if (b.poly && b.poly.length >= 3) {
        pts = b.poly.map(p => ({ x: p[0], y: p[1] }));
        // Wound so the walk always goes the same way round. Text laid along a ring reads
        // upside down if the author happened to draw it the other way, and which way a
        // designer clicked out their arena is not something the lettering should depend on.
        let a2 = 0;
        for (let i = 0; i < pts.length; i++) {
            const q = pts[(i + 1) % pts.length];
            a2 += pts[i].x * q.y - q.x * pts[i].y;
        }
        if (a2 < 0) pts.reverse();
    } else {
        pts = [];
        const n = 96;                       // fine enough that the band reads as smooth
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            pts.push({ x: b.x + Math.cos(a) * b.radius, y: b.y + Math.sin(a) * b.radius });
        }
    }
    // Cumulative arc length, so a position along the perimeter is one lookup.
    const seg = [];
    let total = 0;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const len = Math.hypot(q.x - p.x, q.y - p.y);
        seg.push({ p, q, len, at: total, ang: Math.atan2(q.y - p.y, q.x - p.x) });
        total += len;
    }
    const ring = { pts, seg, total };
    _ringCache.set(b, ring);
    return ring;
}

function drawBoundary(ctx) {
    const b = state.course.boundary;
    if (!b) return;
    const ring = boundaryRing(b);
    if (!ring || ring.total <= 0) return;

    // Viewport cull, per SEGMENT rather than per arc: mid-course most of the limit is off
    // screen, and the band plus its glow plus per-character lettering is not cheap.
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 260;
    const viewR2 = viewR * viewR;
    const nearCam = (p, q) => {
        const dx = q.x - p.x, dy = q.y - p.y;
        const l2 = dx * dx + dy * dy;
        let t = l2 ? ((camX - p.x) * dx + (camY - p.y) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = p.x + t * dx - camX, ey = p.y + t * dy - camY;
        return ex * ex + ey * ey < viewR2;
    };

    ctx.save();

    // The band. Only the visible runs are stroked, each as its own subpath so a gap in the
    // middle of the ring does not get closed across the course.
    //
    // ⚠️ THE HALO IS LAYERED STROKES, NOT `shadowBlur`. A blurred 80px stroke measured 1.72 ms
    // of a 1.89 ms visible boundary — 91% of it — and up to 7 ms on a venue with more of its
    // limit in view, which was half the frame. Canvas shadow is a full Gaussian pass over the
    // stroke's bounding box; three plain strokes of decreasing width and rising alpha give
    // the same soft white edge for the cost of three ordinary fills.
    //
    // Cheap because the path is built ONCE and stroked three times: the segment walk and the
    // cull below it do not repeat.
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    let open = false;
    for (const sg of ring.seg) {
        if (nearCam(sg.p, sg.q)) {
            if (!open) { ctx.moveTo(sg.p.x, sg.p.y); open = true; }
            ctx.lineTo(sg.q.x, sg.q.y);
        } else open = false;
    }
    for (const [w, a] of [[124, 0.13], [102, 0.30], [80, 1]]) {
        ctx.lineWidth = w;
        ctx.strokeStyle = a === 1 ? '#ffffff' : `rgba(255,255,255,${a})`;
        ctx.stroke();
    }

    // Where along the perimeter, and which way is the path pointing there.
    const atDist = (d) => {
        d = ((d % ring.total) + ring.total) % ring.total;
        let lo = 0, hi = ring.seg.length - 1;
        while (lo < hi) {                       // the segment containing d
            const mid = (lo + hi + 1) >> 1;
            if (ring.seg[mid].at <= d) lo = mid; else hi = mid - 1;
        }
        const sg = ring.seg[lo];
        const t = sg.len ? (d - sg.at) / sg.len : 0;
        return { x: sg.p.x + (sg.q.x - sg.p.x) * t, y: sg.p.y + (sg.q.y - sg.p.y) * t, ang: sg.ang };
    };

    const text = "Salty Critter Yacht Club";
    ctx.font = FONT.brand(50);
    ctx.textBaseline = 'middle';

    // Static text metrics: measure once, ever (was per-char per-frame)
    if (!drawBoundary._metrics || drawBoundary._metricsReady !== FONTS_READY) {
        const charWidths = [];
        let textWidth = 0;
        for (const char of text) {
            const w = ctx.measureText(char).width;
            charWidths.push(w);
            textWidth += w;
        }
        drawBoundary._metrics = { charWidths, textWidth };
        drawBoundary._metricsReady = FONTS_READY;
    }
    const charWidths = drawBoundary._metrics.charWidths;
    const textWidth = drawBoundary._metrics.textWidth;

    const imgH = 40;
    const imgW = imgH * (649 / 462);
    const gap = 60;
    const segmentLen = imgW + gap + textWidth + gap;

    // Whole repeats only, stretched to close exactly — otherwise the last one runs into the
    // first at whatever angle the ring happens to end on.
    const count = Math.max(1, Math.round(ring.total / segmentLen));
    const step = ring.total / count;

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';

    for (let i = 0; i < count; i++) {
        const base = i * step;
        // Cheap reject: if the middle of this repeat is far off screen, neither its burgee
        // nor its lettering can be on it.
        const mid = atDist(base + (imgW + gap + textWidth) / 2);
        const mdx = mid.x - camX, mdy = mid.y - camY;
        if (mdx * mdx + mdy * mdy > (viewR + segmentLen) ** 2) continue;

        const burgeeAt = atDist(base + imgW / 2);
        ctx.save();
        ctx.translate(burgeeAt.x, burgeeAt.y);
        ctx.rotate(burgeeAt.ang);
        if (burgeeImg.complete && burgeeImg.naturalWidth > 0) {
            ctx.drawImage(burgeeImg, -imgW / 2, -imgH / 2, imgW, imgH);
        }
        ctx.restore();

        let run = base + imgW + gap;
        for (let j = 0; j < text.length; j++) {
            const w = charWidths[j];
            const at = atDist(run + w / 2);
            ctx.save();
            ctx.translate(at.x, at.y);
            ctx.rotate(at.ang);
            ctx.fillText(text[j], 0, 0);
            ctx.restore();
            run += w;
        }
    }

    ctx.restore();
}

// ── WHAT A MATERIAL READS AS ON THE CHART ───────────────────────────────────
//
// ⚠️ THESE ROWS ARE OVERRIDES, NOT THE REGISTRY. What a material looks like is
// ISLAND_STYLES' answer, and a row here earns its place only where the CHART wants a
// different one than the water does: ice pale enough to read as ice against dark glass,
// coral sand kept sand-coloured in both slots. Everything else DERIVES, which is what
// makes a new kind correct on the map the day it is added instead of the day somebody
// remembers this table exists.
//
// It used to fall through to ICE, and that is precisely the failure a second colour table
// produces. Gatorgrass Bayou's banks are `mud` and `marsh`, neither of which had a row, so
// all 24 of them drew #f2f9ff — snow white — and the braided channels the whole venue is
// built around read as a glacier on an olive chart.
//
// At module scope rather than inside drawMinimap, where it was rebuilt on every frame:
// this is a lookup table and a pure function of a style name, so it is neither per-frame
// state nor something a test should have to redraw a chart to ask about.
const ISLAND_STYLES = {
    // Sand body measured off aerial beach reference, not picked: the mean of the dry
    // sand in the Varkala plate (p5-p95 #cdb79f..#ecd6b7). The old #fde6b1 was a
    // buttery yellow no beach is. It is ALSO the sand tile's own mean, deliberately —
    // with base and tile equal, LAND_TEXTURES' alpha scales contrast without moving
    // colour, so the mean-luma shift the arctic textures have to warn about cannot
    // happen here.
    tropical: { body: '#ddc39a', stroke: '#b89b78', veg: '#84cc16', rock: '#9ca3af', trees: true },
    // Caribbean coral sand — the `tropicsand` kind's look, markedly whiter and cooler
    // than `tropical`'s tan. Body is the lagoon-coralsand texture's SPEC mean (#efe6d5);
    // when that tile is delivered, reset it to the DELIVERED tile's own mean, the same
    // base-equals-tile-mean move bay-sand made, so LAND_TEXTURES' alpha stays a pure
    // contrast knob. Palms belong on it, hence trees: true.
    // Colour-matched to the lagoon reference plate (2026-08-08): warm cream rather than
    // the near-white first spec, and the stroke pulled CLOSE to the body on purpose —
    // the reference beaches melt into their bars, so the coastline line stays quiet and
    // the tone ladder (ocean -> lagoon -> bar -> sand) does the separating.
    coralsand: { body: '#efe4cf', stroke: '#ddd0ad', veg: '#84cc16', rock: '#9ca3af', trees: true },   // body = coralsand tile mean
    // ── BLUEWATER BONANZA'S TWO NEW GROUNDS ─────────────────────────────────
    // Coral limestone — uplifted reef rock (makatea), the hard rim of a reef island. BOTH
    // TILES DELIVERED 2026-08-14, so both bodies below are now their DELIVERED tile's own
    // mean (the coralsand / bay-rock move) and both LAND_TEXTURES alphas are MEASURED. With
    // base equal to tile mean the blend cannot move the colour, only the spread around it,
    // so each alpha is a pure contrast knob. The other three tones on each row are the
    // spec's own offsets carried onto the delivered body, the bayou-mud precedent.
    //
    // THE ROCK'S BODY IS SQUEEZED BETWEEN TWO NEIGHBOURS AND THE IN-VENUE ONE WINS. It has
    // to separate from `coralsand` at race scale, because sand and reef rock share every
    // shoreline on this venue and the player reads them apart at speed: measured dE 22.4,
    // against the cove's accepted sand-vs-rock 23.9. Its nearest cross-venue neighbours are
    // `coastalrock` at 9.0 and `lane` at 10.4, and that is accepted on coastalrock's own
    // two-tier rule — cross-venue separation is a picker-swatch concern only, since neither
    // can ever be in the same race, and 19.2 was called fine there where 5.3 was not. The
    // `lane` collision is the most honest of the three: a crushed-shell village road IS
    // pulverised coral limestone, so the two materials genuinely are near neighbours.
    //
    // COOLER AND GREYER THAN coastalrock ON PURPOSE (hue 53 / sat 0.09 against 44 / 0.19).
    // Calcium carbonate is a neutral stone; the Cape's glacial rock is a warm grey-tan. That
    // is the axis the two are told apart on where they cannot be told apart by value.
    //
    // veg is a paler DRY STONE, not a green, and rock a darker dab of the same — the
    // granite/redrock/coastalrock convention for a look with nothing growing on it. No
    // trees: bare rock. The stroke carries coastalrock's own offsets onto this body (the
    // bayou-mud precedent), which lands an 18.2 L* drop against coastalrock's 18.6, so the
    // coastline holds the same weight and does not wash out.
    //
    // ⚠️ THE DELIVERY CAME BACK WARMER THAN SPECCED AND THE PICKER PAID FOR IT. Spec was a
    // NEUTRAL #ABA99B at hue 53; delivered is #A7A193 at hue 41.7, which is coastalrock's
    // own hue (44). In-venue that cost nothing and in fact GAINED — dE from `coralsand`, the
    // sand it shares every shoreline with, went 22.4 -> 24.8, now past the cove's accepted
    // sand-vs-rock 23.9. Cross-venue it went the other way: dE from `coastalrock` fell 9.0 ->
    // 6.1, close to the 5.3 that note calls a genuine collision. Accepted, because the two
    // can never be in the same race (bay vs ocean) so it is a picker-swatch concern only,
    // and because base-equals-delivered-mean is worth more than a tidier chip. The LABELS
    // now do all the work: 'Coral Limestone' against 'Coastal Rock'.
    //
    // THE DELIVERY CHECK THAT MISSED IT WAS WATCHING THE WRONG AXIS, and that is the
    // transferable bit. The manifest note said to reject if saturation went over ~0.14,
    // because that is how a neutral stone turns into a warm tan — delivered saturation is
    // 0.12 and sailed through, while the drift happened on HUE. Check both, or check hue.
    coralrock: { body: '#A7A193', stroke: '#757268', veg: '#BAB6A9', rock: '#878478', trees: false },  // body = ocean-coralrock DELIVERED tile mean
    // Tropic Scrub — the sun-dried sward of a small island's interior.
    //
    // ⚠️ THE BODY IS LIGHTER THAN EVERY CROWN TONE THE VENUE'S TREES ARE MADE OF, and that
    // is the constraint that picked it rather than any of the separations below. This is
    // what ocean-palm-coconut, ocean-pandanus and ocean-almond-tropical stand on, and a
    // ground sitting inside the crowns' value range makes three trees dissolve into their
    // own lawn. Measured: this body is L* 73.0 against the trees' lit tones at 74.3 / 66.0 /
    // 59.3 and their mid tones at 61.9 / 48.1 / 42.7, so every crown reads DARK against it.
    // Lighthouse Cove works the same way and is the precedent — ground L* 66.4 under crowns
    // at 59.7 and 46.1. Anyone darkening this row has to re-check it against those seven
    // numbers first; the obvious "lusher tropical green" is L* 56 and it fails.
    //
    // A FOURTH SWARD, AND IT IS THE LIGHTEST AND YELLOWEST OF THEM. dE 18.8 from
    // `coastalscrub`, 14.8 from `grass`, 36.2 from `swampgrass` — all cross-venue and so
    // picker-only, per coastalrock's two-tier rule. In-venue, which is what the player
    // actually reads, it is 60.5 from the sand it sits behind and 60.8 from the rock it
    // sits against.
    //
    // SUN-BLEACHED IS LIGHTER AND YELLOWER, NEVER GREYER, which is the cove's hardest-won
    // colour lesson applied ahead of time: coastalscrub's first answer cut saturation to
    // 0.54 to buy "sun-faded", landed with the CURED DEAD sward `swampgrass` (0.48) and read
    // army-olive. This holds chroma at 0.74 — above coastalscrub (0.62), below `grass`
    // (0.83) — and buys the fading with value instead. The olive the brief asks for lives in
    // the TILE's darker phase, not in the mean.
    //
    // `rock` is the venue's OWN stone rather than the generic #8a8a7a, so a scrub isle's
    // rock dabs are made of the same limestone as the shelf next door — coastalscrub's move,
    // and the same reason.
    //
    // DELIVERED #A9AF2A against a spec of #AABD31 — 4 L* darker and a little less yellow.
    // ⚠️ THE CROWN CONSTRAINT SURVIVES, AND CHECKING IT PROPERLY IS THE LESSON. Against the
    // spec HEX LIST the delivery looks like a failure: at L* 68.9 the ground is 5.3 DARKER
    // than the palm's lit frond tone (#94C701, L* 74.3), which the paragraph above forbids.
    // It is not a failure, because a lit tone is a HIGHLIGHT on a minority of a crown's
    // pixels and never what the crown reads as. Measured on the real sprites instead: the
    // shipped lagoon palms average L* 47.8 and 46.8, so this ground sits +21.2 above them —
    // in family with the cove, where bay-scrub at L* 66.3 sits +26.0 / +37.2 / +32.2 above
    // its own three trees. Compare crown MEANS to ground MEANS; a spec hex ladder is for
    // writing a prompt, not for judging one.
    tropicscrub: { body: '#A9AF2A', stroke: '#838621', veg: '#61711F', rock: '#A7A193', trees: true },  // body = ocean-scrub DELIVERED tile mean
    // Brightened 2026-08-08: `grass` is fresh MEADOW green now. The tan-olive it used
    // to be moved wholesale to `swampgrass` below — the bayou keeps its sun-cured look
    // (its docs were re-kinded), and everything else's grass isles read alive.
    grass:    { body: '#7aaa1d', stroke: '#5c8438', veg: '#4d7c0f', rock: '#8a8a7a', trees: true },   // body = grass tile mean
    swampgrass: { body: '#a09453', stroke: '#7d7048', veg: '#4d7c0f', rock: '#8a8a7a', trees: true },   // body = swampgrass tile mean
    // ── LIGHTHOUSE COVE'S TWO GROUNDS ───────────────────────────────────────
    // Coastal scrub upland. Body is the bay-scrub tile's SPEC mean; reset it to the DELIVERED
    // tile's own mean on ingest, per coralsand.
    //
    // DELIBERATELY NOT THE VENUE CARD'S TURF, and that is the decision worth recording.
    // Measured off bay.png across three separate headlands, the card's sunlit turf runs hue
    // 73-75 deg at saturation 0.92-0.99 — almost fully saturated yellow-green. Correct for a
    // 1254px illustration, wrong for a ground: this is the surface every boat, mark and prop
    // draws on top of, and the texture class exists to make it LOSE that contrast fight. So
    // the hue family is the card's (71 deg) and the value is lifted instead.
    //
    // ⚠️ CORRECTED 2026-08-10, AND THE FIRST ANSWER IS THE LESSON. It was #8ca24a: same hue,
    // saturation cut nearly in half to 0.54 to buy "sun-faded". That lands with `swampgrass`
    // (0.48), which is a CURED DEAD sward, and next to the card it read army-olive. Every
    // shipped land body that is meant to be alive holds its chroma — grass 0.83, redrock 0.75
    // — so cutting saturation is how a ground leaves the family, not how it gets weathered.
    // Sun-bleached grass is LIGHTER and YELLOWER, not greyer: this holds saturation at 0.62
    // and lifts L* from 63 to 71. Same mistake, same session, as the cedar's "grey-green",
    // and the cedar's note already states the rule — when a colour should read muted, move
    // along hue or value and say which way, because chroma is the one axis that kills it.
    //
    // A THIRD ANSWER, NOT A NUDGE OF EITHER EXISTING SWARD: dE 22.9 from `grass` (bright
    // meadow) and 18.2 from `swampgrass` (cured tan-olive). Against what it actually touches
    // in the cove it is far clearer — 35.1 from the sand, 40.6 from the rock below.
    //
    // `rock` is the cove's OWN rock colour rather than the generic #8a8a7a the other swards
    // use, so a scrub isle's rock dabs are made of the same stone as the headland next door.
    coastalscrub: { body: '#a3a745', stroke: '#7d7e3c', veg: '#5b693a', rock: '#a19481', trees: true },  // body = bay-scrub DELIVERED tile mean
    // Weathered coastal rock — rounded, salt-worn, grey-tan glacial stone.
    //
    // ⚠️ THE CARD MEAN WAS THE WRONG NUMBER, which is the transferable finding. Sampling the
    // card's three rock areas with water, foam and foliage masked gives #7d6f56 — and that
    // collides at dE 5.3 with the bayou's `mudflat` and 11.0 with `marsh`, two rows a
    // designer picks from the same list. The card mean is dragged dark and warm by the
    // shadow CREVICES between boulders, which are not what the material looks like; the
    // stone reads at the lit end. The spec was #9d9080; the tile landed at #a19481, 5.8 RGB
    // units warmer and lighter, and the BODY IS NOW THAT DELIVERED MEAN — with base equal to
    // tile mean the blend cannot move the colour, only the spread around it, so alpha is a
    // pure contrast knob and the mean-luma-shift the arctic textures warn about cannot
    // happen. The other three tones are the SPEC's own offsets carried onto the new body
    // rather than left where they were (the bayou-mud precedent), so the stroke keeps its
    // 50/47/43 drop and the coastline does not wash out.
    //
    // ALPHA 0.35 KEPT, and now measured rather than pre-registered: the delivered tile has
    // luma sd 8.10 at 256, so 0.35 lands on-screen sd 2.83 — between the two shipped rocks
    // (sandstone 1.38, granite 4.91) and inside the whole set's 1.38-6.75 band.
    //
    // SEPARATION WAS SCORED IN TWO TIERS AND THE DISTINCTION IS REUSABLE. In-venue separation
    // is what matters in play, because sand and rock share a shoreline and the player has to
    // read them apart at race scale: 23.9 from the cove's sand, 52.0 from the scrub above.
    // Cross-venue separation is only a picker-swatch concern — mudflat and this can never be
    // in the same race — so 19.2 there is fine where 5.3 was not.
    //
    // veg is a paler DRY STONE, not a green: the granite/redrock/mud convention for a look
    // with no vegetation on it. No trees — bare rock.
    coastalrock:  { body: '#a19481', stroke: '#6f6556', veg: '#b4a997', rock: '#817766', trees: false },  // body = bay-rock DELIVERED tile mean
    // The village lane. body = the DELIVERED tile's own mean, so alpha stays a pure contrast
    // knob; the other three are the spec's offsets carried onto it (the bayou-mud precedent).
    // veg and rock are drier and paler shell rather than a green — the granite/redrock/mud
    // convention for a look that has no vegetation on it. No trees on a road.
    lane:     { body: '#cac2ad', stroke: '#afa898', veg: '#e0dbcc', rock: '#a29a8d', trees: false },  // body = bay-lane DELIVERED tile mean
    // ── STILLWATER LAKE'S THREE GROUNDS ─────────────────────────────────────
    // ALL THREE DELIVERED 2026-08-14, so every body below is its DELIVERED tile's own mean
    // and every LAND_TEXTURES alpha is measured. With base equal to tile mean the blend
    // cannot move the colour, only the spread around it. The other three tones on each row
    // are the spec's own offsets carried onto the delivered body, the bayou-mud precedent.
    //
    // THE IN-VENUE TRIANGLE IS WHAT THESE WERE PICKED FOR, because all three share a
    // shoreline and the player reads them apart at speed: floor-to-sand 22.9, floor-to-rock
    // 28.9, sand-to-rock 22.7, against the cove's accepted sand-vs-rock 23.9.
    //
    // ⚠️ THE FLOOR IS LIGHTER THAN A NORTHWOODS TREE AND THAT IS DELIBERATE. At L* 50.9 it
    // sits +22 above a white pine crown and +29 above a balsam fir, inside the cove's
    // accepted +26/+37 band, so dark conifers read against it. It also sits 13-19 L* BELOW a
    // paper birch or aspen crown, which is the same relationship the other way — this is the
    // first ground in the game with light trees AND dark trees on it, and a medium value is
    // what lets both read. Do not darken it toward the swamp's browns to look richer.
    // `mud` is dE 21 away and `marsh` 12; both are cross-venue, so picker-only.
    // ⚠️ THE DELIVERY IS 7.5 L* DARKER THAN SPEC AND THE TREE MARGINS TIGHTENED WITH IT.
    // Spec was #8A7752 at L* 50.9, picked so a dark conifer would read against it; delivered
    // is #7C633D at L* 43.4, so the white pine's margin fell from +22.1 to +14.7 and the
    // balsam fir's from +28.1 to +20.8. Accepted, and the numbers are recorded so nobody
    // re-derives them: both still clear on dE (33.8 and 37.3), and the darker floor IMPROVED
    // the half of the problem that was always harder — the light half. Paper birch went from
    // -9.2 to -16.5 and bracken fern from -2.4 to -9.8, so this venue's light trees now stand
    // out where they were marginal. A floor carrying both light and dark canopy is a
    // compromise by construction; this delivery moved the compromise toward the weaker side.
    forestfloor: { body: '#7C633D', stroke: '#543F21', veg: '#40571F', rock: '#7E746B', trees: true },   // body = lake-forestfloor DELIVERED tile mean
    // Coarse glacial beach. GREYER AND COOLER THAN `isle`, the shared ocean-beach tan it
    // replaces here — dE 13.5 apart, against the 16.8 that separates `coralsand` from the
    // same `isle`, so this is the same size of statement the lagoon's white sand already
    // makes. Its nearest neighbour is bay's `lane` at 7.4, which is honest: crushed shell and
    // glacial gravel are both pale mixed aggregate, and they can never share a race.
    lakesand:    { body: '#B7A487', stroke: '#958469', veg: '#698A23', rock: '#958C7E', trees: true },   // body = lake-sand DELIVERED tile mean
    // Ice-worn gneiss. veg is a paler DRY STONE and rock a darker one — the
    // granite/redrock/coastalrock convention for a look with nothing growing on it, and the
    // stroke carries coastalrock's own offsets onto this body (an 18.7 L* drop against its
    // 18.6), so the coastline holds the same weight. No trees: bare rock.
    gneiss:      { body: '#847F81', stroke: '#4E4B54', veg: '#938F95', rock: '#605D64', trees: false },  // body = lake-gneiss DELIVERED tile mean (2nd slab, 2026-08-15; was #807A7F)

    // ── SOCKEYE RUN, 2026-08-16 ─────────────────────────────────────────────
    // Declared with the art still at `slot`, on purpose: a style with no LAND_TEXTURES entry
    // draws as its flat `body` colour, which is exactly art-pipeline 6's placeholder stage —
    // the venue becomes drawable and playable now, and the tiles land on top later. Four
    // existing styles (karst, mudflat, coralshoal, shoal) already run textureless, so this is
    // the supported path and not a gap.
    //
    // ⚠️ EVERY `body` BELOW IS PROVISIONAL AND MUST BE RESET TO ITS TILE'S DELIVERED MEAN on
    // ingest, the same step the three lake grounds went through. The LAND_TEXTURES alpha is a
    // pure CONTRAST knob only while body equals the tile's own mean; if they disagree, raising
    // alpha shifts the colour instead of the spread, and that is how the two arctic textures
    // ended up carrying a mean-luma-shift warning.
    //
    // SEPARATION IS MEASURED, not eyeballed, and the four were re-picked once because of it: a
    // first pass put cobble at #85868A, which measured dE 9.8 from outcrop — far too close for
    // two grounds that share a race, and 3.5 from the lake's gneiss. The set below has a worst
    // in-venue pair of dE 23.8 (cobble vs outcrop, cobble vs meadow) against the 30.6 the lake
    // ships forestfloor-to-sand at, and every one clears dE 23 from the river's own water so
    // land never smears into it. Cross-venue neighbours are accepted and named in each
    // manifest note: cobble sits 9.7 from `gneiss` and humus 5.7 from `mud`, both picker-only.
    cobble:      { body: '#6E6B65', stroke: '#4E4C48', veg: '#7C8C46', rock: '#8A8580', trees: false },  // body = river-cobble DELIVERED tile mean
    meadow:      { body: '#929738', stroke: '#5E6C38', veg: '#A8B04E', rock: '#8A8580', trees: false },  // body = river-meadow DELIVERED tile mean
    outcrop:     { body: '#999C9E', stroke: '#5E656D', veg: '#8D9689', rock: '#7C838B', trees: false },  // body = river-outcrop DELIVERED tile mean
    humus:       { body: '#352B19', stroke: '#221C10', veg: '#4E5A34', rock: '#6B665E', trees: true  },  // body = river-humus DELIVERED tile mean
    // ⚠️ THE COLOUR IS THE SHADED REFERENCE, NOT THE LIT ONE, and that is a separation decision.
    // The owner's two photographs measure #487618 in shaded forest and #819E31 in a lit clearing;
    // the bright value sits dE 11.8 from `meadow`, which would make a moss floor and an open
    // terrace the same colour on the map. The shaded one clears it at 23.3 and is the honest value
    // for a floor under a closed canopy.
    mossfloor:   { body: '#618414', stroke: '#3E5A0E', veg: '#7EA02A', rock: '#6B665E', trees: true  },  // body = river-mossfloor DELIVERED tile mean
    // THE SAME STONE as `cobble`, exactly as `coralshoal` is the same sand as `coralsand`: a
    // bar is the ground continuing under the water, so each ground look has its bar look and
    // the two are kept equal on purpose. shoalTintFor derives what the water does to it per
    // shape. No stroke worth the name and no trees — a crisp shoreline is the cue that says
    // "this is land", and a bar must not have one; its edge is a gradient.
    cobbleshoal: { body: '#6E6B65', stroke: '#4E4C48', veg: '#6E6B65', rock: '#4E4C48', trees: false },  // = cobble, kept equal
    ice:      { body: '#e6f2fb', stroke: '#7fb2d9', veg: '#ffffff', rock: '#8fc2e8', trees: false },
    redrock:  { body: '#cc6533', stroke: '#8a4a26', veg: '#d98e57', rock: '#7c4a2d', trees: false },   // body = sandstone tile mean
    // ── REDROCK RESERVOIR'S TWO NEW GROUNDS ─────────────────────────────────
    // Both bodies are SPEC means; reset each to its DELIVERED tile's own mean on ingest,
    // per coralsand, so LAND_TEXTURES' alpha stays a pure contrast knob.
    //
    // The three-step value ladder is the design: redrock L* 54.4, desertsand 67.7,
    // slickrock 84.2 — wall, sand, bleached bench, each a clear step lighter, so the
    // striped Powell geology reads in value before colour arrives. Separations measured
    // (CIE76, the library's metric): slickrock-vs-redrock 54.0, desertsand-vs-redrock
    // 28.6, slickrock-vs-desertsand 25.9 — all in-venue pairs, all past the cove's
    // accepted sand-vs-rock 23.9. Nearest cross-venue neighbour is `tropical` (#ddc39a)
    // at 6.9 from slickrock and 19.7 from desertsand — picker-swatch concerns only, per
    // coastalrock's two-tier rule, and 6.9 has coralrock's accepted 6.1 as precedent.
    //
    // SLICKROCK IS PALE, NOT GREY: bleached sandstone is lighter and yellower than the
    // orange it weathered from, never greyer (the cove's hardest-won colour lesson) — so
    // it holds saturation ~0.23 where white or grey would read as limestone. Strokes take
    // the coastalrock convention (~18 L* drop on the body's own hue) rather than carrying
    // redrock's offsets: redrock's stroke drop is only 15.8 and these bodies are far
    // lighter, so a coastline needs its own weight.
    //
    // veg is a paler dab of the same dry material and rock a darker one — the
    // granite/redrock convention for a look with nothing growing on it; desertsand's rock
    // is redrock's own #7c4a2d, the coastalscrub move, because the cobbles in Powell
    // alluvium ARE the canyon wall broken up. Neither draws on this doc venue anyway.
    slickrock:  { body: '#E3D0AF', stroke: '#AD9E85', veg: '#EFE0C4', rock: '#A8977A', trees: false },  // body = redrock-slickrock SPEC mean
    desertsand: { body: '#D2996B', stroke: '#976E4D', veg: '#E2B98F', rock: '#7c4a2d', trees: false },  // body = redrock-desertsand SPEC mean
    // Bare granite: dark, cold and jagged. Traced angular like ice (see the
    // tracer pick below) because it is broken rock, not a rounded sandbank.
    granite:  { body: '#4b5563', stroke: '#1f2937', veg: '#5b6673', rock: '#374151', trees: false },
    // Dark karst limestone — Glowtide Strait's rock.
    //
    // NEUTRAL-COOL, AND THAT WAS MEASURED RATHER THAN PICKED. The first pick was a warm
    // buff (#646057) on the reasoning that limestone is warm and a warm rock separates
    // from cool water. Rendered against the strait's three water bands it read as MUD —
    // simultaneous contrast against #1a2560 pushes any warm grey olive, so the material
    // that is supposed to be stone came out as an earth bank. Neutral survives the same
    // surround and still reads as rock, so the warm cast is gone and the separation from
    // granite is carried by value and saturation instead: this is lighter (luma 97 vs 84)
    // and far less blue than granite's #4b5563.
    //
    // "DARK" IS RELATIVE TO LIMESTONE, WHICH IS NEAR-WHITE. It cannot also be dark against
    // the water: base #1a2560 is luma 39, deep #0a0f30 is 16, and a hazard below those
    // disappears on the one venue that most needs its rocks seen. The tightest case is the
    // SHALLOW band (#27407e, luma 63) — the water rocks actually sit in — and this holds
    // ~1.5x there, which the darker candidates did not.
    //
    // No LAND_TEXTURES row, so it fills flat with lit facets over it. Fine at race scale,
    // and where granite started; add a tile at the venue's art pass.
    karst:    { body: '#5d6068', stroke: '#24262b', veg: '#414a44', rock: '#7d8087', trees: false },
    // The same limestone, drowned, and DARK — a rock you have to look for. These are IN-AIR
    // colours like every other style; submergedTint puts the water column over them at bake
    // time (see sunkenGround), so the body arrives on screen a good deal closer to the water
    // than it looks here. This row is the single source for the material: the bake, the
    // minimap and the editor chip all read it, so darkening the rock is this one hex.
    sunkenrock: { body: '#565f6f', stroke: '#1a1d23', veg: '#3a423d', rock: '#6d7078', trees: false },
    // ── THE JUNGLE ON TOP OF THE LIMESTONE ──────────────────────────────────
    // Glowtide's second dry ground, and the first thing on this venue that grows. A dark
    // muted olive-brown: decomposing leaf litter, humus, exposed root, mossy limestone
    // rubble, with small green groundcover as the only departure from it. NOT a bright
    // green — a closed jungle floor gets no light and is the colour of what is rotting on it.
    //
    // ⚠️ DELIVERED AND INGESTED 2026-08-25, AND THE BODY BELOW IS THE TILE'S OWN MEAN. The
    // slot shipped at a spec of #5F5726; the art came back at #413715, dE 15.4 and THIRTEEN
    // L* DARKER. That is the largest spec miss any ground has landed — the lake's forest floor
    // came in 7.5 under and its note calls that consequential — and it is ACCEPTED, on the
    // design rather than on the number. See the delivery paragraph below.
    //
    // ⚠️ THE NIGHT WASH IS STILL THE THING THAT DECIDES THIS ROW. drawNightWash multiplies the
    // scene toward #4a5aa0 at 0.62, so each channel keeps R 0.29 / G 0.35 / B 0.63 of itself:
    // it strips warmth and spares blue. ALL THE ON-SCREEN NUMBERS BELOW ARE MODAL PIXELS READ
    // OUT OF THE RUNNING GAME, not arithmetic. This ground renders #242010, karst renders
    // #343A50, and the water runs #132055 lit to #0A1037 deep.
    //
    // A WARM GROUND KEEPS ABOUT HALF ITS CHROMA THROUGH THE WASH AND A NEUTRAL ONE NEARLY
    // TRIPLES — karst's #5d6068 (C 5.0) arrives visibly blue at C 14.6. That asymmetry is why
    // an authored ground here must be MORE saturated than the look anyone wants, and it is the
    // one lesson from the spec that survived the delivery intact.
    //
    // ⚠️ WHY THE DARK DELIVERY WAS KEPT, AND IT IS NOT INDULGENCE. The owner's design has this
    // floor as filler glimpsed BETWEEN plants — "the jungle floor is just to provide something
    // between the trees and shrubbery as a base" — so the relationship that matters is ground
    // against CANOPY, not ground against water. Measured both ways, the darker tile wins the
    // one that counts and loses the one that does not:
    //     canopy   the shipped plants (washed mean #254E18) go dE 26.5 -> 33.1 and -8.0 ->
    //              -16.6 L*. [[glowtide-mangrove-crown]] goes -1.1 -> +7.5 L*, which
    //              RETIRES the venue's thinnest pairing — at spec the darkest tree was the
    //              same value as the ground it stood on, and accepted only on placement.
    //              Every crown is now plainly lighter than the floor, which is the honest
    //              overhead read: canopy over dark litter, not the inverse.
    //     water    +6.5 -> -2.1 L* against the lit band, so the floor now renders a shade
    //              DARKER than the sea. dE stays 48.6, so nothing is confusable, and in the
    //              intended use the jungle is a CAP whose edge never touches water — the
    //              `karst` ring does, 12.1 L* lighter. A jungle interior that reads darker
    //              than the channel is also just true.
    //     karst    dE 29.0 at -12.1 L*, BETTER than the spec's -3.5, so the shore the cap sits
    //              inside separates more strongly than it was designed to.
    //
    // stroke IS RE-DERIVED, NOT CARRIED OVER, and the old value would have been a bug: #332D11
    // was an 18.3 L* drop from the spec body and is only 4.9 below this one. The coastalrock
    // convention cannot apply at a body this dark — an 18 L* drop lands under L* 6, which is
    // black — so this takes a 10.6 drop instead. It renders #15140B: 6.4 under the ground it
    // encloses and 18.6 under the karst outside it, a definite line against both without
    // pretending to be a contrast device. The boundary is legible on its own anyway; the two
    // grounds are 12 L* apart before the stroke arrives.
    //
    // veg IS THE TILE'S OWN GROUNDCOVER, measured: pixels where G >= R are 6.9% of the frame
    // at #393D15, against a spec asking for about a tenth. rock stays karst's stone, because
    // the mossy fragments in this floor ARE that limestone broken up. Neither draws on a doc
    // venue — vegVertices and rocks are procedural-island features and the minimap takes the
    // explicit MINIMAP_ISLAND row — so both are here to be true rather than to be read.
    jungle:   { body: '#413715', stroke: '#26210E', veg: '#393D15', rock: '#7d8087', trees: true },   // body = glowtide-jungle DELIVERED tile mean
    // Sandy shoal — WET sand, deliberately darker than the dry beach above it.
    //
    // This used to be set equal to `tropical` on the principle that a bar is the beach
    // continuing under the water, so giving it its own hue would claim a different material
    // rather than the same one at a different depth. That principle is right about MATERIAL
    // and wrong about VALUE: dry and wet sand are the same grains at different reflectance,
    // and a wet bar is visibly darker before the water column over it is accounted for at
    // all. Matching the dry-beach plate exactly made every bar read a shade too bright.
    //
    // ⚠️ THE BODY HAS LESS AUTHORITY HERE THAN IT LOOKS. `submergedTint` mixes SHOAL_IN_WATER
    // (0.38) of the water's own colour into this and then applies a luma gain, so a change
    // of 14 in the red channel moves the drawn bar by about 3 luma. This value is ~25 down
    // from the dry-beach sand to land ~12 luma down on screen; do not read the hex as if it
    // were the pixel. The editor's "Sand Shoal" swatch (#cfc09a) was a third, separate
    // answer that had never been reconciled with either.
    //
    // ⚠️ NOT the same change as `coralshoal`, which stays keyed to `coralsand`: Tropic Sand
    // bars are genuinely a paler, cooler sand, and that pairing is deliberate.
    //
    // ⚠️ THIS ENTRY IS THE SAND BAR ALONE, despite `shallows`, `seagrass` and the bayou's
    // four weeds all naming `shoal` as their look. None of them reads a colour from here:
    // every one is `paint: true`, so drawShoals skips them, and every one is `awash`, so
    // drawIslands skips them too — the shallows take WATER_CONFIG.shallowColor and the
    // vegetated zones take their VEG_STYLES row's tones. Editing body/stroke/veg/rock here
    // therefore moves sand bars and nothing else. Verified by flipping this value and
    // re-reading every drawn shape on all ten venues: 9 `shoal` shapes moved, the 8
    // `tropicshoal` were byte-identical, nothing else was touched. If any of those is ever
    // rewired to read the style, that stops being true.
    //
    // No trees, no rocks and no stroke worth the name — the crisp shoreline is exactly the
    // cue that says "this is land", so a shoal must not have one. Its edge is a gradient.
    shoal:    { body: '#d0ad74', stroke: '#bb9760', veg: '#d0ad74', rock: '#bb9760', trees: false },
    // Coral-white shoal — THE SAME SAND as `coralsand`, exactly as `shoal` is the same
    // sand as `tropical`: a bar is the beach continuing under the water, so each beach
    // look has its bar look. shoalTintFor derives what the water does to it per shape.
    coralshoal: { body: '#efe4cf', stroke: '#ddd0ad', veg: '#efe4cf', rock: '#ddd0ad', trees: false },  // same sand as coralsand, kept equal
    // ── THE BAYOU'S GROUND ──────────────────────────────────────────────────
    // Bare swamp mud — body is the bayou-mud tile's DELIVERED mean (2026-08-09), which came
    // in at #524731 against a spec of #5a5140: about 8 luma darker and appreciably warmer
    // (the blue channel dropped 15 against the red's 8). The other three are the spec's own
    // offsets from its body carried onto the new one rather than left where they were —
    // stroke was 21/19/16 below the body and stays 21/19/16 below it, and likewise veg and
    // rock above. Left unmoved, the stroke's blue channel would have landed within 1 of the
    // body's and the coastline would have washed out. No trees: cypress stands in the water
    // and on the hummocks, not out on a bare bank. `veg` and `rock` are drier mud rather
    // than a green — the granite/redrock convention for a look that has no vegetation of
    // its own, which is what keeps a mud bank from sprouting a meadow fringe it never had.
    mud:      { body: '#524731', stroke: '#3d3421', veg: '#635741', rock: '#675d45', trees: false },
    // The transition ground, and its body is literally the average of its two
    // neighbours' means — which is what the marsh tile's own note asks for: the three
    // grounds have to read as one place grading through itself rather than three
    // materials butted together. This one DOES carry vegetation, so `veg` is the swamp's
    // sedge green.
    //
    // SUPERSEDED 2026-08-09 by the delivered tile's own mean (#685c37), per the recipe —
    // the average-of-neighbours rule above was only ever the stand-in for a tile that had
    // not arrived, and once one has, base-equals-tile-mean is what keeps LAND_TEXTURES'
    // alpha a pure contrast knob. stroke and rock carry their previous offsets from the
    // body (-27/-25/-19 and -7/-5/+4); veg stays the swamp's absolute sedge green.
    //
    // ⚠️ THE LADDER IS LOPSIDED AND THE ART IS WHY, not this hex. Measured on the delivered
    // tiles, the three grounds run swampgrass 145 -> marsh 92 -> mud 72 in luma, where an
    // even grade would put the middle at 108: the marsh sits 17 luma low, so it reads much
    // closer to the bank than to the sward. The cause is one phase, not the whole tile —
    // split by luma, the marsh's MUD phase is #594f32 against the delivered bank's #524731
    // (7 luma, an excellent match, the two genuinely read as one material continuing) while
    // its SEDGE phase is #7e6f3d against the sward's #a09454, fully 35 luma dark. The
    // clumps do not read as the same sawgrass thinning out; they read as a darker plant.
    // Raising this hex would NOT fix that — it would lift the mud phase away from the bank
    // it currently matches and lose the one thing the tile got right. The fix, if it is
    // worth one, is a regenerated tile with the sedge range restated; the manifest note
    // carries the numbers.
    marsh:    { body: '#685c37', stroke: '#4d4324', veg: '#4d7c0f', rock: '#61573b', trees: false },
    // The mud BAR — dark mud, like the bank it continues, and NOT the pale silt this
    // entry painted from the venue's first build until 2026-08-09.
    //
    // ⚠️ JUDGE ANY CHANGE BY THE COMPOSITE, NOT BY WHETHER THE HEX LOOKS LIKE MUD. That
    // warning is the one thing the old note got right and it is restated here unchanged:
    // between this value and the pixel sit submergedTint's mix and luma gain (0.77 on this
    // venue's water) and then SHOAL_ALPHA_CORE's 0.62 over the water itself. #6e6449
    // arrives on screen at (88,89,55).
    //
    // ── WHY IT USED TO BE PALE, AND WHY THAT STOPPED BEING TRUE ─────────────
    // The old argument ran: the bayou's water is dark olive, so a dark bar would be a
    // 0.9-drag trap nobody can see, therefore paint the pale silt that settles on a flat.
    // That was CORRECT ARITHMETIC ON A MIX THAT NO LONGER APPLIES. It was measured when
    // every bar took SHOAL_IN_WATER (0.38), which drags a bottom two-thirds of the way to
    // the water and eats its saturation — under that mix the original #6e6449 really did
    // land ~9-14 luma off the channel, and pale really was the only way out. Bare sediment
    // was later split onto SHOAL_SAND_IN_WATER (0.16) precisely because 0.38 was destroying
    // these colours, and that fix silently inverted this entry's premise: at 0.16 the body
    // survives the column, so dark now reads as dark. Nobody re-derived the hex afterwards.
    //
    // ── WHY THIS VALUE ──────────────────────────────────────────────────────
    // The bar has TWO neighbours and a hex has to clear both. Against the WATER it must be
    // visible; against the BANK it must not read as land, or a boat sails around a shape it
    // was entitled to cross (the shoal contract's second half — "unmistakably there, and
    // unmistakably NOT land"). Sweeping the bank's own hue ramp through the composite and
    // scoring the WORST of the three separations picks this tone. Note the constraint that
    // binds has flipped: pale bars lose the water, dark bars lose the bank, and the two
    // failures are a few hex apart.
    //     body      vs base   vs shallow   vs bank    worst
    //     #c5b28f    +18.5       +0.6       +45.2       0.6   <- what used to ship
    //     #6e6449    -13.5      -31.4       +13.2      13.2   <- this
    //     #675d45    -16.2      -34.0       +10.5      10.5
    //     #524731    -24.8      -42.6        +1.9       1.9   <- = the bank, reads as land
    //
    // ⚠️ THAT TABLE IS MODELLED, AND THE MODEL IS ONLY GOOD FOR RANKING. It composites
    // against the WATER_CONFIG hexes, and the water actually drawn around this bar renders
    // near luma 92 — well below shallowColor's 127 — because depth blending and the surface
    // layers (swell, gusts, wind waves, rain) all sit over it. So do not read those margins
    // as on-screen values. MEASURED on the real frame, camera parked on the bar and both
    // variants shot against the same water:
    //     #c5b28f  bar luma 98.5 vs water 92.8  ->  +5.7   low contrast, but NOT invisible
    //     #6e6449  bar luma 83.4 vs water 92.0  ->  -8.6   half again the separation, dark
    // The honest summary is that the pale bar was weak rather than broken, and this one is
    // both stronger and the right material. An earlier draft of this note called the pale
    // value invisible on the strength of the modelled +0.6; the render does not support that
    // and it is corrected here.
    //
    // #6e6449 IS THE VALUE THIS ENTRY ORIGINALLY HELD, chosen as "mud, a bit lighter" and
    // abandoned for a mix that has since been fixed. The editor's Mud Flat chip was never
    // migrated to the pale value and so has been showing this one the whole time — the
    // chip-vs-renderer drift closes itself here rather than needing a third answer.
    //
    // The crisp-shoreline cue still does the heavy lifting on the land question: a bar has
    // no stroke worth the name and fades out at its rim, so the bank margin is a margin on
    // top of a structural difference, not the only thing separating bar from bank.
    //
    // ⚠️ IF THIS BAR NEEDS TO READ HARDER, THE BODY HEX IS THE WRONG LEVER — it is worth
    // about 14 luma of swing across its whole usable range, and both ends of that range hit
    // a different neighbour. What actually caps the contrast is that only the bar's very
    // centre reaches SHOAL_ALPHA_CORE: this shape is 183x169 units against a 60-unit
    // feather, so the drag field it rasterises is mostly rim. Measured on the baked sprite,
    // peak alpha is the full 0.62 but the MEAN over the covered area is 0.269. Widen the
    // shape, shorten `feather`, or raise SHOAL_ALPHA_CORE — do not chase it with the hex.
    mudflat:  { body: '#6e6449', stroke: '#5f563f', veg: '#6e6449', rock: '#5f563f', trees: false }
};

// How a bar comes through the water. Two numbers, because a shoal has to answer two
// questions at once: it must be unmistakably there (you cannot decide to cross something
// you did not see) and unmistakably NOT land (a boat that thinks it is land sails a longer
// course for no reason). So the sand is bright but never opaque, and the fill fades out to
// nothing at the rim across the SAME band the drag feathers over — the picture and the
// physics are the same shape, and the edge you can see is the edge you can feel.
const SHOAL_ALPHA_CORE = 0.62;    // over the shallowest water, where the drag is at its floor
const SHOAL_ALPHA_RIM  = 0.0;     // at the outline, where the water is deep and free again

// ── WHAT COLOUR A SUBMERGED BAR IS ──────────────────────────────────────────
//
// Not the colour of sand. The colour of sand LIT BY WHATEVER LIGHT REACHES IT, which is the
// same light that decides what colour the water is — so the tint is derived from the
// venue's own water rather than fixed.
//
// This is not a nicety. Painted as flat #ddc39a it was right on Lighthouse Cove, whose
// bright tropical water is the palette it was picked against, and badly wrong on Glowtide,
// where a beige patch at 0.62 over near-black night water read as a spotlight pointed at
// the seabed — brighter than the sea around it, and the one object on screen outside the
// venue's palette. A sandbar at night is a dark warm smudge, and every venue past the first
// would have needed its own hand-tuned exception.
//
// Two steps, both about light and neither about taste. MIX toward the water, because you
// are looking at the bottom through a column of it and the water colours everything you see
// down there. Then SCALE by how bright that water is against the tropical reference, because
// the same bottom under less light is simply darker. The result stays inside whatever
// palette a venue authored, automatically, on venues that do not exist yet.
const SHOAL_IN_WATER = 0.38;      // how much of the column's own colour you see the sand through
const SHOAL_REF_LUMA = 128;       // luma of the bright tropical water the sand was picked against
// ── A SAND BAR NEEDS TO READ AS SAND ────────────────────────────────────────
// 0.38 was picked against BRIGHT TROPICAL water, where mixing in over a third of the column
// still leaves a warm bar. Over Sockeye Run's dark teal (#3f6f5f) the same mix drags the
// sand two-thirds of the way to the water and it comes out grey-olive: not a lighter sand,
// a DESATURATED one, which reads as a smudge on the bottom rather than a bank.
//
// ⚠️ THE BODY COLOUR CANNOT FIX THIS, and trying is how this went wrong once already.
// Darkening the sand makes a grey bar into a darker grey bar — value and saturation are
// different axes, and it is saturation that was missing. Compare, on river water:
//     mix 0.38, body #ddc39a -> #777961     grey-olive
//     mix 0.38, body #b8a67e -> #666b55     darker grey-olive (worse)
//     mix 0.16, body #d0ad74 -> #8b7a54     reads as sand
//
// BARE SEDIMENT UNDER DARK WATER — sand bars, and now the bayou's mud flats. Coral bars,
// reef rubble and the seagrass meadows keep SHOAL_IN_WATER: they sit under bright lagoon
// water where 0.38 was right, and Tropic Sand Shoals are deliberately out of scope here.
// Passing the mix per call rather than editing the shared constant is what keeps it that
// way.
//
// The mud flat was added to this list AFTER FAILING EXACTLY THE FAILURE DESCRIBED ABOVE.
// Rendered on Gatorgrass Bayou at 0.38 over olive water (luma 98) it composited to within
// 9 luma of the water around it — a 0.9-drag bar, the most expensive object in the game,
// effectively invisible. Same diagnosis as the river's sand: the mix had eaten the
// saturation, and no body colour was going to buy it back.
const SHOAL_SAND_IN_WATER = 0.16;
// Which looks are bare bottom sediment rather than something living on it. A set, because
// there are two of them now and there will be more the first time another venue authors a
// bar of its own material.
//
// ⚠️ `coralshoal` JOINED 2026-08-14, AND THE CLAUSE ABOVE THAT EXCLUDED IT HAS BEEN LEFT
// STANDING BECAUSE IT EXPLAINS WHY. It reads "Coral bars ... keep SHOAL_IN_WATER: they sit
// under BRIGHT LAGOON WATER where 0.38 was right, and Tropic Sand Shoals are deliberately
// out of scope here." Every word of that was true when Pearl Lagoon was the only venue with
// coral bars. Bluewater Bonanza then grew six tropicshoal shapes under deep open-ocean
// cobalt, and the premise expired: 0.38 over water at luma 81 dragged the coral-white bar to
// #5E7378, a dark slate that read as mud beside its own #efe4cf beach. That is the exact
// failure the sand-bar note above describes — the mix ate the saturation, and no body colour
// buys it back — so this is the same fix applied to the same defect, not a new policy.
//
// CORAL SAND IS BARE SEDIMENT BY ANY PLAIN READING, which is what makes this the right list
// rather than a special case: it is ground shell and coral rubble lying on the bottom, the
// same category as the tan sand it sits next to and the mud flat below it. What genuinely
// still belongs at 0.38 is what LIVES on the bottom — the seagrass meadows and the reef —
// because a plant or a coral head really is seen through more column than flat sediment is.
const BARE_SEDIMENT_LOOKS = { shoal: true, mudflat: true, coralshoal: true };
// The derivation, factored out because it is true of ANYTHING on the bottom — the sand
// bar and the seagrass meadow are the same physics under the same light, so they go
// through the same two steps and can never disagree about what the water does to them.
function submergedTint(bottom, mix) {
    const W = window.WATER_CONFIG || {};
    const rgb = (h, fb) => {
        const s = String(h || '').replace('#', '');
        if (s.length !== 6) return fb;
        return [parseInt(s.substring(0, 2), 16), parseInt(s.substring(2, 4), 16), parseInt(s.substring(4, 6), 16)];
    };
    // The water you SEE THE BOTTOM THROUGH. Where a venue authors a heroColor — its
    // signature shallow water, the lagoon inside the reef — that is the column over
    // every bar and meadow, and deriving from the open-ocean base instead made them
    // impossibly dark (the lagoon split left baseColor at luma 67, gain 0.52: no body
    // colour in gamut could reach the bright mint a Caribbean bar actually is). Venues
    // without a heroColor are unchanged: one water, same answer as always.
    //
    // ⚠️ shallowColor IS NOW THE MIDDLE TERM, AND IT CLOSES THE CASE THE NOTE ABOVE OPENED.
    // That note diagnosed the defect exactly — deriving a bar from the open-ocean base makes
    // it impossibly dark — and then fixed it for ONE venue by having the lagoon author a
    // heroColor, leaving every other venue on the broken derivation ("Venues without a
    // heroColor are unchanged: one water, same answer as always"). Bluewater Bonanza is what
    // showed that was a deferral rather than a decision: its coral bars painted #5E7378, a
    // dark slate, next to their own #efe4cf beach.
    //
    // A BAR IS SHALLOW WATER BY DEFINITION, so the column over it is the venue's SHALLOW
    // water, not its deep base — and every venue already authors shallowColor, so this asks
    // for nothing new from a document. heroColor still wins where a venue has one, because
    // that is a deliberate statement about signature water; baseColor survives as the last
    // resort for a palette with no shallowColor at all.
    //
    // MEASURED ACROSS THE ROSTER, this only ever moves a bar LIGHTER, which is the direction
    // the original diagnosis says is correct: ocean shoal #6F664E -> #B0AB86, bay #938969 ->
    // #ABA07A, swamp #927D52 -> #C2A66D, river #897953 -> #BAA573, glowtide #4B402F ->
    // #5A4D3A. Pearl Lagoon is untouched by this line — it has a heroColor.
    const water = rgb(W.heroColor || W.shallowColor || W.baseColor, [14, 165, 233]);
    const luma = 0.299 * water[0] + 0.587 * water[1] + 0.114 * water[2];
    // Floored well above zero: a bar you cannot see is a bar you cannot decide about, and
    // Glowtide's night water would otherwise take it to nearly black. Capped just over 1 so
    // an unusually bright venue cannot blow the sand out past white.
    const gain = Math.max(0.42, Math.min(1.12, luma / SHOAL_REF_LUMA));
    const k = (mix != null) ? mix : SHOAL_IN_WATER;
    return bottom.map((c, i) => Math.round((c * (1 - k) + water[i] * k) * gain));
}
// Per MATERIAL, not one global sand: a shoal's look names its ISLAND_STYLES entry
// (`shoal` is the tan bar, `coralshoal` the coral-white one), and the body of that
// entry is the bottom the light derivation starts from. One bar off a Cape-Cod beach
// and one off a Tropic Sand beach are different sands under the same water.
function shoalTintFor(isl) {
    const rgb = (h, fb) => {
        const s = String(h || '').replace('#', '');
        if (s.length !== 6) return fb;
        return [parseInt(s.substring(0, 2), 16), parseInt(s.substring(2, 4), 16), parseInt(s.substring(4, 6), 16)];
    };
    const st = (isl && ISLAND_STYLES[isl.style]) || ISLAND_STYLES.shoal || {};
    // Bare sediment sees less of the column than the shared default assumes — see
    // SHOAL_SAND_IN_WATER. Everything else on the bottom keeps the original mix.
    const mix = (isl && BARE_SEDIMENT_LOOKS[isl.style]) ? SHOAL_SAND_IN_WATER : undefined;
    return submergedTint(rgb(st.body, [221, 195, 154]), mix);
}

// ── SHOALS ──────────────────────────────────────────────────────────────────
//
// A bar is drawn as ITS OWN DRAG FIELD, rasterised. Not "a polygon with a soft edge that
// approximately matches" — the alpha of every pixel is VenueDoc.shoalMul at that point,
// the same call the boat's speed model makes and the same one the router prices cells
// with. So the sand you can see fading out is exactly the water that stops costing you,
// to the pixel, and the three of them cannot drift apart as the constants are tuned.
//
// The alternative was an inset polygon or a blurred fill. Both are approximations of a
// number this file can simply ask for, and a picture that lies about where the slow water
// starts is worse than no picture: the player would learn the wrong edge.
//
// Baked ONCE per shoal per race, like every other island sprite — the per-pixel cost is a
// point-in-polygon plus a distance to every segment, which is fine once and hopeless per
// frame. 2.5 units per pixel: this is a smooth gradient with no detail to lose, and it
// upscales for free (the same trade water.js makes at resolutionScale 0.5).
const SHOAL_UNITS_PER_PX = 2.5;
function bakeShoalSprite(isl) {
    const R = isl.radius;
    const px = Math.max(32, Math.min(512, Math.ceil((R * 2) / SHOAL_UNITS_PER_PX)));
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d');
    const img = g.createImageData(px, px);
    const d = img.data;
    const [sr, sg, sb] = shoalTintFor(isl);
    // The multiplier at the heart is what "fully shallow" means for THIS shoal, so a
    // gentler bar reads as a fainter one and a 0-drag shoal is invisible rather than
    // dividing by zero. That is the honest picture: no drag, nothing to warn about.
    const span = 1 - isl.shoalMul;
    const step = (R * 2) / px;
    for (let j = 0; j < px; j++) {
        const wy = isl.y - R + (j + 0.5) * step;
        for (let i = 0; i < px; i++) {
            const wx = isl.x - R + (i + 0.5) * step;
            const t = span > 1e-6 ? (1 - window.VenueDoc.shoalMul(isl, wx, wy)) / span : 0;
            const o = (j * px + i) * 4;
            d[o] = sr; d[o + 1] = sg; d[o + 2] = sb;
            d[o + 3] = Math.round(255 * (SHOAL_ALPHA_RIM + (SHOAL_ALPHA_CORE - SHOAL_ALPHA_RIM) * t));
        }
    }
    g.putImageData(img, 0, 0);
    // Keyed on the TINT, so the bake follows the water. resetGame applies the venue's
    // palette, and the water panel can move it live — either way a sprite baked against
    // the previous venue's light rebakes itself rather than sitting there in the wrong
    // colour. Same reason applyVenuePalette drops the gust sprites.
    isl._shoalSprite = { canvas: cv, r: R, tint: `${sr},${sg},${sb}` };
}

// ── PAINTED SHALLOWS ────────────────────────────────────────────────────────
//
// A `shallows` zone is a POLYGON WITH A SOFT EDGE, baked once like every other island
// sprite. It is NOT a drag field — zero drag is the kind's whole point — so unlike a
// shoal there is no number to rasterise: the fill is flat and the rim is a blur, sized
// by the same feather the shoals use so the two transitions read as one water.
//
// The alpha is deliberately well under 1: the zone is a TINT OVER the venue's water,
// not a replacement for it. The ripple lattice beneath still shows through, and the
// swell, wakes, gusts and wind waves are all drawn after, so they run across the zone
// unbroken — which is most of what keeps it reading as water rather than paint. The
// venue palette authors the two colours as a pair: `baseColor` is the open water (for
// a lagoon, the deep ocean outside the reef) and `shallowColor` is what this zone
// lays over it, picked knowing the blend (final ≈ 0.72·shallow + 0.28·base).
const SHALLOWS_ALPHA = 0.72;
function bakeShallowsSprite(isl) {
    const tint = (window.WATER_CONFIG && window.WATER_CONFIG.shallowColor) || '#38bdf8';
    // The blur bleeds outward, so give the sprite room for it past the outline.
    const margin = isl.shoalFeather + 20;
    const R = isl.radius + margin;
    const px = Math.max(32, Math.min(1024, Math.ceil((R * 2) / SHOAL_UNITS_PER_PX)));
    const scale = px / (R * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d');
    // Geometry mapped to device pixels by hand rather than ctx.scale: canvas filter
    // units interact with the current transform inconsistently across browsers, and a
    // feather that renders at two different widths is exactly the seam this bake exists
    // to avoid.
    const pts = isl.vertices.map(v => ({
        x: (v.x - isl.x + R) * scale,
        y: (v.y - isl.y + R) * scale
    }));
    // Half the feather each side of the authored edge ≈ a transition the feather wide,
    // matching the shoals' smoothstepped rim.
    g.filter = `blur(${Math.max(1, (isl.shoalFeather / 2) * scale)}px)`;
    g.globalAlpha = SHALLOWS_ALPHA;
    g.fillStyle = tint;
    traceRoundedPoly(g, pts);
    g.fill();
    isl._shallowsSprite = { canvas: cv, r: R, tint };
}

// UNDER THE SHOALS, AND UNDER EVERYTHING ON THE WATER. A zone says "the water here is
// a different water"; a bar inside it is still a bar, so the shoal's sand paints over
// the tint, and everything AT the surface paints over both.
function drawShallows(ctx) {
    if (!state.course || !state.course._hasShallows) return 0;
    const tint = (window.WATER_CONFIG && window.WATER_CONFIG.shallowColor) || '#38bdf8';
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const camX = state.camera.x, camY = state.camera.y;
    let drawn = 0;
    for (const isl of state.course.islands) {
        // A vegetated zone is also `paint`, but it is drawVegetation's layer — it goes
        // OVER the shoal sand (or over the finished water, if it floats), and this pass
        // runs under both. Keyed on `veg` rather than on the kind name, so a new plant
        // does not have to be remembered here.
        if (!isl.paint || isl.hidden || isl.veg) continue;
        const limit = viewRadius + isl.radius;
        if ((isl.x - camX) ** 2 + (isl.y - camY) ** 2 > limit ** 2) continue;
        // Keyed on the tint like the shoal bake: a venue swap or a live palette edit
        // rebakes rather than leaving last venue's water painted on this one.
        if (!isl._shallowsSprite || isl._shallowsSprite.tint !== tint) bakeShallowsSprite(isl);
        const s = isl._shallowsSprite;
        ctx.drawImage(s.canvas, isl.x - s.r, isl.y - s.r, s.r * 2, s.r * 2);
        drawn++;
    }
    return drawn;
}

// ── VEGETATION ZONES ────────────────────────────────────────────────────────
//
// A bed is the painted zone's opposite fill: where shallows is one flat tint with a
// blurred rim, vegetation is HUNDREDS OF SMALL CLUMPS and no tint at all — because from
// this camera's altitude a bed is not a surface, it is patchy mass. The clumps are
// scattered in code from the shape's own seeded PRNG (never Math.random — render must not
// touch the eval RNG stream, and a bed that rearranged itself every reload would read as
// a bug): arrangement is code's job, which is the compose.py argument applied at runtime.
//
// The edge is DENSITY, not blur. A bed peters out — clumps thin and shrink over the same
// feather band the other zones use — so the rim stays crisp per-clump and soft as a mass,
// which is exactly how the aerial references read. A few larger holes are carved the same
// way, so the interior is patchwork rather than carpet.
//
// ONE BAKER, FIVE PLANTS. This was seagrass alone and the renderer keyed on the literal
// string 'seagrass'. The bayou then wanted four more beds, every one needing the same
// machinery — seeded scatter, density rim, carved holes — with a different plant stamped
// into it. So the STRUCTURE lives here once and VEG_STYLES holds what differs, with
// SHAPE_KINDS' `veg` naming the spec: the same one-list rule MARK_KINDS and PROP_KINDS
// already follow. Adding a plant is a row, not a renderer.
//
// PLANE IS THE LOAD-BEARING AXIS, and it is physics rather than decoration:
//
//   'bottom'   the plant is UNDER the water. It takes submergedTint, it draws with the
//              seabed layers, and every surface layer — wake, gust, wind wave, cat's-paw
//              — runs across it, because all of those are happening above it.
//   'surface'  the plant is ON the water. NO submergedTint, because nothing stands between
//              it and the sun; and it draws AFTER the surface layers, because a wake does
//              not run across a hyacinth raft — the raft is what the wake stops at.
//              Getting that backwards is exactly what would make a floating mat read as a
//              stain on the water instead of a thing lying on top of it.
//
// Every clump function owns its own drawing, because THE CLUMP IS THE PLANT: a seagrass
// tussock, a lily pad and a fleck of duckweed are different objects, and one parameterised
// ellipse could only ever have been one of them wearing the others' colours.

// A tussock: a few overlapped ellipses, mostly dark, the light tone rare — large clean
// value masses, not per-blade noise. UNCHANGED from the original seagrass bake, RNG draw
// for RNG draw, so every existing meadow bakes byte-identically across this refactor.
function clumpTussock(g, cx, cy, scale, rand, tones, alpha) {
    const cs = (7 + rand() * 9) * scale;
    const n = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < n; b++) {
        const t = rand();
        const tone = tones[t < 0.55 ? 0 : t < 0.86 ? 1 : 2];
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs, cy + (rand() - 0.5) * cs,
                  cs * (0.32 + rand() * 0.3), cs * (0.2 + rand() * 0.24),
                  rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
}

// Hydrilla and coontail — a submerged CANOPY, not a tussock. It grows up off the bottom
// in fine whorled strands and from above reads as a soft dark cloud with no edge of its
// own, so this is more ellipses, smaller, stretched every which way, and the light tone
// nearly absent. What keeps it faint is the layer alpha and the wash, NOT the clump:
// draw the clump pale and the bed disappears at the rim first, which is the wrong half to
// lose — the rim is where a sailor decides whether to cross.
function clumpCanopy(g, cx, cy, scale, rand, tones, alpha) {
    const cs = (9 + rand() * 11) * scale;
    const n = 4 + Math.floor(rand() * 4);
    for (let b = 0; b < n; b++) {
        const t = rand();
        const tone = tones[t < 0.62 ? 0 : t < 0.92 ? 1 : 2];
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs * 1.3, cy + (rand() - 0.5) * cs * 1.3,
                  cs * (0.2 + rand() * 0.26), cs * (0.14 + rand() * 0.2),
                  rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
}

// A lily pad, and THE NOTCH IS THE WHOLE SILHOUETTE: Nymphaea and Nuphar both carry a
// wedge cut from one side in to the centre, and at this size that single feature is what
// separates a pad from a blob of algae. Drawn as an arc closed through its own centre — a
// filled circle minus a wedge — at an arbitrary rotation, because a bed of pads all
// notched the same way is the tell that they were stamped rather than grown.
//
// SIZE follows the art pipeline's own answer instead of a fresh guess: bayou-lilypad is
// declared at world 18, so pads here run 11..19 across and the composed sprite and the
// procedural bed agree about how big a lily pad is.
//
// One in sixteen is in flower. It is the venue's only bright accent, and it is worth
// having: olive on olive on olive is what this place looks like, and a white star in it
// is how you notice the bed at all.
function clumpPad(g, cx, cy, scale, rand, tones, alpha) {
    const n = 1 + (rand() < 0.55 ? 1 : 0);
    for (let b = 0; b < n; b++) {
        const r = (5.5 + rand() * 4) * scale;
        const t = rand();
        const tone = tones[t < 0.5 ? 0 : t < 0.85 ? 1 : 2];
        const a0 = rand() * Math.PI * 2;
        const notch = 0.28 + rand() * 0.2;          // radians of missing wedge
        const px = cx + (rand() - 0.5) * r * 2.4, py = cy + (rand() - 0.5) * r * 2.4;
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.moveTo(px, py);
        g.arc(px, py, r, a0 + notch, a0 + Math.PI * 2 - notch);
        g.closePath();
        g.fill();
        if (rand() < 0.0625) {
            g.fillStyle = `rgba(238,236,220,${alpha})`;
            g.beginPath();
            g.arc(px, py, r * 0.3, 0, Math.PI * 2);
            g.fill();
        }
    }
}

// Water hyacinth — a RAFT, so the read is coverage rather than clumps: the rosettes touch
// each other and the mat carries a hard outer edge where wind has shoved it up against
// something. Each rosette is a round leaf cluster with a lighter crown, and roughly one in
// twenty carries the lavender flower spike that makes hyacinth unmistakable at any scale.
function clumpRosette(g, cx, cy, scale, rand, tones, alpha) {
    const cs = (6 + rand() * 6) * scale;
    const n = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < n; b++) {
        const t = rand();
        const tone = tones[t < 0.45 ? 0 : t < 0.85 ? 1 : 2];
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs * 1.6, cy + (rand() - 0.5) * cs * 1.6,
                  cs * (0.42 + rand() * 0.3), cs * (0.38 + rand() * 0.28),
                  rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
    if (rand() < 0.05) {
        g.fillStyle = `rgba(178,158,214,${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs, cy + (rand() - 0.5) * cs,
                  cs * 0.2, cs * 0.3, rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
}

// Lemna. An individual duckweed plant is about 3 mm across, so at this altitude it is not
// objects at all — it is a FILM. Many tiny flecks at a tight spacing, near-uniform in
// tone, which buys the one property this plant is here for: an unbroken green surface,
// against which anything that opens a lane through it is instantly legible.
function clumpFleck(g, cx, cy, scale, rand, tones, alpha) {
    const cs = (3 + rand() * 3) * scale;
    const n = 5 + Math.floor(rand() * 4);
    for (let b = 0; b < n; b++) {
        const t = rand();
        const tone = tones[t < 0.5 ? 0 : t < 0.85 ? 1 : 2];
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs * 3, cy + (rand() - 0.5) * cs * 3,
                  cs * 0.5, cs * 0.42, rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
}

// tones      dark / mid / light, PRE-submersion. A bottom plant's three greens go through
//            submergedTint like the shoal's sand — grass and bar are the same bottom under
//            the same light, so Pearl Lagoon shows bright olive through turquoise and a
//            night venue shows a dark smudge, automatically. A surface plant's do not.
// wash       bottom only: how far past submergedTint the tones are pulled toward the
//            water. A bed is a stain on the seabed and a stain is mostly water.
// layerAlpha the whole baked layer's opacity — the knob for how much this plant asserts.
// clumpAlpha per-clump; overlap is what builds the darker heart of a patch.
// spacing    world units between scatter candidates. Small = dense = a mat, not a bed.
// cover      the density ceiling in the bed's own interior, before rim and holes thin it.
// holeEvery  one carved hole per this many units of radius (min 2), so a big bed is
//            patchwork rather than carpet.
// mass       optional {tone, alpha}: a soft-edged fill of the whole shape laid down BEFORE
//            the clumps. Absent for a BED, where the water between plants is the point —
//            present for a SURFACE, where it is not.
//
//            This is the difference between a raft and a scatter, and scatter is what you
//            get without it: the first hyacinth mat was clumps alone at cover 0.97, and it
//            still read as confetti on open water, because however tight the spacing gets,
//            round clumps on a transparent ground leave channels between them. A mat has
//            no channels — that is what makes it a mat and what makes ploughing one cost
//            three-quarters of your speed. Same device the reef mass uses, same reason.
const VEG_STYLES = {
    // Pearl Lagoon's meadow. Every number here is the one the seagrass bake shipped with.
    seagrass: { plane: 'bottom', clump: clumpTussock,
                tones: [[43, 74, 45], [58, 94, 52], [74, 112, 58]],
                wash: 0.3, layerAlpha: 0.66, clumpAlpha: 0.85,
                spacing: 24, cover: 0.9, holeEvery: 150 },

    // ── THE BAYOU'S FOUR ────────────────────────────────────────────────────
    // Submerged hydrilla — the keel-grabber, and the one you are meant to half-see. It is
    // FAINT ON PURPOSE AND VISIBLE ON PURPOSE: a 0.6-drag bed you cannot see at all is
    // the unfair trap the mudflat note argues against, and a bed as loud as a lily pad
    // would stop being the thing you notice a beat too late. These two numbers are the
    // whole dial — layerAlpha for how much of it survives, wash for how much water is
    // mixed into it — and they are the first place to go if it reads wrong on screen.
    weedbed:  { plane: 'bottom', clump: clumpCanopy,
                tones: [[30, 52, 32], [42, 68, 40], [56, 86, 48]],
                wash: 0.4, layerAlpha: 0.45, clumpAlpha: 0.8,
                spacing: 20, cover: 0.95, holeEvery: 190 },
    // Rooted lilies: pads ON the surface, bed FIXED to the bottom. NO mass — discrete
    // objects with open water between them, so the spacing is loose and the cover never
    // closes. Seeing the black channel between pads is what a lily bed looks like, and it
    // is also the one thing keeping it from reading as a hyacinth mat.
    //
    // Tones were raised a full step after the first render: a pad in sunlight is
    // distinctly brighter and yellower than the water it floats on, and picked at the
    // water's own value the whole bed came out as a texture rather than as objects. What
    // sells a floating leaf is that it is LIT and the water is not.
    //
    // unitsPerPx 1 — THE ONLY STYLE THAT ASKS FOR IT, and the reason is the pad itself. Every
    // other row here is a texture, where the shared 2.5 costs nothing you can see. A pad is an
    // OBJECT with a hard edge and a notch cut in it, and at 2.5 it was rasterised 6px across
    // to be displayed at 15 — soft blobs with the notch smeared out, which is the one feature
    // separating a lily bed from algae. See bakeVegSprite for the full argument; the cost is
    // one 1786px canvas baked once per race.
    lilybed:  { plane: 'surface', clump: clumpPad, unitsPerPx: 1,
                tones: [[92, 124, 58], [122, 156, 74], [152, 186, 96]],
                wash: 0, layerAlpha: 0.95, clumpAlpha: 0.95,
                spacing: 26, cover: 0.82, holeEvery: 170 },
    // The hyacinth raft: a MASS with rosettes worked over it, tightest spacing and highest
    // cover in the table. Every one of those says the same thing — this is a surface you
    // plough, not a garden you sail between. Few holes for the same reason.
    weedmat:  { plane: 'surface', clump: clumpRosette,
                tones: [[70, 104, 52], [100, 134, 68], [132, 166, 92]],
                mass: { tone: [112, 148, 70], alpha: 0.88 },
                wash: 0, layerAlpha: 0.96, clumpAlpha: 0.94,
                spacing: 13, cover: 0.97, holeEvery: 220 },
    // The film, and a film is nothing BUT mass — the flecks are the grain on top of it.
    // Brightest tones in the table, because Lemna is a vivid yellow-green and is the
    // lightest thing on this venue's water: its entire job is contrast against the
    // tannin-dark channel it lies on, so that a lane opened through it is unmissable.
    duckweed: { plane: 'surface', clump: clumpFleck,
                tones: [[112, 146, 62], [132, 166, 76], [150, 182, 92]],
                mass: { tone: [126, 160, 74], alpha: 0.8 },
                wash: 0, layerAlpha: 0.82, clumpAlpha: 0.9,
                spacing: 9, cover: 0.98, holeEvery: 260 }
};

function vegTone(base, spec) {
    // ON the water: lit by the sky directly, so nothing is done to it. A floating mat put
    // through submergedTint would be a mat painted the colour of the bottom.
    if (spec.plane === 'surface') return base.slice();
    const t = submergedTint(base);
    const W = window.WATER_CONFIG || {};
    const hex = String(W.heroColor || W.baseColor || '#0ea5e9').replace('#', '');
    const w = [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
    return t.map((c, i) => Math.round(c * (1 - spec.wash) + w[i] * spec.wash));
}

function bakeVegSprite(isl, spec) {
    const tones = spec.tones.map(t => vegTone(t, spec));
    const R = isl.radius + 10;
    // ── HOW FINE TO BAKE, AND WHY IT IS A PER-STYLE QUESTION ────────────────
    // This used to borrow SHOAL_UNITS_PER_PX outright, and that constant carries its own
    // justification: 2.5 is safe "because this is a smooth gradient with no detail to lose,
    // and it upscales for free". That is TRUE OF A SHOAL and true of the mass below — and
    // false of anything with an edge in it. A lily bed is discrete objects: at 2.5 a 15-unit
    // pad was rasterised 6px across and then blown back up to 15 on screen, so every pad
    // arrived as a soft blob and the notch that is supposed to say "lily pad rather than
    // algae" was the first thing to dissolve.
    //
    // So the number belongs to the STYLE. Anything that reads as a texture keeps 2.5 and
    // costs what it always did; a style made of objects asks for 1 and gets rasterised at
    // the size it is drawn, with no upscale between the arc and the screen.
    //
    // The cap moves 1024 -> 2048 to let that happen: the biggest bed in the game needs
    // 1786px at 1 unit/px. It is inert for every style still on 2.5 — the largest of those
    // asks for 715px — so nothing that did not opt in changes size, cost or appearance.
    const upp = spec.unitsPerPx || SHOAL_UNITS_PER_PX;
    const px = Math.max(32, Math.min(2048, Math.ceil((R * 2) / upp)));
    const scale = px / (R * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d');

    // Seeded from the shape's id, so the layout is the venue's, not the session's.
    let seed = 2166136261;
    for (const ch of String(isl.id || 'seagrass')) seed = ((seed ^ ch.charCodeAt(0)) * 16777619) >>> 0;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    // The unkeyholed rings (outer + holes), same source of truth the shoal depth read
    // uses — the keyholed trace's zero-width slit would put a false edge across the bed.
    const rings = isl.shoalRings || [isl.vertices.map(v => [v.x, v.y])];
    const inRing = (x, y, ring) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    };
    const edgeDist = (x, y) => {
        let d2 = Infinity;
        for (const ring of rings) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const [x1, y1] = ring[j], [x2, y2] = ring[i];
                const dx = x2 - x1, dy = y2 - y1;
                const L2 = dx * dx + dy * dy || 1;
                const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2));
                const px_ = x1 + t * dx - x, py_ = y1 + t * dy - y;
                const dd = px_ * px_ + py_ * py_;
                if (dd < d2) d2 = dd;
            }
        }
        return Math.sqrt(d2);
    };
    const inside = (x, y) => {
        if (!inRing(x, y, rings[0])) return false;
        for (let h = 1; h < rings.length; h++) if (inRing(x, y, rings[h])) return false;
        return true;
    };

    // Open-water holes: a handful of soft low-density ellipses, scaled to the bed. These
    // are what keep a big bed from reading as one stamped carpet.
    const holeN = Math.max(2, Math.round(isl.radius / spec.holeEvery));
    const holes = [];
    for (let i = 0; i < holeN; i++) {
        holes.push({ x: isl.x + (rand() * 2 - 1) * isl.radius * 0.7,
                     y: isl.y + (rand() * 2 - 1) * isl.radius * 0.7,
                     r: isl.radius * (0.12 + rand() * 0.14) });
    }
    const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const feather = isl.shoalFeather || 120;

    // THE MASS, under the clumps, for the plants that are a surface rather than a bed.
    //
    // RASTERISED FROM THE SHAPE'S OWN EDGE RAMP, not blurred, and the difference is not
    // cosmetic. A canvas blur is a fixed number of PIXELS while the ramp is a distance in
    // the WORLD, so the two agree at exactly one sprite size and nowhere else — the first
    // attempt asked for blur(feather/2.5 * scale) and got 15px of smear on a 160px sprite,
    // which erased the mass it was meant to soften. Rasterising uses the same
    // distance-to-edge the clump density uses, so the mat's opacity, its thinning rosettes
    // and its drag all feather over one band: the edge you see is the edge you feel.
    //
    // Baked small and scaled up. A mass is a smooth gradient with no detail to lose, so the
    // upscale is free and it keeps the per-pixel ring walk cheap.
    if (spec.mass) {
        const m = vegTone(spec.mass.tone, spec);
        const mp = Math.max(24, Math.min(96, px));
        const mc = document.createElement('canvas');
        mc.width = mc.height = mp;
        const mg = mc.getContext('2d');
        const img = mg.createImageData(mp, mp);
        const d = img.data;
        const step = (R * 2) / mp;
        for (let j = 0; j < mp; j++) {
            const wy = isl.y - R + (j + 0.5) * step;
            for (let i = 0; i < mp; i++) {
                const wx = isl.x - R + (i + 0.5) * step;
                const o = (j * mp + i) * 4;
                d[o] = m[0]; d[o + 1] = m[1]; d[o + 2] = m[2];
                d[o + 3] = inside(wx, wy)
                    ? Math.round(255 * spec.mass.alpha * smooth(edgeDist(wx, wy) / feather))
                    : 0;
            }
        }
        mg.putImageData(img, 0, 0);
        g.imageSmoothingQuality = 'high';
        g.drawImage(mc, 0, 0, px, px);
    }

    // Jittered-grid scatter over the bbox: even coverage without Poisson bookkeeping.
    const minX = isl.x - isl.radius, minY = isl.y - isl.radius;
    const cells = Math.max(1, Math.ceil((isl.radius * 2) / spec.spacing));
    for (let gy = 0; gy < cells; gy++) {
        for (let gx = 0; gx < cells; gx++) {
            const wx = minX + (gx + 0.15 + rand() * 0.7) * spec.spacing;
            const wy = minY + (gy + 0.15 + rand() * 0.7) * spec.spacing;
            if (!inside(wx, wy)) continue;
            // Rim thinning: full density a feather in from the edge, none at the rim.
            let p = smooth(edgeDist(wx, wy) / feather) * spec.cover;
            for (const h of holes) {
                const hd = Math.hypot(wx - h.x, wy - h.y);
                if (hd < h.r) p *= 0.12 + 0.88 * smooth(hd / h.r);
            }
            if (rand() >= p) continue;
            const cx = (wx - isl.x + R) * scale, cy = (wy - isl.y + R) * scale;
            spec.clump(g, cx, cy, scale, rand, tones, spec.clumpAlpha);
        }
    }
    isl._vegSprite = { canvas: cv, r: R, tint: tones[0].join(',') };
}

// ── CORAL REEF ──────────────────────────────────────────────────────────────
//
// The third painted bottom, and the first that is also a WALL (its collision comes from
// the shape itself — soft by kind, so you grind along it rather than sticking to it).
// The picture: a dark reef-rock mass with a tight feathered rim, worked over with a
// DENSE field of touching coral clumps in the six pastel families the coral-head
// sprites established, each clump sitting on its own relief shadow. Submersion comes
// from ONE submergedTint wash plus the translucency that lets the ripple lattice read
// through — the reef's own job is structure, and it must stay legible as the one
// bottom you cannot sail into.
// Palette and structure matched to the owner's reference plate (sampled 2026-08-08):
// the reef BAND is olive-khaki RUBBLE — dark seams #4f6148, mid #747f63, pale #9da795
// on screen — and the pinks/lavenders/purples arrive as clustered COLONIES inside it,
// patches the size of a coral garden, never an even confetti. Occasional pale sand
// pockets open inside the band. Bases below are pre-wash: submergedTint plus the 0.7
// draw alpha green them toward the reference's own drowned reading.
const REEF_RUBBLE = [
    [110, 96, 48],     // dark seam khaki
    [168, 146, 92],    // mid rubble
    [204, 190, 146]    // pale worn rubble
    // A notch warmer than the reference's own screen values on purpose: submergedTint
    // pulls everything toward the turquoise hero, so the bases must overshoot brown to
    // land on the plate's olive.
];
// Colony accents, tuned for what they become AFTER the wash — the hero water adds
// roughly +119 green-over-red to everything, so a base keeps its identity only by
// overshooting its own hue (a pink needs R-G >= ~110 at base to still read pink).
// Post-wash these land as dusty rose, periwinkle, gold-green and bright mint: four
// distinct gardens, every one of them pulled toward the green by the water itself,
// which is what keeps the band reading as one reef rather than confetti.
const REEF_ACCENTS = [
    [245, 108, 124],   // -> dusty rose
    [150, 125, 195],   // -> periwinkle
    [225, 175, 85],    // -> gold-green
    [140, 210, 170]    // -> bright mint
];
const REEF_SAND = [225, 214, 178];   // the pockets that open inside the band
const REEF_DARK = [40, 44, 30];      // relief shadow under every clump
const REEF_BASE = [70, 66, 44];      // the rock mass the rubble sits on
const REEF_ALPHA = 0.7;
// ── THE SAME BAKE, IN STONE ─────────────────────────────────────────────────
// A `sunkenrock` is a reef in every structural sense — a submerged solid drawn on the
// bottom — so it shares the geometry (blurred mass, feathered rim, clump field) and
// differs only in palette and in how colour is DISTRIBUTED. A coral reef is a garden:
// colour arrives in patches, because colonies and sand pockets are separate organisms
// and separate ground. A drowned rock is ONE material, so the patch grid is bypassed
// entirely and the clumps just read as boulders and shadow. Patching stone would look
// like lichen, which is the one thing a thing underwater cannot have.
//
// Bases overshoot COOL here where the coral bases overshoot warm, and for the mirror
// reason: these sit under Glowtide's indigo, not a turquoise lagoon, and karst is a
// neutral-cool grey that goes olive the moment anything warm is left in it. Same
// simultaneous-contrast trap the karst body colour hit in air (see ISLAND_STYLES.karst).
// ⚠️ THE FOUR PLANES ARE GRANITE'S OWN, BRIGHTENED — not a stone-coloured clump field. A
// drowned rock got the reef's rubble treatment first and read exactly like a reef, because
// rubble is what that field draws. What makes granite read as granite is bakeIslandSprite's
// FACET FAN: flat-shaded triangles from the summit to every edge, four greys, hard edges,
// no gradient anywhere. So this is that same fan, and the only thing the water changes is
// the palette it is painted in.
//
// The values overshoot bright for the same reason the coral bases overshoot warm: they are
// read through submergedTint, which on Glowtide multiplies the spread by ~0.28 and drags
// everything toward a near-black indigo. Granite's literal greys land at luma 19-33 there,
// i.e. a black hole with a slightly less black hole in it. These are pitched so the band
// STRADDLES the water's own ~40: shadowed faces come out near 27, the lit crown near 54.
// That is what makes it a lit stone mass rather than a silhouette.
// ONE SOURCE FOR WHAT THIS ROCK IS MADE OF: ISLAND_STYLES.sunkenrock. The bake used to
// carry its own base colour beside the style's, which meant the minimap, the editor chip
// and the rock itself could drift to three answers about the same stone — the exact split
// the shoal swatch note in editor.js was written about. The style row is the material; this
// is only the water going over it.
//
// ⚠️ THE STYLE BODY IS THE ROCK IN AIR, so it is read UNSUBMERGED and tinted here. Three
// multipliers stand between it and the screen — submergedTint compresses the range to ~0.28
// of itself, the draw alpha takes a cut, and the night wash roughly halves what is left —
// which is why a body that looks like ordinary dark slate in the picker arrives as something
// a good deal closer to the water.
function hexToRgb(h, fb) {
    const s = String(h || '').replace('#', '');
    return s.length === 6
        ? [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
        : fb;
}
// ⚠️ THE WINDOW IS NARROW, AND BOTH ENDS OF IT WERE FOUND THE HARD WAY. The body hex is a
// far weaker knob than it looks, because submergedTint LERPS TOWARD THE WATER: past a point,
// a darker body just buys more water colour. Swept on Glowtide, re-baking between each and
// measuring the MEDIAN over the rock (point samples are useless here — they land on moon
// glitter and wind streaks and swing 20 luma frame to frame):
//
//     bodyLuma  62 -> 22.6      100 -> 27.1      142 -> 31.7
//     fit: on-screen luma = 0.118 * bodyLuma + 15.2, against water at ~24
//
// Owner-judged, and this is the part no measurement gives you: bodyLuma 124 read as TOO
// LIGHT (a rock brighter than the sea it is under) and bodyLuma 24 as TOO DARK (a hole, not
// a stone). The value below is the midpoint of that bracket. Anything under ~26 on screen is
// wasted effort in any case: the rock is UNDER the surface, so the moon wash, the glitter
// and the wind waves paint over it afterwards, and past that point you are looking at the
// water and not at the rock.
// ⚠️ HOW DARK THE ROCK READS, and it is the ONLY knob that really moves it. Applied as a
// multiplier on the finished sprite — see the note at the fill site for why the body colour
// cannot do this job.
//
// ⚠️ MEASURE AGAINST *LOCAL* WATER. The first sweep of this compared the slab to a wide ring
// around it, which on this venue catches the karst islands' bio-surf glow and reads ~6 luma
// bright — so every figure came out flattering and two rounds of "too dark" followed a table
// that said the rock was nearly neutral. The numbers below use a ring just outside the slab
// on its open-water side, which is what the eye actually compares it with:
//
//     depth 0.42 -> -8.7   owner: "still too dark"
//     depth 0.60 -> -3.5   <- here: plainly darker than the water, granite still legible
//     depth 0.75 -> +0.9
//     depth 0.88 -> +5.9
//     depth 1.00 -> ~+9    owner: "don't appear dark" (the original bug)
//
// ⚠️ THE CURVE ALSO MOVES WITH THE TILE ALPHA, so re-sweep if that changes: getLandPattern
// draws the granite RAW over the base, and a lighter tile has to be paid for with more
// depth. These are at alpha 0.30.
let SUNKEN_DEPTH = 0.60;
function sunkenGround() {
    return submergedTint(hexToRgb((ISLAND_STYLES.sunkenrock || {}).body, [86, 95, 111]));
}
// ⚠️ NOT REEF_ALPHA. 0.7 is right for coral — a garden is a thing you see INTO, and the
// lost 30% is water over the top of it. A rock is opaque, and at 0.7 nearly a third of the
// facet contrast that survives submergedTint is thrown away again on the way to the screen.
const SUNKEN_ALPHA = 0.95;
const REEF_SPACING = 13;             // dense: the clumps have to TOUCH to read as rubble
const REEF_PATCH = 90;               // world units — the size of a colony or a sand pocket
const REEF_UNITS_PER_PX = 2.0;       // crisper than the drag-field bakes: this is texture, not gradient
function bakeReefSprite(isl) {
    const stone = isl.style === 'sunkenrock';
    const rubble = REEF_RUBBLE.map(t => submergedTint(t));
    const accents = REEF_ACCENTS.map(t => submergedTint(t));
    const sand = submergedTint(REEF_SAND);
    const dark = submergedTint(REEF_DARK);
    const ground = stone ? sunkenGround() : submergedTint(REEF_BASE);
    const R = isl.radius + 80;
    const px = Math.max(32, Math.min(1024, Math.ceil((R * 2) / REEF_UNITS_PER_PX)));
    const scale = px / (R * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d');

    // The reef MASS: dark rock, a tight blurred rim — soft enough to sit in the water,
    // firm enough to read as a thing with an edge.
    const pts = isl.vertices.map(v => ({ x: (v.x - isl.x + R) * scale, y: (v.y - isl.y + R) * scale }));
    const feather = Math.min(40, isl.radius * 0.3);
    const css = (c, a) => a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    // ── STONE: A FLAT DARK ROCK IN THE GRANITE TEXTURE ──────────────────────
    // Everything below this block is the coral bake — a clump field, which is the correct
    // drawing of rubble and the wrong drawing of a rock. A drowned head is much simpler than
    // either that or the island bake's lit plane fan: one flat dark body, the granite tile
    // over it, and nothing else. It got the plane fan first and that was over-rendered — a
    // fan is a MOUNTAIN cue, the summit-to-edge shading of something standing up in the air,
    // and there is no summit here to catch light.
    //
    // The granite tile is shared with the arctic's rock rather than reproduced, so the two
    // are literally the same stone; only the base colour under it differs, which is what
    // getLandPattern's per-base cache is for. No coastline STROKE — an outline is the single
    // strongest "this is land" cue, and drawing one would undo the whole object.
    if (stone) {
        const base = css(ground);
        // ⚠️ WORLD SPACE FROM HERE, not sprite pixels, and the reason is the TEXTURE. A
        // pattern tiles in the space it is filled in, so filling in sprite pixels would size
        // the 256px granite tile by the sprite's own scale — coarser on a big rock, finer on
        // a small one, and never matching a granite island. Under this transform the tile is
        // 256 WORLD units wide on every rock, exactly as it is on land.
        g.save();
        g.scale(scale, scale);
        g.translate(R - isl.x, R - isl.y);
        const bx = isl.x - R, by = isl.y - R, bw = R * 2;

        // A soft rim, so the silhouette is a mass in the water rather than a shoreline. It
        // is the one soft thing here; the body inside it is flat.
        g.filter = `blur(${Math.max(1.5, (feather / 1.8) * scale)}px)`;
        g.fillStyle = base;
        traceAngularPoly(g, isl.vertices);
        g.fill();
        g.filter = 'none';

        g.save();
        traceAngularPoly(g, isl.vertices);
        g.clip();
        g.fillStyle = base;
        g.fillRect(bx, by, bw, bw);
        const pat = getLandPattern(g, 'sunkenrock', base);
        if (pat) { g.fillStyle = pat; g.fillRect(bx, by, bw, bw); }
        g.restore();

        // ⚠️ DEPTH, AND IT HAS TO BE APPLIED HERE RATHER THAN IN THE BASE COLOUR. Darkening
        // the body hex barely moves the rock, for two compounding reasons: submergedTint
        // LERPS TOWARD THE WATER, so past a point a darker body just buys more water colour,
        // and getLandPattern draws the granite tile RAW over the base — the tile is a light
        // grey, so it adds a fixed lift that no base colour can take back. Measured, the body
        // hex only buys 0.118 luma of screen per luma of body.
        //
        // A source-atop black scales every pixel already laid down — rim, base and tile
        // together — so the texture keeps its RELATIVE contrast while the whole thing sinks.
        // source-atop and not a plain fill because it must leave the transparent margin alone;
        // a normal fill would paint a black square over the water.
        if (SUNKEN_DEPTH < 1) {
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = `rgba(0,0,0,${(1 - SUNKEN_DEPTH).toFixed(3)})`;
            g.fillRect(bx - R, by - R, bw * 2, bw * 2);
            g.globalCompositeOperation = 'source-over';
        }

        // THE EDGE. Stroked AFTER the clip is released, so the outer half of the line is not
        // shaved off — clipping to the outline and stroking it inside that clip is how you
        // get a line that looks half its width and reads soft.
        //
        // The same dark-stroke idiom as every land kind, taken from the style table so the
        // two follow each other, and submerged like everything else here. It works for the
        // opposite reason it does on land: there a dark line separates a LIGHT body from
        // darker water, here the body and the water are close in value (41 against 36) and
        // the line is darker than both, so it is the edge that carries the shape.
        const stEdge = (ISLAND_STYLES[isl.style] || {}).stroke;
        g.strokeStyle = css(submergedTint(hexToRgb(stEdge, [22, 24, 28])));
        g.lineWidth = 2.5;
        g.lineJoin = 'round';
        traceAngularPoly(g, isl.vertices);
        g.stroke();
        g.restore();
        // ⚠️ DO NOT CACHE AN UNTEXTURED BAKE. The tile arrives asynchronously, and a sprite
        // baked before it lands would keep its flat fill for the whole race — the sprite is
        // only rebuilt when the key changes. A key that cannot match forces one more attempt
        // next frame, and it stops as soon as the image is in.
        isl._reefSprite = { canvas: cv, r: R, tint: pat ? ground.join(',') : '__untextured' };
        return;
    }

    g.filter = `blur(${Math.max(1, (feather / 3) * scale)}px)`;
    g.globalAlpha = 0.95;
    g.fillStyle = css(ground);
    traceRoundedPoly(g, pts);
    g.fill();
    g.filter = 'none';
    g.globalAlpha = 1;

    // The rubble and its colonies: seeded, dense, chunky, every clump on its own shadow.
    // COLOUR ARRIVES IN PATCHES — a coarse REEF_PATCH grid is hashed per cell, and a
    // cell is either plain rubble, one accent colony (rose, lavender or purple —
    // the whole cell leans that one way), or a pale sand pocket. That patching is the
    // reference plate's structure: gardens inside a khaki band, never even confetti.
    let seed = 2166136261;
    for (const ch of String(isl.id || 'reef')) seed = ((seed ^ ch.charCodeAt(0)) * 16777619) >>> 0;
    const seed0 = seed;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const cellHash = (cx2, cy2) => {
        let h = (seed0 ^ Math.imul(cx2, 73856093) ^ Math.imul(cy2, 19349663)) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const ring = isl.vertices.map(v => [v.x, v.y]);
    const inRing = (x, y) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    };
    const edgeDist = (x, y) => {
        let d2 = Infinity;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [x1, y1] = ring[j], [x2, y2] = ring[i];
            const dx = x2 - x1, dy = y2 - y1;
            const L2 = dx * dx + dy * dy || 1;
            const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2));
            const qx = x1 + t * dx - x, qy = y1 + t * dy - y;
            if (qx * qx + qy * qy < d2) d2 = qx * qx + qy * qy;
        }
        return Math.sqrt(d2);
    };
    const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const minX = isl.x - isl.radius, minY = isl.y - isl.radius;
    const cells = Math.max(1, Math.ceil((isl.radius * 2) / REEF_SPACING));
    for (let gy = 0; gy < cells; gy++) {
        for (let gx = 0; gx < cells; gx++) {
            const wx = minX + (gx + 0.15 + rand() * 0.7) * REEF_SPACING;
            const wy = minY + (gy + 0.15 + rand() * 0.7) * REEF_SPACING;
            if (!inRing(wx, wy)) continue;
            if (rand() >= smooth(edgeDist(wx, wy) / feather) * 0.95) continue;
            const pc = cellHash(Math.floor(wx / REEF_PATCH), Math.floor(wy / REEF_PATCH));
            let tone;
            const r0 = rand();
            if (pc < 0.06) {
                // Sand pocket: pale floor with worn rubble at its edges.
                tone = r0 < 0.7 ? sand : rubble[2];
            } else if (pc < 0.28) {
                // Colony cell: the whole cell leans ONE accent, cut with mid rubble.
                const acc = accents[Math.floor(pc * 997) % accents.length];
                tone = r0 < 0.68 ? acc : rubble[1 + (r0 < 0.84 ? 0 : 1)];
            } else {
                // Plain band: dark seams, mid mass, pale wear.
                tone = r0 < 0.25 ? rubble[0] : r0 < 0.7 ? rubble[1] : rubble[2];
            }
            const cx = (wx - isl.x + R) * scale, cy = (wy - isl.y + R) * scale;
            const cs = (11 + rand() * 16) * scale;
            const n = 2 + Math.floor(rand() * 3);
            for (let b = 0; b < n; b++) {
                const ex = cx + (rand() - 0.5) * cs, ey = cy + (rand() - 0.5) * cs;
                const rx = cs * (0.3 + rand() * 0.3), ry = cs * (0.22 + rand() * 0.25);
                const rot = rand() * Math.PI;
                g.fillStyle = `rgba(${dark[0]},${dark[1]},${dark[2]},0.47)`;
                g.beginPath();
                g.ellipse(ex + 3.6 * scale, ey + 6 * scale, rx, ry, rot, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},0.92)`;
                g.beginPath();
                g.ellipse(ex, ey, rx, ry, rot, 0, Math.PI * 2);
                g.fill();
            }
        }
    }
    isl._reefSprite = { canvas: cv, r: R, tint: ground.join(',') };
}

// With the bottom layers: over the sand and the weed, under the seabed props (a coral
// HEAD placed on a reef draws over it) and under everything at the surface.
function drawReefs(ctx) {
    if (!state.course || !state.course._hasReefs) return 0;
    // ⚠️ THE KEY IS PER MATERIAL. The bake stamps the sprite with the tint of the ground it
    // used, and this test re-bakes when the water has moved under it. A stone reef bakes
    // from the sunkenrock style, so checking every shape against the coral key would find a
    // permanent mismatch and re-bake a full sprite EVERY FRAME — invisible on screen and
    // ruinous off it.
    const tintKey = submergedTint(REEF_BASE).join(',');
    const stoneKey = sunkenGround().join(',');
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const camX = state.camera.x, camY = state.camera.y;
    let drawn = 0;
    for (const isl of state.course.islands) {
        if (!isl.reef || isl.hidden) continue;
        const limit = viewRadius + isl.radius;
        if ((isl.x - camX) ** 2 + (isl.y - camY) ** 2 > limit ** 2) continue;
        const isStone = isl.style === 'sunkenrock';
        const want = isStone ? stoneKey : tintKey;
        if (!isl._reefSprite || isl._reefSprite.tint !== want) bakeReefSprite(isl);
        const s = isl._reefSprite;
        ctx.save();
        ctx.globalAlpha = isStone ? SUNKEN_ALPHA : REEF_ALPHA;
        ctx.drawImage(s.canvas, isl.x - s.r, isl.y - s.r, s.r * 2, s.r * 2);
        ctx.restore();
        drawn++;
    }
    return drawn;
}

// Called twice per frame, once per plane, and the two calls sit in very different places
// in the render order — see the VEG_STYLES header for why that is the whole point.
//
// 'bottom' runs OVER THE SHOAL SAND (grass grows on the bar) and under everything at the
// surface, like the other seabed layers. 'surface' runs after the water is finished being
// water: the mat is the last thing between the sea and the fleet.
function drawVegetation(ctx, plane) {
    if (!state.course || !state.course._hasVeg) return 0;
    const viewRadius = cullRadius(ctx);
    const camX = state.camera.x, camY = state.camera.y;
    const view = viewBoxWorld(ctx);
    let drawn = 0;
    for (const isl of state.course.islands) {
        if (!isl.veg || isl.hidden) continue;
        const spec = VEG_STYLES[isl.veg];
        if (!spec || spec.plane !== plane) continue;
        const limit = viewRadius + isl.radius;
        if ((isl.x - camX) ** 2 + (isl.y - camY) ** 2 > limit ** 2) continue;
        // Keyed on the tint like the shoal bake: a venue swap or a live palette edit
        // rebakes rather than leaving last venue's light on this one. A surface plant's
        // tones do not depend on the water, so its key is constant and it never rebakes,
        // which is correct — nothing about it changed.
        const tintKey = vegTone(spec.tones[0], spec).join(',');
        if (!isl._vegSprite || isl._vegSprite.tint !== tintKey) bakeVegSprite(isl, spec);
        const s = isl._vegSprite;
        ctx.save();
        ctx.globalAlpha = spec.layerAlpha;
        drawZoneSprite(ctx, s.canvas, isl.x, isl.y, s.r, view);
        ctx.restore();
        drawn++;
    }
    return drawn;
}

// UNDER EVERYTHING ON THE WATER, and that is the whole statement the layer makes. The
// swell, the wakes, the cat's-paws, the wind waves and the nav aids are all things
// happening AT the surface; the bar is beneath it, so it is painted before all of them and
// they run across it unbroken. Draw it with the land instead and it acquires a coastline
// the moment a wake stops at its edge.
// ── DRAW ONLY THE PART OF A BAKED SPRITE THAT IS ON SCREEN ──────────────────
// A baked zone sprite covers a world square, and the biggest ones are enormous: a weed bed
// bakes up to 1786px at one unit per pixel, so a bed whose corner clips the viewport still
// costs a full 1786x1786 composite. Culling by radius only decides WHETHER to draw it; this
// decides HOW MUCH.
//
// Measured on the planted bayou, the weed layers were 51% of the frame — drawVegetation 8.9 ms
// and drawShoals 4.9 ms of a 27 ms frame — on a venue that is 106 weed shapes over 16 mudflats.
// Most of those shapes are larger than the screen.
//
// The visible region is a ROTATED rectangle, because the race camera turns with the boat, so
// the box below is its circumscribed AABB: conservative, cheap, and never clips something the
// player can see. Sub-rect drawImage maps source to destination one-to-one, so nothing moves.
function viewBoxWorld(ctx) {
    const R = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.5 + 8;
    return { x0: state.camera.x - R, y0: state.camera.y - R,
             x1: state.camera.x + R, y1: state.camera.y + R };
}

function drawZoneSprite(ctx, canvas, cx, cy, r, view) {
    const x0 = cx - r, y0 = cy - r, size = r * 2;
    const ix0 = Math.max(x0, view.x0), iy0 = Math.max(y0, view.y0);
    const ix1 = Math.min(x0 + size, view.x1), iy1 = Math.min(y0 + size, view.y1);
    if (ix1 <= ix0 || iy1 <= iy0) return;
    if (ix1 - ix0 >= size && iy1 - iy0 >= size) {   // fully visible: the plain path
        ctx.drawImage(canvas, x0, y0, size, size);
        return;
    }
    const k = canvas.width / size;
    ctx.drawImage(canvas, (ix0 - x0) * k, (iy0 - y0) * k, (ix1 - ix0) * k, (iy1 - iy0) * k,
                  ix0, iy0, ix1 - ix0, iy1 - iy0);
}

// ── WORLD-ANCHORED LAYER TILES ──────────────────────────────────────────────
// A stratum whose content is STATIC IN WORLD SPACE — the seabed zones, the land, the
// forest interior's canopy — does not need repainting every frame; it needs repainting
// when the camera has moved far enough that new world enters the view. So such a stratum
// renders ONCE into an offscreen tile a margin bigger than the view circle, and the frame
// pays one drawImage. On Pearl Lagoon the seabed alone was four full-screen composites a
// frame (shoals 14.5 ms, veg 13.3, reefs 13.2, shallows 7.5 of a 51 ms frame: the venue
// was fill-rate bound on its own static bottom).
//
// The tile is axis-aligned in WORLD space and blitted through the camera transform, so
// camera rotation costs nothing and never exposes an edge — the tile radius covers the
// view circle at any heading. Rebakes happen when the camera nears the margin, when the
// key changes (palette inputs live in the key), or when an image that was still loading
// at bake time lands (`pending` — sprite art loads lazily, and a tile baked before the
// palms arrived would otherwise stay treeless until the next camera rebake).
//
// The bake drives the REAL layer functions against the tile's own context, so there is
// exactly one drawing of each stratum. Their culls keep working untouched: each culls
// around state.camera — which IS the tile centre at bake time — with a radius derived
// from ctx.canvas dims, and the tile being square makes that radius 1.41x its half-side,
// covering the whole tile.
//
// `bake` may return a draw count; a tile that drew nothing skips its per-frame blit
// (a full-screen drawImage is not free, and most venues lack most strata).
// ⚠️ THE COST MODEL THAT SHAPES ALL OF THIS: in the 2d rasterizer, a full-screen
// drawImage is 0.4 ms AXIS-ALIGNED and ~6 ms under the camera's ROTATION — a 15x cliff,
// measured (eval/_blit_matrix.js), source size nearly irrelevant. Rotation is also why
// the live strata were expensive in the first place: every big zone sprite drawn
// through the rotated camera pays the generic path.
//
//   master   world-axis-aligned, view + 400u margin. Baked by the real layer functions,
//            whose sprite blits land axis-aligned = all fast path. Rebakes on camera
//            margin, key change, course change, or a lazily-loaded image landing.
//   frame    ONE drawImage of the master through the LIVE camera transform, bilinear.
//            Exact rotation, exact position, every frame — pixel-equivalent to drawing
//            the original sprites, so motion stays smooth by construction.
//
// ⚠️ THERE IS DELIBERATELY NO SCREEN-ORIENTED CACHE OF THE ROTATED RESULT. One was
// built (derive once per rotation change, translation-only fast blits after) and it
// benched beautifully on a frozen camera — and JUMPED in play, twice, because this
// game's camera rotation NEVER settles: it exponentially tracks a heading that wobbles
// every frame, so any rotation-quantized cache draws the world at a slightly stale
// angle and then snaps it, forever. The owner saw it immediately ("the water jumps
// around"). A per-frame rotated blit is the cheapest thing that is CORRECT here; where
// even that costs more than the live layer it replaces, the adaptive chooser below
// keeps the live path instead. eval/_water_motion.js is the smoothness gate.
const WORLD_TILE_MARGIN = 400;

function ensureWorldTile(tile, ctx, keyPart, bake) {
    const cam = state.camera;
    const rView = Math.ceil(Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.5);
    const key = rView + '|' + keyPart;
    const moved = (cam.x - tile.cx) ** 2 + (cam.y - tile.cy) ** 2
                > (WORLD_TILE_MARGIN - 8) ** 2;
    const landed = tile.pending && tile.pending.length && tile.pending.some(i => i.complete);
    if (tile.course === state.course && tile.key === key && !moved && !landed) return;
    const r = rView + WORLD_TILE_MARGIN, size = r * 2;
    if (!tile.cv || tile.cv.width !== size) {
        tile.cv = document.createElement('canvas');
        tile.cv.width = tile.cv.height = size;
        tile.g = tile.cv.getContext('2d');
    }
    const g = tile.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    g.setTransform(1, 0, 0, 1, r - cam.x, r - cam.y);   // world -> tile
    tile.pending = [];
    window.__wtBakes = (window.__wtBakes || 0) + 1;   // probe hook: rebake thrash shows here
    const drew = bake(g, tile.pending);
    tile.content = drew === undefined || !!drew;
    tile.drawn = typeof drew === 'number' ? drew : -1;
    tile.course = state.course; tile.key = key;
    tile.cx = cam.x; tile.cy = cam.y; tile.r = r;
}

// Called with ctx in WORLD space (the camera transform applied), like the live layers.
// One bilinear drawImage at the live transform — exact and smooth every frame.
function blitWorldTile(tile, ctx) {
    if (!tile.content) return;
    ctx.drawImage(tile.cv, tile.cx - tile.r, tile.cy - tile.r);
}

// ── THE ADAPTIVE CHOOSER ────────────────────────────────────────────────────
// A rotated master blit costs one screen of the rasterizer's generic path (~6-9 ms
// software, ~free on a GPU); the live path costs one screen PER ZONE STACKED OVER THE
// VIEW — Pearl Lagoon sails between five bars of 13-29 screens each, so its seabed
// paints 4-5 screenfuls a frame (40 ms software), while the open ocean's one vast
// painted zone is a single screenful however huge it is. So the decision is that
// number, computed directly each frame: the summed screen-clamped area of the
// stratum's zone shapes overlapping the view (~30 circle tests, free), smoothed, with
// hysteresis. Above the threshold the stratum blits its tile; below it draws live.
// Both modes render the identical picture, so a mid-race switch is invisible.
//
// ⚠️ Estimators that DID NOT survive, so nobody rebuilds them: per-call performance.now
// (canvas commands queue — it times RECORDING, not raster; locked the wrong mode
// everywhere); whole-frame dt A/B (rAF cadence and vsync swamp the signal whenever the
// frame fits the budget); bake-time item counts and summed sprite areas (hollow rings,
// margin-padded sprites and course-clustered content each mispriced some venue).
// ⚠️ Only the SEABED and FLOAT strata are ever tiled — large, dense, mostly-static
// content. Land, canopy and surface props always draw live: cheap on a GPU, and their
// fades and floes are per-frame anyway.
const STRATUM_FILL_ON = 2.6;    // smoothed screenfuls of zone fill to switch to blit
const STRATUM_FILL_OFF = 2.0;   // ...and back to live (hysteresis)

function adaptiveStratum(tile, ctx, keyPart, bakeFn, liveAllFn, liveDriftFn, fillFn) {
    const c = state.course;
    if (tile.calCourse !== c || tile.calKey !== keyPart) {
        tile.calCourse = c; tile.calKey = keyPart;
        tile.mode = 'live'; tile.fillAvg = null;
    }
    const fill = fillFn(ctx);
    tile.fillAvg = tile.fillAvg === null ? fill : tile.fillAvg * 0.95 + fill * 0.05;
    if (tile.mode === 'live' && tile.fillAvg > STRATUM_FILL_ON) tile.mode = 'blit';
    else if (tile.mode === 'blit' && tile.fillAvg < STRATUM_FILL_OFF) tile.mode = 'live';
    if (tile.mode === 'live') { liveAllFn(ctx); return; }
    ensureWorldTile(tile, ctx, keyPart, bakeFn);
    blitWorldTile(tile, ctx);
    if (liveDriftFn) liveDriftFn(ctx);
}

// Screen-clamped area (in screenfuls) of the given zone class overlapping the view.
function zoneViewFill(ctx, isBottomPlane) {
    const c = state.course;
    if (!c || !c.islands) return 0;
    const S = ctx.canvas.width * ctx.canvas.height;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.5;
    const cam = state.camera;
    let fill = 0;
    for (const isl of c.islands) {
        if (isl.hidden) continue;
        let zone;
        if (isl.veg) {
            const spec = VEG_STYLES[isl.veg];
            zone = spec && (spec.plane === 'bottom') === isBottomPlane;
        } else {
            zone = isBottomPlane && (isl.paint || isl.awash || isl.reef);
        }
        if (!zone) continue;
        const lim = viewR + isl.radius;
        if ((isl.x - cam.x) ** 2 + (isl.y - cam.y) ** 2 > lim * lim) continue;
        fill += Math.min(Math.PI * isl.radius * isl.radius, S) / S;
    }
    return fill;
}

// THE SEABED UNDERLAY: shallows, shoals, bottom vegetation, reefs — in their stacking
// order. Every tint in these strata derives from the WATER_CONFIG colors in the key
// (see submergedTint), so the tile rebakes exactly when a component sprite would.
const _seabedTile = {};
function drawSeabedUnderlay(ctx) {
    const c = state.course;
    if (!c) return;
    if (!(c._hasShallows || c._hasShoals || c._hasVeg || c._hasReefs)
        && !(c.props && c.props.length)) return;
    const W = window.WATER_CONFIG || {};
    const key = 'seabed|' + (W.heroColor || '') + '|' + (W.shallowColor || '')
              + '|' + (W.baseColor || '');
    adaptiveStratum(_seabedTile, ctx, key,
        (g, pending) =>
            // Seabed props (coral heads and their kin) are static too; they close out
            // the bottom inside the same tile. Drifters draw live after the blit.
            drawShallows(g) + drawShoals(g)
            + drawVegetation(g, 'bottom') + drawReefs(g)
            + drawProps(g, 'seabed', p => p.motion !== 'drift', pending),
        (g) => {
            drawShallows(g);
            drawShoals(g);
            drawVegetation(g, 'bottom');
            drawReefs(g);
            drawProps(g, 'seabed');
        },
        (g) => drawProps(g, 'seabed', p => p.motion === 'drift'),
        (g) => zoneViewFill(g, true));
}

// THE LAND: island sprites and mask landmasses are static; the mask fills in particular
// were live many-vertex pattern-filled paths every frame (Sockeye Run's whole shoreline).
// Floes drift and spin, and the one-pass document order deliberately lets an authored
// venue tuck a floe behind a headland — so a course carrying ANY floe draws live, exactly
// as before (the arctic). The pending images are the palm (island sprites bake treeless
// before it lands and mark themselves unbaked) and the land texture tiles (mask fills
// fall back to flat color until theirs arrive).
// Land, canopy and surface props draw LIVE — see the chooser's header for why their
// area estimates could not be trusted. The wrappers stay so draw() reads as strata.
function drawIslandsCached(ctx) {
    drawIslands(ctx);
}

// THE CANOPY draws live: canopyAlpha is player-relative and its range (20 hulls)
// exceeds the view radius, so ANY crown that overhangs water can be mid-fade on any
// frame — there is nothing static enough here to be worth a tile.
function drawCanopyCached(ctx) {
    drawProps(ctx, 'canopy');
}

// THE FLOATING STRATUM: surface vegetation (a lily bed, a hyacinth mat) and float props
// are static too; only a drifting prop moves, and it draws live OVER the beds — flotsam
// floats over a mat, which is where a drifting thing belongs.
// SURFACE PROPS: a trunk, a beached log — things the ground holds up. Static, same
// split as the canopy: non-drifters bake, drifters draw live over the tile.
function drawSurfacePropsCached(ctx) {
    drawProps(ctx, 'surface');
}

const _floatTile = {};
function drawFloatStratumCached(ctx) {
    const c = state.course;
    if (!c || (!c._hasVeg && !(c.props && c.props.length))) return;
    adaptiveStratum(_floatTile, ctx, 'float',
        (g, pending) =>
            (drawVegetation(g, 'surface') || 0)
            + drawProps(g, 'float', p => p.motion !== 'drift', pending),
        (g) => { drawVegetation(g, 'surface'); drawProps(g, 'float'); },
        (g) => drawProps(g, 'float', p => p.motion === 'drift'),
        (g) => zoneViewFill(g, false));
}

function drawShoals(ctx) {
    if (!state.course || !state.course._hasShoals) return 0;
    const viewRadius = cullRadius(ctx);
    const camX = state.camera.x, camY = state.camera.y;
    const view = viewBoxWorld(ctx);
    let drawn = 0;
    for (const isl of state.course.islands) {
        // Paint zones are drawShallows' business — a 0-drag bake here would be invisible.
        if (!isl.awash || isl.hidden || isl.paint) continue;
        const limit = viewRadius + isl.radius;
        if ((isl.x - camX) ** 2 + (isl.y - camY) ** 2 > limit ** 2) continue;
        // Per island, because the tint is per MATERIAL now (tan bar vs coral-white bar).
        const tint = shoalTintFor(isl).join(',');
        if (!isl._shoalSprite || isl._shoalSprite.tint !== tint) bakeShoalSprite(isl);
        const s = isl._shoalSprite;
        drawZoneSprite(ctx, s.canvas, isl.x, isl.y, s.r, view);
        drawn++;
    }
    return drawn;
}

// Ice is faceted, not rounded — the style guide asks for literal low-poly
// facets and crisp edges, and the aerial references are all hard planes and
// snapped corners. Straight segments where land gets smoothed curves.
function traceAngularPoly(g, vertices) {
    if (vertices.length < 3) return;
    g.beginPath();
    g.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) g.lineTo(vertices[i].x, vertices[i].y);
    g.closePath();
}

function traceRoundedPoly(g, vertices) {
    if (vertices.length < 3) return;
    g.beginPath();
    const last = vertices[vertices.length - 1];
    const first = vertices[0];
    let midX = (last.x + first.x) / 2;
    let midY = (last.y + first.y) / 2;
    g.moveTo(midX, midY);
    for (let i = 0; i < vertices.length; i++) {
        const p = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        midX = (p.x + next.x) / 2;
        midY = (p.y + next.y) / 2;
        g.quadraticCurveTo(p.x, p.y, midX, midY);
    }
    g.closePath();
}

// Bake one island (glow, body, veg, rocks, trees) into an offscreen sprite.
// Islands are static, so this runs ONCE per island per race. The live path
// previously paid a 30px shadowBlur glow, three curve fills, and double
// ctx.filter tree draws PER FRAME — ablation showed drawIslands alone took the
// swamp from 58 to 12 FPS.
//
// Floes now SPIN, which they could not before. Their sprite is therefore baked
// in the floe's own local frame (origin at its centre, spin zero) and rotated at
// draw time; baking world-space geometry would freeze whatever heading the floe
// happened to hold at bake time and then rotate it a second time on screen.
// The drawn outline is the art shape, not the convex collider.
function bakeIslandSprite(isl) {
    const st = ISLAND_STYLES[isl.style] || ISLAND_STYLES.tropical;
    const isFloe = !!isl.isFloe;
    const VERTS = isFloe ? isl.localArt : isl.vertices;
    const VEG = isFloe ? isl.localVeg : isl.vegVertices;
    const ox = isFloe ? 0 : isl.x, oy = isFloe ? 0 : isl.y;
    // Karst joins ice and granite on the angular tracer: limestone weathers into fissures
    // and sharp ribs, and the rounded tracer would draw it as a sandbank.
    //
    // Coral limestone joins them on the same argument, one island over: makatea is old reef
    // lifted into the air and etched by rain into pinnacles and knife-edged pits, and it is
    // the sharpest natural rock in the game. It also has the most to lose from the rounded
    // tracer of anything here — it shares every shoreline with `coralsand`, so a rounded
    // reef shelf reads as one more sandbar and the venue's hard rim disappears into its own
    // beach. Note this is the ONLY tropical kind on the angular list: `coralsand` and
    // `tropicshoal` stay rounded, which is what makes the rim legible.
    //
    // `coastalscrub`, `tropicscrub` and every other sward stay rounded too — a sward drapes.
    const trace = (isl.style === 'ice' || isl.style === 'granite' || isl.style === 'karst'
                   || isl.style === 'coralrock')
        ? traceAngularPoly : traceRoundedPoly;

    let maxR = isl.radius;
    for (const v of VERTS) {
        const d = Math.sqrt((v.x - ox) ** 2 + (v.y - oy) ** 2);
        if (d > maxR) maxR = d;
    }
    // Glow blur + tree canopy overhang margin; ice needs room for the
    // underwater shelf ring (vertices scaled ~1.3)
    const spriteR = isl.style === 'ice' ? maxR * 1.35 + 60 : maxR + 100;
    // Cap texture size; big islands render slightly downscaled (soft look anyway)
    const scale = Math.min(1, 900 / spriteR);
    const size = Math.max(8, Math.ceil(spriteR * 2 * scale));

    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.scale(scale, scale);
    g.translate(spriteR - ox, spriteR - oy); // shape coords -> sprite space

    if (isl.style === 'ice') {
        // Underwater ice shelf: the drowned shoulder that glows pale turquoise
        // around a real berg — the signature of every aerial reference. Two
        // translucent rings scaled out from the outline.
        const ring = (k) => VERTS.map(v => ({ x: ox + (v.x - ox) * k, y: oy + (v.y - oy) * k }));
        g.save();
        g.fillStyle = 'rgba(74, 144, 200, 0.45)';
        trace(g, ring(1.28));
        g.fill();
        g.fillStyle = 'rgba(120, 180, 226, 0.42)';
        trace(g, ring(1.12));
        g.fill();
        g.restore();
    } else if (window.WATER_CONFIG && window.WATER_CONFIG.shorelineGlowSize > 0) {
        // Shoreline Glow
        g.save();
        g.shadowColor = window.WATER_CONFIG.shorelineColor || '#4ade80';
        g.shadowBlur = window.WATER_CONFIG.shorelineGlowSize * 20;
        g.fillStyle = window.WATER_CONFIG.shorelineColor || '#4ade80';
        g.globalAlpha = window.WATER_CONFIG.shorelineGlowOpacity || 0.5;
        trace(g, VERTS);
        g.fill();
        g.restore();
    }

    // Body
    g.strokeStyle = st.stroke;
    g.lineWidth = 2;
    g.fillStyle = st.body;
    trace(g, VERTS);
    g.stroke();
    g.fill();

    // Vegetation (snow cap on ice)
    g.fillStyle = st.veg;
    trace(g, VEG);
    g.fill();

    // Ice facets: angular translucent blue planes radiating from the centre —
    // the low-poly faceting the style guide asks for, and what reads as relief
    // on the aerial references.
    // Granite: a full fan of flat-shaded faces from the summit to every edge,
    // so the mountain reads as low-poly relief rather than a grey blob. Four
    // flat tones, hard edges, no gradients — the reference art's language.
    if ((isl.style === 'granite' || isl.style === 'karst') && isl.facets && isl.facets.length) {
        const GREY = ['#2a323d', '#39424f', '#4b5563', '#5d6775'];
        for (const f of isl.facets) {
            const v1 = VERTS[f.i % VERTS.length];
            const v2 = VERTS[(f.i + 1) % VERTS.length];
            const step = Math.min(3, Math.max(0, Math.floor((f.lit + 1) * 2)));
            g.fillStyle = GREY[step];
            g.beginPath();
            g.moveTo(ox, oy);              // summit
            g.lineTo(v1.x, v1.y);
            g.lineTo(v2.x, v2.y);
            g.closePath();
            g.fill();
        }
        // Snow catching on the highest faces
        g.fillStyle = 'rgba(226, 240, 252, 0.9)';
        trace(g, VEG);
        g.fill();
    }

    if (isl.style === 'ice' && isl.facets && isl.facets.length) {
        for (const f of isl.facets) {
            const v1 = VERTS[f.i % VERTS.length];
            const v2 = VERTS[(f.i + 1) % VERTS.length];
            g.fillStyle = f.shade < 0.5 ? 'rgba(122, 176, 222, 0.4)' : 'rgba(78, 138, 194, 0.35)';
            g.beginPath();
            g.moveTo(ox + (v1.x - ox) * f.depth, oy + (v1.y - oy) * f.depth);
            g.lineTo(v1.x, v1.y);
            g.lineTo(v2.x, v2.y);
            g.closePath();
            g.fill();
        }
    }

    // Pressure cracks (ice only): thin glacial-blue fractures. Clipped to the
    // outline — a crack is a fracture IN the ice, so none of it may hang in open
    // water. Only this block is clipped, not the whole sprite: land islands let
    // their tree canopies overhang on purpose, and the sprite reserves margin
    // for exactly that.
    if (isl.cracks && isl.cracks.length) {
        g.save();
        trace(g, VERTS); g.clip();
        g.strokeStyle = 'rgba(64, 125, 180, 0.7)';
        g.lineWidth = 3;
        g.lineCap = 'round';
        for (const cr of isl.cracks) {
            g.beginPath();
            g.moveTo(ox + cr.ax, oy + cr.ay);
            g.quadraticCurveTo(ox + cr.mx, oy + cr.my, ox + cr.bx, oy + cr.by);
            g.stroke();
        }
        g.restore();
    }

    // Rocks
    if (isl.rocks) {
        g.fillStyle = st.rock;
        for (const rock of isl.rocks) {
            g.beginPath();
            g.arc(rock.x, rock.y, rock.size, 0, Math.PI * 2);
            g.fill();
            g.save();
            g.clip();
            g.fillStyle = 'rgba(0,0,0,0.1)';
            g.beginPath();
            g.arc(rock.x - rock.size * 0.2, rock.y + rock.size * 0.2, rock.size * 0.8, 0, Math.PI * 2);
            g.fill();
            g.restore();
            g.fillStyle = st.rock;
        }
    }

    // Trees
    if (st.trees && palmImg.complete && palmImg.naturalWidth > 0) {
        for (const t of isl.trees) {
            const tSize = t.size * 4.0;
            g.save();
            g.translate(t.x + 5, t.y + 5);
            g.rotate(t.rotation || 0);
            g.globalAlpha = 0.2;
            g.filter = "brightness(0)";
            g.drawImage(palmImg, -tSize / 2, -tSize / 2, tSize, tSize);
            g.restore();
            g.save();
            g.translate(t.x, t.y);
            g.rotate(t.rotation || 0);
            g.drawImage(palmImg, -tSize / 2, -tSize / 2, tSize, tSize);
            g.restore();
        }
    }

    isl._sprite = { canvas: c, r: spriteR, baked: palmImg.complete && palmImg.naturalWidth > 0 };
}

// `which`: 'land' for static geometry, 'floe' for drifting ice, omitted for all.
// The two are drawn in separate passes so the nav aids can sit BETWEEN them —
// ladder lines and laylines are paint on the water, and ice floats over paint.
function drawIslands(ctx) {
    if (!state.course || !state.course.islands) return 0;

    // Viewport Culling
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const camX = state.camera.x;
    const camY = state.camera.y;

    let drawn = 0;
    for (const isl of state.course.islands) {
        // Invisible colliders: the river banks draw as one continuous mass in
        // drawRiverShore instead. Awash shapes were already painted UNDER the water by
        // drawShoals — this pass is the world standing above it. A reef collides like
        // land but LIVES on the bottom (drawReefs painted it with the water layers),
        // so drawing it here would stand it up out of the sea as a sand island.
        //
        // ⚠️ THE TEST IS `hidden`, AND IT USED TO BE `isBank`. Those are two different
        // questions and the flag names only one of them: isBank is `!nav` — "keep this
        // out of the visibility graph" — while `hidden` is "do not draw". They agreed
        // for as long as `bank` was the only unrouted DRAWN kind (it is hidden too, so
        // banks are still skipped here), and stopped agreeing the moment the cove got
        // its lane: inland scenery no boat can reach, deliberately unrouted, and
        // deliberately visible. Asking isBank made all three of Lighthouse Cove's
        // village lanes invisible. Anything unrouted that should stay off the screen
        // says so with `hidden`.
        if (isl.hidden || isl.awash || isl.reef) continue;
        const distSq = (isl.x - camX) ** 2 + (isl.y - camY) ** 2;
        const limit = viewRadius + isl.radius;
        if (distSq > limit ** 2) continue;

        // Mask landmasses draw as direct paths, never baked sprites, for two
        // reasons. They are huge — the main one has a 9388-unit radius, far past
        // bakeIslandSprite's 900px cap, so it would come back a blurred postage
        // stamp. And their rings are KEYHOLED: the trace walks into the sound and
        // back out, so the water is a hole in the polygon. Canvas fills nonzero by
        // default, which fills that hole solid and paints the sea white — this
        // has to be 'evenodd'.
        if (isl.fromMask) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(isl.vertices[0].x, isl.vertices[0].y);
            for (let i = 1; i < isl.vertices.length; i++) ctx.lineTo(isl.vertices[i].x, isl.vertices[i].y);
            ctx.closePath();
            const st = ISLAND_STYLES[isl.style] || ISLAND_STYLES.ice;
            // A style with a LAND_TEXTURES entry gets the tiling surface; everything
            // else stays a flat fill. This is the FIXED-land path, so a floe never
            // reaches it — bergs keep their faceted sprite and underwater shelf.
            ctx.fillStyle = getLandPattern(ctx, isl.style, st.body) || st.body;
            ctx.fill('evenodd');
            ctx.strokeStyle = st.stroke;
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.restore();
                drawn++;
            continue;
        }

        // Bake lazily; rebake once the palm image finishes loading. Floes carry
        // no trees and their sprite is spin-canonical, so they never rebake —
        // a rebake would capture their current heading and double it on screen.
        if (!isl._sprite || (!isl.isFloe && !isl._sprite.baked && palmImg.complete && palmImg.naturalWidth > 0)) bakeIslandSprite(isl);
        const s = isl._sprite;
        if (isl.isFloe) {
            ctx.save();
            ctx.translate(isl.x, isl.y);
            ctx.rotate(isl.spin);
            ctx.drawImage(s.canvas, -s.r, -s.r, s.r * 2, s.r * 2);
            ctx.restore();
        } else {
            ctx.drawImage(s.canvas, isl.x - s.r, isl.y - s.r, s.r * 2, s.r * 2);
        }
        drawn++;
    }
    return drawn;
}






// Init
// ─── COURSE ROUTE ────────────────────────────────────────────────────────────
//
// A course is MARKS (physical objects) plus a ROUTE (ordered passage
// instructions). `route[n]` describes leg n: which marks bound it, which way a
// boat must cross, and whether that crossing finishes the race.
//
// This exists to replace `leg % 2 !== 0 ? [2,3] : [0,1]`, which was repeated at
// about a dozen sites. That arithmetic IS a windward-leeward course encoded as a
// formula: marks [0,1] are the start/leeward line and [2,3] the windward gate,
// forever. No other course shape can satisfy it — which is why `islandRound` has
// to park two unused marks at [2] and [3] purely so the formula does not throw,
// and why it once drew a phantom gate at them.
//
// Route entry:
//   { kind: 'line'|'gate', marks: [i, j], dir: +1|-1, beat: bool, finish?: bool }
//   { kind: 'round', side: 'starboard'|'port' }              (mark is course.roundMark)
//
// `dir` is the sign of the crossing against the gate normal n = (dy, -dx), which
// is why mark ORDER within a pair is load-bearing and not cosmetic.
