// VENUE EDITOR — the editing app.
//
// The working object is the DOCUMENT. Land is vector polygons, so a shape is a
// thing you can select, drag, sculpt and scale; that is the whole reason the mask
// stopped being the source of truth.
//
// Two render paths, deliberately:
//   - While dragging, the document is drawn directly. Fast, no recompile.
//   - On COMMIT (mouse up), the document is installed and the game rebuilds the
//     course from it, so the checks and the floe layout reflect exactly what would
//     be raced rather than a second interpretation of the document.
//
// Undo is SNAPSHOT, not command pattern. The document is ~40 KB, so a hundred
// levels costs about 4 MB, and snapshots cannot get the object-lifetime bugs that
// command-based undo is known for (undoing the delete of a thing that was moved
// first). A drag coalesces into ONE entry on mouse-up, which is the thing both
// approaches need anyway.
(function () {

const clone = (o) => JSON.parse(JSON.stringify(o));
const $ = (id) => document.getElementById(id);

// ── App state ───────────────────────────────────────────────────────────────
let doc = null;            // working document — the thing being edited
let savedJSON = null;      // last saved state, for the dirty flag
let history = [], histIdx = -1;
let course = null;         // last full recompile (what the game built)
let floes = [];            // context only; regenerated per seed, not authored
let findings = [];
let selFinding = -1;

// MODE is what you are editing; only that type is interactive, so a click can never
// grab the wrong kind of thing. `tool` is derived from it so the render code keeps its
// existing vocabulary.
let mode = 'map';             // map (the Course) | shape | marks | route | boundary | wind | gust | current | traffic | venue
let sub = 'drag';             // the active TOOL: drag | direct | place | sculpt | smooth | roughen | simplify | measure
let drawing = false;          // shape mode, mid-draw
let tool = 'select';
// The four BRUSHES. They share a reach, a falloff and a gesture, and they act on whatever
// outline falls under the disc — so they are grouped once here rather than enumerated at
// each of the six places that ask "is a brush armed?".
const isBrush = (t) => t === 'sculpt' || t === 'smooth' || t === 'roughen' || t === 'simplify';
// EVERY MODE EDITS ITS OWN OUTLINES. There is no separate Vertices mode: selecting a thing
// shows its vertices, which is both fewer modes and a better rule — visible means grabbable,
// and nothing else is either.
function syncTool() {
    tool = sub === 'measure'   ? 'measure'
         : isBrush(sub)        ? sub            // a brush is a brush on whatever layer you are on
         : sub === 'direct'    ? 'direct'       // ...and so is the vertex arrow
         : sub === 'place'     ? 'place'
         : mode === 'shape'    ? (drawing ? 'draw' : 'select')
         : mode === 'marks'    ? 'mark'
         : mode === 'boundary' ? 'bcircle'
         : mode;
}
const NOHIT = { shape: null, mark: -1, line: -1, vert: -1, bvert: -1, wvert: -1, rcentre: -1, rring: -1 };
let sel = Object.assign({}, NOHIT);
let hover = Object.assign({}, NOHIT);
let hoverRoute = -1;           // route row under the cursor, highlighted on the map
let brush = 260;              // brush REACH, in world units — [ and ]
let detail = 120;             // the scale a brush works AT — ⇧[ and ⇧]. Roughen treats it as
                              // the edge length to subdivide down to; Simplify as how far a
                              // point may sit off its neighbours' line before it is worth keeping.
let selWind = -1;              // selected wind region
let selCur = -1;               // selected current region
let selGust = -1;              // selected gust region
let selRapids = -1;            // selected rapids region
let selLine = -1;              // selected gate / line
// Multi-selection of vertices, shared by every mode that owns vertices: land in Vertices
// mode, the arena in Arena mode, a region's outline in Wind mode. One implementation, so
// marquee-select and align work the same everywhere.
let selRoute = -1;             // selected route entry, for naming
let vsel = [];                 // refs, in click order — the FIRST is the align anchor
// TWO LEVELS OF SELECTION, the split every vector editor settles on: Select (V) picks whole
// polygons, Direct (A) picks their vertices. They are two TOOLS, not two modes — the layer
// list already says what KIND of thing you are editing, and stacking a second modal axis on
// top of it would give a two-dimensional mode space to keep in your head.
// `osel` is the object-level selection and holds many; `sel`/`selWind`/`selCur` are
// the older single-object slots the inspectors read, kept in step by syncSelFromOsel.
let osel = [];                 // [{kind:'land',id} | {kind:'ice'|'wind'|'current'|'gust',i} | {kind:'arena'}]

// ── THE REGION KINDS ────────────────────────────────────────────────────────
// Three layers are the same object: a polygon with a soft edge and some numbers hung off
// it. They differ only in which list they live in, which single-selection slot the
// inspector reads, and what the numbers mean. Every VERB is shared — draw, marquee, Select,
// Direct, the four brushes, the booleans, duplicate, delete, rotate, scale.
//
// Before this table each of those verbs carried `mode === 'wind' ? … : …`, so adding a
// third kind would have meant a third arm in about thirty places and thirty chances to
// miss one. The mode string IS the kind, so one lookup replaces every branch.
const REGION = {
    wind:    { list: () => (doc && doc.wind && doc.wind.regions) || [],
               owner: () => (doc.wind || (doc.wind = {})),
               sel: () => selWind,  setSel: (v) => { selWind = v; } },
    current: { list: () => (doc && doc.current && doc.current.regions) || [],
               owner: () => (doc.current || (doc.current = {})),
               sel: () => selCur,   setSel: (v) => { selCur = v; } },
    gust:    { list: () => (doc && doc.gusts && doc.gusts.regions) || [],
               owner: () => (doc.gusts || (doc.gusts = {})),
               sel: () => selGust,  setSel: (v) => { selGust = v; } },
    rapids:  { list: () => (doc && doc.rapids && doc.rapids.regions) || [],
               owner: () => (doc.rapids || (doc.rapids = {})),
               sel: () => selRapids, setSel: (v) => { selRapids = v; } }
};
// ⚠️ `list` and `sel` READ ONLY. `owner` is the write path and creates the container, which
// is right for it and wrong for them: an accessor that created `regions = []` on load
// marked pristine documents unsaved, twice, and a dirty flag that can lie means nothing.
const isRegionMode = (m) => !!REGION[m];
// Props: point objects like marks, not polygons like everything above. Same read-only
// rule as REGION's `list`: the array is created on the WRITE path (placing the first
// prop), never here — an accessor that created `doc.props = []` on load would mark
// pristine documents unsaved.
let selProp = -1;
let selProps = [];              // multi-select: row indices; selProp stays the primary
const dprops = () => (doc && doc.props) || [];
// Traffic: vessels on rails. Like props, these are discrete objects with their own
// inspector rather than polygons, so they carry their own selection instead of joining
// `osel` — but unlike a prop a vessel owns a PATH, so a second index says which of its
// points is in hand. Same read-only rule again: `doc.traffic` is created on the write path.
let selTraf = -1;               // which vessel
let selTV = -1;                 // which of its path points, -1 for none
// The kind the NEXT lane gets, carried from the last one whose kind was set. Drawing three
// motorboat routes should not mean picking "motorboat" three times.
let trafficKind = 'bay-cove-cargo-ship';
// Set while Draw is EXTENDING an existing lane rather than starting a new one: which
// vessel, and which end is growing. `pending` holds only the new points either way.
let extendLane = null;
// Where the scrubber is, in seconds from the START GUN — negative during the prestart, the
// same clock `firstSpawn` is authored against. Null means "not scrubbing", which is how the
// layer looks before the slider is touched.
let trafficT = null;
const dtraffic = () => (doc && doc.traffic) || [];
// One place a vessel is born, so the list button and the Draw tool cannot drift apart on
// what a new one carries.
function newTrafficEntry(path) {
    const kinds = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    // The same gate the inspector applies: a vessel needs a measured hull.
    const vessels = Object.keys(kinds).filter(k => Array.isArray(kinds[k].hull));
    const kind = vessels.includes(trafficKind) ? trafficKind
               : (vessels.find(k => /cargo-ship$/.test(k)) || vessels[0] || Object.keys(kinds)[0]);
    const arr = dtrafficW();
    let n = 1;
    while (arr.some(x => x.id === `ship-${n}`)) n++;
    // THE SPEED LIVES ON THE FIRST WAYPOINT, not on the entry. Every point inherits the last
    // one named before it, so one speed on point 0 carries the whole lane — and the entry
    // needs no speed field of its own competing to say the same thing.
    if (path.length && !isFinite(tpSpeed(path[0]))) {
        if (Array.isArray(path[0])) path[0][2] = 4; else path[0].speed = 4;
    }
    return { id: `ship-${n}`, kind, path, firstSpawn: 0, end: 'despawn' };
}

// What the CURVE would point the hull at this waypoint, so the heading field can show it as
// a placeholder — the field then reads as an override of something visible rather than as a
// blank that might mean north.
function trafficHeadingAt(v, k) {
    const c = trafficCurve(v);
    if (!c || !c.knotS || c.knotS[k] == null) return 0;
    // Against a copy with the authored headings stripped, or the placeholder would just
    // echo whatever is already typed in the box.
    const bare = window.Traffic.compilePath({
        speed: v.speed,
        path: v.path.map(p => Array.isArray(p) ? p.slice(0, 3)
                                              : { x: p.x, y: p.y, speed: p.speed, dwell: p.dwell })
    });
    return bare ? bare.atArc(bare.knotS[k]).heading : 0;
}

// The window a race actually occupies: the prestart the document authors (or the game's own
// 30 s default) through to the limit it will be sailed under. Scrubbing outside that answers
// a question nobody is asking.
function raceWindow() {
    const c = (doc && doc.course) || {};
    const start = c.startTime != null ? c.startTime : 30;
    let limit = c.cutoff;
    if (limit == null) { try { limit = window.VenueDoc.compile(doc).cutoffAuto; } catch (e) { limit = 0; } }
    return { from: -start, to: Math.max(60, limit || 300) };
}
const mmssSigned = (sec) => {
    const n = Math.abs(Math.round(sec));
    return `${sec < 0 ? '−' : ''}${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
};

// A NAME is a label, never the id. Renaming must not be able to break a reference, which is
// the same reason every other object here carries `name` beside an untouched `id`.
const trafficLabel = (v) => (v && (v.name || v.id)) || 'vessel';
const dtrafficW = () => { if (!doc.traffic) doc.traffic = []; return doc.traffic; };
// A path point is [x, y] or {x, y, speed}. Both spellings are legal in the document — one
// speed throughout should not have to be written as objects — so every reader goes through
// these rather than assuming a shape.
const tpx = (p) => (Array.isArray(p) ? p[0] : p.x);
const tpy = (p) => (Array.isArray(p) ? p[1] : p.y);
const tpSpeed = (p) => (Array.isArray(p) ? p[2] : p.speed);
const tpSet = (p, x, y) => { if (Array.isArray(p)) { p[0] = x; p[1] = y; } else { p.x = x; p.y = y; } };
// The speed IN FORCE at point i: its own if it names one, else the last named before it,
// else the entry's. This is the rule compilePath applies, restated here so the editor
// shows what the game will actually sail rather than a blank.
function tpSpeedAt(v, i) {
    for (let k = i; k >= 0; k--) { const s = tpSpeed(v.path[k]); if (isFinite(s)) return s; }
    return isFinite(v.speed) ? v.speed : 4;
}
// One anchor/cursor pair serves every list: the ANCHOR is where a range grows from
// (set by a plain click or a plain arrow move), the CURSOR is the row the last gesture
// landed on. Both are DISPLAY-ORDER row indices for whatever list is active, and both
// reset when the layer changes — a range must never span two different lists' numbering.
let listAnchor = -1, listCursor = -1;
const regsOf    = (k) => REGION[k].list();
const regSel    = (k) => REGION[k].sel();
const setRegSel = (k, v) => REGION[k].setSel(v);
const clearRegSel = () => { selWind = -1; selCur = -1; selGust = -1; selRapids = -1; };
// The region this layer currently has selected, or null. The three modes never overlap, so
// "the selected region" is unambiguous whenever it is asked.
const activeReg = () => (isRegionMode(mode) && regSel(mode) >= 0) ? regsOf(mode)[regSel(mode)] : null;
let marquee = null;
let showField = false;         // wind-field preview
let showCurField = false;      // current-field preview
// The ice layout is chosen per RACE by the game, so it is a property of the preview and
// not of the venue. It used to be a bare "Seed" number box with no stated meaning.
let previewSeed = 90210;

let view = { x: 0, y: 0, scale: 0.1 };
let drag = null;
let measure = null;
// A J111 to scale: 11 m long, 3.4 m beam, which is 55 x 17 world units. Dropped on the
// map so a designer can see whether a gap, a gate or a rounding actually fits a boat,
// rather than converting metres in their head.
const BOAT_L = 55, BOAT_B = 17;
let boatProbe = null;          // { x, y, heading }

const cv = $('schematic');
const ctx = cv.getContext('2d');

// The venue's representative wind direction. DERIVED from the regions (there is no base
// wind any more), via the compiler, so the editor and the game cannot disagree about it.
function windBase() {
    // state.wind.baseDirection is what initCourse set from the compiler's derived value,
    // so reading it keeps the editor and the game on the same number by construction.
    if (state && state.wind && typeof state.wind.baseDirection === 'number') return state.wind.baseDirection;
    return 0;
}

// ── Bearings ────────────────────────────────────────────────────────────────
// The game's heading convention already agrees with the real world: 0 is north, north is
// up the screen, and it increases clockwise (forward = sin, -cos). What did NOT agree was
// the presentation — the editor showed the raw radians as a signed angle, so a
// south-westerly read as "-145°" instead of the 215° anyone would say out loud.
//
// A WIND is named by where it comes FROM, which is exactly what `wind.direction` already
// holds. A CURRENT is named by where it goes TO, which is what a region's `direction`
// holds. Both are stated in the panels rather than left to be inferred.
const degOf = (rad) => Math.round(((rad * 180 / Math.PI) % 360 + 360) % 360) % 360;
const radOf = (deg) => (((deg % 360) + 360) % 360) * Math.PI / 180;
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compassOf = (rad) => COMPASS[Math.round(degOf(rad) / 22.5) % 16];

// ── Units ───────────────────────────────────────────────────────────────────
// 5 world units = 1 metre, and 55u = 11m = one boat length (a J111 — the game's 165u
// RRS zone is three of them). Panels speak metres; world units survive only in the
// cursor HUD, where they are the coordinates you would type into a document.
const U_PER_M = window.VenueDoc.U_PER_M;
const U_PER_BL = 55;
const uToM = (u) => u / U_PER_M;
const mToU = (m) => m * U_PER_M;
const fmtM = (u) => (Math.abs(u) >= mToU(1000) ? `${(uToM(u) / 1000).toFixed(2)} km` : `${Math.round(uToM(u))} m`);
const fmtBL = (u) => `${(u / U_PER_BL).toFixed(1)} BL`;

// ── Geometry helpers ────────────────────────────────────────────────────────
const W = () => cv.clientWidth, H = () => cv.clientHeight;
const toS = (x, y) => ({ x: (x - view.x) * view.scale + W() / 2, y: (y - view.y) * view.scale + H() / 2 });
const toW = (sx, sy) => ({ x: (sx - W() / 2) / view.scale + view.x, y: (sy - H() / 2) / view.scale + view.y });

function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
}
const shapeCentroid = (l) => {
    let x = 0, y = 0;
    for (const p of l.outer) { x += p[0]; y += p[1]; }
    return { x: x / l.outer.length, y: y / l.outer.length };
};
// Baked centroid/radius feed placement, wind shadow and pathfinding, so they are
// recomputed whenever a shape's geometry changes rather than left stale.
function rebake(l) {
    const c = shapeCentroid(l);
    l.c = [c.x, c.y];
    l.r = Math.max.apply(null, l.outer.map(p => Math.hypot(p[0] - c.x, p[1] - c.y)));
}
const eachRing = (l) => [l.outer].concat(l.holes || []);

// The types ISLAND_STYLES can already draw. `style` picks the look, `cls` the
// behaviour class — granite grounds you, everything else is currently soft. Adding a
// type here is only useful once ISLAND_STYLES has an entry for it.
// What a shape can BE. One row per kind in VenueDoc.KINDS, in the order they read as a
// list rather than the order they happen to be declared: the ordinary land first, the odd
// ones last. The behaviour is NOT restated here — it comes from the shared table, so this
// is a label and a swatch and nothing that could disagree with the game.
// ALPHABETICAL, AND SORTED BELOW RATHER THAN BY HAND. Eight items was already past the
// point where a reader scans for the one they want rather than reading the list; it is
// twenty-one now, and there is no other order here that means anything — the table this
// labels already carries the behaviour, so any grouping would be a second, weaker
// statement of it.
//
// Hand-ordering did not survive contact with people adding rows, which is the whole
// argument for deriving it: `Swamp Grass` had already slipped above `Seagrass` before the
// bayou appended seven more materials to the end. So the literal below is written in
// whatever order is convenient to add to, and the sort right after it is what the two
// pickers actually see.
const LAND_TYPES = [
    { kind: 'bank',      label: 'Bank',       swatch: '#6b7280' },
    { kind: 'coralreef', label: 'Coral Reef', swatch: '#8a8468' },
    // Lighthouse Cove's two grounds. Both swatches track ISLAND_STYLES.<kind>.body, so the
    // chip is the material — and both bodies are still their tile's SPEC mean, so these move
    // when the art is ingested and the body is reset to the delivered mean.
    { kind: 'coastalrock',  label: 'Coastal Rock',  swatch: '#a19481' },
    { kind: 'lane',         label: 'Lane',          swatch: '#cac2ad' },
    { kind: 'coastalscrub', label: 'Coastal Scrub', swatch: '#a3a745' },
    { kind: 'floe',    label: 'Floe',    swatch: '#7dd3fc' },
    { kind: 'granite', label: 'Granite', swatch: '#8d8d8d' },
    // Swatch tracks ISLAND_STYLES.karst.body, so the chip is the material.
    { kind: 'karst',   label: 'Dark Karst Limestone', swatch: '#5d6068' },
    // The same limestone, drowned — a hard shape with no coastline and no surf. Swatch is
    // ISLAND_STYLES.sunkenrock.body, i.e. the rock IN AIR, matching every other chip here;
    // the game shows it through the water column, so it draws darker than the chip.
    { kind: 'sunkenrock', label: 'Submerged Rock', swatch: '#565f6f' },
    // The jungle on top of the limestone, and the FIRST Glowtide ground on the
    // [VENUE] [TERRAIN] label convention Sockeye Run introduced — the two rows above predate
    // it and keep their names, since the sort is by label and renaming them would move where
    // a designer has learned to find them. Swatch tracks ISLAND_STYLES.jungle.body, and that
    // is now the DELIVERED tile mean (2026-08-25), 13 L* darker than the chip this row shipped
    // with — so the picker went from a mid khaki to a deep leaf-litter brown, which is the
    // material.
    { kind: 'jungle',  label: 'Glowtide Jungle Floor', swatch: '#413715' },
    { kind: 'reed',    label: 'Grass',   swatch: '#7aaa1d' },
    { kind: 'ice',     label: 'Ice',     swatch: '#e8edf5' },
    { kind: 'redrock', label: 'Redrock', swatch: '#c2703e' },
    // Redrock Reservoir's two new grounds, on the [VENUE] [TERRAIN] label convention so
    // the label sort files them beside 'Redrock'. Swatches track ISLAND_STYLES.<kind>.body
    // and are SPEC means until the tiles are delivered — re-chip both on ingest.
    { kind: 'slickrock',  label: 'Redrock Slickrock',   swatch: '#E3D0AF' },
    { kind: 'desertsand', label: 'Redrock Desert Sand', swatch: '#D2996B' },
    // Stillwater Lake's three grounds. Swatches track ISLAND_STYLES.<kind>.body and are still
    // the tile SPEC means, so they move when the art is ingested and the bodies are reset.
    // ⚠️ "Glacial Granite" is NOT "Granite" — one is ice-SMOOTHED northern shelf rock, the
    // other Glacier Sound's fractured mountainside. They sort adjacent in this list, so the
    // labels are the only thing keeping them apart for a designer.
    { kind: 'forestfloor', label: 'Forest Floor',    swatch: '#7C633D' },
    { kind: 'lakesand',    label: 'Lake Sand',       swatch: '#B7A487' },
    { kind: 'gneiss',      label: 'Glacial Granite', swatch: '#807A7F' },
    // ── SOCKEYE RUN'S FOUR GROUNDS ──────────────────────────────────────────
    // Swatches track ISLAND_STYLES.<kind>.body and these four are already the DELIVERED tile
    // means, not spec means — the art landed before the labels did.
    //
    // ⚠️ THESE ARE THE FIRST LABELS ON THE [VENUE] [TERRAIN] CONVENTION, and the reason is
    // two rows above: "Glacial Granite" already had to be told apart from "Granite" by label
    // alone, and this venue adds a THIRD granite. Unprefixed names stopped scaling at two.
    // Because the sort below is BY LABEL, a venue prefix also groups every one of a venue's
    // grounds together in the picker for free — no grouping code, just the name. The KIND
    // stays bare (`outcrop`, not `river-outcrop`) because every venue doc on disk names kinds
    // and renaming them would need a document migration; this is the `isle` -> "Coastal Sand"
    // move again, label-only.
    { kind: 'cobble',      label: 'River Cobble',   swatch: '#6E6B65' },
    { kind: 'meadow',      label: 'River Meadow',   swatch: '#929738' },
    { kind: 'outcrop',     label: 'River Granite',  swatch: '#999C9E' },
    { kind: 'humus',       label: 'River Humus',    swatch: '#352B19' },
    // Sorts directly under River Cobble, which is what it is — the same bar under water.
    { kind: 'cobbleshoal', label: 'River Cobble Shoal', swatch: '#6E6B65' },
    { kind: 'mossfloor',   label: 'River Moss',      swatch: '#618414' },
    // LABEL ONLY — the kind stays `isle`, which every venue doc on disk already names.
    // Renamed from plain "Sand" because the cove's other two grounds are Coastal Rock and
    // Coastal Scrub, and the sort below is by LABEL, so this now files with them instead of
    // eight rows away under S. Worth knowing it is not bay-only: `isle` is the shared beach
    // for bay, lake and lagoon (see LAND_TEXTURES.tropical), so the name has to stay true
    // for all three — "Coastal" is, where "Cape" would not have been.
    { kind: 'isle',        label: 'Coastal Sand',     swatch: '#e8dcb1' },
    // Swatch tracks ISLAND_STYLES.shoal.body. These had drifted to three different answers
    // — the renderer on the dry-beach tan, this chip on a third value, and neither on the
    // wet sand a bar actually is. The chip is what a designer picks from, so it has to be
    // the material, not a nearby guess at it.
    { kind: 'shoal',       label: 'Sand Shoal',       swatch: '#d0ad74' },
    { kind: 'swampgrass',  label: 'Swamp Grass',      swatch: '#a09453' },
    { kind: 'seagrass',    label: 'Seagrass',         swatch: '#4a7148' },
    { kind: 'shallows',    label: 'Shallows',         swatch: '#38bdf8' },
    { kind: 'tropicsand',  label: 'Tropic Sand',      swatch: '#efe4cf' },
    { kind: 'tropicshoal', label: 'Tropic Sand Shoal', swatch: '#8dd4c3' },
    // Bluewater Bonanza's two new grounds. Both swatches track ISLAND_STYLES.<kind>.body, so
    // the chip is the material — and both bodies are still their tile's SPEC mean, so these
    // move when ocean-coralrock and ocean-scrub are ingested and the bodies are reset to the
    // delivered means. Same state Coastal Rock and Coastal Scrub shipped in.
    //
    // ⚠️ "Coral Limestone" IS NOT "Coral Reef", and the two now sit adjacent in this sorted
    // list. Coral Reef is living reef UNDER the water that you sail into; this is dead reef
    // standing in the air that you run aground on. Same rock, opposite side of the
    // waterline. The labels are the only thing keeping a designer from picking the wrong
    // one, which is why neither is shortened to "Coral".
    { kind: 'coralrock',   label: 'Coral Limestone',  swatch: '#A7A193' },
    { kind: 'tropicscrub', label: 'Tropic Scrub',     swatch: '#A9AF2A' },
    // Gatorgrass Bayou. Every swatch tracks its own source of truth so the chip a
    // designer picks from is the material they get: the three grounds track
    // ISLAND_STYLES.{mud,marsh,mudflat}.body, and the four weeds track their VEG_STYLES
    // row's MID tone (the dark tone is the shadowed heart of a clump and reads as a
    // different plant at chip size). Labelled by plant, not by mechanic — a designer
    // placing weed is choosing lilies or hyacinth, and the drag follows from that.
    { kind: 'mud',         label: 'Mud',              swatch: '#524731' },
    { kind: 'marsh',       label: 'Marsh',            swatch: '#685c37' },
    { kind: 'mudflat',     label: 'Mud Flat',         swatch: '#6e6449' },
    { kind: 'weedbed',     label: 'Weed Bed',         swatch: '#2a4428' },
    { kind: 'lilybed',     label: 'Lily Pads',        swatch: '#60803e' },
    { kind: 'weedmat',     label: 'Hyacinth Mat',     swatch: '#5c7e40' },
    { kind: 'duckweed',    label: 'Duckweed',         swatch: '#84a64c' }
];
// The one place the order is decided, so both pickers inherit it and cannot disagree:
// the toolbar's `new-kind` (what the next gesture makes) and the inspector's `in-mat`
// (what the selected shape is).
//
// SAFE BECAUSE NOTHING PERSISTS A POSITION IN THIS ARRAY. The toolbar picker's option
// value is the kind STRING; the inspector's is an index, but one recomputed from the
// shape's own kind every time the panel renders, so it is only ever read in the same
// tick it was written. And DEFAULT_KIND is a name rather than `LAND_TYPES[0]` — see its
// note, which anticipated exactly this sort and the trap of letting "no kind given"
// become whatever happens to sort first (today, Bank: a hidden collider).
LAND_TYPES.sort((a, b) => a.label.localeCompare(b.label));
// The fallback when nothing says otherwise. Named, not `LAND_TYPES[0]`: that used to be
// ordinary land and is now Bank — a hidden collider — so an alphabetical sort would have
// quietly made "no kind given" mean "invisible".
const DEFAULT_KIND = 'isle';

// ── History ─────────────────────────────────────────────────────────────────
function pushHistory(label) {
    history = history.slice(0, histIdx + 1);
    history.push({ doc: clone(doc), label });
    if (history.length > 100) history.shift();
    histIdx = history.length - 1;
    refreshChrome();
}
function undo() { if (histIdx > 0) { histIdx--; doc = clone(history[histIdx].doc); afterEdit(false); } }
function redo() { if (histIdx < history.length - 1) { histIdx++; doc = clone(history[histIdx].doc); afterEdit(false); } }
// Dirty is "the document no longer matches what was saved", answered by comparing the
// serialised forms — but serialising a big venue costs real milliseconds and the chrome
// asks three times per refresh, so the answer is cached per EDIT GENERATION.
// `dirtyChanged()` is called wherever the truth can move: a committed edit (which
// includes undo and redo), a save, and a load.
let dirtyGen = 0, _dirtyAt = -1, _dirtyVal = false;
const dirtyChanged = () => { dirtyGen++; };
const isDirty = () => {
    if (_dirtyAt !== dirtyGen) {
        _dirtyVal = savedJSON !== null && JSON.stringify(doc) !== savedJSON;
        _dirtyAt = dirtyGen;
    }
    return _dirtyVal;
};

// ── Recompile: let the GAME build the course from the edited document ────────
// Anything else is a second interpretation of the document, and the point of the
// checks is that they see what is actually raced.
// Ice is CACHED across edits. Every commit rebuilds the course, and ice placement
// rejection-samples against land — so nudging one headland reshuffled all 54 bergs and
// the map jumped under you. Layout should hold still while you work; only an explicit
// reroll or a seed change should move it.
//
// (The fuller answer is authored ice in the document, so it is placeable and stable in
// the GAME too, not only in the editor. Noted, not built.)
let iceCache = null, iceCacheSeed = null;
// The honest route estimate — hull-width path length and polar VMG per leg. Recomputed
// on commit rather than per frame: it builds a nav grid and runs a BFS per leg.
let estimate = null;

// POINT THE GAME AT THE VENUE BEING EDITED, AND CHANGE NOTHING ELSE.
//
// This used to be `setItem('regatta_settings', JSON.stringify({ venue }))` at both call
// sites, which is not "set the venue" — it is "replace every setting with the venue".
// The editor and the game are two pages on one origin sharing one localStorage, so that
// write IS the player's saved settings: the other ten keys vanished, and the next load
// merged what was left over DEFAULT_SETTINGS. Character went back to Finley and music
// went back off on every venue switch and every commit, which on a normal editing session
// is constantly. Measured before the fix: character, musicEnabled, soundEnabled,
// cameraMode and navAids all reverted from one `loadVenue`.
//
// READ, MERGE, WRITE. Both failures degrade to what the old code did rather than to
// something worse: an unreadable or corrupt store falls through with an empty base (so the
// venue still lands, exactly as before), and a failed write is dropped (the venue is a
// convenience, not state worth throwing over — the game's own saveSettings takes the same
// view, and for the same reason).
function rememberVenue(key) {
    let cur = {};
    try {
        const raw = localStorage.getItem('regatta_settings');
        if (raw) { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') cur = parsed; }
    } catch (e) { /* unreadable or corrupt — start from empty, same as the old behaviour */ }
    cur.venue = key;
    try { localStorage.setItem('regatta_settings', JSON.stringify(cur)); } catch (e) { /* storage off */ }
}

function recompile(rerollIce) {
    const seed = previewSeed;
    window.VENUE_DOC[doc.venue] = doc;
    rememberVenue(doc.venue);
    const real = Math.random;
    Math.random = mulberry32(seed);
    try { resetGame(); } finally { Math.random = real; }
    course = state.course;

    // The cache exists so GENERATED bergs hold still while land is edited — placement
    // rejection-samples against land, so every commit used to reshuffle all 54. AUTHORED
    // ice is never cached: it is the thing being edited, and freezing it would mean a
    // dragged floe snapping back.
    const fresh = (course.islands || []).filter(i => !i.fromMask && !i.authored);
    if (rerollIce || !iceCache || iceCacheSeed !== seed) {
        iceCache = fresh; iceCacheSeed = seed;
    } else {
        // Put the cached bergs back, and rebuild navIslands with the same rule
        // initCourse uses so pathfinding still ignores unreachable scenery.
        course.islands = (course.islands || []).filter(i => i.fromMask || i.authored).concat(iceCache);
        course.navIslands = course.islands.filter(i =>
            !i.isBank && !i.awash && window.Arena.signedDist(course.boundary, i.x, i.y) > -(i.radius + 120));
    }
    floes = iceCache;
    runChecks();
}

// What the course actually costs to sail. Measured with the sailability grid, so the
// distance is a distance a boat can really cover, and priced with the game's own polar,
// so a beat is properly slower than a reach.
function recomputeEstimate() {
    estimate = null;
    if (!doc || !course || !window.SailCheck) return;
    try {
        const t0 = (window.performance && performance.now) ? performance.now() : 0;
        // ⚠️ AWASH SHAPES ARE NOT WALLS. buildGrid blocks every shape it is handed — it takes
        // DOCUMENT shapes and a document carries no traits — so the filter has to say so here,
        // exactly as compileVenueDoc's own estimate does. Left in, a bar or a weed bed closes
        // the water it lies on and the ruler measures the long way round something a boat sails
        // straight over: Gatorgrass Bayou read 4.53 km / 14:03 for a lap that is 2.31 km and
        // under four minutes once its 95 beds are treated as the water they are.
        //
        // `!awash` rather than `!reef`: a coral reef is a soft WALL and is deliberately not
        // awash, so it stays in the grid and still closes the pass it exists to close.
        const solid = window.VenueDoc.shapes(doc).filter(sh => {
            const t = window.VenueDoc.traits(sh);
            return t.motion === 'fixed' && !t.awash;
        });
        const grid = window.SailCheck.buildGrid(solid, course.boundary, null,
            window.VenueDoc.shapes(doc).some(sh => window.VenueDoc.traits(sh).motion !== 'fixed') ? { noSubsample: true } : null);
        // Pass the real field, not one number: the wind varies across the course, and a
        // patch with no region over it has no wind at all.
        estimate = window.SailCheck.routeEstimate(grid, course.marks, course.route,
            windBase(), state.wind.speed, (x, y) => getWindAt(x, y));
        if (estimate && t0) estimate.ms = Math.round(performance.now() - t0);
    } catch (e) {
        // An unsailable course can fail to produce a path at all. The sailability check
        // is what reports that; the estimate simply has nothing to say.
        estimate = null;
    }
}

function runChecks() {
    // The compiled shape the checks read must carry everything compile derives, or a
    // check quietly stops running instead of reporting.
    const derived = window.VenueDoc.compile(doc);
    const compiled = { marks: course.marks, boundary: course.boundary, roundMark: course.roundMark,
                       route: course.route, scenery: course.scenery,
                       sailedDist: derived.sailedDist,
                       cutoff: derived.cutoff, cutoffAuto: derived.cutoffAuto };
    recomputeEstimate();
    if (estimate) compiled.estimate = estimate;
    // EVERY floe, authored or generated: `floes` alone is the generated-preview cache, and
    // on a hand-placed venue it is empty — which made the ice checks fall silent.
    const allIce = (course.islands || []).filter(i => i.isFloe);
    findings = window.VenueCheck.run({ doc, compiled, boats: state.boats, floes: allIce });
    const order = { error: 0, warn: 1, ok: 2 };
    findings.sort((a, b) => order[a.level] - order[b.level]);
    checksRefresh();
    statsRefresh();
}

function checksRefresh() {
    const box = $('checks');
    if (!box) return;
    box.innerHTML = findings.map((f, i) => {
        const ok = f.level === 'ok';
        return `<div class="ck${ok ? ' ok' : ''}${i === selFinding ? ' sel' : ''}" data-i="${i}">`
             + `<span class="dot ${f.level === 'error' ? 'err' : f.level === 'warn' ? 'warn' : 'ok'}"></span>`
             + `<span class="ck-t"><b>${f.title}</b>${ok ? '' : '<br>'}${ok ? ' — ' + f.detail : f.detail}</span>`
             + (ok ? '' : '<span class="ck-fix">show →</span>') + `</div>`;
    }).join('');
    box.querySelectorAll('[data-i]').forEach(el => el.addEventListener('click', () => {
        const i = +el.dataset.i;
        selFinding = (selFinding === i) ? -1 : i;
        checksRefresh(); draw();
    }));
}

// ── Live path while a mark drags ────────────────────────────────────────────
// The full recompile (resetGame + grid + checks + estimate) is a commit-time cost; a
// drag needs only the PATH to follow the mark. So: mirror the document's mark
// positions onto the compiled course (compile preserves mark order), refresh each
// rounding's resolved mark, and rebuild `course.dmc` on the grid the last compile
// already built. Throttled, because a BFS per leg per mousemove is real work.
let livePathAt = 0;
function livePathRefresh() {
    if (!doc || !course || typeof CoursePath === 'undefined') return;
    const now = performance.now();
    if (now - livePathAt < 120) return;
    livePathAt = now;
    const dm = dmarksOf();
    for (let i = 0; i < dm.length && i < (course.marks || []).length; i++) {
        course.marks[i].x = dm[i].x; course.marks[i].y = dm[i].y;
    }
    for (const e of (course.route || [])) {
        if (e.kind === 'round' && e.mark && e.markIdx != null && course.marks[e.markIdx]) {
            e.mark.x = course.marks[e.markIdx].x;
            e.mark.y = course.marks[e.markIdx].y;
        }
    }
    try {
        if (!state._dmcPlanner && typeof RoutePlanner === 'function') state._dmcPlanner = new RoutePlanner();
        course.dmc = CoursePath.build(course.marks, course.route, course.islands || [],
                                      state._dmcPlanner, 'dmc-' + (course.navVersion || 0),
                                      course._botGridStatic || course.botGrid || null);
    } catch (err) { /* an unroutable mid-drag position keeps the last good path */ }
}

// Called after any committed edit.
function afterEdit(pushSnapshot, label) {
    dirtyChanged();
    if (pushSnapshot) pushHistory(label || 'edit');
    recompile();
    info();
    refreshChrome();
    refreshInspector();
    marksInspector();
    windRefresh();
    currentRefresh();
    iceRefresh();
    paletteRefresh();
    draw();
}

// ── Load / save ─────────────────────────────────────────────────────────────
// A venue is a FILE. Open reads one, Save writes back to it, Save As writes a copy and
// keeps editing the copy — the ordinary file lifecycle, instead of a dropdown of the
// bundled venues. The bundled ones still load at boot (the game preview needs them in
// VENUE_DOC anyway), and opening assets/venues/<key>.venue.js is how you edit one.
let fileHandle = null;

// ── Session restore ─────────────────────────────────────────────────────────
// The last opened file's HANDLE, persisted in IndexedDB — the one browser store that can
// hold a FileSystemFileHandle across restarts (localStorage can only hold strings, and a
// path string is useless: the API refuses arbitrary paths by design). On boot the editor
// tries to reopen it. Whether that needs a click is Chrome's call, not ours: if the read
// permission survived (it usually does within a browsing session, and durably if the user
// picked "Allow on every visit"), the file reopens silently; otherwise a permission prompt
// requires a user gesture, so the empty state offers ⏎ instead of a canvas that plays dumb.
let lastHandle = null;   // surfaced in the empty state until claimed or replaced
function handleDB() {
    return new Promise((res, rej) => {
        const rq = indexedDB.open('regatta-editor', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('handles');
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
    });
}
async function rememberHandle(h) {
    try {
        const db = await handleDB();
        await new Promise((res, rej) => {
            const tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').put(h, 'last');
            tx.oncomplete = res; tx.onerror = () => rej(tx.error);
        });
    } catch (_) { /* remembering is best-effort; the editor works without it */ }
}
async function recallHandle() {
    try {
        const db = await handleDB();
        return await new Promise((res, rej) => {
            const rq = db.transaction('handles', 'readonly').objectStore('handles').get('last');
            rq.onsuccess = () => res(rq.result || null);
            rq.onerror = () => rej(rq.error);
        });
    } catch (_) { return null; }
}
async function reopenLast() {
    const h = lastHandle;
    if (!h || doc) return;
    try {
        if ((await h.queryPermission({ mode: 'read' })) !== 'granted'
            && (await h.requestPermission({ mode: 'read' })) !== 'granted') return;
        const f = await h.getFile();
        if (!doc) { openDocText(await f.text(), h, f.name); lastHandle = null; }
    } catch (err) {
        // The file may have moved or been deleted since last session — say so and go
        // back to the ordinary empty state rather than offering a reopen that cannot work.
        toast(`Couldn't reopen ${h.name || 'last file'}: ${err && err.message}`, true);
        lastHandle = null;
        draw();
    }
}

// The shared tail of every way a document arrives — bundled at boot, or opened from a
// file. `src` is a MIGRATED document; `handle` is where Save writes without asking.
function loadDoc(src, handle) {
    selFinding = -1;
    sel = Object.assign({}, NOHIT);
    doc = clone(src);
    // ONE LIST. A document may still be on disk as land[] + ice[] — export_venue_doc.js
    // writes that, and so does any copy saved before shapes existed — so it is normalised
    // here, at the one place a document enters the editor. Everything below assumes
    // `doc.shapes`, and saving writes it back in the new form.
    doc.shapes = window.VenueDoc.shapes(doc);
    delete doc['land']; delete doc['ice'];   // bracketed: a bare rename swept these too
    // Land on the COURSE layer: the first question about a venue you have just opened is what
    // the course is, not which coastline you feel like reshaping.
    mode = 'map'; sub = 'drag'; drawing = false;
    iceCache = null; iceCacheSeed = null;      // a fresh venue gets fresh ice
    savedJSON = JSON.stringify(doc);
    dirtyChanged();
    history = [{ doc: clone(doc), label: 'loaded' }];
    histIdx = 0;
    fileHandle = handle || null;
    if (handle) { rememberHandle(handle); lastHandle = null; }
    clearRegSel(); selLine = -1; selRoute = -1;
    const label = $('venue-label');
    if (label) label.textContent = venueName(doc.venue);
    recompile(); info(); refreshChrome(); refreshInspector();
    marksInspector(); windRefresh(); currentRefresh();
    iceRefresh(); paletteRefresh();

    fitView();
}

// The boot state: NOTHING OPEN. A venue is a file, and the session starts when one is
// opened — so the editor starts as an empty canvas that says so, not as whichever
// document it decided you wanted.
function loadBlank() {
    doc = null; course = null; fileHandle = null; savedJSON = null;
    history = []; histIdx = -1;
    floes = []; findings = [];
    selFinding = -1;
    sel = Object.assign({}, NOHIT);
    clearRegSel(); selLine = -1; selRoute = -1;
    const label = $('venue-label');
    if (label) label.textContent = 'No venue open';
    $('checks').innerHTML = '<div class="in-none">Nothing open. Open… a .venue.js to edit it'
        + ' — Save As makes a copy to work on.</div>';
    statsRefresh();
    info(); refreshChrome(); refreshInspector();
    windRefresh(); currentRefresh(); iceRefresh();
    draw();
}

// A bundled venue, by key — how the tests and the checker drive the editor without a
// file picker; the same shared tail an Open… lands in.
function loadVenue(key) {
    const src = window.VenueDoc.get(key);
    if (!src) {
        // Generated venue: nothing authored to edit. Show it read-only rather than
        // pretending otherwise.
        selFinding = -1;
        sel = Object.assign({}, NOHIT);
        doc = null; fileHandle = null; savedJSON = null;
        history = []; histIdx = -1;
        const seed = previewSeed;
        rememberVenue(key);
        const real = Math.random; Math.random = mulberry32(seed);
        try { resetGame(); } finally { Math.random = real; }
        course = state.course;
        floes = (course.islands || []).filter(i => !i.fromMask);
        findings = [];
        const label = $('venue-label');
        if (label) label.textContent = venueName(key);
        $('checks').innerHTML = '<div class="in-none">Generated venue — no document to edit or '
            + 'check. Its land, marks and wind are produced per seed at load.</div>';
        statsRefresh();
        info(); refreshChrome(); refreshInspector();
        windRefresh(); currentRefresh(); iceRefresh(); fitView();
        return;
    }
    loadDoc(src, null);
}

// File → New. A venue is a file, so a new one is a document with nowhere to write yet:
// Save asks where to put it, the same as a file made anywhere else. It opens not on an
// empty map but on the smallest course that already races — a square arena, one breeze
// over all of it, a start line and a windward mark — because every tool here works on
// something that exists, and a truly empty document would greet you with nothing to
// select and a page of errors before you had done anything wrong.
function newDoc() {
    if (doc && isDirty() && !confirm('Discard unsaved changes?')) return;
    // A fresh key each time: recompile registers the document in VENUE_DOC, so reusing
    // 'untitled' would silently overwrite the last New still sitting in the registry.
    let key = 'untitled', n = 2;
    while (window.VENUE_DOC[key]) key = `untitled-${n++}`;
    const size = 8000;                                   // 1.6 km of water: enough beat
    const half = size / 2 - mToU(140);                   // the Fit-rect default inset
    const src = window.VenueDoc.migrate({
        schema: 1,
        venue: key,
        card: { name: 'Untitled' },
        world: { size, boundary: { poly: window.Arena.rectPoly(0, 0, half, half) } },
        shapes: [],
        course: {
            // Pin to port, committee boat to starboard, seen from a boat facing the
            // breeze — and 1100u of line, the length ten boats need (see scaleMap).
            marks: [
                { id: 'mark-1', name: 'Pin', x: -550, y: 2700, kind: 'inflatable' },
                { id: 'mark-2', name: 'Committee', x: 550, y: 2700, kind: 'committee' },
                { id: 'mark-3', name: 'Windward', x: 0, y: -2700, kind: 'inflatable' }
            ],
            lines: [{ id: 'line-1', marks: ['mark-1', 'mark-2'] }],
            // Up, round, and home across the same line: start and finish share it,
            // crossed the opposite way.
            route: [
                { kind: 'gate', lineId: 'line-1', dir: 1, pass: 'through' },
                { kind: 'round', markId: 'mark-3', side: 'port' },
                { kind: 'gate', lineId: 'line-1', dir: -1, pass: 'through' }
            ]
        },
        // Sampled well past the arena, like migrate's whole-map region, so particles
        // drawn outside the boundary are not becalmed. Direction 0 blows down the map:
        // the beat above really is a beat.
        wind: { regions: [{
            id: 'wind-all',
            poly: [[-size, -size], [size, -size], [size, size], [-size, size]],
            falloff: 400, direction: 0, dirVar: 0.25,
            speed: 10, speedVar: 2.5, period: 60
        }] }
    });
    loadDoc(src, null);
    // Unsaved from birth: loadDoc took the document as the saved baseline, but there is
    // no file it matches yet, and the chrome should say so.
    savedJSON = '';
    dirtyChanged();
    refreshChrome();
    toast('New venue — Save will ask where to put it');
}

// A venue file's text, whichever of its two on-disk forms it is in: the `.venue.js`
// wrapper (`window.VENUE_DOC[key] = {...}`), or bare JSON. The wrapper is executed
// against a STUB window, so the file's own assignment is what registers it — no regex
// guessing at where the object starts.
function parseVenueText(text) {
    const t = String(text).trim();
    if (t.startsWith('{')) return JSON.parse(t);
    const stub = { VENUE_DOC: {} };
    new Function('window', text)(stub);
    const keys = Object.keys(stub.VENUE_DOC || {});
    if (!keys.length) throw new Error('no VENUE_DOC entry in this file');
    return stub.VENUE_DOC[keys[0]];
}

// Text from ANY source — picker, input fallback, a test — becomes the open document.
// Registered under its own venue key so the game preview compiles it; the key falls
// back to the filename so an id-less file is still openable.
function openDocText(text, handle, fname) {
    let src;
    try {
        src = window.VenueDoc.migrate(parseVenueText(text));
    } catch (e) {
        toast(`Could not read ${fname || 'file'}: ${e && e.message}`, true);
        return false;
    }
    if (!src.venue) src.venue = String(fname || 'venue').replace(/(\.venue)?\.(js|json)$/i, '');
    window.VENUE_DOC[src.venue] = src;
    loadDoc(src, handle);
    toast(`Opened ${fname || src.venue}`);
    return true;
}

async function openFile() {
    if (doc && isDirty() && !confirm('Discard unsaved changes?')) return;
    try {
        if (window.showOpenFilePicker) {
            // `id` gives open and save one shared remembered directory: Chrome reopens
            // wherever a venue was last opened or saved under this id, which from first
            // use on is assets/venues/. `startIn` covers the rest: a FILE handle means
            // "start in that file's directory", so an editor already holding a venue
            // points the picker at the right folder even before the id has history.
            // (An arbitrary path is not an option — the API refuses them by design.)
            const opts = {
                id: 'venue-docs',
                types: [{ description: 'Venue document',
                          accept: { 'text/javascript': ['.js'], 'application/json': ['.json'] } }]
            };
            if (fileHandle) opts.startIn = fileHandle;
            const [h] = await window.showOpenFilePicker(opts);
            const file = await h.getFile();
            openDocText(await file.text(), h, file.name);
        } else {
            // Fallback for browsers without the File System Access API: an input can
            // still READ a file; Save falls back to a download the same way.
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.js,.json';
            input.addEventListener('change', async () => {
                const f = input.files && input.files[0];
                if (f) openDocText(await f.text(), null, f.name);
            });
            input.click();
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return;      // user cancelled the picker
        toast('Open failed: ' + (e && e.message), true);
    }
}

async function save(saveAs) {
    if (!doc) return;
    const text = '// GENERATED ONCE by art/export_venue_doc.js — now the SOURCE OF TRUTH.\n'
        + '// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.\n'
        + '// Edited in editor.html.\n'
        + 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
        + `window.VENUE_DOC[${JSON.stringify(doc.venue)}] = ${JSON.stringify(doc, null, 2)};\n`;
    const name = `${doc.venue}.venue.js`;
    try {
        if (window.showSaveFilePicker) {
            // Save As always asks; Save asks only when there is nowhere to write yet.
            if (saveAs || !fileHandle) {
                // Same `id` as the open picker, so both dialogs share one remembered
                // directory — see openFile.
                const opts = {
                    id: 'venue-docs',
                    suggestedName: name,
                    types: [{ description: 'Venue document', accept: { 'text/javascript': ['.js'] } }]
                };
                if (fileHandle) opts.startIn = fileHandle;
                fileHandle = await window.showSaveFilePicker(opts);
            }
            // createWritable takes an EXCLUSIVE OS LOCK on the file, released only by
            // close() or abort(). A write that throws must abort, or the leaked stream
            // keeps the lock for the tab's lifetime — the file then shows up greyed-out
            // in every open dialog until some later GC lets it go, which reads as "the
            // editor can't open some files until I load others". abort() rather than
            // close(): close commits the swap file, and committing a HALF-WRITTEN venue
            // over a good one is worse than the failed save it papers over.
            const w = await fileHandle.createWritable();
            try {
                await w.write(text); await w.close();
            } catch (e) {
                try { await w.abort(); } catch (_) { /* already released */ }
                throw e;
            }
        } else {
            // Fallback for browsers without the File System Access API: download it
            // and let the user drop it into assets/venues/.
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
            a.download = name; a.click();
            URL.revokeObjectURL(a.href);
        }
        savedJSON = JSON.stringify(doc);
        dirtyChanged();
        if (fileHandle) rememberHandle(fileHandle);   // Save As acquires a handle loadDoc never saw
        toast(`Saved ${fileHandle && fileHandle.name ? fileHandle.name : name}`);
        refreshChrome();
    } catch (e) {
        if (e && e.name === 'AbortError') return;      // user cancelled the picker
        toast('Save failed: ' + (e && e.message), true);
    }
}

let toastT = null;
function toast(msg, bad) {
    const el = $('toast');
    el.textContent = msg;
    el.style.color = bad ? '#fda4af' : '#6ee7b7';
    el.style.opacity = '1';
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

// A venue's NAME is what it is called; its id is its filename. Everything a person reads
// says the name — the id survives in the document, in localStorage and in the saved file,
// where it is a stable key rather than a label.
// The name lives on the document's CARD (`doc.card.name`) with the rest of the clubhouse
// copy. The OPEN document wins over the bundled registry: a file opened from disk is not
// in `window.VENUE_DOC`, and reading the registry showed the shipped name while you were
// editing a different one.
const venueName = (key) => {
    const d = (doc && doc.venue === key) ? doc : (window.VENUE_DOC || {})[key];
    const c = d && d.card;
    return (c && (c.name || c.tag)) || key || '—';
};

// ── Dropdowns, drawn by us ──────────────────────────────────────────────────
// Same argument as the venue menu, applied to every other <select>: a native one pops a
// list the OS draws — system font, system radius, system highlight, a white rectangle in
// the middle of a dark app. Styling the closed control and leaving the open list alone made
// the mismatch WORSE, because the thing now looked like part of the design right up until
// you clicked it.
//
// The <select> stays in the DOM as the value holder, so `sel.value`, `change` events and
// every reader of them are untouched — this replaces how the list is drawn, not what a
// dropdown is. Re-entrant: the inspector re-renders constantly and each render is enhanced
// once, marked by `data-enhanced`.
const SEL_TICK = '<svg class="ed-opt-tick" width="12" height="12" viewBox="0 0 12 12" fill="none">'
    + '<path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" stroke-width="1.8"'
    + ' stroke-linecap="round" stroke-linejoin="round"/></svg>';

let openSel = null;
function closeSelMenu() {
    if (openSel) { openSel.pop.hidden = true; openSel.btn.setAttribute('aria-expanded', 'false'); }
    openSel = null;
}

function enhanceSelect(sel) {
    if (!sel || sel.dataset.enhanced) return;
    sel.dataset.enhanced = '1';

    const wrap = document.createElement('span');
    wrap.className = 'ed-sel' + (sel.classList.contains('in-wide') ? ' wide' : '');
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.style.display = 'none';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ed-sel-btn' + (sel.classList.contains('to-sel') ? ' to' : '');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (sel.title) btn.title = sel.title;

    const pop = document.createElement('div');
    pop.className = 'ed-pop ed-sel-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'listbox');
    // ⚠️ A MOUSEDOWN INSIDE THE MENU IS NOT A CLICK OUTSIDE IT. The document-level
    // dismiss handler fired on the option's own mousedown and hid the popup, so the
    // click that followed had nothing left to land on and the choice was silently
    // dropped — every dropdown in the editor, not just this one.
    //
    // It survived because every test drove these with `el.click()`, which dispatches a
    // click and no mousedown. Only a real pointer goes down before it goes up.
    pop.addEventListener('mousedown', (e) => e.stopPropagation());

    wrap.appendChild(btn);
    wrap.appendChild(pop);

    const label = () => {
        const o = sel.options[sel.selectedIndex];
        btn.innerHTML = `<span class="ed-sel-v">${o ? o.textContent : ''}</span>`
            + '<svg class="ed-sel-c" width="10" height="7" viewBox="0 0 10 7" fill="none">'
            + '<path d="M1 1.5L5 5.5L9 1.5" stroke="currentColor" stroke-width="1.4"'
            + ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
    };
    const build = () => {
        pop.innerHTML = [...sel.options].map((o, i) =>
            `<button type="button" class="ed-opt${i === sel.selectedIndex ? ' on' : ''}"`
            + ` data-i="${i}" role="option" aria-selected="${i === sel.selectedIndex}">`
            + `${SEL_TICK}<span>${o.textContent}</span></button>`).join('');
        pop.querySelectorAll('[data-i]').forEach(el => el.addEventListener('click', () => {
            const i = +el.dataset.i;
            closeSelMenu();
            if (i === sel.selectedIndex) return;
            sel.selectedIndex = i;
            label();
            // The real event, so every existing listener fires exactly as before.
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }));
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = openSel && openSel.pop === pop;
        closeSelMenu();
        if (wasOpen) return;
        build();
        pop.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        openSel = { pop, btn };
    });
    // A change from anywhere else — code setting `.value`, a test, a keyboard user on the
    // hidden select — still has to reach the label, or the trigger lies about the value.
    sel.addEventListener('change', label);
    label();
}

// The prop picker opens a MODAL, not a dropdown. The library is meant to grow to
// dozens of sprites, and a dropdown anchored to a 230px settings column has nowhere to
// put them — it clips against the scroller or flows off the window, and both were
// happening. A centred dialog owns its space: big enough for a THUMBNAIL GRID (you pick
// art by looking at it, not by remembering its name), a filter that stays put, and
// edges that can never leave the screen. The hidden <select> stays the value holder,
// exactly like every enhanced dropdown, so `sel.value` and `change` listeners are
// untouched. Type-filter-Enter still works: Enter takes the first match, Escape closes.
function enhancePropPicker(sel) {
    if (!sel || sel.dataset.enhanced) return;
    sel.dataset.enhanced = '1';

    const wrap = document.createElement('span');
    wrap.className = 'ed-sel' + (sel.classList.contains('in-wide') ? ' wide' : '');
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.style.display = 'none';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ed-sel-btn';
    btn.setAttribute('aria-haspopup', 'dialog');
    wrap.appendChild(btn);

    const back = document.createElement('div');
    back.className = 'ed-modal-back';
    back.hidden = true;
    back.innerHTML = `<div class="ed-modal" role="dialog" aria-label="Choose a prop">
        <div class="ed-modal-head">
          <span class="k" style="flex:none">Choose a prop</span>
          <input class="ed-find" type="text" placeholder="Filter props…" autocomplete="off" spellcheck="false">
          <button type="button" class="ed-modal-x" title="Close">\u2715</button>
        </div>
        <div class="ed-prop-grid"></div></div>`;
    document.body.appendChild(back);
    const find = back.querySelector('.ed-find');
    const grid = back.querySelector('.ed-prop-grid');
    const close = () => { back.hidden = true; };
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); e.stopPropagation(); });
    back.querySelector('.ed-modal-x').addEventListener('click', close);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !back.hidden) close(); });

    const label = () => {
        const o = sel.options[sel.selectedIndex];
        btn.innerHTML = `<span class="ed-sel-v">${o ? o.textContent : ''}</span>`
            + '<svg class="ed-sel-c" width="10" height="7" viewBox="0 0 10 7" fill="none">'
            + '<path d="M1 1.5L5 5.5L9 1.5" stroke="currentColor" stroke-width="1.4"'
            + ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
    };
    // Thumbnails come from the same src convention the game and the schematic derive —
    // including its opt-out: a venue-neutral prop names its own `src`, because its bake sits
    // flat in props/ and the '<venue>/<name>' split cannot reach it. See propSprite in
    // script.js. Miss this and the kind is pickable but its thumbnail is a broken image.
    const srcOf = (kind) => {
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        if (reg[kind] && reg[kind].src) return reg[kind].src;
        const i = kind.indexOf('-');
        return `assets/images/props/${kind.slice(0, i)}/${kind.slice(i + 1)}.png`;
    };
    const pick = (i) => {
        close();
        if (i === sel.selectedIndex) return;
        sel.selectedIndex = i;
        label();
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const build = () => {
        const q = find.value.trim().toLowerCase();
        const opts = [...sel.options].map((o, i) => ({ o, i }))
            .filter(({ o }) => !q || o.textContent.toLowerCase().includes(q));
        grid.innerHTML = opts.length ? opts.map(({ o, i }) =>
            `<button type="button" class="ed-prop-card${i === sel.selectedIndex ? ' on' : ''}" data-i="${i}">`
            + `<img src="${srcOf(o.value)}" alt="" draggable="false"><span>${o.textContent}</span></button>`).join('')
            : '<div class="ed-find-none">No props match</div>';
        grid.querySelectorAll('[data-i]').forEach(el => el.addEventListener('click', () => pick(+el.dataset.i)));
    };
    find.addEventListener('input', build);
    find.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const el = grid.querySelector('[data-i]');
            if (el) pick(+el.dataset.i);
            e.preventDefault();
        }
    });

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSelMenu();
        find.value = '';
        build();
        back.hidden = false;
        const on = grid.querySelector('.ed-prop-card.on');
        if (on) on.scrollIntoView({ block: 'center' });
        find.focus();
    });
    sel.addEventListener('change', label);
    label();
}

// Every select inside a container, after it has been rendered.
function enhanceSelects(root) {
    (root || document).querySelectorAll('select:not([data-enhanced])').forEach(enhanceSelect);
}
document.addEventListener('mousedown', () => closeSelMenu());
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSelMenu(); });

// ── Layers ──────────────────────────────────────────────────────────────────
// The layer list IS the mode switch. `mode` keeps its old names internally because
// sixty sites gate on them; a layer adds what the list needs on top: a readable name, an
// icon, how much of it there is, and whether it is drawn.
//
// ORDER is the order you build in: the course as a whole, then the water it is sailed on
// (its limit, then its colour), then the things in it, then the weather, then the marks and
// the order they are sailed. Water sits under Arena because the limit is a fact about the
// race and the colour is a fact about the picture.
const LAYERS = [
    // How many corners the limit has is a fact about the drawing; how much water it
    // encloses is a fact about the RACE, and that is the one worth a glance.
    { id: 'arena',    mode: 'boundary', name: 'Arena', icon: 'frame',
      count: () => doc ? fmtArea(arenaArea()) : null },
    // Water is the SURFACE — its colour, and nothing else. It is not an object and it cannot
    // be hidden: it is wherever land and the arena are not, so there is nothing to turn off.
    { id: 'water',    mode: 'water',   name: 'Water',  icon: 'wave', noEye: true,
      count: () => null, hint: 'colour' },
    // ONE layer for everything solid. Land and ice were two, which meant two of every
    // polygon verb and no way to say which sits in front of which.
    { id: 'land',     mode: 'shape',   name: 'Objects', icon: 'land',
      count: () => doc ? `${doc.shapes.length} · ${doc.shapes.reduce((a, l) => a + l.outer.length, 0)} pts` : null },
    // Pictures with positions — scenery the game draws by kind. Between the solid
    // objects and the weather, because that is its draw order too: over the land it
    // stands on, under everything that races.
    { id: 'props',    mode: 'props',   name: 'Props',  icon: 'palm',
      count: () => dprops().length || null },
    // Vessels on rails. Beside Props because the art is the same registry and the same
    // sprites — but a traffic entry owns a path, a schedule and a lee, none of which a prop
    // has any business carrying, so it is its own layer and its own document section.
    { id: 'traffic',  mode: 'traffic', name: 'Traffic', icon: 'ship',
      count: () => dtraffic().length || null },
    { id: 'wind',     mode: 'wind',    name: 'Wind',   icon: 'wind',
      count: () => wregs().length || null },
    // Under Wind, because gusts ARE wind — they are just not MEAN wind. A wind region
    // states what the breeze is over a patch of water; a gust region states what is born
    // there and then leaves. They could not be one object: a wind region with no speed is
    // calm, so a gust source drawn as one would punch a dead hole in the breeze.
    { id: 'gust',     mode: 'gust',    name: 'Gusts',  icon: 'gust',
      count: () => gregs().length || null },
    // The current is a set of objects drawn ON the water, so it lists, selects and hides like
    // any other layer — which is exactly what it could not do while it shared Water's panel.
    { id: 'current',  mode: 'current', name: 'Current', icon: 'stream',
      count: () => cregs().length || null },
    // Under Current, because rapids ARE that water — the current says where the stream
    // goes, a rapid says what the surface is like on the way: turbulence only, robbing
    // drive and shoving the bow. Flow stays the Current layer's, in whole, so the two
    // layers can never author the same knots twice.
    { id: 'rapids',   mode: 'rapids',  name: 'Rapids', icon: 'rapids',
      count: () => rregs().length || null },
    { id: 'marks',    mode: 'marks',   name: 'Marks',  icon: 'mark',
      count: () => doc ? `${dmarksOf().length}+${dlines().length}` : null },
    { id: 'route',    mode: 'route',   name: 'Route',  icon: 'route',
      count: () => doc ? `${Math.max(1, routeOf().length - 1)} legs` : null }
];
const layerOf = (m) => LAYERS.find(l => l.mode === m) || null;

// Which layers are DRAWN. Hiding one is not the same as not editing it: on a course this
// dense, turning the ice off to see the marks under it is the difference between reading the
// map and guessing at it. Every draw site below consults this, so the eye in the list and the
// pixels on the map cannot disagree.
const hidden = new Set();
const shown = (id) => !hidden.has(id);

const LAYER_ICON = {
    ship: '<path d="M2 9.5h10l-1.2 3.2H3.4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>'
        + '<path d="M4 9.5V6h5l1.6 3.5M6.5 6V3.6h1.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
    // A single swell with a crest — the surface itself. The two-line glyph it used to carry
    // reads as flow, which is the current's job now.
    wave:  '<path d="M1 6.6c1.5-1.8 3-1.8 4.5 0s3 1.8 4.5 0 2-1.2 3 0V12H1z" fill="currentColor" opacity=".85"/>',
    // Two streamlines: water going somewhere.
    stream: '<path d="M1 11c2-2 3.5-2 5.5 0S10 13 12 11" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M1 7c2-2 3.5-2 5.5 0S10 9 12 7" stroke="currentColor" stroke-width="1.4" fill="none"/>',
    // A jagged crest over a streamline: broken water going somewhere.
    rapids: '<path d="M1 5.5l1.8-1.9L4.6 5.5l1.8-1.9L8.2 5.5 10 3.6l1.9 1.9" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><path d="M1 10.5c2-2 3.5-2 5.5 0s3.5 2 5.5 0" stroke="currentColor" stroke-width="1.4" fill="none"/>',
    land:  '<path d="M1.5 11l3.5-6 3 4 2-2.5 2.5 4.5z" stroke="currentColor" stroke-width="1.3" fill="none"/>',
    frame: '<rect x="2" y="2.5" width="10" height="9" stroke="currentColor" stroke-width="1.3" fill="none"/>',
    ice:   '<path d="M7 1.5v11M2.5 4l9 6M11.5 4l-9 6" stroke="currentColor" stroke-width="1.2"/>',
    wind:  '<path d="M1.5 5.5h7a2 2 0 100-2M1.5 9h9a2 2 0 110 2" stroke="currentColor" stroke-width="1.3" fill="none"/>',
    // A cat's paw: the dark patch a puff makes on the water, which is the thing itself
    // rather than an arrow describing it. Wind's glyph already owns the streaming-air read.
    gust:  '<ellipse cx="7" cy="7" rx="5.5" ry="3.2" transform="rotate(-20 7 7)" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5.2" cy="7.4" r=".9" fill="currentColor"/><circle cx="8.2" cy="6.2" r=".9" fill="currentColor"/>',
    mark:  '<circle cx="7" cy="7" r="2.2" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="currentColor" stroke-width="1.2"/>',
    // A palm from the side: trunk plus three fronds — the first prop, standing for all of them.
    palm:  '<path d="M7 13V6" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M7 6C5.2 4.4 3.2 4.2 1.8 5.4M7 6c-.4-2.2.4-3.9 2-4.8M7 6c1.8-1.6 3.8-1.8 5.2-.6" stroke="currentColor" stroke-width="1.3" fill="none"/>',
    route: '<path d="M2 11c4 0 3-8 7-8" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="2" cy="11" r="1.4" fill="currentColor"/><circle cx="11.5" cy="3" r="1.4" fill="currentColor"/>',
    // A folded map: the course as a whole, as opposed to any one thing on it.
    map:   '<path d="M1.5 3.5l4-1.5 3 1.5 4-1.5v9l-4 1.5-3-1.5-4 1.5z" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M5.5 2v9.5M8.5 3.5V13" stroke="currentColor" stroke-width="1.1"/>'
};
const EYE_ON  = '<path d="M1 7s2.2-3.6 6-3.6S13 7 13 7s-2.2 3.6-6 3.6S1 7 1 7z" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/>';
const EYE_OFF = '<path d="M1 7s2.2-3.6 6-3.6S13 7 13 7s-2.2 3.6-6 3.6S1 7 1 7z" stroke="currentColor" stroke-width="1.1" fill="none" opacity=".5"/><path d="M2 12L12 2" stroke="currentColor" stroke-width="1.3"/>';

function layerRefresh() {
    const box = $('layer-list');
    if (!box) return;
    const svg = (d) => `<svg class="ly-eye" viewBox="0 0 14 14" width="14" height="14">${d}</svg>`;
    const icon = (k) => `<svg viewBox="0 0 14 14" width="14" height="14" style="flex:none;opacity:.8">${LAYER_ICON[k] || ''}</svg>`;
    // The COURSE is the root: the map, the route and the marks are all parts of it. No count
    // beside it — the world's size is not a measure of the course, and reading it as one is
    // exactly what a number in that position invites.
    let html = `<div class="ly root${mode === 'map' ? ' on' : ''}" data-layer="course">`
             + `<span style="width:14px"></span>${icon('map')}`
             + `<span class="ly-n">Course</span></div>`;
    for (const L of LAYERS) {
        const on = mode === L.mode;
        const c = L.count();
        html += `<div class="ly${on ? ' on' : ''}${shown(L.id) ? '' : ' off'}" data-layer="${L.id}">`
              + (L.noEye
                  ? `<span style="width:14px"></span>`
                  : `<span class="ly-eye" data-eye="${L.id}" title="show or hide this layer">`
                    + `<svg viewBox="0 0 14 14" width="14" height="14">${shown(L.id) ? EYE_ON : EYE_OFF}</svg></span>`)
              + icon(L.icon)
              + `<span class="ly-n">${L.name}</span>`
              + `<span class="ly-c">${c == null ? '' : c}</span></div>`;
    }
    box.innerHTML = html;
    box.querySelectorAll('[data-layer]').forEach(el => el.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-eye]')) return;
        if (el.dataset.layer === 'course') { setMode('map'); return; }
        const L = LAYERS.find(x => x.id === el.dataset.layer);
        if (L) setMode(L.mode);
    }));
    box.querySelectorAll('[data-eye]').forEach(el => el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = el.dataset.eye;
        if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
        layerRefresh(); draw();
    }));
}

// ── Chrome (buttons, dirty state, hints) ────────────────────────────────────
function refreshChrome() {
    $('btn-undo').disabled = histIdx <= 0;
    $('btn-redo').disabled = histIdx >= history.length - 1;
    $('btn-save').disabled = !doc || !isDirty();
    $('dirty').textContent = doc ? (isDirty() ? '● unsaved' : 'saved') : '';
    $('dirty').classList.toggle('dirty', isDirty());
    syncTool();
    syncFieldButtons();
    layerRefresh();
    toolStrip();
    // A layer's settings are an inspector section, shown when that layer is active. The ruler
    // has no settings of its own: Esc clears the measurement, B shows a boat, and the hint bar
    // says so — a panel for two gestures was two gestures' worth of clutter.
    document.querySelectorAll('.mode-panel').forEach(p => {
        p.hidden = (p.dataset.layer !== mode);
    });
    const vsRow = $('vsel-row');
    if (vsRow) {
        vsRow.style.display = vsel.length > 0 ? 'block' : 'none';
        $('vsel-count').textContent = vsel.length
            ? `${vsel.length} selected — the ringed one is the align anchor`
            : 'Drag a box to select · Shift+click to add';
        $('btn-align-x').disabled = vsel.length < 2;
        $('btn-align-y').disabled = vsel.length < 2;
    }
    selActs();
    toolOpts();
    hintBar();
    objRefresh();
    inspectorRefresh();
}

// ── Selection action bar ────────────────────────────────────────────────────
// Shown only with something selected, and it names the count so the verbs are unambiguous:
// "Delete" over three islands should say three before you press it, not after.
// The armed tool's settings show only while that tool is armed. Both MAKERS carry the kind
// — Draw clicks a polygon out, Place drags a size, and both have to know what they are
// making — while scatter and vary belong to Place alone.
function toolOpts() {
    const box = $('tool-opts');
    if (!box) return;
    const makes = sub === 'place' || drawing;   // `sub` is the live tool; `tool` is vestigial
    // Props are the exception to "settings belong to the armed tool": there is no maker tool
    // for them, because a plain click on open water places one. So their settings hang off the
    // LAYER, and the strip stays up the whole time you are on it.
    // Props settle it the same way shapes do: these decide what the next PLACE makes, so they
    // ride with that tool and vanish with it rather than sitting on the layer being true of
    // nothing while you are selecting.
    const placing = sub === 'place';
    const props = mode === 'props' && placing;
    // `kind` picks a SHAPE kind, so it belongs only where the maker MAKES a shape. On a
    // region layer Draw makes a region of that layer, and on Traffic a lane — a granite/floe
    // dropdown there is answering a question nobody asked, the same reason props hide it.
    // And with the kind gone those layers' strip would be empty, so the strip goes too.
    const shapeMaker = mode === 'shape';
    box.hidden = !(shapeMaker && makes) && !props;
    const po = $('place-opts');
    if (po) po.style.display = (mode === 'shape' && placing) ? 'flex' : 'none';
    const pr = $('prop-opts');
    if (pr) pr.style.display = props ? 'flex' : 'none';
    // ⚠️ `.closest('.to-f')`, NOT parentElement: enhanceSelect wraps the select in its own
    // container, so the select's parent is that wrapper and hiding it leaves the cell's
    // "KIND" caption sitting there labelling nothing. The whole cell is what has to go.
    const nk = $('new-kind');
    const cell = nk && nk.closest ? nk.closest('.to-f') : null;
    if (cell) cell.style.display = shapeMaker ? '' : 'none';
}

// The size and heading the next click hands a prop. READ AT THE MOMENT OF PLACEMENT and
// never stored on the document — the same rule `newKind` follows, and for the same reason:
// widening the spread must not reach back and re-roll the thirty knees already down.
//
// ⚠️ Math.random here is deliberate and is NOT the rule this codebase bans. The prohibition
// is on render and physics touching the RNG stream the eval harness replays; this runs on a
// mouse click in an authoring tool and its result is written into the document as a literal
// number. Nothing replays it, and re-opening the file gives back exactly what was placed.
function propJitter() {
    const num = (id, dflt) => {
        const v = parseFloat(($(id) || {}).value);
        return isFinite(v) ? v : dflt;
    };
    let lo = num('prop-min', 100), hi = num('prop-max', 100);
    if (lo > hi) { const t = lo; lo = hi; hi = t; }     // a range typed backwards is still a range
    // The same 0.25-4x clamp propTraits and the whole-course scale already enforce, applied
    // here so a typo cannot author a prop the rest of the pipeline will silently clamp anyway.
    const clamp = (v) => Math.max(25, Math.min(400, v));
    lo = clamp(lo); hi = clamp(hi);
    const scale = (lo + Math.random() * (hi - lo)) / 100;
    const spin = !!($('prop-spin') || {}).checked;
    const out = { heading: spin ? Math.random() * Math.PI * 2 : 0 };
    // Only write `scale` when it says something. A prop at natural size carries no scale
    // field today, and it should keep not carrying one — otherwise every placement adds a
    // line to the diff that means "unchanged".
    if (Math.abs(scale - 1) > 5e-4) out.scale = +scale.toFixed(3);
    return out;
}

// ONE DRAG LAYS A STAND. `count` > 1 scatters that many inside the dragged circle, each with
// its own size and heading from the fields beside it — which is the entire point of the row:
// thirty cypress knees placed one click at a time all came out identical, and identical is
// exactly what the compose.py pipeline exists to avoid on the sprite side.
//
// Mirrors addIce, deliberately: same gesture (drag sizes a circle), same rejection sampling,
// same "place fewer rather than badly" rule when the circle runs out of room.
function addProps(cx, cy, radius, countOverride) {
    if (!doc) return 0;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const kind = ($('prop-kind') || {}).value;
    if (!reg[kind]) return 0;
    // A TAP forces one. `count` says how many fill the circle you drag out, so a gesture that
    // drags no circle is asking for exactly what it pointed at.
    const n = countOverride != null ? countOverride
            : Math.max(1, Math.min(80, parseInt(($('prop-count') || {}).value, 10) || 1));
    const ps = doc.props || (doc.props = []);      // write path creates the array
    const footprint = (k, s) => ((reg[k] || {}).world || 40) * (s || 1) / 2;
    const made = [];
    for (let k = 0; k < n; k++) {
        const j = propJitter();
        const rr = footprint(kind, j.scale);
        let px = cx, py = cy;
        // A count of one goes exactly where you pointed — a tap must not wander, and a drag
        // asking for one thing is still asking for it at the origin.
        if (n > 1) {
            // Keep them off each other: two sprites on one spot read as a single bigger
            // thing, so a scatter that overlaps is not the density it claims. 0.8 rather
            // than 1.0 because vegetation SHOULD touch — a stand with visible gaps around
            // every trunk is a car park.
            let placed = false;
            for (let t = 0; t < 20 && !placed; t++) {
                const a = Math.random() * Math.PI * 2;
                const d = Math.sqrt(Math.random()) * Math.max(0, radius - rr * 0.5);
                px = cx + Math.cos(a) * d; py = cy + Math.sin(a) * d;
                placed = !made.some(o =>
                    Math.hypot(o.x - px, o.y - py) < (footprint(o.kind, o.scale) + rr) * 0.8);
            }
            if (!placed) continue;                 // no room left; fewer, not worse
        }
        let m = 1;
        while (ps.some(p => p.id === 'prop-' + m)) m++;
        const p = Object.assign({ id: 'prop-' + m, kind, x: px, y: py }, j);
        ps.push(p);
        made.push(p);
    }
    if (made.length) {
        // The stand becomes the selection, as a duplicate does: you scatter in order to go
        // on adjusting what you scattered.
        selProp = ps.length - 1;
        selProps = made.map(p => ps.indexOf(p));
        listAnchor = listCursor = -1;
    }
    return made.length;
}

// The circle a prop scatter will fill, while the drag is live. Same dashed-preview idiom as
// the ice placer, in the props layer's own accent so the two gestures are told apart.
function drawPlacedProps() {
    if (!(drag && drag.kind === 'propnew' && drag.r > 0)) return;
    const c = toS(drag.origin.x, drag.origin.y);
    const n = Math.max(1, Math.min(80, parseInt(($('prop-count') || {}).value, 10) || 1));
    ctx.strokeStyle = 'rgba(134,239,172,0.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(c.x, c.y, drag.r * view.scale, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#bbf7d0'; ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.fillText(`${n} × ${($('prop-kind') || {}).value || 'prop'} · ${fmtM(drag.r * 2)} across`,
                 c.x + 8, c.y - 8);
}

// What the next Draw or Place makes. Read at the moment of creation rather than stored, so
// changing it never retroactively re-kinds anything already on the map.
const newKind = () => {
    const el = $('new-kind');
    const k = el && el.value;
    return (k && window.VenueDoc.KINDS[k]) ? k : DEFAULT_KIND;
};

function buildKindPicker() {
    // The prop picker rides along — same one-list rule, VenueDoc.PROP_KINDS is the
    // source — but built for a LIBRARY, not a handful: options land ALPHABETIZED by
    // label, and the dropdown is the searchable variant (enhancePropPicker).
    const pk = $('prop-kind');
    if (pk && !pk.options.length && window.VenueDoc && window.VenueDoc.PROP_KINDS) {
        pk.innerHTML = Object.entries(window.VenueDoc.PROP_KINDS)
            .sort((a, b) => a[1].label.localeCompare(b[1].label))
            .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
        enhancePropPicker(pk);
    }
    const el = $('new-kind');
    if (!el || el.options.length) return;
    el.innerHTML = LAND_TYPES.map(t => `<option value="${t.kind}">${t.label}</option>`).join('');
    // Floe is what Place used to make unconditionally, so it stays the default: the tool
    // whose gesture is "drag out a floe-shaped blob" should still offer a floe first.
    el.value = 'floe';
    // The hint bar names what the armed maker will make, so changing this has to redraw it.
    // A control that silently changes what the NEXT gesture does, with nothing on screen
    // acknowledging the change, is the same as one that does nothing.
    el.addEventListener('change', () => refreshChrome());
    enhanceSelect(el);
}

function selActs() {
    const bar = $('sel-acts');
    if (!bar) return;
    const n = osel.length;
    // Hidden under DIRECT: these are object-level verbs, and Delete in particular means
    // something else there (the selected vertices). A button whose meaning depends on which
    // arrow is armed is a button you have to think about before pressing.
    bar.hidden = n === 0 || sub === 'direct';
    if (bar.hidden) return;
    const kinds = new Set(osel.map(o => o.kind));
    const noun = kinds.size > 1 ? 'objects'
               : osel[0].kind === 'shape' ? (n === 1 ? 'shape' : 'shapes')
               : osel[0].kind === 'arena' ? 'arena'
               : (n === 1 ? 'region' : 'regions');
    $('sel-acts-n').textContent = osel[0].kind === 'arena' ? 'arena' : `${n} ${noun}`;
    // The arena is the one polygon there is exactly one of, so it can be respaced but
    // neither copied nor removed — a course with no bounds is not a course.
    const onlyArena = kinds.size === 1 && kinds.has('arena');
    $('btn-sel-dup').disabled = onlyArena;
    $('btn-sel-del').disabled = onlyArena;
    // Booleans need two or more of the SAME kind. Rather than hide them (leaving you to
    // guess why they vanished), they stay put, disabled, with the reason in the tooltip.
    const why = oselBooleanWhy();
    for (const [id, verb] of [['btn-sel-union', 'Merge them into one'],
                              ['btn-sel-intersect', 'Keep only what they all share'],
                              ['btn-sel-subtract', 'Remove the others from the first one selected'],
                              ['btn-sel-exclude', 'Cut the others out of the first one CLICKED, and keep them'],
                              ['btn-sel-symdiff', 'Keep what only ONE of them covers — the overlap goes']]) {
        const b = $(id);
        if (!b) continue;
        b.disabled = !!why;
        b.title = why ? `Cannot: ${why}` : verb;
    }
}

// ── Tool strip ──────────────────────────────────────────────────────────────
// Tools act on whatever the active layer owns, which is why there are five of them and
// not five per layer: select, draw, and the two brushes are the same gestures whatever
// outline you point them at, and the ruler belongs to no layer at all.
const TOOLS = [
    // `enabled` is per LAYER: a tool that cannot act on what you are editing is shown
    // inactive rather than left to fail silently when you reach for it.
    // The two arrows. Select picks WHOLE polygons — that is the level booleans, duplicate and
    // delete act at. Direct picks their vertices. Filled arrow / hollow arrow is the same
    // shorthand Illustrator, Inkscape and Affinity all use, so it reads without a legend.
    { id: 'select', key: 'V', name: 'Select', icon: '<path d="M4 3l9 6.5-4 .6L7.6 14z" fill="currentColor"/>',
      on: () => sub === 'drag' && !drawing,
      enabled: () => mode !== 'map' && mode !== 'water' },
    { id: 'direct', key: 'A', name: 'Direct', icon: '<path d="M4 3l9 6.5-4 .6L7.6 14z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
      on: () => sub === 'direct', enabled: () => modeObjects().length > 0 },
    { id: 'draw', key: 'P', name: 'Draw', icon: '<path d="M8 2.5l5 4-2 6H5l-2-6z" stroke="currentColor" stroke-width="1.3" fill="none"/>',
      on: () => drawing, enabled: () => mode === 'shape' || mode === 'traffic' || isRegionMode(mode) },
    // The brushes act on whatever outline falls under the disc, so they are enabled wherever
    // this layer HAS outlines — land, ice, the arena, a wind or current region.
    { id: 'sculpt', key: 'S', name: 'Sculpt', icon: '<circle cx="8" cy="8" r="4.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/>',
      on: () => sub === 'sculpt', enabled: () => brushRings().length > 0 },
    { id: 'smooth', key: 'G', name: 'Smooth', icon: '<path d="M2 11c3 0 3.5-6 6-6s3 4 6 4" stroke="currentColor" stroke-width="1.3" fill="none"/>',
      on: () => sub === 'smooth', enabled: () => brushRings().length > 0 },
    { id: 'roughen', key: 'R', name: 'Roughen', icon: '<path d="M1.5 10.5l2-3.5 1.6 2 2.4-4.5 1.8 3.5 1.6-2 3.6 5.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>',
      on: () => sub === 'roughen', enabled: () => brushRings().length > 0 },
    { id: 'simplify', key: 'E', name: 'Simplify', icon: '<path d="M2 11.5C5 11.5 7 4.5 10.5 4.5c1.8 0 2.8 1.2 3.5 2.2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="2" cy="11.5" r="1.5" fill="currentColor"/><circle cx="10.5" cy="4.5" r="1.5" fill="currentColor"/>',
      on: () => sub === 'simplify', enabled: () => brushRings().length > 0 },
    // CREATING a venue object is its own verb. It used to be what the Select arrow did on
    // empty water in Venue mode — so on that one layer the object arrow created instead of
    // selecting, and Venue could not have the marquee, multi-select and group transforms
    // every other layer has. Draw (P) is not the same gesture: that one clicks out a polygon
    // point by point, this one drags a size and scatters to a density.
    { id: 'place', key: 'N', name: 'Place', icon: '<circle cx="8" cy="9" r="4" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M12.5 3.5v4M10.5 5.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      on: () => sub === 'place',
      // PROPS JOINED FOR THE REASON THE COMMENT ABOVE DESCRIBES. Placing on the Select arrow
      // cost props the same thing it once cost Venue: with a click on open water meaning
      // "create", empty water was never free for a marquee, so props had no multi-select at
      // all. Arming Place gives it back, and costs one key (N).
      enabled: () => (mode === 'shape' || mode === 'props') && !!doc },
    { id: 'measure', key: 'M', name: 'Measure', icon: '<path d="M2.5 9.5l7-7 4 4-7 7z" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M5 7l1.5 1.5M7 5l1.5 1.5" stroke="currentColor" stroke-width="1.1"/>',
      on: () => sub === 'measure' }         // a gesture, not a place: no layer required
];
let toolBuilt = false;
function toolStrip() {
    const box = $('tool-strip');
    if (!box) return;
    if (!toolBuilt) {
        box.innerHTML = TOOLS.map(t =>
            `<button class="tl" data-tool="${t.id}" title="${t.name} (${t.key})">`
            + `<svg viewBox="0 0 16 16" width="17" height="17">${t.icon}</svg></button>`).join('');
        box.querySelectorAll('[data-tool]').forEach(el =>
            el.addEventListener('click', () => pickTool(el.dataset.tool)));
        toolBuilt = true;
    }
    for (const t of TOOLS) {
        const el = box.querySelector(`[data-tool="${t.id}"]`);
        const ok = !t.enabled || t.enabled();
        // Never highlight a tool that cannot act here: "active and unavailable" is a state
        // the user has to reconcile, and there is nothing to reconcile it to.
        el.classList.toggle('on', ok && !!t.on());
        el.disabled = !ok;
        el.style.opacity = ok ? '' : '.35';
    }
}
function pickTool(id) {
    if (id === 'draw') {
        // Only jump to Land from a layer that cannot draw at all. Forcing the layer switch
        // unconditionally meant arming Draw on Wind silently took you somewhere else.
        if (mode !== 'shape' && !isRegionMode(mode)) setMode('shape');
        drawing = !drawing; if (!drawing) { pending = null; extendLane = null; }
        sub = 'drag';
    } else {
        drawing = false; pending = null; extendLane = null;
        sub = (id === 'select') ? 'drag' : id;
        if (sub !== 'measure') boatProbe = null;   // the boat is part of the ruler
    }
    refreshChrome(); draw();
}

// ── Hint bar ────────────────────────────────────────────────────────────────
// What this tool does with the modifiers, spelled out. The gestures are consistent across
// layers, so this is short — which is the point of making them consistent.
const MODS = {
    // GESTURES only. Duplicate and Delete are buttons on the selection bar with their keys
    // in the tooltip, so repeating them here just crowded the row until it truncated —
    // the hint bar is for the things that have no visible affordance.
    select: () => mode === 'traffic'
        ? ['click a lane to select it', 'drag a waypoint to move it', 'drag the lane to slide it all',
           'double-click the lane adds a waypoint', '⌫ deletes the waypoint, or the vessel']
        : ['click picks a whole shape', '⇧ click adds', 'drag a box to select several',
           '⌘ drag rotate', '⌥ drag scale'],
    direct: ['click picks a vertex', '⇧ click adds', 'drag a box to select several',
             'double-click an edge inserts', '⌫ delete'],
    // A FUNCTION, not an array: Place means two different gestures depending on the layer,
    // and this object is a top-level literal — a `mode === ...` written inline here would be
    // evaluated once at load, when the mode is not yet the one being asked about.
    place: () => mode === 'props'
        ? ['tap to place one', 'drag a circle — the count on the left fills it',
           'Select (V) to marquee what you placed']
        : ['drag out a floe — the drag sets its size', 'tap for a default one',
           'scatter on the left drops several per drag'],
    // A FUNCTION for the same reason `place` is one: Draw means an OPEN lane on Traffic and a
    // closed ring everywhere else, and the two end differently — a lane has no first point to
    // click back to.
    draw: () => mode === 'traffic'
        ? ['click to drop waypoints', '⏎ or double-click ends the lane',
           'click an end of the selected lane to extend it', 'esc cancels']
        : ['click to drop points', '⏎ or double-click closes', 'click the first point to close',
           'esc cancels'],
    sculpt: ['drag to pull nearby vertices', '[ ] brush size'],
    smooth: ['drag to relax wobble', '[ ] brush size'],
    roughen: ['paint along an edge to add detail', '[ ] brush', '⇧ [ ] detail scale'],
    simplify: ['paint to thin points out', '[ ] brush', '⇧ [ ] tolerance'],
    measure: ['drag to measure', '⇧ click extends the path', 'B shows a boat', 'esc clears']
};
// What the ACTIVE TOOL does on the ACTIVE LAYER — and nothing else. On the Course layer
// almost none of the gestures apply, so listing them would be five pieces of wrong advice.
function hintBar() {
    const usable = (x) => !x.enabled || x.enabled();
    const t = TOOLS.find(x => x.on() && usable(x));
    const key = $('hint-key'), name = $('hint-tool');
    if (!t) {
        // No tool is armed that can act here. Say so, rather than promoting whichever tool
        // happens to be available — a keycap next to a name reads as "this is selected".
        key.hidden = true;
        name.textContent = 'Nothing to edit on this layer';
        $('hint-mods').innerHTML = '<span class="mod">pick a layer to edit it</span>'
            + '<span class="mod">M to measure</span>'
            + '<span class="mod">right- or middle-drag pans · wheel zooms</span>';
        return;
    }
    key.hidden = false;
    key.textContent = t.key;
    // A MAKER says what it will make. The kind picker's answer applies only where the
    // maker makes a SHAPE — on a region layer Draw makes a region of that layer, and
    // saying "Draw — Floe" there was the picker's wrong answer leaking into the hint.
    const kindLabel = mode === 'shape' ? (LAND_TYPES.find(x => x.kind === newKind()) || {}).label : null;
    const propKind = mode === 'props' ? ($('prop-kind') || {}).value : null;
    name.textContent = (t.id === 'place' && propKind) ? `${t.name} — ${propKind}`
        : ((t.id === 'draw' || t.id === 'place') && kindLabel) ? `${t.name} — ${kindLabel}`
        : (t.id === 'draw' && isRegionMode(mode)) ? `${t.name} — ${mode} region`
        : (t.id === 'draw' && mode === 'traffic') ? `${t.name} — lane`
        : t.name;
    const m0 = MODS[t.id];
    const mods = (typeof m0 === 'function' ? m0() : m0) || [];
    $('hint-mods').innerHTML = mods.map(m => `<span class="mod">${m}</span>`).join('')
        || '<span class="mod">right- or middle-drag pans · wheel zooms</span>';
}

// ── Stats band ──────────────────────────────────────────────────────────────
function statsRefresh() {
    if (!$('stat-dist')) return;
    const est = estimate;
    const authored = doc && doc.course.cutoff != null;
    const d2 = doc ? window.VenueDoc.compile(doc) : null;
    const cutoff = authored ? doc.course.cutoff : (d2 ? d2.cutoffAuto || 0 : 0);
    // FROM THE PATH, the same geometry DMC ranks on and the route layer draws — so the
    // header, the drawn leg lengths and the leaderboard all quote one course. SailCheck's
    // grid estimate stays in the checks panel; it answers a different question ("is this
    // sailable at hull width"), and having it drive the headline meant the number and the
    // picture could disagree.
    const pathSecs = d2 && d2.estSecs;
    $('stat-dist').textContent = d2 && d2.sailedDist ? fmtM(d2.sailedDist) : (est ? fmtM(est.dist) : '—');
    $('stat-best').textContent = pathSecs ? mmss(pathSecs) : (est ? mmss(est.secs) : '—');
    // Coloured on the BEST TIME itself. The old form scaled it by 1.35 to guess a fleet mean
    // and judged that against the 3–5 minute target — a second model layered on the first,
    // from before the limit was simply twice the best. One number, judged directly.
    const baseSecs = pathSecs || (est ? est.secs : 0);
    const band = baseSecs >= 90 && baseSecs <= 150;
    $('stat-best').className = 'st-v num' + (baseSecs ? (band ? ' ok' : ' warn') : '');
    $('stat-best').title = baseSecs
        ? `${mmss(baseSecs)} best — ${band ? 'inside' : 'outside'} the 1:30–2:30 target, so a ${mmss(Math.max(60, Math.ceil(baseSecs * 2 / 60) * 60))} limit`
        : '';
    $('stat-limit').textContent = cutoff ? mmss(cutoff) : '—';
    $('stat-limit').title = authored ? 'authored' : 'derived, and blind to the land the path goes around';
    $('stat-legs').textContent = doc ? Math.max(1, routeOf().length - 1) : '—';

    const n = (lv) => findings.filter(f => f.level === lv).length;
    const e = n('error'), w = n('warn');
    $('tally-body').innerHTML =
        `<span class="dot ${e ? 'err' : w ? 'warn' : 'ok'}"></span>`
        + `<span style="font-weight:600">${e ? `${e} error` : w ? `${w} warning${w > 1 ? 's' : ''}` : 'all clear'}</span>`
        + `<span class="dim" style="font-size:12px">${n('ok')} ok</span>`;
}

// ── Rendering ───────────────────────────────────────────────────────────────
function bounds() {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    const add = (x, y) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); };
    const bd = course && course.boundary;
    if (bd) { add(bd.x - bd.radius, bd.y - bd.radius); add(bd.x + bd.radius, bd.y + bd.radius); }
    if (doc) for (const l of doc.shapes) for (const p of l.outer) add(p[0], p[1]);
    else if (course) for (const i of (course.islands || [])) for (const v of (i.vertices || [])) add(v.x, v.y);
    if (!isFinite(a)) { a = b = -2000; c = d = 2000; }
    return { a, b, c, d };
}
function fitView() {
    const { a, b, c, d } = bounds();
    view.x = (a + c) / 2; view.y = (b + d) / 2;
    view.scale = Math.min(W() / (c - a + 400), H() / (d - b + 400)) || 0.1;
    draw();
}
// The read-outs say something before the pointer has moved: three dashes tell you nothing
// about where the view is.
function hudIdle() {
    if (!$('hud')) return;
    $('hud').textContent = `${Math.round(uToM(view.x))}, ${Math.round(uToM(view.y))} m`;
    $('hud-zoom').textContent = `${view.scale.toFixed(3)}×`;
}

function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
}

function ringPath(ring) {
    ring.forEach((p, i) => { const s = toS(p[0], p[1]); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    ctx.closePath();
}

// ── Layer painters ──────────────────────────────────────────────────────────
// One per layer, so draw() can REORDER them. Each keeps its own visibility gate: the
// eye in the layer list decides whether a layer paints at all, this decides when.
function drawArenaLayer() {
    // Drawn from the DOCUMENT when there is one, so a boundary edit shows while the
    // drag is still in progress rather than only after the recompile.
    // ⚠️ EVERY visibility gate has to cover BOTH sources. The editor draws from the document
    // when there is one and falls back to the compiled course when there is not — so nulling
    // the document source alone just switches to the fallback and draws the layer anyway.
    // That happened here and with land: the eye said hidden, the map disagreed.
    const dbd = (doc && shown('arena')) ? doc.world.boundary : null;
    // Selected reads the same here as anywhere else: the accent, and heavier. Hovered gets
    // the halfway colour, so pointing at it says it is grabbable before you press.
    const arenaOn = inOsel({ kind: 'arena' });
    const arenaHot = mode === 'boundary' && !arenaOn && hover.bvert < 0
                     && sub === 'drag' && lastMouse
                     && doc && doc.world.boundary.poly
                     && pointInRing(lastMouse.w.x, lastMouse.w.y, doc.world.boundary.poly);
    ctx.strokeStyle = arenaOn ? '#38bdf8' : arenaHot ? '#93c5fd' : '#475569';
    ctx.setLineDash([6, 6]); ctx.lineWidth = arenaOn ? 2.5 : 1.5;
    if (!shown('arena')) {
        ctx.setLineDash([]);
    } else if (dbd && dbd.poly && dbd.poly.length >= 3) {
        ctx.beginPath(); ringPath(dbd.poly); ctx.stroke();
        // A wash inside it, so "the arena is selected" is legible without hunting for a
        // 2px dashed line that runs off all four edges of the screen.
        if (arenaOn) {
            ctx.fillStyle = 'rgba(56,189,248,0.07)';
            ctx.beginPath(); ringPath(dbd.poly); ctx.fill();
        }
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
        // Handles are drawn LAST (see drawBoundaryHandles below), not here: the arena
        // edge usually runs through land, and land is painted after this, so the handles
        // were buried and could not be seen or grabbed.
    } else {
        const bd = dbd && dbd.circle ? { x: dbd.circle.x, y: dbd.circle.y, radius: dbd.circle.r }
                                     : (course && course.boundary);
        if (bd) {
            const c = toS(bd.x, bd.y);
            ctx.beginPath(); ctx.arc(c.x, c.y, bd.radius * view.scale, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.setLineDash([]);
    }
    ctx.setLineDash([]);
}
function drawDriftingFloes() {
    // Drifting ice first, so authored land reads on top of it.
    for (const f of floes) {
        if (!f.vertices) continue;
        ctx.beginPath();
        f.vertices.forEach((v, i) => { const s = toS(v.x, v.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
        ctx.closePath();
        ctx.fillStyle = 'rgba(125,211,252,0.5)'; ctx.fill();
        ctx.strokeStyle = 'rgba(125,211,252,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    }
}
// What each KIND is painted as. The game has its own palette (ISLAND_STYLES); this is the
// schematic's, which reads flatter on purpose — you are looking at topology, not at weather.
// Shoal is TRANSLUCENT sand, the same device a floe already uses for "this one is not
// solid" — you can see the water through it, which is the one thing that separates it from
// Sand at a glance. The schematic still gives it a solid outline where the game gives it a
// gradient: here you are dragging vertices and you have to be able to see where they are.
const KIND_FILL = {
    granite: '#8d8d8d', karst: '#5d6068', redrock: '#c2703e', reed: '#7aaa1d', swampgrass: '#a09453',
    isle: '#e8dcb1', ice: '#e8edf5', bank: '#6b7280', floe: 'rgba(125,211,252,0.55)',
    shoal: 'rgba(232,220,177,0.38)',
    // The painted water zones are translucent like the shoal — you can see the water
    // through everything that is not land — but in their own hues, because the ONE
    // schematic question about a zone is which kind you are looking at. Before these
    // rows they fell through to the isle fallback and drew as solid islands.
    shallows: 'rgba(56,189,248,0.30)', seagrass: 'rgba(74,113,72,0.45)',
    // The tropic bar's schematic hue is its ON-SCREEN mint (sand seen through lagoon
    // water), not the raw sand — that is the colour that separates it from Sand Shoal
    // at a glance, which is the schematic's one job.
    tropicsand: '#efe4cf', tropicshoal: 'rgba(141,212,195,0.38)',
    // Translucent like the other underwater kinds, in the band's own khaki — an
    // impassable bottom must not read as either sand (crossable) or land (dry).
    coralreef: 'rgba(138,132,104,0.38)',
    // Bluewater Bonanza's two new grounds. Both are DRY LAND, so both are solid, per this
    // table's rule that only what you may sail over is translucent — which is also the one
    // thing that tells Coral Limestone from the translucent Coral Reef directly above it.
    coralrock: '#A7A193', tropicscrub: '#A9AF2A',
    // Stillwater Lake. All three are dry land, so all three are solid.
    forestfloor: '#7C633D', lakesand: '#B7A487', gneiss: '#807A7F',
    // The bayou. Its two DRY grounds are solid, like every other land kind; everything
    // that is awash is translucent, which is the schematic's one consistent rule — you
    // can see the water through anything you are allowed to sail over. The four weeds
    // step up in opacity in the order they step up in coverage (bed < pads < mat <
    // film), so density is legible at a glance without reading a label.
    mud: '#524731', marsh: '#685c37',
    mudflat: 'rgba(110,100,73,0.42)',
    weedbed: 'rgba(42,68,40,0.38)', lilybed: 'rgba(96,128,62,0.46)',
    weedmat: 'rgba(92,126,64,0.62)', duckweed: 'rgba(132,166,76,0.55)',
    // ⚠️ LIGHTHOUSE COVE'S TWO GROUNDS, AND THE REASON THIS TABLE IS EASY TO FORGET.
    // A new land kind needs FIVE rows — SHAPE_KINDS, ISLAND_STYLES, LAND_TEXTURES,
    // LAND_TYPES and this — and only the miss here is silent. The fill lookup below is
    // `KIND_FILL[kind] || KIND_FILL.isle`, so a kind with no row does not draw wrong in an
    // obvious way or throw: it draws as SAND, which is a real material and looks deliberate.
    // Coastal Rock and Coastal Scrub both shipped like that for exactly one session, and
    // they were indistinguishable from Coastal Sand in the schematic while the game itself
    // rendered them correctly — the worst possible split, because the editor is where you
    // would look. Both grounds are dry land, so both are solid, per this table's rule that
    // only what you may sail over is translucent.
    coastalrock: '#a19481', coastalscrub: '#a3a745', lane: '#cac2ad',
    // Sockeye Run's four. All dry land, so all solid per this table's rule that only what you
    // may sail over is translucent. Values are the delivered tile means, same as the chips.
    cobble: '#6E6B65', meadow: '#929738', outcrop: '#999C9E', humus: '#352B19',
    // Translucent, per this table's rule that only what you may sail over is — the cobble
    // bar's own stone at the same 0.38 the two sand bars use.
    cobbleshoal: 'rgba(110,107,101,0.38)',
    mossfloor: '#618414',
    // Submerged Rock — underwater, so translucent by this table's rule, but the MOST opaque
    // of the translucent kinds on purpose. It is the one shape here that is both under the
    // water and a wall, and the schematic's job is to keep those two facts from cancelling:
    // at the shoal's 0.38 it would read as something you may sail over, which is exactly the
    // mistake this object exists to punish. Coral Reef is the same category and sits at 0.38
    // because a lagoon is otherwise all bright sand; against Glowtide's dark rock the stone
    // grey needs the weight instead.
    sunkenrock: 'rgba(86,95,111,0.66)',
    // Dry land, so solid per this table's rule that only what you may sail over is
    // translucent — and the schematic is the one place this ground is NOT seen through the
    // night wash, so it draws here as the leaf-litter brown the tile actually is rather than
    // the near-black the venue shows it as.
    jungle: '#413715',
    // Redrock Reservoir's two new grounds. Both dry land, so both solid per this table's
    // rule that only what you may sail over is translucent. Values are the spec bodies;
    // update to delivered tile means on ingest, with the chips.
    slickrock: '#E3D0AF', desertsand: '#D2996B'
};
const KIND_EDGE = {
    granite: '#c9c9c9', karst: '#aab0bb', redrock: '#8a4a26', reed: '#5c8438', swampgrass: '#7d7048',
    isle: '#d4b483', ice: '#ffffff', bank: '#9ca3af', floe: 'rgba(224,242,254,0.7)',
    shoal: 'rgba(232,220,177,0.75)',
    shallows: 'rgba(56,189,248,0.8)', seagrass: 'rgba(122,160,120,0.9)',
    tropicsand: '#d9cba9', tropicshoal: 'rgba(141,212,195,0.8)',
    coralreef: 'rgba(138,132,104,0.85)',
    // Each is its own ISLAND_STYLES stroke, so the schematic outline is the colour the game
    // draws that coastline in — the coastalrock/coastalscrub rule.
    coralrock: '#757268', tropicscrub: '#838621',
    // Sockeye Run. Each is its own ISLAND_STYLES stroke by the coastalrock/coastalscrub rule
    // above. ⚠️ THESE WERE MISSING and the lookup is `KIND_EDGE[kind] || KIND_EDGE.isle`, so
    // all four had been outlining themselves in beach sand — the same silent fallback the
    // KIND_FILL note warns about, one table over.
    cobble: '#4E4C48', meadow: '#5E6C38', outcrop: '#5E656D', humus: '#221C10',
    cobbleshoal: 'rgba(110,107,101,0.75)',
    mossfloor: '#3E5A0E',
    forestfloor: '#543F21', lakesand: '#958469', gneiss: '#4E4B54',
    mud: '#3d3421', marsh: '#4d4324',
    mudflat: 'rgba(110,100,73,0.8)',
    weedbed: 'rgba(74,112,74,0.85)', lilybed: 'rgba(140,176,100,0.9)',
    weedmat: 'rgba(150,182,110,0.9)', duckweed: 'rgba(178,208,120,0.9)',
    // Each is its own ISLAND_STYLES stroke, so the schematic outline is the same colour the
    // game draws the coastline in. Darker than the fill, with the earth and vegetation kinds
    // above rather than lighter with granite and karst: these two are neither bright enough
    // to need a light edge nor dark enough to lose a dark one.
    coastalrock: '#6f6556', coastalscrub: '#7d7e3c', lane: '#afa898',
    // Bright against its own fill rather than darker, the way granite and karst are: this is
    // the outline you drag vertices on, and it sits on near-black water.
    sunkenrock: 'rgba(154,160,172,0.9)',
    // Its own ISLAND_STYLES stroke, per the coastalrock/coastalscrub rule — and darker than
    // its fill with the earth kinds rather than lighter with granite and karst, because a
    // jungle cap is usually drawn INSIDE a karst island and its outline is an inland boundary
    // against a lighter ground, not a coastline against water.
    jungle: '#26210E',
    // Each is its own ISLAND_STYLES stroke, per the coastalrock/coastalscrub rule — darker
    // than the fill, with the earth kinds: pale grounds on bright water need no light edge.
    slickrock: '#AD9E85', desertsand: '#976E4D'
};

function drawLandLayer() {
    // EVERY shape, in the order the document stacks them — which is the order the game
    // paints them, so what you arrange here is what you get. It used to be two painters,
    // one per layer, and a floe could not be put behind a headland in either.
    const shapes = doc ? doc.shapes : null;
    if (shapes && shown('land')) {
        for (const l of shapes) {
            const kind = TR(l).kind;
            ctx.beginPath();
            for (const ring of eachRing(l)) ringPath(ring);
            ctx.fillStyle = KIND_FILL[kind] || KIND_FILL.isle;
            ctx.fill('evenodd');                            // holes
            const selected = inOsel({ kind: 'shape', id: l.id }) || sel.shape === l.id;
            const hovered = hover.shape === l.id;
            ctx.strokeStyle = selected ? '#38bdf8' : hovered ? '#93c5fd'
                            : (KIND_EDGE[kind] || KIND_EDGE.isle);
            ctx.lineWidth = selected ? 2.5 : 1;
            // A hidden shape is a collider nobody sees in the game. It has to be visible
            // HERE — it is still something you can select, move and reshape — so it is
            // drawn as an outline rather than a solid, which is what "not really there" looks like.
            if (TR(l).hidden) { ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]); }
            else ctx.stroke();
        }
        // Vertices of the SELECTED shape only — 137 dots everywhere is noise, and a handle
        // that is drawn but not grabbable (or grabbable but not drawn) is worse than none.
        if (sel.shape && mode === 'shape' && sub === 'direct') {
            for (const l of shapes) {
                if (sel.shape !== l.id) continue;
                for (const ring of eachRing(l)) {
                    ring.forEach((p, i) => {
                        const s = toS(p[0], p[1]);
                        const on = hover.shape === l.id && hover.vert === i;
                        const rad = on ? 8 : 5.5;
                        // Dark ring under the fill: a handle has to be visible against
                        // white land AND navy water, and a single flat colour is not.
                        ctx.beginPath(); ctx.arc(s.x, s.y, rad + 1.5, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(8,15,30,0.75)'; ctx.fill();
                        ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
                        ctx.fillStyle = on ? '#7dd3fc' : '#38bdf8'; ctx.fill();
                    });
                }
            }
        }
    } else if (course && !doc && shown('land')) {
        // Generated venue: no document to draw, so the compiled islands stand in. Guarded on
        // `!doc` as well, or hiding the Land layer silently swapped to this other source and
        // drew the land anyway.
        for (const i of (course.islands || [])) {
            if (!i.vertices) continue;
            ctx.beginPath();
            i.vertices.forEach((v, k) => { const s = toS(v.x, v.y); k ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
            ctx.closePath();
            ctx.fillStyle = '#e8edf5'; ctx.fill('evenodd');
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
        }
    }
}
function drawCourseLayer() {
    // Draw the ROUTE: every gate/line with its crossing direction, every rounding
    // with its zone and side. Previously this drew marks[0..1] and a single
    // roundMark, which is only correct for the two course shapes that used to exist.
    const dmarks = doc ? doc.course.marks : (course ? course.marks : []);
    const droute = doc ? doc.course.route : (course ? (course.route || []) : []);
    const croute = course ? (course.route || []) : [];

    // Indicators are sized in WORLD units so they stay attached to the thing they
    // describe as you zoom, then clamped in screen space so they neither vanish when
    // zoomed out nor swallow the map when zoomed in. Previously the line's arrow was
    // fixed screen pixels while the rounding arc scaled, so the two disagreed.
    const screenClamp = (world, lo, hi) => Math.max(lo, Math.min(hi, world * view.scale));
    const arrow = (fromS, nx, ny, colour, len) => {
        const tip = { x: fromS.x + nx * len, y: fromS.y + ny * len };
        const head = Math.max(5, Math.min(16, len * 0.28));
        ctx.strokeStyle = colour; ctx.fillStyle = colour;
        ctx.lineWidth = Math.max(1.5, Math.min(4, len * 0.06));
        ctx.beginPath(); ctx.moveTo(fromS.x, fromS.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(tip.x - ny * head * 0.62 - nx * head, tip.y + nx * head * 0.62 - ny * head);
        ctx.lineTo(tip.x + ny * head * 0.62 - nx * head, tip.y - nx * head * 0.62 - ny * head);
        ctx.closePath(); ctx.fill();
    };

    // ── THE COURSE PATH ─────────────────────────────────────────────────────
    // The ruler DMC is measured on: the land-avoiding route from the previous target to
    // this one, including the arc round a rounding mark. Drawn from `course.dmc`, which is
    // literally the object the game ranks with, so what a designer sees here is what the
    // leaderboard will use — not a second implementation that can drift from it.
    //
    // It tracks a drag LIVE: the mark/gate drag arms call livePathRefresh(), which
    // remaps the compiled marks and rebuilds just the planner path, so the route bends
    // while you move the mark instead of snapping on release.
    //
    // In marks mode the WHOLE course path draws, faint — that is the mode marks are
    // dragged in, so it is where the live rebuild has to be visible.
    if (mode === 'marks' && course && course.dmc) {
        for (const L of course.dmc.legs) {
            if (!L.pts || L.pts.length < 2) continue;
            const sp = L.pts.map(q => toS(q.x, q.y));
            for (const pass of [{ w: 5, c: 'rgba(6,14,26,0.35)' }, { w: 2, c: 'rgba(34,211,238,0.55)' }]) {
                ctx.strokeStyle = pass.c; ctx.lineWidth = pass.w;
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y);
                for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].x, sp[i].y);
                ctx.stroke();
            }
        }
    }
    if (mode === 'route' && selRoute >= 0 && course && course.dmc && course.dmc.legs[selRoute]) {
        const L = course.dmc.legs[selRoute];
        if (L.pts.length >= 2) {
            const sp = L.pts.map(q => toS(q.x, q.y));
            // Dark under-stroke first: this crosses pale ice and dark water on the same
            // venue, and a single-colour line disappears into one of them.
            for (const pass of [{ w: 7, c: 'rgba(6,14,26,0.55)' }, { w: 3, c: '#22d3ee' }]) {
                ctx.strokeStyle = pass.c; ctx.lineWidth = pass.w;
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y);
                for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].x, sp[i].y);
                ctx.stroke();
            }
            // Its LENGTH, in metres, at the midpoint — the number the designer is actually
            // shaping, and the one the race-length estimate is built from.
            let half = 0;
            while (half < L.cum.length - 2 && L.cum[half + 1] < L.length / 2) half++;
            const mid = sp[half];
            const label = `${Math.round(uToM(L.length))} m`;
            ctx.font = '600 12px ui-monospace, monospace';
            const w = ctx.measureText(label).width + 12;
            ctx.fillStyle = 'rgba(6,14,26,0.82)';
            ctx.beginPath(); ctx.roundRect(mid.x - w / 2, mid.y - 26, w, 18, 4); ctx.fill();
            ctx.fillStyle = '#a5f3fc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(label, mid.x, mid.y - 17);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
    }

    (shown('route') ? droute : []).forEach((e, li) => {
        if (e.kind === 'round') {
            // Zone and side come from the COMPILED entry, which resolved the defaults —
            // but the POSITION comes from the document, so dragging the mark takes the
            // zone circle and the rounding arrow with it instead of leaving them behind
            // until the next commit.
            const cm = (croute[li] && croute[li].mark) || null;
            if (!cm) return;
            const dm = doc ? dmarksOf()[markIndex(e.markId)] : null;
            const at = dm ? { x: dm.x, y: dm.y } : { x: cm.x, y: cm.y };
            const p = toS(at.x, at.y);
            const zr = (e.zone != null ? e.zone : cm.zone) * view.scale;
            const litR = hoverRoute === li;
            if (litR) {
                ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(p.x, p.y, zr, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.strokeStyle = '#fbbf24'; ctx.setLineDash([4, 5]); ctx.lineWidth = tool === 'mark' ? 2.5 : 1.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, zr, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            // Which way round: an arc with an arrowhead, so "starboard" is something
            // you can see rather than a word in a panel.
            // Centre and ring handles only in Marks mode, matching what is grabbable.
            // The zone ring itself always draws — it is course information, not a handle.
            if (mode !== 'marks') { drawRoundArc(p, zr, cm); return; }
            // Centre glyph: a crosshair plus a solid dot, so the mark being rounded is
            // unmistakable even when it sits on top of a grey island.
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x - 13, p.y); ctx.lineTo(p.x + 13, p.y);
            ctx.moveTo(p.x, p.y - 13); ctx.lineTo(p.x, p.y + 13);
            ctx.stroke();
            const onC = hover.rcentre === li;
            ctx.beginPath(); ctx.arc(p.x, p.y, onC ? 8 : 6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(8,15,30,0.85)'; ctx.fill();
            ctx.beginPath(); ctx.arc(p.x, p.y, onC ? 6 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = onC ? '#fde68a' : '#fbbf24'; ctx.fill();
            // A grab handle on the ring itself, so resizing is discoverable rather than
            // something you find by dragging hopefully.
            const hx = p.x + zr, hy = p.y;
            const onR = hover.rring === li;
            ctx.beginPath(); ctx.arc(hx, hy, onR ? 7 : 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(8,15,30,0.85)'; ctx.fill();
            ctx.beginPath(); ctx.arc(hx, hy, onR ? 5.5 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = onR ? '#fde68a' : '#fbbf24'; ctx.fill();

            drawRoundArc(p, zr, cm);
            return;
        }
        // A leg names a LINE; the line names its marks. Resolved from the document, not
        // from the compiled course, so a drag redraws before any recompile.
        const ends = doc ? entryEnds(e) : (e.marks ? [dmarks[e.marks[0]], dmarks[e.marks[1]]] : null);
        if (!ends || !ends[0] || !ends[1]) return;
        const m0 = ends[0], m1 = ends[1];
        const A = toS(m0.x, m0.y), B = toS(m1.x, m1.y);
        // First and last entries by POSITION — the route order is what makes them the
        // start and the finish.
        const isStart = li === 0 || li === droute.length - 1;
        // ONE ENTRY AT A TIME when a row is picked out. A shared start/finish line is
        // crossed in both directions, so drawing every entry's arrow at once put a saltire
        // on the line and said nothing about which crossing you were looking at. With a
        // row hovered or selected, only that leg's arrow draws.
        const picked = (hoverRoute >= 0) ? hoverRoute : selRoute;
        const lit = picked === li;
        const sameLine = picked >= 0 && droute[picked] && e.lineId != null
                         && droute[picked].lineId === e.lineId;
        const muted = picked >= 0 && !lit && sameLine;
        ctx.strokeStyle = lit ? '#fff' : isStart ? '#38bdf8' : '#a3e635';
        ctx.lineWidth = lit ? 4 : 2.5;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        if (muted) return;                      // its twin is the one being shown
        // Crossing direction: `dir` times the gate normal n = (dy, -dx). Getting this
        // backwards is invisible until sailed, so it is always drawn.
        const ds = e.dir || 1;
        let nx = (m1.y - m0.y) * ds, ny = -(m1.x - m0.x) * ds;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        // Proportional to the line itself — about a third of its length — so it reads
        // as belonging to that line at any zoom.
        const lineLen = Math.hypot(m1.x - m0.x, m1.y - m0.y);
        const len = screenClamp(lineLen * (lit ? 0.5 : 0.33), 16, lit ? 130 : 90);
        arrow({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, nx, ny,
              lit ? '#fff' : isStart ? '#38bdf8' : '#a3e635', len);
        // Say which crossing this is, so "start" and "finish" on one line are told apart.
        if (lit) {
            const label = li === 0 ? 'START' : li === droute.length - 1 ? 'FINISH'
                        : (e.pass === 'through' ? 'THROUGH' : 'IN, THEN ROUND AN END');
            ctx.font = '800 11px Archivo, system-ui, sans-serif';
            const tw = ctx.measureText(label).width;
            const tx = (A.x + B.x) / 2 + nx * (len + 10), ty = (A.y + B.y) / 2 + ny * (len + 10);
            ctx.fillStyle = 'rgba(8,15,30,0.85)';
            ctx.fillRect(tx - tw / 2 - 5, ty - 9, tw + 10, 18);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(label, tx, ty + 4);
            ctx.textAlign = 'left';
        }
    });

    // Lines the ROUTE does not mention. They exist on the water, so they draw — dimmer,
    // and labelled, because "I made a gate and cannot see it" is the same bug as an
    // invisible mark.
    if (doc && shown('marks')) {
        const usedLines = new Set(droute.map(e => e.lineId).filter(x => x != null));
        dlines().forEach((ln, i) => {
            if (usedLines.has(ln.id)) return;
            const ends = lineEnds(ln.id);
            if (!ends) return;
            const A = toS(ends[0].x, ends[0].y), B = toS(ends[1].x, ends[1].y);
            const on = hover.line === i || selLine === i;
            ctx.strokeStyle = on ? '#fff' : 'rgba(163,230,53,0.45)';
            ctx.lineWidth = on ? 3 : 1.5;
            ctx.setLineDash([6, 5]);
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
            ctx.setLineDash([]);
        });
        // The selected/hovered gate, whether or not a leg uses it.
        const hl = [selLine, hover.line].filter(i => i >= 0);
        for (const i of hl) {
            const ln = dlines()[i];
            const ends = ln && lineEnds(ln.id);
            if (!ends) continue;
            const A = toS(ends[0].x, ends[0].y), B = toS(ends[1].x, ends[1].y);
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        }
    }

    // Marks, glyphed by appearance — ONE PER KIND. There used to be two: a yellow square
    // for a can and an orange circle for everything else, so switching a mark to a
    // committee boat or to no buoy at all changed the document and nothing you could see.
    // A picker whose choices look identical reads as a picker that does not work.
    (shown('marks') ? (dmarks || []) : []).forEach((m, i) => {
        const p = toS(m.x, m.y);
        const on = hover.mark === i || sel.mark === i;
        const r = on ? 8 : 6;
        const kind = m.kind || 'inflatable';
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8,15,30,0.7)'; ctx.fill();
        if (kind === 'can') {
            ctx.fillStyle = '#facc15';
            ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        } else if (kind === 'committee') {
            // A hull, pointed and beamy — the one mark that is a VESSEL, and the one that
            // is much bigger on the water (92 units against a buoy's 30).
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - r * 1.7);
            ctx.lineTo(p.x + r * 0.95, p.y - r * 0.1);
            ctx.lineTo(p.x + r * 0.7, p.y + r * 1.3);
            ctx.lineTo(p.x - r * 0.7, p.y + r * 1.3);
            ctx.lineTo(p.x - r * 0.95, p.y - r * 0.1);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.2; ctx.stroke();
        } else if (kind === 'none') {
            // No buoy at all: a POSITION, not an object. Drawn as an empty ring so it can
            // still be grabbed and moved, and so a gate with one real end and one bare
            // corner is legible as exactly that.
            ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.6;
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill();
        } else {
            // Absent kind means inflatable, which is what the panel and the compiler
            // both already assume — drawing it differently made older marks look like
            // a third kind that does not exist.
            ctx.fillStyle = '#fb923c';
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        }
        if (on) {
            ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2); ctx.stroke();
            // WHICH mark is this? Say so on the map. Knowing a mark is selected is
            // useless if you cannot tell which of five it is.
            if (doc) {
                const txt = markLabel(i);
                ctx.font = '700 11.5px Archivo, system-ui, sans-serif';
                const tw = ctx.measureText(txt).width;
                ctx.fillStyle = 'rgba(8,15,30,0.85)';
                ctx.fillRect(p.x + r + 6, p.y - 9, tw + 10, 18);
                ctx.fillStyle = '#e0f2fe';
                ctx.fillText(txt, p.x + r + 11, p.y + 4);
            }
        }
    });

    // The hovered or selected GATE gets its name too, at the midpoint of the line.
    if (doc) {
        const gi = hover.line >= 0 ? hover.line : selLine;
        const ln = gi >= 0 ? dlines()[gi] : null;
        const ends = ln && lineEnds(ln.id);
        if (ends) {
            const A = toS(ends[0].x, ends[0].y), B = toS(ends[1].x, ends[1].y);
            const txt = lineLabel(ln.id);
            ctx.font = '700 11.5px Archivo, system-ui, sans-serif';
            const tw = ctx.measureText(txt).width;
            const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
            ctx.fillStyle = 'rgba(8,15,30,0.85)';
            ctx.fillRect(mx + 10, my - 9, tw + 10, 18);
            ctx.fillStyle = '#d9f99d';
            ctx.fillText(txt, mx + 15, my + 4);
        }
    }
}
// Only the Place gesture in flight — the size you are dragging out, before there is a
// shape to paint. The placed shapes themselves go through drawLandLayer with everything
// else, in document order, because that is what having one list means.
function drawPlacedIce() {
    if (drag && drag.kind === 'icenew' && drag.r > 0) {
        const c = toS(drag.origin.x, drag.origin.y);
        ctx.strokeStyle = 'rgba(125,211,252,0.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.arc(c.x, c.y, drag.r * view.scale, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#bae6fd'; ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.fillText(`${fmtM(drag.r * 2)} across`, c.x + 8, c.y - 8);
    }
}
function drawBrushDisc() {
    if (isBrush(tool) && lastMouse) {
        const m = lastMouse, R = brush * view.scale;
        // The falloff is the whole behaviour, so draw it: a gradient disc that fades to
        // nothing at the rim, plus the vertices that will actually move, sized by how
        // much. "Drag and hope" was the only way to find out before.
        const g = ctx.createRadialGradient(m.sx, m.sy, 0, m.sx, m.sy, Math.max(1, R));
        g.addColorStop(0, 'rgba(56,189,248,0.22)');
        g.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(m.sx, m.sy, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(56,189,248,0.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(m.sx, m.sy, R, 0, Math.PI * 2); ctx.stroke();

        // Roughen does not move the points you can see — it ADDS points between them. So it
        // marks the midpoints it would split, which is the only way to tell before you drag
        // whether an edge is already fine enough to be left alone.
        if (tool === 'roughen') {
            const target = Math.max(20, detail);
            for (const { ring } of brushRings()) {
                for (let i = 0; i < ring.length; i++) {
                    const a = ring[i], b = ring[(i + 1) % ring.length];
                    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
                    const d = Math.hypot(mx - m.w.x, my - m.w.y);
                    if (d > brush) continue;
                    if (Math.hypot(b[0] - a[0], b[1] - a[1]) <= target) continue;
                    const t = 1 - d / brush;
                    const wgt = t * t * (3 - 2 * t);
                    const q = toS(mx, my);
                    ctx.beginPath(); ctx.arc(q.x, q.y, 1.5 + wgt * 4, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(167,243,208,${0.3 + wgt * 0.65})`;
                    ctx.fill();
                }
            }
        } else {
            for (const { ring } of brushRings()) {
                for (const pt of ring) {
                    const d = Math.hypot(pt[0] - m.w.x, pt[1] - m.w.y);
                    if (d > brush) continue;
                    const t = 1 - d / brush;
                    const wgt = t * t * (3 - 2 * t);      // the same smoothstep the brush uses
                    const q = toS(pt[0], pt[1]);
                    ctx.beginPath(); ctx.arc(q.x, q.y, 2 + wgt * 6, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(125,211,252,${0.25 + wgt * 0.7})`;
                    ctx.fill();
                }
            }
        }
    }
}

// THE ACTIVE LAYER PAINTS LAST. Everything keeps its usual order except the layer you are
// editing, which moves to the top of the stack for as long as it is active — so working on
// Land does not mean hunting for a coastline under fifty ice floes, and the arena's dashed
// edge is not buried under the map it bounds. Nothing about the document changes; this is
// stacking order only, and it reverts the moment you pick another layer.
//
// The venue paints in TWO passes (drifting floes under the land, hand-placed ice over it),
// and both move together when Venue is active — which is why this is a list of steps keyed
// by layer rather than one function per layer.
const LAYER_STEPS = [
    ['arena',   () => drawArenaLayer()],
    ['venue',   () => drawDriftingFloes()],
    ['land',    () => drawLandLayer()],
    // Props between the land and the course furniture — the game's own draw order.
    ['props',   () => { if (shown('props')) drawPropsLayer(); }],
    // Over the props, under the course furniture — the game's own order, where traffic
    // draws with the surface props and below the marks.
    ['traffic', () => { if (shown('traffic')) drawTrafficLayer(); }],
    ['course',  () => drawCourseLayer()],
    ['venue',   () => drawPlacedIce()],   // the Place gesture only; shapes paint with 'land'
    ['props',   () => drawPlacedProps()], // the scatter circle, while the drag is live
    ['wind',    () => { if (shown('wind')) drawWindRegions(); }],
    ['gust',    () => { if (shown('gust')) drawGustRegions(); }],
    ['current', () => { if (shown('current')) drawCurrentRegions(); }],
    ['rapids',  () => { if (shown('rapids')) drawRapidsRegions(); }]
];
// Marks and Route both draw the course furniture, so either one raises it.
const ACTIVE_LAYER = { boundary: 'arena', shape: 'land',
                       marks: 'course', route: 'course', wind: 'wind', current: 'current',
                       gust: 'gust', rapids: 'rapids', props: 'props', traffic: 'traffic' };

// The REAL sprites, not stand-in circles: a prop layer exists to judge placement, and
// you cannot judge a palm's overhang from a dot. Same src derivation the game uses
// (manifest key '<venue>-<name>' -> assets/images/props/<venue>/<name>.png); a sprite
// still loading draws a soft disc so the object is never invisible or unclickable.
const PROP_IMGS = {};
function propEdImg(kind) {
    let img = PROP_IMGS[kind];
    if (!img) {
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        const i = kind.indexOf('-');
        img = PROP_IMGS[kind] = new Image();
        // `src` opt-out, as in propSprite: a venue-neutral bake sits flat in props/.
        img.src = (reg[kind] && reg[kind].src)
            || `assets/images/props/${kind.slice(0, i)}/${kind.slice(i + 1)}.png`;
        img.addEventListener('load', () => draw());
    }
    return img;
}
function drawPropsLayer() {
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const ps = dprops();
    for (let i = 0; i < ps.length; i++) {
        const p = ps[i], k = reg[p.kind];
        if (!k) continue;
        const s = toS(p.x, p.y);
        const w = Math.max(4, (k.world || 40) * (p.scale || 1) * view.scale);
        const img = propEdImg(p.kind);
        if (img.complete && img.naturalWidth) {
            ctx.save();
            ctx.translate(s.x, s.y);
            if (p.heading) ctx.rotate(p.heading);
            ctx.drawImage(img, -w / 2, -w / 2, w, w);
            ctx.restore();
        } else {
            ctx.beginPath(); ctx.arc(s.x, s.y, w / 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(132,204,22,0.35)'; ctx.fill();
        }
        if (mode === 'props' && (i === selProp || selProps.includes(i))) {
            ctx.beginPath(); ctx.arc(s.x, s.y, w / 2 + 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = i === selProp ? 2 : 1.2;   // the primary reads heavier
            ctx.stroke();
        }
    }
}

// ── TRAFFIC ─────────────────────────────────────────────────────────────────
// THE EDITOR DRAWS THE CURVE THE GAME SAILS, by compiling the path with the game's own
// js/traffic.js rather than drawing the authored polyline and hoping. A hand-drawn preview
// would be a second implementation of the smoothing, and the first thing it would do is
// disagree with the real one on exactly the tight corners where it matters.
// Compiling a lane walks 64 samples per leg, and drawTrafficLayer asks for every lane on
// every frame — including every frame of a waypoint drag. Cached on the entry's own JSON, so
// an edit invalidates exactly the lane that changed and nothing else.
const _curveCache = new Map();
function trafficCurve(v) {
    if (!window.Traffic || !v || !v.path || v.path.length < 2) return null;
    let key;
    try { key = JSON.stringify(v); } catch (e) { key = null; }
    if (key && _curveCache.has(key)) return _curveCache.get(key);
    let c = null;
    try { c = window.Traffic.compilePath(v); } catch (err) { c = null; }
    if (key) {
        if (_curveCache.size > 64) _curveCache.clear();   // a scratch cache, not a store
        _curveCache.set(key, c);
    }
    return c;
}

// ── CLASHES: TWO HULLS IN THE SAME WATER AT THE SAME SECOND ──────────────────────────
// Lanes that cross are fine — lanes that cross AT THE SAME TIME are not, and nothing about
// looking at two curves tells you which you have. This is the whole reason the clock exists,
// answered once for the entire window instead of by dragging the slider and hoping.
//
// The hull model is the game's: a capsule, spine plus radius, off the kind's measured `hull`.
// Anything else would flag clashes the race would not have, or miss ones it would.
function segSegDist(a1, a2, b1, b2) {
    const ux = a2.x - a1.x, uy = a2.y - a1.y;
    const vx = b2.x - b1.x, vy = b2.y - b1.y;
    const wx = a1.x - b1.x, wy = a1.y - b1.y;
    const a = ux * ux + uy * uy, b = ux * vx + uy * vy, c = vx * vx + vy * vy;
    const d = ux * wx + uy * wy, e = vx * wx + vy * wy;
    const D = a * c - b * b;
    let sc, tc;
    if (D < 1e-9) { sc = 0; tc = c > 1e-9 ? e / c : 0; }
    else { sc = (b * e - c * d) / D; tc = (a * e - b * d) / D; }
    sc = Math.max(0, Math.min(1, sc)); tc = Math.max(0, Math.min(1, tc));
    // One clamp each is enough for the tolerance this needs; the capsule radii dwarf the
    // error a second refinement pass would remove.
    const px = a1.x + ux * sc - (b1.x + vx * tc);
    const py = a1.y + uy * sc - (b1.y + vy * tc);
    return Math.hypot(px, py);
}

function hullOf(v) {
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const kd = reg[v.kind] || {};
    const hull = v.hull || kd.hull || [0.9, 0.3];
    const w = (kd.world || 40) * (v.scale || 1);
    const len = (hull.along != null ? hull.along : hull[0]) * w;
    const beam = (hull.beam != null ? hull.beam : hull[1]) * w;
    return { r: beam * 0.5, half: Math.max(1, len * 0.5 - beam * 0.5) };
}

let _clashCache = { key: null, val: null };
function trafficClashes() {
    const list = dtraffic();
    const win = raceWindow();
    let key;
    try { key = JSON.stringify(list) + '|' + win.from + '|' + win.to; } catch (e) { key = null; }
    if (key && _clashCache.key === key) return _clashCache.val;

    const out = { hit: new Set(), points: [], coarsened: false };
    const ships = list.map(v => ({ v, c: trafficCurve(v), h: hullOf(v) })).filter(x => x.c);
    if (ships.length >= 2) {
        // STEP FROM THE GEOMETRY, not a round number. A sample coarser than the hulls lets a
        // fast pair pass through each other between samples, and the step that is right for
        // two cargo ships is far too coarse for two motorboats.
        const minExt = Math.min(...ships.map(s => s.h.r));
        const maxSpd = Math.max(15, ...ships.map(s => {
            let m = 0;
            for (const p of s.c.points) m = Math.max(m, Math.abs(p.speed) * window.Traffic.KT_TO_U_PER_S);
            return m;
        }));
        let step = Math.max(0.05, Math.min(1, 0.25 * minExt / maxSpd));
        const span = win.to - win.from;
        if (span / step > 20000) { step = span / 20000; out.coarsened = true; }
        // Whatever the step, a hull may have moved half a step's worth since it was last
        // looked at, so the radius carries that. The error is toward OVER-reporting, which
        // for a warning is the safe direction.
        const pad = maxSpd * step * 0.5;

        for (let t = win.from; t <= win.to; t += step) {
            const now = [];
            for (const s of ships) {
                const l = window.Traffic.localTime(s.v, s.c, t);
                if (!l) { now.push(null); continue; }
                const q = s.c.at(l.t);
                const hd = l.reverse ? q.heading + Math.PI : q.heading;
                const fx = Math.sin(hd) * s.h.half, fy = -Math.cos(hd) * s.h.half;
                now.push({ a: { x: q.x - fx, y: q.y - fy }, b: { x: q.x + fx, y: q.y + fy },
                           r: s.h.r, x: q.x, y: q.y });
            }
            for (let i = 0; i < now.length; i++) {
                for (let j = i + 1; j < now.length; j++) {
                    const A = now[i], B = now[j];
                    if (!A || !B) continue;
                    if (segSegDist(A.a, A.b, B.a, B.b) >= A.r + B.r + pad) continue;
                    out.hit.add(i); out.hit.add(j);
                    // One marker per encounter, not one per sample: a slow overlap lasts many
                    // seconds and would otherwise stamp a bead of identical rings.
                    const last = out.points[out.points.length - 1];
                    if (!last || last.i !== i || last.j !== j || t - last.t > 8) {
                        out.points.push({ i, j, t, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
                    } else { last.t = t; }
                }
            }
        }
    }
    if (key) _clashCache = { key, val: out };
    return out;
}
function drawTrafficLayer() {
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const list = dtraffic();
    const clash = mode === 'traffic' ? trafficClashes() : { hit: new Set(), points: [] };
    for (let i = 0; i < list.length; i++) {
        const v = list[i];
        if (!v.path || v.path.length < 2) continue;
        const on = mode === 'traffic' && i === selTraf;
        const bad = clash.hit.has(i);
        const curve = trafficCurve(v);

        // The lane itself. Sampled off the compiled arc-length table, so what you see is
        // where the hull will be.
        ctx.beginPath();
        if (curve) {
            const N = Math.max(24, Math.min(240, Math.round(curve.length / 40)));
            for (let k = 0; k <= N; k++) {
                const q = curve.atArc(curve.length * k / N);
                const s = toS(q.x, q.y);
                if (k === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
            }
        } else {
            v.path.forEach((p, k) => {
                const s = toS(tpx(p), tpy(p));
                if (k === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
            });
        }
        // RED MEANS THIS LANE PUTS ITS HULL IN THE SAME WATER AS ANOTHER AT THE SAME
        // SECOND. Not that the lanes cross — crossing lanes are the whole point of traffic.
        ctx.strokeStyle = bad ? (on ? '#f87171' : 'rgba(248,113,113,0.6)')
                              : (on ? '#38bdf8' : 'rgba(56,189,248,0.45)');
        ctx.lineWidth = bad ? (on ? 2.4 : 1.8) : (on ? 2 : 1.4);
        ctx.setLineDash([]);
        ctx.stroke();

        // Which way it goes, and where the hull actually is at any moment — a lane with no
        // arrows is a line, and half the authoring question is "does it cross the beat
        // before or after the fleet gets there".
        if (curve) {
            const step = Math.max(300, curve.length / 14);
            for (let d = step * 0.5; d < curve.length; d += step) {
                const q = curve.atArc(d);
                const s = toS(q.x, q.y);
                const a = q.heading;
                const ux = Math.sin(a), uy = -Math.cos(a);
                const L = on ? 9 : 7;
                ctx.beginPath();
                ctx.moveTo(s.x + ux * L, s.y + uy * L);
                ctx.lineTo(s.x - uy * L * 0.55 - ux * L * 0.35, s.y + ux * L * 0.55 - uy * L * 0.35);
                ctx.lineTo(s.x + uy * L * 0.55 - ux * L * 0.35, s.y - ux * L * 0.55 - uy * L * 0.35);
                ctx.closePath();
                ctx.fillStyle = bad ? (on ? 'rgba(248,113,113,0.9)' : 'rgba(248,113,113,0.45)')
                                    : (on ? 'rgba(56,189,248,0.9)' : 'rgba(56,189,248,0.4)');
                ctx.fill();
            }
        }

        // A ghost of the hull, at its real size. The whole reason to author a path on a map
        // is to see whether a 720-unit ship fits through the gap you have drawn it through,
        // and a line cannot answer that.
        //
        // WITH THE CLOCK RUNNING it sits where the vessel actually is at that second, and a
        // vessel not yet spawned or already gone draws NOTHING — which is the honest answer
        // and the one worth seeing. Idle, it sits at the head of the lane.
        const kd = reg[v.kind];
        const live = curve && trafficT != null ? window.Traffic.localTime(v, curve, trafficT) : null;
        if (kd && curve && !(trafficT != null && !live)) {
            const q = live ? curve.at(live.t) : curve.atArc(0);
            if (live && live.reverse) q.heading += Math.PI;
            const s = toS(q.x, q.y);
            const w = Math.max(4, (kd.world || 40) * (v.scale || 1) * view.scale);
            const img = propEdImg(v.kind);
            ctx.save();
            // Solid while scrubbing: at a given second this is not a hint about where the
            // lane starts, it is where the ship IS.
            ctx.globalAlpha = live ? 1 : (on ? 0.85 : 0.45);
            ctx.translate(s.x, s.y);
            ctx.rotate(q.heading);
            if (img.complete && img.naturalWidth) ctx.drawImage(img, -w / 2, -w / 2, w, w);
            else { ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(56,189,248,0.3)'; ctx.fill(); }
            ctx.restore();
            // A stopped vessel is worth calling out — at a dwell, or berthed by `end: stay`,
            // it looks identical to one under way and is behaving completely differently.
            if (live && q.stopped) {
                const sc = toS(q.x, q.y);
                ctx.font = '600 10px Archivo, system-ui, sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(226,232,240,0.95)';
                ctx.fillText('waiting', sc.x, sc.y - w / 2 - 8);
            }
        }

        // Handles, only on the selected vessel — every path showing its points at once is
        // a field of dots nobody can aim at.
        if (on) {
            for (let k = 0; k < v.path.length; k++) {
                const s = toS(tpx(v.path[k]), tpy(v.path[k]));
                const own = isFinite(tpSpeed(v.path[k]));
                ctx.beginPath();
                ctx.arc(s.x, s.y, k === selTV ? 6 : 4.5, 0, Math.PI * 2);
                // A point that NAMES a speed is filled; one that inherits is hollow. That is
                // the single most useful thing to see at a glance on a lane being tuned.
                ctx.fillStyle = own ? '#38bdf8' : '#0b1220';
                ctx.fill();
                ctx.strokeStyle = k === selTV ? '#fff' : '#38bdf8';
                ctx.lineWidth = k === selTV ? 2 : 1.3;
                ctx.stroke();
                if (own) {
                    ctx.font = '600 10px Archivo, system-ui, sans-serif';
                    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = 'rgba(226,232,240,0.95)';
                    ctx.fillText(`${tpSpeed(v.path[k])}kt`, s.x + 9, s.y - 8);
                }
            }
        }
    }
    // WHERE and WHEN, because "one of these two lanes is wrong" is not yet an actionable
    // answer. Drawn after every lane so a marker is never buried under a later one.
    for (const c of clash.points) {
        const sc = toS(c.x, c.y);
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f87171'; ctx.fill();
        ctx.font = '600 10px Archivo, system-ui, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const label = mmssSigned(c.t);
        const wLbl = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(8,15,30,0.85)';
        ctx.fillRect(sc.x + 12, sc.y - 8, wLbl + 8, 16);
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(label, sc.x + 16, sc.y);
    }

    // The lane being drawn right now.
    if (mode === 'traffic' && drawing && pending) {
        // When EXTENDING, the run starts at the lane's existing end — without it the first
        // new leg appears to begin in open water, unattached to the lane it is growing.
        const anchor = [];
        if (extendLane) {
            const v = dtraffic()[extendLane.i];
            if (v && v.path.length) {
                const q = extendLane.atStart ? v.path[0] : v.path[v.path.length - 1];
                anchor.push([tpx(q), tpy(q)]);
            }
        }
        const run = anchor.concat(pending);
        if (!run.length) return;
        ctx.beginPath();
        run.forEach((p, k) => {
            const s = toS(p[0], p[1]);
            if (k === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        });
        const last = toS(run[run.length - 1][0], run[run.length - 1][1]);
        const cur = lastMouse ? { x: lastMouse.sx, y: lastMouse.sy } : last;
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.8; ctx.setLineDash([]);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(cur.x, cur.y);
        ctx.strokeStyle = 'rgba(56,189,248,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.stroke(); ctx.setLineDash([]);
        for (const p of run) {
            const s = toS(p[0], p[1]);
            ctx.beginPath(); ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8'; ctx.fill();
        }
        ctx.font = '600 11px ' + (getComputedStyle(document.body).getPropertyValue('--ed-mono') || 'monospace');
        const label = extendLane
            ? `+${pending.length} · ⏎ ends the lane`
            : `${pending.length} pt${pending.length === 1 ? '' : 's'}`
              + (pending.length >= 2 ? ' · ⏎ ends the lane' : ' · click the next waypoint');
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(8,15,30,0.85)';
        ctx.fillRect(cur.x + 12, cur.y - 9, tw + 10, 18);
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(label, cur.x + 17, cur.y + 1);
    }
}

function draw() {
    ctx.clearRect(0, 0, W(), H());
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W(), H());
    grid();

    // NOTHING OPEN: an empty canvas that says how to stop being empty, instead of
    // layer steps dereferencing a course that does not exist.
    if (!doc && !course) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '600 15px Archivo, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(148,163,184,0.85)';
        ctx.fillText('No venue open', W() / 2, H() / 2 - 12);
        ctx.font = '400 12.5px Archivo, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(100,116,139,0.85)';
        ctx.fillText('Open… a .venue.js file to edit it  ·  ⌘O', W() / 2, H() / 2 + 12);
        // A remembered file that could not reopen silently (permission needs a gesture).
        if (lastHandle) {
            ctx.fillStyle = 'rgba(148,163,184,0.85)';
            ctx.fillText(`⏎  reopen ${lastHandle.name}`, W() / 2, H() / 2 + 36);
        }
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        return;
    }

    const active = ACTIVE_LAYER[mode] || null;
    for (const [key, fn] of LAYER_STEPS) if (key !== active) fn();
    for (const [key, fn] of LAYER_STEPS) if (key === active) fn();

    // Overlays, always on top of every layer: they describe the TOOL, not the map, and a
    // brush disc you cannot see under the ice you are about to reshape is no use.
    if (showField && shown('wind')) drawWindField();
    if (showCurField && shown('current')) drawCurrentField();
    drawBrushDisc();
    drawBoundaryHandles();
    drawVertexSelection();
    // The shape you are DRAWING. This was never rendered — you clicked points and the map
    // did not change, so the only feedback that a click had registered was the shape
    // appearing whole when you closed it. Everything here is drawn in screen space so the
    // handles stay the same size however far you are zoomed out.
    // TRAFFIC DRAWS ITS OWN, in drawTrafficLayer. Everything below closes the ring and
    // fills it, which is right for an outline and wrong for a lane: a path is open, and a
    // preview that joins the last point back to the first says it is not.
    if (drawing && pending && pending.length && mode !== 'traffic') {
        const pts = pending.map(q => toS(q[0], q[1]));
        const cur = lastMouse ? { x: lastMouse.sx, y: lastMouse.sy } : pts[pts.length - 1];
        // Close-snap: within grabbing distance of the first point, closing is what a click
        // will do, so say so before the click rather than after it.
        const nearFirst = pending.length >= 3
            && Math.hypot(cur.x - pts[0].x, cur.y - pts[0].y) < 12;
        // The filled preview of what you would get, so a self-crossing outline is visible
        // as one while it can still be undone with Esc.
        if (pending.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.lineTo(cur.x, cur.y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(232,237,245,0.16)';
            ctx.fill('evenodd');
        }
        // Committed segments solid; the two rubber-band legs dashed, because they are what
        // the NEXT click decides and are not part of the shape yet.
        ctx.strokeStyle = '#e8edf5'; ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(232,237,245,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.lineTo(cur.x, cur.y);
        if (pending.length >= 2) ctx.lineTo(pts[0].x, pts[0].y);
        ctx.stroke();
        ctx.setLineDash([]);
        pts.forEach((q, i) => {
            const first = i === 0;
            const r = first && nearFirst ? 7 : first ? 5 : 3.5;
            ctx.beginPath(); ctx.arc(q.x, q.y, r + 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(8,15,30,0.75)'; ctx.fill();
            ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
            ctx.fillStyle = first && nearFirst ? '#bef264' : first ? '#e8edf5' : '#93c5fd';
            ctx.fill();
        });
        // The count, at the cursor: "how many points do I have" is the question you ask
        // mid-draw, and counting dots on a coastline is not an answer.
        ctx.font = '600 11px ' + (getComputedStyle(document.body).getPropertyValue('--ed-mono') || 'monospace');
        const label = nearFirst ? 'click to close'
                    : `${pending.length} pt${pending.length === 1 ? '' : 's'}`
                      + (pending.length >= 3 ? ' · ⏎ closes' : '');
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(8,15,30,0.85)';
        ctx.fillRect(cur.x + 12, cur.y - 9, tw + 10, 18);
        ctx.fillStyle = nearFirst ? '#bef264' : '#e8edf5';
        ctx.fillText(label, cur.x + 17, cur.y + 4);
    }
    if (marquee) {
        const a = toS(marquee.a.x, marquee.a.y), b = toS(marquee.b.x, marquee.b.y);
        ctx.fillStyle = 'rgba(56,189,248,0.12)';
        ctx.fillRect(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(b.x-a.x), Math.abs(b.y-a.y));
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
        ctx.strokeRect(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(b.x-a.x), Math.abs(b.y-a.y));
        ctx.setLineDash([]);
    }
    // The snap guide: a thin line along the axis being held, so a snap is something you
    // SEE rather than something you infer from a coordinate that stopped moving.
    if (snapGuide && drag) {
        ctx.strokeStyle = 'rgba(251,191,36,0.85)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
        if (snapGuide.x !== null && snapGuide.x !== undefined) {
            const q = toS(snapGuide.x, 0);
            ctx.beginPath(); ctx.moveTo(q.x, 0); ctx.lineTo(q.x, H()); ctx.stroke();
        }
        if (snapGuide.y !== null && snapGuide.y !== undefined) {
            const q = toS(0, snapGuide.y);
            ctx.beginPath(); ctx.moveTo(0, q.y); ctx.lineTo(W(), q.y); ctx.stroke();
        }
        ctx.setLineDash([]);
    }
    drawFinding();
    drawBoatProbe();
    if (measure) drawMeasure();
    scaleBar();
    hudIdle();
}

// Regions are drawn as their EXTENT plus an inner line at the falloff inset, because
// the polygon is where the effect ends and full strength is reached `falloff` inside.
// A region narrower than twice its falloff never reaches full strength, and seeing the
// two outlines nearly meet is how you notice.
// Drawn after land so the arena edge's handles are visible where it crosses a coast —
// which is most of the time, since the arena is inset inside the painted map.
function drawBoundaryHandles() {
    // Only in Arena mode. A handle that is visible but not grabbable is a worse lie than
    // no handle at all — if the mode gates what is interactive, it gates what looks it.
    if (!doc || mode !== 'boundary' || !shown('arena')) return;
    const bp = doc.world.boundary.poly;
    if (!bp || bp.length < 3) return;
    bp.forEach((pt, i) => {
        const sp = toS(pt[0], pt[1]);
        const on = hover.bvert === i;
        const rr = on ? 8 : 5.5;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, rr + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8,15,30,0.85)'; ctx.fill();
        ctx.beginPath(); ctx.arc(sp.x, sp.y, rr, 0, Math.PI * 2);
        // SELECTED is not expressed here: drawVertexSelection paints the gold marker over
        // every selected vertex of every kind, last. Saying it twice would be two places to
        // keep true, and they would disagree the first time one of them changed.
        ctx.fillStyle = on ? '#e2e8f0' : '#94a3b8'; ctx.fill();
        ctx.strokeStyle = 'rgba(226,232,240,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, rr, 0, Math.PI * 2); ctx.stroke();
    });
}

// Which way round: an arc with an arrowhead, sized from the ring so it reads at any
// zoom. Course information, so it draws in every mode.
function drawRoundArc(p, zr, cm) {
    const port = cm.side === 'port';
    const a0 = -0.6, a1 = 0.9;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(1.5, Math.min(4, zr * 0.035));
    ctx.beginPath(); ctx.arc(p.x, p.y, zr * 0.72, port ? a1 : a0, port ? a0 : a1, port); ctx.stroke();
    const ae = port ? a0 : a1;
    const tx = p.x + Math.cos(ae) * zr * 0.72, ty = p.y + Math.sin(ae) * zr * 0.72;
    const tdx = (port ? 1 : -1) * Math.sin(ae), tdy = (port ? -1 : 1) * Math.cos(ae);
    const rh = Math.max(5, Math.min(18, zr * 0.16));
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - tdy * rh * 0.6 - tdx * rh, ty + tdx * rh * 0.6 - tdy * rh);
    ctx.lineTo(tx + tdy * rh * 0.6 - tdx * rh, ty - tdx * rh * 0.6 - tdy * rh);
    ctx.closePath(); ctx.fill();
}

// Selected vertices, drawn on top in every mode that owns them. The FIRST is ringed
// differently because it is the align anchor — aligning to an invisible anchor is
// guesswork.
function drawVertexSelection() {
    if (!doc || !vsel.length) return;
    vsel.forEach((ref, k) => {
        const p = vertexArray(ref);
        if (!p) return;
        const q = toS(p[0], p[1]);
        ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8,15,30,0.8)'; ctx.fill();
        ctx.beginPath(); ctx.arc(q.x, q.y, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fde68a'; ctx.fill();
        if (k === 0) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(q.x, q.y, 10.5, 0, Math.PI * 2); ctx.stroke();
        }
    });
}

// ONE wind arrow: a shaft with a head at the DOWNWIND end. Shared by the region overlay and
// the computed-field overlay deliberately — they disagreed about which way the wind blew
// once already, and the only way two pictures of the same thing stay honest is if they are
// literally the same code. The head scales with the shaft so a short arrow is not all head.
function windArrow(sx, sy, ux, uy, len, colour, lw) {
    ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = lw || 1.6;
    ctx.beginPath();
    ctx.moveTo(sx - ux * len, sy - uy * len);
    ctx.lineTo(sx + ux * len, sy + uy * len);
    ctx.stroke();
    const hx = sx + ux * len, hy = sy + uy * len;
    const h = Math.max(4, Math.min(7, len * 0.55)), w = h * 0.57;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - ux * h - uy * w, hy - uy * h + ux * w);
    ctx.lineTo(hx - ux * h + uy * w, hy - uy * h - ux * w);
    ctx.closePath(); ctx.fill();
}

// One region's own wind, drawn across the water it covers. Length and opacity follow the
// SAME smoothstep the engine weights it by (`t = sd / falloff`, smoothstepped), so a region
// visibly fades at its edge and a region narrower than twice its falloff visibly never gets
// up to strength — which is the thing about falloff that a number cannot tell you.
function drawRegionArrows(r, on, kind) {
    const poly = r.poly;
    if (!poly || poly.length < 3) return;
    const fall = r.falloff != null ? r.falloff : 400;
    const isWind = kind !== 'current';
    // Length is speed relative to a REFERENCE for that kind, so an arrow means the same
    // thing on any venue — and a 1-knot stream is not drawn as a calm because a breeze
    // happens to be 18.
    const base = isWind ? ((course && course.wind && course.wind.speed) || state.wind.baseSpeed || 12)
                        : 1.5;
    const rel = base > 0 ? (r.speed || 0) / base : 1;
    // BOTH point where the thing GOES — an arrow is a vector. They differ only in how the
    // stored bearing relates to that: a wind is NAMED by where it comes from, so its flow is
    // `(-sin, +cos)`; a current is named by where it SETS, so its flow is the bearing itself,
    // `(+sin, -cos)`. Both match the vectors script.js integrates.
    const ux = isWind ? -Math.sin(r.direction || 0) : Math.sin(r.direction || 0);
    const uy = isWind ? Math.cos(r.direction || 0) : -Math.cos(r.direction || 0);

    // A screen-space grid, so the arrows stay the same density however far you are zoomed.
    const step = 54;
    let box = null;
    for (const q of poly) {
        const sp = toS(q[0], q[1]);
        if (!box) box = { x0: sp.x, y0: sp.y, x1: sp.x, y1: sp.y };
        box.x0 = Math.min(box.x0, sp.x); box.y0 = Math.min(box.y0, sp.y);
        box.x1 = Math.max(box.x1, sp.x); box.y1 = Math.max(box.y1, sp.y);
    }
    // The edge ramp is centered on the outline, so influence reaches falloff/2 outside
    // the polygon — the sampled box pads by that much, in screen pixels.
    const o0 = toS(0, 0), o1 = toS(1, 0);
    const padPx = (fall / 2) * Math.hypot(o1.x - o0.x, o1.y - o0.y);
    const x0 = Math.max(0, Math.floor((box.x0 - padPx) / step) * step);
    const y0 = Math.max(0, Math.floor((box.y0 - padPx) / step) * step);
    const x1 = Math.min(W(), box.x1 + padPx), y1 = Math.min(H(), box.y1 + padPx);
    for (let sy = y0 + step / 2; sy < y1; sy += step) {
        for (let sx = x0 + step / 2; sx < x1; sx += step) {
            const w = toW(sx, sy);
            // Signed distance to the outline — the engine's `signedDist`, computed here so
            // it reads the document being edited rather than the last compile.
            let d = Infinity;
            for (let i = 0; i < poly.length; i++)
                d = Math.min(d, distToSeg(w.x, w.y, poly[i], poly[(i + 1) % poly.length]));
            const sd = pointInRing(w.x, w.y, poly) ? d : -d;
            const wt = VenueDoc.regionWeight(sd, fall);
            if (wt <= 0.02) continue;
            const len = 15 * Math.max(0.35, Math.min(1.8, rel)) * (0.35 + 0.65 * wt);
            const a = (on ? 0.85 : 0.5) * (0.35 + 0.65 * wt);
            const rgb = isWind ? '52,211,153' : '125,211,252';
            windArrow(sx, sy, ux, uy, len, `rgba(${rgb},${a.toFixed(3)})`);
        }
    }
}

function drawWindRegions() {
    if (!doc) return;
    const rs = wregs();
    for (let i = 0; i < rs.length; i++) {
        const r = rs[i];
        if (!r.poly || r.poly.length < 3) continue;
        const on = i === selWind;
        ctx.beginPath(); ringPath(r.poly);
        ctx.fillStyle = on ? 'rgba(52,211,153,0.14)' : 'rgba(52,211,153,0.07)';
        ctx.fill();
        ctx.strokeStyle = on ? '#34d399' : 'rgba(52,211,153,0.55)';
        ctx.lineWidth = on ? 2 : 1.2;
        ctx.setLineDash([7, 5]); ctx.stroke(); ctx.setLineDash([]);

        // ARROWS, not a caption. A line of text told you the bearing but not which way that
        // was on this map, and said nothing at all about the shape of the region's effect.
        // Each arrow points at where the wind COMES FROM — the same convention the wind
        // field overlay uses, so the two agree when both are on — and its length carries the
        // local strength, which is what makes `falloff` visible: the region fades to nothing
        // at its own outline and reaches full weight `falloff` inside.
        // NOT while the computed field is up. That overlay already answers "which way does
        // the wind blow here", for the whole map and including the blend between regions —
        // drawing both means two grids of arrows crossing each other, and where regions
        // overlap they would not even agree.
        if (mode === 'wind' && !showField) drawRegionArrows(r, on, 'wind');

        if (on) {
            r.poly.forEach((p, k) => {
                const q = toS(p[0], p[1]);
                const onV = hover.wvert === k;
                const rad = onV ? 8 : 5.5;
                ctx.beginPath(); ctx.arc(q.x, q.y, rad + 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(8,15,30,0.75)'; ctx.fill();
                ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
                ctx.fillStyle = onV ? '#a7f3d0' : '#34d399'; ctx.fill();
            });
        }
    }
}

// THE FIELD, not the ingredients. An additive system is only authorable if you can see
// the sum — three overlapping regions can produce something nobody intended, and the
// region outlines alone will never tell you that.
function drawWindField() {
    if (!course) return;
    // Show the AUTHORED field: park the transient gusts and pin the base to what the
    // document says, so the preview is not a snapshot of one random gust arrangement.
    const savedGusts = state.gusts, savedDir = state.wind.direction, savedSpd = state.wind.speed;
    state.gusts = [];
    // Pin the live direction to the venue's mean so the preview shows the AUTHORED field
    // rather than one random moment of the oscillation.
    state.wind.direction = state.wind.baseDirection;
    const base = state.wind.speed;

    const step = 46;                                    // screen pixels between arrows
    const L = 15;
    for (let sy = step / 2; sy < H(); sy += step) {
        for (let sx = step / 2; sx < W(); sx += step) {
            const w = toW(sx, sy);
            const f = getWindAt(w.x, w.y);
            // CALM DRAWS AS NOTHING. Outside every region there is no wind, and a hole in
            // the wind has to look like a hole — a row of tiny arrows would read as "light
            // here" rather than "unsailable here".
            if (!f || f.speed < 0.05) continue;
            const rel = base > 0 ? f.speed / base : 1;
            // Blue below base, green at it, amber above — the same reading as the
            // in-game pressure cues.
            const col = rel < 0.9 ? 'rgba(96,165,250,0.75)'
                      : rel > 1.12 ? 'rgba(251,191,36,0.85)'
                      : 'rgba(52,211,153,0.6)';
            // Same convention as the region arrows: this marks the DOWNWIND end, the way
            // the air is going. Two overlays that can be on together must not disagree
            // about which way the wind is blowing.
            const ux = -Math.sin(f.direction), uy = Math.cos(f.direction);
            const len = L * Math.max(0.35, Math.min(1.8, rel));
            windArrow(sx, sy, ux, uy, len, col);
        }
    }
    state.gusts = savedGusts; state.wind.direction = savedDir; state.wind.speed = savedSpd;
}

function drawFinding() {
    if (selFinding < 0 || !findings[selFinding] || !doc) return;
    const f = findings[selFinding];
    for (const id of (f.shapes || [])) {
        const l = doc.shapes.find(x => x.id === id);
        if (!l) continue;
        ctx.beginPath(); ringPath(l.outer);
        ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2.5; ctx.stroke();
    }
    for (const seg of (f.segs || [])) {
        const a = toS(seg[0].x, seg[0].y), b = toS(seg[1].x, seg[1].y);
        ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        for (const p of [a, b]) { ctx.fillStyle = '#fb7185'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); }
    }
    for (const p of (f.points || [])) {
        const s = toS(p.x, p.y);
        ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.stroke();
    }
}

function drawMeasure() {
    const pts = measure.pts;
    if (!pts || pts.length < 2) return;
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => { const q = toS(p.x, p.y); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.stroke();

    // Vertices, so a path of five points is countable.
    pts.forEach((p, i) => {
        const q = toS(p.x, p.y);
        ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = (i === 0 || i === pts.length - 1) ? '#ddd6fe' : '#a78bfa'; ctx.fill();
    });

    // Per-LEG lengths along the way, then the total. A course is a sequence of legs, so
    // measuring one is usually a question about several of them at once.
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        total += d;
        if (pts.length > 2) {
            const a = toS(pts[i - 1].x, pts[i - 1].y), b = toS(pts[i].x, pts[i].y);
            ctx.fillStyle = 'rgba(221,214,254,0.85)';
            ctx.font = '600 11px "IBM Plex Mono", monospace';
            ctx.fillText(fmtM(d), (a.x + b.x) / 2 + 8, (a.y + b.y) / 2 - 6);
        }
    }
    // The game's 0.1875 s/m, times the measured ratio of mean race time to cutoff.
    const secs = uToM(total) * 0.1875 * 0.71;
    const last = toS(pts[pts.length - 1].x, pts[pts.length - 1].y);
    const lines = [
        `${pts.length - 1} leg${pts.length > 2 ? 's' : ''}  ·  ${fmtM(total)}`,
        `${fmtBL(total)} (55u = 11 m)`,
        `~${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')} to sail`
    ];
    ctx.font = '600 12px "IBM Plex Mono", monospace';
    const w = Math.max.apply(null, lines.map(t => ctx.measureText(t).width));
    ctx.fillStyle = 'rgba(8,15,30,0.8)';
    ctx.fillRect(last.x + 10, last.y - 34, w + 14, 52);
    ctx.fillStyle = '#ddd6fe';
    lines.forEach((t, i) => ctx.fillText(t, last.x + 17, last.y - 18 + i * 15));
}

// The hull outline in local coordinates: a pointed bow, full midships, a transom. Drawn
// rather than sprited because what matters here is the footprint, not the paint.
function boatOutline() {
    const L = BOAT_L / 2, B = BOAT_B / 2;
    return [
        [0, -L], [B * 0.55, -L * 0.72], [B * 0.92, -L * 0.25], [B, L * 0.18],
        [B * 0.86, L * 0.72], [B * 0.72, L], [-B * 0.72, L], [-B * 0.86, L * 0.72],
        [-B, L * 0.18], [-B * 0.92, -L * 0.25], [-B * 0.55, -L * 0.72]
    ];
}

function drawBoatProbe() {
    if (!boatProbe) return;
    const c = toS(boatProbe.x, boatProbe.y);
    const sc = view.scale;
    // Below a few pixels there is nothing to judge, so draw a locator instead: the point of
    // the boat is to zoom in and look, and you cannot zoom to something you cannot find.
    if (BOAT_L * sc < 14) {
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c.x, c.y, 11, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - 7); ctx.lineTo(c.x + 5, c.y + 6); ctx.lineTo(c.x - 5, c.y + 6);
        ctx.closePath(); ctx.fillStyle = '#fbbf24'; ctx.fill();
        ctx.font = '700 10px "IBM Plex Mono", monospace';
        ctx.fillText('boat — zoom in', c.x + 15, c.y + 4);
        return;
    }
    // The RRS zone: three hull lengths, which is what a rounding has to leave room for.
    const zr = BOAT_L * 3 * sc;
    ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(c.x, c.y, zr, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(boatProbe.heading);
    ctx.scale(sc, sc);
    ctx.beginPath();
    boatOutline().forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, 1.5 / sc);
    ctx.strokeStyle = '#0f172a'; ctx.stroke();
    // A centreline, so the heading is unmistakable at small scales.
    ctx.beginPath(); ctx.moveTo(0, -BOAT_L / 2); ctx.lineTo(0, BOAT_L / 2);
    ctx.strokeStyle = 'rgba(15,23,42,0.55)'; ctx.stroke();
    ctx.restore();

    // Read-out beside the hull, clear of the zone ring so it never sits on top of the thing
    // being measured.
    const lines = boatLabel();
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    const w = Math.max(...lines.map(t => ctx.measureText(t).width)) + 14;
    let lx = c.x + zr + 12, ly = c.y - lines.length * 7;
    if (lx + w > W()) lx = Math.max(6, c.x - zr - 12 - w);      // flip to the other side at the edge
    ctx.fillStyle = 'rgba(16,31,42,0.86)';
    ctx.fillRect(lx, ly - 12, w, lines.length * 15 + 10);
    ctx.strokeStyle = 'rgba(251,191,36,0.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(lx, ly - 12, w, lines.length * 15 + 10);
    ctx.fillStyle = '#fbbf24';
    lines.forEach((t, i) => ctx.fillText(t, lx + 7, ly + i * 15));
}

function grid() {
    let step = 100;
    while (step * view.scale < 60) step *= 2;
    while (step * view.scale > 240) step /= 2;
    const tl = toW(0, 0), br = toW(W(), H());
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(tl.x / step) * step; x < br.x; x += step) { const p = toS(x, 0); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, H()); }
    for (let y = Math.floor(tl.y / step) * step; y < br.y; y += step) { const p = toS(0, y); ctx.moveTo(0, p.y); ctx.lineTo(W(), p.y); }
    ctx.stroke();
}

// The overall wind indicator is GONE. There is no one wind on a course whose whole point
// is that the wind varies across it — a single arrow in the corner was a claim the model
// no longer makes. Turn on the wind field to see what the wind is actually doing.

// The scale bar lives in the hint bar, with the cursor read-out and the zoom — the three
// facts about "where am I and how big is this" belong together, not scattered on the map.
function scaleBar() {
    let units = mToU(20);
    while (units * view.scale < 70) units *= 2;
    const el = $('scalebar');
    if (!el) return;
    el.style.width = Math.round(units * view.scale) + 'px';
    $('scaletext').textContent = `${fmtM(units)} · ${fmtBL(units)}`;
}

// ── The selected layer's objects ────────────────────────────────────────────
// One list, driven by the active layer. Every layer answers the same three questions —
// what are the things, which is selected, what is each one's size — so the rows look the
// same whether they are coastlines, floes or legs.
function objRefresh() {
    const box = $('obj-list'), title = $('objs-title'), acts = $('objs-actions');
    if (!box) return;
    const L = layerOf(mode);
    // Course and Water have no objects of their own — Course's parts are the other layers,
    // and Water is a colour rather than a thing — so the column is simply empty rather than
    // announcing that it has nothing to say.
    const hdr = title.closest('.ed-sect');
    // Arena joins them: a list of ONE thing, that can never become two, is a heading and a
    // sentence where a selection would do. The shape itself is on the map.
    if (mode === 'map' || mode === 'water' || mode === 'boundary') {
        title.textContent = ''; acts.innerHTML = ''; box.innerHTML = '';
        if (hdr) hdr.hidden = true;                 // a heading over nothing is noise
        // An EMPTY list must not claim the column's spare height, or the layer's own panel
        // gets pushed to the bottom of an otherwise blank column — which is what Course,
        // Arena and Water all did once the list started growing to fill the space.
        box.classList.remove('has-rows');
        return;
    }
    if (hdr) hdr.hidden = false;
    title.textContent = L ? L.name : '';
    acts.innerHTML = '';
    if (!doc) { box.innerHTML = '<div class="ob-empty">Generated venue — nothing authored to edit.</div>'; return; }

    const act = (label, fn, title2) => {
        const b = document.createElement('button');
        b.className = 'btn btn-ghost'; b.style.cssText = 'font-size:11px;padding:2px 6px';
        b.textContent = label; b.title = title2 || ''; b.onclick = fn;
        acts.appendChild(b);
    };
    const row = (opts) => `<div class="ob${opts.on ? ' on' : ''}" data-i="${opts.i}"`
        + `${opts.drag ? ' draggable="true"' : ''}>`
        + `<span class="ob-g">${opts.glyph || ''}</span>`
        + `<span class="ob-n">${opts.name}</span>`
        + `<span class="ob-c">${opts.count == null ? '' : opts.count}</span></div>`;

    // ── Drag a row to restack ────────────────────────────────────────────────
    // Shared with the route list, which has wanted the same gesture since it got one. The
    // list may be displayed in a different order from the array it edits — Shapes shows
    // front-first over an array stored back-first — so the caller maps a row slot onto an
    // array index and does the move itself.
    const wireReorder = (box2, count, onDrop) => {
        let from = -1;
        const slotAt = (el, ev) => {
            const rect = el.getBoundingClientRect();
            return Math.max(0, Math.min(count, +el.dataset.i + ((ev.clientY - rect.top) > rect.height / 2 ? 1 : 0)));
        };
        box2.querySelectorAll('.ob[draggable]').forEach(el => {
            el.addEventListener('dragstart', (ev) => {
                from = +el.dataset.i;
                el.classList.add('dragging');
                ev.dataTransfer.effectAllowed = 'move';
                ev.dataTransfer.setData('text/plain', String(from));
            });
            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                box2.querySelectorAll('.ob').forEach(x => x.classList.remove('dropbefore', 'dropafter'));
            });
            el.addEventListener('dragover', (ev) => {
                ev.preventDefault();
                box2.querySelectorAll('.ob').forEach(x => x.classList.remove('dropbefore', 'dropafter'));
                const slot = slotAt(el, ev);
                const r2 = box2.querySelector(`.ob[data-i="${slot}"]`);
                if (r2) r2.classList.add('dropbefore');
                else {
                    const last = box2.querySelector(`.ob[data-i="${count - 1}"]`);
                    if (last) last.classList.add('dropafter');
                }
            });
            el.addEventListener('drop', (ev) => {
                ev.preventDefault();
                const f = from >= 0 ? from : parseInt(ev.dataTransfer.getData('text/plain'), 10);
                if (!(f >= 0 && f < count)) return;
                let to = slotAt(el, ev);
                if (f < to) to--;
                if (to === f) return;
                onDrop(f, to);
            });
        });
    };

    if (mode === 'shape') {
        // No "+ Draw" here: Draw (P) is a tool on the strip, and a second button for the
        // same verb is a second thing to keep true.
        // The list is a VIEW of the object selection, so it shows all of it and Shift+click
        // extends it — the same gesture as on the map, because it is the same selection.
        // REVERSED. The array is stored in paint order — index 0 goes down first, furthest
        // back — and a layers list reads the other way round, front at the top, because
        // that is the order you see them stacked on the map.
        const zList = doc.shapes.map((l, i) => ({ l, i })).reverse();
        box.innerHTML = zList.map(({ l, i }, row_i) => {
            const on = inOsel({ kind: 'shape', id: l.id });
            return row({ i: row_i, on, glyph: on ? '◆' : '◇',
                         name: landLabel(l), count: l.outer.length, drag: true });
        }).join('') || '<div class="ob-empty">Nothing here yet — Draw (P) or Place (N) to make some.</div>';
        wire(box, (row_i, _shift, ev) => {
            const refAt = (r) => ({ kind: 'shape', id: zList[r].l.id });
            // A selection made on the MAP has no list anchor yet — seed it from the
            // selection itself, so "click the island, shift-click a row" ranges from
            // the island rather than collapsing to a single pick.
            if (listAnchor < 0) listAnchor = zList.findIndex(({ l }) => inOsel({ kind: 'shape', id: l.id }));
            const rows = listPick(row_i, ev);
            if (rows === null) {           // cmd/ctrl: toggle just this one
                const ref = refAt(row_i);
                osel = inOsel(ref) ? osel.filter(x => !sameObj(x, ref)) : osel.concat([ref]);
            } else {
                osel = rows.map(refAt);
            }
            vsel = [];
            syncSelFromOsel(); objRefresh(); refreshChrome(); draw();
        });
        // Restacking. The list runs front-to-back and the array back-to-front, so a row
        // slot is mirrored onto an array index — dragging a shape UP the list moves it
        // LATER in the array, which is what "draw it in front" means.
        wireReorder(box, zList.length, (f, t) => {
            const arr = doc.shapes, n = arr.length;
            const from = n - 1 - f;
            const to = n - 1 - t;
            arr.splice(to, 0, arr.splice(from, 1)[0]);
            afterEdit(true, 'restack');
        });
    } else if (mode === 'traffic') {
        // A lane ACROSS THE VIEW, so the thing you just made is on screen and grabbable.
        // Drawing one is still the better gesture for a real route; this is for starting
        // from something rather than from nothing.
        act('+ Traffic', () => {
            const halfL = Math.max(400, 0.3 * W() / view.scale);
            const arr = dtrafficW();
            const v = newTrafficEntry([{ x: view.x - halfL, y: view.y }, { x: view.x + halfL, y: view.y }]);
            arr.push(v);
            selTraf = arr.length - 1; selTV = -1;
            afterEdit(true, 'add vessel');
            toast(`Added ${v.id} — drag its ends, or double-click the lane to add a waypoint`);
        });
        // ── THE CLOCK ────────────────────────────────────────────────────────
        // Every vessel at one instant, which is the question authoring traffic actually
        // asks: not "where does this lane go" but "where is everything WHEN THE FLEET IS
        // HERE". Three ships with the same path and different spawn times are three
        // completely different races, and no amount of looking at the lanes shows it.
        //
        // Rendered inside the list box, above the rows, because it belongs to the whole
        // layer rather than to the selected vessel. Its own `oninput` deliberately does NOT
        // call objRefresh — that would rebuild this element mid-drag and drop the pointer.
        const win = raceWindow();
        const at = trafficT == null ? 0 : trafficT;
        const clash = trafficClashes();
        const rows = dtraffic().map((v, i) => {
            const c = trafficCurve(v);
            const live = c && trafficT != null && window.Traffic.localTime(v, c, trafficT);
            const bad = clash.hit.has(i);
            return row({ i, on: i === selTraf, glyph: bad ? '⊘' : (i === selTraf ? '▶' : '▷'),
                         name: bad ? `<span style="color:#f87171">${trafficLabel(v)}</span>` : trafficLabel(v),
                         // While scrubbing, the count says whether this one is even out
                         // there — an empty lane at t is the thing you are looking for.
                         count: trafficT == null ? (c ? `${c.duration.toFixed(0)}s` : `${(v.path || []).length} pts`)
                              : (live ? `${mmssSigned(live.t)}` : '—') });
        }).join('') || '<div class="ob-empty">No traffic yet — Draw (P) to lay a lane.</div>';
        box.innerHTML =
            `<div class="tr-clock" style="padding:6px 8px 8px;border-bottom:1px solid var(--ed-line,#1e293b)">
               <div style="display:flex;justify-content:space-between;font-size:10px;opacity:.7;margin-bottom:3px">
                 <span>${mmssSigned(win.from)}</span>
                 <span id="tr-now" style="font-variant-numeric:tabular-nums;opacity:${trafficT == null ? '.45' : '1'}">${trafficT == null ? 'gun' : mmssSigned(at)}</span>
                 <span>${mmssSigned(win.to)}</span>
               </div>
               <input id="tr-scrub" type="range" style="width:100%;display:block"
                      min="${win.from}" max="${win.to}" step="1" value="${at}">
             </div>` + rows;
        const scrub = box.querySelector('#tr-scrub');
        if (scrub) {
            const paint = () => {
                trafficT = +scrub.value;
                const lbl = box.querySelector('#tr-now');
                if (lbl) { lbl.textContent = mmssSigned(trafficT); lbl.style.opacity = '1'; }
                // The ROWS carry each vessel's own clock, and they have to keep up during the
                // drag — a rebuild would take the slider out from under the pointer, so the
                // cells are written directly instead.
                const cells = box.querySelectorAll('.ob .ob-c');
                dtraffic().forEach((v, k) => {
                    if (!cells[k]) return;
                    const c = trafficCurve(v);
                    const l = c && window.Traffic.localTime(v, c, trafficT);
                    cells[k].textContent = l ? mmssSigned(l.t) : '—';
                    cells[k].style.opacity = l ? '1' : '0.4';
                });
                draw();
            };
            scrub.addEventListener('input', paint);
            if (trafficT != null) paint();
        }
        wire(box, (row_i) => {
            if (row_i !== selTraf) selTV = -1;
            selTraf = row_i;
            inspectorRefresh(); objRefresh(); refreshChrome(); draw();
        });
    } else if (mode === 'marks') {
        // Two kinds of thing on one layer, so the column carries its own second heading —
        // ruled off, in the same kicker as the column's own title, with the verb that makes
        // one sitting in it. "+ Mark" stays in the header, which is the MARKS section.
        act('+ Mark', () => $('btn-add-mark').click());
        const ml = dmarksOf().map((m, i) => row({
            i, on: sel.mark === i,
            glyph: m.kind === 'can' ? '▣' : m.kind === 'none' ? '◌' : m.kind === 'committee' ? '⛴' : '●',
            name: markLabel(i), count: MARK_KIND_LABEL[m.kind] || 'buoy' })).join('')
            || '<div class="ob-empty">No marks yet.</div>';
        const ll = dlines().map((ln, i) => {
            const ends = lineEnds(ln.id);
            const len = ends ? Math.hypot(ends[1].x - ends[0].x, ends[1].y - ends[0].y) : 0;
            return `<div class="ob${selLine === i ? ' on' : ''}" data-line="${i}">`
                 + `<span class="ob-g">━</span><span class="ob-n">${lineLabel(ln.id)}</span>`
                 + `<span class="ob-c">${fmtM(len)}</span></div>`;
        }).join('') || '<div class="ob-empty">No gates yet.</div>';
        box.innerHTML = ml
            + '<div class="ob-head"><span class="k">Gates</span>'
            + '<button class="btn btn-ghost" id="ob-add-gate">+ Gate</button></div>'
            + ll;
        wire(box, (i) => selectMark(i));
        box.querySelectorAll('[data-line]').forEach(el => el.addEventListener('click',
            () => selectLine(+el.dataset.line)));
        const ag = box.querySelector('#ob-add-gate');
        if (ag) ag.addEventListener('click', () => $('btn-add-line').click());
    } else if (mode === 'route') {
        // One action, next to the title: add a leg on the END. What it uses is then a
        // field on the leg itself, so there is no picker to choose from before you can add.
        act('+ Leg', () => {
            const first = dlines()[0] ? `line:${dlines()[0].id}`
                        : dmarksOf()[0] ? `mark:${dmarksOf()[0].id}` : null;
            if (!first) { toast('Make a mark or a gate first', true); return; }
            if (addToRoute(first, 'through')) {
                afterEdit(true, 'add leg');
                toast('Leg added at the end — set what it uses on the right');
            }
        });
        routeRefresh(box);
        return;
    } else if (isRegionMode(mode)) {
        const kind = mode;
        const rs = regsOf(kind), selR = regSel(kind);
        // "+ Here" is gone: Draw (P) makes a region of whatever shape you want. "Whole
        // course" stays because it is NOT the same gesture — it is the one-click answer to
        // "the wind over this whole course differs from the venue", and drawing a rectangle
        // round the entire map by hand is not that.
        act('+ Whole course', () => addWholeCourseRegion(kind));
        // What a row SAYS is the one thing that differs between the kinds, because it is
        // the one thing the object is: a wind is a bearing and a speed, a current is a
        // speed and a set, a gust source is a share of the puffs and what they are like.
        const summary = (r) =>
              kind === 'wind'    ? `${degOf(r.direction || 0)}°${r.speed != null ? ' ' + r.speed.toFixed(0) + 'kt' : ''}`
            : kind === 'current' ? `${(r.speed || 0).toFixed(1)}kt ${degOf(r.direction || 0)}°`
            : kind === 'rapids'  ? `${Math.round((r.turbulence != null ? r.turbulence : 0.5) * 100)}% broken`
            : gustCount(r);
        box.innerHTML = rs.map((r, i) => row({
            i, on: inOsel({ kind, i }) || selR === i,
            glyph: '▭', name: r.name || r.id, count: summary(r)
        })).join('') || `<div class="ob-empty">${
              kind === 'wind'    ? 'No regions. Outside a wind region there is no wind at all, so a course needs its water covered.'
            : kind === 'current' ? 'No current. Water with no region over it simply does not flow.'
            : kind === 'rapids'  ? 'No rapids. Draw a fast smooth tongue down the middle and turbulent shoulders beside it — the shoulders are what make the tongue worth finding.'
            : 'No gust sources — puffs are born evenly over the whole arena, as they are on a venue that says nothing. Draw one where the pressure should come from.'
        }</div>`;
        wire(box, (i, _shift, ev) => {
            if (listAnchor < 0) listAnchor = regSel(kind);   // seed from a map selection
            const rows = listPick(i, ev);
            if (rows === null) {
                const ref = { kind, i };
                osel = inOsel(ref) ? osel.filter(x => !sameObj(x, ref)) : osel.concat([ref]);
            } else {
                osel = rows.map(r => ({ kind, i: r }));
            }
            vsel = [];
            syncSelFromOsel(); objRefresh(); refreshChrome(); draw();
        });
    } else if (mode === 'props') {
        // A row carries the three answers about a prop that matter at a glance: which
        // stratum it lives in (the glyph), what it is (the name), and whether it does
        // anything (the count column — contact or drift, blank for pure scenery).
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        box.innerHTML = dprops().map((p, i) => {
            const T = window.VenueDoc.propTraits(p);
            // ▽ under the water · ≈ on it · ○ on the ground · △ over the fleet
            const glyph = T.plane === 'seabed' ? '▽' : T.plane === 'float' ? '≈'
                        : T.plane === 'canopy' ? '△' : '○';
            const c = T.contact === 'hard' ? 'hard'
                    : T.contact === 'soft' ? `${Math.round(T.drag * 100)}%`
                    : T.motion === 'drift' ? 'adrift' : '';
            return row({ i, on: selProp === i || selProps.includes(i), glyph,
                         name: (reg[p.kind] || {}).label || p.kind, count: c });
        }).join('') || '<div class="ob-empty">No props yet — click the map to place one.</div>';
        wire(box, (i, _shift, ev) => {
            if (listAnchor < 0 && selProp >= 0) listAnchor = selProp;   // seed from the map
            const rows = listPick(i, ev);
            if (rows === null) {
                selProps = selProps.includes(i) ? selProps.filter(x => x !== i) : selProps.concat([i]);
            } else {
                selProps = rows;
            }
            selProp = i;                    // the primary: what the inspector shows
            refreshInspector(); objRefresh(); refreshChrome(); draw();
        });
    } else {
        box.innerHTML = '<div class="ob-empty">Nothing to list for this tool.</div>';
    }
    // Only a list with ROWS in it grows to fill the column. A note saying "nothing here yet"
    // is one line, and a one-line list stretched over 500px of empty panel — with the layer's
    // own settings pinned to the floor beneath it — reads as a layout fault, which is what
    // Course, Arena and Water all looked like.
    box.classList.toggle('has-rows', !!box.querySelector('.ob'));
}
function wire(box, fn) {
    box.querySelectorAll('[data-i]').forEach(el => el.addEventListener('click', (ev) => {
        if (ev.target.tagName === 'B') return;
        fn(+el.dataset.i, ev.shiftKey, ev);
    }));
}

// The standard multi-select grammar, shared by every list that has a multi-capable
// selection: a plain click selects ONE and plants the anchor; Shift+click selects the
// RANGE from the anchor; Cmd/Ctrl+click TOGGLES one row and moves the anchor to it.
// Returns the selected row indices; the caller maps rows onto its own refs.
function listPick(row_i, ev) {
    if (ev && ev.shiftKey && listAnchor >= 0) {
        listCursor = row_i;
        const a = Math.min(listAnchor, row_i), b = Math.max(listAnchor, row_i);
        const out = [];
        for (let r = a; r <= b; r++) out.push(r);
        return out;
    }
    if (ev && (ev.metaKey || ev.ctrlKey)) {
        listAnchor = listCursor = row_i;
        return null;                        // caller toggles this one row
    }
    listAnchor = listCursor = row_i;
    return [row_i];
}

// ── Z cycles the stack ──────────────────────────────────────────────────────
// Z moves the selection one step up its OVERLAP stack (Shift+Z one step down), wrapping
// at the ends. The pivot is overlap, not list position: swapping places with an object
// on the other side of the map changes nothing on screen, so every press here trades
// places with the nearest overlapping neighbour instead — each press is a visible change.
// Only Objects and Props have a draw order to cycle: the weather layers' fields are
// order-independent blends, and the route's order IS the course — z on those would be a
// control that changes the document and changes nothing (or far too much).
function shapesOverlap(a, b) {
    const bb = (l) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const q of l.outer) {
            if (q[0] < x0) x0 = q[0]; if (q[1] < y0) y0 = q[1];
            if (q[0] > x1) x1 = q[0]; if (q[1] > y1) y1 = q[1];
        }
        return { x0, y0, x1, y1 };
    };
    const A = bb(a), B = bb(b);
    if (A.x1 < B.x0 || B.x1 < A.x0 || A.y1 < B.y0 || B.y1 < A.y0) return false;
    try {
        const r = window.polygonClipping.intersection([[...a.outer]], [[...b.outer]]);
        return !!(r && r.length);
    } catch (_) {
        return true;   // bboxes overlap; a degenerate ring choking the lib must not hide a real stack
    }
}
function propsOverlap(a, b) {
    const K = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const T = window.VenueDoc.propTraits;
    if (T(a).plane !== T(b).plane) return false;   // different strata never fight for paint
    const rad = (p) => (((K[p.kind] || {}).world || 40) * (p.scale || 1)) / 2;
    return Math.hypot(a.x - b.x, a.y - b.y) < rad(a) + rad(b);
}
function cycleZ(dir) {
    if (!doc) return false;
    let arr, selIdx, overlaps, commit;
    if (mode === 'shape') {
        arr = doc.shapes;
        const ids = new Set(osel.filter(o => o.kind === 'shape').map(o => o.id));
        selIdx = arr.map((l, i) => ids.has(l.id) ? i : -1).filter(i => i >= 0);
        overlaps = shapesOverlap;
        commit = () => afterEdit(true, 'restack');
    } else if (mode === 'props') {
        arr = dprops();
        selIdx = (selProps.length ? selProps : selProp >= 0 ? [selProp] : []).slice().sort((a, b) => a - b);
        overlaps = propsOverlap;
        commit = () => afterEdit(true, 'restack props');
    } else {
        toast('Z-order applies on Objects and Props — this layer has no stacking', true);
        return false;
    }
    if (!selIdx.length) { toast('Select something to restack', true); return false; }
    const selSet = new Set(selIdx);
    const peerItems = [];
    for (let i = 0; i < arr.length; i++) {
        if (!selSet.has(i) && selIdx.some(s => overlaps(arr[s], arr[i]))) peerItems.push({ i, item: arr[i] });
    }
    if (!peerItems.length) { toast('Nothing overlaps the selection — there is no stack to move in'); return false; }

    // Pick the pivot peer and which side of it the block lands on; wrap at the ends.
    const maxSel = selIdx[selIdx.length - 1], minSel = selIdx[0];
    let pivot, after, wrapped = false;
    if (dir > 0) {
        const up = peerItems.filter(p => p.i > maxSel);
        if (up.length) { pivot = up[0].i; after = true; }
        else { pivot = peerItems[0].i; after = false; wrapped = true; }
    } else {
        const down = peerItems.filter(p => p.i < minSel);
        if (down.length) { pivot = down[down.length - 1].i; after = false; }
        else { pivot = peerItems[peerItems.length - 1].i; after = true; wrapped = true; }
    }

    // Move the block: extract (keeping its internal order), reinsert beside the pivot.
    const primaryItem = mode === 'props' && selProp >= 0 ? arr[selProp] : null;
    const items = selIdx.map(i => arr[i]);
    for (let k = selIdx.length - 1; k >= 0; k--) arr.splice(selIdx[k], 1);
    const adj = pivot - selIdx.filter(s => s < pivot).length;
    const at = after ? adj + 1 : adj;
    arr.splice(at, 0, ...items);

    // Selections that are INDICES have to follow the move; id-based ones already did.
    if (mode === 'props') {
        selProps = items.map((_, k) => at + k);
        selProp = primaryItem ? at + items.indexOf(primaryItem) : at;
    }
    listAnchor = listCursor = -1;          // the list order just changed under them

    const below = peerItems.filter(p => arr.indexOf(p.item) < at).length;
    commit();
    toast(`Stacked ${below + 1} of ${peerItems.length + 1} in the overlap stack`
          + (wrapped ? ' — wrapped' : ''));
    return true;
}

// ── Arrow keys walk the list ────────────────────────────────────────────────
// Up and Down move the selection through the ACTIVE layer's rows, exactly as a click on
// the neighbouring row would — the same selection paths and the same refreshes, so the
// map, the list highlight and the inspector all follow together. The order walked is
// the order DISPLAYED: the shapes list runs front-first over a back-first array, and
// the marks layer runs marks then gates, because that is what the eye reads.
// With nothing selected, Down starts at the top and Up at the bottom.
function moveListSel(dir, extend) {
    if (!doc) return false;
    // Walk the cursor one row; with `extend` (Shift), keep the anchor where it was and
    // the selection becomes the anchor..cursor range — a plain move replants both.
    const walk = (n, fallback) => {
        if (!n) return null;
        let cur = listCursor >= 0 ? listCursor : fallback;
        cur = cur < 0 ? (dir > 0 ? -1 : n) : cur;
        listCursor = Math.max(0, Math.min(n - 1, cur + dir));
        if (!extend || listAnchor < 0) listAnchor = listCursor;
        const a = Math.min(listAnchor, listCursor), b = Math.max(listAnchor, listCursor);
        const rows = [];
        for (let r = a; r <= b; r++) rows.push(r);
        return rows;
    };
    if (mode === 'shape') {
        const zList = doc.shapes.map((l, i) => ({ l, i })).reverse();
        const rows = walk(zList.length, zList.findIndex(({ l }) => inOsel({ kind: 'shape', id: l.id })));
        if (!rows) return false;
        osel = rows.map(r => ({ kind: 'shape', id: zList[r].l.id }));
        vsel = [];
        syncSelFromOsel(); objRefresh(); refreshChrome(); draw();
        return true;
    }
    if (mode === 'marks') {
        // Single-select layer: every verb downstream acts on one mark or one gate, so
        // Shift extends nothing here — the walk itself still works.
        const nm = dmarksOf().length, nl = dlines().length;
        if (!nm && !nl) return false;
        const cur = sel.mark >= 0 ? sel.mark : selLine >= 0 ? nm + selLine : -1;
        const next = Math.max(0, Math.min(nm + nl - 1, cur < 0 ? (dir > 0 ? 0 : nm + nl - 1) : cur + dir));
        if (next < nm) selectMark(next); else selectLine(next - nm);
        objRefresh();
        return true;
    }
    if (mode === 'route') {
        const n = routeOf().length;
        if (!n) return false;
        selRoute = Math.max(0, Math.min(n - 1, selRoute < 0 ? (dir > 0 ? 0 : n - 1) : selRoute + dir));
        refreshInspector(); objRefresh(); refreshChrome(); draw();
        return true;
    }
    if (isRegionMode(mode)) {
        const rows = walk(regsOf(mode).length, regSel(mode));
        if (!rows) return false;
        osel = rows.map(r => ({ kind: mode, i: r }));
        vsel = [];
        syncSelFromOsel(); objRefresh(); refreshChrome(); draw();
        return true;
    }
    if (mode === 'props') {
        const rows = walk(dprops().length, selProp);
        if (!rows) return false;
        selProps = rows;
        selProp = listCursor;
        refreshInspector(); objRefresh(); refreshChrome(); draw();
        return true;
    }
    return false;
}

// ── Inspector ───────────────────────────────────────────────────────────────
// It inspects the SELECTED OBJECT, or the layer when nothing is selected. The header
// names what you are looking at, because a panel of numbers cannot answer that itself.
function inspectorRefresh() {
    if (!$('in-kicker')) return;
    const kick = $('in-kicker'), name = $('in-name'), meta = $('in-meta'), obj = $('insp-obj');
    let k = 'Course', n = doc ? venueName(doc.venue) : '—', m = '', html = '';

    if (!doc) {
        // Two ways to have no document: nothing open at all (the boot state), or a
        // generated venue loaded read-only for preview.
        obj.innerHTML = course
            ? '<div class="in-none">This venue is generated per seed — there is no document to edit.</div>'
            : '<div class="in-none">Nothing open. <b>Open…</b> a .venue.js file to edit it — '
              + 'Save As makes a copy to work on.</div>';
        kick.textContent = course ? 'Generated venue' : 'No venue';
        name.textContent = '—'; meta.textContent = '';
        return;
    }

    // Several things selected: there is no single object to inspect, so say what you have
    // and what can be done to all of it at once, rather than showing one thing's fields and
    // quietly implying the others are not selected.
    if (osel.length > 1) {
        const objs = oselObjects();
        const pts = objs.reduce((a, o) => a + o.rings.reduce((b, r) => b + r.length, 0), 0);
        kick.textContent = 'Selection';
        name.textContent = `${osel.length} shapes`;
        meta.textContent = `${pts} pts total`;
        obj.innerHTML = '<div class="in-sect"><span class="k">Selected together</span>'
            + `<div class="in-note">Drag moves all ${osel.length}. <b>⌘ drag</b> turns them about`
            + ' their shared centre and <b>⌥ drag</b> scales them about it. Duplicate,'
            + ' Resample and Delete are on the bar below the map — they act on the whole'
            + ' selection, so they belong with it rather than in here.</div></div>';
        return;
    }
    if (mode === 'shape' && sel.shape) {
        const l = shapeById(sel.shape);
        // ONE panel for every shape. A floe used to get its own, with a Transform section
        // and nothing else — no name, no kind — which is exactly the asymmetry that made a
        // floe feel like a different class of object from a coastline.
        if (l) { k = 'Shape'; n = landLabel(l);
            m = `${l.outer.length} pts · ${(l.holes || []).length ? (l.holes.length + ' holes') : 'closed'}`;
            html = inspLand(l); }
    } else if (mode === 'traffic' && selTraf >= 0 && dtraffic()[selTraf]) {
        const v = dtraffic()[selTraf];
        k = 'Traffic'; n = trafficLabel(v);
        m = `${v.path.length} pts · ${(v.end || 'despawn')}`;
        html = inspTraffic(v);
    } else if (mode === 'marks' && sel.mark >= 0) {
        const mk = dmarksOf()[sel.mark];
        k = 'Mark'; n = markLabel(sel.mark);
        // Not the kind — the Type field directly below says that, and a header that repeats
        // the control under it is a second place to keep true.
        m = `${Math.round(uToM(mk.x))}, ${Math.round(uToM(mk.y))} m`;
        html = inspMark(mk, sel.mark);
    } else if (mode === 'marks' && selLine >= 0) {
        const ln = dlines()[selLine];
        const ends = lineEnds(ln.id);
        const len = ends ? Math.hypot(ends[1].x - ends[0].x, ends[1].y - ends[0].y) : 0;
        k = 'Gate'; n = lineLabel(ln.id);
        m = ends ? `${fmtM(len)} · ${fmtBL(len)}` : '';
        html = inspGate(ln);
    } else if (mode === 'props' && selProp >= 0 && dprops()[selProp]) {
        const p = dprops()[selProp];
        const reg = (window.VenueDoc.PROP_KINDS || {})[p.kind];
        k = 'Prop'; n = (reg && reg.label) || p.kind;
        m = `${Math.round(uToM(p.x))}, ${Math.round(uToM(p.y))} m`;
        html = inspProp(p);
    } else if (mode === 'route' && selRoute >= 0 && routeOf()[selRoute]) {
        const e = routeOf()[selRoute];
        k = e === startEntry() ? 'Start' : e === finishEntry() ? 'Finish' : 'Leg';
        n = entryLabel(e, selRoute);
        m = '';
        html = inspLeg(e, selRoute);
    } else if (mode === 'boundary' && osel.some(o => o.kind === 'arena')) {
        const bp = doc.world.boundary.poly;
        k = 'Arena'; n = 'Sailing limit';
        m = bp ? `${bp.length} corners · ${fmtArea(arenaArea())}` : `circle · ${fmtArea(arenaArea())}`;
        if (bp) html = inspArena(bp);
    } else if (mode === 'wind' && activeReg()) {
        const r = activeReg();
        k = 'Wind region'; n = r.name || r.id;
        m = `from ${degOf(r.direction || 0)}° ${compassOf(r.direction || 0)}`;
        html = inspWind(r);
    } else if (mode === 'current' && activeReg()) {
        const r = activeReg();
        k = 'Current region'; n = r.name || r.id;
        m = `${(r.speed || 0).toFixed(1)} kt toward ${degOf(r.direction || 0)}° ${compassOf(r.direction || 0)}`;
        html = inspCurrent(r);
    } else if (mode === 'rapids' && activeReg()) {
        const r = activeReg();
        k = 'Rapids'; n = r.name || r.id;
        m = `${Math.round((r.turbulence != null ? r.turbulence : 0.5) * 100)}% broken`;
        html = inspRapids(r);
    } else if (mode === 'gust' && activeReg()) {
        const r = activeReg();
        k = 'Gust source'; n = r.name || r.id;
        // A source has no bearing to report — the wind it is handed decides where its puffs
        // go — so the header says how many it keeps on the water instead.
        m = gustCount(r);
        html = inspGust(r);
    } else {
        // Nothing selected: the header still names where you are. The COURSE is the whole
        // thing, so it shows the course's name rather than a layer's.
        const L = layerOf(mode);
        k = L ? `${L.name} layer` : 'Course';
        n = L ? L.name : venueName(doc.venue);
        const c = L && L.count();
        m = c == null ? '' : String(c);
    }
    // An empty right panel IS the empty state. A header over a void reads as a section that
    // failed to load, and it drags a border across the panel for no reason.
    const head = document.querySelector('.ed-right .in-head');
    if (head) head.hidden = !html;
    kick.textContent = k; name.textContent = n; meta.textContent = m;
    obj.innerHTML = html;
    enhanceSelects(obj);      // the panel re-renders constantly; each render is done once
    obj.querySelectorAll('[data-num]').forEach(el => el.addEventListener('change', () => numEdit(el)));
    obj.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => shapeAct(el.dataset.act)));
    obj.querySelectorAll('[data-rename]').forEach(el => el.addEventListener('change', () => renameSel(el)));
    // Which geometry the leg uses. Switching a gate leg to a mark (or back) changes its
    // KIND, so the fields it needs change with it — hence a full re-render, not a patch.
    obj.querySelectorAll('[data-legref]').forEach(el => el.addEventListener('change', () => {
        const e = routeOf()[selRoute]; if (!e) return;
        const [what, id] = el.value.split(':');
        if (what === 'line') {
            e.kind = 'gate'; e.lineId = id; delete e.markId;
            if (e.dir == null) e.dir = 1;
            if (!e.pass && e !== startEntry() && e !== finishEntry()) e.pass = 'through';
        } else {
            e.kind = 'round'; e.markId = id; delete e.lineId;
            if (!e.side) e.side = 'starboard';
        }
        afterEdit(true, 'leg geometry');
    }));
    obj.querySelectorAll('[data-legseg]').forEach(seg =>
        seg.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
            const e = routeOf()[selRoute]; if (!e) return;
            const key = seg.dataset.legseg, v = btn.dataset.v;
            if (key === 'side') e.side = v;
            else if (key === 'dir' || key === 'windward') e.dir = +v;
            else if (key === 'pass') e.pass = v;
            afterEdit(true, `leg ${key}`);
        })));
    // Point the leg straight at (or straight away from) the breeze where it starts, keeping
    // its length. With the Length field beside it, "exactly 800 m dead upwind" is two moves.
    obj.querySelectorAll('[data-legact]').forEach(el => el.addEventListener('click', () => {
        const up = upwindFrom(legFrom(selRoute));
        if (up == null) { toast('No wind at the start of that leg', true); return; }
        const brg = el.dataset.legact === 'upwind' ? up : up + Math.PI;
        if (!setLegPolar(selRoute, { brg })) { toast('That leg has nothing to move', true); return; }
        afterEdit(true, 'leg bearing');
        toast(`Pointed ${el.dataset.legact === 'upwind' ? 'dead upwind' : 'dead downwind'}`
              + ` — ${Math.round(degOf(brg))}°`);
    }));
    obj.querySelectorAll('[data-gateact]').forEach(el => el.addEventListener('click', () => {
        const ln = dlines()[selLine]; if (!ln) return;
        const res = alignGateToWind(ln);
        if (!res) { toast('No wind over that gate to square it to', true); return; }
        afterEdit(true, 'square gate to wind');
        toast(`Squared to the wind — turned ${Math.abs(res.turned).toFixed(0)}°,`
              + ` wind from ${res.wind}°`);
    }));
    obj.querySelectorAll('[data-mkkind]').forEach(el => el.addEventListener('change', () => {
        const mk = dmarksOf()[sel.mark]; if (!mk) return;
        mk.kind = el.value;
        afterEdit(true, 'mark type');
    }));
    // Prop controls. Axis selects write an OVERRIDE or delete it ("Kind default" is the
    // empty value); afterEdit recompiles, so a contact change re-emits the hidden
    // collider and the router reprices without anything else being told.
    const selPropObj = () => dprops()[selProp];
    obj.querySelectorAll('[data-propkind]').forEach(el => el.addEventListener('change', () => {
        const p = selPropObj(); if (!p) return;
        p.kind = el.value;
        afterEdit(true, 'prop kind');
    }));
    const wirePropAxis = (dat, field, label2) => obj.querySelectorAll(`[${dat}]`).forEach(el =>
        el.addEventListener('change', () => {
            const p = selPropObj(); if (!p) return;
            if (el.value) p[field] = el.value; else delete p[field];
            afterEdit(true, label2);
        }));
    wirePropAxis('data-propplane', 'plane', 'prop plane');
    wirePropAxis('data-propcontact', 'contact', 'prop contact');
    wirePropAxis('data-propmotion', 'motion', 'prop motion');
    const wirePropNum = (dat, fn, label2) => obj.querySelectorAll(`[${dat}]`).forEach(el =>
        el.addEventListener('change', () => {
            const p = selPropObj(); if (!p) return;
            fn(p, el.value.trim());
            afterEdit(true, label2);
        }));
    wirePropNum('data-propdrag', (p, v) => {
        if (v === '') delete p.drag; else p.drag = Math.max(0, Math.min(0.9, (+v || 0) / 100));
    }, 'prop drag');
    wirePropNum('data-propradius', (p, v) => {
        if (v === '') delete p.contactR; else p.contactR = Math.max(4, (+v || 0) * 5);
    }, 'prop radius');
    wirePropNum('data-propheading', (p, v) => {
        p.heading = (((+v || 0) * Math.PI / 180) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    }, 'rotate prop');
    wirePropNum('data-propscalev', (p, v) => {
        p.scale = Math.max(0.25, Math.min(4, (+v || 100) / 100));
    }, 'scale prop');
    // Traffic controls. A blank numeric field DELETES the key rather than writing 0 — the
    // placeholder in each says what the blank means, and "auto" and "zero" are different
    // answers everywhere in this document.
    const selTrafObj = () => dtraffic()[selTraf];
    obj.querySelectorAll('[data-trkind]').forEach(el => el.addEventListener('change', () => {
        const v = selTrafObj(); if (!v) return;
        v.kind = trafficKind = el.value;
        afterEdit(true, 'vessel kind');
    }));
    obj.querySelectorAll('[data-trend]').forEach(el => el.addEventListener('change', () => {
        const v = selTrafObj(); if (!v) return;
        if (el.value === 'despawn') delete v.end; else v.end = el.value;
        // respawn only means anything for a vessel that despawns; carrying it on one that
        // never does is a field that silently does nothing.
        if (v.end && v.end !== 'despawn') delete v.respawn;
        afterEdit(true, 'lane end');
    }));
    obj.querySelectorAll('[data-trrespawn]').forEach(el => el.addEventListener('change', () => {
        const v = selTrafObj(); if (!v) return;
        if (el.value) v.respawn = true; else delete v.respawn;
        afterEdit(true, 'respawn');
    }));
    const wireTrafNum = (dat, fn, label2) => obj.querySelectorAll(`[${dat}]`).forEach(el =>
        el.addEventListener('change', () => {
            const v = selTrafObj(); if (!v) return;
            fn(v, el.value.trim());
            afterEdit(true, label2);
        }));
    wireTrafNum('data-trfirst', (v, x) => { if (x === '') delete v.firstSpawn; else v.firstSpawn = +x || 0; }, 'first spawn');
    wireTrafNum('data-trdelay', (v, x) => { if (x === '') delete v.respawnDelay; else v.respawnDelay = Math.max(0, +x || 0); }, 'respawn gap');
    wireTrafNum('data-trheight', (v, x) => { if (x === '') delete v.height; else v.height = Math.max(0, +x || 0); }, 'vessel height');
    wireTrafNum('data-trshadow', (v, x) => { if (x === '') delete v.windShadow; else v.windShadow = Math.max(0, +x || 0); }, 'wind shadow');
    wireTrafNum('data-trscale', (v, x) => { if (x === '') delete v.scale; else v.scale = Math.max(0.25, Math.min(4, (+x || 100) / 100)); }, 'vessel scale');
    wireTrafNum('data-trvdwell', (v, x) => {
        const q2 = v.path[selTV]; if (!q2 || Array.isArray(q2)) return;
        if (x === '') delete q2.dwell; else q2.dwell = Math.max(0, +x || 0);
    }, 'waypoint wait');
    wireTrafNum('data-trvhdg', (v, x) => {
        let q2 = v.path[selTV]; if (!q2) return;
        // An [x, y, speed] triple cannot hold a heading; promote it to an object rather than
        // silently dropping what was typed.
        if (Array.isArray(q2)) {
            q2 = { x: q2[0], y: q2[1] };
            if (isFinite(v.path[selTV][2])) q2.speed = v.path[selTV][2];
            v.path[selTV] = q2;
        }
        if (x === '') delete q2.heading;
        else q2.heading = ((+x || 0) % 360 + 360) % 360;
    }, 'waypoint heading');
    wireTrafNum('data-trvspeed', (v, x) => {
        const q = v.path[selTV]; if (!q) return;
        if (x === '') { if (Array.isArray(q)) q.length = 2; else delete q.speed; return; }
        // NOT clamped at zero: a negative speed is astern, and clamping it would silently
        // turn a berthing manoeuvre into a vessel driving through the dock.
        const val = +x || 0;
        if (Array.isArray(q)) q[2] = val; else q.speed = val;
    }, 'waypoint speed');
    // Material and softness are the shape's own properties, so they live in its inspector
    // rather than in a panel off to the side.
    const mat = obj.querySelector('#in-mat');
    if (mat) mat.addEventListener('change', () => {
        const l = shapeById(sel.shape); if (!l) return;
        l.kind = LAND_TYPES[+mat.value].kind;
        // Per-shape overrides are exceptions to the OLD kind and mean nothing against the
        // new one — a floe carrying `hard: true` because it used to be granite would be a
        // berg nobody asked for. The kind is a fresh answer, so the exceptions to the
        // previous answer go with it.
        delete l.hard; delete l.hidden; delete l.nav; delete l.look; delete l.motion;
        delete l.awash; delete l.drag;                    // a granite spire you sail through
        delete l.style; delete l.cls; delete l.soft;      // the words this replaced
        afterEdit(true, 'kind');
    });
    relatedChecks();
}

// ── Object inspectors ───────────────────────────────────────────────────────
// Everything here is wired to something real. The design also sketched polygon booleans
// and per-shape wind shadow; those need engine work that does not exist, and a control
// that does nothing is worse than an absent one, so they are not drawn.
const ringBox = (rings) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const ring of rings) for (const p of ring) {
        if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1];
        if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1];
    }
    return { minX: a, minY: b, maxX: c, maxY: d, w: c - a, h: d - b, cx: (a + c) / 2, cy: (b + d) / 2 };
};
const f1 = (v) => Math.round(v * 10) / 10;
// The arena's enclosed water, in KM². A course is kilometres across, so square metres put
// seven digits in a ten-character cell to express a number nobody reads at that precision.
const arenaArea = () => {
    if (!doc) return 0;
    const b = doc.world.boundary;
    const u2 = b.poly ? Math.abs(window.VenueDoc.ringArea(b.poly))
                      : Math.PI * Math.pow((b.circle && b.circle.r) || 0, 2);
    return u2 * uToM(1) * uToM(1) / 1e6;
};
// Three decimals under 1 km², so a small arena does not read as "0.00".
const fmtArea = (km2) => `${km2.toFixed(km2 >= 10 ? 1 : km2 >= 1 ? 2 : 3)} km²`;
// A framed numeric field. `data-num` names what it edits so one handler serves them all.
// `ph` makes it a RELATIVE field: it shows empty with a greyed hint instead of a value,
// because what it holds is an amount to apply, not a measurement to read back.
const numF = (label, key, val, unit, ro, ph) =>
    `<label class="in-f${ro ? ' ro' : ''}"><label>${label}</label>`
    + `<input data-num="${key}" value="${val}"${ph ? ` placeholder="${ph}"` : ''}`
    + `${ro ? ' readonly' : ''} spellcheck="false">`
    + `<span class="dim" style="font-size:11px">${unit || ''}</span></label>`;

// A land shape's readable name. `id` is what the file and every check refer to; `name` is what
// you call it. Same split marks, gates and legs already use — "Granite Isle" is a better thing
// to find in a list of six coastlines than `isle-2`.
const landLabel = (l) => (l && (l.name || l.id)) || '—';
const attr = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                                              .replace(/</g, '&lt;').replace(/>/g, '&gt;');

// What this shape's lee currently comes to, asked of the GAME so the editor cannot answer
// it differently. `auto` is derived from the silhouette the wind sees, so it changes as the
// map turns — which is worth showing rather than implying with a blank box.
// A wake is a question about the WATER COLUMN — does this thing reach the bottom — and
// `motion` already answers it: fixed is grounded, drift is afloat and the stream goes under.
// So the box suggests a real figure for land and says nothing is expected of a floe.
function curPh(l) {
    const isl = (course && course.islands || []).find(i => i.id === l.id);
    if (!isl || typeof window.shadowSuggest !== 'function') return 'none';
    const v = window.shadowSuggest(isl);
    return v > 0 ? `~${Math.round(uToM(v))}` : 'afloat';
}

// The Lee panel makes no sense on a shoal — height, wind shadow and wake are all pinned to
// zero by the compiler, so three boxes that cannot be made to do anything is three boxes
// that teach the wrong thing. Depth replaces it, and says the number in the terms the
// designer is actually choosing: what a boat keeps, and how wide the ramp is.
function shoalSays(T) {
    // "Shallowest part" was right while every awash shape was a sandbar and wrong the
    // moment one could be a weed mat, where the cost is thickness rather than depth.
    // "Thickest" covers both, and the ramp is stated because it is now a real choice —
    // sand shelves over two boat lengths, mud stands up steep, and the number is what
    // says which of those a designer has just placed.
    const ramp = `${Math.round(uToM(T.feather))} m ramp`;
    if (!(T.drag > 0)) return `no drag — something to see and nothing more · ${ramp}`;
    const keep = Math.round((1 - T.drag) * 100);
    return `keeps ${keep}% of her speed over the thickest part, easing back to full`
         + ` at the rim over a ${ramp} · no lee, above or below`;
}

function leeSays(l) {
    const isl = (course && course.islands || []).find(i => i.id === l.id);
    if (!isl || typeof window.shadowLengthOf !== 'function') return 'how far downwind the breeze stays thin';
    const w = window.shadowLengthOf(isl, 'wind'), c = window.shadowLengthOf(isl, 'current');
    if (!(w > 0) && !(c > 0)) {
        return window.VenueDoc.traits(l).motion === 'drift'
            ? 'afloat — the wind passes over it and the stream under it'
            : 'flat to the water — casts no lee. Give it a height.';
    }
    const say = (v, authored) => v > 0 ? `${Math.round(uToM(v))} m${authored ? '' : ' from its height'}` : 'none';
    return `wind ${say(w, l.windShadow != null)} · current ${say(c, l.currentShadow != null)}`;
}

function inspLand(l) {
    const bb = ringBox(eachRing(l));
    const area = Math.abs(window.VenueDoc.ringArea(l.outer));
    // The narrowest gap to any other shape: a channel is only sailable if a boat fits, and
    // this is the number the clearance check reports, brought to where you are editing.
    // Point-to-SEGMENT, which is what the clearance check uses. Measuring vertex-to-vertex
    // instead reported 165 m where the check said 148 m — two numbers for the same gap on
    // the same screen, and no way for a reader to know which one to believe.
    const segD = (px, py, a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
        let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
    };
    let gap = null, gapTo = null;
    // A CHANNEL IS WATER A HULL HAS TO FIT THROUGH, so an awash shape is on neither side of
    // this measurement: a boat sails over one at any width, and the gap to one is not a gap.
    // Reported anyway, it read "min channel 14 m" beside a bar a fleet crosses freely — the
    // same wrong answer the venue check used to give, for the same reason.
    const solid = (s) => !window.VenueDoc.traits(s).awash;
    for (const o of (solid(l) ? doc.shapes.filter(solid) : [])) {
        if (o.id === l.id) continue;
        for (const ringA of eachRing(l)) for (const ringB of eachRing(o)) {
            for (const q of ringA) for (let i = 0; i < ringB.length; i++) {
                const d = segD(q[0], q[1], ringB[i], ringB[(i + 1) % ringB.length]);
                if (gap == null || d < gap) { gap = d; gapTo = landLabel(o); }
            }
            for (const q of ringB) for (let i = 0; i < ringA.length; i++) {
                const d = segD(q[0], q[1], ringA[i], ringA[(i + 1) % ringA.length]);
                if (gap == null || d < gap) { gap = d; gapTo = landLabel(o); }
            }
        }
    }
    const T = TR(l);
    const t = LAND_TYPES.findIndex(x => x.kind === T.kind);
    // What this kind DOES, read off the shared table rather than written out again. Three
    // facts, because they are the three a designer is choosing between: does it move, does
    // it stop you, and is it there to be seen at all.
    //
    // An AWASH shape answers the middle one differently enough to deserve its own words:
    // "soft collision" would say there is a collision, and the whole point of a shoal is
    // that there is not. So it states the crossing cost instead, which is the only thing
    // it does to a boat.
    const says = [T.motion === 'drift' ? 'drifts' : 'fixed',
                  T.awash ? `sailed over · ${Math.round(T.drag * 100)}% slower at its heart`
                          : T.hard ? 'grounds you' : 'soft collision',
                  T.hidden ? 'not drawn' : null,
                  T.nav ? null : 'no pathfinding'].filter(Boolean).join(' · ');
    return `
<div class="in-sect"><span class="k">Name</span>
  <input class="in-wide" data-rename="shape" value="${attr(l.name || '')}" placeholder="${attr(l.id)}">
</div>
<div class="in-sect"><span class="k">Kind</span>
  <select class="in-wide" id="in-mat">${LAND_TYPES.map((x, i) =>
    `<option value="${i}"${i === t ? ' selected' : ''}>${x.label}</option>`).join('')}</select>
  <div class="in-sub" id="in-kindsays">${says}</div>
</div>
${T.awash ? `<div class="in-sect"><span class="k">Depth</span>
  <div class="in-grid">
    ${numF('Drag', 'shape.drag', f1(T.drag * 100), '%', false, '50')}
    ${numF('Ramp', 'shape.fth', l.feather != null ? f1(uToM(l.feather)) : '', 'm', false, f1(uToM(T.feather)))}
  </div>
  <div class="in-sub">${shoalSays(T)}</div>
</div>` : `<div class="in-sect"><span class="k">Lee</span>
  <div class="in-grid">
    ${numF('Height', 'shape.hgt', l.height != null ? f1(l.height) : '', 'm', false, '0')}
    ${numF('Wind', 'shape.wsh', l.windShadow != null ? f1(uToM(l.windShadow)) : '', 'm', false, 'from height')}
    ${numF('Current', 'shape.csh', l.currentShadow != null ? f1(uToM(l.currentShadow)) : '', 'm', false, curPh(l))}
  </div>
  <div class="in-sub">${leeSays(l)}</div>
</div>`}
<div class="in-sect"><span class="k">Transform</span>
  <div class="in-grid">
    ${numF('X', 'shape.x', f1(uToM(bb.cx)), 'm')}
    ${numF('Y', 'shape.y', f1(uToM(bb.cy)), 'm')}
    ${numF('W', 'shape.w', f1(uToM(bb.w)), 'm')}
    ${numF('H', 'shape.h', f1(uToM(bb.h)), 'm')}
    ${numF('∠ by', 'shape.rot', '', '°', false, '0')}
    ${numF('Area', 'shape.area', (uToM(1) * uToM(1) * area / 1e6).toFixed(3), 'km²', true)}
  </div>
</div>
${gap != null ? `<div class="in-sect"><span class="k">Path</span>
  <div class="in-row"><span>Min channel to ${gapTo}</span>
    <span class="num">${fmtM(gap)} · ${fmtBL(gap)}</span></div>
</div>` : ''}
`;
}

// The arena takes the same Transform block as a land shape, because it now takes the same
// gestures. Its size and position are the numbers you would otherwise be dragging for.
function inspArena(bp) {
    const bb = ringBox([bp]);
    return `
<div class="in-sect"><span class="k">Transform</span>
  <div class="in-grid">
    ${numF('X', 'arena.x', f1(uToM(bb.cx)), 'm')}
    ${numF('Y', 'arena.y', f1(uToM(bb.cy)), 'm')}
    ${numF('W', 'arena.w', f1(uToM(bb.w)), 'm')}
    ${numF('H', 'arena.h', f1(uToM(bb.h)), 'm')}
    ${numF('∠ by', 'arena.rot', '', '°', false, '0')}
  </div>
</div>`;
}

// A wind region's own numbers, in the panel that shows the selected object — same place a
// land shape's material and transform live. `data-wr` names the field so one handler serves
// them all, and the inputs are rebuilt on every refresh, so they must be bound AFTER render
// rather than once at startup.
function inspWind(r) {
    const dirDeg = degOf(r.direction || 0);
    return `
<div class="in-sect"><span class="k">Name</span>
  <input class="in-wide" data-rename="wind" value="${attr(r.name || '')}" placeholder="${attr(r.id)}">
</div>
<div class="in-sect"><span class="k">Wind here</span>
  <div class="in-grid">
    ${numF('from', 'wr.dir', dirDeg, '°')}
    ${numF('± ', 'wr.dirvar', Math.round((r.dirVar || 0) * 180 / Math.PI), '°')}
    ${numF('speed', 'wr.speed', r.speed != null ? r.speed : 0, 'kt')}
    ${numF('± ', 'wr.speedvar', r.speedVar || 0, 'kt')}
  </div>
</div>
<div class="in-sect"><span class="k">Shape of the effect</span>
  <div class="in-grid">
    ${numF('period', 'wr.period', r.period != null ? r.period : 30, 's')}
    ${numF('falloff', 'wr.falloff', Math.round(uToM(r.falloff != null ? r.falloff : 400)), 'm')}
  </div>
</div>`;
}

// A current region's own numbers, beside the wind's. The one wording difference is load-
// bearing: a current is named by where it SETS — the water is going that way — where a wind
// is named by where it comes from. Both draw arrows along the flow.
// Which sign of `dir` crosses this gate TOWARD the wind — i.e. upwind. The crossing vector
// is `(dy, -dx) * dir` (the same normal the map arrow is drawn from), and the direction the
// wind comes from is `(sin w, -cos w)`; if they agree, that sign is upwind. Returns 0 when
// the gate lies along the wind and neither crossing is meaningfully up or down it.
function dirTowardWind(e, probe) {
    const ends = entryEnds(e);
    if (!ends || typeof getWindAt !== 'function') return 0;
    const [m0, m1] = ends;
    const mx = (m0.x + m1.x) / 2, my = (m0.y + m1.y) / 2;
    const w = getWindAt(mx, my);
    if (!w || !(w.speed > 0.01)) return 0;
    let nx = (m1.y - m0.y) * probe, ny = -(m1.x - m0.x) * probe;
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const ux = Math.sin(w.direction), uy = -Math.cos(w.direction);   // toward the SOURCE
    const dot = nx * ux + ny * uy;
    return Math.abs(dot) < 0.08 ? 0 : (dot > 0 ? probe : -probe);
}

// Square a gate to the wind ACROSS it: rotate both its marks about their midpoint until the
// line is perpendicular to the breeze at that point. A start line is square to the wind, and
// on a course with a bend the honest answer is the wind where the gate IS, not the venue mean.
function alignGateToWind(ln) {
    const ends = lineEnds(ln.id);
    if (!ends || typeof getWindAt !== 'function') return null;
    const [a, b] = ends;
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const w = getWindAt(cx, cy);
    if (!w || !(w.speed > 0.01)) return null;
    // Bearings: a heading d points along (sin d, -cos d), so a vector's bearing is
    // atan2(dx, -dy). Square to the wind means the line's own bearing is the wind's + 90.
    const cur = Math.atan2(b.x - a.x, -(b.y - a.y));
    let delta = (w.direction + Math.PI / 2) - cur;
    // A line is symmetric, so turn the SHORT way and leave which mark is which end alone —
    // swapping the ends would silently invert what `dir` means for every leg using it.
    delta = ((delta + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2;
    const cs = Math.cos(delta), sn = Math.sin(delta);
    for (const m of [a, b]) {
        const dx = m.x - cx, dy = m.y - cy;
        m.x = cx + dx * cs - dy * sn;
        m.y = cy + dx * sn + dy * cs;
    }
    return { turned: delta * 180 / Math.PI, wind: degOf(w.direction) };
}

// A LEG's fields. The list says where it sits in the order; this says what it is — which
// gate or mark it uses, and which way you take it. Changing the geometry a leg refers to is
// an edit to the ROUTE, not to the water: the marks and gates themselves are untouched.
// ── A leg's LENGTH and BEARING ──────────────────────────────────────────────
// The answer to "make the windward gate exactly 800 m upwind". A race officer does not
// think in coordinates — they think "the beat is 800 metres and it is square to the
// breeze" — and the document already models a course as a route of legs, so the leg is
// where those two numbers belong. Typing them is how a course is laid precisely; dragging
// a mark and reading a distance off the ruler is how it is laid approximately.
//
// A leg is measured from the point the PREVIOUS entry sends you to, which is what a leg is.
// The first entry has no previous, so it has no length — nothing has happened yet.
const entryPoint = (e) => {
    if (!e) return null;
    if (e.kind === 'round') {
        const k = markIndex(e.markId);
        const m = dmarksOf()[k];
        return m ? { x: m.x, y: m.y } : null;
    }
    const ends = entryEnds(e);
    return ends ? { x: (ends[0].x + ends[1].x) / 2, y: (ends[0].y + ends[1].y) / 2 } : null;
};
const legFrom = (i) => entryPoint(routeOf()[i - 1]);

// Move what this leg SENDS YOU TO, keeping its shape. A gate translates as a whole, so its
// width and orientation survive — you are moving the gate, not one of its marks. A gate used
// by more than one leg moves for all of them, which is the same gate being in one place.
function moveEntryTo(e, pt) {
    const at = entryPoint(e);
    if (!at || !pt) return false;
    const dx = pt.x - at.x, dy = pt.y - at.y;
    if (e.kind === 'round') {
        const m = dmarksOf()[markIndex(e.markId)];
        if (!m) return false;
        m.x += dx; m.y += dy;
        return true;
    }
    const ends = entryEnds(e);
    if (!ends) return false;
    for (const m of ends) { m.x += dx; m.y += dy; }
    return true;
}

// Bearing convention, as everywhere else: 0 = north = up, clockwise, so east is 90.
const bearingOf = (from, to) => Math.atan2(to.x - from.x, -(to.y - from.y));

// Where "straight into the wind" points, from the leg's own starting point — so on a course
// with a bend the beat follows the breeze where the beat actually begins.
function upwindFrom(pt) {
    if (!pt || typeof getWindAt !== 'function') return null;
    const w = getWindAt(pt.x, pt.y);
    if (!w || !(w.speed > 0.01)) return null;
    return w.direction;      // wind is NAMED by where it comes from, which is where you beat to
}

// Set one of the two and keep the other. This is what makes the pair usable: typing a
// length must not swing the leg, and typing a bearing must not stretch it.
function setLegPolar(i, opts) {
    const e = routeOf()[i], from = legFrom(i), at = entryPoint(e);
    if (!e || !from || !at) return false;
    const curLen = Math.hypot(at.x - from.x, at.y - from.y);
    const len = opts.len != null ? opts.len : curLen;
    const brg = opts.brg != null ? opts.brg : bearingOf(from, at);
    if (!(len > 0)) return false;
    return moveEntryTo(e, { x: from.x + Math.sin(brg) * len,
                            y: from.y - Math.cos(brg) * len });
}

// The rounding circle's radius, typed. Same floor as the ring drag: never smaller than
// the thing being rounded, or the rounding could be satisfied without going round it.
function setLegZone(i, zu) {
    const e = routeOf()[i];
    if (!e || e.kind !== 'round' || !(zu > 0)) return false;
    const cm = (course && course.route[i] && course.route[i].mark) || null;
    const minR = cm ? (cm.radius || 12) * 1.05 + 40 : 80;
    e.zone = Math.max(minR, zu);
    if (cm) cm.zone = e.zone;
    return true;
}

// WHAT THIS LEG COSTS, priced by the same function as the course total and the auto time
// limit (CoursePath.priceLeg) — so a designer reading a leg's best time is reading the
// number it contributes, not a lookalike computed a second way.
//
// Measured along the PATH the route layer draws, not mark to mark: on a leg that goes round
// a headland those are very different, and the path is the one a boat sails.
function legBest(i) {
    const L = course && course.dmc && course.dmc.legs[i];
    if (!L || !L.pts || L.pts.length < 2) return '';
    const r = CoursePath.priceLeg(L.pts, windBase(), 14);
    if (!(r.secs > 0)) return '';
    const upPct = Math.round(100 * r.upwind / Math.max(1, r.geom));
    return `<div class="in-sub">best <b>${mmss(r.secs)}</b> along ${fmtM(r.geom)} of path`
         + `${upPct > 5 ? ` — ${upPct}% of it upwind, so ${fmtM(r.sailed)} sailed` : ''}</div>`;
}

function inspLeg(e, i) {
    const opts = [];
    for (const ln of dlines())
        opts.push(`<option value="line:${ln.id}"${e.lineId === ln.id ? ' selected' : ''}>`
                + `${attr(lineLabel(ln.id))}</option>`);
    dmarksOf().forEach((m, k) =>
        opts.push(`<option value="mark:${m.id}"${e.markId === m.id ? ' selected' : ''}>`
                + `${attr(markLabel(k))}</option>`));

    // What "which way" means depends on the kind: a gate is crossed in a direction, a mark
    // is left to a side. Offering both at once would be two controls where one applies.
    let way = '';
    if (e.kind === 'round') {
        // The rounding circle is a property of the LEG — the same mark can be rounded
        // wide on one lap and tight on another. Typed here or dragged on the map.
        const cm = (course && course.route[i] && course.route[i].mark) || null;
        const zoneU = e.zone != null ? e.zone : (cm && cm.zone != null ? cm.zone : 165);
        way = `<div class="in-sect"><span class="k">Rounding</span>
  <div class="in-seg" data-legseg="side">
    <button data-v="port"${e.side === 'port' ? ' class="on"' : ''}>Leave to port</button>
    <button data-v="starboard"${e.side !== 'port' ? ' class="on"' : ''}>Starboard</button>
  </div>
  <div class="in-grid" style="margin-top:10px">
    ${numF('circle', 'leg.zone', Math.round(uToM(zoneU)), 'm')}
  </div>
  <div class="in-sub">The rounding circle's radius — drag its ring on the map, or type it.</div>
</div>`;
    } else {
        // Crossing the first or last gate IS the start or the finish — "through" versus
        // "round an end" only means something for a gate in the middle of the course.
        const passRow = (e === startEntry() || e === finishEntry()) ? '' : `
  <span class="k" style="display:block;margin-top:10px">Sailed</span>
  <div class="in-seg" data-legseg="pass">
    <button data-v="through"${e.pass === 'through' ? ' class="on"' : ''}>Through</button>
    <button data-v="round"${e.pass !== 'through' ? ' class="on"' : ''}>Round an end</button>
  </div>`;
        // Which way a gate is crossed has a NAME on a race course — you cross the start
        // line going upwind and the finish coming down — so it can be set by that name and
        // not only by "one way / the other". The wind is sampled AT the gate, so on a course
        // with a bend these follow the breeze where the gate actually is.
        const up = dirTowardWind(e, +1);
        const upLabel = up === 0 ? '' : `
  <span class="k" style="display:block;margin-top:10px">Or by the wind</span>
  <div class="in-seg" data-legseg="windward">
    <button data-v="${up}"${e.dir === up ? ' class="on"' : ''}>Upwind</button>
    <button data-v="${-up}"${e.dir === -up ? ' class="on"' : ''}>Downwind</button>
  </div>`;
        way = `<div class="in-sect"><span class="k">Crossed</span>
  <div class="in-seg" data-legseg="dir">
    <button data-v="1"${e.dir > 0 ? ' class="on"' : ''}>One way</button>
    <button data-v="-1"${e.dir > 0 ? '' : ' class="on"'}>The other</button>
  </div>${upLabel}${passRow}
</div>`;
    }
    // ── Where this leg goes, as a length and a bearing ──────────────────────
    // The first entry has no previous point, so there is no leg yet — nothing to measure.
    let geom = '';
    const from = legFrom(i), at = entryPoint(e);
    if (from && at) {
        const len = Math.hypot(at.x - from.x, at.y - from.y);
        const brg = degOf(bearingOf(from, at));
        const up = upwindFrom(from);
        // How far off the breeze this leg runs — the difference between a beat and a reach,
        // and the number that says whether "upwind" is a fair description of it.
        const off = up == null ? null
            : Math.abs(((degOf(bearingOf(from, at)) - degOf(up) + 540) % 360) - 180);
        const says = off == null ? 'no wind here to measure against'
            : off < 5  ? 'dead upwind'
            : off < 45 ? `${Math.round(off)}° off the wind — a beat`
            : off > 175 ? 'dead downwind'
            : off > 135 ? `${Math.round(180 - off)}° off dead downwind — a run`
            : `${Math.round(off)}° off the wind — a reach`;
        geom = `
<div class="in-sect"><span class="k">Leg</span>
  <div class="in-grid">
    ${numF('Length', 'leg.len', f1(uToM(len)), 'm')}
    ${numF('Bearing', 'leg.brg', Math.round(brg), '°')}
  </div>
  <div class="in-sub">${says}</div>
  ${legBest(i)}
  ${up == null ? '' : '<div class="ed-acts-in"><button class="btn btn-line btn-sm"'
      + ' data-legact="upwind">Dead upwind</button>'
      + '<button class="btn btn-line btn-sm" data-legact="downwind">Dead downwind</button></div>'}
</div>`;
    }
    return `
<div class="in-sect"><span class="k">Name</span>
  <input class="in-wide" data-rename="leg" value="${attr(e.name || '')}" placeholder="${attr(entryLabel(e, i))}">
</div>
<div class="in-sect"><span class="k">Goal</span>
  <select class="in-wide" data-legref>${opts.join('')}</select>
</div>
${geom}${way}`;
}

// A mark's own fields, in the panel that shows the selected object. Name follows the same
// rule every other name field does: blank falls back to the derived label, which is shown as
// the placeholder so the box explains itself.
// A prop's inspector: three AXES (plane, contact, motion), each a preset on the kind
// that one placement may override — so every select leads with "Kind default", and
// choosing it deletes the override rather than writing the same value under a
// different name. The conditional rows (drag when soft, radius whenever there is
// contact) appear with the choice that makes them mean something.
// The vessel panel. Everything an entry can carry, in the order it is decided: what it is,
// how fast, when, and what happens at the end of the lane.
function inspTraffic(v) {
    const K = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    // ── ONLY THINGS THAT COULD ACTUALLY BE TRAFFIC ───────────────────────────────────
    // Gated on a measured `hull`, which is not a stand-in for "is a boat" but the thing
    // traffic genuinely REQUIRES: the capsule that stops a hull and the silhouette that
    // casts the lee are both built from it, and a kind without one falls back to a guessed
    // oblong. So the rule is "we have measured this hull", which stays true as vessels are
    // added and cannot drift the way a hand-kept list of names would.
    //
    // The vessel's OWN kind is always offered even if it fails the gate, so an older
    // document shows what it actually holds instead of silently reading as something else.
    const kindOpts = Object.entries(K)
        .filter(([key, val]) => Array.isArray(val.hull) || key === v.kind)
        .sort((a, b) => a[1].label.localeCompare(b[1].label))
        .map(([key, val]) => `<option value="${key}"${key === v.kind ? ' selected' : ''}>${val.label}</option>`).join('');
    const ENDS = { despawn: 'Despawn — gone at the end',
                   stay: 'Stay — remains where it stopped',
                   wrap: 'Loop — round and round, no seam',
                   pingpong: 'Ping-pong — back the way it came' };
    // SHOWN, NOT CHOSEN. The wake belongs to the hull — a cargo ship throws a wedge wherever
    // she sails — so it is read off the kind and stated here rather than offered as a
    // decision the same vessel could answer differently on two lanes.
    const wkSpec = (K[v.kind] || {}).wake || { kind: 'kelvin' };
    const nHulls = Array.isArray(wkSpec.hulls) && wkSpec.hulls.length ? wkSpec.hulls.length : 1;
    const wakeText = wkSpec.kind === 'none' ? 'none'
        : (wkSpec.kind === 'kelvin' ? 'Kelvin wedge' : (nHulls > 1 ? `${nHulls} ribbons` : 'ribbon'))
          + (wkSpec.symmetric ? ', either end leading' : '');
    const endOpts = Object.entries(ENDS).map(([k, l]) =>
        `<option value="${k}"${(v.end || 'despawn') === k ? ' selected' : ''}>${l}</option>`).join('');

    const respawnRow = (v.end || 'despawn') === 'despawn' ? `
    <label class="k">respawn</label>
    <select class="in-wide" data-trrespawn>
      <option value=""${!v.respawn ? ' selected' : ''}>No — one passage</option>
      <option value="1"${v.respawn ? ' selected' : ''}>Yes — comes round again</option>
    </select>
    <label class="k">gap</label><input class="in-wide" data-trdelay value="${v.respawnDelay != null ? v.respawnDelay : ''}" placeholder="60">` : '';

    // HEIGHT drives the lee through the SAME rule islands use — ten times the height of the
    // thing casting it — so the length below shows what the height works out to as its
    // placeholder, and typing a length overrides it.
    const kd = K[v.kind] || {};
    const hull = kd.hull || [0.9, 0.3];
    const beamU = hull[1] * (kd.world || 40) * (v.scale || 1);
    const autoH = Math.round(uToM(beamU));
    const usedH = v.height != null ? v.height : autoH;
    const autoLen = Math.round(mToU(usedH) * 10);

    // THE PASSAGE, in the units a designer thinks in. Units and raw seconds were what the
    // maths happened to produce; "how far is it and how long does it take" is the question
    // being asked of a schedule, and it is asked in kilometres and minutes.
    const c = trafficCurve(v);
    const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
    const passage = c ? `${(uToM(c.length) / 1000).toFixed(2)} km · ${mmss(c.duration)}`
                      : 'path incomplete';

    // DWELL ONLY WHERE THE VESSEL HAS STOPPED. A wait at any other speed would be an
    // instantaneous halt and restart, which is the one thing the speed ramp exists to
    // prevent — so the field appears when the speed is 0 and not before. That also makes the
    // rule discoverable without a line of prose: type 0, and somewhere to put the wait shows
    // up beneath it.
    const q = selTV >= 0 ? v.path[selTV] : null;
    const stopped = q && tpSpeedAt(v, selTV) === 0;
    const dwellRow = stopped ? `
    <label class="k">wait s</label>
    <input class="in-wide" data-trvdwell value="${q.dwell != null ? q.dwell : ''}" placeholder="0">` : '';
    const vertRow = q ? `
<div class="in-sect"><span class="k">Waypoint ${selTV + 1} of ${v.path.length}</span>
  <div class="in-grid">
    <label class="k">speed</label>
    <input class="in-wide" data-trvspeed value="${isFinite(tpSpeed(q)) ? tpSpeed(q) : ''}"
           placeholder="${tpSpeedAt(v, selTV)}">
    ${dwellRow}
    <label class="k">heading °</label>
    <input class="in-wide" data-trvhdg value="${q.heading != null ? q.heading : ''}"
           placeholder="${Math.round(trafficHeadingAt(v, selTV) * 180 / Math.PI)}">
  </div>
</div>` : '';

    return `
<div class="in-sect"><span class="k">Name</span>
  <input class="in-wide" data-rename="traffic" value="${attr(v.name || '')}" placeholder="${attr(v.id)}">
</div>
<div class="in-sect"><span class="k">Vessel</span>
  <select class="in-wide" data-trkind>${kindOpts}</select>
  <div class="in-grid" style="margin-top:8px">
    <label class="k">scale %</label><input class="in-wide" data-trscale value="${v.scale != null ? Math.round(v.scale * 100) : ''}" placeholder="100">
    <label class="k">wake</label><span class="in-wide" style="opacity:.7;align-self:center">${wakeText}</span>
  </div>
</div>
<div class="in-sect"><span class="k">Wind shadow</span>
  <div class="in-grid">
    <label class="k">height m</label><input class="in-wide" data-trheight value="${v.height != null ? v.height : ''}" placeholder="${autoH}">
    <label class="k">length u</label><input class="in-wide" data-trshadow value="${v.windShadow != null ? v.windShadow : ''}" placeholder="${autoLen}">
  </div>
</div>
<div class="in-sect"><span class="k">Schedule</span>
  <div class="in-grid">
    <label class="k">first spawn</label><input class="in-wide" data-trfirst value="${v.firstSpawn != null ? v.firstSpawn : ''}" placeholder="0">
    <label class="k">end</label><select class="in-wide" data-trend>${endOpts}</select>
    ${respawnRow}
  </div>
  <div class="in-note">${passage}</div>
</div>
${vertRow}`;
}

function inspProp(p) {
    const K = window.VenueDoc.PROP_KINDS || {};
    const T = window.VenueDoc.propTraits(p);
    const kd = K[p.kind] || {};
    // Keep in step with VenueDoc.PROP_PLANES — a plane missing here renders as an
    // "undefined" option rather than failing loudly.
    const PLANES = { seabed: 'Underwater', float: 'Floating — behind land',
                     surface: 'Surface — below boats', canopy: 'Canopy — above boats' };
    const CONTACTS = { none: 'None — scenery', soft: 'Soft — slows', hard: 'Hard — stops' };
    const MOTIONS = { fixed: 'Fixed', drift: 'Drifting (forces no contact)' };
    const axis = (dat, preset, override, opts) => `<select class="in-wide" ${dat}>`
        + `<option value=""${override == null ? ' selected' : ''}>Kind default — ${opts[preset]}</option>`
        + Object.entries(opts).map(([v, l]) =>
            `<option value="${v}"${override === v ? ' selected' : ''}>${l}</option>`).join('')
        + '</select>';
    const kindOpts = Object.entries(K)
        .sort((a, b) => a[1].label.localeCompare(b[1].label))
        .map(([key, v]) => `<option value="${key}"${key === p.kind ? ' selected' : ''}>${v.label}</option>`).join('');
    const dragRow = T.contact === 'soft'
        ? `<label class="k">drag %</label><input class="in-wide" data-propdrag
             value="${p.drag != null ? Math.round(p.drag * 100) : ''}"
             placeholder="${Math.round((kd.drag != null ? kd.drag : 0.5) * 100)}">` : '';
    const radiusRow = T.contact !== 'none'
        ? `<label class="k">radius m</label><input class="in-wide" data-propradius
             value="${p.contactR != null ? Math.round(uToM(p.contactR)) : ''}"
             placeholder="${Math.round(uToM(T.contactR))}">` : '';
    return `
<div class="in-sect"><span class="k">Prop</span>
  <select class="in-wide" data-propkind>${kindOpts}</select>
</div>
<div class="in-sect"><span class="k">Plane</span>
  ${axis('data-propplane', kd.plane || 'surface', p.plane, PLANES)}
</div>
<div class="in-sect"><span class="k">Contact</span>
  ${axis('data-propcontact', kd.contact || 'none', p.contact, CONTACTS)}
  ${dragRow || radiusRow ? `<div class="in-grid" style="margin-top:8px">${dragRow}${radiusRow}</div>` : ''}
</div>
<div class="in-sect"><span class="k">Motion</span>
  ${axis('data-propmotion', kd.motion || 'fixed', p.motion, MOTIONS)}
</div>
<div class="in-sect"><span class="k">Transform</span>
  <div class="in-grid">
    <label class="k">heading °</label><input class="in-wide" data-propheading value="${Math.round((p.heading || 0) * 180 / Math.PI)}">
    <label class="k">scale %</label><input class="in-wide" data-propscalev value="${Math.round((p.scale || 1) * 100)}">
  </div>
</div>`;
}

function inspMark(m, i) {
    const derived = markLabel(i);
    return `
<div class="in-sect"><span class="k">Name</span>
  <input class="in-wide" data-rename="mark" value="${attr(m.name || '')}" placeholder="${attr(derived)}">
</div>
<div class="in-sect"><span class="k">Type</span>
  <select class="in-wide" data-mkkind>
    ${MARK_KINDS.map(k => `<option value="${k}"${(m.kind || 'inflatable') === k ? ' selected' : ''}>${MARK_KIND_TITLE[k]}</option>`).join('')}
  </select>
</div>`;
}

// A gate is a NAMED PAIR of marks. Width resizes the line about its midpoint, keeping
// its bearing — moving or swinging it stays a map gesture.
function inspGate(ln) {
    const ends = lineEnds(ln.id);
    const len = ends ? Math.hypot(ends[1].x - ends[0].x, ends[1].y - ends[0].y) : 0;
    return `
<div class="in-sect"><span class="k">Name</span>
  <input class="in-wide" data-rename="gate" value="${attr(ln.name || '')}" placeholder="${attr(lineLabel(ln.id))}">
</div>
<div class="in-sect"><span class="k">Line</span>
  <div class="in-grid">
    ${numF('width', 'gate.width', Math.round(uToM(len)), 'm')}
  </div>
  <button class="btn btn-fill" data-gateact="square" style="width:100%;justify-content:center;margin-top:10px">Square to the wind</button>
</div>`;
}

// How many live cells this source keeps on the water. An absolute count now, not a share of
// a venue-wide population — that variable is gone, so there is nothing left to take a share
// of. A source states its own population the way a wind region states its own speed.
const gustCount = (r) => `${r.count != null ? r.count : 8} puffs`;

// A GUST SOURCE's numbers. Not a state of the water — a birthplace — so there is no
// direction and no speed here: the wind at the source carries the puff away.
//
// Nothing falls back to the venue. Gusts are stated by sources exactly as the wind is stated
// by wind regions, so a course with no sources has a steady breeze — which is a legitimate
// course, and the one every venue has until someone draws one.
// ── HOW FAR A PUFF GETS BEFORE IT DIES ──────────────────────────────────────
// `life` in seconds is only meaningful next to the distance it buys, and that distance is
// what decides whether a source works at all. A puff drifts at ~0.75x the wind, so on a
// 1.75 km course it clears the whole map in well under a minute. A source asking for
// 165-second puffs there is asking for cells that spend three quarters of their lives off
// the map — and because a departed cell still counts against `count`, the source reads full
// while the water is empty. That failure is silent, it is easy to author, and this line is
// the only place a designer would ever see it.
function gustReach(r) {
    const lifeS = r.lifeS != null ? r.lifeS : 90;
    const kt = state && state.wind ? state.wind.speed : 0;
    if (!(kt > 0)) return '';
    const driftMps = uToM(kt * 15 * 0.75);          // units/s = knots x 15; puffs ride ~0.75x
    const reachM = Math.round(driftMps * lifeS);
    const mapM = Math.round(uToM((doc && doc.world && doc.world.size) || 8750));
    const ratio = reachM / mapM;
    const verdict = ratio > 1.6
        ? `<b>outlives the map ${ratio.toFixed(1)}x</b> — most of its life is spent off the course, still counting against Puffs`
        : ratio < 0.25
            ? `dies well short of crossing — a local flutter rather than a puff you can chase`
            : `crosses about ${Math.round(ratio * 100)}% of the map`;
    return `<div class="in-note">At this venue's ${Math.round(kt)} kt a puff drifts
      <b>${reachM} m</b> in ${lifeS} s. The map is ${mapM} m across, so it ${verdict}.</div>`;
}

function inspGust(r) {
    const bias = Math.round((r.bias != null ? r.bias : 0.5) * 100);
    return `
<div class="in-sect"><span class="k">Name</span>
  <input class="in-wide" data-rename="gust" value="${attr(r.name || '')}" placeholder="${attr(r.id)}">
</div>
<div class="in-sect"><span class="k">Born here</span>
  <div class="in-grid">
    ${numF('puffs', 'gr.count', r.count != null ? r.count : 8, '')}
    ${numF('gusts', 'gr.bias', bias, '%')}
  </div>
  <div class="in-note">Puffs is how many cells this source keeps alive at once — its own
    population, not a share of anyone else's. Gusts % is how many of them are pressure
    rather than holes: 50 is an even mix, 0 makes nothing but dead patches.</div>
</div>
<div class="in-sect"><span class="k">What comes out</span>
  <div class="in-grid">
    ${numF('gust', 'gr.gustKt', r.gustKt != null ? r.gustKt : 5, 'kt')}
    ${numF('size', 'gr.sizeM', r.sizeM != null ? r.sizeM : 300, 'm')}
    ${numF('life', 'gr.lifeS', r.lifeS != null ? r.lifeS : 90, 's')}
    ${numF('veer', 'gr.veer', r.veer != null ? r.veer : 15, '°')}
  </div>
  <div class="in-note">Gust is what a puff is worth on the anemometer; a hole is worth about
    70% of it. Size is across the puff's long axis — the short axis is half that. Veer is how
    far the wind turns inside one. Each is a MEAN: the source spreads around it.</div>
  ${gustReach(r)}
  <div class="in-grid">
    ${numF('falloff', 'gr.falloff', Math.round(uToM(r.falloff != null ? r.falloff : 400)), 'm')}
  </div>
  <div class="in-note">Falloff is where puffs are BORN, not the edge of one — they cluster in
    the middle of a source and thin out at its rim. A puff drifts downwind from here and the
    wind decides where it lands.</div>
</div>`;
}

function inspCurrent(r) {
    return `
<div class="in-sect"><span class="k">Name</span>
  <input class="in-wide" data-rename="current" value="${attr(r.name || '')}" placeholder="${attr(r.id)}">
</div>
<div class="in-sect"><span class="k">Flow here</span>
  <div class="in-grid">
    ${numF('toward', 'cr.dir', degOf(r.direction || 0), '°')}
    ${numF('speed', 'cr.speed', r.speed != null ? r.speed : 0, 'kt')}
    ${numF('falloff', 'cr.falloff', Math.round(uToM(r.falloff != null ? r.falloff : 400)), 'm')}
  </div>
</div>`;
}

function inspRapids(r) {
    const turb = Math.round((r.turbulence != null ? r.turbulence : 0.5) * 100);
    return `
<div class="in-sect"><span class="k">Name</span>
  <input class="in-wide" data-rename="rapids" value="${attr(r.name || '')}" placeholder="${attr(r.id)}">
</div>
<div class="in-sect"><span class="k">White water</span>
  <div class="in-grid">
    ${numF('broken', 'rr.turb', turb, '%')}
    ${numF('falloff', 'rr.falloff', Math.round(uToM(r.falloff != null ? r.falloff : 200)), 'm')}
  </div>
  <div class="in-note">Broken is how turbulent the water is: it robs drive and shoves the
    bow around, so 10 is a riffle and 100 is a stopper. A rapid says nothing about flow —
    the stream itself, tongue included, is the Current layer's to author.</div>
</div>`;
}


// One handler for every framed field: the key says what to do.
function numEdit(el) {
    const [what, key] = el.dataset.num.split('.');
    // A wind region's fields are numbers in a framed box like any other, but they set
    // PROPERTIES rather than moving geometry, so they branch out before the transform code.
    if (what === 'wr') { windEdit(key, el.value); return; }
    if (what === 'cr') { currentEdit(key, el.value); return; }
    if (what === 'gr') { gustEdit(key, el.value); return; }
    if (what === 'rr') { rapidsEdit(key, el.value); return; }
    // The lee lengths are PROPERTIES of the shape, not geometry, so they branch out before
    // the transform code — the same shape of exception a wind region's fields make.
    if (what === 'shape' && (key === 'wsh' || key === 'csh' || key === 'hgt')) {
        const l = shapeById(sel.shape); if (!l) return;
        const f = key === 'wsh' ? 'windShadow' : key === 'csh' ? 'currentShadow' : 'height';
        // An empty box means AUTO — the field is absent, not zero, and those differ: zero is
        // "this casts no lee", absent is "work it out from my size".
        if (el.value.trim() === '') delete l[f];
        else { const v = parseFloat(el.value); if (!isFinite(v) || v < 0) { inspectorRefresh(); return; }
               // HEIGHT is a height, in metres — the only vertical measurement in the
               // document, and not a distance across the map, so it is not scaled to world
               // units the way the two lee lengths are.
               l[f] = (key === 'hgt') ? v : mToU(v); }
        afterEdit(true, `lee ${key}`);
        return;
    }
    // DRAG is the same shape of exception, and the same rule about empty: blank is "use
    // what this kind says", a typed 0 is "this bar costs nothing", and the two are
    // different documents. Percent in the box because that is how the effect reads to a
    // sailor ("half speed"); a 0-1 fraction in the file, where every other multiplier is.
    if (what === 'shape' && key === 'drag') {
        const l = shapeById(sel.shape); if (!l) return;
        if (el.value.trim() === '') delete l.drag;
        else {
            const v = parseFloat(el.value);
            if (!isFinite(v) || v < 0 || v > 90) {
                toast('Drag is 0-90% — a shape that takes all of a boat’s speed has no way out of itself', true);
                inspectorRefresh(); return;
            }
            l.drag = v / 100;
        }
        afterEdit(true, 'shoal drag');
        return;
    }

    // THE RAMP, same empty-means-inherit rule as drag and height: blank is "whatever this
    // material does" (sand shelves, mud does not), a typed number overrides that one shape.
    // Metres in the box, world units in the file, like every other distance across the map.
    // The floor is 1 m and not 0 — a zero-width ramp is a step, and a boat holding station
    // on a step oscillates against its own leeway, which is the corner smoothstep exists to
    // round off. The compiler still clamps to half the shape's radius on top of this.
    if (what === 'shape' && key === 'fth') {
        const l = shapeById(sel.shape); if (!l) return;
        if (el.value.trim() === '') delete l.feather;
        else {
            const v = parseFloat(el.value);
            if (!isFinite(v) || v < 1) {
                toast('The ramp is at least 1 m — a bar with no ramp is a step, and a step reads as a wall', true);
                inspectorRefresh(); return;
            }
            l.feather = mToU(v);
        }
        afterEdit(true, 'shoal ramp');
        return;
    }

    // A LEG is stated as a length and a bearing rather than as a position, because that is
    // how a course is described to the people sailing it.
    if (what === 'leg') {
        const v0 = parseFloat(el.value);
        if (!isFinite(v0)) { inspectorRefresh(); return; }
        const ok = key === 'len' ? setLegPolar(selRoute, { len: mToU(v0) })
                 : key === 'brg' ? setLegPolar(selRoute, { brg: v0 * Math.PI / 180 })
                 : key === 'zone' ? setLegZone(selRoute, mToU(v0))
                 : false;
        if (ok) afterEdit(true, `leg ${key}`); else inspectorRefresh();
        return;
    }

    // A GATE's width, set about its midpoint along its own bearing — you are resizing the
    // line, not moving it or swinging it.
    if (what === 'gate' && key === 'width') {
        const v0 = parseFloat(el.value);
        if (!isFinite(v0)) { inspectorRefresh(); return; }
        const ln = dlines()[selLine];
        const ends = ln && lineEnds(ln.id);
        if (!ends) { inspectorRefresh(); return; }
        const wU = mToU(v0);
        if (!(wU >= mToU(5))) { toast('A gate needs at least 5 m of width', true); inspectorRefresh(); return; }
        const [a, b] = ends;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ux = len > 0 ? (b.x - a.x) / len : 1, uy = len > 0 ? (b.y - a.y) / len : 0;
        a.x = cx - ux * wU / 2; a.y = cy - uy * wU / 2;
        b.x = cx + ux * wU / 2; b.y = cy + uy * wU / 2;
        afterEdit(true, 'gate width');
        return;
    }
    const v = parseFloat(el.value);
    if (!isFinite(v)) { inspectorRefresh(); return; }
    let rings = null, land = null;
    // No `ice` arm: a floe's transform fields are a SHAPE's transform fields, resolved by
    // the selected shape like every other one, and rebaked like every other one — which a
    // floe never was, so its centroid and radius went stale after a nudge.
    if (what === 'arena') {
        const bp = doc && doc.world.boundary.poly; if (!bp) return; rings = [bp];
    } else {
        land = shapeById(sel.shape); if (!land) return; rings = eachRing(land);
    }
    const bb = ringBox(rings);
    const map = (fn) => { for (const ring of rings) for (const p of ring) {
        const q = fn(p[0], p[1]); p[0] = q.x; p[1] = q.y; } };
    if (key === 'x') map((x, y) => ({ x: x + (mToU(v) - bb.cx), y }));
    else if (key === 'y') map((x, y) => ({ x, y: y + (mToU(v) - bb.cy) }));
    else if (key === 'w' && bb.w > 0) { const k = mToU(v) / bb.w;
        map((x, y) => ({ x: bb.cx + (x - bb.cx) * k, y })); }
    else if (key === 'h' && bb.h > 0) { const k = mToU(v) / bb.h;
        map((x, y) => ({ x, y: bb.cy + (y - bb.cy) * k })); }
    else if (key === 'rot') {
        const a = v * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
        map((x, y) => ({ x: bb.cx + (x - bb.cx) * cs - (y - bb.cy) * sn,
                         y: bb.cy + (x - bb.cx) * sn + (y - bb.cy) * cs }));
    } else return;
    if (land) rebake(land);
    afterEdit(true, 'transform');
}

// One handler for a wind region's numbers. Degrees in the box, radians in the document —
// 0 is north and up, 90 is east and to the right, which is what the compass beside it says.
function windEdit(key, value) {
    const r = wregs()[selWind]; if (!r) return;
    const raw = String(value).trim();
    if (key === 'speed') {
        // A region states its own speed. Blank is ZERO — calm — not "ask the venue", because
        // there is nothing to ask any more. The no-wind check catches a course left calm.
        if (!raw) { r.speed = 0; afterEdit(true, 'wind speed');
                    toast('Speed 0 — that water is calm', true); return; }
        const v = parseFloat(raw);
        if (!isFinite(v) || v < 0 || v > 60) { toast('Speed must be 0–60 kt', true);
                                               inspectorRefresh(); return; }
        r.speed = v;
        afterEdit(true, 'wind speed');
        return;
    }
    const v = parseFloat(raw);
    if (!isFinite(v)) { inspectorRefresh(); return; }
    if (key === 'dir') r.direction = radOf(v);
    else if (key === 'dirvar') r.dirVar = v * Math.PI / 180;
    else if (key === 'speedvar') r.speedVar = v;
    else if (key === 'period') r.period = v;
    else if (key === 'falloff') r.falloff = Math.max(0, mToU(v));
    else return;
    afterEdit(true, `wind ${key}`);
}

// A current region's numbers. Degrees in the box, radians in the document; `toward` is the
// bearing the WATER is going, which is the bearing itself rather than its reverse.
function currentEdit(key, value) {
    const r = cregs()[selCur]; if (!r) return;
    const v = parseFloat(String(value).trim());
    if (!isFinite(v)) { inspectorRefresh(); return; }
    if (key === 'dir') r.direction = radOf(v);
    else if (key === 'speed') {
        if (v < 0 || v > 20) { toast('Current must be 0–20 kt', true); inspectorRefresh(); return; }
        r.speed = v;
    } else if (key === 'falloff') r.falloff = Math.max(0, mToU(v));
    else return;
    afterEdit(true, `current ${key}`);
}

// A rapid's numbers. Turbulence is a percent in the box — "how broken is this water" reads
// as a share, the way drag does — and a 0-1 fraction in the file, where every other
// fraction is.
function rapidsEdit(key, value) {
    const r = rregs()[selRapids]; if (!r) return;
    const v = parseFloat(String(value).trim());
    if (!isFinite(v)) { inspectorRefresh(); return; }
    if (key === 'turb') {
        if (v < 0 || v > 100) { toast('Broken is 0–100%', true); inspectorRefresh(); return; }
        r.turbulence = v / 100;
    } else if (key === 'falloff') r.falloff = Math.max(0, mToU(v));
    else return;
    afterEdit(true, `rapids ${key}`);
}

// A gust source's numbers. `bias` used to be three-state — blank meaning "the venue's own
// split" — but there is no venue split any more, so blank is simply invalid and 0 means
// nothing but holes.
function gustEdit(key, value) {
    const r = activeReg(); if (!r) return;
    const raw = String(value).trim();
    if (key === 'bias') {
        if (!raw) { inspectorRefresh(); return; }
        const p = parseFloat(raw);
        if (!isFinite(p) || p < 0 || p > 100) { toast('Gusts must be 0–100%', true); inspectorRefresh(); return; }
        r.bias = p / 100;
        afterEdit(true, 'gust bias');
        return;
    }
    const v = parseFloat(raw);
    if (!isFinite(v)) { inspectorRefresh(); return; }
    if (key === 'count') {
        // Zero is allowed and means it: a source turned off without being deleted, which is
        // how you A/B a course's pressure without losing the polygon you drew.
        if (v < 0 || v > 200) { toast('Puffs must be 0–200', true); inspectorRefresh(); return; }
        r.count = Math.round(v);
    } else if (key === 'veer') {
        if (v < 0 || v > 90) { toast('Veer must be 0–90°', true); inspectorRefresh(); return; }
        r.veer = v;
    } else if (key === 'gustKt') {
        // The rails are the validator's, so a document typed by hand and one typed here are
        // rejected for the same reasons.
        if (v < 0 || v > 30) { toast('Gust must be 0–30 kt', true); inspectorRefresh(); return; }
        r.gustKt = v;
    } else if (key === 'sizeM') {
        if (v < 1 || v > 2000) { toast('Size must be 1–2000 m', true); inspectorRefresh(); return; }
        r.sizeM = v;
    } else if (key === 'lifeS') {
        if (v < 1 || v > 900) { toast('Life must be 1–900 s', true); inspectorRefresh(); return; }
        r.lifeS = v;
    } else if (key === 'falloff') {
        r.falloff = Math.max(0, mToU(v));
    } else return;
    afterEdit(true, `gust ${key}`);
}

// Blank means "no name", which falls back to the id — the same rule the mark, gate and leg
// name fields follow, so clearing a box always visibly reverts to the automatic label.
function renameSel(el) {
    const v = el.value.trim();
    if (el.dataset.rename === 'shape') {
        const l = shapeById(sel.shape); if (!l) return;
        if (v) l.name = v; else delete l.name;
        afterEdit(true, 'shape name');
    } else if (el.dataset.rename === 'wind') {
        const r = wregs()[selWind]; if (!r) return;
        if (v) r.name = v; else delete r.name;
        afterEdit(true, 'wind region name');
    } else if (el.dataset.rename === 'current') {
        const r = cregs()[selCur]; if (!r) return;
        if (v) r.name = v; else delete r.name;
        afterEdit(true, 'current region name');
    } else if (el.dataset.rename === 'gust') {
        const r = gregs()[selGust]; if (!r) return;
        if (v) r.name = v; else delete r.name;
        afterEdit(true, 'gust region name');
    } else if (el.dataset.rename === 'rapids') {
        const r = rregs()[selRapids]; if (!r) return;
        if (v) r.name = v; else delete r.name;
        afterEdit(true, 'rapids region name');
    } else if (el.dataset.rename === 'mark') {
        const mk = dmarksOf()[sel.mark]; if (!mk) return;
        if (v) mk.name = v; else delete mk.name;
        afterEdit(true, 'mark name');
    } else if (el.dataset.rename === 'gate') {
        const ln = dlines()[selLine]; if (!ln) return;
        if (v) ln.name = v; else delete ln.name;
        afterEdit(true, 'gate name');
    } else if (el.dataset.rename === 'traffic') {
        const t = dtraffic()[selTraf]; if (!t) return;
        if (v) t.name = v; else delete t.name;
        afterEdit(true, 'vessel name');
    } else if (el.dataset.rename === 'leg') {
        const e = routeOf()[selRoute]; if (!e) return;
        if (v) e.name = v; else delete e.name;
        afterEdit(true, 'leg name');
    }
}

// Kept for the inspector's remaining per-object actions. The commands that act on the
// SELECTION (duplicate, resample, delete) live on the map's action bar instead.
function shapeAct(a) {

}

// ── Related checks ──────────────────────────────────────────────────────────
// The findings that mention what you have selected, in the inspector, next to the thing
// they are about. The full list still lives in the drawer.
function relatedChecks() {
    const obj = $('insp-obj');
    if (!obj || !doc) return;
    const subject = (mode === 'shape' && sel.shape) ? sel.shape
                  : (mode === 'marks' && sel.mark >= 0) ? (dmarksOf()[sel.mark] || {}).id
                  : null;
    if (!subject) return;
    const hits = findings.filter(f => (f.detail || '').includes(subject) || (f.title || '').includes(subject));
    if (!hits.length) return;
    const div = document.createElement('div');
    div.className = 'in-sect';
    div.innerHTML = '<span class="k">Related checks</span>'
        + hits.map(f => `<div class="ck ${f.level === 'ok' ? 'ok' : ''}"><span class="dot ${f.level === 'error' ? 'err' : f.level === 'warn' ? 'warn' : 'ok'}"></span>`
            + `<span class="ck-t">${f.detail}</span></div>`).join('');
    obj.appendChild(div);
}

// ── Info panel ──────────────────────────────────────────────────────────────
// The inspector's own row style: label left, value right, both aligned down the panel.
const row = (k, v) => `<div class="in-row"><span>${k}</span><span class="num">${v}</span></div>`;
const mmss = s => `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`;

// The suggested time limit: twice the best time along the course path, to the nearest
// minute. Computed by compile so the editor's recommendation and the game's own fallback
// are the same number — two formulas for "how long should this race be allowed" is how they
// come to disagree by a minute and nobody notices which one raced.
function suggestedCutoff() {
    if (!doc) return 0;
    const c = window.VenueDoc.compile(doc);
    return c.cutoffAuto || 0;
}

function info() {
    if (!course) return;
    const m = course.marks || [];
    const legs = doc ? Math.max(1, routeOf().length - 1) : state.race.totalLegs;
    // The venue this course is laid on, and nothing else: legs, marks, gates, regions and
    // the arena are each a count on their own layer row, which is where they belong.
    if (doc) {
        // The fields show the card in force, not placeholders of it — you should be able
        // to read the venue's copy without clicking into the boxes.
        const card = doc.card || {};
        $('course-name').value = venueName(doc.venue);
        $('card-tag').value = card.tag || '';
        $('card-blurb').value = card.blurb || '';
        $('card-conditions').value = card.conditions || '';
        $('card-hazards').value = card.hazards || '';
        const prov = doc.records && doc.records.provisional;
        if (prov) {
            const ss = Math.round((prov % 60) * 10) / 10;
            const sStr = (Number.isInteger(ss) ? String(ss) : ss.toFixed(1)).padStart(Number.isInteger(ss) ? 2 : 4, '0');
            $('card-provisional').value = `${Math.floor(prov / 60)}:${sStr}`;
        } else {
            $('card-provisional').value = '';
        }
        // And the venue is its ID: the name belongs to the card now, so showing the venue's
        // name here said the same word twice and hid which file this is.
        $('course-venue').textContent = doc.venue;
        $('course-start').value = doc.course.startTime != null ? doc.course.startTime : '';
        $('course-cutoff').value = doc.course.cutoff != null ? doc.course.cutoff : '';
    }

    // Distance and time. The straight-line figure from compile is the fallback the GAME
    // uses when nothing better is authored; the estimate is the honest one, and the only
    // reason it cannot live in compile is that it needs a nav grid and a BFS per leg.
    let dist = 0, cutoff = 0;
    const authored = doc && doc.course.cutoff != null;
    if (doc) {
        const d2 = window.VenueDoc.compile(doc);
        dist = (estimate && estimate.dist) || d2.sailedDist || 0;
        cutoff = authored ? doc.course.cutoff : (d2.cutoffAuto || 0);

    } else {
        dist = (state.race.totalLegs || 2) * (state.race.legLength || 4000);
        cutoff = uToM(dist) * 0.1875;

    }
    // THE RECOMMENDATION IS THE DERIVED LIMIT. Twice the best time along the course path,
    // to the nearest minute — the same number `cutoffAuto` gives the game when nothing is
    // authored, so the button sets what the venue would already have done rather than a
    // second, slightly different figure (it used to offer 1.6x SailCheck's estimate).
    const suggested = suggestedCutoff();
    // BEST TIME COMES FROM THE PATH, the same number the limit is twice of. It used to be
    // SailCheck's grid estimate while the recommendation used compile's, so Clubhouse Point
    // read "best 3:23" beside "set the limit to 6:00" — 2x3:23 is 6:46, and the two numbers
    // simply were not about the same lap.
    const pathBest = doc ? (window.VenueDoc.compile(doc).estSecs || 0) : 0;
    const band = pathBest >= 90 && pathBest <= 150;
    const straight = doc ? (window.VenueDoc.compile(doc).courseDist || 0) : 0;
    $('info-time').innerHTML =
        row('sailable path', `${fmtM(dist)}  ·  ${fmtBL(dist)}`) +
        // ⚠️ Compared against the COURSE PATH, not "the straight line". `sailedDist` stopped
        // being a straight line when the estimate moved onto the path, and it carries the
        // 1.45x tacking allowance on top — so this row was dividing a path by a longer path
        // and reporting 0.95x, which reads as "shorter than a straight line".
        (estimate && straight > 0
            ? row('vs course path', `${(estimate.dist / straight).toFixed(2)}×  (${fmtM(straight)})`) : '') +
        (pathBest
            ? `<div class="in-row"><span>best time</span><span class="num" style="color:${band ? 'var(--ed-ok)' : 'var(--ed-warn)'}">`
              + `${mmss(pathBest)}${band ? '' : '  ⚠'}</span></div>`
            : '') +
        (estimate
            ? (estimate.slowest
                  ? `<div class="text-slate-500 mt-1" style="font-size:11px">slowest leg ${estimate.slowest.leg}: `
                    + `${fmtM(estimate.slowest.dist)} at ${estimate.slowest.twaDeg}° TWA, `
                    + `VMG ${estimate.slowest.vmg ? estimate.slowest.vmg.toFixed(1) : '?'} kt, `
                    + `${mmss(estimate.slowest.secs)}</div>`
                  : '')
            : '') +
        row('time limit', mmss(cutoff) + (authored ? ' authored' : ' derived'));

    const useBtn = $('btn-use-est');
    if (useBtn) {
        useBtn.disabled = !suggested;
        useBtn.textContent = suggested ? `Set the limit to ${mmss(suggested)}` : 'No estimate available';
    }

}


// ── Inspector ───────────────────────────────────────────────────────────────

// ── Course model helpers ────────────────────────────────────────────────────
// Marks and lines are the INVENTORY; the route is an ordering of uses. Everything
// below resolves references without caring where in the route they are used, which is
// what makes reusing the same gate twice unremarkable.
const dmarksOf = () => (doc && doc.course.marks) || [];
const dlines = () => (doc && doc.course.lines) || EMPTY;
const dlinesW = () => { if (!doc.course.lines) doc.course.lines = []; return doc.course.lines; };
const markIndex = (id) => dmarksOf().findIndex(m => m.id === id);
const lineById = (id) => dlines().find(l => l.id === id) || null;
// A line's two ends as live document marks, in the line's own vertex order — which is
// what sets the crossing normal, so the order is authored rather than incidental.
function lineEnds(id) {
    const ln = lineById(id);
    if (!ln || !ln.marks || ln.marks.length !== 2) return null;
    const a = dmarksOf()[markIndex(ln.marks[0])], b = dmarksOf()[markIndex(ln.marks[1])];
    return (a && b) ? [a, b] : null;
}
const entryEnds = (e) => (e && e.lineId != null) ? lineEnds(e.lineId) : null;
const routeOf = () => (doc && doc.course.route) || [];
// BY POSITION. There is no special start or finish object any more: the race is sailed
// in route order, so the FIRST entry is the start and the LAST is the finish, whatever
// they are. "A route must begin and end with a gate" is a CHECK (venuecheck route-ends)
// rather than an editing restriction — any gate can be deleted, any row can be dragged,
// and the checker says what the result is missing. These return null when the entry in
// that position is not a gate, which is exactly the state the check reports.
const startEntry = () => { const rt = routeOf(); return (rt.length && rt[0].lineId != null) ? rt[0] : null; };
const finishEntry = () => { const rt = routeOf(); const e = rt[rt.length - 1]; return (rt.length > 1 && e.lineId != null) ? e : null; };
// "Shared start/finish" was never a separate concept: it means both entries name the
// same line, each with its own crossing direction.
const finishShared = () => {
    const s0 = startEntry(), f = finishEntry();
    return !!(s0 && f && s0.lineId != null && s0.lineId === f.lineId);
};

// Smart default names. A mark's `id` is its stable identifier; `name` is what a person
// reads, and it should say what the thing IS without anyone typing it.
function lineLabel(id) {
    const ln = lineById(id);
    if (!ln) return `gate ${id}`;
    if (ln.name) return ln.name;
    const s0 = startEntry(), f = finishEntry();
    if (s0 && s0.lineId === id) return finishShared() ? 'Start / finish line' : 'Start line';
    if (f && f.lineId === id) return 'Finish line';
    // Numbered among the gates, not by leg: the same gate can be used by several legs,
    // so a leg number would name it differently depending on where you looked.
    const gates = dlines().filter(l => {
        const st = startEntry(), fi = finishEntry();
        return !(st && st.lineId === l.id) && !(fi && fi.lineId === l.id);
    });
    const k = gates.findIndex(l => l.id === id);
    return k >= 0 ? `Gate ${k + 1}` : `Gate ${id}`;
}

function markLabel(i) {
    const m = dmarksOf()[i];
    if (!m) return `mark ${i}`;
    if (m.name) return m.name;
    const s0 = startEntry(), f = finishEntry();
    const endOf = (e) => {
        const ends = entryEnds(e);
        if (!ends) return 0;
        return ends[0] === m ? 1 : ends[1] === m ? 2 : 0;
    };
    const se = endOf(s0), fe = endOf(f);
    if (se) return finishShared() ? (se === 1 ? 'Start/finish pin' : 'Start/finish boat')
                                  : (se === 1 ? 'Start pin' : 'Committee boat');
    if (fe) return fe === 1 ? 'Finish pin' : 'Finish boat';
    const rounds = [];
    for (const e of routeOf()) if (e.kind === 'round' && e.markId != null && !rounds.includes(e.markId)) rounds.push(e.markId);
    const ri = rounds.indexOf(m.id);
    if (ri >= 0) return rounds.length > 1 ? `Rounding mark ${ri + 1}` : 'Rounding mark';
    // Otherwise name it after the gate it belongs to, which is stable under reuse.
    for (const ln of dlines()) {
        if (!ln.marks) continue;
        if (ln.marks[0] === m.id) return `${lineLabel(ln.id)}, left`;
        if (ln.marks[1] === m.id) return `${lineLabel(ln.id)}, right`;
    }
    return m.id || `mark ${i}`;
}

// The selected shape is described in ONE place — the right-hand inspector, which already
// carries material, transform, path, gameplay and delete. The left panel's copy of it said
// the same things in fewer words and had to be kept true alongside.
function refreshInspector() { inspectorRefresh(); }

function duplicateShape() {
    const l = shapeById(sel.shape);
    if (!l) return;
    const copy = clone(l);
    let n = 2;
    while (doc.shapes.some(x => x.id === `${l.id}-${n}`)) n++;
    copy.id = `${l.id}-${n}`;
    if (l.name) copy.name = `${l.name} ${n}`;
    // Offset so the copy is visibly its own object rather than hidden underneath.
    const off = Math.max(120, l.r * 0.25);
    for (const ring of eachRing(copy)) for (const p of ring) { p[0] += off; p[1] += off; }
    rebake(copy);
    doc.shapes.push(copy);
    sel = { shape: copy.id, mark: -1, vert: -1, bvert: -1 };
}

function deleteSelectedShape() {
    // Land is land: nothing in the route points at it any more, so there is no reference
    // to repoint. A rounding names a MARK, which may happen to sit on this shape.
    doc.shapes = doc.shapes.filter(l => l.id !== sel.shape);
    sel = { shape: null, mark: -1, vert: -1, bvert: -1 };
    return true;
}

// ── Route editing ───────────────────────────────────────────────────────────
// The leg engine now walks the route generically, so a course can mix lines, gates
// and roundings in any order — which is what makes this panel worth having.
// What is physically on the water. `none` is a position with no buoy — an island you
// round, a transit — which the race marks with an indicator instead of a sprite.
// The list and the long labels come from VenueDoc so the dropdown, the validator and
// the game's sprite registry cannot drift apart; the short labels are this panel's own.
const MARK_KINDS = Object.keys(window.VenueDoc.MARK_KINDS);
const MARK_KIND_TITLE = {};
for (const k of MARK_KINDS) MARK_KIND_TITLE[k] = window.VenueDoc.MARK_KINDS[k].label;
const MARK_KIND_LABEL = { inflatable: 'orange buoy', can: 'yellow can', committee: 'committee boat', none: 'no buoy' };

// A leg's readable name. Authored `name` wins; otherwise derive it from what the leg IS.
// A leg is a USE of a mark or a gate, so its label names the thing plus what this use
// asks of it — the same gate can appear twice, sailed differently each time.
function entryLabel(e, i) {
    if (e.name) return e.name;
    if (e === startEntry()) return finishShared() ? 'Start (shared line)' : 'Start line';
    if (e === finishEntry()) return finishShared() ? 'Finish (shared line)' : 'Finish line';
    if (e.kind === 'round') {
        const mi = markIndex(e.markId);
        const what = mi >= 0 ? markLabel(mi) : String(e.markId);
        // Do not say "Round Rounding mark 1": the subject's own name may already carry
        // the verb, which it does for any mark whose only job is to be rounded.
        return /^round/i.test(what) ? what : `Round ${what}`;
    }
    return lineLabel(e.lineId) + (e.pass === 'through' ? ' — through' : ' — round an end');
}

// How many times this leg's subject is used elsewhere in the route. Shown on the row,
// because "this gate is also leg 4" is the thing you cannot see from the map.
function useCount(e) {
    const key = (x) => x.kind === 'round' ? `r:${x.markId}` : `l:${x.lineId}`;
    return routeOf().filter(x => key(x) === key(e)).length;
}

function routeRefresh(into) {
    const box = into || $('obj-list');
    if (!box) return;
    if (!doc) { box.innerHTML = ''; return; }
    const r = routeOf();
    // EVERY row moves. Pinning the ends made sense while the validator enforced start-first
    // and finish-last; now that the shape is CHECKED instead, pinning would let you append a
    // leg past the finish and then refuse to let you drag the finish back — a rule enforced
    // in one direction only. The `route-ends` check says whether the order is raceable.
    const movable = () => true;
    // The list is the ORDER. Which way a leg is crossed, which side a mark is left, what a
    // gate is called — those are properties of the leg, so they live in the inspector with
    // every other object's properties. A row carries what you need to READ the order: where
    // it sits, what it is, and whether the same geometry appears more than once.
    // Just the order and the name. The position is the row's position — numbering it said
    // the same thing twice — and how often a gate is reused is a fact about the GATE, which
    // its own layer reports. Delete is the Delete key on the selection, as everywhere else.
    box.innerHTML = r.map((e, i) =>
        `<div class="ob${i === selRoute ? ' on' : ''}" data-i="${i}" draggable="true">`
        + '<span class="grip" title="drag to reorder">⠿</span>'
        + `<span class="ob-n">${entryLabel(e, i)}</span></div>`).join('');

    // Selecting a row is what the name field edits. On `click`, not mousedown: a
    // mousedown re-render would replace the row mid-gesture and the drag would never
    // start. A completed drag does not fire click, so the two never collide.
    box.querySelectorAll('.ob').forEach(el => {
        el.addEventListener('click', () => {
            selRoute = +el.dataset.i;
            refreshChrome(); marksInspector(); draw();
        });
        // Hovering a row shows you WHICH geometry it means. Without this a route of
        // three similar gates is a list of words.
        el.addEventListener('mouseenter', () => { hoverRoute = +el.dataset.i; draw(); });
        el.addEventListener('mouseleave', () => { hoverRoute = -1; draw(); });
    });

    // DRAG TO REORDER, anywhere in the list.
    let dragFrom = -1;
    const dropSlot = (el, ev) => {
        const rect = el.getBoundingClientRect();
        const after = (ev.clientY - rect.top) > rect.height / 2;
        // 0..length: a leg may now be dropped at either END too, which is the only way to
        // put a finish back last after appending past it.
        return Math.max(0, Math.min(r.length, +el.dataset.i + (after ? 1 : 0)));
    };
    box.querySelectorAll('.ob[draggable]').forEach(el => {
        el.addEventListener('dragstart', (ev) => {
            dragFrom = +el.dataset.i;
            el.classList.add('dragging');
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('text/plain', String(dragFrom));
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            box.querySelectorAll('.ob').forEach(x => x.classList.remove('dropbefore', 'dropafter'));
        });
    });
    box.querySelectorAll('.ob').forEach(el => {
        el.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            box.querySelectorAll('.ob').forEach(x => x.classList.remove('dropbefore', 'dropafter'));
            // Insertion SLOTS, 0..length. The indicator is drawn from the same slot the
            // drop will use, so it can never promise a placement the reorder refuses; slot
            // `length` has no row of its own, so it marks the last row as "after".
            const slot = dropSlot(el, ev);
            const row = box.querySelector(`.ob[data-i="${slot}"]`);
            if (row) row.classList.add('dropbefore');
            else {
                const last = box.querySelector(`.ob[data-i="${r.length - 1}"]`);
                if (last) last.classList.add('dropafter');
            }
        });
        el.addEventListener('drop', (ev) => {
            ev.preventDefault();
            const from = dragFrom >= 0 ? dragFrom : parseInt(ev.dataTransfer.getData('text/plain'), 10);
            // Any row, including the first and the last. The band this used to clamp to was
            // the old "start first, finish last" rule; with that rule now a CHECK, refusing
            // the drag would leave a route you are told is wrong and cannot put right.
            if (!(from >= 0 && from < r.length)) return;
            let to = dropSlot(el, ev);
            if (from < to) to--;                            // removing shifts the target
            if (to === from) return;
            const rr = doc.course.route;
            rr.splice(to, 0, rr.splice(from, 1)[0]);
            selRoute = to;
            afterEdit(true, 'reorder route');
        });
    });

}

// ── The inventory: what exists on the water ─────────────────────────────────
// markRefresh folded into objRefresh — one list, driven by the active layer.

// lineRefresh folded into objRefresh — one list, driven by the active layer.

function selectMark(i) {
    sel = Object.assign({}, NOHIT, { mark: i });
    selLine = -1;
    marksInspector(); refreshChrome(); draw();
}
function selectLine(i) {
    selLine = i;
    sel = Object.assign({}, NOHIT);
    marksInspector(); refreshChrome(); draw();
}

// Where to drop new marks: the middle of the view, spread along the current wind so a
// new gate starts roughly square to the course rather than needing to be rotated.
function newMarkPair(span) {
    const w = windBase();
    const ax = Math.cos(w), ay = Math.sin(w);     // across the wind
    return [
        { x: view.x - ax * span / 2, y: view.y - ay * span / 2 },
        { x: view.x + ax * span / 2, y: view.y + ay * span / 2 }
    ];
}

// Marks, gates and legs render their own fields in the INSPECTOR now, so there is nothing
// left to fill in here. Kept as the name every mark/gate/route edit calls, so whatever the
// right panel is showing gets rebuilt.
function marksInspector() { inspectorRefresh(); }

// ── Creating things ─────────────────────────────────────────────────────────
function nextId(prefix, taken) {
    let n = 1;
    while (taken.some(x => x.id === `${prefix}-${n}`)) n++;
    return `${prefix}-${n}`;
}

function addMark(kind) {
    const id = nextId('mark', dmarksOf());
    doc.course.marks.push({ id, x: view.x, y: view.y, kind: kind || 'inflatable' });
    sel = Object.assign({}, NOHIT, { mark: doc.course.marks.length - 1 });
    selLine = -1;
    return id;
}

// A gate is two marks and the LINE that names them as a pair. Creating it adds nothing
// to the route: what exists on the water and what you sail are separate questions now.
function addLine() {
    const [a, b] = newMarkPair(600);
    const ids = [];
    for (const p of [a, b]) {
        const id = nextId('mark', dmarksOf());
        doc.course.marks.push({ id, x: p.x, y: p.y, kind: 'inflatable' });
        ids.push(id);
    }
    const lid = nextId('gate', dlines());
    dlinesW().push({ id: lid, marks: ids });
    selLine = dlines().length - 1;
    sel = Object.assign({}, NOHIT);
    return lid;
}

// One click for the common case: a new gate AND a leg that sails it.
function addGate(passMode) {
    const lid = addLine();
    addToRoute(`line:${lid}`, passMode);
    return lid;
}

function addRoundingMark() {
    const id = addMark('can');
    addToRoute(`mark:${id}`);
    return id;
}

// Add a USE of something that already exists, inserted before the finish — which is
// where a new leg almost always belongs.
function addToRoute(ref, passMode) {
    const [what, id] = String(ref).split(':');
    const rr = doc.course.route;
    // APPEND. It used to insert before the finish, which quietly kept the finish last and
    // made "add a leg" mean something different from what the list showed. The order is the
    // route: a new leg goes on the end, and the checks say whether the result starts and
    // ends the way a race has to.
    const at = rr.length;
    let entry = null;
    if (what === 'line') entry = { kind: 'gate', lineId: id, dir: 1, pass: passMode || 'through' };
    else if (what === 'mark') entry = { kind: 'round', markId: id, side: 'starboard' };
    else if (what === 'land') {
        // Rounding an island means laying a MARK on it. The two stay separate objects, so
        // the island can be reshaped or moved without dragging the course with it.
        const l = shapeById(id);
        if (!l) return false;
        const mid = nextId('round', dmarksOf());
        doc.course.marks.push({ id: mid, name: `Round ${id}`, x: l.c[0], y: l.c[1], kind: 'inflatable' });
        entry = { kind: 'round', markId: mid, radius: l.r, side: 'starboard' };
    }
    if (!entry) return false;
    rr.splice(at, 0, entry);
    selRoute = at;
    osel = [];
    return true;
}

// ── Deleting things ─────────────────────────────────────────────────────────
// Deletion belongs to the inventory, so it has to say what else goes with it: a mark
// takes its gates, and a gate takes the legs that sailed it. No gate or mark is
// protected — deleting the first or last gate leaves a route that no longer starts or
// finishes, and the route-ends CHECK reports that, visibly, until another gate takes
// the position.
function deleteMark(i) {
    const m = dmarksOf()[i];
    if (!m) return false;
    const goneLines = dlines().filter(l => (l.marks || []).includes(m.id));
    const goneLegs = routeOf().filter(e => e.markId === m.id
        || goneLines.some(l => l.id === e.lineId)).length;
    doc.course.marks.splice(i, 1);
    doc.course.lines = dlines().filter(l => !goneLines.some(g => g.id === l.id));
    doc.course.route = routeOf().filter(e => e.markId !== m.id
        && !goneLines.some(l => l.id === e.lineId));
    sel = Object.assign({}, NOHIT); selLine = -1; selRoute = -1;
    afterEdit(true, 'delete mark');
    toast(`Deleted ${m.id}`
        + (goneLines.length ? ` · ${goneLines.length} gate(s)` : '')
        + (goneLegs ? ` · ${goneLegs} leg(s)` : ''));
    return true;
}

function deleteLine(i) {
    const ln = dlines()[i];
    if (!ln) return false;
    const legs = routeOf().filter(e => e.lineId === ln.id).length;
    // Its marks go with it: a gate's two marks exist to BE that gate, and leaving them
    // behind as unexplained orphans is the bug this replaces.
    const markIds = (ln.marks || []).slice();
    doc.course.lines.splice(i, 1);
    doc.course.route = routeOf().filter(e => e.lineId !== ln.id);
    const stillUsed = (id) => dlines().some(l => (l.marks || []).includes(id))
        || routeOf().some(e => e.markId === id);
    doc.course.marks = dmarksOf().filter(m => !(markIds.includes(m.id) && !stillUsed(m.id)));
    selLine = -1; sel = Object.assign({}, NOHIT); selRoute = -1;
    afterEdit(true, 'delete gate');
    toast(`Deleted ${lineLabel(ln.id)} · ${markIds.length} marks${legs ? ` · ${legs} leg(s)` : ''}`);
    return true;
}

// START / FINISH SHARING.
//
// There is no separate concept: the route always ends with a `finish` entry (the
// validator enforces it), and "shared" simply means that entry references the SAME line
// as the start — with its own `dir`, so the direction you cross still matters and is
// still authored. Giving the finish its own line means pointing it at a new one.
function toggleFinishOwnLine() {
    const rt = routeOf();
    const start = rt[0], fin = rt[rt.length - 1];
    if (!start || !fin || start.lineId == null || fin.lineId == null) return false;
    if (start.lineId === fin.lineId) {
        // Give it its own line, offset down-course from the start so it is visible rather
        // than hidden underneath.
        const ends = lineEnds(start.lineId);
        if (!ends) return false;
        const [a, b] = ends;
        const nx = (b.y - a.y), ny = -(b.x - a.x);
        const nl = Math.hypot(nx, ny) || 1;
        const off = 700;
        const ids = [];
        for (const [p, nm] of [[a, 'Finish pin'], [b, 'Finish boat']]) {
            const id = nextId('mark', dmarksOf());
            doc.course.marks.push({ id, name: nm, x: p.x - nx / nl * off, y: p.y - ny / nl * off, kind: 'inflatable' });
            ids.push(id);
        }
        const lid = nextId('finish', dlines());
        dlinesW().push({ id: lid, name: 'Finish line', marks: ids });
        fin.lineId = lid;
        afterEdit(true, 'own finish line');
        return 'own';
    }
    // Back to sharing. The old finish line and its marks are removed — they exist only
    // to be that line, and leaving them behind is what made the old ✕ confusing.
    const oldId = fin.lineId;
    fin.lineId = start.lineId;
    const idx = dlines().findIndex(l => l.id === oldId);
    if (idx >= 0) {
        const markIds = (dlines()[idx].marks || []).slice();
        doc.course.lines.splice(idx, 1);
        const stillUsed = (id) => dlines().some(l => (l.marks || []).includes(id))
            || routeOf().some(e => e.markId === id);
        doc.course.marks = dmarksOf().filter(m => !(markIds.includes(m.id) && !stillUsed(m.id)));
    }
    afterEdit(true, 'shared finish line');
    return 'shared';
}

// ── Wind regions ────────────────────────────────────────────────────────────
const wregs = () => (doc && doc.wind.regions) || [];

// The regions list in the object column, their numbers in the inspector — so there is
// nothing left for this to paint. Kept as the name every wind edit calls when the set
// changes; it re-renders the column and the layer row's count.
// ⚠️ It must still READ WITHOUT WRITING: this once created `regions = []` on load and
// marked a pristine document unsaved, and the dirty flag has to mean "you changed
// something" or it means nothing.
function windRefresh() { objRefresh(); layerRefresh(); }

function addWindRegion() {
    if (!doc.wind.regions) doc.wind.regions = [];
    let n = 1;
    while (doc.wind.regions.some(r => r.id === `wind-${n}`)) n++;
    const half = Math.max(700, doc.world.size * 0.12);
    doc.wind.regions.push({
        id: `wind-${n}`,
        poly: window.Arena.rectPoly(view.x, view.y, half, half),
        falloff: 400, direction: windBase(), dirVar: 0, speed: null, speedVar: 0, period: 30
    });
    selWind = doc.wind.regions.length - 1;
}

// ── Current regions ─────────────────────────────────────────────────────────
// The same object as a wind region and the same additive rules, but the quantity is a
// FLOW: an absolute direction and speed, because a patch of water either has a stream
// running through it or it does not. There is no "water" object to edit — water is
// wherever land and the arena are not — so this mode edits what the water DOES.
const cregs = () => (doc && doc.current && doc.current.regions) || [];

// ── Gust regions ────────────────────────────────────────────────────────────
// The third use of the same polygon, and the only one that is not a state of the water. A
// wind region says what the wind IS here; a gust region says what is BORN here — and what
// is born then leaves, downwind, steered by the breeze it meets on the way.
//
// So there is no direction to author and no speed: a source has no bearing of its own. What
// it has is a share of the day's puffs and the character of them, all stated as multipliers
// on the venue's own gustiness so a source can be dropped anywhere without first knowing
// what the weather there is.
//
// NO REGIONS is not "no gusts" — it is the uniform scatter the game has always done, and it
// stays byte-for-byte that, because the RNG draw count is what every venue's races are
// pinned to.
const gregs = () => (doc && doc.gusts && doc.gusts.regions) || [];

// Puffs, drawn where they come from. Not arrows: a source points nowhere, and borrowing the
// wind layer's arrow grid would say it had a direction it does not have. The dots ARE the
// thing — cat's paws on the water — and their density carries the source's `count` the way arrow
// length carries speed, thinning toward the rim exactly as the spawn weighting does.
function drawGustRegions() {
    if (!doc) return;
    const rs = gregs();
    let total = 0;
    for (const r of rs) total += (r.count != null ? r.count : 8);
    for (let i = 0; i < rs.length; i++) {
        const r = rs[i];
        if (!r.poly || r.poly.length < 3) continue;
        const on = i === selGust;
        // WARM for a source that mostly makes pressure, COOL for one that mostly makes
        // holes — the same amber/blue the pressure overlay uses, so a dead patch never
        // reads as a gust factory at a glance.
        const bias = r.bias != null ? r.bias : 0.5;
        const rgb = bias >= 0.5 ? '251,191,36' : '129,140,248';
        ctx.beginPath(); ringPath(r.poly);
        ctx.fillStyle = `rgba(${rgb},${on ? 0.15 : 0.07})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb},${on ? 1 : 0.55})`;
        ctx.lineWidth = on ? 2 : 1.2;
        ctx.setLineDash([2, 6]); ctx.stroke(); ctx.setLineDash([]);

        if (mode === 'gust') drawGustStipple(r, on, rgb, total);

        if (on) {
            r.poly.forEach((p, k) => {
                const q = toS(p[0], p[1]);
                const onV = hover.wvert === k;
                const rad = onV ? 8 : 5.5;
                ctx.beginPath(); ctx.arc(q.x, q.y, rad + 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(8,15,30,0.75)'; ctx.fill();
                ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
                ctx.fillStyle = onV ? '#fef3c7' : `rgb(${rgb})`; ctx.fill();
            });
        }
    }
}

// The stipple. A screen-space grid like the arrow grid, so density reads the same at any
// zoom, and each cell either gets a dot or does not — decided by the SAME smoothstep the
// spawner rejection-samples against. What you see is literally where puffs will be born.
//
// The jitter is derived from the grid cell, never from Math.random(): the editor redraws on
// every mouse move, and a random stipple would boil.
function drawGustStipple(r, on, rgb, total) {
    const poly = r.poly;
    const fall = r.falloff != null ? r.falloff : 400;
    const share = total > 0 ? (r.count != null ? r.count : 8) / total : 0;
    const step = 26;
    let box = null;
    for (const q of poly) {
        const sp = toS(q[0], q[1]);
        if (!box) box = { x0: sp.x, y0: sp.y, x1: sp.x, y1: sp.y };
        box.x0 = Math.min(box.x0, sp.x); box.y0 = Math.min(box.y0, sp.y);
        box.x1 = Math.max(box.x1, sp.x); box.y1 = Math.max(box.y1, sp.y);
    }
    if (!box) return;
    const x0 = Math.max(0, Math.floor(box.x0 / step) * step);
    const y0 = Math.max(0, Math.floor(box.y0 / step) * step);
    const x1 = Math.min(W(), box.x1), y1 = Math.min(H(), box.y1);
    for (let sy = y0 + step / 2; sy < y1; sy += step) {
        for (let sx = x0 + step / 2; sx < x1; sx += step) {
            // A stable hash of the cell: enough scatter that the dots do not read as a grid,
            // and identical every frame.
            const h = Math.abs(Math.sin(sx * 12.9898 + sy * 78.233) * 43758.5453) % 1;
            const h2 = Math.abs(Math.sin(sx * 39.3468 + sy * 11.135) * 24634.6345) % 1;
            const px = sx + (h - 0.5) * step * 0.8, py = sy + (h2 - 0.5) * step * 0.8;
            const w = toW(px, py);
            let d = Infinity;
            for (let i = 0; i < poly.length; i++)
                d = Math.min(d, distToSeg(w.x, w.y, poly[i], poly[(i + 1) % poly.length]));
            const sd = pointInRing(w.x, w.y, poly) ? d : -d;
            const wt = VenueDoc.regionWeight(sd, fall);
            // The dot survives with the same probability a puff would be born here, and
            // carries the region's share of all the births as its weight against a
            // neighbouring source's.
            if (h * 0.9 > wt * Math.min(1, share * 3)) continue;
            const a = (on ? 0.85 : 0.45) * (0.3 + 0.7 * wt);
            ctx.beginPath();
            ctx.arc(px, py, 1.6 + 1.4 * wt, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
            ctx.fill();
        }
    }
}

// ── Water colour ────────────────────────────────────────────────────────────
// The document may override the venue's water palette. The swatches show whatever is in
// force — the document's colour if it has one, otherwise the venue's — so they never
// present a colour the water is not actually using.
//
// Three of them, because three is what the renderer reads: baseColor at the centre of the
// depth gradient, deepColor at its rim, and shallowColor over every painted `shallows`
// zone.
//
// ⚠️ THE SHALLOW SWATCH USED TO HIDE ITSELF on a document with no `shallows` zone, on the
// grounds that a swatch changing nothing on screen is a lie. That rule is still right about
// `shorelineColor` and is why there is no swatch for it (it drives only generated-island
// glow, which document venues never take), but it was wrong here, for two reasons that only
// became visible once "Derive from surface" existed. The button WRITES shallowColor, so
// hiding the swatch meant seeding a colour the author could neither see nor tune — the seed
// is supposed to land in the ballpark so it can be nudged, and that one nudge was
// impossible. And a hidden shallowColor is how a stale value survives: five venues
// (arctic, lake, redrock, river, swamp) carry `#22d3ee`-family water inherited from the
// tropical default in water.js, painting nothing, waiting to ambush the first shallows zone
// anybody draws. A colour that is inert TODAY but authoritative the moment a zone appears is
// not a dead control, it is a deferred one, and the honest thing is to show it.
//
// Still no swatch for `heroColor`, which is deliberately not hand-pickable: it is DERIVED —
// see deriveHeroColor.
const PAL_KEYS = { 'pal-base': 'baseColor', 'pal-deep': 'deepColor', 'pal-shallow': 'shallowColor' };

// The puff/lull tints, which live one level down in `palette.gusts` and as [r,g,b] rather
// than hex. They get swatches for the same reason the shallow one does — they are live,
// seven venues author them, and they are the one part of the water's look the editor could
// previously strand: the game prefers an AUTHORED `gusts` block over deriving from the
// water, so recolouring a venue used to leave the old venue's cat's-paws pasted on the new
// water. Ordered dark-to-bright so the four read as the ramp they are.
const GUST_KEYS = {
    'pal-gust-dark': 'gustDark', 'pal-gust-mid': 'gustMid',
    'pal-lull-mid': 'lullMid', 'pal-lull-bright': 'lullBright'
};

// The moonlight amount to restore when the night toggle goes back on, so switching it off to
// see the water in daylight does not cost the value you had tuned. Declared HERE rather than
// beside its handler because paletteRefresh reads it, and paletteRefresh runs during boot —
// a `let` further down the file would still be in its temporal dead zone at that point.
// Starts at Glowtide's 0.62, the library's one worked night.
let lastNight = 0.62;

const palRGB = (h) => {
    const s = String(h || '').replace('#', '');
    return /^[0-9a-f]{6}$/i.test(s) ? [0, 2, 4].map(i => parseInt(s.substring(i, i + 2), 16)) : null;
};
const palHEX = (a) => Array.isArray(a) && a.length >= 3
    ? '#' + a.slice(0, 3).map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')
    : null;

// WHAT THE GAME WILL ACTUALLY USE for the puffs, mirroring applyVenuePalette's own
// precedence exactly — authored block, else derived from this document's water, else the
// bay blues. Mirrored rather than approximated because a swatch that shows a colour the
// water is not using is the lie the shallow swatch's rule already forbids. In particular a
// document that overrides NO water colour gets DEFAULT_GUST_COLORS and not a derivation,
// which is why the `baseColor || deepColor` test is here too.
function effectiveGusts() {
    const dp = (doc && doc.palette) || {};
    if (dp.gusts) return dp.gusts;
    const live = window.WATER_CONFIG || {};
    if (dp.baseColor || dp.deepColor) {
        return gustTintFrom({
            baseColor: dp.baseColor || live.baseColor,
            deepColor: dp.deepColor || live.deepColor
        });
    }
    return (typeof DEFAULT_GUST_COLORS !== 'undefined') ? DEFAULT_GUST_COLORS : null;
}

function paletteRefresh() {
    if (!$('pal-base')) return;
    const live = window.WATER_CONFIG || {};
    const dp = (doc && doc.palette) || {};
    for (const id in PAL_KEYS) {
        const k = PAL_KEYS[id];
        const v = dp[k] || live[k] || '#0e7490';
        $(id).value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#0e7490';
    }
    // Shown whether authored or derived, so the four swatches always report the puffs the
    // water is actually wearing. Editing one is what turns it into an override.
    const g = effectiveGusts() || {};
    for (const id in GUST_KEYS) {
        if (!$(id)) continue;
        $(id).value = palHEX(g[GUST_KEYS[id]]) || '#0e7490';
    }
    const night = (dp.night != null ? dp.night : (live.night || 0));
    if (night > 0) lastNight = night;          // so the toggle can put it back
    if ($('pal-night')) $('pal-night').value = night;
    if ($('pal-moondir')) $('pal-moondir').value = (dp.moonDir != null ? dp.moonDir
        : (live.moonDir != null ? live.moonDir : 25));
    // The toggle is a VIEW of `night > 0`, not a second field. There is no boolean in the
    // document and there should not be: the renderer reads an amount, nightAmt() treats
    // anything <= 0 as day, and a separate flag could disagree with the number it gates.
    if ($('pal-night-on')) $('pal-night-on').checked = night > 0;
    for (const [inp, lab] of [['pal-night', 'pal-night-label'], ['pal-moondir', 'pal-moondir-label']]) {
        if ($(inp)) $(inp).disabled = !(night > 0);
        if ($(lab)) $(lab).classList.toggle('is-off', !(night > 0));
    }
    palettePreview();
}

// A real patch of water, drawn by the GAME's renderer rather than a gradient that
// approximates it: the same depth ramp, the same drifting ripple lattice, scrolling downwind
// off the same wind bearing. Two colours cannot tell you what water made of them looks like.
//
// Rendered a WHOLE SCREENFUL at a time and then scaled into the panel. The ripple texture is
// made of swell masses 110–240px across, so a 230px canvas held one corner of one of them and
// the preview read as a flat gradient — the pixels were right and the framing was useless.
// Same renderer, same world scale, just seen from further back.
let palPreviewT = 0;
let palBig = null;
// How much wider a patch than the panel: the swell masses in the ripple lattice are 110–240px
// across, so at 1:1 the panel held one corner of one of them and read as a flat gradient. Past
// about 2 the wind-wave crests thin out into nothing when the frame is scaled down, so 2 is
// where both layers are legible at once.
const PAL_ZOOM_OUT = 2;
function palettePreview() {
    const cv2 = $('pal-preview');
    if (!cv2 || !window.WaterRenderer || !window.WATER_CONFIG) return;
    const c2 = cv2.getContext('2d');
    if (!palBig) palBig = document.createElement('canvas');
    if (palBig.width !== cv2.width * PAL_ZOOM_OUT) {
        palBig.width = cv2.width * PAL_ZOOM_OUT;
        palBig.height = cv2.height * PAL_ZOOM_OUT;
    }
    // The renderer reads the canvas size and a camera, and nothing else about the game — so a
    // synthetic state is enough. It drifts the lattice downwind from `wind.direction`, which
    // is why the preview ripples run the way this venue's wind does. The camera is panned
    // down-map and bobs, so the depth ramp shows rather than one flat tone.
    const fake = {
        wind: { direction: windBase() },
        camera: { x: 0, y: -900 + Math.sin(palPreviewT) * 40, rotation: 0, zoom: 1 }
    };
    try {
        const bctx = palBig.getContext('2d');
        window.WaterRenderer.draw(bctx, fake);
        // The SECOND KIND OF WATER, when this venue has any: a shallows band across the
        // bottom of the patch, laid on exactly as drawShallows lays it on — the same
        // colour at the same alpha with a feathered rim, under the wind waves, which in
        // play ride over both waters. The base/shallow pair is the actual authoring task
        // on a venue like the lagoon, and it can only be tuned as a pair.
        if ((doc && doc.shapes || []).some(s => s.kind === 'shallows')) {
            const dp2 = (doc && doc.palette) || {};
            const rgbS = (h) => {
                const s = String(h || '').replace('#', '');
                return /^[0-9a-f]{6}$/i.test(s) ? [0, 2, 4].map(i => parseInt(s.substring(i, i + 2), 16)) : null;
            };
            const sh = rgbS(dp2.shallowColor || (window.WATER_CONFIG || {}).shallowColor);
            if (sh) {
                const a = (typeof SHALLOWS_ALPHA !== 'undefined') ? SHALLOWS_ALPHA : 0.72;
                const y0 = palBig.height * 0.62, f = 60;
                const grd = bctx.createLinearGradient(0, y0 - f, 0, y0);
                grd.addColorStop(0, `rgba(${sh[0]},${sh[1]},${sh[2]},0)`);
                grd.addColorStop(1, `rgba(${sh[0]},${sh[1]},${sh[2]},${a})`);
                bctx.fillStyle = grd;
                bctx.fillRect(0, y0 - f, palBig.width, f);
                bctx.fillStyle = `rgba(${sh[0]},${sh[1]},${sh[2]},${a})`;
                bctx.fillRect(0, y0, palBig.width, palBig.height - y0);
            }
        }
        // The wind ripples are a SECOND layer in the game — white broken crests riding on the
        // water, sized and lit by the local wind and drifting downwind — and they are most of
        // what the water actually looks like. Drawn here by the game's own update and draw, in
        // the game's own world transform, so this is the water you will sail on and not a
        // painting of it. A patch with no wind over it stays glassy, exactly as it will in play.
        if (window.updateWindWaves && window.drawWindWaves && window.state && state.waveStates) {
            const cam = state.camera;
            state.camera = fake.camera;              // the update reads state.camera
            try {
                window.updateWindWaves(0.12);        // the preview's own tick, in seconds
                bctx.save();
                bctx.translate(palBig.width / 2, palBig.height / 2);
                bctx.rotate(-fake.camera.rotation);
                bctx.translate(-fake.camera.x, -fake.camera.y);
                window.drawWindWaves(bctx);
                bctx.restore();
            } finally { state.camera = cam; }
        }
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
        c2.drawImage(palBig, 0, 0, cv2.width, cv2.height);
    } catch (err) {
        // Never let a preview take the editor down.
        c2.fillStyle = window.WATER_CONFIG.baseColor || '#0e7490';
        c2.fillRect(0, 0, cv2.width, cv2.height);
    }
}

// Regions in the object column, their numbers in the inspector — nothing left to paint.
// ⚠️ Still READ WITHOUT WRITING: creating `current.regions = []` here would mark a pristine
// document unsaved the moment it loaded.
function currentRefresh() { objRefresh(); layerRefresh(); }

function drawCurrentRegions() {
    if (!doc) return;
    const rs = cregs();
    for (let i = 0; i < rs.length; i++) {
        const r = rs[i];
        if (!r.poly || r.poly.length < 3) continue;
        const on = i === selCur;
        ctx.beginPath(); ringPath(r.poly);
        ctx.fillStyle = on ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.07)';
        ctx.fill();
        ctx.strokeStyle = on ? '#38bdf8' : 'rgba(56,189,248,0.5)';
        ctx.lineWidth = on ? 2 : 1.2;
        ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);

        // The same grid of arrows the wind layer draws, so a stream reads the way a breeze
        // does: length and opacity carry the local strength, which is what makes `falloff`
        // visible. Not while the current FIELD overlay is up — that answers the same
        // question for the whole map, blend included.
        if (mode === 'current' && !showCurField) drawRegionArrows(r, on, 'current');

        if (on) {
            r.poly.forEach((p, k) => {
                const q = toS(p[0], p[1]);
                const onV = hover.wvert === k;
                const rad = onV ? 8 : 5.5;
                ctx.beginPath(); ctx.arc(q.x, q.y, rad + 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(8,15,30,0.75)'; ctx.fill();
                ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
                ctx.fillStyle = onV ? '#e0f2fe' : '#38bdf8'; ctx.fill();
            });
        }
    }
}

// The summed flow, for the same reason the wind field exists: additive systems are only
// authorable if you can see the total.
function drawCurrentField() {
    if (!course) return;
    const step = 52;
    for (let sy = step / 2; sy < H(); sy += step) {
        for (let sx = step / 2; sx < W(); sx += step) {
            const w = toW(sx, sy);
            // Skip land: a flow arrow over a coastline is describing something that is
            // not there.
            if (doc && doc.shapes.some(l => pointInRing(w.x, w.y, l.outer)
                && !(l.holes || []).some(h => pointInRing(w.x, w.y, h)))) continue;
            const f = getCurrentAt(w.x, w.y);
            if (!f || f.speed < 0.02) continue;
            // An ARROW pointing where the water flows, sized by how fast — the same
            // grammar as the wind field, so both fields read the same way at a glance.
            // Reference is 1.5 kt, the same as the per-region current arrows.
            const ux = Math.sin(f.direction), uy = -Math.cos(f.direction);
            const len = 11 * Math.max(0.35, Math.min(1.8, f.speed / 1.5));
            windArrow(sx, sy, ux, uy, len, 'rgba(125,211,252,0.85)', 1.6);
        }
    }
}

// ── Rapids regions ──────────────────────────────────────────────────────────
// The fourth region kind, and the only one with a single number on it: `turbulence`,
// the broken-water fraction that robs drive and shoves the bow. No flow of its own —
// the stream, tongue included, is the Current layer's to author.
const rregs = () => (doc && doc.rapids && doc.rapids.regions) || [];

function drawRapidsRegions() {
    if (!doc) return;
    const rs = rregs();
    for (let i = 0; i < rs.length; i++) {
        const r = rs[i];
        if (!r.poly || r.poly.length < 3) continue;
        const on = i === selRapids;
        ctx.beginPath(); ringPath(r.poly);
        // Foam white, weighted by how turbulent: a shoulder at 0.9 reads denser than a
        // smooth tongue at 0.1 before a single number is looked at.
        const turb = r.turbulence != null ? r.turbulence : 0.5;
        const fa = (on ? 0.10 : 0.05) + 0.14 * turb;
        ctx.fillStyle = `rgba(226,232,240,${fa.toFixed(3)})`;
        ctx.fill();
        ctx.strokeStyle = on ? '#e2e8f0' : 'rgba(226,232,240,0.5)';
        ctx.lineWidth = on ? 2 : 1.2;
        ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);

        // No arrow grid: a rapid has no direction to point. The turbulence-weighted
        // fill IS the picture, the way a gust source's cat's paws are.

        if (on) {
            r.poly.forEach((p, k) => {
                const q = toS(p[0], p[1]);
                const onV = hover.wvert === k;
                const rad = onV ? 8 : 5.5;
                ctx.beginPath(); ctx.arc(q.x, q.y, rad + 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(8,15,30,0.75)'; ctx.fill();
                ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
                ctx.fillStyle = onV ? '#f8fafc' : '#e2e8f0'; ctx.fill();
            });
        }
    }
}

// ── Hand-placed ice ─────────────────────────────────────────────────────────
// Authored as world-space polygons, so a floe can be reshaped vertex by vertex like any
// other outline. What the game randomizes per race is the MOTION — drift, spin, wander —
// which is what keeps a designed ice field from playing out the same way twice.
const EMPTY = [];
const dshapes = () => (doc && doc.shapes) || EMPTY;
// What a shape IS, from the shared kinds table — never a second copy of it here.
const TR = (sh) => window.VenueDoc.traits(sh);
const isFloe = (sh) => TR(sh).motion === 'drift';
// Is this point on something that SITS STILL? Scattering rejects candidates that land on
// it. Drifting shapes are excluded on purpose: two floes may legitimately be laid touching,
// and once the array held both, "on land" quietly started meaning "on anything".
const onLand = (x, y) => !!(doc && doc.shapes.some(l =>
    TR(l).motion === 'fixed' && pointInRing(x, y, l.outer)
    && !(l.holes || []).some(h => pointInRing(x, y, h))));
// The one place allowed to create the array is the code about to put something in it.
const dshapesW = () => { if (!doc.shapes) doc.shapes = []; return doc.shapes; };

// The outline generator is the GAME's own (script.js), so hand-placed ice is shaped by
// exactly the same harmonics as the scattered kind — otherwise authored floes would read
// as a different material.
function iceOutline(cx, cy, r) {
    const art = (typeof makeFloeOutline === 'function')
        ? makeFloeOutline(r, Math.random)
        // Fallback, should script.js ever stop exposing it: a plain jittered ring.
        : Array.from({ length: 13 }, (_, k) => {
            const a = (k / 13) * Math.PI * 2, rr = r * (0.8 + Math.random() * 0.4);
            return { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
        });
    return art.map(p => [cx + p.x, cy + p.y]);
}

// One drag places ice. `scatter` > 1 drops that many inside the dragged circle instead of
// one, which is how density is authored: drag a bigger circle, ask for more pieces.
function addIce(cx, cy, radius) {
    const n = Math.max(1, Math.min(60, parseInt($('ice-scatter').value, 10) || 1));
    const vary = Math.max(0, Math.min(90, parseFloat($('ice-vary').value) || 0)) / 100;
    const made = [];
    // A scatter shares the dragged circle out between its pieces, so asking for more ice
    // in the same box gives smaller floes rather than a pile of overlapping bergs.
    const each = n === 1 ? radius : radius / Math.sqrt(n) * 0.85;
    for (let k = 0; k < n; k++) {
        const rr = Math.max(mToU(4), each * (1 - vary / 2 + Math.random() * vary));
        let px = cx, py = cy;
        let ring = null;
        if (n > 1) {
            // Keep the pieces apart: two floes on top of each other read as one bigger
            // one, so a scatter that overlaps is not the density it claims to be. A few
            // tries, then place anyway — refusing silently would leave you short.
            //
            // The OUTLINE is generated per try and tested by its own centroid, not by the
            // candidate point. A floe outline is deliberately lopsided — makeFloeOutline's
            // f=1 harmonic shoves the mass off-centre, which is what stops a floe reading
            // as a flower — so its centroid sits well away from where it was seeded. Testing
            // the seed meant the tool refused land it was about to cover and accepted land
            // it was about to sit on, at random, a few percent of the time.
            let placed = false;
            for (let t = 0; t < 18 && !placed; t++) {
                const a = Math.random() * Math.PI * 2;
                const d = Math.sqrt(Math.random()) * Math.max(0, radius - rr);
                px = cx + Math.cos(a) * d; py = cy + Math.sin(a) * d;
                ring = iceOutline(px, py, rr);
                let gx = 0, gy = 0;
                for (const q of ring) { gx += q[0]; gy += q[1]; }
                gx /= ring.length; gy /= ring.length;
                placed = !onLand(gx, gy) && !made.some(o => {
                    const c = iceCentre(o);
                    return Math.hypot(c.x - px, c.y - py) < (c.r + rr) * 0.95;
                });
            }
            if (!placed) continue;              // no room here; place fewer, not badly
        }
        let m = 1;
        while (dshapes().some(f => f.id === `ice-${m}`)) m++;
        // KIND, always. A shape with none falls back to the table's first entry, which is
        // fixed land — so a scattered floe read as an island, and the placer then refused to
        // drop the next one anywhere near it.
        const f = { id: `ice-${m}`, kind: newKind(),
                    outer: ring || iceOutline(px, py, rr), holes: [] };
        dshapesW().push(f);
        made.push(f);
    }
    if (made.length && onLand(cx, cy) && n === 1) {
        toast('That floe is sitting on land — drag it into the water', true);
    }
    return made.length;
}

function iceCentre(f) {
    let cx = 0, cy = 0;
    for (const p of f.outer) { cx += p[0]; cy += p[1]; }
    return { x: cx / f.outer.length, y: cy / f.outer.length,
             r: Math.max.apply(null, f.outer.map(p => Math.hypot(p[0] - cx / f.outer.length, p[1] - cy / f.outer.length))) };
}

// ICE IS A SHAPE KIND, NOT A VENUE PRIVILEGE. This used to ask the venue's `fx.ice`, so the
// Place tool would only drop a floe on Glacier Sound — the one venue that already had ice
// was the only one you could add it to. The `fx` system is gone and geometry is whatever the
// document says it is, so any course can be given drifting ice by drawing some.
const venueHasIce = () => !!doc;

// The layer row's count. Kept under this name because a dozen call sites say it; there is
// nothing else left for it to paint, since the shape list, its count and the selected
// shape's numbers all render from layerRefresh and refreshInspector.
function iceRefresh() { layerRefresh(); }

function deleteIce(i) {
    if (!doc || !dshapes()[i]) return false;
    const id = dshapes()[i].id;
    doc.shapes.splice(i, 1);
    afterEdit(true, 'delete ice');
    toast(`Removed ${id}`);
    return true;
}

// ── Draw a new shape ────────────────────────────────────────────────────────
// Click to drop points, Enter or double-click to close, Esc to cancel. A rough ring
// plus the sculpt brush beats placing every vertex by hand.
let pending = null;
// Draw makes the kind of thing the LAYER holds. It only ever made land, so wind and current
// needed their own "+ Region" buttons to exist at all — two more ways to make a polygon,
// beside a tool whose whole job is making polygons.
function commitPending() {
    // A LANE NEEDS TWO POINTS, not three: a shape must enclose water, a path only has to go
    // somewhere. Handled before the ring guard below, which would throw a two-point lane away.
    if (mode === 'traffic' && extendLane) {
        const v = dtraffic()[extendLane.i];
        const pts = (pending || []).map(q => ({ x: q[0], y: q[1] }));
        const atStart = extendLane.atStart;
        extendLane = null; pending = null;
        if (!v || !pts.length) { draw(); return; }
        // Prepending REVERSES what was clicked: you drew away from the old start, so the
        // last thing you clicked is the lane's new beginning.
        if (atStart) v.path.unshift(...pts.reverse()); else v.path.push(...pts);
        selTV = atStart ? 0 : v.path.length - 1;
        afterEdit(true, 'extend lane');
        toast(`${v.id} now ${v.path.length} points`);
        return;
    }
    if (mode === 'traffic') {
        const pts = pending || [];
        if (pts.length < 2) { pending = null; draw(); toast('A lane needs at least two points'); return; }
        pending = null;
        const arr = dtrafficW();
        const v = newTrafficEntry(pts.map(q => ({ x: q[0], y: q[1] })));
        arr.push(v);
        selTraf = arr.length - 1; selTV = -1;
        afterEdit(true, 'draw lane');
        toast(`Added ${v.id} — set its speed and schedule on the right`);
        return;
    }
    if (!pending || pending.length < 3) { pending = null; draw(); return; }
    const ring = pending.map(p => [p[0], p[1]]);
    pending = null;
    if (isRegionMode(mode)) {
        const r = addRegion(mode, ring);
        afterEdit(true, `draw ${mode} region`);
        toast(mode === 'gust'
            ? `Added ${r.id} — puffs are born here now; say what kind on the right`
            : `Added ${r.id} — set its direction and speed on the right`);
        return;
    }
    let n = 1;
    while (doc.shapes.some(x => x.id === `shape-${n}`)) n++;
    // A shape without a KIND is not a shape yet: the compiler falls back to the first entry
    // in the table, so an unkinded polygon silently became a sandy island, and the validator
    // rightly called it an unknown kind. Every maker states one.
    const l = { id: `shape-${n}`, kind: newKind(),
                outer: ring, holes: [], c: [0, 0], r: 0 };
    rebake(l);
    doc.shapes.push(l);
    sel = { shape: l.id, mark: -1, vert: -1, bvert: -1 };
    osel = [{ kind: 'shape', id: l.id }];
    afterEdit(true, 'draw shape');
    toast(`Added ${l.id} — sculpt with S, set its kind on the right`);
}

// What a NEW region starts at. Seeded from the venue's own wind once, so drawing a region on
// a windy venue does not hand you a calm one; it is a starting value in the document from
// then on, not a link back to the venue.
function defaultWindSpeed() {
    const w = state.wind;
    const v = w && (w.baseSpeed || w.speed);
    return Math.round(isFinite(v) && v > 0 ? v : 12);
}

// One maker for every region kind. `poly` is whatever outline you drew; the rest are the
// neutral defaults a new region of that kind starts from.
function addRegion(kind, poly) {
    // `doc.current`/`doc.gusts` may not exist at all on a venue that has never had one —
    // this is a WRITE path, so creating the container here is right. (The accessors that
    // only READ must never do this: it marked pristine documents unsaved on load, twice.)
    const owner = REGION[kind].owner();
    const list = owner.regions || (owner.regions = []);
    let n = 1;
    while (list.some(r => r.id === `${kind}-${n}`)) n++;
    const r = kind === 'wind'
        // Direction 0 — due north — rather than whatever the venue happens to be doing, so a
        // new region starts from a stated bearing you can reason about. Speed is seeded from
        // the venue's own range ONCE, at creation, and written into the document: there is no
        // runtime fallback any more, so a region with no speed is a calm hole.
        ? { id: `wind-${n}`, poly, falloff: 300, direction: 0,
            dirVar: 0, speed: defaultWindSpeed(), speedVar: 0, period: 30 }
        // A current is STEADY. `dirVar`/`speedVar`/`period` are the oscillation, and the
        // only thing they would model is a reversing tide — which is a feature to design,
        // not three boxes to leave lying about meaning nothing. `period: 0` is what the
        // engine reads as "no oscillation"; it still SUPPORTS all three, so bringing tides
        // back is a panel change and not an engine one.
        : kind === 'current'
        ? { id: `current-${n}`, poly, falloff: 300, direction: 0,
            speed: 0.5, dirVar: 0, speedVar: 0, period: 0 }
        // A gust source starts NEUTRAL in every way but position: an equal share of the
        // births, and an ordinary puff: 5 knots on the anemometer, 300 m across, gone in 90
        // seconds. Drawing one says WHERE, and nothing else, until you say otherwise — and
        // now the "nothing else" is legible, because a stated default in knots and metres
        // can be judged against the course where `1x` could only be judged against itself.
        : kind === 'gust'
        ? { id: `gust-${n}`, poly, falloff: 300, count: 8, gustKt: 5, sizeM: 300, lifeS: 90, bias: 0.5, veer: 15 }
        // A rapid is PURE TEXTURE — turbulence and nothing else. Flow belongs to the
        // Current layer in whole, so a rapid has no speed or direction to default. The
        // falloff is tighter than a current's because rapids have edges you can see —
        // the eddy line is a line.
        : { id: `rapids-${n}`, poly, falloff: 200, turbulence: 0.5 };
    list.push(r);
    const i = list.length - 1;
    setRegSel(kind, i);
    osel = [{ kind, i }];
    vsel = [];
    return r;
}

// ── Vertex selection ────────────────────────────────────────────────────────
// A ref names a vertex without holding a pointer to it, so edits and undo cannot leave
// the selection pointing at a stale array.
function modeVertexRefs() {
    if (!doc) return [];
    const out = [];
    // The SELECTED object's vertices, in the mode that owns it. Marquee-selecting across
    // objects you cannot see the handles of would be selecting blind.
    if (mode === 'shape' && sel.shape) {
        const l = shapeById(sel.shape);
        if (l) {
            l.outer.forEach((p, i) => out.push({ kind: 'shape', id: l.id, ring: -1, i, x: p[0], y: p[1] }));
            (l.holes || []).forEach((h, hi) => h.forEach((p, i) =>
                out.push({ kind: 'shape', id: l.id, ring: hi, i, x: p[0], y: p[1] })));
        }
        } else if (mode === 'boundary') {
        const bp = doc.world.boundary.poly;
        if (bp) bp.forEach((p, i) => out.push({ kind: 'arena', i, x: p[0], y: p[1] }));
    } else if (activeReg()) {
        const r = regSel(mode);
        activeReg().poly.forEach((p, i) => out.push({ kind: mode, r, i, x: p[0], y: p[1] }));
    }
    return out;
}
function vertexArray(ref) {
    if (!doc) return null;
    if (ref.kind === 'shape') {
        const l = shapeById(ref.id);
        if (!l) return null;
        const ring = ref.ring < 0 ? l.outer : (l.holes || [])[ref.ring];
        return ring ? ring[ref.i] : null;
    }
    if (ref.kind === 'arena') return (doc.world.boundary.poly || [])[ref.i];
    if (isRegionMode(ref.kind)) { const g = regsOf(ref.kind)[ref.r]; return g ? g.poly[ref.i] : null; }
    return null;
}
const sameRef = (a, b) => a.kind === b.kind && a.i === b.i && a.id === b.id
                          && a.ring === b.ring && a.r === b.r;
const inSel = (ref) => vsel.some(v => sameRef(v, ref));

function rebakeTouched() {
    if (!doc) return;
    const ids = new Set(vsel.filter(v => v.kind === 'shape').map(v => v.id));
    for (const id of ids) { const l = shapeById(id); if (l) rebake(l); }
}

// Align every selected vertex to the FIRST one selected. An anchor you chose is more
// predictable than a mean nobody can see.
function alignSel(axis) {
    if (vsel.length < 2) { toast('Select two or more vertices first', true); return false; }
    const anchor = vertexArray(vsel[0]);
    if (!anchor) return false;
    for (let k = 1; k < vsel.length; k++) {
        const p = vertexArray(vsel[k]);
        if (!p) continue;
        if (axis === 'x') p[0] = anchor[0]; else p[1] = anchor[1];
    }
    rebakeTouched();
    return true;
}

// ── Alignment snapping ──────────────────────────────────────────────────────
// Dragging a vertex to exactly the x or y of the one next to it is a thing people do
// constantly and cannot do by hand. So within a few SCREEN pixels of a neighbour's axis
// it snaps, and past that it does not — the threshold is in screen space so it feels the
// same at every zoom, and deviating far enough always wins.
const SNAP_PX = 7;
let snapGuide = null;          // {x} and/or {y} of the axis being held, for drawing

// Every vertex that may be snapped TO: the ring neighbours of the one being dragged,
// which is what "aligned with its neighbour" means, plus the course marks when a mark is
// what is moving.
function snapCandidates(ref) {
    const out = [];
    if (!ref) return out;
    const push = (p) => { if (p) out.push({ x: p[0], y: p[1] }); };
    if (ref.kind === 'shape') {
        const l = shapeById(ref.id);
        if (!l) return out;
        const ring = ref.ring < 0 ? l.outer : (l.holes || [])[ref.ring];
        if (!ring || ring.length < 2) return out;
        push(ring[(ref.i - 1 + ring.length) % ring.length]);
        push(ring[(ref.i + 1) % ring.length]);
    } else if (ref.kind === 'arena') {
        const bp = doc.world.boundary.poly;
        if (!bp || bp.length < 2) return out;
        push(bp[(ref.i - 1 + bp.length) % bp.length]);
        push(bp[(ref.i + 1) % bp.length]);
    } else if (isRegionMode(ref.kind)) {
        const reg = regsOf(ref.kind)[ref.r];
        if (!reg || reg.poly.length < 2) return out;
        push(reg.poly[(ref.i - 1 + reg.poly.length) % reg.poly.length]);
        push(reg.poly[(ref.i + 1) % reg.poly.length]);
        }
    return out;
}

// Snap a dragged world point to any candidate's axis, independently per axis so a corner
// can align with one neighbour horizontally and another vertically at the same time.
function snapPoint(w, cands) {
    snapGuide = null;
    if (!cands.length) return w;
    const tol = SNAP_PX / view.scale;
    let bx = null, by = null, dbx = tol, dby = tol;
    for (const c of cands) {
        const dx = Math.abs(c.x - w.x), dy = Math.abs(c.y - w.y);
        if (dx < dbx) { dbx = dx; bx = c.x; }
        if (dy < dby) { dby = dy; by = c.y; }
    }
    if (bx === null && by === null) return w;
    snapGuide = { x: bx, y: by };
    return { x: bx !== null ? bx : w.x, y: by !== null ? by : w.y };
}

// ── Hit testing ─────────────────────────────────────────────────────────────
function hit(wx, wy) {
    const r = 13 / view.scale;                              // screen-constant grab radius
    const out = Object.assign({}, NOHIT);
    // A hidden layer is not grabbable. Invisible-but-interactive is the same lie as
    // visible-but-inert, pointing the other way.
    const L = layerOf(mode);
    if (L && !shown(L.id)) return out;
    // MODE gates what is hittable. Previously several things were grabbable "from any
    // tool", which is precisely the ambiguity modes exist to remove.
    // The rounding centre and ring are HANDLES, so they only exist in the mode that owns
    // the geometry. In Route mode the map is an index you point at, not a canvas.
    if (mode === 'marks' && doc && course && course.route) {
        for (let li = 0; li < course.route.length; li++) {
            const e = course.route[li];
            if (e.kind !== 'round' || !e.mark) continue;
            const d = Math.hypot(wx - e.mark.x, wy - e.mark.y);
            if (d < r) { out.rcentre = li; return out; }
            if (Math.abs(d - e.mark.zone) < r) { out.rring = li; return out; }
        }
    }
    // Region outlines: every region kind uses the same vertex slot, since only one of the
    // region modes is ever active.
    const activeRegion = activeReg();
    if (doc && sub === 'direct' && activeRegion && activeRegion.poly) {
        const wp = activeRegion.poly;
        for (let i = 0; i < wp.length; i++) {
            if (Math.hypot(wp[i][0] - wx, wp[i][1] - wy) < r) { out.wvert = i; return out; }
        }
    }
    const bp = (mode === 'boundary') && sub === 'direct' && doc && doc.world.boundary.poly;
    if (bp) {
        for (let i = 0; i < bp.length; i++) {
            if (Math.hypot(bp[i][0] - wx, bp[i][1] - wy) < r) { out.bvert = i; return out; }
        }
    }
    const marks = ((mode === 'marks' || mode === 'route') && doc) ? doc.course.marks : [];
    for (let i = 0; i < marks.length; i++) {
        if (Math.hypot(marks[i].x - wx, marks[i].y - wy) < r * 1.4) { out.mark = i; return out; }
    }
    // A GATE is grabbable along its span, so it can be selected, named and deleted as one
    // thing rather than only through its two marks.
    if ((mode === 'marks' || mode === 'route') && doc) {
        const ls = dlines();
        for (let i = 0; i < ls.length; i++) {
            const ends = lineEnds(ls[i].id);
            if (!ends) continue;
            const ax = ends[0].x, ay = ends[0].y, bx = ends[1].x, by = ends[1].y;
            const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
            let t = l2 ? ((wx - ax) * dx + (wy - ay) * dy) / l2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            if (Math.hypot(wx - (ax + t * dx), wy - (ay + t * dy)) < r * 0.8) { out.line = i; return out; }
        }
    }
    if (!doc) return out;
    // Shapes are hittable only on their own layer. There is ONE test for all of them —
    // land, ice, reed, everything — because there is one layer. A second, floe-only copy
    // of this used to sit above the marks test and return first, which made every vertex
    // below unreachable: it was the old Ice layer's hit test, left behind with its mode
    // renamed when Ice and Land merged into Objects.
    if (mode !== 'shape') return out;
    // The SELECTED shape's vertices win over every body — a vertex sits ON the outline, so
    // testing bodies first would make it unreachable. Only the selected shape's handles are
    // drawn, and only those are grabbable: visible and grabbable are the same set.
    if (sub === 'direct' && sel.shape) {
        const l = shapeById(sel.shape);
        if (l) {
            let base = 0;
            for (const ring of eachRing(l)) {
                for (let i = 0; i < ring.length; i++) {
                    if (Math.hypot(ring[i][0] - wx, ring[i][1] - wy) < r) {
                        out.shape = l.id; out.vert = base + i; return out;
                    }
                }
                base += ring.length;
            }
        }
    }
    // LAST DRAWN WINS: the array is in paint order, so walking it backwards grabs whatever
    // is visibly on top — the same rule hitObject uses at the object level.
    for (let i = doc.shapes.length - 1; i >= 0; i--) {
        const l = doc.shapes[i];
        if (pointInRing(wx, wy, l.outer) && !(l.holes||[]).some(h => pointInRing(wx, wy, h))) { out.shape = l.id; return out; }
    }
    return out;
}
const shapeById = (id) => doc && doc.shapes.find(l => l.id === id);

// ── Edit operations ─────────────────────────────────────────────────────────
function translateShape(l, dx, dy) {
    for (const ring of eachRing(l)) for (const p of ring) { p[0] += dx; p[1] += dy; }
    rebake(l);
}
function transformShape(l, fn) {
    for (const ring of eachRing(l)) for (const p of ring) { const q = fn(p[0], p[1]); p[0] = q.x; p[1] = q.y; }
    rebake(l);
}
// Sculpt: push every vertex within the brush by the drag delta, with a smooth
// falloff. This is the interaction that makes vector land feel like painting —
// without it an 84-vertex coastline is edited one point at a time, and the mask
// quietly becomes the source of truth again.
function sculpt(cx, cy, dx, dy, radius) {
    const r = radius || brush;
    const r2 = r * r;
    const touched = new Set();
    for (const { ring, land } of brushRings()) {
        for (const p of ring) {
            const d2 = (p[0]-cx)**2 + (p[1]-cy)**2;
            if (d2 > r2) continue;
            const t = 1 - Math.sqrt(d2) / r;
            const w = t * t * (3 - 2 * t);              // smoothstep
            p[0] += dx * w; p[1] += dy * w;
            if (land) touched.add(land);
        }
    }
    for (const l of touched) rebake(l);
}
// Smooth: relax vertices toward the midpoint of their neighbours. Cleans up the
// chatter sculpting leaves behind.
function smooth(cx, cy, strength) {
    const r2 = brush * brush;
    const touched = new Set();
    for (const { ring, land } of brushRings()) {
        if (ring.length < 4) continue;
        const orig = ring.map(p => [p[0], p[1]]);
        for (let i = 0; i < ring.length; i++) {
            const d2 = (orig[i][0]-cx)**2 + (orig[i][1]-cy)**2;
            if (d2 > r2) continue;
            const t = 1 - Math.sqrt(d2) / brush;
            const w = t * t * (3 - 2 * t) * strength;
            const a = orig[(i - 1 + orig.length) % orig.length], b = orig[(i + 1) % orig.length];
            ring[i][0] += ((a[0] + b[0]) / 2 - orig[i][0]) * w;
            ring[i][1] += ((a[1] + b[1]) / 2 - orig[i][1]) * w;
            if (land) touched.add(land);
        }
    }
    for (const l of touched) rebake(l);
}
// ── Object level ────────────────────────────────────────────────────────────
// The POLYGONS this layer offers, as whole things. Same outlines brushRings walks, seen at
// a coarser grain — which is the entire difference between the two selection tools.
function modeObjects() {
    if (!doc) return [];
    const out = [];
    if (mode === 'shape') {
        for (const l of doc.shapes) out.push({ ref: { kind: 'shape', id: l.id }, rings: eachRing(l), land: l });
        } else if (mode === 'boundary') {
        const bp = doc.world.boundary.poly;
        if (bp) out.push({ ref: { kind: 'arena' }, rings: [bp], land: null });
    } else if (isRegionMode(mode)) {
        regsOf(mode).forEach((r, i) => { if (r.poly) out.push({ ref: { kind: mode, i }, rings: [r.poly], land: null }); });
    }
    return out;
}
const sameObj = (a, b) => !!a && !!b && a.kind === b.kind && a.id === b.id && a.i === b.i;
const inOsel = (ref) => osel.some(o => sameObj(o, ref));
const oselObjects = () => modeObjects().filter(o => inOsel(o.ref));

// Topmost first: the piece drawn on top is the one you grab, which is what "topmost" means
// to the eye. A point inside a hole is not inside the shape.
function hitObject(wx, wy) {
    const objs = modeObjects();
    for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        if (!pointInRing(wx, wy, o.rings[0])) continue;
        if (o.rings.slice(1).some(h => pointInRing(wx, wy, h))) continue;
        return o;
    }
    return null;
}
function oselCentre() {
    let n = 0, sx = 0, sy = 0;
    for (const o of oselObjects()) for (const ring of o.rings) for (const p of ring) { sx += p[0]; sy += p[1]; n++; }
    return n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 };
}
// One transform over the WHOLE selection, about one shared centre — so rotating three
// islands turns the group, rather than spinning each about its own middle.
function oselTransform(fn) {
    const objs = oselObjects();
    if (!objs.length) return false;
    for (const o of objs) for (const ring of o.rings) for (const p of ring) {
        const q = fn(p[0], p[1]); p[0] = q.x; p[1] = q.y;
    }
    for (const o of objs) if (o.land) rebake(o.land);
    return true;
}
// The single-object slots the inspectors were built on still work — they just follow the
// object selection now, and go empty when it holds more than one thing.
function syncSelFromOsel() {
    const only = (k) => { const m = osel.filter(o => o.kind === k); return m.length === 1 ? m[0] : null; };
    if (mode === 'shape') {
        const l = only('shape');
        sel = Object.assign({}, NOHIT, { shape: l ? l.id : null });
        refreshInspector();
    } else if (isRegionMode(mode)) {
        const r = only(mode);
        setRegSel(mode, r ? r.i : -1);
        objRefresh(); layerRefresh();
    }
}
// ── Object-level COMMANDS ───────────────────────────────────────────────────
// One-shot verbs on the selection, however many things are in it. They live at the object
// level because that is the level they act on — not in the inspector, which shows ONE thing
// and could only ever offer them for that one.
function oselResample() {
    const objs = oselObjects();
    if (!objs.length) return 0;
    for (const o of objs) {
        for (const ring of o.rings) resampleRing(ring);
        if (o.land) rebake(o.land);
    }
    vsel = [];                      // point count is unchanged, but the points themselves moved
    return objs.length;
}
// The copies become the selection, as in every vector editor: you duplicate in order to go
// on working on the copy, and having to re-select it is a step nobody wants.
function oselDuplicate() {
    if (!doc || !osel.length) return 0;
    const made = [];
    for (const o of oselObjects()) {
        const off = Math.max(120, (o.land ? o.land.r : ringBox(o.rings).w * 0.5) * 0.25);
        const shift = (ring) => ring.map(q => [q[0] + off, q[1] + off]);
        if (o.ref.kind === 'shape') {
            const l = o.land, copy = clone(l);
            let n = 2;
            while (doc.shapes.some(x => x.id === `${l.id}-${n}`)) n++;
            copy.id = `${l.id}-${n}`;
            if (l.name) copy.name = `${l.name} ${n}`;
            copy.outer = shift(l.outer);
            copy.holes = (l.holes || []).map(shift);
            rebake(copy);
            doc.shapes.push(copy);
            made.push({ kind: 'shape', id: copy.id });
            } else if (isRegionMode(o.ref.kind)) {
            const list = regsOf(o.ref.kind);
            const r = clone(list[o.ref.i]);
            let n = 2;
            while (list.some(x => x.id === `${r.id}-${n}`)) n++;
            r.id = `${r.id}-${n}`;
            if (r.name) r.name = `${r.name} ${n}`;
            r.poly = shift(r.poly);
            list.push(r);
            made.push({ kind: o.ref.kind, i: list.length - 1 });
        }
        // The arena is not duplicable: there is exactly one, and a second would not mean
        // anything to a course.
    }
    if (!made.length) return 0;
    osel = made; vsel = [];
    syncSelFromOsel();
    return made.length;
}
// ── CUT / COPY / PASTE ──────────────────────────────────────────────────────
//
// ONE CLIPBOARD, IN MEMORY, holding whole objects and the layer they came from.
//
// In memory rather than the system clipboard, and that is a choice rather than a shortcut.
// The system one would buy paste between two editor windows; it costs an async permission
// prompt on every read, a `file://` origin whose trustworthiness the browser decides for
// itself, and a silent refusal as its failure mode. Copying an island and pasting it in the
// same breath must not be able to fail. The cross-window case is what Save As is for.
//
// THE LAYER TRAVELS WITH THE CONTENT, because a selection ref only means anything on the
// layer it came from: `{kind:'shape', id}` on Objects, `{kind:'wind', i}` on Wind. An index
// copied on one layer names a DIFFERENT object on another. So paste switches to the
// clipboard's own layer rather than refusing — or, far worse, dropping a wind region into
// doc.shapes.
//
// Marks, gates and route legs are deliberately not copyable. A mark is referenced by id from
// lines and from the route, so a pasted one arrives referenced by nothing, and a pasted leg
// refers to marks that may not be there at all. Duplicating course furniture is a different
// verb from duplicating geometry, and it needs the reference graph thought about first.
let clip = null;                  // { mode, items: [...], pastes, at }
// A repeat step in SCREEN pixels, converted at paste time. World units would be a hair at
// one zoom and half the map at another; what "far enough to see it is a second copy" means
// is a fact about the screen.
const PASTE_STEP_PX = 26;

// The bounding box centre of everything on the clipboard.
//
// The BOX, not a centroid of points: a centroid is dragged toward whichever ring happens to
// be most densely sampled, so a shape with one finely-traced edge would land visibly off
// centre. What a designer means by "the middle of it" is the middle of what they can see.
//
// Across ALL items at once, so a multi-object paste centres the GROUP and keeps its
// formation, rather than stacking every piece on the same spot.
function clipCentre() {
    if (!clip || !clip.items.length) return null;
    if (clip.mode === 'props') {
        const xs = clip.items.map(p => +p.x), ys = clip.items.map(p => +p.y);
        return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
    }
    const rings = [];
    for (const it of clip.items) {
        if (it.outer) { rings.push(it.outer); for (const h of (it.holes || [])) rings.push(h); }
        else if (it.poly) rings.push(it.poly);
    }
    if (!rings.length) return null;
    const b = ringBox(rings);
    return { cx: b.cx, cy: b.cy };
}

// A free id, and one that does not GROW. `${id}-${n}` applied to an already-copied shape
// gives `id-2-2` and then `id-2-2-2`; stripping a trailing -N first keeps the fourth paste
// at `id-5`. (oselDuplicate still has the old behaviour — changing it is a separate call.)
function freshId(base, taken) {
    if (!taken.includes(base)) return base;
    const stem = String(base).replace(/-\d+$/, '');
    let n = 2;
    while (taken.includes(`${stem}-${n}`)) n++;
    return `${stem}-${n}`;
}

// What this layer has selected, deep-cloned. Returns how many, so the caller can say what
// happened; 0 means there was nothing to take and no key should appear to have done anything.
function clipCopy() {
    if (!doc) return 0;
    if (mode === 'props') {
        const rows = selProps.length ? selProps.slice() : selProp >= 0 ? [selProp] : [];
        if (!rows.length) return 0;
        const items = rows.sort((a, b) => a - b).map(i => dprops()[i]).filter(Boolean).map(clone);
        if (!items.length) return 0;
        clip = { mode, items, pastes: 0 };
        return items.length;
    }
    // The arena is excluded for the reason it cannot be duplicated either: there is exactly
    // one, and a second would not mean anything to a course.
    const objs = oselObjects().filter(o => o.ref.kind !== 'arena');
    if (!objs.length) return 0;
    clip = {
        mode,
        items: objs.map(o => clone(o.ref.kind === 'shape' ? o.land : regsOf(o.ref.kind)[o.ref.i])),
        pastes: 0
    };
    return clip.items.length;
}

// Copy, then remove — via the SAME delete paths the Delete key uses, so cut and delete can
// never disagree about what "the selection" means or what it leaves behind.
// ⚠️ REPORTS WHAT IT REMOVED, not what it copied, and the two can differ. Undo restores the
// document but leaves the selection pointing at whatever it was pointing at — so after
// undoing a paste, `osel` names a shape that is no longer in doc.shapes. Copy then finds
// nothing and returns 0, which is the honest answer; returning the COPY count here would
// have had the caller push an undo step and toast "Cut 1" for a cut that removed nothing.
// (Delete has the same dangling-selection behaviour and always has; this only makes sure cut
// does not lie about it.)
function clipCut() {
    if (!clipCopy()) return 0;
    if (mode === 'props') {
        const rows = (selProps.length ? selProps.slice() : [selProp]).sort((a, b) => b - a);
        let removed = 0;
        for (const r of rows) if (dprops()[r]) { dprops().splice(r, 1); removed++; }
        selProp = -1; selProps = []; listAnchor = listCursor = -1;
        return removed;
    }
    return deleteOsel();            // clears osel/vsel and re-syncs the inspectors itself
}

// The copies become the selection, as in every vector editor: you paste in order to go on
// working on what you pasted.
function clipPaste() {
    if (!doc || !clip || !clip.items.length) return 0;
    // FIRST, because setMode clears `osel` — building the new selection before the switch
    // would hand it straight back.
    if (mode !== clip.mode) setMode(clip.mode);

    // ── WHERE IT LANDS: THE MIDDLE OF WHAT YOU ARE LOOKING AT ───────────────
    //
    // `view.x, view.y` IS the world point at the centre of the canvas — read the transform:
    // toS puts it at W()/2, H()/2. So the paste is one translation that carries the
    // clipboard's own centre onto it.
    //
    // ONE translation for the whole clipboard, not one per object: pasting three islands has
    // to keep their formation, and a per-object nudge (which is what duplicate does, scaled
    // to each object's own size) shears the group apart.
    //
    // This replaced an offset from the ORIGINAL position, which had the failure the centre
    // rule exists to avoid: copy something, scroll across the map, paste — and the copy
    // appears back where you were, off screen, having apparently done nothing.
    //
    // REPEATS CASCADE RATHER THAN STACK. Dead centre every time would drop the second copy
    // exactly on the first, where two objects read as one and the only clue is the object
    // list's count. So the first paste into a given view lands dead centre and each further
    // paste into the SAME view steps down-right from it; move the view and the count resets,
    // because a new view is a new answer to "where am I looking".
    const centre = { x: view.x, y: view.y };
    if (!clip.at || Math.abs(clip.at.x - centre.x) > 1 || Math.abs(clip.at.y - centre.y) > 1) clip.pastes = 0;
    clip.at = centre;
    const step = (PASTE_STEP_PX / view.scale) * clip.pastes++;   // px -> world at this zoom
    const c = clipCentre();
    const dx = (centre.x + step) - (c ? c.cx : centre.x);
    const dy = (centre.y + step) - (c ? c.cy : centre.y);
    const shift = (ring) => ring.map(q => [q[0] + dx, q[1] + dy]);

    if (clip.mode === 'props') {
        const ps = doc.props || (doc.props = []);       // write path creates the array
        const first = ps.length;
        for (const src of clip.items) {
            const p = clone(src);
            p.id = freshId(p.id || 'prop-1', ps.map(x => x.id));
            p.x += dx; p.y += dy;
            ps.push(p);
        }
        selProps = clip.items.map((_, k) => first + k);
        selProp = selProps[selProps.length - 1];
        listAnchor = listCursor = -1;
        return clip.items.length;
    }

    // The NAME is kept as it was. A duplicate is a second one of something and says so
    // ("Bank 2"); a paste is the same thing put somewhere else, and renaming it would lose
    // the only label the designer wrote. The id still has to be unique, so that is what moves.
    const made = [];
    if (clip.mode === 'shape') {
        for (const src of clip.items) {
            const l = clone(src);
            l.id = freshId(l.id, doc.shapes.map(x => x.id));
            l.outer = shift(l.outer);
            l.holes = (l.holes || []).map(shift);
            rebake(l);
            doc.shapes.push(l);
            made.push({ kind: 'shape', id: l.id });
        }
    } else if (isRegionMode(clip.mode)) {
        // Same write-path rule addRegion follows: the container is created here, never by a
        // read accessor, or loading a document with no gusts would mark it unsaved.
        const owner = REGION[clip.mode].owner();
        const list = owner.regions || (owner.regions = []);
        for (const src of clip.items) {
            const r = clone(src);
            r.id = freshId(r.id, list.map(x => x.id));
            r.poly = shift(r.poly);
            list.push(r);
            made.push({ kind: clip.mode, i: list.length - 1 });
        }
    }
    if (!made.length) return 0;
    osel = made; vsel = [];
    syncSelFromOsel();
    return made.length;
}

// ── Booleans ────────────────────────────────────────────────────────────────
// Union / intersect / subtract over the object selection, via the vendored Martinez sweep
// (polygon-clipping). Rolling our own was the alternative and it is a trap: the degenerate
// cases — collinear edges, shared vertices, outlines that touch without crossing — are
// exactly what you produce by snapping two islands together and then unioning them.
//
// The library speaks MultiPolygon: [ Polygon, ... ], Polygon = [ outerRing, ...holeRings ],
// rings CLOSED (first point repeated last). Documents store rings OPEN and holes separately,
// so the conversion is the only fiddly part.
const toPC = (rings) => [rings.map(r => {
    const out = r.map(p => [p[0], p[1]]);
    out.push([r[0][0], r[0][1]]);            // the library wants the ring closed
    return out;
})];
const fromPCRing = (r) => {
    const out = r.map(p => [p[0], p[1]]);
    // Drop the repeated closing point: a document ring is open, and leaving it doubles a
    // vertex that every downstream point count would then be wrong about.
    if (out.length > 1) {
        const a = out[0], b = out[out.length - 1];
        if (a[0] === b[0] && a[1] === b[1]) out.pop();
    }
    return out;
};
// NOTE the naming. The library's `difference` is A minus B, which is our SUBTRACT; the
// symmetric difference — keep what exactly one of them covers — is its `xor`, and that is
// what "Difference" means alongside a Subtract that already exists. Internally it is
// `symdiff` so the two can never be read for each other.
const BOOL_OPS = { union: 'union', intersect: 'intersection',
                   subtract: 'difference', symdiff: 'xor', exclude: 'difference' };
const BOOL_LABEL = { union: 'Union', intersect: 'Intersect',
                     subtract: 'Subtract', symdiff: 'Difference', exclude: 'Exclude' };
// EXCLUDE IS SUBTRACT THAT KEEPS ITS CUTTERS. Same clip — the library's `difference`, primary
// minus the rest — but only the primary is consumed; every secondary survives untouched, in
// place, with its id, kind and z-order intact. That makes one shape usable as a stencil
// against many: cut a channel through a bank with three weed beds and you still have three
// weed beds, where Subtract would have eaten them and left you re-drawing.
//
// Two behaviours differ from the other four ops, both because the secondaries stay:
//   · the primary is replaced IN PLACE rather than pushed to the end of the list, so it does
//     not jump in front of the cutters it was just cut by. The other ops consume everything
//     they touch, so their stacking order is nobody's business; this one's is.
//   · an empty result is a legitimate answer meaning "the cutters covered the primary
//     entirely" — it deletes the primary and keeps the cutters, which is what was asked for.
//     For Subtract the same result would delete the whole selection, which is why it errors.
const BOOL_KEEPS_SECONDARIES = { exclude: true };
// `null` when it cannot run, so the caller can say WHY rather than doing nothing visibly.
function oselBooleanWhy() {
    if (!doc) return 'no document';
    if (!window.polygonClipping) return 'the clipping library did not load';
    if (osel.length < 2) return 'select two or more shapes first';
    const kinds = new Set(osel.map(o => o.kind));
    if (kinds.size > 1) return 'they must all be the same kind of object';
    if (kinds.has('arena')) return 'the arena is the course bounds, not a shape to combine';
    return null;
}
// osel is CLICK-ordered; oselObjects() re-sorts into DOCUMENT order. Any op that talks about
// "the primary" has to resolve it here, or "the first one selected" silently means "whichever
// of them the document happens to list first".
function oselByClickOrder(objs) {
    const out = [];
    for (const ref of osel) {
        const o = objs.find(x => sameObj(x.ref, ref));
        if (o && out.indexOf(o) < 0) out.push(o);
    }
    for (const o of objs) if (out.indexOf(o) < 0) out.push(o);   // anything osel did not name
    return out;
}
function oselBoolean(op) {
    if (oselBooleanWhy()) return null;
    // EXCLUDE keeps its cutters, so which shape is primary is a decision the user makes by
    // clicking rather than one the document makes by ordering — it takes click order. The
    // other four consume everything they touch, where the base only decides the surviving
    // id and z-slot, and they keep the document order they have always used.
    const keepSecondaries = !!BOOL_KEEPS_SECONDARIES[op];
    const objs = keepSecondaries ? oselByClickOrder(oselObjects()) : oselObjects();
    const geoms = objs.map(o => toPC(o.rings));
    let result;
    try {
        result = window.polygonClipping[BOOL_OPS[op]](geoms[0], ...geoms.slice(1));
    } catch (err) {
        return { error: `the outlines defeated the clipper (${err.message})` };
    }
    if (!result || !result.length) {
        // Intersecting two shapes that do not overlap is a legitimate question with an empty
        // answer. Deleting both of them is NOT the answer to it.
        //
        // Exclude is the exception and is NOT an error: an empty result means the cutters
        // covered the primary completely, and removing the primary while leaving the cutters
        // standing is precisely what was asked for. Subtract cannot say that, because there
        // the same result would take the whole selection with it.
        if (!keepSecondaries) {
            return { error: op === 'intersect' ? 'they do not overlap, so there is nothing in common'
                          : op === 'symdiff'  ? 'they cover exactly the same water, so nothing is left'
                                              : 'that would remove everything' };
        }
        result = [];
    }
    const base = objs[0];
    const made = [];
    if (base.ref.kind === 'shape') {
        const proto = base.land;
        const build = (poly, i) => {
            const l = clone(proto);
            l.id = i === 0 ? proto.id : uniqueLandId(`${proto.id}-${i + 1}`);
            if (proto.name && i > 0) l.name = `${proto.name} ${i + 1}`;
            l.outer = fromPCRing(poly[0]);
            l.holes = poly.slice(1).map(fromPCRing);
            rebake(l);
            return l;
        };
        if (keepSecondaries) {
            // In place, so the cut shape keeps the z-slot it had. Pushing it to the end would
            // float it in front of the very shapes that just cut it.
            const at = doc.shapes.findIndex(l => l.id === proto.id);
            const pieces = result.map(build);
            doc.shapes.splice(at, 1, ...pieces);
            for (const l of pieces) made.push({ kind: 'shape', id: l.id });
        } else {
            const keepIds = new Set(objs.map(o => o.ref.id));
            doc.shapes = doc.shapes.filter(l => !keepIds.has(l.id));
            result.forEach((poly, i) => {
                const l = build(poly, i);
                doc.shapes.push(l);
                made.push({ kind: 'shape', id: l.id });
            });
        }
        } else {
        const key = base.ref.kind;
        const list = regsOf(key);
        const proto = clone(list[base.ref.i]);
        const build = (poly, i) => {
            const r = clone(proto);
            r.id = i === 0 ? proto.id : `${proto.id}-${i + 1}`;
            r.poly = fromPCRing(poly[0]);
            return r;
        };
        if (keepSecondaries) {
            const at = base.ref.i;
            const pieces = result.map(build);
            list.splice(at, 1, ...pieces);
            pieces.forEach((_, i) => made.push({ kind: key, i: at + i }));
        } else {
            const drop = new Set(objs.map(o => o.ref.i));
            const kept = list.filter((_, i) => !drop.has(i));
            list.length = 0;
            for (const r of kept) list.push(r);
            result.forEach((poly, i) => {
                list.push(build(poly, i));
                made.push({ kind: key, i: list.length - 1 });
            });
        }
    }
    osel = made; vsel = [];
    clearRegSel();
    syncSelFromOsel();
    const holes = result.reduce((a, poly) => a + poly.length - 1, 0);
    return { pieces: made.length, holes, kept: keepSecondaries ? objs.length - 1 : 0 };
}
function uniqueLandId(want) {
    let id = want, n = 2;
    while (doc.shapes.some(l => l.id === id)) id = `${want}-${n++}`;
    return id;
}

function deleteOsel() {
    if (!doc || !osel.length) return 0;
    let n = 0;
    const lands = new Set(osel.filter(o => o.kind === 'shape').map(o => o.id));
    if (lands.size) {
        const before = doc.shapes.length;
        doc.shapes = doc.shapes.filter(l => !lands.has(l.id));
        n += before - doc.shapes.length;
    }
    // Index-keyed kinds go from the highest down, so an earlier removal cannot invalidate
    // a later index. The arena is not deletable — a course with no bounds is not a course.
    const idxOf = (k) => osel.filter(o => o.kind === k).map(o => o.i).sort((a, b) => b - a);
    for (const kind in REGION) {
        const list = regsOf(kind);
        for (const i of idxOf(kind)) if (list[i]) { list.splice(i, 1); n++; }
    }
    osel = []; vsel = [];
    clearRegSel();
    syncSelFromOsel();
    return n;
}

// Every ring a BRUSH may touch on this layer — all of them, not just the selected object's.
// A brush is a gesture on the water: what falls under the disc is what it acts on, which is
// how a brush works everywhere else and how these already worked for land. modeRings below
// is the other question — "which outline did you MEAN" — and that one needs a selection.
function brushRings() {
    if (!doc) return [];
    const out = [];
    if (mode === 'shape') {
        for (const l of doc.shapes) for (const ring of eachRing(l)) out.push({ ring, land: l });
        } else if (mode === 'boundary') {
        const bp = doc.world.boundary.poly;
        if (bp) out.push({ ring: bp, land: null });
    } else if (isRegionMode(mode)) {
        for (const r of regsOf(mode)) if (r.poly) out.push({ ring: r.poly, land: null });
    }
    return out;
}
const distToSeg = (px, py, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
};

// ── Roughen ─────────────────────────────────────────────────────────────────
// Random midpoint displacement (Fournier, Fussell & Carpenter, 1982): split an edge, push
// the new midpoint off it, halve the amount, repeat. Draw the big shape by hand, then paint
// the detail that makes it read as real.
//
// What makes it PAINTABLE rather than explosive is `detail`, a target edge length: an edge
// already at or under it is left alone. A brush runs on every mousemove frame, so without a
// floor one stroke would put thousands of points into a ring and straight into a planner
// that is cubic in vertex count. With one, a stroke converges — once everything under the
// disc is at target, painting more does nothing.
//
// H is the Hurst exponent: displacement scales as len^H rather than with len, which is what
// keeps the result from reading as even zigzag. Mandelbrot put real coastlines at fractal
// dimension ~1.25, so H = 2 - 1.25.
const ROUGH_H = 0.75;
const ROUGH_AMP = 0.22;        // displacement at the finest level, as a fraction of `detail`
function roughen(cx, cy, radius) {
    const r = radius || brush, r2 = r * r;
    const target = Math.max(20, detail);
    let changed = false;
    for (const { ring, land } of brushRings()) {
        const out = [];
        let touched = false;
        for (let i = 0; i < ring.length; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            out.push(a);                                  // keep the point itself, by identity
            const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
            const d2 = (mx - cx) ** 2 + (my - cy) ** 2;
            if (d2 > r2) continue;
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (len <= target) continue;                  // fine enough already — this is the floor
            const t = 1 - Math.sqrt(d2) / r;
            const w = t * t * (3 - 2 * t);                // the same smoothstep the other brushes use
            const amp = ROUGH_AMP * target * Math.pow(len / target, ROUGH_H) * w;
            const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;   // unit edge normal
            const k = (Math.random() * 2 - 1) * amp;
            out.push([mx + nx * k, my + ny * k]);
            touched = true;
        }
        if (!touched) continue;
        ring.length = 0;
        for (const p of out) ring.push(p);
        if (land) rebake(land);
        changed = true;
    }
    if (changed) vsel = [];        // indices shifted; a stale selection would lie
    return changed;
}

// ── Simplify ────────────────────────────────────────────────────────────────
// Roughen's inverse: drop the points the outline does not need. A point goes only if
// removing it moves the edge less than the tolerance — local Douglas-Peucker — so the shape
// survives and the stroke converges once nothing under the disc is redundant.
//
// Never two adjacent points in one pass. Collapsing a neighbouring pair together can eat a
// whole feature in a single frame, and at brush speed you would never see which one went.
function simplify(cx, cy, radius) {
    const r = radius || brush, r2 = r * r;
    const tol = Math.max(2, detail) * 0.5;
    let changed = false;
    for (const { ring, land } of brushRings()) {
        if (ring.length <= 3) continue;                   // the validator's floor: fewer is degenerate
        const drop = new Set();
        for (let i = 0; i < ring.length; i++) {
            if (ring.length - drop.size <= 3) break;
            if (drop.has((i - 1 + ring.length) % ring.length)) continue;
            const p = ring[i];
            const d2 = (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
            if (d2 > r2) continue;
            const t = 1 - Math.sqrt(d2) / r;
            const w = t * t * (3 - 2 * t);
            if (w <= 0.01) continue;
            const a = ring[(i - 1 + ring.length) % ring.length];
            const b = ring[(i + 1) % ring.length];
            if (distToSeg(p[0], p[1], a, b) < tol * w) drop.add(i);
        }
        if (!drop.size) continue;
        const kept = ring.filter((_, i) => !drop.has(i));
        ring.length = 0;
        for (const p of kept) ring.push(p);
        if (land) rebake(land);
        changed = true;
    }
    if (changed) vsel = [];
    return changed;
}

// Insert on the nearest EDGE of whatever the current mode owns — land rings, the arena
// outline, or a wind region. Same gesture everywhere.
function modeRings() {
    if (!doc) return [];
    if (mode === 'shape' && sel.shape) {
        const l = shapeById(sel.shape);
        return l ? eachRing(l).map(ring => ({ ring, land: l })) : [];
    }
    if (mode === 'boundary') {
        const bp = doc.world.boundary.poly;
        return bp ? [{ ring: bp, land: null }] : [];
    }
    if (activeReg()) return [{ ring: activeReg().poly, land: null }];
    return [];
}

// The same verb for a LANE. It cannot share insertVertexNear: that one walks closed rings
// (its last segment joins back to index 0) and works on `modeRings`, which knows nothing
// about traffic. A path has no closing segment, and inserting one would be a wrong answer
// rather than an off-by-one.
// The lane branch of the mousedown handler, factored out so the test harness can drive the
// same rules the mouse does rather than a parallel copy of them.
function _laneClick(wx, wy) {
    if (!pending) {
        const v = dtraffic()[selTraf];
        if (v && v.path.length) {
            const grab = 16 / view.scale, n = v.path.length;
            const dLast = Math.hypot(wx - tpx(v.path[n - 1]), wy - tpy(v.path[n - 1]));
            const dFirst = Math.hypot(wx - tpx(v.path[0]), wy - tpy(v.path[0]));
            if (Math.min(dLast, dFirst) < grab) {
                extendLane = { i: selTraf, atStart: dFirst < dLast };
                pending = [];
                return;
            }
        }
        pending = [];
    }
    pending.push([wx, wy]);
}

function insertTrafficPointNear(wx, wy) {
    const v = dtraffic()[selTraf];
    if (!v || v.path.length < 2) return false;
    let best = null;
    for (let i = 0; i < v.path.length - 1; i++) {       // no wrap: a lane is open
        const ax = tpx(v.path[i]), ay = tpy(v.path[i]);
        const bx = tpx(v.path[i + 1]), by = tpy(v.path[i + 1]);
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        let t = l2 ? ((wx - ax) * dx + (wy - ay) * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = ax + t * dx, py = ay + t * dy;
        const d = Math.hypot(wx - px, wy - py);
        if (!best || d < best.d) best = { d, i, px, py };
    }
    // Generous, because the CURVE bows away from the straight leg the maths measures
    // against — on a tight corner the line you are aiming at is not the line being tested.
    if (!best || best.d > 40 / view.scale) return false;
    // No speed on the new point: it INHERITS, which is what "add a point here" should mean.
    // Writing the interpolated speed would silently pin the ramp at a value nobody typed.
    v.path.splice(best.i + 1, 0, { x: best.px, y: best.py });
    selTV = best.i + 1;
    return true;
}

function insertVertexNear(wx, wy) {
    let best = null;
    for (const { ring, land } of modeRings()) {
        for (let i = 0; i < ring.length; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            const dx = b[0]-a[0], dy = b[1]-a[1], l2 = dx*dx+dy*dy;
            let t = l2 ? ((wx-a[0])*dx + (wy-a[1])*dy)/l2 : 0;
            t = Math.max(0, Math.min(1, t));
            const px = a[0]+t*dx, py = a[1]+t*dy;
            const d = Math.hypot(wx-px, wy-py);
            if (!best || d < best.d) best = { d, ring, i, px, py, land };
        }
    }
    if (best && best.d < 24 / view.scale) {
        best.ring.splice(best.i + 1, 0, [best.px, best.py]);
        if (best.land) rebake(best.land);
        vsel = [];                       // indices shifted; a stale selection would lie
        return true;
    }
    return false;
}

// Delete the SELECTION (falling back to whatever is hovered), from whichever mode owns
// it. Each ring keeps at least 3 points — fewer is degenerate and the validator rejects
// the document.
function deleteSelectedVertices() {
    if (!doc) return false;
    let refs = vsel.slice();
    if (!refs.length) {
        // `mode === 'vertex'` was left behind when the Vertices MODE became the Direct
        // TOOL; it could never be true, so the land fallback had been dead since.
        if (mode === 'shape' && hover.shape && hover.vert >= 0) {
            const l = shapeById(hover.shape);
            if (l && hover.vert < l.outer.length) refs = [{ kind: 'shape', id: l.id, ring: -1, i: hover.vert }];
        } else if (mode === 'boundary' && hover.bvert >= 0) {
            refs = [{ kind: 'arena', i: hover.bvert }];
        } else if (isRegionMode(mode) && hover.wvert >= 0 && regSel(mode) >= 0) {
            refs = [{ kind: mode, r: regSel(mode), i: hover.wvert }];
            }
    }
    if (!refs.length) return false;

    // Group by ring and remove from the highest index down, so earlier removals do not
    // invalidate later indices.
    const groups = new Map();
    for (const ref of refs) {
        const key = `${ref.kind}|${ref.id || ''}|${ref.ring}|${ref.r}`;
        if (!groups.has(key)) groups.set(key, { ref, idx: [] });
        groups.get(key).idx.push(ref.i);
    }
    let removed = 0;
    for (const { ref, idx } of groups.values()) {
        let ring = null, land = null;
        if (ref.kind === 'shape') {
            land = shapeById(ref.id);
            if (!land) continue;
            ring = ref.ring < 0 ? land.outer : (land.holes || [])[ref.ring];
        } else if (ref.kind === 'arena') ring = doc.world.boundary.poly;
        // Every region kind resolves through the one REGION table — gust was missing here,
        // so Delete on a gust region's corner did nothing at all.
        else if (REGION[ref.kind]) { const r = regsOf(ref.kind)[ref.r]; ring = r && r.poly; }
        if (!ring) continue;
        const keep = Math.max(0, ring.length - 3);
        const sorted = idx.slice().sort((a, b) => b - a).slice(0, keep);
        for (const i of sorted) { ring.splice(i, 1); removed++; }
        if (land) rebake(land);
    }
    vsel = [];
    return removed > 0;
}

// Redistribute a ring's vertices evenly along its own perimeter. Heavy sculpting
// bunches them up, which makes further editing feel sticky.
function resampleShape(l) {
    for (const ring of eachRing(l)) resampleRing(ring);
    rebake(l);
}
// One ring, evenly respaced along its own perimeter. Split out from resampleShape so the
// object-level command can run it over a wind region or a floe, which have no `l` to rebake.
function resampleRing(ring) {
    const n = ring.length;
    if (n < 4) return;
    // Cumulative arc length, then emit n points at k/n of the perimeter STARTING AT
    // ZERO. The previous version began emitting at one step in and clamped when it
    // ran off the end, so every application rotated the ring by a step and bunched
    // points at the seam — pressing the button twice visibly mangled the shape.
    const seg = [], cum = [0];
    let per = 0;
    for (let i = 0; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n];
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        seg.push(d); per += d; cum.push(per);
    }
    if (per <= 1e-9) return;
    const out = [];
    let i = 0;
    for (let k = 0; k < n; k++) {
        const target = (k / n) * per;
        while (i < n - 1 && cum[i + 1] < target) i++;
        const t = seg[i] > 0 ? (target - cum[i]) / seg[i] : 0;
        const a = ring[i], b = ring[(i + 1) % n];
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    ring.length = 0;
    for (const p of out) ring.push(p);
}
// Boundary as a RECTANGLE matching the painted map. This is the whole point of a
// polygon arena: a circle inscribed in a square map throws away its corners (21% of
// Glacier Sound), and a circle that circumscribes it admits empty off-map water. A
// rect does neither.
function boundaryToRect(inset) {
    const half = doc.world.size / 2 - (inset || 0);
    const b = doc.world.boundary;
    b.poly = window.Arena.rectPoly(0, 0, half, half);
    // `circle` is dropped: with a polygon it is no longer what bounds the arena, and
    // keeping a stale one would leave the uniform-sampling fast path describing the
    // wrong shape.
    b.circle = null;
}

// Scale the WHOLE map about the origin: land, marks and the boundary together.
// Replaces editing MASK_WORLD, which silently rescaled every derived number.
// Prop sprites do not scale with it — accepted.
function scaleMap(k) {
    // The start line's LENGTH is set by the fleet, not by the geography: ten boats
    // need about 1100u or lane neighbours end up closer than a hull width and the
    // start jams structurally. So scaling the map MOVES the line but must not
    // shrink it. Scaling it too dropped the tightest lane gap to 43u against a 60u
    // hull at 60% — which the fleet-spread check reported immediately, and is the
    // reason this special case exists.
    const marks = doc.course.marks;
    let keepLen = null, dirx = 0, diry = 0;
    if (marks.length >= 2) {
        const dx = marks[1].x - marks[0].x, dy = marks[1].y - marks[0].y;
        keepLen = Math.hypot(dx, dy);
        dirx = dx / (keepLen || 1); diry = dy / (keepLen || 1);
    }

    // EVERYTHING scales, or the map is no longer the same map: every shape, every mark,
    // every rounding's zone and the size of what it stands at, and the wind and current
    // regions with their falloff bands. Leaving any of them behind silently changes the
    // course — ice that no longer fits its channel, a region that no longer covers water.
    //
    // ONE loop over the shapes. There used to be two, one for land and one for ice, and
    // when the two arrays became one they both ran over it — scaling to 50% gave 25%.
    for (const l of doc.shapes) {
        transformShape(l, (x, y) => ({ x: x*k, y: y*k }));
        // An AUTHORED ramp is a length across the map, like a prop's collider radius and a
        // region's falloff, so it scales with everything else — a bar on a 60% course wants
        // a 60% approach or its rim stops matching its size. An inherited one needs nothing:
        // it comes from the kind at compile time, and the compiler's own clamp to half the
        // radius shrinks it for free.
        if (l.feather != null) l.feather *= k;
    }
    for (const m of doc.course.marks) { m.x *= k; m.y *= k; }
    // Props scale WITH the course: position, sprite size (via `scale`, which the traits
    // also fold into the default collider) and any authored collider radius — a 60%
    // course keeps palms that fit its beaches and coral heads that fit their colliders.
    for (const p of (doc.props || [])) {
        p.x *= k; p.y *= k;
        p.scale = Math.max(0.25, Math.min(4, (p.scale || 1) * k));
        if (p.contactR != null) p.contactR *= k;   // an authored radius is a length like any other
    }
    for (const e of doc.course.route) {
        if (e.zone) e.zone *= k;
        if (e.radius) e.radius *= k;
    }
    for (const r of wregs().concat(cregs(), gregs())) {
        r.poly = r.poly.map(p => [p[0] * k, p[1] * k]);
        if (r.falloff) r.falloff *= k;
    }

    if (keepLen !== null) {
        // Re-lay at the original length about the scaled midpoint, preserving
        // vertex ORDER — the order sets the crossing normal, and reversing it puts
        // the fleet on the wrong side of its own start line.
        const mx = (marks[0].x + marks[1].x) / 2, my = (marks[0].y + marks[1].y) / 2;
        marks[0].x = mx - dirx * keepLen / 2; marks[0].y = my - diry * keepLen / 2;
        marks[1].x = mx + dirx * keepLen / 2; marks[1].y = my + diry * keepLen / 2;
    }
    if (doc.world.sceneryMargin) doc.world.sceneryMargin *= k;
    doc.world.size *= k;
    if (doc.world.boundary.circle) {
        doc.world.boundary.circle.x *= k; doc.world.boundary.circle.y *= k; doc.world.boundary.circle.r *= k;
    }
    if (doc.world.boundary.poly) {
        doc.world.boundary.poly = doc.world.boundary.poly.map(p => [p[0]*k, p[1]*k]);
        doc.world.boundary.circle = null;      // the poly is the arena; no stale twin
    }
}

// Turn the WHOLE map about the origin. The sibling of scaleMap, and it has to touch one
// thing scaling does not: the WIND.
//
// A course is laid on its breeze — the start line square to it, the beat running up it — so
// rotating the geometry without rotating the wind turns a windward-leeward into a reach and
// puts the fleet on the wrong side of its own start line. Scaling is exempt because a
// uniform scale preserves every angle; a rotation preserves none of them, so every stored
// DIRECTION turns with the map: each wind region's mean and each current region's flow.
//
// Lengths are untouched, so there is no start-line special case here: a rotation is rigid,
// and the line comes out the length it went in. Zones and falloffs likewise.
function rotateMap(deg) {
    const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const rot = (x, y) => ({ x: x * cs - y * sn, y: x * sn + y * cs });
    const rotRing = (ring) => ring.map(p => { const q = rot(p[0], p[1]); return [q.x, q.y]; });

    for (const l of doc.shapes) transformShape(l, rot);
    for (const m of doc.course.marks) { const q = rot(m.x, m.y); m.x = q.x; m.y = q.y; }
    // Props turn with the map — position AND heading, the way a region's direction does.
    // A leaning palm aimed over the water before the rotation leans over it after.
    for (const p of (doc.props || [])) {
        const q = rot(p.x, p.y);
        p.x = q.x; p.y = q.y;
        p.heading = normDir((p.heading || 0) + a);
    }
    for (const r of wregs().concat(cregs(), gregs())) {
        r.poly = rotRing(r.poly);
        // The region's own heading, in the same convention everything else uses.
        if (r.direction != null) r.direction = normDir(r.direction + a);
    }
    if (doc.world.boundary.poly) {
        doc.world.boundary.poly = rotRing(doc.world.boundary.poly);
        doc.world.boundary.circle = null;      // the poly is the arena; no stale twin
    } else if (doc.world.boundary.circle) {
        const c = doc.world.boundary.circle, q = rot(c.x, c.y);
        c.x = q.x; c.y = q.y;                  // a circle turns into itself; only its centre moves
    }
}
// Bearings stay in [0, 2pi) so the inspector never shows 400 degrees or a negative one.
const normDir = (r) => ((r % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

// ── Mouse ───────────────────────────────────────────────────────────────────
let lastMouse = null;

// Middle mouse pans regardless of the active tool: reaching for a Pan tool to move
// around is the kind of friction that makes an editor tiring to use.
cv.addEventListener('auxclick', (e) => { if (e.button === 1 || e.button === 2) e.preventDefault(); });
// RIGHT BUTTON PANS. A laptop trackpad has no middle button, so middle-drag was a gesture
// most people could not make. The editor has no context menus of its own (they were dropped
// deliberately), so the OS one is suppressed across the WHOLE document — not just the
// canvas — and right-drag means the same thing wherever the pointer happens to be.
document.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect();
    const w = toW(e.clientX - r.left, e.clientY - r.top);
    if (e.button === 1 || e.button === 2) {
        e.preventDefault();
        drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
        cv.classList.add('dragging');
        return;
    }
    if (e.button !== 0) return;

    // A LANE IS OPEN, so there is no closing click — Enter or double-click ends it. Falling
    // through to the ring branch below would let a click near the first point close a path
    // into a loop, which for a shipping lane is not a shortcut, it is a wrong answer.
    if (mode === 'traffic' && drawing && doc) {
        // FIRST CLICK ON AN END OF THE SELECTED LANE RESUMES IT, the way a pen tool picks up
        // an open path rather than starting a second one beside it. Anywhere else, this is a
        // new lane. Only on the first click: once points are down, the gesture is committed.
        const was = extendLane;
        _laneClick(w.x, w.y);
        if (extendLane && !was) toast(extendLane.atStart ? 'Extending the start of the lane'
                                                        : 'Extending the end of the lane');
        draw();
        return;
    }
    if ((mode === 'shape' || isRegionMode(mode)) && drawing && doc) {
        if (!pending) pending = [];
        // Clicking the first point closes the shape — the gesture people reach for before
        // they find Enter, and the preview lights that point up to promise it. The radius is
        // in SCREEN pixels and matches the one the preview highlights at, so what you see
        // lit is exactly what will close.
        if (pending.length >= 3
            && Math.hypot(w.x - pending[0][0], w.y - pending[0][1]) < 12 / view.scale) {
            commitPending();
            return;
        }
        pending.push([w.x, w.y]);
        draw();
        return;
    }
    if (sub === 'measure' && boatProbe) {
        // The SAME controls as a land shape: drag to move, Cmd/Ctrl+drag to rotate. A
        // bespoke handle on the bow was one more thing to learn for no reason.
        const grab = Math.max(BOAT_L * 0.6, 16 / view.scale);
        if (Math.hypot(w.x - boatProbe.x, w.y - boatProbe.y) < grab) {
            drag = (e.metaKey || e.ctrlKey)
                ? { kind: 'boatrot', start: boatProbe.heading, from: w }
                : { kind: 'boatmove', last: w };
            return;
        }
    }
    if (sub === 'measure') {
        // Shift EXTENDS the path on screen; a plain drag starts a new one. A course is
        // measured leg by leg, so the multi-point case is the common one.
        if (e.shiftKey && measure && measure.pts.length >= 2) {
            measure.pts.push(w);
            drag = { kind: 'measure', origin: w };
        } else {
            measure = { pts: [w, w] };
            drag = { kind: 'measure', origin: w };
        }
        draw();
        return;
    }
    // A BRUSH wins over every grab below it. With one armed, the disc is what the pointer
    // means — grabbing a single vertex out from under it would be the tool changing its mind
    // based on where you happened to press.
    if (doc && isBrush(sub) && brushRings().length) {
        drag = { kind: sub, last: w, moved: false, origin: w };
        return;
    }
    // ── OBJECT level ────────────────────────────────────────────────────────
    // The Select arrow acts on whole polygons. Venue and Arena keep their own gestures for
    // now (placing ice, sizing the bounds), so they are not routed through here.
    if (doc && sub === 'drag' && !drawing
        && (mode === 'shape' || isRegionMode(mode) || mode === 'boundary')) {
        const o = hitObject(w.x, w.y);
        if (o) {
            // Shift toggles. A plain click on something ALREADY selected keeps the whole
            // selection, so dragging a group does not collapse it to the one you grabbed.
            if (e.shiftKey) osel = inOsel(o.ref) ? osel.filter(x => !sameObj(x, o.ref)) : osel.concat([o.ref]);
            else if (!inOsel(o.ref)) osel = [o.ref];
            vsel = [];
            syncSelFromOsel();
            drag = { kind: (e.metaKey || e.ctrlKey) ? 'orotate' : e.altKey ? 'oscale' : 'omove',
                     last: w, start: w, centre: oselCentre(), moved: false, origin: w };
            refreshChrome(); info(); draw(); return;
        }
        if (!e.shiftKey) { osel = []; vsel = []; syncSelFromOsel(); }
        marquee = { a: w, b: w, add: e.shiftKey, level: 'object' };
        drag = { kind: 'marquee', add: e.shiftKey };
        refreshChrome(); draw(); return;
    }
    // PLACE: the only gesture that creates a floe, and it creates one wherever you drag —
    // on top of an existing floe included, which is how you build a dense field.
    if (mode === 'shape' && doc && sub === 'place') {
        osel = []; vsel = []; iceRefresh(); refreshChrome();
        drag = { kind: 'icenew', origin: w, r: 0 };
        draw(); return;
    }
    // Direct on this layer is handled with the rest of the shape gestures below, near the
    // vertex drag it starts. A floe-only copy of it used to sit here and swallow the click
    // for the whole layer — it named its vertices `{kind:'ice'}`, a ref `vertexArray` has
    // no case for, so even the drag it did start moved nothing.
    if (doc) {
        const hr = hit(w.x, w.y);
        if (hr.rcentre >= 0) { drag = { kind: 'rcentre', li: hr.rcentre, last: w, moved: false, origin: w }; return; }
        if (hr.rring >= 0)   { drag = { kind: 'rring',   li: hr.rring,   moved: false, origin: w }; return; }
    }
    // Region outlines — wind, current AND gust, through the one REGION table. Through
    // `vsel` like every other outline: a bespoke one-vertex drag used to start here and
    // select nothing, so Delete had nothing to act on and removed the whole region.
    if (doc && sub === 'direct' && isRegionMode(mode) && regSel(mode) >= 0) {
        const hw = hit(w.x, w.y);
        if (hw.wvert >= 0) {
            const ref = { kind: mode, r: regSel(mode), i: hw.wvert };
            if (e.shiftKey) {
                vsel = inSel(ref) ? vsel.filter(v => !sameRef(v, ref)) : vsel.concat([ref]);
                refreshChrome(); draw(); return;
            }
            if (!inSel(ref)) vsel = [ref];
            drag = { kind: 'vsel', last: w, moved: false, origin: w };
            refreshChrome(); draw(); return;
        }
    }
    if (doc && sub === 'direct') {
        const hb = hit(w.x, w.y);
        if (hb.bvert >= 0) {
            // Through `vsel`, like every other outline. It used to start a bespoke one-vertex
            // drag and select nothing, so Delete had nothing to act on and a marquee could
            // never include an arena corner.
            const ref = { kind: 'arena', i: hb.bvert };
            if (e.shiftKey) {
                vsel = inSel(ref) ? vsel.filter(v => !sameRef(v, ref)) : vsel.concat([ref]);
                refreshChrome(); draw(); return;
            }
            if (!inSel(ref)) vsel = [ref];
            drag = { kind: 'vsel', last: w, moved: false, origin: w };
            refreshChrome(); draw(); return;
        }
    }
    if (mode === 'boundary' && doc && !doc.world.boundary.poly) {
        // Only with NO polygon: then a drag sets the circle's radius. WITH one, the arena is
        // an outline like any other — the object block above moves it, and falling through
        // from here is what lets Direct draw a marquee over its corners.
        drag = { kind: 'bcircle', moved: false };
        return;
    }

    const h = hit(w.x, w.y);
    if (mode === 'marks' && doc) {
        if (h.mark >= 0) {
            selectMark(h.mark);
            drag = { kind: 'mark', i: h.mark, last: w, moved: false, origin: w };
        } else if (h.line >= 0) {
            selectLine(h.line);
            // Dragging a gate moves the WHOLE gate: both marks together, which is what
            // "move the gate 50 m left" means.
            drag = { kind: 'line', i: h.line, last: w, moved: false, origin: w };
        } else {
            sel = Object.assign({}, NOHIT); selLine = -1;
            marksInspector();
        }
        draw(); return;
    }
    if (mode === 'traffic' && doc) {
        const grab = 10 / view.scale;
        // A HANDLE FIRST, then the lane. The points sit ON the line they define, so testing
        // the line first would make a waypoint ungrabbable.
        if (selTraf >= 0 && dtraffic()[selTraf]) {
            const v = dtraffic()[selTraf];
            for (let k = 0; k < v.path.length; k++) {
                if (Math.hypot(w.x - tpx(v.path[k]), w.y - tpy(v.path[k])) < grab) {
                    selTV = k;
                    drag = { kind: 'tvert', last: w, moved: false, origin: w };
                    inspectorRefresh(); objRefresh(); refreshChrome(); draw();
                    return;
                }
            }
        }
        // Then the lanes themselves, nearest first.
        let hitI = -1, hitBest = Infinity;
        dtraffic().forEach((v, i) => {
            if (!v.path || v.path.length < 2) return;
            const c = trafficCurve(v);
            const N = c ? Math.max(24, Math.min(300, Math.round(c.length / 30))) : 0;
            for (let k = 0; k <= N; k++) {
                const q = c.atArc(c.length * k / N);
                const d = Math.hypot(w.x - q.x, w.y - q.y);
                if (d < hitBest && d < 14 / view.scale) { hitBest = d; hitI = i; }
            }
        });
        if (hitI >= 0) {
            if (hitI !== selTraf) selTV = -1;
            selTraf = hitI;
            drag = { kind: 'tmove', last: w, moved: false, origin: w };
        } else {
            selTraf = -1; selTV = -1;
        }
        inspectorRefresh(); objRefresh(); refreshChrome(); draw();
        return;
    }
    if (mode === 'props' && doc) {
        // Click a prop: select it and start a move. Click open map: PLACE one of the
        // panel's kind — placement is the whole workflow here (scattering thirty palms
        // along a beach), so it costs one click, and a miss costs one Undo.
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        let hitI = -1, best = Infinity;
        dprops().forEach((p, i) => {
            const k = reg[p.kind];
            if (!k) return;
            const r = Math.max(8 / view.scale, (k.world || 40) * (p.scale || 1) / 2);
            const d = Math.hypot(w.x - p.x, w.y - p.y);
            if (d < r && d < best) { best = d; hitI = i; }
        });
        if (hitI >= 0) {
            // Grabbing a prop already in a multi-selection keeps the group (so a plain
            // drag moves all of it, same as shapes); grabbing an unselected one takes it
            // alone. Shift toggles membership like the map does for shapes.
            if (e.shiftKey) {
                selProps = selProps.includes(hitI) ? selProps.filter(x => x !== hitI) : selProps.concat([hitI]);
                selProp = hitI;
                refreshInspector(); objRefresh(); draw();
                return;
            }
            if (!selProps.includes(hitI)) selProps = [hitI];
            selProp = hitI;
            refreshInspector();
            // The SAME modifiers as a polygon: plain drag moves (the whole selection),
            // Cmd/Ctrl+drag rotates, Alt+drag scales — about the prop's own position,
            // which is a point object's "shared centre". One grammar everywhere.
            drag = (e.metaKey || e.ctrlKey)
                 ? { kind: 'proprot',   i: hitI, last: w, moved: false }
                 : e.altKey
                 ? { kind: 'propscale', i: hitI, last: w, moved: false }
                 : { kind: 'prop',      i: hitI, last: w, moved: false };
        } else if (sub === 'place' && reg[($('prop-kind') || {}).value]) {
            // PLACE ARMED: a tap puts one here, a drag sizes the circle a stand fills. Deferred
            // to pointer-up, because which of the two it is only becomes known when the gesture
            // ends.
            drag = { kind: 'propnew', origin: w, r: 0 };
        } else {
            // SELECT: empty water is marquee territory, the same as on every other layer. This
            // is what placing-on-click used to cost — with creation bound to the arrow there
            // was nowhere left for a box, so props had no multi-select at all.
            marquee = { a: w, b: w, add: e.shiftKey, level: 'props' };
            drag = { kind: 'marquee', add: e.shiftKey };
        }
        draw(); return;
    }
    if (mode === 'route' && doc) {
        // In ROUTE mode the map is an INDEX, not a canvas: clicking a gate or a mark adds
        // a leg that uses it, and nothing here can move or reshape anything. Editing
        // geometry while ordering it was how a route edit ended up dragging an island.
        if (h.line >= 0) {
            const ln = dlines()[h.line];
            if (ln) { addToRoute(`line:${ln.id}`, 'through'); afterEdit(true, 'add leg'); toast(`Added a leg: ${lineLabel(ln.id)}`); }
            return;
        }
        if (h.mark >= 0) {
            const m = dmarksOf()[h.mark];
            if (m) { addToRoute(`mark:${m.id}`); afterEdit(true, 'add leg'); toast(`Added a leg: round ${markLabel(h.mark)}`); }
            return;
        }
        drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
        cv.classList.add('dragging');
        return;
    }
    if (mode === 'shape' && doc && h.shape && h.vert >= 0) {
        // Which ring the hit vertex belongs to, so the ref is unambiguous.
        const l = shapeById(h.shape);
        let ref = null;
        if (l) {
            if (h.vert < l.outer.length) ref = { kind: 'shape', id: l.id, ring: -1, i: h.vert };
            else {
                let rest = h.vert - l.outer.length;
                (l.holes || []).some((hr, hi) => {
                    if (rest < hr.length) { ref = { kind: 'shape', id: l.id, ring: hi, i: rest }; return true; }
                    rest -= hr.length; return false;
                });
            }
        }
        if (ref) {
            if (e.shiftKey) {
                // Shift toggles membership rather than starting a drag.
                vsel = inSel(ref) ? vsel.filter(v => !sameRef(v, ref)) : vsel.concat([ref]);
                refreshChrome(); draw(); return;
            }
            if (!inSel(ref)) vsel = [ref];
            sel = { shape: h.shape, mark: -1, vert: h.vert };
            drag = { kind: 'vsel', last: w, moved: false, origin: w };
            refreshChrome(); draw(); return;
        }
    }
    // Direct on a BODY selects that shape so its points appear — the white arrow's job in
    // every vector editor. Moving and rotating the shape itself belong to the black arrow.
    if (mode === 'shape' && !drawing && doc && sub === 'direct') {
        if (h.shape) {
            if (sel.shape !== h.shape) {
                sel = Object.assign({}, NOHIT, { shape: h.shape });
                osel = [{ kind: 'shape', id: h.shape }];
                vsel = [];
                refreshInspector();
            }
            info(); refreshChrome(); draw(); return;
        }
        if (!sel.shape) {
            sel = Object.assign({}, NOHIT);
            osel = [];
            refreshInspector();
            info();
        }
    }
    // Empty space in a mode that owns vertices starts a MARQUEE. Middle mouse is always
    // pan, so left-drag is free for selection — which is the point of the mouse model.
    if (doc && sub === 'direct'
        && ((mode === 'shape' && sel.shape) || mode === 'boundary'
            || (isRegionMode(mode) && regSel(mode) >= 0))) {
        marquee = { a: w, b: w, add: e.shiftKey, level: 'vertex' };
        drag = { kind: 'marquee', add: e.shiftKey };
        return;
    }
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    cv.classList.add('dragging');
});

window.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    let w = toW(sx, sy);
    // Shift constrains to the dominant axis, measured from where the drag STARTED so the
    // constraint does not flip about as the pointer wanders.
    if (e.shiftKey && drag && drag.origin) {
        const dx = w.x - drag.origin.x, dy = w.y - drag.origin.y;
        w = Math.abs(dx) >= Math.abs(dy) ? { x: w.x, y: drag.origin.y } : { x: drag.origin.x, y: w.y };
    }
    lastMouse = { sx, sy, w };

    if (drag) {
        if (drag.kind === 'pan') {
            view.x = drag.vx - (e.clientX - drag.sx) / view.scale;
            view.y = drag.vy - (e.clientY - drag.sy) / view.scale;
            draw();
        } else if (drag.kind === 'boatmove') {
            boatProbe.x += w.x - drag.last.x; boatProbe.y += w.y - drag.last.y;
            drag.last = w; boatInfo(); draw();
        } else if (drag.kind === 'boatrot') {
            // Rotate by the angle the pointer has swept about the boat, like a shape.
            const a0 = Math.atan2(drag.from.x - boatProbe.x, -(drag.from.y - boatProbe.y));
            const a1 = Math.atan2(w.x - boatProbe.x, -(w.y - boatProbe.y));
            boatProbe.heading = drag.start + (a1 - a0);
            boatInfo(); draw();
        } else if (drag.kind === 'icenew' || drag.kind === 'propnew') {
            drag.r = Math.hypot(w.x - drag.origin.x, w.y - drag.origin.y);
            draw();
        } else if (drag.kind === 'measure') {
            measure.pts[measure.pts.length - 1] = w; draw();
        } else if (drag.kind === 'bcircle') {
            const b = doc.world.boundary;
            const cx = b.circle ? b.circle.x : 0, cy = b.circle ? b.circle.y : 0;
            const rad = Math.max(200, Math.hypot(w.x - cx, w.y - cy));
            b.circle = { x: cx, y: cy, r: rad };
            drag.moved = true; draw();
        } else if (drag.kind === 'marquee') {
            marquee.b = w; draw();
        } else if (drag.kind === 'vsel') {
            // One vertex snaps to its neighbours' axes; a multi-vertex drag does not,
            // because "which of the six is aligned with what" has no useful answer.
            if (vsel.length === 1) {
                const p0 = vertexArray(vsel[0]);
                if (p0) w = snapPoint(w, snapCandidates(vsel[0]));
            } else snapGuide = null;
            const dx = w.x - drag.last.x, dy = w.y - drag.last.y;
            for (const ref of vsel) {
                const p = vertexArray(ref);
                if (p) { p[0] += dx; p[1] += dy; }
            }
            rebakeTouched();
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'tvert') {
            const v = dtraffic()[selTraf];
            if (v && v.path[selTV]) tpSet(v.path[selTV], w.x, w.y);
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'tmove') {
            // The whole lane, keeping its shape. Repositioning a shipping lane bodily is
            // the common edit once its shape is right — "same route, 400 units further off
            // the mark" — and dragging seven waypoints one at a time is not that edit.
            const v = dtraffic()[selTraf];
            const dx = w.x - drag.last.x, dy = w.y - drag.last.y;
            if (v) for (const q of v.path) tpSet(q, tpx(q) + dx, tpy(q) + dy);
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'rcentre') {
            // Moves the MARK, and only the mark. It used to move the land shape when the
            // rounding referenced one, which meant dragging the course dragged the island.
            const e = doc.course.route[drag.li];
            const mi = markIndex(e.markId);
            const m = dmarksOf()[mi];
            if (m) { m.x = w.x; m.y = w.y; }
            livePathRefresh();
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'rring') {
            const e = doc.course.route[drag.li];
            const cm = (course.route[drag.li] || {}).mark;
            if (cm) {
                // Never smaller than the thing being rounded, or the rounding could be
                // satisfied without going round anything.
                const minR = (cm.radius || 12) * 1.05 + 40;
                e.zone = Math.max(minR, Math.hypot(w.x - cm.x, w.y - cm.y));
                cm.zone = e.zone;
            }
            livePathRefresh();
            drag.moved = true; draw();
        } else if (drag.kind === 'sculpt') {
            sculpt(w.x, w.y, w.x - drag.last.x, w.y - drag.last.y);
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'smooth') {
            smooth(w.x, w.y, 0.35); drag.moved = true; draw();
        } else if (drag.kind === 'omove') {
            const dx = w.x - drag.last.x, dy = w.y - drag.last.y;
            oselTransform((x, y) => ({ x: x + dx, y: y + dy }));
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'orotate') {
            const C = drag.centre;
            const a0 = Math.atan2(drag.last.y - C.y, drag.last.x - C.x);
            const a1 = Math.atan2(w.y - C.y, w.x - C.x);
            const da = a1 - a0, cs = Math.cos(da), sn = Math.sin(da);
            oselTransform((x, y) => ({ x: C.x + (x - C.x) * cs - (y - C.y) * sn,
                                       y: C.y + (x - C.x) * sn + (y - C.y) * cs }));
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'oscale') {
            const C = drag.centre;
            const d0 = Math.hypot(drag.last.x - C.x, drag.last.y - C.y) || 1;
            const d1 = Math.hypot(w.x - C.x, w.y - C.y) || 1;
            const k = Math.max(0.2, Math.min(5, d1 / d0));
            oselTransform((x, y) => ({ x: C.x + (x - C.x) * k, y: C.y + (y - C.y) * k }));
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'roughen' || drag.kind === 'simplify') {
            // `moved` only when something actually changed: both converge, so the tail of a
            // stroke does nothing, and an undo entry for nothing is an undo that does nothing.
            const did = drag.kind === 'roughen' ? roughen(w.x, w.y) : simplify(w.x, w.y);
            if (did) drag.moved = true;
            drag.last = w; draw();
        } else if (drag.kind === 'vertex') {
            const l = shapeById(drag.shape);
            for (const ring of eachRing(l)) {
                if (drag.vert < ring.length) { ring[drag.vert][0] = w.x; ring[drag.vert][1] = w.y; break; }
            }
            rebake(l); drag.moved = true; draw();
        } else if (drag.kind === 'prop') {
            // By DELTA, not snap-to-cursor, so a group keeps its arrangement while it moves.
            const dx = w.x - drag.last.x, dy = w.y - drag.last.y;
            const rows = selProps.includes(drag.i) ? selProps : [drag.i];
            for (const r of rows) {
                const p = dprops()[r];
                if (p) { p.x += dx; p.y += dy; }
            }
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'proprot') {
            // Same maths as 'orotate', with the prop's position as the centre: heading
            // follows the pointer's angular sweep around the palm, so the frond you
            // grabbed stays under the cursor.
            const p = dprops()[drag.i];
            if (p) {
                const a0 = Math.atan2(drag.last.y - p.y, drag.last.x - p.x);
                const a1 = Math.atan2(w.y - p.y, w.x - p.x);
                p.heading = ((p.heading || 0) + (a1 - a0) + Math.PI * 2) % (Math.PI * 2);
            }
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'propscale') {
            // Same maths as 'oscale'. Clamped like the polygon clamp, and floored well
            // above zero — a prop scaled to nothing is invisible AND unclickable, which
            // is a deletion you cannot see and cannot undo by eye.
            const p = dprops()[drag.i];
            if (p) {
                const d0 = Math.hypot(drag.last.x - p.x, drag.last.y - p.y) || 1;
                const d1 = Math.hypot(w.x - p.x, w.y - p.y) || 1;
                p.scale = Math.max(0.25, Math.min(4, (p.scale || 1) * (d1 / d0)));
            }
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'mark') {
            doc.course.marks[drag.i].x = w.x; doc.course.marks[drag.i].y = w.y;
            livePathRefresh();
            drag.moved = true; draw();
        } else if (drag.kind === 'line') {
            const ln = dlines()[drag.i];
            const ends = ln && lineEnds(ln.id);
            if (ends) {
                const dx = w.x - drag.last.x, dy = w.y - drag.last.y;
                for (const m of ends) { m.x += dx; m.y += dy; }
            }
            livePathRefresh();
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'zone') {
            const rEntry = doc.course.route.find(x => x.kind === 'round');
            if (rEntry) {
                rEntry.zone = Math.max(80, Math.hypot(w.x - course.roundMark.x, w.y - course.roundMark.y));
                course.roundMark.zone = rEntry.zone;
            }
            drag.moved = true; draw();
        } else if (drag.kind === 'move') {
            const l = shapeById(drag.shape);
            translateShape(l, w.x - drag.last.x, w.y - drag.last.y);
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'rotate') {
            const l = shapeById(drag.shape);
            const a0 = Math.atan2(drag.last.y - drag.centre.y, drag.last.x - drag.centre.x);
            const a1 = Math.atan2(w.y - drag.centre.y, w.x - drag.centre.x);
            const da = a1 - a0, cs = Math.cos(da), sn = Math.sin(da), C = drag.centre;
            transformShape(l, (x, y) => ({
                x: C.x + (x - C.x) * cs - (y - C.y) * sn,
                y: C.y + (x - C.x) * sn + (y - C.y) * cs
            }));
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'scale') {
            const l = shapeById(drag.shape), C = drag.centre;
            const d0 = Math.hypot(drag.last.x - C.x, drag.last.y - C.y) || 1;
            const d1 = Math.hypot(w.x - C.x, w.y - C.y) || 1;
            const k = Math.max(0.2, Math.min(5, d1 / d0));
            transformShape(l, (x, y) => ({ x: C.x + (x - C.x) * k, y: C.y + (y - C.y) * k }));
            drag.last = w; drag.moved = true; draw();
        }
    } else {
        const h = hit(w.x, w.y);
        if (h.shape !== hover.shape || h.vert !== hover.vert || h.mark !== hover.mark
            || h.line !== hover.line
            || h.bvert !== hover.bvert || h.wvert !== hover.wvert
            || h.rcentre !== hover.rcentre || h.rring !== hover.rring) { hover = h; draw(); }
        // A brush follows the cursor, and so does the rubber band of a shape being drawn.
        // Without this the preview only repainted on CLICK, so the band pointed at wherever
        // you last pressed rather than at where you are about to.
        else if (isBrush(tool) || (drawing && pending && pending.length)) draw();
    }

    $('hud').textContent = `${Math.round(uToM(w.x))}, ${Math.round(uToM(w.y))} m`
        + (isBrush(tool) ? `  ·  brush ${Math.round(uToM(brush))} m` : '')
        // The scale the brush works AT is the number you actually tune, so show it.
        + (tool === 'roughen'  ? `  ·  detail ${Math.round(uToM(Math.max(20, detail)))} m` : '')
        + (tool === 'simplify' ? `  ·  tol ${Math.round(uToM(Math.max(2, detail) * 0.5))} m` : '');
    $('hud-zoom').textContent = `${view.scale.toFixed(3)}×`;
    fieldProbe();
});

// ── What the weather is doing UNDER THE CURSOR ──────────────────────────────
// Wind and current at the mouse, bottom-right of the map — shown whenever a field
// layer (wind, gusts, current) or a field overlay is active, because that is when the
// numbers on the water are the thing being authored. Sampled from the MEAN field
// (gusts parked, oscillation pinned), exactly as the field overlays draw it, so the
// probe and the arrows never disagree.
function fieldProbe() {
    const el = $('field-probe');
    if (!el) return;
    const active = isRegionMode(mode) || showField || showCurField;
    if (!doc || !active || !lastMouse || typeof getWindAt !== 'function') { el.hidden = true; return; }
    const { x, y } = lastMouse.w;
    const g = state.gusts, d0 = state.wind.direction;
    state.gusts = []; state.wind.direction = state.wind.baseDirection;
    let wf = null, cf = null;
    try {
        wf = getWindAt(x, y);
        if (typeof getCurrentAt === 'function') cf = getCurrentAt(x, y);
    } finally {
        state.gusts = g; state.wind.direction = d0;
    }
    const deg3 = (d) => String(degOf(d)).padStart(3, '0');
    const rows = [];
    rows.push(wf && wf.speed > 0.05
        ? `wind <b>${wf.speed.toFixed(1)} kt</b> from ${deg3(wf.direction)}°`
        : 'wind <b>calm</b>');
    rows.push(cf && cf.speed > 0.005
        ? `current <b>${cf.speed.toFixed(2)} kt</b> toward ${deg3(cf.direction)}°`
        : 'current <b>slack</b>');
    el.innerHTML = rows.join('<br>');
    el.hidden = false;
}

window.addEventListener('mouseup', () => {
    cv.classList.remove('dragging');
    snapGuide = null;
    if (!drag) return;
    const d = drag; drag = null;
    if ((d.kind === 'tvert' || d.kind === 'tmove')) {
        if (d.moved) afterEdit(true, d.kind === 'tvert' ? 'move waypoint' : 'move lane');
        return;
    }
    if (d.kind === 'marquee' && marquee) {
        const x0 = Math.min(marquee.a.x, marquee.b.x), x1 = Math.max(marquee.a.x, marquee.b.x);
        const y0 = Math.min(marquee.a.y, marquee.b.y), y1 = Math.max(marquee.a.y, marquee.b.y);
        const tiny = (x1 - x0) * view.scale < 4 && (y1 - y0) * view.scale < 4;
        const level = marquee.level || 'vertex';
        let hits = [];
        if (level === 'object') {
            // TOUCH semantics, as in Illustrator: a box that grazes a shape takes it. On a
            // coastline that fills the view, "fully enclosed" would select almost nothing.
            const objs = modeObjects().filter(o => o.rings.some(ring =>
                ring.some(q => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1)));
            const refs = objs.map(o => o.ref);
            osel = marquee.add ? osel.concat(refs.filter(rf => !inOsel(rf))) : refs;
            vsel = [];
            syncSelFromOsel();
        } else if (level === 'props') {
            // A prop is a POINT, so "in the box" is its position. Its sprite may overhang and
            // that is right: you are picking the thing, not its picture.
            const idx = [];
            dprops().forEach((p, i) => {
                if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) idx.push(i);
            });
            const add = marquee.add;
            marquee = null;
            // A CLICK on empty water clears the selection, which is what it means everywhere
            // else in the editor. Creation lives on Place now, so this is free to mean it.
            selProps = tiny && !add ? []
                     : add ? selProps.concat(idx.filter(i => !selProps.includes(i))) : idx;
            selProp = selProps.length ? selProps[selProps.length - 1] : -1;
            listAnchor = listCursor = -1;
            refreshInspector(); objRefresh(); refreshChrome(); draw();
            return;
        } else {
            hits = modeVertexRefs().filter(v => v.x >= x0 && v.x <= x1 && v.y >= y0 && v.y <= y1)
                                   .map(({ kind, id, ring, i, r }) => ({ kind, id, ring, i, r }));
            vsel = marquee.add ? vsel.concat(hits.filter(h => !inSel(h))) : hits;
        }
        marquee = null;
        // A CLICK on empty water — not a drag — means "deselect", which is what it means
        // everywhere else. Without this, selecting a shape left no way to unselect it
        // except Escape, because empty water had become marquee territory.
        if (tiny && level === 'vertex' && !hits.length && !d.add) {
            if (mode === 'shape') { sel = Object.assign({}, NOHIT); osel = []; refreshInspector(); info(); }
        }
        refreshChrome(); draw();
        return;
    }
    if (d.kind === 'propnew') {
        const tap = d.r * view.scale < 4;
        const n = addProps(d.origin.x, d.origin.y, d.r, tap ? 1 : null);
        if (!n) return;
        afterEdit(true, n === 1 ? 'place prop' : `place ${n} props`);
        if (n > 1) toast(`${n} props placed · ${fmtM(d.r * 2)} across`);
        return;
    }
    if (d.kind === 'icenew') {
        // A tap with no drag still means "put ice here", at a sensible default size.
        const r = d.r > mToU(6) ? d.r : mToU(30);
        const n = addIce(d.origin.x, d.origin.y, r);
        afterEdit(true, 'add ice');
        toast(`${n} floe${n === 1 ? '' : 's'} placed · ${fmtM(r * 2)} across`);
        return;
    }
    // ONE undo entry per drag, not one per mousemove. Both snapshot and command
    // undo need this; it is what makes a sculpt stroke a single action.
    // The boat probe is a RULER, not part of the document: moving it is not an edit.
    if (d.kind === 'boatmove' || d.kind === 'boatrot') return;
    if (d.moved && d.kind !== 'pan' && d.kind !== 'measure') afterEdit(true, d.kind);
});

cv.addEventListener('dblclick', (e) => {
    if (drawing && pending) { commitPending(); return; }
    if (!doc) return;
    // Inserting a vertex is a DIRECT-arrow gesture, on whatever layer owns outlines.
    // This used to ask for `sub === 'drag'`, which WAS the vertex sub-tool before Select and
    // Direct were split apart — so afterwards it fired under the object arrow on land and
    // never fired under the vertex one. No mode list here: modeRings() already returns
    // nothing for a layer with no selected outline, so it gates itself.
    const r = cv.getBoundingClientRect();
    const w = toW(e.clientX - r.left, e.clientY - r.top);
    // A LANE TAKES THE GESTURE UNDER EITHER ARROW. On the shape layers Direct is what
    // separates "the polygon" from "its vertices", so the gesture has to be told which you
    // mean. Traffic has no such split — a lane is only ever edited as a lane — so demanding
    // the Direct arrow first would be a rule with nothing behind it.
    if (mode === 'traffic') {
        if (insertTrafficPointNear(w.x, w.y)) {
            afterEdit(true, 'insert waypoint');
            toast('Waypoint added — it inherits its speed until you give it one');
        }
        return;
    }
    if (sub !== 'direct') return;
    if (insertVertexNear(w.x, w.y)) afterEdit(true, 'insert vertex');
});

cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const before = toW(e.clientX - r.left, e.clientY - r.top);
    view.scale = Math.max(0.005, Math.min(4, view.scale * Math.exp(-e.deltaY * 0.0015)));
    const after = toW(e.clientX - r.left, e.clientY - r.top);
    view.x += before.x - after.x; view.y += before.y - after.y;
    draw();
}, { passive: false });

// ── Keyboard ────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (e.key === 'Enter' && !doc && lastHandle) { reopenLast(); return; }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // Shift makes it Save As; a plain Save with nothing dirty is a no-op.
        if (doc && (e.shiftKey || isDirty())) save(e.shiftKey);
        return;
    }
    if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); openFile(); return; }
    if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const n = oselDuplicate();
        if (n) { afterEdit(true, n === 1 ? 'duplicate' : `duplicate ${n}`);
                 toast(`Duplicated ${n} — the ${n === 1 ? 'copy is' : 'copies are'} now selected`); }
        return;
    }
    // ── Cut / Copy / Paste ──────────────────────────────────────────────────
    // These MUST come before the bare-letter keys at the bottom of this handler, which bind
    // C to the current field and V and N to tools without testing for a modifier. They each
    // return, so the fall-through cannot fire both.
    //
    // A thing worth saying out loud: copy does NOT go through afterEdit, because copying
    // changes nothing. Cut and paste do, so both are one undo away.
    if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const n = clipCopy();
        toast(n ? `Copied ${n}` : 'Nothing selected to copy', !n);
        return;
    }
    if (mod && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        const n = clipCut();
        if (n) { afterEdit(true, n === 1 ? 'cut' : `cut ${n}`); toast(`Cut ${n}`); }
        else toast('Nothing selected to cut', true);
        return;
    }
    if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (!clip || !clip.items.length) { toast('Nothing on the clipboard', true); return; }
        // Named by layer, because paste may have just switched layers to land the content
        // where it belongs — being told which one is the difference between a helpful jump
        // and things appearing somewhere you were not looking.
        const where = (LAYERS.find(L => L.mode === clip.mode) || {}).name || clip.mode;
        const n = clipPaste();
        if (n) { afterEdit(true, n === 1 ? 'paste' : `paste ${n}`);
                 toast(`Pasted ${n} into ${where} — ${n === 1 ? 'it is' : 'they are'} now selected`); }
        return;
    }
    // ⚠️ NEW IS BEST-EFFORT AND THE BUTTON IS THE RELIABLE PATH. Chrome and Firefox reserve
    // Cmd/Ctrl+N for a new browser window and never deliver it to the page, so this fires
    // only where the browser has let go of it (a standalone/installed window, some Linux
    // builds). It is wired anyway because it costs one line and does the right thing wherever
    // it does arrive — but it must not be the only way to reach New, and it isn't.
    if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); newDoc(); return; }
    // Arrows walk the active layer's list; Shift+arrow EXTENDS the selection from its
    // anchor, the way every list tool does it. The row scrolled into view is the row
    // the cursor just landed on. Only when a layer HAS a list — on the others the keys
    // fall through untouched.
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !mod && !e.altKey) {
        if (moveListSel(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey)) {
            const on = $('obj-list') && $('obj-list').querySelector('.ob.on');
            if (on) on.scrollIntoView({ block: 'nearest' });
            e.preventDefault();
            return;
        }
    }
    // Z cycles the selection through its overlap stack; Shift+Z the other way.
    if (e.key.toLowerCase() === 'z' && !mod) {
        cycleZ(e.shiftKey ? -1 : 1);
        return;
    }
    // R on a selected prop: rotate in 15° steps, Shift-R the other way. A drag handle for
    // one angle on a mostly-radial sprite is more chrome than the gesture deserves.
    if (e.key.toLowerCase() === 'r' && mode === 'props' && selProp >= 0 && !mod) {
        const p = dprops()[selProp];
        if (p) {
            p.heading = ((p.heading || 0) + (e.shiftKey ? -1 : 1) * Math.PI / 12 + Math.PI * 2) % (Math.PI * 2);
            afterEdit(true, 'rotate prop');
        }
        return;
    }
    // B, while the ruler is up: a boat to scale, for judging whether a gap fits one. A key
    // rather than a checkbox — the ruler has no panel, and reaching across the window for a
    // toggle broke the rhythm of measuring anyway.
    if (e.key.toLowerCase() === 'b' && sub === 'measure') {
        boatProbe = boatProbe ? null
            : { x: view.x, y: view.y, heading: windBase() + Math.PI };   // pointing away from the wind
        hintBar(); draw();
        return;
    }
    if (e.key.toLowerCase() === 'w') { showField = !showField; syncFieldButtons(); fieldProbe(); draw(); return; }
    if (e.key.toLowerCase() === 'c' && !mod) { showCurField = !showCurField; syncFieldButtons(); fieldProbe(); draw(); return; }
    if (e.key === '[') { brush = Math.max(40, brush / 1.25); draw(); return; }
    if (e.key === ']') { brush = Math.min(4000, brush * 1.25); draw(); return; }
    // Shift+[ ] — the scale the brush works at, as distinct from how far it reaches. Two
    // separate things: a broad stroke laying down fine detail is the normal case.
    if (e.key === '{') { detail = Math.max(20, detail / 1.25); draw(); return; }
    if (e.key === '}') { detail = Math.min(4000, detail * 1.25); draw(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!doc) return;
        // A LEG is deleted like anything else: select it, press Delete. The geometry it
        // referred to is untouched — the route is only an ordering of what is on the water.
        if (mode === 'route' && selRoute >= 0) {
            const rr = routeOf();
            if (rr[selRoute]) {
                rr.splice(selRoute, 1);
                if (selRoute >= rr.length) selRoute = rr.length - 1;
                afterEdit(true, 'delete leg');
            }
            return;
        }
        // Marks and gates are deleted HERE, on the water — never as a side effect of a
        // route edit, since the route is only an ordering of them.
        if (mode === 'marks') {
            if (sel.mark >= 0) { deleteMark(sel.mark); return; }
            if (selLine >= 0) { deleteLine(selLine); return; }
        }
        // A WAYPOINT FIRST, if one is in hand — the same "vertices before the object" rule
        // the shape layer follows below. Only with no point selected does Delete take the
        // whole vessel.
        if (mode === 'traffic' && selTraf >= 0) {
            const v = dtraffic()[selTraf];
            if (v && selTV >= 0) {
                if (v.path.length <= 2) { toast('A lane needs at least two points', true); return; }
                // ⚠️ CARRY THE SPEED FORWARD. Points inherit the last speed named before
                // them, so removing one that NAMED a speed silently changes the speed of
                // every point after it — and removing point 0, which is where a new lane's
                // only speed lives, left a document with no speed anywhere and no visible
                // reason why. Pin the next point to what was in force, and the profile is
                // exactly what it was minus one corner.
                const eff = tpSpeedAt(v, selTV);
                const next = v.path[selTV + 1];
                if (next && !isFinite(tpSpeed(next))) {
                    if (Array.isArray(next)) next[2] = eff; else next.speed = eff;
                }
                v.path.splice(selTV, 1);
                selTV = Math.min(selTV, v.path.length - 1);
                afterEdit(true, 'delete waypoint');
                return;
            }
            if (v) {
                dtraffic().splice(selTraf, 1);
                selTraf = -1; selTV = -1;
                afterEdit(true, 'delete vessel');
                return;
            }
        }
        if (mode === 'props' && (selProps.length || selProp >= 0)) {
            // Delete means the whole selection, exactly as it does for shapes.
            const rows = (selProps.length ? selProps.slice() : [selProp]).sort((a, b) => b - a);
            for (const r of rows) dprops().splice(r, 1);
            const n = rows.length;
            selProp = -1; selProps = []; listAnchor = listCursor = -1;
            afterEdit(true, n === 1 ? 'delete prop' : `delete ${n} props`);
            return;
        }
        // Vertices first: if some are selected, THEY are what Delete means. Only with none
        // selected does Delete remove the whole object.
        // ⚠️ With VERTICES selected, Delete means vertices — and it stops there even when it
        // removes none. It used to fall through to the object branch below, so pressing
        // Delete on a triangle's corner (where the 3-point floor refuses) deleted the WHOLE
        // SHAPE instead. "The floor saved the ring" must not become "so we took the polygon".
        if (vsel.length) {
            if (deleteSelectedVertices()) { afterEdit(true, 'delete vertices'); return; }
            toast('A ring needs at least 3 points — nothing left to remove here', true);
            return;
        }
        // Whole objects, however many are selected. Delete means "the thing you have", and
        // at the object level that can be three islands at once.
        if (osel.length) {
            const n = deleteOsel();
            if (n) { afterEdit(true, n === 1 ? 'delete shape' : `delete ${n} shapes`); return; }
        }

        if (mode === 'shape' && sel.shape && deleteSelectedShape()) afterEdit(true, 'delete shape');
        return;
    }
    if (e.key === 'Enter' && pending) { commitPending(); return; }
    if (e.key === 'Escape' && pending) { pending = null; draw(); return; }
    // A measurement is deliberately sticky so you can make precise edits against it —
    // so it needs an explicit way out.
    // Esc cancels the measurement; a second Esc puts the ruler down.
    if (e.key === 'Escape' && measure) { measure = null; draw(); return; }
    if (e.key === 'Escape' && sub === 'measure') { pickTool('select'); return; }
    // Escape clears whatever is selected, in any mode.
    if (e.key === 'Escape' && (sel.shape || sel.mark >= 0 || selLine >= 0 || selRoute >= 0
                               || selProp >= 0 || selProps.length || vsel.length || osel.length)) {
        sel = Object.assign({}, NOHIT); selLine = -1; selRoute = -1; selProp = -1;
        selProps = []; listAnchor = listCursor = -1;
        vsel = []; osel = [];
        refreshInspector(); marksInspector(); iceRefresh(); refreshChrome(); draw(); return;
    }
    // Gusts takes 0 rather than 6, pushing the rest along: these keys are muscle memory and
    // the digits have never matched the layer column's order anyway (1 is Objects, which
    // sits fourth). Renumbering four layers to seat one new arrival is the worse trade.
    const modes = { '1': 'shape', '2': 'marks', '3': 'route', '4': 'boundary',
                    '5': 'wind', '6': 'current', '7': 'venue', '8': 'map', '9': 'water',
                    '0': 'gust' };
    if (modes[e.key]) { setMode(modes[e.key]); return; }
    // T for Traffic. The digits are full and renumbering them to seat one arrival is the
    // worse trade — the same argument the block above makes for gusts taking 0.
    if (e.key === 't' || e.key === 'T') { setMode('traffic'); return; }
    // Tool keys, routed through pickTool and gated by the SAME `enabled` predicate the strip
    // uses — so a key can never arm a tool the button next to it shows as unavailable. This
    // also wires V, P and M, which the strip has been advertising in its tooltips all along.
    const keyTool = { v: 'select', d: 'select', a: 'direct', p: 'draw', n: 'place',
                      s: 'sculpt', g: 'smooth', r: 'roughen', e: 'simplify', m: 'measure' };
    const id = keyTool[e.key.toLowerCase()];
    if (id) {
        const t = TOOLS.find(x => x.id === id);
        if (t && (!t.enabled || t.enabled())) pickTool(id);
    }
});

// Right panel: Overview and Checks are separate panes. The course stats, legend and
// route are what you look at while working; the checks are what you consult. Stacking
// them meant the stats were always pushed off the top.
// The checks live in a drawer under the stats band: they are what you consult, not what you
// keep on screen, and the tally is always visible whether it is open or not.
$('btn-drawer').addEventListener('click', () => {
    const d = $('drawer');
    d.hidden = !d.hidden;
    $('tally-chev').style.transform = d.hidden ? '' : 'rotate(180deg)';
});

// ── Wire up ─────────────────────────────────────────────────────────────────
// Switching mode clears what that mode owned. A shape left selected in Land mode kept its
// inspector populated and its outline lit while you were editing something else entirely.
function setMode(next) {
    // Leaving a layer that supported the active tool for one that does not: fall back to
    // Select rather than leaving a tool armed that cannot act on anything here. The ruler is
    // exempt — it works everywhere, so switching layer while measuring keeps the ruler.
    if (next === 'map' && sub !== 'measure') { sub = 'drag'; drawing = false; }
    if (mode === 'shape' && next !== 'shape') { sel = Object.assign({}, NOHIT); refreshInspector(); }
    if (mode === 'marks' && next !== 'marks' && next !== 'route') {
        sel = Object.assign({}, NOHIT); selLine = -1; marksInspector();
    }
    if (mode === 'props' && next !== 'props') { selProp = -1; selProps = []; }
    if (mode === 'traffic' && next !== 'traffic') { selTraf = -1; selTV = -1; }
    listAnchor = listCursor = -1;   // row numbering belongs to one list at a time
    mode = next;
    // Asked AFTER the switch, because whether a brush still has anything to act on is a
    // question about the layer you have arrived at, not the one you left.
    if (isBrush(sub) && !brushRings().length) sub = 'drag';
    if (sub === 'direct' && !modeObjects().length) sub = 'drag';
    if (sub === 'place' && next !== 'venue') sub = 'drag';
    drawing = false; pending = null; extendLane = null; vsel = []; osel = []; marquee = null;
    refreshChrome(); fieldProbe(); draw();
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
// The boat's numbers belong beside the boat, not in a panel across the window: you are
// looking at the hull to judge whether it fits, so that is where your eye already is. Kept as
// a function because the drag handlers call it; the label itself is painted by drawBoatProbe.
function boatInfo() { draw(); }
function boatLabel() {
    if (!boatProbe) return [];
    // Against the wind, because "does it fit" and "can it point there" are usually the
    // same question. windBase points dead upwind, so TWA is the angle off that.
    const twa = Math.abs(((boatProbe.heading - windBase() + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const twaDeg = Math.round(twa * 180 / Math.PI);
    return [`${BOAT_L / 5} m × ${(BOAT_B / 5).toFixed(1)} m — a J111`,
            `heading ${degOf(boatProbe.heading)}° · ${twaDeg}° off the wind`
                + `${twaDeg < 38 ? ' — inside the no-go zone' : ''}`,
            `ring ${(BOAT_L * 3) / 5} m, three hull lengths`];
}
$('btn-align-x').addEventListener('click', () => { if (alignSel('x')) afterEdit(true, 'align X'); });
$('btn-align-y').addEventListener('click', () => { if (alignSel('y')) afterEdit(true, 'align Y'); });
// Selection commands. Each reports what it did, because "Duplicate" over six shapes and
// over one look identical afterwards unless something says which happened.
$('btn-sel-dup').addEventListener('click', () => {
    const n = oselDuplicate();
    if (n) { afterEdit(true, n === 1 ? 'duplicate' : `duplicate ${n}`);
             toast(`Duplicated ${n} — the ${n === 1 ? 'copy is' : 'copies are'} now selected`); }
});
$('btn-sel-resample').addEventListener('click', () => {
    const n = oselResample();
    if (n) { afterEdit(true, n === 1 ? 'resample' : `resample ${n}`);
             toast(`Respaced the points on ${n} ${n === 1 ? 'object' : 'objects'}`); }
});
// Booleans REPLACE what was selected with what came out, and the result is what stays
// selected — so a union you dislike is one undo away and a subtract you meant to chain can
// be chained. Each says what it produced, because "3 shapes -> 2 shapes with a hole" is not
// something you can read off the map at a glance.
for (const [id, op] of [['btn-sel-union', 'union'], ['btn-sel-intersect', 'intersect'],
                        ['btn-sel-subtract', 'subtract'], ['btn-sel-exclude', 'exclude'],
                        ['btn-sel-symdiff', 'symdiff']]) {
    $(id).addEventListener('click', () => {
        const why = oselBooleanWhy();
        if (why) { toast(why, true); return; }
        const n = osel.length;
        const r = oselBoolean(op);
        if (!r) return;
        if (r.error) { toast(r.error, true); draw(); return; }
        afterEdit(true, op);
        // Exclude reports on the PRIMARY alone — "4 → 2 shapes" would be a lie about an op
        // that only ever touches one of them — and names the survivors so it is obvious at a
        // glance that this was not Subtract.
        const holes = r.holes ? ` with ${r.holes} hole${r.holes === 1 ? '' : 's'}` : '';
        if (r.kept) {
            const cut = r.pieces === 0 ? 'primary fully covered, removed'
                                       : `primary → ${r.pieces} ${r.pieces === 1 ? 'shape' : 'shapes'}${holes}`;
            toast(`${BOOL_LABEL[op]}: ${cut}; ${r.kept} kept as ${r.kept === 1 ? 'it was' : 'they were'}`);
        } else {
            toast(`${BOOL_LABEL[op]}: ${n} → ${r.pieces} ${r.pieces === 1 ? 'shape' : 'shapes'}${holes}`);
        }
    });
}
$('btn-sel-del').addEventListener('click', () => {
    const n = deleteOsel();
    if (n) { afterEdit(true, n === 1 ? 'delete shape' : `delete ${n} shapes`);
             toast(`Deleted ${n}`); }
});
$('btn-undo').addEventListener('click', undo);
$('btn-redo').addEventListener('click', redo);
$('btn-new').addEventListener('click', newDoc);
$('btn-open').addEventListener('click', openFile);
$('btn-save').addEventListener('click', () => save(false));
$('btn-saveas').addEventListener('click', () => save(true));
$('btn-fit').addEventListener('click', fitView);
// One region covering the whole arena: the consistent way to say "the wind over this course
// differs from the venue default" as a single editable object, rather than having a base-wind
// control and regions competing to describe the same thing. Draw cannot replace this — it is
// a click, not a rectangle traced round the entire map.
// One rectangle over the whole map, for whichever region layer asked. The pad differs by
// kind for one reason: a WIND region has to reach past the arena or the particles drawn
// outside it blow in a calm, while a current or a gust source only has to cover water
// anyone sails on.
const WHOLE_COURSE = {
    wind:    { pad: 400, msg: 'Whole-course region added — it starts neutral, so give it a direction' },
    current: { pad: 200, msg: 'Current over the whole course — set which way it sets on the right' },
    // A gust source over everything is the uniform scatter made VISIBLE and editable: on
    // its own it reproduces what the venue already did, and it exists so a second, denser
    // source can be drawn beside it and mean something relative to it.
    gust:    { pad: 200, msg: 'Puffs born everywhere — as before, but now you can draw a hotter source beside it' },
    // Legal but almost never what a designer wants — rapids are the most local thing in
    // the document — so the message says what to do with it rather than pretending
    // whole-course whitewater is a plan.
    rapids:  { pad: 200, msg: 'Rapids over the whole course — probably shrink this to the broken water itself' }
};
function addWholeCourseRegion(kind) {
    if (!doc) return;
    const e2 = window.Arena.extent(course.boundary);
    const pad = WHOLE_COURSE[kind].pad;
    addRegion(kind, [[e2.minX - pad, e2.minY - pad], [e2.maxX + pad, e2.minY - pad],
                     [e2.maxX + pad, e2.maxY + pad], [e2.minX - pad, e2.maxY + pad]]);
    afterEdit(true, `whole-course ${kind}`);
    toast(WHOLE_COURSE[kind].msg);
}
function addWholeCourseWind() { addWholeCourseRegion('wind'); }

// ── Arena ──────────────────────────────────────────────────────────────────
$('btn-brect').addEventListener('click', () => {
    if (!doc) return;
    // An inset pulls the sailing limit INSIDE the painted map, which is what leaves
    // land beyond it for a sailor at the edge to look at.
    const insetM = parseFloat($('brect-inset').value) || 0;
    boundaryToRect(mToU(insetM)); afterEdit(true, 'boundary rect');
    toast(insetM ? `Arena set to the map rect, inset ${insetM} m` : 'Arena set to the map rectangle');
});
// ── Whole map ──────────────────────────────────────────────────────────────
$('btn-scalemap').addEventListener('click', () => {
    if (!doc) return;
    const pct = parseFloat($('scalemap').value);
    if (!isFinite(pct) || pct <= 0) { toast('Enter a percentage', true); return; }
    scaleMap(pct / 100); afterEdit(true, 'scale map');
});

$('btn-rotmap').addEventListener('click', () => {
    if (!doc) return;
    const deg = parseFloat($('rotmap').value);
    if (!isFinite(deg)) { toast('Enter an angle in degrees', true); return; }
    if (!(deg % 360)) { toast('That is a full turn — nothing would move'); return; }
    rotateMap(deg); afterEdit(true, 'rotate map');
    toast(`Turned the map ${deg}°, wind and all`);
});

// ── Field previews: top-level, because "what is the weather doing here" is a question you
//    have while editing anything, not only while editing the weather.
function syncFieldButtons() {
    $('btn-field-wind').classList.toggle('btn-primary', showField);
    $('btn-field-cur').classList.toggle('btn-primary', showCurField);
}
$('btn-field-wind').addEventListener('click', () => {
    showField = !showField; syncFieldButtons(); fieldProbe(); draw();
});
$('btn-field-cur').addEventListener('click', () => {
    showCurField = !showCurField; syncFieldButtons(); fieldProbe(); draw();
});

$('btn-add-mark').addEventListener('click', () => {
    if (!doc) return;
    const id = addMark('inflatable'); afterEdit(true, 'add mark');
    toast(`Added ${id} — drag it, name it, or add a leg for it in Route`);
});
$('btn-add-line').addEventListener('click', () => {
    if (!doc) return;
    const id = addLine(); afterEdit(true, 'add gate');
    toast(`Added ${lineLabel(id)} — no leg uses it yet; add one in Route`);
});

// ── Route ──────────────────────────────────────────────────────────────────

// ── Course identity and timing ─────────────────────────────────────────────
// Blank means "absent", which means the default — so a document that says nothing about
// timing races exactly as it did before these fields existed.
const timeField = (id, key, lo, hi, what) => $(id).addEventListener('change', () => {
    if (!doc) return;
    const raw = $(id).value.trim();
    if (!raw) { delete doc.course[key]; afterEdit(true, key); toast(`${what} back to the default`); return; }
    const v = parseFloat(raw);
    if (!isFinite(v) || v < lo || v > hi) { toast(`${what} must be ${lo}–${hi} s`, true); info(); return; }
    doc.course[key] = v;
    afterEdit(true, key);
});
timeField('course-start', 'startTime', 5, 600, 'Prestart');
timeField('course-cutoff', 'cutoff', 30, 7200, 'Time limit');
// The card copy LIVES IN THE FILE (`doc.card`) — name, tag, blurb, conditions,
// hazards, exactly the strings the clubhouse shows. Blank means "not authored":
// the field is deleted rather than saved empty, and the venue key stands in
// wherever a name is needed.
const cardField = (id, key, label) => {
    $(id).addEventListener('change', () => {
        if (!doc) return;
        const v = $(id).value.trim();
        if (!doc.card) doc.card = {};
        if (v) doc.card[key] = v; else delete doc.card[key];
        afterEdit(true, label);
        const vl = $('venue-label');
        if (vl) vl.textContent = venueName(doc.venue);
    });
};
cardField('course-name', 'name', 'card name');
cardField('card-tag', 'tag', 'card tag');
cardField('card-blurb', 'blurb', 'card description');
cardField('card-conditions', 'conditions', 'card conditions');
cardField('card-hazards', 'hazards', 'card hazards');

// The PROVISIONAL RECORD is a time, not copy, and lives with the records
// (`doc.records.provisional`), not on the card. Accepts m:ss, m:ss.t or bare
// seconds; blank clears it. The field re-renders the canonical form on commit so
// what you typed and what got stored can never quietly differ.
$('card-provisional').addEventListener('change', () => {
    if (!doc) return;
    const raw = $('card-provisional').value.trim();
    let secs = null;
    const m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(raw);
    if (m) secs = (+m[1]) * 60 + (+m[2]);
    else if (/^\d+(?:\.\d+)?$/.test(raw)) secs = +raw;
    if (secs != null && secs > 0) {
        doc.records = doc.records || {};
        doc.records.provisional = Math.round(secs * 1000) / 1000;
    } else if (doc.records) {
        delete doc.records.provisional;
        if (!Object.keys(doc.records).length) delete doc.records;
    }
    afterEdit(true, 'provisional record');
    info();
});
$('btn-use-est').addEventListener('click', () => {
    const secs = suggestedCutoff();
    if (!doc || !secs) return;
    doc.course.cutoff = secs;
    afterEdit(true, 'cutoff from estimate');
    toast(`Limit set to ${mmss(secs)} — twice the best time round the course`);
});

// ── Current regions ────────────────────────────────────────────────────────
// One stream over the whole course, the counterpart of the wind's. Draw (P) makes any other
// shape, so this is the only current-specific creation left.
function addWholeCourseCurrent() { addWholeCourseRegion('current'); }

// ── Water colour ───────────────────────────────────────────────────────────
// heroColor is what the venue picker shows when a venue's signature water differs from
// its open water (today: the lagoon). It is BY DEFINITION the on-screen blend of a
// shallows zone — SHALLOWS_ALPHA of shallowColor over baseColor — so on documents that
// carry it, the editor recomputes it whenever either parent moves rather than offering
// it as a swatch: a hand-picked heroColor drifts from what the water actually looks
// like, which is the one thing it exists to show. Documents without one keep not having
// one — the field is a venue's deliberate opt-in, not a default.
function deriveHeroColor() {
    const p = doc && doc.palette;
    if (!p || !p.heroColor) return;
    const live = window.WATER_CONFIG || {};
    const rgb = (h) => {
        const s = String(h || '').replace('#', '');
        return /^[0-9a-f]{6}$/i.test(s) ? [0, 2, 4].map(i => parseInt(s.substring(i, i + 2), 16)) : null;
    };
    const sh = rgb(p.shallowColor || live.shallowColor), ba = rgb(p.baseColor || live.baseColor);
    if (!sh || !ba) return;
    const a = (typeof SHALLOWS_ALPHA !== 'undefined') ? SHALLOWS_ALPHA : 0.72;
    p.heroColor = '#' + sh.map((c, i) =>
        Math.round(c * a + ba[i] * (1 - a)).toString(16).padStart(2, '0')).join('');
}
// Were the puff tints DERIVED from the water they are sitting on, or hand-picked? The
// difference decides whether moving the water is allowed to take them with it. Measured
// rather than flagged, because the document records no such flag: recompute what this
// document's CURRENT water would derive and compare. Equal means the block is a frozen
// derivation and is stale the moment the water moves; different means somebody tuned it and
// it is not the editor's to throw away — hit "Derive from surface" to reset those on purpose.
function gustsAreDerived() {
    const dp = (doc && doc.palette) || {};
    if (!dp.gusts || !(dp.baseColor || dp.deepColor)) return false;
    const live = window.WATER_CONFIG || {};
    const d = gustTintFrom({
        baseColor: dp.baseColor || live.baseColor,
        deepColor: dp.deepColor || live.deepColor
    });
    if (!d) return false;
    return Object.values(GUST_KEYS).every(k => {
        const a = dp.gusts[k], b = d[k];
        return Array.isArray(a) && Array.isArray(b) &&
            a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    });
}

for (const id in PAL_KEYS) {
    $(id).addEventListener('change', () => {
        if (!doc) return;
        if (!doc.palette) doc.palette = {};
        // Checked BEFORE the write, against the water the tints were derived from.
        const drop = (PAL_KEYS[id] === 'baseColor' || PAL_KEYS[id] === 'deepColor') && gustsAreDerived();
        doc.palette[PAL_KEYS[id]] = $(id).value;
        if (drop) delete doc.palette.gusts;
        deriveHeroColor();
        afterEdit(true, 'water colour');
    });
}

for (const id in GUST_KEYS) {
    if (!$(id)) continue;
    $(id).addEventListener('change', () => {
        if (!doc) return;
        if (!doc.palette) doc.palette = {};
        // AUTHORING ONE PINS ALL FOUR, because applyVenuePalette takes the block whole —
        // `activeGustColors = gusts || ...` — so a partial block would leave the other three
        // undefined rather than falling back to the derivation they are currently showing.
        // Seeded from what is in force, so pinning changes nothing except the one swatch moved.
        const cur = effectiveGusts() || {};
        const g = {};
        for (const k of Object.values(GUST_KEYS)) {
            const v = cur[k];
            if (Array.isArray(v)) g[k] = v.slice(0, 3);
        }
        const picked = palRGB($(id).value);
        if (picked) g[GUST_KEYS[id]] = picked;
        doc.palette.gusts = g;
        afterEdit(true, 'puff tints');
    });
}

// Turning night OFF DELETES the key rather than writing `night: 0`, because 0 is what the
// merged palette already supplies and nine of ten venues author no `night` at all — a
// document should not grow a line meaning "unchanged". The amount is remembered in
// `lastNight` — declared up with the palette keys, because paletteRefresh reads it and runs
// long before this line — so flicking the toggle off and back on returns the water you had.
if ($('pal-night-on')) $('pal-night-on').addEventListener('change', () => {
    if (!doc) return;
    if (!doc.palette) doc.palette = {};
    if ($('pal-night-on').checked) {
        doc.palette.night = lastNight > 0 ? lastNight : 0.62;
    } else {
        const n = doc.palette.night;
        if (n > 0) lastNight = n;
        delete doc.palette.night;   // moonDir is left alone: it is inert without night,
                                    // and keeping it preserves the bearing across a toggle
    }
    afterEdit(true, $('pal-night-on').checked ? 'night on' : 'night off');
});
if ($('pal-night')) $('pal-night').addEventListener('change', () => {
    if (!doc) return;
    if (!doc.palette) doc.palette = {};
    const v = Math.max(0, Math.min(1, parseFloat($('pal-night').value) || 0));
    // Typing 0 into the amount is the same statement as clearing the toggle, and has to
    // leave the document in the same state — otherwise "off" would mean two different things
    // depending on which control said it.
    if (v > 0) { doc.palette.night = v; lastNight = v; } else { delete doc.palette.night; }
    afterEdit(true, 'moonlight');
});
if ($('pal-moondir')) $('pal-moondir').addEventListener('change', () => {
    if (!doc) return;
    if (!doc.palette) doc.palette = {};
    doc.palette.moonDir = (((parseFloat($('pal-moondir').value) || 0) % 360) + 360) % 360;
    afterEdit(true, 'moon bearing');
});

// ── Derive from surface ────────────────────────────────────────────────────
// A STARTING POINT, not a binding: pick the surface carefully, press this, then nudge
// whatever does not look right. Nothing re-derives afterwards, so a hand-tuned deep stays
// hand-tuned.
//
// THE RATIOS ARE THE LIBRARY'S OWN, not invented. Measured across the nine authored venue
// waters, base -> deep runs a median of hue +1.9deg, L x0.65, S x1.08, and base -> shallow
// hue -4.8deg, L x1.40, S x0.90 — deep water is the same hue darker and a little more
// saturated, shallow is lighter and a little greener. Checked against every venue, the rule
// lands within dE 8.4 of the hand-picked deep on 8 of 9 (median 3.9) and within dE 8.3 of
// the hand-picked shallow on 6 of 9 (median 7.2), which is what "right ballpark" has to mean.
//
// THE TWO IT MISSES ARE THE ARGUMENT FOR THE ADJUST STEP, not against the button. Bluewater's
// deep (#1e3a8a, dE 27.6) swings 23deg toward violet at the SAME lightness as its surface, and
// Pearl Lagoon's shallow (#4df5f0, dE 37.4) is a bright mint nothing derives. Those are the
// two venues whose identity IS their water, and a rule that reproduced them would be a rule
// that had no house style to reproduce.
const SEED_RATIO = {
    deepColor:    { hue:  1.9 / 360, l: 0.65, s: 1.08 },
    shallowColor: { hue: -4.8 / 360, l: 1.40, s: 0.90 }
};
function seedFromSurface(hex, r) {
    const c = palRGB(hex);
    if (!c) return null;
    const [h, s, l] = rgbToHsl(c[0], c[1], c[2]);
    const clamp = (v) => Math.max(0, Math.min(1, v));
    return palHEX(hslToRgb((h + r.hue + 1) % 1, clamp(s * r.s), clamp(l * r.l)));
}
$('btn-pal-seed').addEventListener('click', () => {
    if (!doc) return;
    const live = window.WATER_CONFIG || {};
    const base = (doc.palette && doc.palette.baseColor) || live.baseColor;
    const deep = seedFromSurface(base, SEED_RATIO.deepColor);
    const shallow = seedFromSurface(base, SEED_RATIO.shallowColor);
    if (!deep || !shallow) { toast('Pick a surface colour first'); return; }
    if (!doc.palette) doc.palette = {};
    // The surface is PINNED even when it came from the venue rather than the document.
    // Without it the document would carry a deep and a shallow derived from a colour it does
    // not state, and they would silently disagree the next time the venue's own water moved.
    doc.palette.baseColor = base;
    doc.palette.deepColor = deep;
    doc.palette.shallowColor = shallow;
    // Puffs and hero go back to derived rather than being written: they already have
    // derivations the game trusts, and an authored copy is just a value that can drift.
    delete doc.palette.gusts;
    deriveHeroColor();
    afterEdit(true, 'derive water colours');
    toast('Deep, shallow and tints derived from the surface');
});
// Back to the colours this course was SAVED with — not to the venue's built-in ones. Picking
// four colours is a matter of nudging them and looking, and the thing you want on the way back
// is where you started this session, which is what the save holds. (A course that has never
// overridden the palette saved none, so restoring drops the override and the venue shows
// through — the same answer, arrived at honestly.)
$('btn-pal-reset').addEventListener('click', () => {
    if (!doc || savedJSON === null) return;
    const saved = JSON.parse(savedJSON).palette;
    if (JSON.stringify(saved || null) === JSON.stringify(doc.palette || null)) {
        toast('Already the saved colours');
        return;
    }
    if (saved) doc.palette = JSON.parse(JSON.stringify(saved)); else delete doc.palette;
    afterEdit(true, 'water colour');
    toast('Water back to the saved colours');
});

// ── Ice ────────────────────────────────────────────────────────────────────
// The preview animates only while you are looking at it: the water renderer is the most
// expensive thing on the page and there is no reason to pay for it in Land mode.
setInterval(() => {
    if (mode !== 'water' || !doc) return;
    palPreviewT += 0.25;
    palettePreview();
}, 120);

window.addEventListener('resize', resize);
window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

// Boot restore: pick up where the last session left off. Silent when Chrome kept the
// read permission; otherwise the empty state grows a "⏎ reopen <name>" line and the
// Enter press is the user gesture the permission prompt needs. Never fights a document
// the user has already opened by the time the async work lands.
(async () => {
    const h = await recallHandle();
    if (!h || doc) return;
    lastHandle = h;
    try {
        if ((await h.queryPermission({ mode: 'read' })) === 'granted') {
            const f = await h.getFile();
            if (!doc) {
                openDocText(await f.text(), h, f.name);
                lastHandle = null;
                return;
            }
        }
    } catch (_) { /* fall through to the ⏎ offer; reopenLast reports real failures */ }
    draw();   // repaint the empty state so the ⏎ line shows
})();

window.EditorApp = { resize, fitView, loadVenue, loadBlank, newDoc, draw, buildKindPicker,
    // exposed for headless tests
    _state: () => ({ doc, findings, history: history.length, histIdx, dirty: isDirty(), tool, sel, mode }),
    // The layer table, for test_controls: it asserts the visibility eyes and this list
    // agree as SETS. It used to assert a hardcoded count of seven, which meant shipping
    // the Props layer broke a test that had found nothing wrong — the failure landed on
    // the good change instead of the bad one.
    _layers: () => LAYERS.map(L => ({ id: L.id, noEye: !!L.noEye })),
    // The clipboard verbs, for test_controls' shortcut coverage. Exposed as the FUNCTIONS
    // the keys call rather than as a synthetic key event, so a test can assert what they do
    // without depending on the browser delivering a chord it may reserve for itself.
    _clipCopy: clipCopy, _clipCut: clipCut, _clipPaste: clipPaste,
    // The prop selection, for test_props: the marquee is the thing that placing-on-click used
    // to make impossible, so it is the thing worth asserting.
    _selProps: () => selProps.slice(),
    // For asserting WHERE a paste landed, not merely that it happened. `_view`/`_setView`
    // already existed further down this object — a second pair here would have lost the
    // literal-key race to them and silently changed their signature.
    _ringBox: (rings) => ringBox(rings),
    _clip: () => clip && { mode: clip.mode, n: clip.items.length, pastes: clip.pastes },
    _setTool: (t) => { tool = t; refreshChrome(); },
    _sculpt: sculpt, _roughen: roughen, _simplify: simplify, _brushRings: brushRings,
    _setMode: (m) => setMode(m),
    _brush: (b, d) => { if (b != null) brush = b; if (d != null) detail = d; return { brush, detail }; },
    _scaleMap: scaleMap, _rotateMap: rotateMap, _afterEdit: afterEdit, _undo: undo, _redo: redo,
    _resample: resampleShape, _shapeById: shapeById, _recompile: recompile,
    _boundaryToRect: boundaryToRect,
    _toggleFinishOwnLine: toggleFinishOwnLine, _markLabel: (i) => markLabel(i),
    _lineLabel: (id) => lineLabel(id),
    _entryLabel: (i) => entryLabel(doc.course.route[i], i),
    // Selecting a route LEG. The UI does this from the object list; exposing it lets the
    // path-visualization test drive the same state without synthesising a click.
    _selectLeg: (i) => { setMode('route'); selRoute = i; osel = []; inspectorRefresh(); draw(); return selRoute; },
    _selRoute: () => selRoute,
    _selectMark: (i) => selectMark(i),
    _selectLine: (i) => selectLine(i),
    _selLine: () => selLine,
    _deleteMark: (i) => deleteMark(i),
    _deleteLine: (i) => deleteLine(i),
    _addMark: (k) => addMark(k),
    _addLine: () => addLine(),
    _addToRoute: (ref, pass) => addToRoute(ref, pass),
    _hit: (x, y) => hit(x, y),
    _measure: () => measure,
    _estimate: () => estimate,
    _savedJSON: () => savedJSON,
    _boat: () => boatProbe,
    _degOf: (r) => degOf(r),
    _compassOf: (r) => compassOf(r),
    _pickTool: (t) => pickTool(t),
    // Close a ring the way the Draw tool does, without synthesising the clicks.
    _drawRing: (ring) => { pending = ring.map(p => [p[0], p[1]]); commitPending(); },
    // The same door for an OPEN lane, so the traffic tool is drivable without a mouse.
    _drawLane: (pts) => { setMode('traffic'); pending = pts.map(p => [p[0], p[1]]); commitPending(); return selTraf; },
    _selTraffic: (i, k) => { setMode('traffic'); selTraf = i == null ? -1 : i; selTV = k == null ? -1 : k;
        inspectorRefresh(); objRefresh(); draw(); return { selTraf, selTV }; },
    _traffic: () => ({ i: selTraf, v: selTV, list: dtraffic() }),
    _insertLanePoint: (x, y) => { const okk = insertTrafficPointNear(x, y); if (okk) afterEdit(true, 'insert waypoint'); return okk; },
    _extendLane: (i, atStart, pts) => {
        setMode('traffic'); selTraf = i; drawing = true; extendLane = null; pending = null;
        const v = dtraffic()[i];
        const q = atStart ? v.path[0] : v.path[v.path.length - 1];
        // Enter through the same door the mouse does: a click ON the end point arms the
        // extend, so the test exercises the arming rule and not just the append.
        _laneClick(tpx(q), tpy(q));
        for (const pt of pts) _laneClick(pt[0], pt[1]);
        commitPending();
        return dtraffic()[i].path.length;
    },
    _scrub: (t) => {
        setMode('traffic');
        const el = document.getElementById('tr-scrub');
        if (!el) return null;
        el.value = String(t); el.dispatchEvent(new Event('input'));
        return { t: trafficT, min: +el.min, max: +el.max };
    },
    // Where the editor believes each vessel is at the scrubbed second — the same question
    // the game answers from the same shared rule.
    _trafficAt: (t) => dtraffic().map(v => {
        const c = trafficCurve(v);
        const l = c && window.Traffic.localTime(v, c, t);
        if (!l) return null;
        const q = c.at(l.t);
        return { id: v.id, x: q.x, y: q.y, heading: q.heading, knots: q.knots, stopped: !!q.stopped };
    }),
    _clashes: () => { const c = trafficClashes();
        return { hit: Array.from(c.hit), points: c.points.map(x => ({ i: x.i, j: x.j, t: x.t })), coarsened: c.coarsened }; },
    _trafficCurve: (i) => { const v = dtraffic()[i]; const c = v && trafficCurve(v);
        return c ? { length: c.length, duration: c.duration } : null; },
    // File lifecycle, drivable without a picker: tests hand text straight in.
    _openDocText: (text, name) => openDocText(text, null, name),
    _venueLabel: () => $('venue-label').textContent,
    _view: () => ({ x: view.x, y: view.y, scale: view.scale }),
    _setView: (x, y, sc) => { view.x = x; view.y = y; view.scale = sc;
        if (boatProbe) { boatProbe.x = x; boatProbe.y = y; } boatInfo(); draw(); },
    _addIce: (x, y, r) => addIce(x, y, r),
    _selectShape: (id) => { sel = Object.assign({}, NOHIT, { shape: id });
        osel = id ? [{ kind: 'shape', id }] : []; refreshInspector(); refreshChrome(); },
    _osel: () => osel.slice(),
    _vsel: () => vsel.slice(),
    _marquee: () => marquee && { a: marquee.a, b: marquee.b, level: marquee.level },
    _dragKind: () => drag && drag.kind,
    _setOsel: (refs) => { osel = refs.slice(); vsel = []; syncSelFromOsel(); refreshChrome(); draw(); },
    _modeObjects: () => modeObjects().map(o => o.ref),
    _hitObject: (x, y) => { const o = hitObject(x, y); return o ? o.ref : null; },
    _deleteOsel: () => deleteOsel(),
    _boolean: (op) => oselBoolean(op),
    _booleanWhy: () => oselBooleanWhy(),
    _translateShape: (l, dx, dy) => translateShape(l, dx, dy),
    _deleteIce: (i) => deleteIce(i),
    // `selIce` is gone: it was a second name for `sel.shape`, kept in step by hand, and a
    // floe's handles went missing whenever the two disagreed. Selecting one IS selecting a shape.
    _selIce: () => (sel.shape ? doc.shapes.findIndex(sh => sh.id === sel.shape) : -1),
    _selectIce: (i) => { const f = dshapes()[i];
        vsel = []; osel = f ? [{ kind: 'shape', id: f.id }] : [];
        syncSelFromOsel(); refreshChrome(); draw(); },
    _snapPoint: (w, ref) => snapPoint(w, snapCandidates(ref)),
    _previewSeed: (v) => { if (v != null) previewSeed = v; return previewSeed; },
    // exposed for headless tests of the selection layer
    // draw() too: every real path that sets vsel repaints, and a hook that does not is a
    // hook that lies about what the screen shows.
    _selectVerts: (refs) => { vsel = refs; refreshChrome(); draw(); },
    _vselCount: () => vsel.length,
    _moveSel: (dx, dy) => { for (const r of vsel) { const p = vertexArray(r); if (p) { p[0]+=dx; p[1]+=dy; } } rebakeTouched(); },
    _alignSel: (axis) => alignSel(axis),
    _insertNear: (x, y) => insertVertexNear(x, y),
    _deleteSel: () => deleteSelectedVertices() };
})();
