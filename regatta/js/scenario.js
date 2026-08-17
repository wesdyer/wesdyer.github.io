// THE SCENARIO CONSTRUCTOR (scenario.html) — build scenarios that test the
// umpire and the AI: who has rights, and will they duck?
//
// Owner's spec (2026-08-16): no loading screen; just open water; add simple
// objects (sand), marks, lines and boats; choose each boat's initial rotation
// and speed; wind is ALWAYS FROM THE TOP; save scenarios by NAME; a scenario
// LENGTH setting (default 10 s); cmd-drag rotates a boat, option-drag resizes
// an object; boats carry no race places; play the scenario, scrub it, and
// step forward/back while reading what the AI did, which rules applied and
// what penalties were given.
//
// How it works: the real game boots on Sea Trials (open water), the stock
// fleet parks far offshore, and getWindAt is pinned to a uniform breeze from
// the top. EDIT mode freezes placed boats at their initial conditions.
// PLAY first SIMULATES the whole scenario in one fast burst — every frame of
// boat state, AI state (role/risk/deflection), pairwise rights and penalties
// is recorded — then playback is pure scrubbing over that recording, which is
// what makes step-BACK possible. Any edit invalidates the recording.
(function () {
    'use strict';

    // ── loading cover: the page boots a real race under the hood (reset,
    // start, fast-forward to racing) and that setup must never be seen —
    // the cover goes up before the first painted frame and comes down when
    // the stage is ready ──────────────────────────────────────────────────
    const cover = document.createElement('div');
    cover.style.cssText = 'position:fixed;inset:0;z-index:100;background:#0a121c;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#dbe7f3;font:14px system-ui;transition:opacity 0.35s ease';
    cover.innerHTML = '<div style="font:800 26px system-ui;letter-spacing:0.12em;color:#8fd0ff">SCENARIO</div>' +
        '<div id="cover-msg" style="opacity:0.7">setting up open water&hellip;</div>';
    (document.body ? Promise.resolve() : new Promise(r => window.addEventListener('DOMContentLoaded', r)))
        .then(() => document.body.appendChild(cover));
    function dismissCover() {
        cover.style.opacity = '0';
        setTimeout(() => cover.remove(), 400);
    }

    // ── force the open-water venue (cover stays up through the reload) ──
    let savedSettings = {};
    try { savedSettings = JSON.parse(localStorage.getItem('regatta_settings') || '{}'); } catch (e) { }
    if (savedSettings.venue !== 'seatrials') {
        savedSettings.venue = 'seatrials';
        localStorage.setItem('regatta_settings', JSON.stringify(savedSettings));
        location.reload();
        return;
    }

    const STORE_KEY = 'regatta_scenarios';
    const DEG = 180 / Math.PI;
    const LAB = {
        ready: false, mode: 'edit', tool: 'boat',
        boats: [],           // {bot, x, y, heading, speedKt}
        marks: [],           // engine mark objects we added
        sands: [],           // {isl, x, y, r}
        lines: [],           // {x1,y1,x2,y2}
        sel: null,
        windKt: 12,
        durationS: 10,
        cam: { x: 0, y: 0 },
        drag: null,
        pool: [],
        rec: null,           // {frames:[...], ticks:[frameIdx], nF}
        frame: 0, playing: false,
        recording: false,
    };

    // ── UI: the editor convention — LAYERS on the left (the list is the
    // mode switch; “＋” on a layer arms placement), DETAILS on the right
    // (the selected object, or the Scenario layer itself). The play
    // transport stays on the bottom when in use. ───────────────────────
    const panelCss = 'position:fixed;top:12px;z-index:70;background:rgba(10,18,28,0.92);color:#dbe7f3;font:13px/1.5 system-ui,sans-serif;padding:12px 14px;border:1px solid rgba(120,180,220,0.35);border-radius:10px;max-height:calc(100vh - 40px);overflow-y:auto';
    const left = document.createElement('div');
    left.style.cssText = panelCss + ';left:12px;width:172px';
    left.innerHTML = `
      <div style="font-weight:700;font-size:15px;color:#8fd0ff;margin-bottom:6px">SCENARIO</div>
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <button id="lab-reset" style="flex:1">Edit</button><button id="lab-run" style="flex:1">&#9654; Play</button>
      </div>
      <div style="font-weight:700;font-size:11px;letter-spacing:0.1em;color:#7fa8c9;margin-bottom:4px">LAYERS</div>
      <div id="lab-layers"></div>`;
    document.body.appendChild(left);

    const right = document.createElement('div');
    right.style.cssText = panelCss + ';right:12px;width:232px';
    right.innerHTML = `
      <div style="font-weight:700;font-size:11px;letter-spacing:0.1em;color:#7fa8c9;margin-bottom:6px">DETAILS</div>
      <div style="font-weight:600;margin-bottom:4px" id="lab-selname"></div>
      <div id="det-scenario" style="display:none">
        <div style="margin-bottom:6px"><input id="lab-name" type="text" placeholder="scenario name" style="width:100%"></div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">
          <span><label>wind </label><input id="lab-wind" type="number" min="2" max="30" step="1" style="width:44px" value="12"> kt</span>
          <span><label>length </label><input id="lab-dur" type="number" min="2" max="120" step="1" style="width:44px" value="10"> s</span>
        </div>
        <div style="opacity:0.65;font-size:12px;margin-bottom:8px">wind is from the top &#8595;<br>&#8984;-drag rotate boat · &#8997;-drag resize</div>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <select id="lab-list" style="flex:1;min-width:0;background:#0a141c;border:1px solid #345;color:#dbe7f3;border-radius:4px"></select>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <button id="lab-save">Save</button><button id="lab-load">Load</button><button id="lab-delsc">&#10005;</button>
        </div>
        <div style="display:flex;gap:6px">
          <button id="lab-clear">Clear scene</button>
          <button id="lab-json">Copy JSON</button>
        </div>
      </div>
      <div id="det-boat" style="display:none">
        <div style="display:flex;gap:6px;align-items:center;margin-top:2px">
          <label>heading</label><input id="lab-hdg" type="number" step="5" style="width:58px"> &deg;
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
          <label>speed</label><input id="lab-spd" type="number" min="0" max="10" step="0.5" style="width:58px"> kt
        </div>
        <div id="lab-pathrow" style="margin-top:4px;display:none">
          <div><span id="lab-pathinfo" style="opacity:0.8"></span> <button id="lab-pathclr" style="padding:0 6px">clear</button></div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:3px">
            <label title="blank = AI takes over when the path ends">AI at</label>
            <input id="lab-aiat" type="number" min="0" step="0.5" style="width:52px" placeholder="end"> s
          </div>
        </div>
        <div style="margin-top:6px"><button id="lab-pathbtn">&#9998; Draw path</button></div>
      </div>
      <div id="det-mark" style="display:none">
        <div style="display:flex;gap:6px;align-items:center;margin-top:2px">
          <label>rounding</label>
          <button id="lab-side-port">&#8634; Port</button>
          <button id="lab-side-stbd">&#8635; Stbd</button>
        </div>
        <div style="opacity:0.6;margin-top:3px;font-size:12px">zone = 3 boat lengths · &#8997;-drag resizes</div>
      </div>
      <div id="det-sand" style="display:none">
        <div style="opacity:0.6;font-size:12px;margin-top:2px">solid sand · &#8997;-drag resizes · boats ground on it</div>
      </div>
      <div id="det-line" style="display:none">
        <div style="opacity:0.6;font-size:12px;margin-top:2px">a line on the water · drag the end handles · &#8997;-drag stretches</div>
      </div>
      <div id="lab-delrow" style="display:none;margin-top:8px"><button id="lab-del">Delete</button></div>
      <div style="border-top:1px solid #345;padding-top:6px;margin-top:10px">
        <div style="font-weight:600;margin-bottom:3px">RIGHTS &amp; UMPIRE <span id="lab-time" style="opacity:0.7;font-weight:400"></span></div>
        <div id="lab-rights" style="font:12px/1.5 ui-monospace,monospace;color:#bfe3c0;min-height:40px">&mdash;</div>
      </div>`;
    document.body.appendChild(right);
    const ui = { querySelector: (s) => left.querySelector(s) || right.querySelector(s),
                 querySelectorAll: (s) => [...left.querySelectorAll(s), ...right.querySelectorAll(s)] };
    for (const b of ui.querySelectorAll('button')) b.style.cssText += 'background:#123;border:1px solid #467;color:#cde;padding:2px 10px;border-radius:6px;cursor:pointer';
    for (const i of ui.querySelectorAll('input')) i.style.cssText += 'background:#0a141c;border:1px solid #345;color:#dbe7f3;border-radius:4px;padding:1px 4px';

    // the layer list: Scenario, then the object layers with “＋” adders.
    // An armed “＋” means the next click on open water places that kind.
    const LAYERS = [
        ['scenario', 'Scenario', null],
        ['boat', 'Boats', () => LAB.boats.map((lb) => ({ label: 'Boat ' + lb.bot.name, sel: { kind: 'boat', ref: lb } }))],
        ['sand', 'Objects', () => LAB.sands.map((s, i) => ({ label: 'sand ' + (i + 1), sel: { kind: 'sand', ref: s } }))],
        ['mark', 'Marks', () => LAB.marks.map((m, i) => ({ label: 'mark ' + (i + 1), sel: { kind: 'mark', ref: m } }))],
        ['line', 'Lines', () => LAB.lines.map((l, i) => ({ label: 'line ' + (i + 1), sel: { kind: 'line', ref: l, part: 0 } }))],
    ];
    const layersDiv = left.querySelector('#lab-layers');
    function setArmed(kind) {
        LAB.armed = LAB.armed === kind ? null : kind;
        renderLayers();
    }
    function renderLayers() {
        layersDiv.innerHTML = '';
        for (const [kind, label, items] of LAYERS) {
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:2px 6px;border-radius:6px;cursor:pointer;margin-top:2px'
                + (LAB.sel && LAB.sel.kind === 'scenario' && kind === 'scenario' ? ';background:#2a5a8a' : '');
            const name = document.createElement('span');
            name.textContent = label;
            name.style.fontWeight = '600';
            head.appendChild(name);
            if (items) {
                const add = document.createElement('span');
                add.innerHTML = '&#65291;';
                add.title = 'add, then click the water';
                add.style.cssText = 'cursor:pointer;padding:0 6px;border-radius:5px;border:1px solid #467'
                    + (LAB.armed === kind ? ';background:#2a5a8a' : ';background:#123');
                add.onclick = (e) => { e.stopPropagation(); setArmed(kind); };
                head.appendChild(add);
            }
            head.onclick = () => { if (kind === 'scenario') select({ kind: 'scenario' }); };
            layersDiv.appendChild(head);
            if (items) for (const it of items()) {
                const row = document.createElement('div');
                row.textContent = it.label;
                const isSel = LAB.sel && LAB.sel.ref === it.sel.ref;
                row.style.cssText = 'padding:1px 6px 1px 16px;border-radius:6px;cursor:pointer;opacity:0.9'
                    + (isSel ? ';background:#2a5a8a' : '');
                row.onclick = () => select(it.sel);
                layersDiv.appendChild(row);
            }
        }
    }

    // ── playback bar ───────────────────────────────────────────────────
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:70;display:none;align-items:center;gap:8px;background:rgba(10,18,28,0.92);border:1px solid rgba(120,180,220,0.35);border-radius:10px;padding:8px 14px;color:#dbe7f3;font:13px system-ui';
    bar.innerHTML = `
      <button id="pb-back">&#9194;</button>
      <button id="pb-play" style="width:40px">&#9654;</button>
      <button id="pb-fwd">&#9193;</button>
      <span style="position:relative;display:inline-block">
        <input id="pb-slider" type="range" min="0" max="600" value="0" style="width:360px;vertical-align:middle">
        <span id="pb-ticks" style="position:absolute;left:0;right:0;top:26px;height:8px;pointer-events:none"></span>
      </span>
      <span id="pb-time" style="font-family:ui-monospace;min-width:88px;text-align:right">0.0 / 10.0s</span>`;
    document.body.appendChild(bar);
    for (const b of bar.querySelectorAll('button')) b.style.cssText += 'background:#123;border:1px solid #467;color:#cde;padding:2px 8px;border-radius:6px;cursor:pointer';
    const pbSlider = bar.querySelector('#pb-slider');
    const pbPlay = bar.querySelector('#pb-play');
    const pbTime = bar.querySelector('#pb-time');
    const pbTicks = bar.querySelector('#pb-ticks');

    // ── overlay canvas ─────────────────────────────────────────────────
    const ov = document.createElement('canvas');
    ov.style.cssText = 'position:fixed;inset:0;z-index:40;cursor:crosshair';
    document.body.appendChild(ov);
    const octx = ov.getContext('2d');
    function sizeOv() { ov.width = window.innerWidth; ov.height = window.innerHeight; }
    sizeOv(); window.addEventListener('resize', sizeOv);
    const w2s = (wx, wy) => [wx - LAB.cam.x + ov.width / 2, wy - LAB.cam.y + ov.height / 2];
    const s2w = (sx, sy) => [sx - ov.width / 2 + LAB.cam.x, sy - ov.height / 2 + LAB.cam.y];

    // ── boot ───────────────────────────────────────────────────────────
    let _update = null;
    function boot() {
        const st = window.state;
        if (!st || !st.course || typeof window.resetGame !== 'function') return void setTimeout(boot, 250);
        try {
            window.resetGame(); window.startRace();
            for (let i = 0; i < 60 * 120 && st.race.status !== 'racing'; i++) window.update(1 / 60);
        } catch (e) {
            console.error('scenario boot', e);
            const msg = cover.querySelector('#cover-msg');
            if (msg) { msg.textContent = 'boot failed — see console'; msg.style.color = '#ff9b8f'; }
            return;
        }
        window.getWindAt = () => ({ speed: LAB.windKt, direction: 0 });
        st.showNavAids = false;
        const b = st.course.boundary || { x: 0, y: 0 };
        LAB.cam.x = b.x; LAB.cam.y = b.y;
        LAB.stage = { x: b.x, y: b.y };
        LAB.markProto = (st.course.marks || [])[0] ? JSON.parse(JSON.stringify(st.course.marks[0])) : null;
        for (const m of (st.course.marks || [])) {
            m.x += 1e6; m.y += 1e6;
            if (m.body) for (const c of m.body) { c.x += 1e6; c.y += 1e6; }
        }
        for (const o of st.boats) {
            o.x = b.x - 1e6; o.y = b.y - 1e6; o.speed = 0;
            if (o.isPlayer) { o.raceState.finished = false; }
            else { o.raceState.finished = true; o.fadeTimer = 0; LAB.pool.push(o); }
        }
        // boats carry NO race places on this page — just the letter
        window.drawBoatIndicator = function (ctx, boat) {
            if (boat.isPlayer) return;
            if (boat.opacity !== undefined && boat.opacity <= 0) return;
            if (!LAB.boats.some(lb => lb.bot === boat)) return;
            ctx.save();
            ctx.translate(boat.x, boat.y);
            ctx.translate(0, 36);
            ctx.font = 'bold 13px system-ui';
            const w = ctx.measureText(boat.name).width + 16;
            ctx.fillStyle = 'rgba(15,23,42,0.6)';
            ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, 20, 6); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(boat.name, 0, 10);
            ctx.restore();
        };
        refreshList();
        select({ kind: 'scenario' });
        LAB.ready = true;
        dismissCover();
    }

    // ── objects ────────────────────────────────────────────────────────
    function invalidate() {
        LAB.rec = null; LAB.playing = false; LAB.frame = 0;
        if (LAB.mode !== 'edit') LAB.mode = 'edit';
        bar.style.display = 'none';
        pbPlay.innerHTML = '&#9654;';
        if (typeof refreshModeBtns === 'function') refreshModeBtns();
    }
    function addBoat(wx, wy) {
        const bot = LAB.pool.shift();
        if (!bot) return;
        bot.raceState.finished = false; bot.raceState.ocs = false;
        bot.raceState.penalty = false; bot.raceState.totalPenalties = 0;
        // leg 2, deliberately: on Sea Trials leg 1 TARGETS WINDWARD, and the
        // rules engine's zone-latch leg filter skips non-windward marks for a
        // windward-bound pair — rule 18 would never arm at a lab mark. Leg 2
        // targets nothing, so zone snapshots latch on plain geometry.
        bot.raceState.isTacking = false; bot.raceState.leg = 2;
        bot.fadeTimer = 999; bot.opacity = 1;
        const lb = { bot, x: wx, y: wy, heading: Math.PI / 2, speedKt: 6, path: null, aiAtS: null };
        bot.name = String.fromCharCode(65 + LAB.boats.length);
        LAB.boats.push(lb);
        select({ kind: 'boat', ref: lb });
        invalidate();
        return lb;
    }
    function addMark(wx, wy) {
        const proto = LAB.markProto || {};
        const m = JSON.parse(JSON.stringify(proto));
        m.x = wx; m.y = wy;
        if (m.body) { const dx = wx - (proto.x || 0), dy = wy - (proto.y || 0); for (const c of m.body) { c.x += dx; c.y += dy; } }
        // the RRS zone: three hull lengths (3 × 55 = 165 — the engine's own
        // floor). Real rule-18 zone snapshots latch on it. ⌥-drag resizes.
        m.zone = 165;
        m.side = 'port';
        window.state.course.marks.push(m);
        LAB.marks.push(m);
        select({ kind: 'mark', ref: m });
        invalidate();
        return m;
    }
    function sandVerts(wx, wy, R) {
        const verts = [];
        for (let k = 0; k < 10; k++) {
            const a = k / 10 * Math.PI * 2;
            const r = R * (0.85 + 0.3 * Math.abs(Math.sin(k * 2.7)));
            verts.push({ x: wx + Math.cos(a) * r, y: wy + Math.sin(a) * r });
        }
        return verts;
    }
    function addSand(wx, wy, R) {
        R = R || 90;
        // hidden: the engine island renderer needs baked art this synthetic shape
        // doesn't have; the overlay draws the sand. Collisions/rule 19/avoidance
        // still see it — they don't check `hidden`.
        const isl = { x: wx, y: wy, radius: R, vertices: sandVerts(wx, wy, R), isFloe: false, awash: false, hidden: true, labSand: true };
        (window.state.course.islands = window.state.course.islands || []).push(isl);
        const s = { isl, x: wx, y: wy, r: R };
        LAB.sands.push(s);
        select({ kind: 'sand', ref: s });
        invalidate();
        return s;
    }
    function addLine(wx, wy, half) {
        half = half || 150;
        const ln = { x1: wx - half, y1: wy, x2: wx + half, y2: wy };
        LAB.lines.push(ln);
        select({ kind: 'line', ref: ln, part: 0 });
        invalidate();
        return ln;
    }
    function resizeSand(s, R) {
        s.r = Math.max(30, Math.min(500, R));
        s.isl.radius = s.r;
        s.isl.vertices = sandVerts(s.x, s.y, s.r);
    }
    function moveObj(sel, wx, wy) {
        if (sel.kind === 'boat') { sel.ref.x = wx; sel.ref.y = wy; }
        else if (sel.kind === 'mark') {
            const m = sel.ref;
            if (m.body) { const dx = wx - m.x, dy = wy - m.y; for (const c of m.body) { c.x += dx; c.y += dy; } }
            m.x = wx; m.y = wy;
        }
        else if (sel.kind === 'sand') {
            const dx = wx - sel.ref.x, dy = wy - sel.ref.y;
            sel.ref.x = wx; sel.ref.y = wy; sel.ref.isl.x = wx; sel.ref.isl.y = wy;
            for (const v of sel.ref.isl.vertices) { v.x += dx; v.y += dy; }
        } else if (sel.kind === 'line') {
            if (sel.part === 1) { sel.ref.x1 = wx; sel.ref.y1 = wy; }
            else if (sel.part === 2) { sel.ref.x2 = wx; sel.ref.y2 = wy; }
            else {
                const cx = (sel.ref.x1 + sel.ref.x2) / 2, cy = (sel.ref.y1 + sel.ref.y2) / 2;
                const dx = wx - cx, dy = wy - cy;
                sel.ref.x1 += dx; sel.ref.y1 += dy; sel.ref.x2 += dx; sel.ref.y2 += dy;
            }
        }
    }
    function deleteSel() {
        const s = LAB.sel;
        if (!s) return;
        if (s.kind === 'boat') {
            const i = LAB.boats.indexOf(s.ref);
            if (i >= 0) LAB.boats.splice(i, 1);
            s.ref.bot.raceState.finished = true; s.ref.bot.fadeTimer = 0;
            s.ref.bot.x = -1e6; s.ref.bot.y = -1e6;
            LAB.pool.unshift(s.ref.bot);
            LAB.boats.forEach((lb, k) => lb.bot.name = String.fromCharCode(65 + k));
        } else if (s.kind === 'mark') {
            const ms = window.state.course.marks;
            const i = ms.indexOf(s.ref); if (i >= 0) ms.splice(i, 1);
            const j = LAB.marks.indexOf(s.ref); if (j >= 0) LAB.marks.splice(j, 1);
        } else if (s.kind === 'sand') {
            const is = window.state.course.islands;
            const i = is.indexOf(s.ref.isl); if (i >= 0) is.splice(i, 1);
            const j = LAB.sands.indexOf(s.ref); if (j >= 0) LAB.sands.splice(j, 1);
        } else if (s.kind === 'line') {
            const i = LAB.lines.indexOf(s.ref); if (i >= 0) LAB.lines.splice(i, 1);
        }
        select(null);
        invalidate();
    }
    function clearScene() {
        while (LAB.boats.length) { select({ kind: 'boat', ref: LAB.boats[0] }); deleteSel(); }
        while (LAB.marks.length) { select({ kind: 'mark', ref: LAB.marks[0] }); deleteSel(); }
        while (LAB.sands.length) { select({ kind: 'sand', ref: LAB.sands[0] }); deleteSel(); }
        while (LAB.lines.length) { select({ kind: 'line', ref: LAB.lines[0], part: 0 }); deleteSel(); }
        select(null);
        invalidate();
    }

    function pick(wx, wy) {
        for (const ln of LAB.lines) {
            if (Math.hypot(wx - ln.x1, wy - ln.y1) < 30) return { kind: 'line', ref: ln, part: 1 };
            if (Math.hypot(wx - ln.x2, wy - ln.y2) < 30) return { kind: 'line', ref: ln, part: 2 };
        }
        for (const lb of LAB.boats) if (Math.hypot(wx - lb.bot.x, wy - lb.bot.y) < 45) return { kind: 'boat', ref: lb };
        for (const m of LAB.marks) if (Math.hypot(wx - m.x, wy - m.y) < 30) return { kind: 'mark', ref: m };
        for (const s of LAB.sands) if (Math.hypot(wx - s.x, wy - s.y) < s.r) return { kind: 'sand', ref: s };
        for (const ln of LAB.lines) {
            const cx = (ln.x1 + ln.x2) / 2, cy = (ln.y1 + ln.y2) / 2;
            if (Math.hypot(wx - cx, wy - cy) < 40) return { kind: 'line', ref: ln, part: 0 };
        }
        return null;
    }

    const selName = ui.querySelector('#lab-selname');
    const hdgIn = ui.querySelector('#lab-hdg'), spdIn = ui.querySelector('#lab-spd');
    const detSections = { scenario: '#det-scenario', boat: '#det-boat', mark: '#det-mark', sand: '#det-sand', line: '#det-line' };
    function select(s) {
        // no selection = the Scenario layer (the editor convention: the
        // inspector shows the layer itself when nothing is selected)
        if (!s) s = { kind: 'scenario' };
        LAB.sel = s;
        for (const k of Object.keys(detSections)) {
            right.querySelector(detSections[k]).style.display = k === s.kind ? 'block' : 'none';
        }
        right.querySelector('#lab-delrow').style.display = s.kind === 'scenario' ? 'none' : 'block';
        if (s.kind === 'scenario') selName.textContent = 'Scenario';
        else if (s.kind === 'boat') selName.textContent = 'Boat ' + s.ref.bot.name;
        else if (s.kind === 'mark') selName.textContent = 'mark ' + (LAB.marks.indexOf(s.ref) + 1);
        else if (s.kind === 'sand') selName.textContent = 'sand ' + (LAB.sands.indexOf(s.ref) + 1);
        else if (s.kind === 'line') selName.textContent = 'line ' + (LAB.lines.indexOf(s.ref) + 1);
        if (s.kind === 'boat') {
            hdgIn.value = Math.round(((s.ref.heading * DEG) % 360 + 360) % 360);
            spdIn.value = s.ref.speedKt;
            refreshPathRow(s.ref);
        }
        if (s.kind === 'mark') refreshSideBtns(s.ref);
        renderLayers();
    }
    const sidePortB = ui.querySelector('#lab-side-port');
    const sideStbdB = ui.querySelector('#lab-side-stbd');
    function refreshSideBtns(m) {
        sidePortB.style.background = m.side === 'port' ? '#2a5a8a' : '#123';
        sideStbdB.style.background = m.side === 'starboard' ? '#2a5a8a' : '#123';
    }
    sidePortB.onclick = () => { if (LAB.sel && LAB.sel.kind === 'mark') { LAB.sel.ref.side = 'port'; refreshSideBtns(LAB.sel.ref); invalidate(); } };
    sideStbdB.onclick = () => { if (LAB.sel && LAB.sel.kind === 'mark') { LAB.sel.ref.side = 'starboard'; refreshSideBtns(LAB.sel.ref); invalidate(); } };
    const pathRow = ui.querySelector('#lab-pathrow');
    const pathInfo = ui.querySelector('#lab-pathinfo');
    const aiAtIn = ui.querySelector('#lab-aiat');
    const pathBtn = ui.querySelector('#lab-pathbtn');
    function refreshPathRow(lb) {
        const has = lb.path && lb.path.length >= 2;
        pathRow.style.display = has ? 'block' : 'none';
        pathBtn.innerHTML = (LAB.armed === 'path' ? '&#9998; drawing&hellip; (drag from the boat)' : (has ? '&#9998; Redraw path' : '&#9998; Draw path'));
        if (has) {
            const len = Math.round(pathLen(lb.path));
            pathInfo.textContent = `scripted path · ${len}u`;
            aiAtIn.value = lb.aiAtS == null ? '' : lb.aiAtS;
        }
    }
    pathBtn.onclick = () => {
        if (LAB.sel && LAB.sel.kind === 'boat') { setArmed('path'); refreshPathRow(LAB.sel.ref); }
    };
    function pathLen(p) {
        let L = 0;
        for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
        return L;
    }
    ui.querySelector('#lab-pathclr').onclick = () => {
        if (LAB.sel && LAB.sel.kind === 'boat') { LAB.sel.ref.path = null; LAB.sel.ref.aiAtS = null; refreshPathRow(LAB.sel.ref); invalidate(); }
    };
    aiAtIn.addEventListener('input', () => {
        if (LAB.sel && LAB.sel.kind === 'boat') {
            const v = aiAtIn.value.trim();
            LAB.sel.ref.aiAtS = v === '' ? null : Math.max(0, parseFloat(v) || 0);
            invalidate();
        }
    });
    hdgIn.addEventListener('input', () => { if (LAB.sel && LAB.sel.kind === 'boat') { LAB.sel.ref.heading = (parseFloat(hdgIn.value) || 0) / DEG; invalidate(); } });
    spdIn.addEventListener('input', () => { if (LAB.sel && LAB.sel.kind === 'boat') { LAB.sel.ref.speedKt = Math.max(0, parseFloat(spdIn.value) || 0); invalidate(); } });
    ui.querySelector('#lab-del').onclick = deleteSel;
    ui.querySelector('#lab-wind').addEventListener('input', e => { LAB.windKt = Math.max(2, parseFloat(e.target.value) || 12); invalidate(); });
    ui.querySelector('#lab-dur').addEventListener('input', e => { LAB.durationS = Math.max(2, Math.min(120, parseFloat(e.target.value) || 10)); invalidate(); });

    // ── initial conditions / simulate / playback ───────────────────────
    function applyInitial() {
        for (const lb of LAB.boats) {
            const bt = lb.bot;
            bt.x = lb.x; bt.y = lb.y; bt.heading = lb.heading;
            bt.speed = lb.speedKt / 4;   // boat.speed*4 = knots
            bt.velocity = { x: Math.sin(bt.heading) * bt.speed, y: -Math.cos(bt.heading) * bt.speed };
            bt.raceState.isTacking = false; bt.raceState.ocs = false;
            bt.raceState.penalty = false; bt.raceState.totalPenalties = 0;
            bt.raceState.penaltyTurnsOwed = 0;
            const c = bt.controller;
            if (c) { c.lowSpeedTimer = 0; c.wiggleActive = false; c.escActive = false; c.iceEscapeTimer = 0; }
        }
        window.Rules.interactions = {};
    }
    function pairRights() {
        const out = [];
        for (let i = 0; i < LAB.boats.length; i++) {
            for (let j = i + 1; j < LAB.boats.length; j++) {
                const A = LAB.boats[i].bot, B = LAB.boats[j].bot;
                if (Math.hypot(A.x - B.x, A.y - B.y) > 600) continue;
                const res = window.Rules.getRightOfWay(A, B);
                out.push({
                    a: A.name, b: B.name,
                    row: res.boat ? res.boat.name : null,
                    rule: res.rule || null,
                    mk: res.markRoom == null ? null : (res.markRoom === A.id ? A.name : B.name),
                });
            }
        }
        return out;
    }
    function snapshot() {
        return {
            boats: LAB.boats.map(lb => {
                const bt = lb.bot, c = bt.controller;
                return { x: bt.x, y: bt.y, h: bt.heading, s: bt.speed,
                    tk: bt.raceState.isTacking, pen: bt.raceState.penalty,
                    penN: bt.raceState.totalPenalties || 0,
                    mode: lb._mode || 'AI',
                    role: c ? (c.avoidanceRole || '-') : '-',
                    risk: c ? (c.riskState || '-') : '-',
                    dev: c ? +((c.lastAvoidDeviation || 0)).toFixed(2) : 0 };
            }),
            pairs: pairRights(),
        };
    }
    // A SCRIPTED boat is the same hull under the same physics with a different
    // helmsman: her controller's update is replaced by pure pursuit of the
    // drawn path (targetHeading toward a lookahead point, full power), so turn
    // rate, polar speed and the no-go all still apply — the realized track is
    // what the engine allows, not what was drawn. Rules and the umpire keep
    // judging her (forcing a foul is the point); she just doesn't REACT.
    // Handoff to the AI is ONE-WAY (owner ruling): at `aiAtS` seconds, or when
    // the path runs out, the override is deleted (the prototype AI resumes)
    // and her course becomes a far goal along her heading at that moment.
    function scriptedUpdate(lb) {
        return function () {
            const bt = this.boat;
            while (lb._pi < lb.path.length - 1
                && Math.hypot(bt.x - lb.path[lb._pi].x, bt.y - lb.path[lb._pi].y) < 70) lb._pi++;
            let t = lb._pi;
            while (t < lb.path.length - 1
                && Math.hypot(bt.x - lb.path[t].x, bt.y - lb.path[t].y) < 90) t++;
            const p = lb.path[t];
            this.targetHeading = Math.atan2(p.x - bt.x, -(p.y - bt.y));
            this.speedLimit = 1.0;
            lb._done = (t === lb.path.length - 1 && Math.hypot(bt.x - p.x, bt.y - p.y) < 60);
        };
    }
    function handoffToAI(lb) {
        const bt = lb.bot, c = bt.controller;
        if (c && Object.prototype.hasOwnProperty.call(c, 'update')) delete c.update;
        const gx = bt.x + Math.sin(bt.heading) * 8000;
        const gy = bt.y - Math.cos(bt.heading) * 8000;
        if (c) c.getNavigationTarget = () => ({ x: gx, y: gy });
        lb._mode = 'AI';
    }
    function simulate() {
        applyInitial();
        for (const lb of LAB.boats) {
            const bt = lb.bot, c = bt.controller;
            const scripted = lb.path && lb.path.length >= 2 && lb.aiAtS !== 0;
            if (scripted) {
                lb._mode = 'S'; lb._pi = 0; lb._done = false;
                if (c) c.update = scriptedUpdate(lb);
            } else {
                // AI from the start: sail the SET heading as the course —
                // strategy, avoidance, rules and the umpire all live
                lb._mode = 'AI';
                const gx = bt.x + Math.sin(lb.heading) * 8000;
                const gy = bt.y - Math.cos(lb.heading) * 8000;
                if (c) c.getNavigationTarget = () => ({ x: gx, y: gy });
            }
        }
        const nF = Math.round(LAB.durationS * 60);
        const frames = [snapshot()];
        LAB.recording = true;
        for (let f = 1; f <= nF; f++) {
            for (const lb of LAB.boats) {
                if (lb._mode !== 'S') continue;
                const due = lb.aiAtS != null && f >= Math.round(lb.aiAtS * 60);
                if (due || lb._done) handoffToAI(lb);
            }
            _update(1 / 60);
            frames.push(snapshot());
        }
        LAB.recording = false;
        // leave no scripted overrides behind
        for (const lb of LAB.boats) {
            const c = lb.bot.controller;
            if (c && Object.prototype.hasOwnProperty.call(c, 'update')) delete c.update;
        }
        const ticks = [];
        for (let f = 1; f < frames.length; f++) {
            for (let bi = 0; bi < frames[f].boats.length; bi++) {
                if (frames[f].boats[bi].penN > frames[f - 1].boats[bi].penN) { ticks.push(f); break; }
            }
        }
        LAB.rec = { frames, ticks, nF };
        LAB.frame = 0;
        pbSlider.max = nF;
        pbTicks.innerHTML = ticks.map(f =>
            `<span style="position:absolute;left:${(100 * f / nF).toFixed(1)}%;top:0;color:#ff9b8f;font-size:9px">&#9650;</span>`).join('');
        bar.style.display = 'flex';
    }
    function setFrame(f) {
        if (!LAB.rec) return;
        LAB.frame = Math.max(0, Math.min(LAB.rec.nF, Math.round(f)));
    }
    // Edit and Play are MUTUALLY EXCLUSIVE MODES (owner ruling): the page
    // starts in Edit; Play enters playback (simulating if needed) and the
    // transport appears; Edit returns to initial conditions and hides it.
    // Pause lives on the transport, not on the mode buttons.
    const runBtn = ui.querySelector('#lab-run');
    const editBtn = ui.querySelector('#lab-reset');
    function refreshModeBtns() {
        runBtn.style.background = LAB.mode === 'play' ? '#2a5a8a' : '#123';
        editBtn.style.background = LAB.mode === 'edit' ? '#2a5a8a' : '#123';
    }
    function play() {
        if (!LAB.rec) simulate();
        if (LAB.frame >= LAB.rec.nF) LAB.frame = 0;
        LAB.mode = 'play'; LAB.playing = true;
        pbPlay.innerHTML = '&#10074;&#10074;';
        bar.style.display = 'flex';
        refreshModeBtns();
    }
    function pause() { LAB.playing = false; pbPlay.innerHTML = '&#9654;'; }
    function enterEdit() {
        pause();
        LAB.mode = 'edit'; LAB.frame = 0;
        bar.style.display = 'none';
        refreshModeBtns();
    }
    runBtn.onclick = () => { if (LAB.mode !== 'play') play(); };
    pbPlay.onclick = () => { if (LAB.playing) pause(); else { if (LAB.frame >= LAB.rec.nF) LAB.frame = 0; LAB.playing = true; pbPlay.innerHTML = '&#10074;&#10074;'; } };
    bar.querySelector('#pb-back').onclick = () => { pause(); setFrame(LAB.frame - 30); };
    bar.querySelector('#pb-fwd').onclick = () => { pause(); setFrame(LAB.frame + 30); };
    pbSlider.addEventListener('input', () => { pause(); setFrame(+pbSlider.value); });
    editBtn.onclick = enterEdit;
    refreshModeBtns();
    ui.querySelector('#lab-clear').onclick = clearScene;
    window.addEventListener('keydown', e => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        if (e.key === 'Delete' || e.key === 'Backspace') deleteSel();
        if (LAB.rec && LAB.mode === 'play') {
            if (e.key === 'ArrowLeft') { pause(); setFrame(LAB.frame - 1); e.preventDefault(); }
            if (e.key === 'ArrowRight') { pause(); setFrame(LAB.frame + 1); e.preventDefault(); }
            if (e.key === ' ') { pbPlay.onclick(); e.preventDefault(); }
        }
    });

    // ── save / load ────────────────────────────────────────────────────
    function store() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
    function sceneObj() {
        const S = LAB.stage;
        return {
            v: 1, durationS: LAB.durationS, windKt: LAB.windKt,
            boats: LAB.boats.map(lb => ({ x: Math.round(lb.x - S.x), y: Math.round(lb.y - S.y), headingDeg: Math.round(lb.heading * DEG), speedKt: lb.speedKt,
                path: lb.path ? lb.path.map(p => ({ x: Math.round(p.x - S.x), y: Math.round(p.y - S.y) })) : undefined,
                aiAtS: lb.aiAtS == null ? undefined : lb.aiAtS })),
            marks: LAB.marks.map(m => ({ x: Math.round(m.x - S.x), y: Math.round(m.y - S.y), side: m.side || 'port', zone: Math.round(m.zone || 165) })),
            sands: LAB.sands.map(s => ({ x: Math.round(s.x - S.x), y: Math.round(s.y - S.y), r: s.r })),
            lines: LAB.lines.map(l => ({ x1: Math.round(l.x1 - S.x), y1: Math.round(l.y1 - S.y), x2: Math.round(l.x2 - S.x), y2: Math.round(l.y2 - S.y) })),
        };
    }
    function loadScene(sc) {
        clearScene();
        const S = LAB.stage;
        LAB.durationS = sc.durationS || 10; ui.querySelector('#lab-dur').value = LAB.durationS;
        LAB.windKt = sc.windKt || 12; ui.querySelector('#lab-wind').value = LAB.windKt;
        for (const bs of (sc.boats || [])) {
            const lb = addBoat(S.x + bs.x, S.y + bs.y);
            if (lb) {
                lb.heading = (bs.headingDeg || 0) / DEG;
                lb.speedKt = bs.speedKt != null ? bs.speedKt : 6;
                lb.path = bs.path ? bs.path.map(p => ({ x: S.x + p.x, y: S.y + p.y })) : null;
                lb.aiAtS = bs.aiAtS == null ? null : bs.aiAtS;
            }
        }
        for (const ms of (sc.marks || [])) {
            const m = addMark(S.x + ms.x, S.y + ms.y);
            if (ms.side) m.side = ms.side;
            if (ms.zone) m.zone = ms.zone;
        }
        for (const ss of (sc.sands || [])) addSand(S.x + ss.x, S.y + ss.y, ss.r);
        for (const ls of (sc.lines || [])) { const ln = addLine(S.x + (ls.x1 + ls.x2) / 2, S.y + (ls.y1 + ls.y2) / 2); ln.x1 = S.x + ls.x1; ln.y1 = S.y + ls.y1; ln.x2 = S.x + ls.x2; ln.y2 = S.y + ls.y2; }
        select(null);
        invalidate();
    }
    const listSel = ui.querySelector('#lab-list');
    const nameIn = ui.querySelector('#lab-name');
    function refreshList() {
        const names = Object.keys(store()).sort();
        listSel.innerHTML = names.map(n => `<option>${n}</option>`).join('') || '<option value="">(none saved)</option>';
    }
    ui.querySelector('#lab-save').onclick = () => {
        const name = (nameIn.value || '').trim();
        if (!name) { nameIn.focus(); return; }
        const s = store(); s[name] = sceneObj();
        localStorage.setItem(STORE_KEY, JSON.stringify(s));
        refreshList(); listSel.value = name;
    };
    ui.querySelector('#lab-load').onclick = () => {
        const s = store(); const sc = s[listSel.value];
        if (sc) { nameIn.value = listSel.value; loadScene(sc); }
    };
    ui.querySelector('#lab-delsc').onclick = () => {
        const s = store(); delete s[listSel.value];
        localStorage.setItem(STORE_KEY, JSON.stringify(s));
        refreshList();
    };
    ui.querySelector('#lab-json').onclick = () => {
        const txt = JSON.stringify({ name: (nameIn.value || '').trim() || undefined, ...sceneObj() }, null, 1);
        if (navigator.clipboard) navigator.clipboard.writeText(txt);
        console.log(txt);
    };

    // ── pointer input ──────────────────────────────────────────────────
    ov.addEventListener('mousedown', e => {
        if (!LAB.ready) return;
        const [wx, wy] = s2w(e.clientX, e.clientY);
        if (LAB.armed === 'path') {
            // draw a scripted track: start on (or near) a boat; the first point
            // snaps to her bow so pursuit begins where she begins
            let lb = null;
            for (const cand of LAB.boats) if (Math.hypot(wx - cand.x, wy - cand.y) < 70) { lb = cand; break; }
            if (!lb && LAB.sel && LAB.sel.kind === 'boat') lb = LAB.sel.ref;
            if (lb) {
                select({ kind: 'boat', ref: lb });
                lb.path = [{ x: lb.x, y: lb.y }];
                LAB.drag = { pathFor: lb };
                invalidate();
            }
            return;
        }
        const hit = pick(wx, wy);
        if (!hit && LAB.armed) {
            // an armed layer "+": place that kind here, stay armed for more
            if (LAB.armed === 'boat') addBoat(wx, wy);
            else if (LAB.armed === 'mark') addMark(wx, wy);
            else if (LAB.armed === 'sand') addSand(wx, wy);
            else if (LAB.armed === 'line') addLine(wx, wy);
            LAB.drag = { sel: LAB.sel };
            return;
        }
        if (hit) { select(hit); LAB.drag = { sel: hit }; }
        else { select(null); LAB.drag = { pan: true, sx: e.clientX, sy: e.clientY, cx: LAB.cam.x, cy: LAB.cam.y }; }
    });
    ov.addEventListener('mousemove', e => {
        if (!LAB.drag) return;
        if (LAB.drag.pathFor) {
            const [wx, wy] = s2w(e.clientX, e.clientY);
            const p = LAB.drag.pathFor.path;
            const last = p[p.length - 1];
            if (Math.hypot(wx - last.x, wy - last.y) >= 25) p.push({ x: wx, y: wy });
            return;
        }
        if (LAB.drag.pan) {
            LAB.cam.x = LAB.drag.cx - (e.clientX - LAB.drag.sx);
            LAB.cam.y = LAB.drag.cy - (e.clientY - LAB.drag.sy);
            return;
        }
        const [wx, wy] = s2w(e.clientX, e.clientY);
        const s = LAB.drag.sel;
        if (e.metaKey && s.kind === 'boat') {
            // ⌘-drag: rotate — point the bow at the cursor
            s.ref.heading = Math.atan2(wx - s.ref.x, -(wy - s.ref.y));
            hdgIn.value = Math.round(((s.ref.heading * DEG) % 360 + 360) % 360);
            invalidate();
            return;
        }
        if (e.altKey) {
            // ⌥-drag: resize
            if (s.kind === 'sand') { resizeSand(s.ref, Math.hypot(wx - s.ref.x, wy - s.ref.y)); invalidate(); return; }
            if (s.kind === 'mark') {
                s.ref.zone = Math.max(60, Math.min(400, Math.hypot(wx - s.ref.x, wy - s.ref.y)));
                invalidate(); return;
            }
            if (s.kind === 'line') {
                const cx = (s.ref.x1 + s.ref.x2) / 2, cy = (s.ref.y1 + s.ref.y2) / 2;
                let dx = s.ref.x2 - cx, dy = s.ref.y2 - cy;
                const l = Math.hypot(dx, dy) || 1;
                const half = Math.max(40, Math.hypot(wx - cx, wy - cy));
                dx = dx / l * half; dy = dy / l * half;
                s.ref.x1 = cx - dx; s.ref.y1 = cy - dy; s.ref.x2 = cx + dx; s.ref.y2 = cy + dy;
                invalidate(); return;
            }
        }
        moveObj(s, wx, wy);
        invalidate();
    });
    window.addEventListener('mouseup', () => {
        if (LAB.drag && LAB.drag.pathFor) {
            const lb = LAB.drag.pathFor;
            if (!lb.path || lb.path.length < 2) { lb.path = null; lb.aiAtS = null; }
            LAB.armed = null;          // one path per arming
            renderLayers();
            if (LAB.sel && LAB.sel.ref === lb) refreshPathRow(lb);
        }
        LAB.drag = null;
    });

    // ── per-frame ──────────────────────────────────────────────────────
    const rightsEl = ui.querySelector('#lab-rights');
    const timeEl = ui.querySelector('#lab-time');
    function renderRights(pairs, boats) {
        const rows = [];
        for (const p of pairs) {
            rows.push(`${p.a}·${p.b}: row <b>${p.row || '—'}</b> (${p.rule || '—'})` + (p.mk ? ` mk-room <b>${p.mk}</b>` : ''));
        }
        for (let i = 0; i < LAB.boats.length; i++) {
            const nm = LAB.boats[i].bot.name;
            const bi = boats ? boats[i] : null;
            if (bi) {
                const bits = [];
                if (bi.mode === 'S') {
                    // a scripted boat doesn't react, so her controller's
                    // role/risk/deflection are stale — show only the mode
                    bits.push('<span style="color:#ffc46b">scripted</span>');
                } else {
                    if (bi.role && bi.role !== 'NONE' && bi.role !== '-') bits.push(bi.role === 'GIVE_WAY' ? 'give-way' : 'stand-on');
                    if (bi.risk && bi.risk !== 'LOW' && bi.risk !== '-') bits.push('risk ' + bi.risk);
                    if (Math.abs(bi.dev) > 0.05) bits.push('deflecting ' + Math.round(Math.abs(bi.dev) * DEG) + '°');
                }
                if (bi.tk) bits.push('tacking');
                if (bi.pen) bits.push('<span style="color:#ff9b8f">PENALTY</span>');
                if (bi.penN) bits.push(`<span style="color:#ff9b8f">${bi.penN} pen</span>`);
                if (bits.length) rows.push(`${nm}: ${bits.join(' · ')}`);
            } else if (LAB.boats[i].bot.raceState.penalty) {
                rows.push(`<span style="color:#ff9b8f">${nm}: PENALTY</span>`);
            }
        }
        rightsEl.innerHTML = rows.length ? rows.join('<br>') : '—';
    }
    function frame() {
        if (!LAB.ready || LAB.recording) return;
        const st = window.state;
        st.wind.direction = 0; st.wind.baseDirection = 0;
        st.wind.speed = LAB.windKt; st.wind.baseSpeed = LAB.windKt;
        const b0 = LAB.stage || { x: 0, y: 0 };
        for (const o of st.boats) {
            const mine = LAB.boats.some(lb => lb.bot === o);
            if (!mine) { o.x = b0.x - 1e6; o.y = b0.y - 1e6; o.speed = 0; o.velocity = { x: 0, y: 0 }; }
        }
        if (LAB.mode === 'edit') {
            applyInitialFrame();
            renderRights(pairRights(), null);
            timeEl.textContent = '';
        } else if (LAB.rec) {
            if (LAB.playing) {
                LAB.frame++;
                if (LAB.frame >= LAB.rec.nF) { LAB.frame = LAB.rec.nF; pause(); }
            }
            const fr = LAB.rec.frames[LAB.frame];
            for (let i = 0; i < LAB.boats.length && i < fr.boats.length; i++) {
                const bt = LAB.boats[i].bot, fb = fr.boats[i];
                bt.x = fb.x; bt.y = fb.y; bt.heading = fb.h; bt.speed = fb.s;
                bt.velocity = { x: Math.sin(fb.h) * fb.s, y: -Math.cos(fb.h) * fb.s };
                bt.raceState.isTacking = fb.tk;
                bt.raceState.penalty = fb.pen;
            }
            pbSlider.value = LAB.frame;
            const t = LAB.frame / 60;
            pbTime.textContent = `${t.toFixed(1)} / ${LAB.durationS.toFixed(1)}s`;
            timeEl.textContent = `t=${t.toFixed(1)}s`;
            renderRights(fr.pairs, fr.boats);
        }
        // camera: ours, north-up
        st.camera.rotation = 0;
        st.camera.x = LAB.cam.x; st.camera.y = LAB.cam.y;
        st.camera.fx = LAB.cam.x; st.camera.fy = LAB.cam.y;
        st.camera.target = 'boat';
        drawOverlay();
    }
    function applyInitialFrame() {
        for (const lb of LAB.boats) {
            const bt = lb.bot;
            bt.x = lb.x; bt.y = lb.y; bt.heading = lb.heading;
            bt.speed = lb.speedKt / 4;
            bt.velocity = { x: Math.sin(bt.heading) * bt.speed, y: -Math.cos(bt.heading) * bt.speed };
            bt.raceState.isTacking = false;
            bt.raceState.penalty = false; bt.raceState.totalPenalties = 0;
            bt.raceState.penaltyTurnsOwed = 0; bt.raceState.ocs = false;
        }
    }
    function drawOverlay() {
        octx.clearRect(0, 0, ov.width, ov.height);
        for (const s of LAB.sands) {
            octx.beginPath();
            const vs = s.isl.vertices;
            const [sx0, sy0] = w2s(vs[0].x, vs[0].y);
            octx.moveTo(sx0, sy0);
            for (let k = 1; k < vs.length; k++) { const [px, py] = w2s(vs[k].x, vs[k].y); octx.lineTo(px, py); }
            octx.closePath();
            octx.fillStyle = 'rgba(224,201,155,0.95)'; octx.fill();
            octx.strokeStyle = 'rgba(180,155,110,0.9)'; octx.lineWidth = 3; octx.stroke();
        }
        for (const m of LAB.marks) {
            const [px, py] = w2s(m.x, m.y);
            const Z = m.zone || 165;
            // the zone ring, and the way round: port rounding keeps the mark to
            // port = counterclockwise on screen; starboard = clockwise. Arc +
            // arrowhead, echoing the game's own rounding-circle language.
            const ccw = m.side !== 'starboard';
            octx.beginPath(); octx.arc(px, py, Z, 0, Math.PI * 2);
            octx.strokeStyle = 'rgba(94,234,212,0.55)'; octx.lineWidth = 2;
            octx.setLineDash([9, 9]); octx.stroke(); octx.setLineDash([]);
            const a0 = -Math.PI / 2 + (ccw ? 0.5 : -0.5);
            const a1 = a0 + (ccw ? -1.6 : 1.6);
            octx.beginPath(); octx.arc(px, py, Z * 0.62, a0, a1, ccw);
            octx.strokeStyle = 'rgba(94,234,212,0.9)'; octx.lineWidth = 3.5; octx.lineCap = 'round';
            octx.stroke();
            const hx = px + Math.cos(a1) * Z * 0.62, hy = py + Math.sin(a1) * Z * 0.62;
            const tang = a1 + (ccw ? -Math.PI / 2 : Math.PI / 2);
            octx.save();
            octx.translate(hx, hy); octx.rotate(tang);
            octx.beginPath(); octx.moveTo(-9, -6); octx.lineTo(4, 0); octx.lineTo(-9, 6); octx.closePath();
            octx.fillStyle = 'rgba(94,234,212,0.9)'; octx.fill();
            octx.restore();
            octx.beginPath(); octx.arc(px, py, 12, 0, 7);
            octx.fillStyle = '#f0a02a'; octx.fill();
            octx.strokeStyle = '#fff'; octx.lineWidth = 2.5; octx.stroke();
        }
        for (const ln of LAB.lines) {
            const [x1, y1] = w2s(ln.x1, ln.y1), [x2, y2] = w2s(ln.x2, ln.y2);
            octx.beginPath(); octx.moveTo(x1, y1); octx.lineTo(x2, y2);
            octx.strokeStyle = 'rgba(255,255,255,0.85)'; octx.lineWidth = 3; octx.setLineDash([10, 8]); octx.stroke(); octx.setLineDash([]);
            for (const [px, py] of [[x1, y1], [x2, y2]]) { octx.beginPath(); octx.arc(px, py, 6, 0, 7); octx.fillStyle = '#fff'; octx.fill(); }
        }
        // scripted paths: the DRAWN line dotted in the boat's colour; during
        // playback the REALIZED track solid beneath it — the gap between the
        // two is the physics (turn rate, polar, no-go) doing its job
        for (let i = 0; i < LAB.boats.length; i++) {
            const lb = LAB.boats[i];
            const col = (lb.bot.colors && lb.bot.colors.hull) || '#8fd0ff';
            if (lb.path && lb.path.length >= 2) {
                octx.beginPath();
                const [px0, py0] = w2s(lb.path[0].x, lb.path[0].y);
                octx.moveTo(px0, py0);
                for (let k = 1; k < lb.path.length; k++) { const [px, py] = w2s(lb.path[k].x, lb.path[k].y); octx.lineTo(px, py); }
                octx.strokeStyle = col; octx.globalAlpha = 0.85; octx.lineWidth = 2.5;
                octx.setLineDash([7, 7]); octx.stroke(); octx.setLineDash([]); octx.globalAlpha = 1;
                const end = lb.path[lb.path.length - 1];
                const [ex, ey] = w2s(end.x, end.y);
                octx.beginPath(); octx.arc(ex, ey, 5, 0, 7); octx.fillStyle = col; octx.fill();
            }
            if (LAB.mode === 'play' && LAB.rec && LAB.frame > 1) {
                octx.beginPath();
                let started = false;
                for (let f = 0; f <= LAB.frame; f += 4) {
                    const fb = LAB.rec.frames[f].boats[i];
                    if (!fb) break;
                    const [px, py] = w2s(fb.x, fb.y);
                    if (!started) { octx.moveTo(px, py); started = true; } else octx.lineTo(px, py);
                }
                octx.strokeStyle = col; octx.globalAlpha = 0.5; octx.lineWidth = 3;
                octx.stroke(); octx.globalAlpha = 1;
            }
        }
        if (LAB.sel && LAB.sel.kind !== 'scenario' && LAB.mode === 'edit') {
            let cx, cy, r = 40;
            const s = LAB.sel;
            if (s.kind === 'boat') { cx = s.ref.bot.x; cy = s.ref.bot.y; r = 48; }
            else if (s.kind === 'mark') { cx = s.ref.x; cy = s.ref.y; r = 26; }
            else if (s.kind === 'sand') { cx = s.ref.x; cy = s.ref.y; r = s.ref.r + 14; }
            else { cx = (s.ref.x1 + s.ref.x2) / 2; cy = (s.ref.y1 + s.ref.y2) / 2; r = 30; }
            const [px, py] = w2s(cx, cy);
            octx.beginPath(); octx.arc(px, py, r, 0, 7);
            octx.strokeStyle = 'rgba(143,208,255,0.9)'; octx.lineWidth = 2; octx.setLineDash([6, 6]); octx.stroke(); octx.setLineDash([]);
        }
        // (no wind arrow: the wind comets on the water already show direction
        // and strength, and the knots value is editable in the panel)
    }

    _update = window.update;
    window.update = function (dt) { _update(dt); try { frame(); } catch (e) { } };

    window.addEventListener('load', () => setTimeout(boot, 400));
})();
