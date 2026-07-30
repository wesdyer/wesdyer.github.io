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
let mode = 'shape';           // shape | vertex | marks | route | boundary | wind | current | venue | map | measure
let sub = 'drag';             // within vertex: drag | sculpt | smooth
let drawing = false;          // shape mode, mid-draw
let tool = 'select';
function syncTool() {
    tool = mode === 'vertex'   ? sub
         : mode === 'shape'    ? (drawing ? 'draw' : 'select')
         : mode === 'marks'    ? 'mark'
         : mode === 'boundary' ? 'bcircle'
         : mode;
}
const NOHIT = { shape: null, mark: -1, line: -1, ice: -1, vert: -1, bvert: -1, wvert: -1, rcentre: -1, rring: -1 };
let sel = Object.assign({}, NOHIT);
let hover = Object.assign({}, NOHIT);
let hoverRoute = -1;           // route row under the cursor, highlighted on the map
let brush = 260;
let selWind = -1;              // selected wind region
let selCur = -1;               // selected current region
let selLine = -1;              // selected gate / line
let selIce = -1;               // selected hand-placed floe
// Multi-selection of vertices, shared by every mode that owns vertices: land in Vertices
// mode, the arena in Arena mode, a region's outline in Wind mode. One implementation, so
// marquee-select and align work the same everywhere.
let selRoute = -1;             // selected route entry, for naming
let vsel = [];                 // refs, in click order — the FIRST is the align anchor
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

// ── Units ───────────────────────────────────────────────────────────────────
// 5 world units = 1 metre, and 55u = 11m = one boat length (a J111 — the game's 165u
// RRS zone is three of them). Panels speak metres; world units survive only in the
// cursor HUD, where they are the coordinates you would type into a document.
const U_PER_M = 5;
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
const LAND_TYPES = [
    { style: 'ice',      cls: 'snow',    soft: true,  label: 'Ice / snow',     swatch: '#e8edf5' },
    { style: 'granite',  cls: 'granite', soft: false, label: 'Granite (rock)', swatch: '#8d8d8d' },
    { style: 'tropical', cls: 'snow',    soft: true,  label: 'Tropical sand',  swatch: '#f5e6c8' },
    { style: 'grass',    cls: 'snow',    soft: true,  label: 'Grass / marsh',  swatch: '#86a86b' },
    { style: 'redrock',  cls: 'granite', soft: false, label: 'Red rock',       swatch: '#b4694a' }
];

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
const isDirty = () => savedJSON !== null && JSON.stringify(doc) !== savedJSON;

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

function recompile(rerollIce) {
    const seed = previewSeed;
    window.VENUE_DOC[doc.venue] = doc;
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: doc.venue }));
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
            !i.isBank && window.Arena.signedDist(course.boundary, i.x, i.y) > -(i.radius + 120));
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
        const grid = window.SailCheck.buildGrid(doc.land, course.boundary, null);
        estimate = window.SailCheck.routeEstimate(grid, course.marks, course.route,
                                                 windBase(), state.wind.speed);
        if (estimate && t0) estimate.ms = Math.round(performance.now() - t0);
    } catch (e) {
        // An unsailable course can fail to produce a path at all. The sailability check
        // is what reports that; the estimate simply has nothing to say.
        estimate = null;
    }
}

function runChecks() {
    // The compiled shape the checks read must carry everything compile derives, or a
    // check quietly stops running instead of reporting. `sailedDist`/`cutoff` come from
    // the document, so recompile them here rather than fishing for them in state.course,
    // which only keeps the fields the game itself needs.
    const derived = window.VenueDoc.compile(doc);
    const compiled = { marks: course.marks, boundary: course.boundary, roundMark: course.roundMark,
                       route: course.route, scenery: course.scenery,
                       sailedDist: derived.sailedDist,
                       cutoff: derived.cutoff, cutoffAuto: derived.cutoffAuto };
    recomputeEstimate();
    if (estimate) compiled.estimate = estimate;
    // EVERY floe, authored or generated. `floes` alone is the generated-preview cache, and
    // on a hand-placed venue it is empty — which made the ice checks fall silent rather
    // than check the 54 floes actually in the course.
    const allIce = (course.islands || []).filter(i => i.isFloe);
    findings = window.VenueCheck.run({ doc, compiled, boats: state.boats, floes: allIce });
    const order = { error: 0, warn: 1, ok: 2 };
    findings.sort((a, b) => order[a.level] - order[b.level]);
    const n = (lv) => findings.filter(f => f.level === lv).length;
    $('check-tally').innerHTML =
        (n('error') ? `<span style="color:#fb7185">${n('error')} error</span> ` : '')
        + (n('warn') ? `<span style="color:#fbbf24">${n('warn')} warn</span> ` : '')
        + `<span style="color:#6ee7b7">${n('ok')} ok</span>`;
    $('checks').innerHTML = findings.map((f, i) =>
        `<div class="find find-${f.level}${i === selFinding ? ' sel' : ''}" data-i="${i}">
            <div class="find-t">${f.title}</div><div class="find-d">${f.detail}</div></div>`).join('');
    $('checks').querySelectorAll('.find').forEach(el => el.addEventListener('click', () => {
        const i = +el.dataset.i;
        selFinding = (selFinding === i) ? -1 : i;
        runChecks(); draw();
    }));
}

// Called after any committed edit.
function afterEdit(pushSnapshot, label) {
    if (pushSnapshot) pushHistory(label || 'edit');
    recompile();
    info();
    refreshChrome();
    refreshInspector();
    routeRefresh();
    markRefresh();
    lineRefresh();
    marksInspector();
    windRefresh();
    currentRefresh();
    venueRefresh();
    iceRefresh();
    paletteRefresh();
    draw();
}

// ── Load / save ─────────────────────────────────────────────────────────────
let fileHandle = null;

function loadVenue() {
    const key = $('venue-select').value;
    const src = window.VenueDoc.get(key);
    selFinding = -1;
    sel = Object.assign({}, NOHIT);
    if (!src) {
        // Generated venue: nothing authored to edit. Show it read-only rather than
        // pretending otherwise.
        doc = null; fileHandle = null; savedJSON = null;
        history = []; histIdx = -1;
        const seed = previewSeed;
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: key }));
        const real = Math.random; Math.random = mulberry32(seed);
        try { resetGame(); } finally { Math.random = real; }
        course = state.course;
        floes = (course.islands || []).filter(i => !i.fromMask);
        findings = [];
        $('checks').innerHTML = '<div class="text-slate-500" style="font-size:11.5px;line-height:1.5">'
            + 'Generated venue — no document to edit or check. Land, marks and wind are produced '
            + 'per-seed at load.</div>';
        $('check-tally').textContent = '';
        info(); refreshChrome(); refreshInspector(); routeRefresh();
        markRefresh(); lineRefresh(); windRefresh(); currentRefresh(); venueRefresh();
        iceRefresh(); fitView();
        return;
    }
    doc = clone(src);
    iceCache = null; iceCacheSeed = null;      // a fresh venue gets fresh ice
    savedJSON = JSON.stringify(doc);
    history = [{ doc: clone(doc), label: 'loaded' }];
    histIdx = 0;
    fileHandle = null;
    selWind = -1; selCur = -1; selLine = -1; selRoute = -1;
    recompile(); info(); refreshChrome(); refreshInspector(); routeRefresh();
    markRefresh(); lineRefresh(); marksInspector(); windRefresh(); currentRefresh();
    venueRefresh(); iceRefresh(); paletteRefresh();

    fitView();
}

async function save() {
    const text = '// GENERATED ONCE by art/export_venue_doc.js — now the SOURCE OF TRUTH.\n'
        + '// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.\n'
        + '// Edited in editor.html.\n'
        + 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
        + `window.VENUE_DOC[${JSON.stringify(doc.venue)}] = ${JSON.stringify(doc, null, 2)};\n`;
    const name = `${doc.venue}.venue.js`;
    try {
        if (window.showSaveFilePicker) {
            if (!fileHandle) {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: name,
                    types: [{ description: 'Venue document', accept: { 'text/javascript': ['.js'] } }]
                });
            }
            const w = await fileHandle.createWritable();
            await w.write(text); await w.close();
        } else {
            // Fallback for browsers without the File System Access API: download it
            // and let the user drop it into assets/venues/.
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
            a.download = name; a.click();
            URL.revokeObjectURL(a.href);
        }
        savedJSON = JSON.stringify(doc);
        toast(`Saved ${name}`);
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

// ── Chrome (buttons, dirty state, hints) ────────────────────────────────────
function refreshChrome() {
    $('btn-undo').disabled = histIdx <= 0;
    $('btn-redo').disabled = histIdx >= history.length - 1;
    $('btn-save').disabled = !doc || !isDirty();
    $('dirty').textContent = doc ? (isDirty() ? '● unsaved' : 'saved') : '';
    $('dirty').style.color = isDirty() ? '#fbbf24' : '#64748b';
    syncTool();
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.toggle('hidden', p.dataset.for !== mode));
    document.querySelectorAll('.subtool').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
    $('btn-draw').textContent = drawing ? 'Cancel drawing' : 'Draw a new shape';
    const vsRow = $('vsel-row');
    if (vsRow) {
        // Vertex mode is ABOUT vertices, so the panel lives there. The other modes that
        // happen to own vertices only show it once something is actually selected —
        // otherwise every visit to Wind came with a block of vertex instructions.
        const owns = mode === 'vertex'
            || ((mode === 'boundary' || mode === 'wind' || mode === 'current') && vsel.length > 0);
        vsRow.style.display = owns ? 'block' : 'none';
        $('vsel-count').textContent = vsel.length
            ? `${vsel.length} selected — the ringed one is the align anchor`
            : 'Drag a box to select · Shift+click to add';
        $('btn-align-x').disabled = vsel.length < 2;
        $('btn-align-y').disabled = vsel.length < 2;
    }
    const hints = {
        shape: drawing
            ? 'Click to drop points · Enter or double-click closes the shape · Esc cancels'
            : 'Click a shape · drag = move · Cmd/Ctrl+drag = rotate · Alt+drag = scale · Shift constrains · Delete removes',
        vertex: sub === 'drag'
            ? 'Drag a vertex (Shift constrains) · double-click an EDGE to insert · Delete removes the hovered one'
            : sub === 'sculpt'
              ? 'Drag: nearby vertices follow the cursor, strongest at the centre, nothing at the rim · [ ] resize'
              : 'Drag: nearby vertices relax toward their neighbours, flattening wobble · [ ] resize',
        marks:    'Drag a mark, or a gate to move both its marks · Delete removes the selected one · rounding CENTRE moves, RING resizes',
        route:    'Click a gate or mark on the map to ADD a leg using it · reorder by dragging a row · ✕ removes the leg, not the marks',
        boundary: 'Drag an arena corner · or use Fit rect / Back to circle',
        wind:     'Click a region to select it, then drag its corners · regions are AVERAGED where they overlap · turn on the field to see the result',
        current:  'Flow ° is where the water GOES · regions add as vectors · turn on the field to see the total',
        venue:    'Drag to place ice — the drag sets the size · raise scatter for a field · click one to select, drag to move, Delete to remove',
        map:      'Numeric only — nothing here is dragged',
        measure:  'Drag to measure · SHIFT-click to extend it into a path · Esc or Clear removes it'
    };
    $('hint').textContent = (hints[mode] || '') + '   ·   middle-mouse pans and wheel zooms, always';
}

// ── Rendering ───────────────────────────────────────────────────────────────
function bounds() {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    const add = (x, y) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); };
    const bd = course && course.boundary;
    if (bd) { add(bd.x - bd.radius, bd.y - bd.radius); add(bd.x + bd.radius, bd.y + bd.radius); }
    if (doc) for (const l of doc.land) for (const p of l.outer) add(p[0], p[1]);
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

function draw() {
    ctx.clearRect(0, 0, W(), H());
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W(), H());
    grid();

    // Drawn from the DOCUMENT when there is one, so a boundary edit shows while the
    // drag is still in progress rather than only after the recompile.
    const dbd = doc ? doc.world.boundary : null;
    ctx.strokeStyle = '#475569'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
    if (dbd && dbd.poly && dbd.poly.length >= 3) {
        ctx.beginPath(); ringPath(dbd.poly); ctx.stroke();
        ctx.setLineDash([]);
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

    // Drifting ice first, so authored land reads on top of it.
    for (const f of floes) {
        if (!f.vertices) continue;
        ctx.beginPath();
        f.vertices.forEach((v, i) => { const s = toS(v.x, v.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
        ctx.closePath();
        ctx.fillStyle = 'rgba(125,211,252,0.5)'; ctx.fill();
        ctx.strokeStyle = 'rgba(125,211,252,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    }

    // Land: colour-matched to the source mask (white land, grey granite, navy
    // water) so the schematic can be compared to the painted mask by eye.
    const shapes = doc ? doc.land : null;
    if (shapes) {
        for (const l of shapes) {
            ctx.beginPath();
            for (const ring of eachRing(l)) ringPath(ring);
            const granite = l.cls === 'granite';
            ctx.fillStyle = granite ? '#8d8d8d' : '#e8edf5';
            ctx.fill('evenodd');                            // holes
            const selected = sel.shape === l.id, hovered = hover.shape === l.id;
            ctx.strokeStyle = selected ? '#38bdf8' : hovered ? '#93c5fd' : (granite ? '#c9c9c9' : '#ffffff');
            ctx.lineWidth = selected ? 2.5 : 1;
            ctx.stroke();
        }
        // Vertices, only where they can be manipulated — 137 dots everywhere is noise.
        if (tool === 'vertex' || sel.shape) {
            for (const l of shapes) {
                if (tool !== 'vertex' && sel.shape !== l.id) continue;
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
    } else if (course) {
        for (const i of (course.islands || [])) {
            if (!i.vertices) continue;
            ctx.beginPath();
            i.vertices.forEach((v, k) => { const s = toS(v.x, v.y); k ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
            ctx.closePath();
            ctx.fillStyle = '#e8edf5'; ctx.fill('evenodd');
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
        }
    }

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

    droute.forEach((e, li) => {
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
        const isStart = e.role === 'start' || e.finish;
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
            const label = e.role === 'start' ? 'START' : e.finish ? 'FINISH'
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
    if (doc) {
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

    // Marks, glyphed by appearance: an inflatable is a round orange floaty, a can is
    // a yellow drum.
    (dmarks || []).forEach((m, i) => {
        const p = toS(m.x, m.y);
        const on = hover.mark === i || sel.mark === i;
        const r = on ? 8 : 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8,15,30,0.7)'; ctx.fill();
        if (m.kind === 'can') {
            ctx.fillStyle = '#facc15';
            ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
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

    if ((tool === 'sculpt' || tool === 'smooth') && lastMouse) {
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

        if (doc) {
            for (const l of doc.land) {
                for (const ring of eachRing(l)) {
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

    // Hand-placed ice, drawn from the DOCUMENT so it redraws mid-drag, and outlined when
    // this is the mode that owns it.
    if (doc) {
        dice().forEach((f, i) => {
            ctx.beginPath(); ringPath(f.outer);
            const on = (mode === 'venue' || mode === 'vertex') && (selIce === i || hover.ice === i);
            ctx.fillStyle = on ? 'rgba(186,230,253,0.85)' : 'rgba(125,211,252,0.55)';
            ctx.fill();
            if (mode === 'venue' || mode === 'vertex') {
                ctx.strokeStyle = on ? '#fff' : 'rgba(224,242,254,0.7)';
                ctx.lineWidth = on ? 2.5 : 1;
                ctx.stroke();
            }
            // In Vertices mode ice carries handles like any other outline.
            if (mode === 'vertex') {
                f.outer.forEach((p, k) => {
                    const q = toS(p[0], p[1]);
                    const hot = hover.ice === i && hover.vert === k;
                    ctx.beginPath(); ctx.arc(q.x, q.y, hot ? 6.5 : 4, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(8,15,30,0.7)'; ctx.fill();
                    ctx.beginPath(); ctx.arc(q.x, q.y, hot ? 4.5 : 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = hot ? '#fff' : '#7dd3fc'; ctx.fill();
                });
            }
        });
    }
    if (drag && drag.kind === 'icenew' && drag.r > 0) {
        const c = toS(drag.origin.x, drag.origin.y);
        ctx.strokeStyle = 'rgba(125,211,252,0.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.arc(c.x, c.y, drag.r * view.scale, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#bae6fd'; ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.fillText(`${fmtM(drag.r * 2)} across`, c.x + 8, c.y - 8);
    }
    drawWindRegions();
    drawCurrentRegions();
    if (showField) drawWindField();
    if (showCurField) drawCurrentField();
    drawBoundaryHandles();
    drawVertexSelection();
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
    windArrow();
    scaleBar();
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
    if (!doc || mode !== 'boundary') return;
    const bp = doc.world.boundary.poly;
    if (!bp || bp.length < 3) return;
    bp.forEach((pt, i) => {
        const sp = toS(pt[0], pt[1]);
        const on = hover.bvert === i;
        const rr = on ? 8 : 5.5;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, rr + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8,15,30,0.85)'; ctx.fill();
        ctx.beginPath(); ctx.arc(sp.x, sp.y, rr, 0, Math.PI * 2);
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

        // Label with what it actually does, so the map is readable without the panel.
        const c = r.poly.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]).map(v => v / r.poly.length);
        const sp = toS(c[0], c[1]);
        const deg = Math.round((r.direction || 0) * 180 / Math.PI);
        ctx.fillStyle = on ? '#a7f3d0' : 'rgba(167,243,208,0.65)';
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${r.id}  ${deg}°  ${r.speed != null ? r.speed.toFixed(1) + 'kt' : 'venue kt'}`, sp.x, sp.y);
        ctx.textAlign = 'left';

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
            const rel = base > 0 ? f.speed / base : 1;
            // Blue below base, green at it, amber above — the same reading as the
            // in-game pressure cues.
            const col = rel < 0.9 ? 'rgba(96,165,250,0.75)'
                      : rel > 1.12 ? 'rgba(251,191,36,0.85)'
                      : 'rgba(52,211,153,0.6)';
            const ux = Math.sin(f.direction), uy = -Math.cos(f.direction);
            const len = L * Math.max(0.35, Math.min(1.8, rel));
            ctx.strokeStyle = col; ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(sx - ux * len, sy - uy * len);
            ctx.lineTo(sx + ux * len, sy + uy * len);
            ctx.stroke();
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(sx + ux * len, sy + uy * len, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    state.gusts = savedGusts; state.wind.direction = savedDir; state.wind.speed = savedSpd;
}

function drawFinding() {
    if (selFinding < 0 || !findings[selFinding] || !doc) return;
    const f = findings[selFinding];
    for (const id of (f.shapes || [])) {
        const l = doc.land.find(x => x.id === id);
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

    // The rotate handle sits off the bow, where a tiller-less boat's heading reads from.
    const hx = c.x + Math.sin(boatProbe.heading) * (BOAT_L * 0.72 * sc);
    const hy = c.y - Math.cos(boatProbe.heading) * (BOAT_L * 0.72 * sc);
    const hot = lastMouse && Math.hypot(lastMouse.sx - hx, lastMouse.sy - hy) < 12;
    ctx.beginPath(); ctx.arc(hx, hy, hot ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,15,30,0.8)'; ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy, hot ? 5 : 3.2, 0, Math.PI * 2);
    ctx.fillStyle = hot ? '#fff' : '#fbbf24'; ctx.fill();
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

function windArrow() {
    const w = windBase();
    const ux = Math.sin(w), uy = -Math.cos(w);              // forward = (sin h, -cos h)
    const cx = 62, cy = 62, L = 30;
    ctx.strokeStyle = '#34d399'; ctx.fillStyle = '#34d399'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - ux*L, cy - uy*L); ctx.lineTo(cx + ux*L, cy + uy*L); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + ux*L, cy + uy*L);
    ctx.lineTo(cx + ux*L - uy*7 - ux*9, cy + uy*L + ux*7 - uy*9);
    ctx.lineTo(cx + ux*L + uy*7 - ux*9, cy + uy*L - ux*7 - uy*9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7f8ea9'; ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText('WIND ' + Math.round(w * 180 / Math.PI) + '°', 22, 104);
}

function scaleBar() {
    // Step in round METRES, not round world units: the bar is a ruler for a person.
    let units = mToU(20);
    while (units * view.scale < 70) units *= 2;
    const px = units * view.scale, x = W() - px - 22, y = H() - 26;
    ctx.strokeStyle = '#8ea0bd'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y-4); ctx.lineTo(x, y); ctx.lineTo(x+px, y); ctx.lineTo(x+px, y-4); ctx.stroke();
    ctx.fillStyle = '#8ea0bd'; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${fmtM(units)}  ·  ${fmtBL(units)}`, x + px/2, y - 8);
    ctx.textAlign = 'left';
}

// ── Info panel ──────────────────────────────────────────────────────────────
const row = (k, v) => `<div class="row"><span>${k}</span><span class="t-mono">${v}</span></div>`;
const mmss = s => `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`;

function info() {
    if (!course) return;
    const m = course.marks || [];
    const legs = doc ? Math.max(1, routeOf().length - 1) : state.race.totalLegs;
    $('info-course').innerHTML =
        row('venue', $('venue-select').value) +
        // DERIVED from the route: the start opens leg 1 and every entry after it ends one.
        row('legs', `${legs}  (from the route)`) +
        row('marks', m.length) +
        (doc ? row('gates &amp; lines', dlines().length) : '') +
        row('wind', Math.round(windBase() * 180/Math.PI) + '°'
            + (doc ? ` (from ${wregs().length} region${wregs().length === 1 ? '' : 's'})` : '')) +
        (doc && cregs().length ? row('current regions', cregs().length) : '') +
        row('arena', course.boundary && course.boundary.poly
            ? `polygon, ${course.boundary.poly.length} corners`
            : course.boundary ? `circle r ${fmtM(course.boundary.radius)}` : '—');

    // The document owns these; the fields show what it says, or blank for "default".
    if (doc) {
        $('course-desc').value = doc.course.description || '';
        $('course-start').value = doc.course.startTime != null ? doc.course.startTime : '';
        $('course-cutoff').value = doc.course.cutoff != null ? doc.course.cutoff : '';
    }

    // Distance and time. The straight-line figure from compile is the fallback the GAME
    // uses when nothing better is authored; the estimate is the honest one, and the only
    // reason it cannot live in compile is that it needs a nav grid and a BFS per leg.
    let dist = 0, note = '', cutoff = 0;
    const authored = doc && doc.course.cutoff != null;
    if (doc) {
        const d2 = window.VenueDoc.compile(doc);
        dist = (estimate && estimate.dist) || d2.sailedDist || 0;
        cutoff = authored ? doc.course.cutoff : (d2.cutoffAuto || 0);
        note = estimate
            ? `${legs} leg(s) along the sailable path, priced by the polar at `
              + `${Math.round(estimate.windSpeed)} kt`
            : `${legs} leg(s) straight-line — no sailable path found`;
    } else {
        dist = (state.race.totalLegs || 2) * (state.race.legLength || 4000);
        cutoff = uToM(dist) * 0.1875;
        note = `${state.race.totalLegs} legs × ${fmtM(state.race.legLength)}`;
    }
    // A limit has to let the tail of the fleet finish, not just the winner. The eval's
    // measured spread puts the fleet mean around 1.35x the leader and the last boat near
    // 1.6x, so that is the margin — stated, rather than folded into a magic constant.
    const estLimit = estimate ? estimate.secs * 1.6 : 0;
    // The fleet mean runs about 1.35x the leader (measured in the eval), and the 3–5 minute
    // target has always been about how long the RACE is, not how fast the winner is.
    const mean = estimate ? estimate.secs * 1.35 : 0;
    const band = estimate && mean >= 180 && mean <= 300;
    const straight = doc ? (window.VenueDoc.compile(doc).sailedDist || 0) : 0;
    $('info-time').innerHTML =
        row('sailable path', `${fmtM(dist)}  ·  ${fmtBL(dist)}`) +
        (estimate && straight > 0
            ? row('vs straight line', `${(estimate.dist / straight).toFixed(2)}×  (${fmtM(straight)})`) : '') +
        (estimate
            ? row('best time', mmss(estimate.secs))
              + `<div class="row"><span>fleet ~1.35×</span><span class="t-mono" style="color:${band ? '#6ee7b7' : '#fbbf24'}">`
              + `${mmss(mean)}${band ? '' : '  ⚠'}</span></div>`
              + (estimate.slowest
                  ? `<div class="text-slate-500 mt-1" style="font-size:11px">slowest leg ${estimate.slowest.leg}: `
                    + `${fmtM(estimate.slowest.dist)} at ${estimate.slowest.twaDeg}° TWA, `
                    + `VMG ${estimate.slowest.vmg ? estimate.slowest.vmg.toFixed(1) : '?'} kt, `
                    + `${mmss(estimate.slowest.secs)}</div>`
                  : '')
            : '') +
        row('time limit', mmss(cutoff) + (authored ? ' (authored)' : ' (derived, blind to land)'));
    $('info-time').innerHTML += `<div class="text-slate-500 mt-1" style="font-size:11px">${note}`
        + (estimate && estimate.ms != null ? ` · ${estimate.ms}ms` : '') + `</div>`;
    const useBtn = $('btn-use-est');
    if (useBtn) {
        useBtn.disabled = !estimate;
        useBtn.textContent = estimate ? `Set the limit to ${mmss(estLimit)}` : 'No estimate available';
    }

    if (doc) {
        const verts = doc.land.reduce((a,l)=>a+l.outer.length,0);
        const holes = doc.land.reduce((a,l)=>a+(l.holes||[]).length,0);
        $('info-land').innerHTML =
            row('shapes', doc.land.length) + row('vertices', verts) + row('holes', holes) +
            row('drifting ice', `${dice().length} placed · ${floes.length} scattered`) +
            row('world', fmtM(doc.world.size) + ' square') +
            (sel.shape ? row('selected', sel.shape) : '');
    } else {
        const isl = course.islands || [];
        $('info-land').innerHTML = row('shapes', isl.length)
            + row('vertices', isl.reduce((a,i)=>a+((i.vertices||[]).length),0));
    }
    legendRefresh();
    $('seed-readout').textContent = `ice #${previewSeed}`;
}

// The legend describes THIS venue. A fixed list told you about white land and grey
// granite on a course that has neither, which is worse than no legend: it is a legend
// for some other map.
function legendRefresh() {
    const box = $('legend');
    if (!box) return;
    const sw = (col, glyph, text) => `<div><span style="color:${col}">${glyph}</span> ${text}</div>`;
    const out = [];
    const rt = doc ? routeOf() : [];
    if (rt.some(e => e.role === 'start' || e.finish) || !doc) {
        out.push(sw('#38bdf8', '━', finishShared() ? 'start / finish line (shared)' : 'start &amp; finish lines'));
    }
    if (doc && rt.some(e => e.kind === 'gate' || (e.kind === 'line' && e.role !== 'start' && !e.finish))) {
        out.push(sw('#a3e635', '━', 'gate — arrow is the way through'));
    }
    if (rt.some(e => e.kind === 'round')) out.push(sw('#fbbf24', '◯', 'rounding zone, arc shows the side'));
    if (doc && dmarksOf().length) out.push(sw('#fb923c', '●', 'inflatable mark')
        + (dmarksOf().some(m => m.kind === 'can') ? sw('#facc15', '■', 'yellow can') : ''));
    // Land, by the types actually present.
    if (doc) {
        const seen = [];
        for (const l of doc.land) {
            const t = LAND_TYPES.find(x => x.style === l.style) || LAND_TYPES[0];
            if (!seen.some(x => x.label === t.label)) seen.push(t);
        }
        for (const t of seen) out.push(sw(t.swatch || '#e8edf5', '▬', t.label.toLowerCase()));
        if (floes.length) out.push(sw('#7dd3fc', '▬', `drifting ice (${floes.length})`));
        if (cregs().length) out.push(sw('#38bdf8', '➜', 'current region — arrow is the flow'));
        if (wregs().length) out.push(sw('#34d399', '▭', 'wind region'));
    }
    out.push(sw('#475569', '▭', 'arena — the sailing limit') + sw('#34d399', '➜', 'wind'));
    box.innerHTML = out.join('');
}

// ── Inspector ───────────────────────────────────────────────────────────────
let inspBuilt = false;

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
const startEntry = () => routeOf()[0] || null;
const finishEntry = () => routeOf()[routeOf().length - 1] || null;
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

function refreshInspector() {
    const box = $('insp'), none = $('insp-none');
    if (!inspBuilt) {
        const t = $('insp-type');
        LAND_TYPES.forEach((lt, i) => {
            const o = document.createElement('option');
            o.value = String(i); o.textContent = lt.label; t.appendChild(o);
        });
        inspBuilt = true;
    }
    const l = (doc && sel.shape) ? shapeById(sel.shape) : null;
    box.classList.toggle('hidden', !l);
    none.classList.toggle('hidden', !!l);
    if (!l) return;
    $('insp-id').textContent = l.id;
    const idx = LAND_TYPES.findIndex(t => t.style === l.style);
    $('insp-type').value = String(idx >= 0 ? idx : 0);
    $('insp-soft').checked = !!l.soft;
    const area = Math.abs(window.VenueDoc.ringArea(l.outer));
    $('insp-stats').textContent =
        `${l.outer.length} verts · ${(l.holes || []).length} holes · r ${Math.round(l.r)}u · `
        + `area ${(area / 1e6).toFixed(2)}M u²`;
}

function duplicateShape() {
    const l = shapeById(sel.shape);
    if (!l) return;
    const copy = clone(l);
    let n = 2;
    while (doc.land.some(x => x.id === `${l.id}-${n}`)) n++;
    copy.id = `${l.id}-${n}`;
    // Offset so the copy is visibly its own object rather than hidden underneath.
    const off = Math.max(120, l.r * 0.25);
    for (const ring of eachRing(copy)) for (const p of ring) { p[0] += off; p[1] += off; }
    rebake(copy);
    doc.land.push(copy);
    sel = { shape: copy.id, mark: -1, vert: -1, bvert: -1 };
}

function deleteSelectedShape() {
    // Land is land: nothing in the route points at it any more, so there is no reference
    // to repoint. A rounding names a MARK, which may happen to sit on this shape.
    doc.land = doc.land.filter(l => l.id !== sel.shape);
    sel = { shape: null, mark: -1, vert: -1, bvert: -1 };
    return true;
}

// ── Route editing ───────────────────────────────────────────────────────────
// The leg engine now walks the route generically, so a course can mix lines, gates
// and roundings in any order — which is what makes this panel worth having.
// What is physically on the water. `none` is a position with no buoy — an island you
// round, a transit — which the race marks with an indicator instead of a sprite.
const MARK_KINDS = ['inflatable', 'can', 'none'];
const MARK_KIND_LABEL = { inflatable: 'orange buoy', can: 'yellow can', none: 'no buoy' };

// A leg's readable name. Authored `name` wins; otherwise derive it from what the leg IS.
// A leg is a USE of a mark or a gate, so its label names the thing plus what this use
// asks of it — the same gate can appear twice, sailed differently each time.
function entryLabel(e, i) {
    if (e.name) return e.name;
    if (e.role === 'start') return finishShared() ? 'Start (shared line)' : 'Start line';
    if (e.finish) return finishShared() ? 'Finish (shared line)' : 'Finish line';
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

function routeRefresh() {
    const box = $('route-list');
    if (!box) return;
    if (!doc) { box.innerHTML = ''; return; }
    const r = routeOf();
    // The leg engine walks the route in order, so the start must stay first and the
    // finish last. Everything between them is free to move.
    const movable = (i) => i > 0 && i < r.length - 1;
    box.innerHTML = r.map((e, i) => {
        const ctl = e.kind === 'round'
            ? `<b data-act="side" data-i="${i}" title="port / starboard">${e.side === 'port' ? '↺' : '↻'}</b>`
            : `<b data-act="dir" data-i="${i}" title="flip crossing direction">${e.dir > 0 ? '→' : '←'}</b>`;
        const modeBtn = (e.kind === 'gate' || (e.kind === 'line' && e.role !== 'start' && !e.finish))
            ? `<b data-act="pass" data-i="${i}" title="sailed through / entered then left round an end"`
              + ` style="font-size:10px">${e.pass === 'through' ? 'thru' : 'rnd'}</b>` : '';
        const share = e.finish
            ? `<b data-act="share" data-i="${i}" title="share the start line, or give the finish its own">⇄</b>` : '';
        const del = movable(i) ? `<b data-act="del" data-i="${i}" title="remove this LEG — the marks stay">✕</b>` : '';
        const n = useCount(e);
        const reused = n > 1 ? `<span title="used by ${n} legs" style="opacity:.55">×${n}</span>` : '';
        return `<div class="rt${i === selRoute ? ' sel' : ''}${movable(i) ? '' : ' pinned'}"`
             + ` data-i="${i}"${movable(i) ? ' draggable="true"' : ''}>`
             + `<span class="grip" title="${movable(i) ? 'drag to reorder' : 'the start and finish are fixed in place'}">⠿</span>`
             + `<span class="rt-n">${i === 0 ? 'S' : i === r.length - 1 ? 'F' : i}</span>`
             + `<span class="rt-k">${entryLabel(e, i)}</span>${reused}`
             + `${modeBtn}${share}${ctl}${del}</div>`;
    }).join('');

    // Selecting a row is what the name field edits. On `click`, not mousedown: a
    // mousedown re-render would replace the row mid-gesture and the drag would never
    // start. A completed drag does not fire click, so the two never collide.
    box.querySelectorAll('.rt').forEach(el => {
        el.addEventListener('click', (ev) => {
            if (ev.target.tagName === 'B') return;              // buttons do their own thing
            selRoute = +el.dataset.i;
            routeRefresh(); marksInspector(); draw();
        });
        // Hovering a row shows you WHICH geometry it means. Without this a route of
        // three similar gates is a list of words.
        el.addEventListener('mouseenter', () => { hoverRoute = +el.dataset.i; draw(); });
        el.addEventListener('mouseleave', () => { hoverRoute = -1; draw(); });
    });

    // DRAG TO REORDER. Only the middle entries move: the leg engine walks the route in
    // order, so the start must stay first and the finish last.
    let dragFrom = -1;
    const dropSlot = (el, ev) => {
        const rect = el.getBoundingClientRect();
        const after = (ev.clientY - rect.top) > rect.height / 2;
        return Math.max(1, Math.min(r.length - 1, +el.dataset.i + (after ? 1 : 0)));
    };
    box.querySelectorAll('.rt[draggable]').forEach(el => {
        el.addEventListener('dragstart', (ev) => {
            dragFrom = +el.dataset.i;
            el.classList.add('dragging');
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('text/plain', String(dragFrom));
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            box.querySelectorAll('.rt').forEach(x => x.classList.remove('dropbefore', 'dropafter'));
        });
    });
    box.querySelectorAll('.rt').forEach(el => {
        el.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            box.querySelectorAll('.rt').forEach(x => x.classList.remove('dropbefore', 'dropafter'));
            // Think in insertion SLOTS, clamped to the movable band, so the indicator can
            // never promise a drop the reorder will refuse. Slot len-1 draws above the
            // finish row and means "last leg before the finish".
            const row = box.querySelector(`.rt[data-i="${dropSlot(el, ev)}"]`);
            if (row) row.classList.add('dropbefore');
        });
        el.addEventListener('drop', (ev) => {
            ev.preventDefault();
            const from = dragFrom >= 0 ? dragFrom : parseInt(ev.dataTransfer.getData('text/plain'), 10);
            if (!(from >= 1 && from <= r.length - 2)) return;
            let to = dropSlot(el, ev);
            if (from < to) to--;                            // removing shifts the target
            if (to === from) return;
            const rr = doc.course.route;
            rr.splice(to, 0, rr.splice(from, 1)[0]);
            selRoute = to;
            afterEdit(true, 'reorder route');
        });
    });

    box.querySelectorAll('b').forEach(el => el.addEventListener('click', () => {
        const i = +el.dataset.i, act = el.dataset.act, rr = doc.course.route, e = rr[i];
        if (act === 'dir') e.dir = -(e.dir || 1);
        else if (act === 'side') e.side = (e.side === 'port') ? 'starboard' : 'port';
        else if (act === 'pass') {
            e.pass = (e.pass === 'through') ? 'round' : 'through';
            e.kind = 'gate';
        }
        else if (act === 'share') {
            const res = toggleFinishOwnLine();
            if (res) toast(res === 'own' ? 'Finish now has its own line — drag it into place'
                                        : 'Finish shares the start line again');
        }
        else if (act === 'del') {
            // The ordering is all that is removed. The marks and the gate stay on the
            // water — they may be used by another leg, and deleting geometry as a side
            // effect of an ordering change is not what anyone means by ✕.
            rr.splice(i, 1);
            if (selRoute >= rr.length) selRoute = -1;
        }
        afterEdit(true, 'route');
    }));

    // What can be added: every line and every mark already on the water, plus the land
    // shapes, since an island is a legitimate thing to round.
    const add = $('rt-add-what');
    if (add) {
        const opts = [];
        for (const ln of dlines()) opts.push(`<option value="line:${ln.id}">${lineLabel(ln.id)} — cross or round</option>`);
        dmarksOf().forEach((m, i) => opts.push(`<option value="mark:${m.id}">${markLabel(i)} — round it</option>`));
        for (const l of doc.land) opts.push(`<option value="land:${l.id}">${l.id} — round the island</option>`);
        const keep = add.value;
        add.innerHTML = opts.join('');
        if (keep) add.value = keep;
        add.classList.toggle('hidden', !opts.length);
        $('btn-rt-add').classList.toggle('hidden', !opts.length);
        $('rt-nothing').classList.toggle('hidden', !!opts.length);
    }
}

// ── The inventory: what exists on the water ─────────────────────────────────
function markRefresh() {
    const box = $('mark-list');
    if (!box) return;
    if (!doc) { box.innerHTML = ''; return; }
    box.innerHTML = dmarksOf().map((m, i) =>
        `<div class="rt${i === sel.mark ? ' sel' : ''}" data-i="${i}">`
        + `<span class="rt-k">${markLabel(i)}</span>`
        + `<span style="opacity:.55;font-size:10.5px">${MARK_KIND_LABEL[m.kind] || MARK_KIND_LABEL.inflatable}</span>`
        + `<b data-act="del" data-i="${i}" title="delete this mark">✕</b></div>`).join('');
    box.querySelectorAll('.rt').forEach(el => {
        el.addEventListener('click', (ev) => {
            if (ev.target.tagName === 'B') return;
            selectMark(+el.dataset.i);
        });
        el.addEventListener('mouseenter', () => { hover = Object.assign({}, NOHIT, { mark: +el.dataset.i }); draw(); });
        el.addEventListener('mouseleave', () => { hover = Object.assign({}, NOHIT); draw(); });
    });
    box.querySelectorAll('b').forEach(el => el.addEventListener('click', () => deleteMark(+el.dataset.i)));
}

function lineRefresh() {
    const box = $('line-list');
    if (!box) return;
    if (!doc) { box.innerHTML = ''; return; }
    const rt = routeOf();
    box.innerHTML = dlines().map((ln, i) => {
        const uses = rt.filter(e => e.lineId === ln.id).length;
        return `<div class="rt${i === selLine ? ' sel' : ''}" data-i="${i}">`
             + `<span class="rt-k">${lineLabel(ln.id)}</span>`
             + `<span class="t-mono" style="opacity:.5;font-size:10.5px" title="legs using it">${uses}×</span>`
             + `<b data-act="del" data-i="${i}" title="delete this gate and its marks">✕</b></div>`;
    }).join('');
    box.querySelectorAll('.rt').forEach(el => {
        el.addEventListener('click', (ev) => {
            if (ev.target.tagName === 'B') return;
            selectLine(+el.dataset.i);
        });
        el.addEventListener('mouseenter', () => { hover = Object.assign({}, NOHIT, { line: +el.dataset.i }); draw(); });
        el.addEventListener('mouseleave', () => { hover = Object.assign({}, NOHIT); draw(); });
    });
    box.querySelectorAll('b').forEach(el => el.addEventListener('click', () => deleteLine(+el.dataset.i)));
}

function selectMark(i) {
    sel = Object.assign({}, NOHIT, { mark: i });
    selLine = -1;
    marksInspector(); markRefresh(); lineRefresh(); draw();
}
function selectLine(i) {
    selLine = i;
    sel = Object.assign({}, NOHIT);
    marksInspector(); markRefresh(); lineRefresh(); draw();
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

// Name fields for the selected leg, mark and gate. Blank means "use the smart default",
// so a course reads sensibly before anyone types and stays that way if they never do.
function marksInspector() {
    const rtRow = $('rt-name-row'), mkRow = $('mk-name-row'), lnRow = $('ln-name-row');
    if (!rtRow || !mkRow || !lnRow) return;
    const r = routeOf();
    const e = (selRoute >= 0) ? r[selRoute] : null;
    rtRow.classList.toggle('hidden', !e);
    if (e) {
        $('rt-name').value = e.name || '';
        $('rt-name').placeholder = entryLabel(e, selRoute);
        const n = useCount(e);
        $('rt-info').textContent = `leg ${selRoute} of ${r.length - 1}`
            + (n > 1 ? ` · this ${e.kind === 'round' ? 'mark' : 'gate'} is used by ${n} legs` : '');
    }

    const m = (sel.mark >= 0) ? dmarksOf()[sel.mark] : null;
    mkRow.classList.toggle('hidden', !m);
    if (m) {
        // The label above the box is the name in force. The box itself is empty unless a
        // name was typed, and its placeholder repeats that label — so "what goes in this
        // field" answers itself, and clearing it visibly returns to the default.
        const derived = markLabel(sel.mark);
        $('mk-derived').textContent = derived + (m.name ? '  (renamed)' : '  (automatic)');
        $('mk-name').value = m.name || '';
        $('mk-name').placeholder = derived;
        $('mk-kind').value = m.kind || 'inflatable';
        $('mk-pos').textContent = `${MARK_KIND_LABEL[m.kind] || MARK_KIND_LABEL.inflatable}`
            + ` · ${Math.round(uToM(m.x))}, ${Math.round(uToM(m.y))} m · id ${m.id}`;
    }

    const ln = (selLine >= 0) ? dlines()[selLine] : null;
    lnRow.classList.toggle('hidden', !ln);
    if (ln) {
        const dl = lineLabel(ln.id);
        $('ln-derived').textContent = dl + (ln.name ? '  (renamed)' : '  (automatic)');
        $('ln-name').value = ln.name || '';
        $('ln-name').placeholder = dl;
        const ends = lineEnds(ln.id);
        const len = ends ? Math.hypot(ends[1].x - ends[0].x, ends[1].y - ends[0].y) : 0;
        const uses = routeOf().filter(e2 => e2.lineId === ln.id).length;
        $('ln-info').textContent = `${fmtM(len)} long · ${fmtBL(len)} · used by ${uses} leg(s) · id ${ln.id}`;
    }
}

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
    const at = Math.max(1, rr.length - 1);
    let entry = null;
    if (what === 'line') entry = { kind: 'gate', lineId: id, dir: 1, role: 'gate', pass: passMode || 'through' };
    else if (what === 'mark') entry = { kind: 'round', markId: id, side: 'starboard', role: 'rounding' };
    else if (what === 'land') {
        // Rounding an island means laying a MARK on it. The two stay separate objects, so
        // the island can be reshaped or moved without dragging the course with it.
        const l = shapeById(id);
        if (!l) return false;
        const mid = nextId('round', dmarksOf());
        doc.course.marks.push({ id: mid, name: `Round ${id}`, x: l.c[0], y: l.c[1], kind: 'inflatable' });
        entry = { kind: 'round', markId: mid, radius: l.r, side: 'starboard', role: 'rounding' };
    }
    if (!entry) return false;
    rr.splice(at, 0, entry);
    selRoute = at;
    return true;
}

// ── Deleting things ─────────────────────────────────────────────────────────
// Deletion belongs to the inventory, so it has to say what else goes with it: a mark
// takes its gates, and a gate takes the legs that sailed it. What it must NOT do is
// leave the course without a start or a finish, which no amount of undo makes obvious.
function structuralMark(m) {
    const s0 = startEntry(), f = finishEntry();
    for (const e of [s0, f]) {
        const ends = entryEnds(e);
        if (ends && (ends[0] === m || ends[1] === m)) return true;
    }
    return false;
}

function deleteMark(i) {
    const m = dmarksOf()[i];
    if (!m) return false;
    if (structuralMark(m)) {
        toast('That is a start or finish mark — a course needs its line. Move it instead.', true);
        return false;
    }
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
    const s0 = startEntry(), f = finishEntry();
    if ((s0 && s0.lineId === ln.id) || (f && f.lineId === ln.id)) {
        toast('That is the start or finish line — a course needs it. Move its marks instead.', true);
        return false;
    }
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

function windRefresh() {
    const list = $('wind-list'), box = $('wreg');
    if (!doc) { list.innerHTML = ''; box.classList.add('hidden'); return; }
    // READ without writing. Creating `regions = []` here mutated a pristine document
    // and marked it unsaved the moment it loaded — the dirty flag has to mean "you
    // changed something", or it means nothing.
    const rs = wregs();
    list.innerHTML = rs.map((r, i) =>
        `<div class="rt"><span class="rt-k">${r.name || r.id}</span>`
        + `<span class="t-mono" style="opacity:.55;font-size:10.5px">`
        + `${Math.round((r.direction || 0) * 180 / Math.PI)}°`
        + `${r.speed != null ? ' ' + r.speed.toFixed(0) + 'kt' : ''}</span>`
        + `<b data-i="${i}">${i === selWind ? '●' : '○'}</b></div>`).join('');
    list.querySelectorAll('b').forEach(el => el.addEventListener('click', () => {
        selWind = (selWind === +el.dataset.i) ? -1 : +el.dataset.i;
        windRefresh(); draw();
    }));
    const r = rs[selWind];
    box.classList.toggle('hidden', !r);
    if (!r) return;
    $('wr-dir').value = Math.round((r.direction || 0) * 180 / Math.PI);
    $('wr-dirvar').value = Math.round((r.dirVar || 0) * 180 / Math.PI);
    $('wr-speed').value = (r.speed != null ? r.speed : '');
    $('wr-speedvar').value = (r.speedVar || 0);
    $('wr-period').value = (r.period != null ? r.period : 30);
    $('wr-falloff').value = Math.round(uToM(r.falloff != null ? r.falloff : 400));
}

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

// ── Water colour ────────────────────────────────────────────────────────────
// The document may override the venue's water palette. The swatches show whatever is in
// force — the document's colour if it has one, otherwise the venue's — so they never
// present a colour the water is not actually using.
const PAL_KEYS = { 'pal-base': 'baseColor', 'pal-deep': 'deepColor',
                   'pal-shallow': 'shallowColor', 'pal-shore': 'shorelineColor' };

function paletteRefresh() {
    if (!$('pal-base')) return;
    const live = window.WATER_CONFIG || {};
    const dp = (doc && doc.palette) || {};
    for (const id in PAL_KEYS) {
        const k = PAL_KEYS[id];
        const v = dp[k] || live[k] || '#0e7490';
        $(id).value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#0e7490';
    }
    palettePreview();
}

// A real patch of water, drawn by the GAME's renderer rather than a gradient that
// approximates it. Colours interact — the ripple lattice, the caustics and the depth ramp
// all tint each other — so four swatches cannot tell you what the water will look like.
let palPreviewT = 0;
function palettePreview() {
    const cv2 = $('pal-preview');
    if (!cv2 || !window.WaterRenderer || !window.WATER_CONFIG) return;
    const c2 = cv2.getContext('2d');
    // The renderer reads the canvas size and a camera, and nothing else about the game —
    // so a synthetic state is enough. The camera is panned down-map so the preview shows
    // the depth ramp rather than one flat tone.
    const fake = {
        wind: { direction: windBase() },
        camera: { x: 0, y: -900 + Math.sin(palPreviewT) * 40, rotation: 0, zoom: 1 }
    };
    try {
        window.WaterRenderer.draw(c2, fake);
    } catch (err) {
        // Never let a preview take the editor down.
        c2.fillStyle = window.WATER_CONFIG.baseColor || '#0e7490';
        c2.fillRect(0, 0, cv2.width, cv2.height);
    }
}

function currentRefresh() {
    const list = $('cur-list'), box = $('creg');
    if (!list || !box) return;
    if (!doc) { list.innerHTML = ''; box.classList.add('hidden'); return; }
    // READ without writing — creating `current.regions = []` here would mark a pristine
    // document unsaved the moment it loaded.
    const rs = cregs();
    list.innerHTML = rs.map((r, i) =>
        `<div class="rt"><span class="rt-k">${r.id}</span>`
        + `<span class="t-mono" style="opacity:.55;font-size:10.5px">${(r.speed != null ? r.speed : 0).toFixed(1)}kt</span>`
        + `<b data-i="${i}">${i === selCur ? '●' : '○'}</b></div>`).join('');
    list.querySelectorAll('b').forEach(el => el.addEventListener('click', () => {
        selCur = (selCur === +el.dataset.i) ? -1 : +el.dataset.i;
        currentRefresh(); draw();
    }));
    const r = rs[selCur];
    box.classList.toggle('hidden', !r);
    if (!r) return;
    $('cr-dir').value = Math.round((r.direction || 0) * 180 / Math.PI);
    $('cr-dirvar').value = Math.round((r.dirVar || 0) * 180 / Math.PI);
    $('cr-speed').value = (r.speed != null ? r.speed : 0);
    $('cr-speedvar').value = (r.speedVar || 0);
    $('cr-period').value = (r.period != null ? r.period : 45);
    $('cr-falloff').value = Math.round(uToM(r.falloff != null ? r.falloff : 400));
}

function addCurrentRegion(wholeCourse) {
    if (!doc.current) doc.current = {};
    if (!doc.current.regions) doc.current.regions = [];
    const rs = doc.current.regions;
    let n = 1;
    while (rs.some(r => r.id === `current-${n}`)) n++;
    let poly;
    if (wholeCourse) {
        const ex = window.Arena.extent(course.boundary);
        const pad = 200;
        poly = [[ex.minX - pad, ex.minY - pad], [ex.maxX + pad, ex.minY - pad],
                [ex.maxX + pad, ex.maxY + pad], [ex.minX - pad, ex.maxY + pad]];
    } else {
        const half = Math.max(700, doc.world.size * 0.12);
        poly = window.Arena.rectPoly(view.x, view.y, half, half);
    }
    // Flow along the course axis by default — a tide runs up or down a course far more
    // often than across it, and a zero-speed region looks broken.
    rs.push({ id: `current-${n}`, poly, falloff: 400,
              direction: windBase(), speed: 1, dirVar: 0, speedVar: 0, period: 45 });
    selCur = rs.length - 1;
}

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

        // An arrow IN the region, pointing where the water goes. A current you cannot
        // see the direction of is a number in a panel.
        const c = r.poly.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]).map(v => v / r.poly.length);
        const sp = toS(c[0], c[1]);
        const ux = Math.sin(r.direction || 0), uy = -Math.cos(r.direction || 0);
        const L = 26 + Math.min(40, (r.speed || 0) * 16);
        ctx.strokeStyle = on ? '#7dd3fc' : 'rgba(125,211,252,0.7)';
        ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(sp.x - ux * L, sp.y - uy * L); ctx.lineTo(sp.x + ux * L, sp.y + uy * L); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sp.x + ux * L, sp.y + uy * L);
        ctx.lineTo(sp.x + ux * L - uy * 7 - ux * 10, sp.y + uy * L + ux * 7 - uy * 10);
        ctx.lineTo(sp.x + ux * L + uy * 7 - ux * 10, sp.y + uy * L - ux * 7 - uy * 10);
        ctx.closePath(); ctx.fill();
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${r.id}  ${(r.speed || 0).toFixed(1)}kt`, sp.x, sp.y + L + 16);
        ctx.textAlign = 'left';

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
            if (doc && doc.land.some(l => pointInRing(w.x, w.y, l.outer)
                && !(l.holes || []).some(h => pointInRing(w.x, w.y, h)))) continue;
            const f = getCurrentAt(w.x, w.y);
            if (!f || f.speed < 0.02) continue;
            const ux = Math.sin(f.direction), uy = -Math.cos(f.direction);
            const len = Math.min(22, 6 + f.speed * 9);
            ctx.strokeStyle = 'rgba(125,211,252,0.8)'; ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(sx - ux * len, sy - uy * len);
            ctx.lineTo(sx + ux * len, sy + uy * len);
            ctx.stroke();
            ctx.fillStyle = 'rgba(224,242,254,0.9)';
            ctx.beginPath(); ctx.arc(sx + ux * len, sy + uy * len, 2, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// ── Hand-placed ice ─────────────────────────────────────────────────────────
// Authored as world-space polygons, so a floe can be reshaped vertex by vertex like any
// other outline. What the game randomizes per race is the MOTION — drift, spin, wander —
// which is what keeps a designed ice field from playing out the same way twice.
const EMPTY = [];
const dice = () => (doc && doc.ice) || EMPTY;
const onLand = (x, y) => !!(doc && doc.land.some(l => pointInRing(x, y, l.outer)
    && !(l.holes || []).some(h => pointInRing(x, y, h))));
// The one place allowed to create the array is the code about to put something in it.
const diceW = () => { if (!doc.ice) doc.ice = []; return doc.ice; };

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
        if (n > 1) {
            // Keep the pieces apart: two floes on top of each other read as one bigger
            // one, so a scatter that overlaps is not the density it claims to be. A few
            // tries, then place anyway — refusing silently would leave you short.
            let placed = false;
            for (let t = 0; t < 18 && !placed; t++) {
                const a = Math.random() * Math.PI * 2;
                const d = Math.sqrt(Math.random()) * Math.max(0, radius - rr);
                px = cx + Math.cos(a) * d; py = cy + Math.sin(a) * d;
                placed = !onLand(px, py) && !made.some(o => {
                    const c = iceCentre(o);
                    return Math.hypot(c.x - px, c.y - py) < (c.r + rr) * 0.95;
                });
            }
            if (!placed) continue;              // no room here; place fewer, not badly
        }
        let m = 1;
        while (dice().some(f => f.id === `ice-${m}`)) m++;
        const f = { id: `ice-${m}`, outer: iceOutline(px, py, rr) };
        diceW().push(f);
        made.push(f);
    }
    selIce = dice().length - 1;
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

// What this venue has that others do not. Ice is the arctic's; the panel is built to hold
// whatever the next venue turns out to need, rather than being an Ice tool that only one
// venue can use.
function venueRefresh() {
    const box = $('venue-fx');
    if (!box) return;
    if (!doc) { box.innerHTML = ''; return; }
    const fx = (state.race && state.race.venueFx) || {};
    const on = Object.keys(fx).filter(k => fx[k]);
    box.innerHTML = `<b>${(window.VENUES && VENUES[doc.venue] && VENUES[doc.venue].name) || doc.venue}</b>`
        + `<div class="t-mono" style="font-size:10.5px;opacity:.7">effects: ${on.length ? on.join(', ') : 'none'}</div>`;
    const hasIce = !!fx.ice;
    $('venue-ice').classList.toggle('hidden', !hasIce);
    $('venue-none').classList.toggle('hidden', hasIce);
}

function iceRefresh() {
    const box = $('ice-count');
    if (!box) return;
    if (!doc) { box.textContent = ''; return; }
    const n = dice().length;
    box.textContent = n
        ? `${n} floe${n === 1 ? '' : 's'}, all placed by hand`
        : 'No ice yet — drag on the water to place some';
    const f = dice()[selIce];
    $('ice-sel').classList.toggle('hidden', !f);
    if (f) {
        const c = iceCentre(f);
        $('ice-info').textContent = `${f.id} · ${fmtM(c.r * 2)} across · ${f.outer.length} vertices`;
    }
}

function deleteIce(i) {
    if (!doc || !dice()[i]) return false;
    const id = dice()[i].id;
    doc.ice.splice(i, 1);
    selIce = -1;
    afterEdit(true, 'delete ice');
    toast(`Removed ${id}`);
    return true;
}

// ── Draw a new shape ────────────────────────────────────────────────────────
// Click to drop points, Enter or double-click to close, Esc to cancel. A rough ring
// plus the sculpt brush beats placing every vertex by hand.
let pending = null;
function commitPending() {
    if (!pending || pending.length < 3) { pending = null; draw(); return; }
    let n = 1;
    while (doc.land.some(x => x.id === `shape-${n}`)) n++;
    const t = LAND_TYPES[0];
    const l = { id: `shape-${n}`, cls: t.cls, style: t.style, soft: t.soft,
                outer: pending.map(p => [p[0], p[1]]), holes: [], c: [0, 0], r: 0 };
    rebake(l);
    doc.land.push(l);
    sel = { shape: l.id, mark: -1, vert: -1, bvert: -1 };
    pending = null;
    afterEdit(true, 'draw shape');
    toast(`Added ${l.id} — sculpt with S, set its type on the left`);
}

// ── Vertex selection ────────────────────────────────────────────────────────
// A ref names a vertex without holding a pointer to it, so edits and undo cannot leave
// the selection pointing at a stale array.
function modeVertexRefs() {
    if (!doc) return [];
    const out = [];
    if (mode === 'vertex') {
        for (const l of doc.land) {
            l.outer.forEach((p, i) => out.push({ kind: 'land', id: l.id, ring: -1, i, x: p[0], y: p[1] }));
            (l.holes || []).forEach((h, hi) => h.forEach((p, i) =>
                out.push({ kind: 'land', id: l.id, ring: hi, i, x: p[0], y: p[1] })));
        }
        // Hand-placed ice is an outline like any other, and the point of authoring it is
        // being able to reshape it.
        dice().forEach((f, k) => f.outer.forEach((p, i) =>
            out.push({ kind: 'ice', id: f.id, r: k, i, x: p[0], y: p[1] })));
    } else if (mode === 'boundary') {
        const bp = doc.world.boundary.poly;
        if (bp) bp.forEach((p, i) => out.push({ kind: 'arena', i, x: p[0], y: p[1] }));
    } else if (mode === 'wind' && selWind >= 0 && wregs()[selWind]) {
        wregs()[selWind].poly.forEach((p, i) => out.push({ kind: 'wind', r: selWind, i, x: p[0], y: p[1] }));
    } else if (mode === 'current' && selCur >= 0 && cregs()[selCur]) {
        cregs()[selCur].poly.forEach((p, i) => out.push({ kind: 'current', r: selCur, i, x: p[0], y: p[1] }));
    }
    return out;
}
function vertexArray(ref) {
    if (!doc) return null;
    if (ref.kind === 'land') {
        const l = shapeById(ref.id);
        if (!l) return null;
        const ring = ref.ring < 0 ? l.outer : (l.holes || [])[ref.ring];
        return ring ? ring[ref.i] : null;
    }
    if (ref.kind === 'arena') return (doc.world.boundary.poly || [])[ref.i];
    if (ref.kind === 'wind') { const w = wregs()[ref.r]; return w ? w.poly[ref.i] : null; }
    if (ref.kind === 'current') { const c = cregs()[ref.r]; return c ? c.poly[ref.i] : null; }
    if (ref.kind === 'ice') { const f = dice().find(x => x.id === ref.id); return f ? f.outer[ref.i] : null; }
    return null;
}
const sameRef = (a, b) => a.kind === b.kind && a.i === b.i && a.id === b.id
                          && a.ring === b.ring && a.r === b.r;
const inSel = (ref) => vsel.some(v => sameRef(v, ref));

function rebakeTouched() {
    if (!doc) return;
    const ids = new Set(vsel.filter(v => v.kind === 'land').map(v => v.id));
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
    if (ref.kind === 'land') {
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
    } else if (ref.kind === 'wind' || ref.kind === 'current') {
        const reg = ref.kind === 'wind' ? wregs()[ref.r] : cregs()[ref.r];
        if (!reg || reg.poly.length < 2) return out;
        push(reg.poly[(ref.i - 1 + reg.poly.length) % reg.poly.length]);
        push(reg.poly[(ref.i + 1) % reg.poly.length]);
    } else if (ref.kind === 'ice') {
        const f = dice().find(x => x.id === ref.id);
        if (!f || f.outer.length < 2) return out;
        push(f.outer[(ref.i - 1 + f.outer.length) % f.outer.length]);
        push(f.outer[(ref.i + 1) % f.outer.length]);
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
    // Region outlines: wind and current use the same vertex slot, since only one of the
    // two modes is ever active.
    const activeRegion = (mode === 'wind' && selWind >= 0) ? wregs()[selWind]
                       : (mode === 'current' && selCur >= 0) ? cregs()[selCur] : null;
    if (doc && activeRegion && activeRegion.poly) {
        const wp = activeRegion.poly;
        for (let i = 0; i < wp.length; i++) {
            if (Math.hypot(wp[i][0] - wx, wp[i][1] - wy) < r) { out.wvert = i; return out; }
        }
    }
    const bp = (mode === 'boundary') && doc && doc.world.boundary.poly;
    if (bp) {
        for (let i = 0; i < bp.length; i++) {
            if (Math.hypot(bp[i][0] - wx, bp[i][1] - wy) < r) { out.bvert = i; return out; }
        }
    }
    if (mode === 'venue' && doc) {
        const fs = dice();
        // Last drawn wins, so the piece on top is the one you grab.
        for (let i = fs.length - 1; i >= 0; i--) {
            if (pointInRing(wx, wy, fs[i].outer)) { out.ice = i; return out; }
        }
        return out;
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
    // Land vertices only in vertex mode; land BODIES only in shape mode.
    if (mode !== 'vertex' && mode !== 'shape') return out;
    if (mode === 'shape') {
        for (const l of doc.land) {
            if (pointInRing(wx, wy, l.outer) && !(l.holes||[]).some(h => pointInRing(wx, wy, h))) { out.shape = l.id; return out; }
        }
        return out;
    }
    // Vertices win over bodies: a vertex sits ON its shape's outline, so testing
    // bodies first would make vertices unreachable.
    for (const l of doc.land) {
        for (const ring of eachRing(l)) {
            for (let i = 0; i < ring.length; i++) {
                if (Math.hypot(ring[i][0] - wx, ring[i][1] - wy) < r) { out.shape = l.id; out.vert = i; return out; }
            }
        }
    }
    // Ice outlines are editable too — they were listed as selectable vertices but never
    // hit-tested, so they could be marquee-selected and not dragged.
    const fs2 = dice();
    for (let k = 0; k < fs2.length; k++) {
        const ring = fs2[k].outer;
        for (let i = 0; i < ring.length; i++) {
            if (Math.hypot(ring[i][0] - wx, ring[i][1] - wy) < r) { out.ice = k; out.vert = i; return out; }
        }
    }
    for (const l of doc.land) {
        if (pointInRing(wx, wy, l.outer) && !(l.holes||[]).some(h => pointInRing(wx, wy, h))) { out.shape = l.id; return out; }
    }
    return out;
}
const shapeById = (id) => doc && doc.land.find(l => l.id === id);

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
    for (const l of doc.land) {
        let touched = false;
        for (const ring of eachRing(l)) {
            for (const p of ring) {
                const d2 = (p[0]-cx)**2 + (p[1]-cy)**2;
                if (d2 > r2) continue;
                const t = 1 - Math.sqrt(d2) / r;
                const w = t * t * (3 - 2 * t);              // smoothstep
                p[0] += dx * w; p[1] += dy * w; touched = true;
            }
        }
        if (touched) rebake(l);
    }
}
// Smooth: relax vertices toward the midpoint of their neighbours. Cleans up the
// chatter sculpting leaves behind.
function smooth(cx, cy, strength) {
    const r2 = brush * brush;
    for (const l of doc.land) {
        let touched = false;
        for (const ring of eachRing(l)) {
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
                touched = true;
            }
        }
        if (touched) rebake(l);
    }
}
// Insert on the nearest EDGE of whatever the current mode owns — land rings, the arena
// outline, or a wind region. Same gesture everywhere.
function modeRings() {
    if (!doc) return [];
    if (mode === 'vertex') {
        const out = [];
        for (const l of doc.land) for (const ring of eachRing(l)) out.push({ ring, land: l });
        for (const f of dice()) out.push({ ring: f.outer, land: null });
        return out;
    }
    if (mode === 'boundary') {
        const bp = doc.world.boundary.poly;
        return bp ? [{ ring: bp, land: null }] : [];
    }
    if (mode === 'wind' && selWind >= 0 && wregs()[selWind]) {
        return [{ ring: wregs()[selWind].poly, land: null }];
    }
    if (mode === 'current' && selCur >= 0 && cregs()[selCur]) {
        return [{ ring: cregs()[selCur].poly, land: null }];
    }
    return [];
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
        if (mode === 'vertex' && hover.shape && hover.vert >= 0) {
            const l = shapeById(hover.shape);
            if (l && hover.vert < l.outer.length) refs = [{ kind: 'land', id: l.id, ring: -1, i: hover.vert }];
        } else if (mode === 'boundary' && hover.bvert >= 0) {
            refs = [{ kind: 'arena', i: hover.bvert }];
        } else if (mode === 'wind' && hover.wvert >= 0 && selWind >= 0) {
            refs = [{ kind: 'wind', r: selWind, i: hover.wvert }];
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
        if (ref.kind === 'land') {
            land = shapeById(ref.id);
            if (!land) continue;
            ring = ref.ring < 0 ? land.outer : (land.holes || [])[ref.ring];
        } else if (ref.kind === 'arena') ring = doc.world.boundary.poly;
        else if (ref.kind === 'wind') { const w = wregs()[ref.r]; ring = w && w.poly; }
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
    for (const ring of eachRing(l)) {
        const n = ring.length;
        if (n < 4) continue;
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
        if (per <= 1e-9) continue;
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
    rebake(l);
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
// Back to a circle — right for an open-water venue with no natural edge.
function boundaryToCircle() {
    const b = doc.world.boundary;
    if (b.poly) {
        const bc = window.Arena.boundingCircle(b.poly);
        b.circle = { x: bc.x, y: bc.y, r: bc.r };
    } else if (!b.circle) {
        b.circle = { x: 0, y: 0, r: doc.world.size * 0.5 };
    }
    b.poly = null;
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

    for (const l of doc.land) transformShape(l, (x, y) => ({ x: x*k, y: y*k }));
    for (const m of doc.course.marks) { m.x *= k; m.y *= k; }

    if (keepLen !== null) {
        // Re-lay at the original length about the scaled midpoint, preserving
        // vertex ORDER — the order sets the crossing normal, and reversing it puts
        // the fleet on the wrong side of its own start line.
        const mx = (marks[0].x + marks[1].x) / 2, my = (marks[0].y + marks[1].y) / 2;
        marks[0].x = mx - dirx * keepLen / 2; marks[0].y = my - diry * keepLen / 2;
        marks[1].x = mx + dirx * keepLen / 2; marks[1].y = my + diry * keepLen / 2;
    }
    const rEntry = doc.course.route.find(e => e.kind === 'round');
    if (rEntry && rEntry.zone) rEntry.zone *= k;
    doc.world.size *= k;
    if (doc.world.boundary.circle) {
        doc.world.boundary.circle.x *= k; doc.world.boundary.circle.y *= k; doc.world.boundary.circle.r *= k;
    }
    if (doc.world.boundary.poly) {
        doc.world.boundary.poly = doc.world.boundary.poly.map(p => [p[0]*k, p[1]*k]);
        doc.world.boundary.circle = null;      // the poly is the arena; no stale twin
    }
}

// ── Mouse ───────────────────────────────────────────────────────────────────
let lastMouse = null;

// Middle mouse pans regardless of the active tool: reaching for a Pan tool to move
// around is the kind of friction that makes an editor tiring to use.
cv.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect();
    const w = toW(e.clientX - r.left, e.clientY - r.top);
    if (e.button === 1) {
        e.preventDefault();
        drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
        cv.classList.add('dragging');
        return;
    }
    if (e.button !== 0) return;

    if (mode === 'shape' && drawing && doc) {
        if (!pending) pending = [];
        pending.push([w.x, w.y]);
        draw();
        return;
    }
    if (mode === 'venue' && doc) {
        const hi = hit(w.x, w.y);
        if (hi.ice >= 0) {
            selIce = hi.ice; iceRefresh();
            drag = { kind: 'ice', i: hi.ice, last: w, moved: false, origin: w };
            draw(); return;
        }
        // Empty water: drag out a circle and fill it with ice.
        selIce = -1; iceRefresh();
        drag = { kind: 'icenew', origin: w, r: 0 };
        draw(); return;
    }
    if (mode === 'measure' && boatProbe) {
        const sc = view.scale;
        const c = toS(boatProbe.x, boatProbe.y);
        const hx = c.x + Math.sin(boatProbe.heading) * (BOAT_L * 0.72 * sc);
        const hy = c.y - Math.cos(boatProbe.heading) * (BOAT_L * 0.72 * sc);
        const sx0 = e.clientX - r.left, sy0 = e.clientY - r.top;
        if (Math.hypot(sx0 - hx, sy0 - hy) < 14) {
            drag = { kind: 'boatrot' };
            return;
        }
        if (Math.hypot(w.x - boatProbe.x, w.y - boatProbe.y) < BOAT_L * 0.6) {
            drag = { kind: 'boatmove', last: w };
            return;
        }
    }
    if (mode === 'measure') {
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
    if (doc) {
        const hr = hit(w.x, w.y);
        if (hr.rcentre >= 0) { drag = { kind: 'rcentre', li: hr.rcentre, last: w, moved: false, origin: w }; return; }
        if (hr.rring >= 0)   { drag = { kind: 'rring',   li: hr.rring,   moved: false, origin: w }; return; }
    }
    if (doc && selWind >= 0) {
        const hw = hit(w.x, w.y);
        if (hw.wvert >= 0) { drag = { kind: 'wvert', i: hw.wvert, moved: false }; return; }
    }
    if (doc) {
        const hb = hit(w.x, w.y);
        if (hb.bvert >= 0) {
            drag = { kind: 'bvert', i: hb.bvert, moved: false, origin: w };
            return;
        }
    }
    if (mode === 'boundary' && doc) {
        // No polygon: dragging sets the circle radius. With a polygon, the circle is
        // not what bounds the arena, so dragging would be a control that lies.
        if (!doc.world.boundary.poly) { drag = { kind: 'bcircle', moved: false }; return; }
        drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
        return;
    }
    if (mode === 'vertex' && (sub === 'sculpt' || sub === 'smooth')) {
        if (!doc) return;
        drag = { kind: sub, last: w, moved: false, origin: w };
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
            marksInspector(); markRefresh(); lineRefresh();
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
    if (mode === 'vertex' && doc && h.ice >= 0 && h.vert >= 0) {
        const f = dice()[h.ice];
        const ref = { kind: 'ice', id: f.id, r: h.ice, i: h.vert };
        if (e.shiftKey) {
            vsel = inSel(ref) ? vsel.filter(v => !sameRef(v, ref)) : vsel.concat([ref]);
            refreshChrome(); draw(); return;
        }
        if (!inSel(ref)) vsel = [ref];
        drag = { kind: 'vsel', last: w, moved: false, origin: w };
        refreshChrome(); draw(); return;
    }
    if (mode === 'vertex' && doc && h.shape && h.vert >= 0) {
        // Which ring the hit vertex belongs to, so the ref is unambiguous.
        const l = shapeById(h.shape);
        let ref = null;
        if (l) {
            if (h.vert < l.outer.length) ref = { kind: 'land', id: l.id, ring: -1, i: h.vert };
            else {
                let rest = h.vert - l.outer.length;
                (l.holes || []).some((hr, hi) => {
                    if (rest < hr.length) { ref = { kind: 'land', id: l.id, ring: hi, i: rest }; return true; }
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
    if (mode === 'shape' && !drawing && doc) {
        if (h.shape) {
            sel = { shape: h.shape, mark: -1, vert: -1, bvert: -1 };
            refreshInspector();
            const l = shapeById(h.shape);
            const c = shapeCentroid(l);
            drag = { kind: (e.metaKey || e.ctrlKey) ? 'rotate' : e.altKey ? 'scale' : 'move',
                     shape: h.shape, last: w, start: w, centre: c, moved: false, origin: w };
            info(); draw(); return;
        }
        sel = { shape: null, mark: -1, vert: -1, bvert: -1 };
        refreshInspector();
        info();
    }
    // Empty space in a mode that owns vertices starts a MARQUEE. Middle mouse is always
    // pan, so left-drag is free for selection — which is the point of the mouse model.
    if (doc && (mode === 'vertex' || mode === 'boundary'
                || (mode === 'wind' && selWind >= 0) || (mode === 'current' && selCur >= 0))) {
        marquee = { a: w, b: w, add: e.shiftKey };
        drag = { kind: 'marquee' };
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
            boatProbe.heading = Math.atan2(w.x - boatProbe.x, -(w.y - boatProbe.y));
            boatInfo(); draw();
        } else if (drag.kind === 'icenew') {
            drag.r = Math.hypot(w.x - drag.origin.x, w.y - drag.origin.y);
            draw();
        } else if (drag.kind === 'ice') {
            const f = dice()[drag.i];
            if (f) {
                const dx = w.x - drag.last.x, dy = w.y - drag.last.y;
                for (const p of f.outer) { p[0] += dx; p[1] += dy; }
            }
            drag.last = w; drag.moved = true; draw();
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
        } else if (drag.kind === 'rcentre') {
            // Moves the MARK, and only the mark. It used to move the land shape when the
            // rounding referenced one, which meant dragging the course dragged the island.
            const e = doc.course.route[drag.li];
            const mi = markIndex(e.markId);
            const m = dmarksOf()[mi];
            if (m) { m.x = w.x; m.y = w.y; }
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
            drag.moved = true; draw();
        } else if (drag.kind === 'wvert') {
            const reg = (mode === 'current') ? cregs()[selCur] : wregs()[selWind];
            w = snapPoint(w, snapCandidates({ kind: mode === 'current' ? 'current' : 'wind',
                                             r: mode === 'current' ? selCur : selWind, i: drag.i }));
            const wp = reg.poly;
            wp[drag.i][0] = w.x; wp[drag.i][1] = w.y;
            drag.moved = true; draw();
        } else if (drag.kind === 'bvert') {
            const bp2 = doc.world.boundary.poly;
            w = snapPoint(w, snapCandidates({ kind: 'arena', i: drag.i }));
            bp2[drag.i][0] = w.x; bp2[drag.i][1] = w.y;
            drag.moved = true; draw();
        } else if (drag.kind === 'sculpt') {
            sculpt(w.x, w.y, w.x - drag.last.x, w.y - drag.last.y);
            drag.last = w; drag.moved = true; draw();
        } else if (drag.kind === 'smooth') {
            smooth(w.x, w.y, 0.35); drag.moved = true; draw();
        } else if (drag.kind === 'vertex') {
            const l = shapeById(drag.shape);
            for (const ring of eachRing(l)) {
                if (drag.vert < ring.length) { ring[drag.vert][0] = w.x; ring[drag.vert][1] = w.y; break; }
            }
            rebake(l); drag.moved = true; draw();
        } else if (drag.kind === 'mark') {
            doc.course.marks[drag.i].x = w.x; doc.course.marks[drag.i].y = w.y;
            drag.moved = true; draw();
        } else if (drag.kind === 'line') {
            const ln = dlines()[drag.i];
            const ends = ln && lineEnds(ln.id);
            if (ends) {
                const dx = w.x - drag.last.x, dy = w.y - drag.last.y;
                for (const m of ends) { m.x += dx; m.y += dy; }
            }
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
            || h.line !== hover.line || h.ice !== hover.ice
            || h.bvert !== hover.bvert || h.wvert !== hover.wvert
            || h.rcentre !== hover.rcentre || h.rring !== hover.rring) { hover = h; draw(); }
        else if (tool === 'sculpt' || tool === 'smooth') draw();
    }

    $('hud').textContent = `${Math.round(uToM(w.x))}, ${Math.round(uToM(w.y))} m   ·   ${view.scale.toFixed(3)}×`
        + (tool === 'sculpt' || tool === 'smooth' ? `   ·   brush ${Math.round(uToM(brush))} m` : '');
});

window.addEventListener('mouseup', () => {
    cv.classList.remove('dragging');
    snapGuide = null;
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'marquee' && marquee) {
        const x0 = Math.min(marquee.a.x, marquee.b.x), x1 = Math.max(marquee.a.x, marquee.b.x);
        const y0 = Math.min(marquee.a.y, marquee.b.y), y1 = Math.max(marquee.a.y, marquee.b.y);
        const hits = modeVertexRefs().filter(v => v.x >= x0 && v.x <= x1 && v.y >= y0 && v.y <= y1)
                                     .map(({ kind, id, ring, i, r }) => ({ kind, id, ring, i, r }));
        vsel = marquee.add ? vsel.concat(hits.filter(h => !inSel(h))) : hits;
        marquee = null;
        refreshChrome(); draw();
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
    if (!(mode === 'vertex' && sub === 'drag') && mode !== 'boundary'
        && mode !== 'wind' && mode !== 'current') return;
    const r = cv.getBoundingClientRect();
    const w = toW(e.clientX - r.left, e.clientY - r.top);
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
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (doc && isDirty()) save(); return; }
    if (e.key === '[') { brush = Math.max(40, brush / 1.25); $('brush').value = Math.round(brush); draw(); return; }
    if (e.key === ']') { brush = Math.min(4000, brush * 1.25); $('brush').value = Math.round(brush); draw(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!doc) return;
        // Marks and gates are deleted HERE, on the water — never as a side effect of a
        // route edit, since the route is only an ordering of them.
        if (mode === 'marks') {
            if (sel.mark >= 0) { deleteMark(sel.mark); return; }
            if (selLine >= 0) { deleteLine(selLine); return; }
        }
        if (mode === 'venue' && selIce >= 0) { deleteIce(selIce); return; }
        if (mode === 'vertex' || mode === 'boundary' || mode === 'wind' || mode === 'current') {
            if (deleteSelectedVertices()) { afterEdit(true, 'delete vertices'); return; }
        }
        if (sel.shape && deleteSelectedShape()) afterEdit(true, 'delete shape');
        return;
    }
    if (e.key === 'Enter' && pending) { commitPending(); return; }
    if (e.key === 'Escape' && pending) { pending = null; draw(); return; }
    // A measurement is deliberately sticky so you can make precise edits against it —
    // so it needs an explicit way out.
    if (e.key === 'Escape' && measure) { measure = null; draw(); return; }
    if (e.key === 'Escape' && (sel.mark >= 0 || selLine >= 0 || selRoute >= 0)) {
        sel = Object.assign({}, NOHIT); selLine = -1; selRoute = -1;
        marksInspector(); markRefresh(); lineRefresh(); routeRefresh(); draw(); return;
    }
    const modes = { '1': 'shape', '2': 'vertex', '3': 'marks', '4': 'route', '5': 'boundary',
                    '6': 'wind', '7': 'current', '8': 'venue', '9': 'map', '0': 'measure' };
    if (modes[e.key]) { setMode(modes[e.key]); return; }
    // Sub-tools only mean something inside vertex mode.
    if (mode === 'vertex') {
        const subs = { d: 'drag', s: 'sculpt', g: 'smooth' };
        if (subs[e.key]) { sub = subs[e.key]; refreshChrome(); draw(); }
    }
});

// Right panel: Overview and Checks are separate panes. The course stats, legend and
// route are what you look at while working; the checks are what you consult. Stacking
// them meant the stats were always pushed off the top.
document.querySelectorAll('[data-pane]').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('[data-pane]').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const p = t.dataset.pane;
    $('pane-overview').classList.toggle('hidden', p !== 'overview');
    $('pane-checks').classList.toggle('hidden', p !== 'checks');
}));

// ── Wire up ─────────────────────────────────────────────────────────────────
// Switching mode clears what that mode owned. A shape left selected in Land mode kept its
// inspector populated and its outline lit while you were editing something else entirely.
function setMode(next) {
    if (mode === 'shape' && next !== 'shape') { sel = Object.assign({}, NOHIT); refreshInspector(); }
    if (mode === 'marks' && next !== 'marks' && next !== 'route') {
        sel = Object.assign({}, NOHIT); selLine = -1; marksInspector();
    }
    mode = next;
    drawing = false; pending = null; vsel = []; marquee = null;
    refreshChrome(); draw();
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelectorAll('.subtool').forEach(b => b.addEventListener('click', () => {
    sub = b.dataset.sub; refreshChrome(); draw();
}));
$('btn-draw').addEventListener('click', () => {
    if (!doc) return;
    drawing = !drawing;
    if (!drawing) pending = null;
    refreshChrome(); draw();
});
$('btn-clear-measure2').addEventListener('click', () => { measure = null; draw(); });
function boatInfo() {
    const box = $('boat-info');
    if (!box) return;
    box.classList.toggle('hidden', !boatProbe);
    if (!boatProbe) return;
    const deg = Math.round(((boatProbe.heading * 180 / Math.PI) % 360 + 360) % 360);
    // Against the wind, because "does it fit" and "can it point there" are usually the
    // same question. windBase points dead upwind, so TWA is the angle off that.
    const twa = Math.abs(((boatProbe.heading - windBase() + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const twaDeg = Math.round(twa * 180 / Math.PI);
    box.innerHTML = `${BOAT_L / 5} m x ${(BOAT_B / 5).toFixed(1)} m (a J111)<br>`
        + `heading ${deg}° · ${twaDeg}° off the wind`
        + `${twaDeg < 38 ? ' — inside the no-go zone' : ''}<br>`
        + `zone ring = ${(BOAT_L * 3) / 5} m, three hull lengths`;
}
$('show-boat').addEventListener('change', () => {
    boatProbe = $('show-boat').checked
        ? { x: view.x, y: view.y, heading: windBase() + Math.PI }   // pointing away from the wind
        : null;
    boatInfo(); draw();
});
$('rt-name').addEventListener('change', () => {
    const e = doc && doc.course.route[selRoute]; if (!e) return;
    const v = $('rt-name').value.trim();
    if (v) e.name = v; else delete e.name;      // blank falls back to the derived label
    afterEdit(true, 'leg name');
});
$('mk-name').addEventListener('change', () => {
    const m = doc && sel.mark >= 0 && doc.course.marks[sel.mark]; if (!m) return;
    const v = $('mk-name').value.trim();
    if (v) m.name = v; else delete m.name;
    afterEdit(true, 'mark name');
});
$('mk-kind').addEventListener('change', () => {
    const m = doc && sel.mark >= 0 && doc.course.marks[sel.mark]; if (!m) return;
    m.kind = $('mk-kind').value;
    afterEdit(true, 'mark kind');
});
$('btn-align-x').addEventListener('click', () => { if (alignSel('x')) afterEdit(true, 'align X'); });
$('btn-align-y').addEventListener('click', () => { if (alignSel('y')) afterEdit(true, 'align Y'); });
$('brush').addEventListener('input', (e) => { brush = +e.target.value; draw(); });
$('btn-undo').addEventListener('click', undo);
$('btn-redo').addEventListener('click', redo);
$('btn-save').addEventListener('click', save);
$('btn-fit').addEventListener('click', fitView);
$('btn-resample').addEventListener('click', () => {
    if (!doc || !sel.shape) { toast('Select a shape first', true); return; }
    resampleShape(shapeById(sel.shape)); afterEdit(true, 'resample');
});
$('insp-type').addEventListener('change', () => {
    const l = shapeById(sel.shape); if (!l) return;
    const t = LAND_TYPES[+$('insp-type').value];
    l.style = t.style; l.cls = t.cls; l.soft = t.soft;
    afterEdit(true, 'shape type');
});
$('insp-soft').addEventListener('change', () => {
    const l = shapeById(sel.shape); if (!l) return;
    l.soft = $('insp-soft').checked;
    afterEdit(true, 'shape soft');
});
$('btn-dup').addEventListener('click', () => {
    if (!doc || !sel.shape) return;
    duplicateShape(); afterEdit(true, 'duplicate');
});
$('btn-del').addEventListener('click', () => {
    if (!doc || !sel.shape) return;
    if (deleteSelectedShape()) afterEdit(true, 'delete shape');
});
$('btn-add-wind').addEventListener('click', () => {
    if (!doc) return; addWindRegion(); afterEdit(true, 'add wind region');
    toast('Wind region added — drag its corners, set direction and speed on the left');
});
$('btn-add-wind-all').addEventListener('click', () => {
    if (!doc) return;
    // One region covering the whole arena: the consistent way to say "the wind over this
    // course differs from the venue default" as a single editable object, rather than
    // having a base-wind control and regions competing to describe the same thing.
    const e2 = window.Arena.extent(course.boundary);
    const pad = 400;
    if (!doc.wind.regions) doc.wind.regions = [];
    let n = 1;
    while (doc.wind.regions.some(r => r.id === `wind-${n}`)) n++;
    doc.wind.regions.push({
        id: `wind-${n}`,
        poly: [[e2.minX - pad, e2.minY - pad], [e2.maxX + pad, e2.minY - pad],
               [e2.maxX + pad, e2.maxY + pad], [e2.minX - pad, e2.maxY + pad]],
        falloff: 300, direction: windBase(), dirVar: 0, speed: null, speedVar: 0, period: 30
    });
    selWind = doc.wind.regions.length - 1;
    afterEdit(true, 'whole-course region');
    toast('Whole-course region added — it starts neutral, so edit its offset and multiplier');
});
$('btn-wr-del').addEventListener('click', () => {
    if (!doc || selWind < 0) return;
    doc.wind.regions.splice(selWind, 1); selWind = -1;
    afterEdit(true, 'delete wind region');
});
$('wind-field').addEventListener('change', (e) => { showField = e.target.checked; draw(); });
[['wr-dir','direction',Math.PI/180], ['wr-dirvar','dirVar',Math.PI/180],
 ['wr-speedvar','speedVar',1],
 ['wr-period','period',1], ['wr-falloff','falloff',U_PER_M]].forEach(([id, key, scale]) => {
    $(id).addEventListener('change', () => {
        const r = wregs()[selWind]; if (!r) return;
        const v = parseFloat($(id).value);
        if (isFinite(v)) { r[key] = v * scale; afterEdit(true, 'wind region'); }
    });
});
// Blank speed means "whatever the venue is doing here", which is what keeps a course that
// only authors direction varying from race to race.
$('wr-speed').addEventListener('change', () => {
    const r = wregs()[selWind]; if (!r) return;
    const raw = $('wr-speed').value.trim();
    if (!raw) { r.speed = null; afterEdit(true, 'wind region'); toast("Speed follows the venue's range"); return; }
    const v = parseFloat(raw);
    if (!isFinite(v) || v < 0 || v > 60) { toast('Speed must be 0–60 kt', true); windRefresh(); return; }
    r.speed = v;
    afterEdit(true, 'wind region');
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
$('btn-mk-del').addEventListener('click', () => { if (doc && sel.mark >= 0) deleteMark(sel.mark); });
$('btn-ln-del').addEventListener('click', () => { if (doc && selLine >= 0) deleteLine(selLine); });
$('mk-name').addEventListener('change', () => {
    const m = doc && sel.mark >= 0 && dmarksOf()[sel.mark]; if (!m) return;
    const v = $('mk-name').value.trim();
    if (v) m.name = v; else delete m.name;      // blank falls back to the derived label
    afterEdit(true, 'mark name');
});
$('mk-kind').addEventListener('change', () => {
    const m = doc && sel.mark >= 0 && dmarksOf()[sel.mark]; if (!m) return;
    m.kind = $('mk-kind').value;
    afterEdit(true, 'mark kind');
});
$('ln-name').addEventListener('change', () => {
    const ln = doc && selLine >= 0 && dlines()[selLine]; if (!ln) return;
    const v = $('ln-name').value.trim();
    if (v) ln.name = v; else delete ln.name;
    afterEdit(true, 'gate name');
});

// ── Route ──────────────────────────────────────────────────────────────────
$('btn-rt-add').addEventListener('click', () => {
    if (!doc) return;
    const ref = $('rt-add-what').value;
    if (!ref) { toast('Nothing to add — make a mark or a gate first', true); return; }
    if (addToRoute(ref, 'through')) { afterEdit(true, 'add leg'); toast('Leg added before the finish'); }
});
$('rt-name').addEventListener('change', () => {
    const e = doc && routeOf()[selRoute]; if (!e) return;
    const v = $('rt-name').value.trim();
    if (v) e.name = v; else delete e.name;
    afterEdit(true, 'leg name');
});

// ── Course identity and timing ─────────────────────────────────────────────
$('course-desc').addEventListener('change', () => {
    if (!doc) return;
    const v = $('course-desc').value.trim();
    if (v) doc.course.description = v; else delete doc.course.description;
    afterEdit(true, 'description');
});
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
$('btn-use-est').addEventListener('click', () => {
    if (!doc || !estimate) return;
    doc.course.cutoff = Math.round(estimate.secs * 1.6);
    afterEdit(true, 'cutoff from estimate');
    toast(`Limit set to ${mmss(doc.course.cutoff)} — 1.6x the estimated best time`);
});

// ── Current regions ────────────────────────────────────────────────────────
$('btn-add-cur').addEventListener('click', () => {
    if (!doc) return; addCurrentRegion(false); afterEdit(true, 'add current region');
    toast('Current region added — drag its corners, set the flow');
});
$('btn-add-cur-all').addEventListener('click', () => {
    if (!doc) return; addCurrentRegion(true); afterEdit(true, 'add current region');
    toast('Current over the whole course — one editable stream');
});
$('btn-cr-del').addEventListener('click', () => {
    if (!doc || selCur < 0) return;
    doc.current.regions.splice(selCur, 1);
    selCur = -1; afterEdit(true, 'delete current region');
});
$('cur-field').addEventListener('change', () => { showCurField = $('cur-field').checked; draw(); });
const curField = (id, fn) => $(id).addEventListener('change', () => {
    const r = cregs()[selCur]; if (!r) return;
    fn(r, parseFloat($(id).value));
    afterEdit(true, 'current region');
});
curField('cr-dir',      (r, v) => r.direction = (v || 0) * Math.PI / 180);
curField('cr-dirvar',   (r, v) => r.dirVar = Math.abs(v || 0) * Math.PI / 180);
curField('cr-speed',    (r, v) => r.speed = Math.max(0, v || 0));
curField('cr-speedvar', (r, v) => r.speedVar = Math.abs(v || 0));
curField('cr-period',   (r, v) => r.period = Math.max(0, v || 0));
curField('cr-falloff',  (r, v) => r.falloff = Math.max(mToU(2), mToU(v || 0)));

// ── Water colour ───────────────────────────────────────────────────────────
for (const id in PAL_KEYS) {
    $(id).addEventListener('change', () => {
        if (!doc) return;
        if (!doc.palette) doc.palette = {};
        doc.palette[PAL_KEYS[id]] = $(id).value;
        afterEdit(true, 'water colour');
    });
}
$('btn-pal-reset').addEventListener('click', () => {
    if (!doc || !doc.palette) return;
    delete doc.palette;
    afterEdit(true, 'water colour');
    toast("Water back to the venue's own colours");
});

// ── Ice ────────────────────────────────────────────────────────────────────
$('btn-ice-del').addEventListener('click', () => { if (selIce >= 0) deleteIce(selIce); });
$('btn-ice-clear').addEventListener('click', () => {
    if (!doc || !dice().length) return;
    const n = dice().length;
    doc.ice = [];
    selIce = -1;
    afterEdit(true, 'clear ice');
    toast(`Removed ${n} hand-placed floe(s)`);
});
// The preview animates only while you are looking at it: the water renderer is the most
// expensive thing on the page and there is no reason to pay for it in Land mode.
setInterval(() => {
    if (mode !== 'current' || !doc) return;
    palPreviewT += 0.25;
    palettePreview();
}, 120);

window.addEventListener('resize', resize);
window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

window.EditorApp = { resize, fitView, loadVenue, draw,
    // exposed for headless tests
    _state: () => ({ doc, findings, history: history.length, histIdx, dirty: isDirty(), tool, sel }),
    _setTool: (t) => { tool = t; refreshChrome(); },
    _sculpt: sculpt, _scaleMap: scaleMap, _afterEdit: afterEdit, _undo: undo, _redo: redo,
    _resample: resampleShape, _shapeById: shapeById, _recompile: recompile,
    _boundaryToRect: boundaryToRect, _boundaryToCircle: boundaryToCircle,
    _toggleFinishOwnLine: toggleFinishOwnLine, _markLabel: (i) => markLabel(i),
    _lineLabel: (id) => lineLabel(id),
    _entryLabel: (i) => entryLabel(doc.course.route[i], i),
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
    _setView: (x, y, sc) => { view.x = x; view.y = y; view.scale = sc;
        if (boatProbe) { boatProbe.x = x; boatProbe.y = y; } boatInfo(); draw(); },
    _addIce: (x, y, r) => addIce(x, y, r),
    _selectShape: (id) => { sel = Object.assign({}, NOHIT, { shape: id }); refreshInspector(); },
    _translateShape: (l, dx, dy) => translateShape(l, dx, dy),
    _deleteIce: (i) => deleteIce(i),
    _selIce: () => selIce,
    _snapPoint: (w, ref) => snapPoint(w, snapCandidates(ref)),
    _previewSeed: (v) => { if (v != null) previewSeed = v; return previewSeed; },
    _legend: () => $('legend').textContent,
    // exposed for headless tests of the selection layer
    _selectVerts: (refs) => { vsel = refs; refreshChrome(); },
    _vselCount: () => vsel.length,
    _moveSel: (dx, dy) => { for (const r of vsel) { const p = vertexArray(r); if (p) { p[0]+=dx; p[1]+=dy; } } rebakeTouched(); },
    _alignSel: (axis) => alignSel(axis),
    _insertNear: (x, y) => insertVertexNear(x, y),
    _deleteSel: () => deleteSelectedVertices() };
})();
