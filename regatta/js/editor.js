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

let tool = 'select';
let sel = { shape: null, mark: -1, vert: -1, bvert: -1 };
let hover = { shape: null, mark: -1, vert: -1, bvert: -1 };
let brush = 260;

let view = { x: 0, y: 0, scale: 0.1 };
let drag = null;
let measure = null;

const cv = $('schematic');
const ctx = cv.getContext('2d');

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
function recompile() {
    const seed = parseInt($('seed-input').value, 10) || 1;
    window.VENUE_DOC[doc.venue] = doc;
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: doc.venue }));
    const real = Math.random;
    Math.random = mulberry32(seed);
    try { resetGame(); } finally { Math.random = real; }
    course = state.course;
    floes = (course.islands || []).filter(i => !i.fromMask);
    runChecks();
}

function runChecks() {
    const compiled = { marks: course.marks, boundary: course.boundary, roundMark: course.roundMark, route: course.route };
    findings = window.VenueCheck.run({ doc, compiled, boats: state.boats, floes });
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
    draw();
}

// ── Load / save ─────────────────────────────────────────────────────────────
let fileHandle = null;

function loadVenue() {
    const key = $('venue-select').value;
    const src = window.VenueDoc.get(key);
    selFinding = -1;
    sel = { shape: null, mark: -1, vert: -1 };
    if (!src) {
        // Generated venue: nothing authored to edit. Show it read-only rather than
        // pretending otherwise.
        doc = null; fileHandle = null; savedJSON = null;
        history = []; histIdx = -1;
        const seed = parseInt($('seed-input').value, 10) || 1;
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
        info(); refreshChrome(); fitView();
        return;
    }
    doc = clone(src);
    savedJSON = JSON.stringify(doc);
    history = [{ doc: clone(doc), label: 'loaded' }];
    histIdx = 0;
    fileHandle = null;
    recompile(); info(); refreshChrome(); fitView();
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
    document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    $('brush-row').style.display = (tool === 'sculpt' || tool === 'smooth') ? 'flex' : 'none';
    const hints = {
        select: 'Click a shape to select. Drag = move · Shift+drag = rotate · Alt+drag = scale · Delete = remove',
        vertex: 'Drag a vertex. Double-click an edge to insert · Delete removes the hovered vertex',
        sculpt: 'Drag to push nearby vertices. [ ] resize the brush',
        smooth: 'Drag to relax nearby vertices toward their neighbours. [ ] resize the brush',
        mark:   'Drag a start-line end. Drag the rounding ring to resize its zone',
        bcircle:'Drag a boundary vertex to reshape the arena. With a circle, drag to set its radius. Use Fit / Circle below',
        measure:'Drag to measure a distance, with the leg time it implies'
    };
    $('hint').textContent = hints[tool] || '';
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
        if (tool === 'bcircle' || tool === 'vertex') {
            dbd.poly.forEach((pt, i) => {
                const sp = toS(pt[0], pt[1]);
                const on = hover.bvert === i;
                ctx.fillStyle = on ? '#94a3b8' : 'rgba(148,163,184,0.7)';
                ctx.beginPath(); ctx.arc(sp.x, sp.y, on ? 6 : 4, 0, Math.PI * 2); ctx.fill();
            });
        }
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
                        ctx.fillStyle = on ? '#38bdf8' : 'rgba(56,189,248,0.65)';
                        ctx.beginPath(); ctx.arc(s.x, s.y, on ? 5 : 3, 0, Math.PI * 2); ctx.fill();
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

    const rm = course && course.roundMark;
    if (rm) {
        const p = toS(rm.x, rm.y);
        ctx.strokeStyle = '#fbbf24'; ctx.setLineDash([4, 5]); ctx.lineWidth = tool === 'mark' ? 2.5 : 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, rm.zone * view.scale, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
    }

    const marks = doc ? doc.course.marks : (course ? course.marks : []);
    if (marks && marks.length >= 2) {
        const a = toS(marks[0].x, marks[0].y), b = toS(marks[1].x, marks[1].y);
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    (marks || []).forEach((m, i) => {
        const p = toS(m.x, m.y);
        const on = hover.mark === i || sel.mark === i;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(p.x, p.y, on ? 7 : 4.5, 0, Math.PI * 2); ctx.fill();
        if (on) { ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2; ctx.stroke(); }
    });

    if (tool === 'sculpt' || tool === 'smooth') {
        const m = lastMouse;
        if (m) {
            ctx.strokeStyle = 'rgba(56,189,248,0.5)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(m.sx, m.sy, brush * view.scale, 0, Math.PI * 2); ctx.stroke();
        }
    }

    drawFinding();
    if (measure) drawMeasure();
    windArrow();
    scaleBar();
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
    const a = toS(measure.a.x, measure.a.y), b = toS(measure.b.x, measure.b.y);
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const d = Math.hypot(measure.b.x - measure.a.x, measure.b.y - measure.a.y);
    // 5 units = 1 metre, and the game's own cutoff model is 0.1875 s/m; 0.71 is the
    // measured ratio of mean race time to cutoff.
    const secs = (d / 5) * 0.1875 * 0.71;
    ctx.fillStyle = '#ddd6fe'; ctx.font = '600 12px "IBM Plex Mono", monospace';
    ctx.fillText(`${Math.round(d)}u · ${Math.round(d / 5)}m · ~${Math.floor(secs/60)}:${String(Math.round(secs%60)).padStart(2,'0')}`,
        (a.x + b.x) / 2 + 8, (a.y + b.y) / 2 - 8);
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
    const w = doc ? doc.wind.baseDirection : (state.wind ? state.wind.baseDirection : 0);
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
    let units = 100;
    while (units * view.scale < 70) units *= 2;
    const px = units * view.scale, x = W() - px - 22, y = H() - 26;
    ctx.strokeStyle = '#8ea0bd'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y-4); ctx.lineTo(x, y); ctx.lineTo(x+px, y); ctx.lineTo(x+px, y-4); ctx.stroke();
    ctx.fillStyle = '#8ea0bd'; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${units}u · ${(units/5).toFixed(0)}m`, x + px/2, y - 8);
    ctx.textAlign = 'left';
}

// ── Info panel ──────────────────────────────────────────────────────────────
const row = (k, v) => `<div class="row"><span>${k}</span><span class="t-mono">${v}</span></div>`;
const mmss = s => `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`;

function info() {
    if (!course) return;
    const m = course.marks || [];
    $('info-course').innerHTML =
        row('venue', $('venue-select').value) +
        row('type', course.type || 'wl') +
        row('legs', state.race.totalLegs) +
        row('wind', Math.round((doc ? doc.wind.baseDirection : state.wind.baseDirection) * 180/Math.PI) + '°') +
        row('boundary r', course.boundary ? Math.round(course.boundary.radius) + 'u' : '—') +
        row('marks', m.length) +
        (course.roundMark ? row('rounding', `${course.roundMark.side}, zone ${Math.round(course.roundMark.zone)}u`) : '');

    let dist = 0, note = '';
    if (course.type === 'islandRound' && course.roundMark && m[0] && m[1]) {
        const sx = (m[0].x + m[1].x)/2, sy = (m[0].y + m[1].y)/2;
        const leg = Math.hypot(course.roundMark.x - sx, course.roundMark.y - sy);
        dist = leg * 2 * 1.45; note = 'start → island → finish, ×1.45 for beating';
    } else {
        dist = (state.race.totalLegs || 2) * (state.race.legLength || 4000);
        note = `${state.race.totalLegs} legs × ${Math.round(state.race.legLength)}u`;
    }
    const cutoff = (dist/5) * 0.1875, expected = cutoff * 0.71;
    const band = expected >= 180 && expected <= 300;
    $('info-time').innerHTML =
        row('sailed dist', Math.round(dist) + 'u / ' + Math.round(dist/5) + 'm') +
        row('cutoff', mmss(cutoff)) +
        `<div class="row"><span>expected</span><span class="t-mono" style="color:${band?'#6ee7b7':'#fbbf24'}">${mmss(expected)}${band?'':'  ⚠'}</span></div>`
        + `<div class="text-slate-500 mt-1" style="font-size:11px">${note}</div>`;

    if (doc) {
        const verts = doc.land.reduce((a,l)=>a+l.outer.length,0);
        const holes = doc.land.reduce((a,l)=>a+(l.holes||[]).length,0);
        $('info-land').innerHTML =
            row('shapes', doc.land.length) + row('vertices', verts) + row('holes', holes) +
            row('drifting ice', floes.length) +
            row('world', doc.world.size + 'u') +
            (sel.shape ? row('selected', sel.shape) : '');
    } else {
        const isl = course.islands || [];
        $('info-land').innerHTML = row('shapes', isl.length)
            + row('vertices', isl.reduce((a,i)=>a+((i.vertices||[]).length),0));
    }
}

// ── Hit testing ─────────────────────────────────────────────────────────────
function hit(wx, wy) {
    const r = 10 / view.scale;                              // screen-constant grab radius
    const out = { shape: null, mark: -1, vert: -1, bvert: -1 };
    const bp = doc && doc.world.boundary.poly;
    if (bp && (tool === 'bcircle' || tool === 'vertex')) {
        for (let i = 0; i < bp.length; i++) {
            if (Math.hypot(bp[i][0] - wx, bp[i][1] - wy) < r) { out.bvert = i; return out; }
        }
    }
    const marks = doc ? doc.course.marks : [];
    for (let i = 0; i < marks.length; i++) {
        if (Math.hypot(marks[i].x - wx, marks[i].y - wy) < r * 1.4) { out.mark = i; return out; }
    }
    if (!doc) return out;
    // Vertices win over bodies: a vertex sits ON its shape's outline, so testing
    // bodies first would make vertices unreachable.
    for (const l of doc.land) {
        for (const ring of eachRing(l)) {
            for (let i = 0; i < ring.length; i++) {
                if (Math.hypot(ring[i][0] - wx, ring[i][1] - wy) < r) { out.shape = l.id; out.vert = i; return out; }
            }
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
function insertVertexNear(wx, wy) {
    let best = null;
    for (const l of doc.land) {
        for (const ring of eachRing(l)) {
            for (let i = 0; i < ring.length; i++) {
                const a = ring[i], b = ring[(i + 1) % ring.length];
                const dx = b[0]-a[0], dy = b[1]-a[1], l2 = dx*dx+dy*dy;
                let t = l2 ? ((wx-a[0])*dx + (wy-a[1])*dy)/l2 : 0;
                t = Math.max(0, Math.min(1, t));
                const px = a[0]+t*dx, py = a[1]+t*dy;
                const d = Math.hypot(wx-px, wy-py);
                if (!best || d < best.d) best = { d, ring, i, px, py, l };
            }
        }
    }
    if (best && best.d < 24 / view.scale) {
        best.ring.splice(best.i + 1, 0, [best.px, best.py]);
        rebake(best.l);
        return true;
    }
    return false;
}
function deleteHoveredVertex() {
    if (!hover.shape || hover.vert < 0) return false;
    const l = shapeById(hover.shape);
    for (const ring of eachRing(l)) {
        if (hover.vert < ring.length && ring.length > 3) {
            // Guard the minimum: a ring below 3 points is degenerate and the
            // validator would reject the document.
            ring.splice(hover.vert, 1); rebake(l); return true;
        }
    }
    return false;
}
// Redistribute a ring's vertices evenly along its own perimeter. Heavy sculpting
// bunches them up, which makes further editing feel sticky.
function resampleShape(l) {
    for (const ring of eachRing(l)) {
        const n = ring.length;
        if (n < 4) continue;
        let per = 0;
        const seg = [];
        for (let i = 0; i < n; i++) {
            const a = ring[i], b = ring[(i+1)%n];
            const d = Math.hypot(b[0]-a[0], b[1]-a[1]);
            seg.push(d); per += d;
        }
        const step = per / n, out = [];
        let i = 0, carry = 0;
        for (let k = 0; k < n; k++) {
            let want = step;
            while (want > 0 && i < n) {
                const rem = seg[i] - carry;
                if (rem > want) { carry += want; want = 0; }
                else { want -= rem; i++; carry = 0; }
            }
            const a = ring[Math.min(i, n-1)], b = ring[(Math.min(i, n-1)+1)%n];
            const t = seg[Math.min(i, n-1)] ? carry / seg[Math.min(i, n-1)] : 0;
            out.push([a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t]);
        }
        ring.length = 0; out.forEach(p => ring.push(p));
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

cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect();
    const w = toW(e.clientX - r.left, e.clientY - r.top);
    if (e.button === 1 || e.altKey && tool === 'pan') { return; }

    if (tool === 'measure') { measure = { a: w, b: w }; drag = { kind: 'measure' }; return; }
    if (doc && (tool === 'bcircle' || tool === 'vertex')) {
        const hb = hit(w.x, w.y);
        if (hb.bvert >= 0) {
            drag = { kind: 'bvert', i: hb.bvert, moved: false };
            return;
        }
    }
    if (tool === 'bcircle' && doc) {
        // No polygon: dragging sets the circle radius. With a polygon, the circle is
        // not what bounds the arena, so dragging would be a control that lies.
        if (!doc.world.boundary.poly) { drag = { kind: 'bcircle', moved: false }; return; }
        drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
        return;
    }
    if (tool === 'sculpt' || tool === 'smooth') {
        if (!doc) return;
        drag = { kind: tool, last: w, moved: false };
        return;
    }

    const h = hit(w.x, w.y);
    if (tool === 'mark' && doc) {
        if (h.mark >= 0) { sel = { shape: null, mark: h.mark, vert: -1 }; drag = { kind: 'mark', i: h.mark, last: w, moved: false }; }
        else if (course.roundMark) {
            const d = Math.hypot(w.x - course.roundMark.x, w.y - course.roundMark.y);
            if (Math.abs(d - course.roundMark.zone) < 26 / view.scale) drag = { kind: 'zone', last: w, moved: false };
        }
        draw(); return;
    }
    if (tool === 'vertex' && doc && h.shape && h.vert >= 0) {
        sel = { shape: h.shape, mark: -1, vert: h.vert };
        drag = { kind: 'vertex', shape: h.shape, vert: h.vert, last: w, moved: false };
        draw(); return;
    }
    if (tool === 'select' && doc) {
        if (h.shape) {
            sel = { shape: h.shape, mark: -1, vert: -1 };
            const l = shapeById(h.shape);
            const c = shapeCentroid(l);
            drag = { kind: e.shiftKey ? 'rotate' : e.altKey ? 'scale' : 'move',
                     shape: h.shape, last: w, start: w, centre: c, moved: false };
            info(); draw(); return;
        }
        sel = { shape: null, mark: -1, vert: -1 };
        info();
    }
    // Nothing grabbed: pan.
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    cv.classList.add('dragging');
});

window.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const w = toW(sx, sy);
    lastMouse = { sx, sy, w };

    if (drag) {
        if (drag.kind === 'pan') {
            view.x = drag.vx - (e.clientX - drag.sx) / view.scale;
            view.y = drag.vy - (e.clientY - drag.sy) / view.scale;
            draw();
        } else if (drag.kind === 'measure') {
            measure.b = w; draw();
        } else if (drag.kind === 'bcircle') {
            const b = doc.world.boundary;
            const cx = b.circle ? b.circle.x : 0, cy = b.circle ? b.circle.y : 0;
            const rad = Math.max(200, Math.hypot(w.x - cx, w.y - cy));
            b.circle = { x: cx, y: cy, r: rad };
            drag.moved = true; draw();
        } else if (drag.kind === 'bvert') {
            const bp2 = doc.world.boundary.poly;
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
        if (h.shape !== hover.shape || h.vert !== hover.vert || h.mark !== hover.mark || h.bvert !== hover.bvert) { hover = h; draw(); }
        else if (tool === 'sculpt' || tool === 'smooth') draw();
    }

    $('hud').textContent = `${Math.round(w.x)}, ${Math.round(w.y)}   ·   ${view.scale.toFixed(3)}×`
        + (tool === 'sculpt' || tool === 'smooth' ? `   ·   brush ${brush}u` : '');
});

window.addEventListener('mouseup', () => {
    cv.classList.remove('dragging');
    if (!drag) return;
    const d = drag; drag = null;
    // ONE undo entry per drag, not one per mousemove. Both snapshot and command
    // undo need this; it is what makes a sculpt stroke a single action.
    if (d.moved && d.kind !== 'pan' && d.kind !== 'measure') afterEdit(true, d.kind);
});

cv.addEventListener('dblclick', (e) => {
    if (tool !== 'vertex' || !doc) return;
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
        if (tool === 'vertex' && hover.vert >= 0) { if (deleteHoveredVertex()) afterEdit(true, 'delete vertex'); return; }
        if (sel.shape) {
            const rEntry = doc.course.route.find(x => x.kind === 'round');
            if (rEntry && rEntry.landId === sel.shape) { toast('That shape is the rounding mark — repoint the route first', true); return; }
            doc.land = doc.land.filter(l => l.id !== sel.shape);
            sel = { shape: null, mark: -1, vert: -1 };
            afterEdit(true, 'delete shape');
        }
        return;
    }
    const keys = { v: 'select', a: 'vertex', s: 'sculpt', m: 'mark', b: 'bcircle', r: 'measure', g: 'smooth' };
    if (keys[e.key]) { tool = keys[e.key]; refreshChrome(); draw(); }
});

// ── Wire up ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => {
    tool = b.dataset.tool; refreshChrome(); draw();
}));
$('brush').addEventListener('input', (e) => { brush = +e.target.value; draw(); });
$('btn-undo').addEventListener('click', undo);
$('btn-redo').addEventListener('click', redo);
$('btn-save').addEventListener('click', save);
$('btn-fit').addEventListener('click', fitView);
$('btn-resample').addEventListener('click', () => {
    if (!doc || !sel.shape) { toast('Select a shape first', true); return; }
    resampleShape(shapeById(sel.shape)); afterEdit(true, 'resample');
});
$('btn-brect').addEventListener('click', () => {
    if (!doc) return;
    boundaryToRect(0); afterEdit(true, 'boundary rect');
    toast('Arena set to the map rectangle');
});
$('btn-bcircle').addEventListener('click', () => {
    if (!doc) return;
    boundaryToCircle(); afterEdit(true, 'boundary circle');
    toast('Arena set to a circle');
});
$('btn-scalemap').addEventListener('click', () => {
    if (!doc) return;
    const pct = parseFloat($('scalemap').value);
    if (!isFinite(pct) || pct <= 0) { toast('Enter a percentage', true); return; }
    scaleMap(pct / 100); afterEdit(true, 'scale map');
});
$('venue-select').addEventListener('change', () => {
    if (doc && isDirty() && !confirm('Discard unsaved changes?')) {
        $('venue-select').value = doc.venue; return;
    }
    loadVenue();
});
$('seed-input').addEventListener('change', () => { if (doc) { recompile(); info(); draw(); } else loadVenue(); });
window.addEventListener('resize', resize);
window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

window.EditorApp = { resize, fitView, loadVenue, draw,
    // exposed for headless tests
    _state: () => ({ doc, findings, history: history.length, histIdx, dirty: isDirty(), tool, sel }),
    _setTool: (t) => { tool = t; refreshChrome(); },
    _sculpt: sculpt, _scaleMap: scaleMap, _afterEdit: afterEdit, _undo: undo, _redo: redo,
    _resample: resampleShape, _shapeById: shapeById,
    _boundaryToRect: boundaryToRect, _boundaryToCircle: boundaryToCircle };
})();
