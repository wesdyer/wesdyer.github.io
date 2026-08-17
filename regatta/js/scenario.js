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
        <div style="margin-bottom:8px"><input id="lab-name" type="text" placeholder="Scenario Name" style="width:100%"></div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <label style="width:64px">Duration</label><input id="lab-dur" type="text" inputmode="decimal" style="width:56px" value="10"> s
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
          <label style="width:64px">Wind</label><input id="lab-wind" type="text" inputmode="decimal" style="width:56px" value="12"> kt
        </div>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <button id="lab-new">New</button><button id="lab-open">Open&hellip;</button>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button id="lab-save">Save</button><button id="lab-saveas">Save As&hellip;</button>
        </div>
        <div style="border-top:1px solid #345;padding-top:6px">
          <div style="opacity:0.65;font-size:12px;margin-bottom:4px">library: <span id="lab-libname">assets/scenarios.js — File&hellip; to attach for writing</span></div>
          <div style="display:flex;gap:6px">
            <button id="lab-libopen" title="attach assets/scenarios.js so saves write to it">File&hellip;</button>
            <button id="lab-clear">Clear scene</button>
          </div>
        </div>
      </div>
      <div id="det-play" style="display:none">
        <div style="font-weight:600;margin-bottom:3px">RIGHTS &amp; UMPIRE <span id="lab-time" style="opacity:0.7;font-weight:400"></span></div>
        <div id="lab-rights" style="font:12px/1.5 ui-monospace,monospace;color:#bfe3c0;min-height:40px">&mdash;</div>
        <div style="opacity:0.6;font-size:12px;margin-top:6px">scrub or step on the transport below · space pauses</div>
      </div>
      <div id="det-boat" style="display:none">
        <div style="display:flex;gap:6px;align-items:center;margin-top:2px">
          <label>heading</label><input id="lab-hdg" type="number" step="5" style="width:58px"> &deg;
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
          <label>speed</label><input id="lab-spd" type="number" min="0" max="10" step="0.5" style="width:58px"> kt
        </div>
        <div style="border-top:1px solid #345;margin-top:8px;padding-top:6px">
          <div style="font-weight:600;margin-bottom:2px">Plan</div>
          <div id="lab-plan"></div>
          <button id="lab-planadd" style="margin-top:4px">+ step</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
          <label title="blank = scripted to the end">AI at</label>
          <input id="lab-aiat" type="number" min="0" step="0.5" style="width:52px" placeholder="never"> s
        </div>
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
      <div id="lab-delrow" style="display:none;margin-top:8px"><button id="lab-del">Delete</button></div>`;
    document.body.appendChild(right);
    const ui = { querySelector: (s) => left.querySelector(s) || right.querySelector(s),
                 querySelectorAll: (s) => [...left.querySelectorAll(s), ...right.querySelectorAll(s)] };
    for (const b of ui.querySelectorAll('button')) b.style.cssText += 'background:#123;border:1px solid #467;color:#cde;padding:2px 10px;border-radius:6px;cursor:pointer';
    for (const i of ui.querySelectorAll('input')) i.style.cssText += 'background:#0a141c;border:1px solid #345;color:#dbe7f3;border-radius:4px;padding:1px 4px';

    // the layer list: Scenario, then the object layers with “＋” adders.
    // An armed “＋” means the next click on open water places that kind.
    const LAYERS = [
        ['scenario', 'Scenario', null],
        ['boat', 'Boats', () => LAB.boats.map((lb) => ({ label: lb.bot.name, sel: { kind: 'boat', ref: lb } }))],
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
        // a constructor is silent: no effects, no music (in-memory only — the
        // shared settings blob is never written from this page, so the game's
        // own sound preferences are untouched)
        if (typeof settings !== 'undefined') {
            settings.soundEnabled = false;
            settings.bgSoundEnabled = false;
            settings.musicEnabled = false;
        }
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
        select({ kind: 'scenario' });
        LAB.ready = true;
        // restore the working draft, if one survived a reload
        try {
            const d = JSON.parse(localStorage.getItem(STORE_KEY + '_draft') || 'null');
            if (d && ((d.boats && d.boats.length) || (d.marks && d.marks.length)
                   || (d.sands && d.sands.length) || (d.lines && d.lines.length))) {
                LAB._loading = true;
                loadScene(d);
                if (d.name) ui.querySelector('#lab-name').value = d.name;
                LAB._loading = false;
                select({ kind: 'scenario' });
            }
        } catch (e) { LAB._loading = false; }
        restoreLibHandle();
        dismissCover();
    }

    // ── objects ────────────────────────────────────────────────────────
    function invalidate() {
        LAB.rec = null; LAB.playing = false; LAB.frame = 0;
        if (LAB.mode !== 'edit') LAB.mode = 'edit';
        bar.style.display = 'none';
        pbPlay.innerHTML = '&#9654;';
        if (typeof refreshModeBtns === 'function') refreshModeBtns();
        saveDraft();
    }
    // the working scene survives a reload: every edit stores a draft, boot
    // restores it. Debounced a beat so drag storms don't hammer storage.
    let _draftT = null;
    function saveDraft() {
        if (!LAB.ready || LAB._loading) return;
        clearTimeout(_draftT);
        _draftT = setTimeout(() => {
            try {
                localStorage.setItem(STORE_KEY + '_draft', JSON.stringify({
                    name: (ui.querySelector('#lab-name').value || '').trim(), ...sceneObj() }));
            } catch (e) { }
        }, 400);
    }
    // THE CAST, alphabetical by character name, optimized for colour clarity:
    // brute-forced over every per-letter roster combination for the maximum
    // minimum pairwise Lab distance, with the water colour included as a
    // fixed swatch so no hull can vanish into the blue (which is why Bixby's
    // royal blue lost his slot). Winner at min-ΔLab 43.7: sage, ink navy,
    // pink, tan, terracotta, purple, ice white, violet, orange. Hug and
    // Jester are forced (the only H and J names); the roster has no 'I', so
    // the ninth boat jumps to J — and nine is the most the parked pool can
    // supply anyway. Fixed identities also make a saved scenario look and
    // sail the same on every load (a pool recruit used to keep whichever
    // random character boot dealt it).
    const LAB_CHARS = ['Anchor', 'Bramble', 'Cheer', 'Dozer', 'Etienne', 'Flare', 'Glide', 'Hug', 'Jester'];
    function applyLabIdentity(lb, i) {
        const want = LAB_CHARS[i] || String.fromCharCode(65 + i);
        const cfg = (typeof AI_CONFIG !== 'undefined') ? AI_CONFIG.find(c => c.name === want) : null;
        if (cfg && typeof applyBoatIdentity === 'function') applyBoatIdentity(lb.bot, cfg, false);
        else lb.bot.name = want;
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
        const lb = { bot, x: wx, y: wy, heading: Math.PI / 2, speedKt: 6, plan: [], aiAtS: null };
        LAB.boats.push(lb);
        applyLabIdentity(lb, LAB.boats.length - 1);
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
            // keep the alphabet contiguous: later boats take over the freed identities
            LAB.boats.forEach((lb, k) => applyLabIdentity(lb, k));
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
    const detSections = { scenario: '#det-scenario', boat: '#det-boat', mark: '#det-mark', sand: '#det-sand', line: '#det-line', play: '#det-play' };
    function select(s) {
        // no selection = the Scenario layer (the editor convention: the
        // inspector shows the layer itself when nothing is selected).
        // During PLAY nothing else is selectable: the inspector is the
        // rights & umpire readout, full stop.
        if (LAB.mode === 'play') s = { kind: 'play' };
        if (!s) s = { kind: 'scenario' };
        LAB.sel = s;
        for (const k of Object.keys(detSections)) {
            right.querySelector(detSections[k]).style.display = k === s.kind ? 'block' : 'none';
        }
        right.querySelector('#lab-delrow').style.display = (s.kind === 'scenario' || s.kind === 'play') ? 'none' : 'block';
        if (s.kind === 'scenario') selName.textContent = '';
        else if (s.kind === 'play') selName.textContent = '';
        else if (s.kind === 'boat') selName.textContent = s.ref.bot.name;
        else if (s.kind === 'mark') selName.textContent = 'mark ' + (LAB.marks.indexOf(s.ref) + 1);
        else if (s.kind === 'sand') selName.textContent = 'sand ' + (LAB.sands.indexOf(s.ref) + 1);
        else if (s.kind === 'line') selName.textContent = 'line ' + (LAB.lines.indexOf(s.ref) + 1);
        if (s.kind === 'boat') {
            hdgIn.value = Math.round(((s.ref.heading * DEG) % 360 + 360) % 360);
            spdIn.value = s.ref.speedKt;
            refreshPathRow(s.ref);
            renderPlan(s.ref);
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
    const aiAtIn = ui.querySelector('#lab-aiat');
    function refreshPathRow(lb) {
        aiAtIn.value = lb.aiAtS == null ? '' : lb.aiAtS;
    }

    // ── THE PLAN: helm orders on a clock. The initial condition is the
    // boat's heading + speed; each step says "at t seconds, steer to this
    // heading" (the boat turns the SHORT way at her real turn rate, and her
    // speed follows the polar for wherever she points) with an optional
    // spinnaker order — the engine's own 5-second hoist/douse plays out
    // whenever the order changes the kite. A plan takes precedence over a
    // (the plan is the only scripting mode — the freehand drawn path retired
    // in its favour) ─────────────────────────────────────────────────────
    const planDiv = ui.querySelector('#lab-plan');
    function renderPlan(lb) {
        planDiv.innerHTML = '';
        const plan = lb.plan || (lb.plan = []);
        plan.sort((a, b) => a.t - b.t);
        for (const en of plan) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:4px;align-items:center;margin-top:3px;font-size:12px';
            const tIn = document.createElement('input');
            tIn.type = 'text'; tIn.inputMode = 'decimal'; tIn.value = en.t;
            tIn.style.cssText = 'width:38px;background:#0a141c;border:1px solid #345;color:#dbe7f3;border-radius:4px;padding:1px 3px';
            tIn.title = 'time (s)';
            tIn.addEventListener('change', () => { en.t = Math.max(0, parseFloat(tIn.value) || 0); renderPlan(lb); invalidate(); });
            const hIn = document.createElement('input');
            hIn.type = 'text'; hIn.inputMode = 'decimal'; hIn.value = en.headingDeg;
            hIn.style.cssText = 'width:38px;background:#0a141c;border:1px solid #345;color:#dbe7f3;border-radius:4px;padding:1px 3px';
            hIn.title = 'new heading (°)';
            hIn.addEventListener('change', () => { en.headingDeg = parseFloat(hIn.value) || 0; invalidate(); });
            const sSel = document.createElement('select');
            sSel.style.cssText = 'background:#0a141c;border:1px solid #345;color:#dbe7f3;border-radius:4px;font-size:12px';
            for (const [v, lbl] of [['auto', 'kite auto'], ['up', 'kite up'], ['down', 'kite down']]) {
                const o = document.createElement('option'); o.value = v; o.textContent = lbl; sSel.appendChild(o);
            }
            sSel.value = en.spin || 'auto';
            sSel.addEventListener('change', () => { en.spin = sSel.value; invalidate(); });
            const del = document.createElement('span');
            del.innerHTML = '&#10005;';
            del.style.cssText = 'cursor:pointer;opacity:0.6;padding:0 3px';
            del.onclick = () => { plan.splice(plan.indexOf(en), 1); renderPlan(lb); invalidate(); };
            const sLab = document.createElement('span'); sLab.textContent = 's'; sLab.style.opacity = '0.6';
            const dLab = document.createElement('span'); dLab.innerHTML = '&deg;'; dLab.style.opacity = '0.6';
            row.append(tIn, sLab, hIn, dLab, sSel, del);
            planDiv.appendChild(row);
        }
        if (!plan.length) {
            const p = document.createElement('div');
            p.style.cssText = 'opacity:0.55;font-size:12px';
            p.textContent = 'initial heading + speed, then steps';
            planDiv.appendChild(p);
        }
    }
    ui.querySelector('#lab-planadd').onclick = () => {
        if (!LAB.sel || LAB.sel.kind !== 'boat') return;
        const lb = LAB.sel.ref;
        const last = lb.plan.length ? lb.plan[lb.plan.length - 1] : null;
        lb.plan.push({ t: last ? last.t + 5 : 5, headingDeg: Math.round(lb.heading * DEG), spin: 'auto' });
        renderPlan(lb);
        invalidate();
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
            // kite starts stowed — a pool recruit otherwise carries whatever
            // hoist state its parked racing life left behind
            bt.spinnaker = false; bt.spinnakerDeployProgress = 0;
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
                    sp: !!bt.spinnaker, spp: +(bt.spinnakerDeployProgress || 0).toFixed(3),
                    penN: bt.raceState.totalPenalties || 0,
                    mode: lb._mode || 'AI',
                    role: c ? (c.avoidanceRole || '-') : '-',
                    risk: c ? (c.riskState || '-') : '-',
                    dev: c ? +((c.lastAvoidDeviation || 0)).toFixed(2) : 0 };
            }),
            pairs: pairRights(),
        };
    }
    // PLAN mode: helm orders on the sim clock. The physics turns the boat
    // toward targetHeading the SHORT way at her real rate, and speed follows
    // the polar for the point of sail she passes through; the kite order is
    // applied after updateAI's own call (see the wrapper below), so the
    // engine's 5-second hoist/douse crossfade plays out on every change.
    function planUpdate(lb) {
        return function () {
            let hdg = lb.heading, spin = 'auto';
            for (const en of lb.plan) {
                if (LAB.simT >= en.t) { hdg = (en.headingDeg || 0) / DEG; spin = en.spin || 'auto'; }
                else break;
            }
            this.targetHeading = hdg;
            this.speedLimit = 1.0;
            lb._spinForce = spin === 'auto' ? null : (spin === 'up');
        };
    }
    // the kite order must land AFTER updateAI writes boat.spinnaker (its AWA
    // rule runs every frame) and BEFORE updateBoat integrates the hoist
    const _updateAI = window.updateAI;
    window.updateAI = function (boat, dt) {
        _updateAI(boat, dt);
        if (LAB.recording) {
            for (const lb of LAB.boats) {
                if (lb.bot === boat && lb._mode === 'S' && lb._spinForce != null) { boat.spinnaker = lb._spinForce; break; }
            }
        }
    };
    function handoffToAI(lb) {
        const bt = lb.bot, c = bt.controller;
        if (c && Object.prototype.hasOwnProperty.call(c, 'update')) delete c.update;
        const gx = bt.x + Math.sin(bt.heading) * 8000;
        const gy = bt.y - Math.cos(bt.heading) * 8000;
        if (c) c.getNavigationTarget = () => ({ x: gx, y: gy });
        lb._mode = 'AI'; lb._spinForce = null;
    }
    function simulate() {
        applyInitial();
        for (const lb of LAB.boats) {
            const bt = lb.bot, c = bt.controller;
            const scripted = lb.plan && lb.plan.length > 0 && lb.aiAtS !== 0;
            if (scripted) {
                lb._mode = 'S'; lb._spinForce = null;
                if (c) c.update = planUpdate(lb);
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
        // DETERMINISM: a testing tool must give the same verdict for the same
        // scenario. The AI rolls Math.random (wiggle sides, tie-breaks), so the
        // burst runs under a seeded PRNG (mulberry32) and the real one comes
        // back afterwards — playback is scrubbing a recording, so nothing
        // visual depends on this.
        const realRandom = Math.random;
        let rngState = 0x9e3779b9;
        Math.random = function () {
            rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
            let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        try {
            for (let f = 1; f <= nF; f++) {
                LAB.simT = f / 60;   // the plan's clock
                for (const lb of LAB.boats) {
                    if (lb._mode !== 'S') continue;
                    const due = lb.aiAtS != null && f >= Math.round(lb.aiAtS * 60);
                    if (due) handoffToAI(lb);
                }
                _update(1 / 60);
                frames.push(snapshot());
            }
        } finally {
            Math.random = realRandom;
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
        select(null);   // play mode: the inspector is Rights & Umpire, nothing else
    }
    function pause() { LAB.playing = false; pbPlay.innerHTML = '&#9654;'; }
    function enterEdit() {
        pause();
        LAB.mode = 'edit'; LAB.frame = 0;
        bar.style.display = 'none';
        refreshModeBtns();
        select({ kind: 'scenario' });
    }
    runBtn.onclick = () => { if (LAB.mode !== 'play') play(); };
    pbPlay.onclick = () => { if (LAB.playing) pause(); else { if (LAB.frame >= LAB.rec.nF) LAB.frame = 0; LAB.playing = true; pbPlay.innerHTML = '&#10074;&#10074;'; } };
    bar.querySelector('#pb-back').onclick = () => { pause(); setFrame(LAB.frame - 30); };
    bar.querySelector('#pb-fwd').onclick = () => { pause(); setFrame(LAB.frame + 30); };
    pbSlider.addEventListener('input', () => { pause(); setFrame(+pbSlider.value); });
    editBtn.onclick = enterEdit;
    refreshModeBtns();
    ui.querySelector('#lab-clear').onclick = clearScene;
    // THE KEYBOARD IS OURS, NOT THE GAME'S. This is a constructor, not a race:
    // no ESC pause menu, no steering keys, no camera modes. Every game key
    // handler lives on WINDOW (verified — none on document), so a DOCUMENT-
    // level bubble interceptor sits exactly between the two worlds: the
    // focused input has already received the trusted key (target phase runs
    // first), and stopping propagation here starves every window handler.
    // The earlier window-capture design leaked in two ways — keys typed into
    // fields continued to the game ('c' in a scenario name flipped the
    // camera), and keys with a dialog open fell through.
    function swallowKeys(e) {
        const t = e.target;
        const typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
        if (e.type === 'keydown') {
            if (typing) {
                if (e.key === 'Escape') { t.blur(); e.preventDefault(); }
            } else if (LAB.modal) {
                if (e.key === 'Escape') { LAB.modal.close(); e.preventDefault(); }
                // any other key while a dialog is up: dead air
            } else {
                if (e.key === 'Delete' || e.key === 'Backspace') deleteSel();
                else if (e.key === 'Escape') { if (LAB.armed) setArmed(LAB.armed); else select(null); }
                else if (LAB.rec && LAB.mode === 'play') {
                    if (e.key === 'ArrowLeft') { pause(); setFrame(LAB.frame - 1); }
                    else if (e.key === 'ArrowRight') { pause(); setFrame(LAB.frame + 1); }
                    else if (e.key === ' ') pbPlay.onclick();
                }
                e.preventDefault();   // no space-scroll, no browser shortcuts on the stage
            }
        }
        e.stopPropagation();          // the game's window handlers never hear a key
    }
    document.addEventListener('keydown', swallowKeys, false);
    document.addEventListener('keyup', swallowKeys, false);
    document.addEventListener('keypress', swallowKeys, false);

    // ── save / load ────────────────────────────────────────────────────
    function store() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
    function sceneObj() {
        const S = LAB.stage;
        return {
            v: 1, durationS: LAB.durationS, windKt: LAB.windKt,
            boats: LAB.boats.map(lb => ({ x: Math.round(lb.x - S.x), y: Math.round(lb.y - S.y), headingDeg: Math.round(lb.heading * DEG), speedKt: lb.speedKt,
                plan: (lb.plan && lb.plan.length) ? lb.plan.map(en => ({ t: en.t, headingDeg: en.headingDeg, spin: en.spin || 'auto' })) : undefined,
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
                lb.plan = bs.plan ? bs.plan.map(en => ({ t: en.t, headingDeg: en.headingDeg, spin: en.spin || 'auto' })).sort((a, b) => a.t - b.t) : [];
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
    const nameIn = ui.querySelector('#lab-name');
    nameIn.addEventListener('input', () => saveDraft());

    // ── THE LIBRARY: one file for every scenario (owner ruling — unlike the
    // editor's file-per-venue, a scenario is small; the whole collection is
    // a single scenarios.js, always loaded and saved). The library also
    // mirrors to localStorage so the page works before a file is chosen;
    // when a file handle is attached, every Save/Delete rewrites it. ─────
    // The library's WELL-KNOWN HOME is assets/scenarios.js (committed, loaded
    // by this page at boot — the venue-document convention, but one file for
    // everything). The localStorage mirror layers on top: at boot the shipped
    // file seeds the library and local saves win on name conflicts, so work
    // saved before the file was attached never vanishes. Attaching the file
    // via File… makes every save/delete write assets/scenarios.js itself.
    function store() {
        let local = {};
        try { local = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { }
        const shipped = (window.SCENARIO_DOC && typeof window.SCENARIO_DOC === 'object') ? window.SCENARIO_DOC : {};
        return { ...shipped, ...local };
    }
    function persistLib(lib) {
        localStorage.setItem(STORE_KEY, JSON.stringify(lib));
        if (LAB.libHandle) writeLibFile(lib);
    }
    // ── remember the library file across reloads (the editor's pattern:
    // the handle lives in IndexedDB; permission needs a user gesture, so a
    // remembered file reattaches silently only when Chrome still grants it,
    // and otherwise waits for the File… click to claim it) ───────────────
    function handleDB() {
        return new Promise((res, rej) => {
            const rq = indexedDB.open('regatta-scenario', 1);
            rq.onupgradeneeded = () => rq.result.createObjectStore('handles');
            rq.onsuccess = () => res(rq.result);
            rq.onerror = () => rej(rq.error);
        });
    }
    async function rememberLibHandle(h) {
        try {
            const db = await handleDB();
            await new Promise((res, rej) => {
                const tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(h, 'lib');
                tx.oncomplete = res; tx.onerror = () => rej(tx.error);
            });
        } catch (_) { /* best-effort; the page works without it */ }
    }
    async function recallLibHandle() {
        try {
            const db = await handleDB();
            return await new Promise((res, rej) => {
                const rq = db.transaction('handles', 'readonly').objectStore('handles').get('lib');
                rq.onsuccess = () => res(rq.result || null);
                rq.onerror = () => rej(rq.error);
            });
        } catch (_) { return null; }
    }
    function parseLibText(text) {
        try { return JSON.parse(text); } catch (_) {
            const m = /window\.SCENARIO_DOC\s*=\s*(\{[\s\S]*\});?\s*$/.exec(text.trim());
            if (m) { try { return JSON.parse(m[1]); } catch (_) { } }
        }
        return null;
    }
    async function attachLibHandle(h) {
        const file = await h.getFile();
        const lib = parseLibText(await file.text());
        LAB.libHandle = h;
        ui.querySelector('#lab-libname').textContent = file.name;
        if (lib && typeof lib === 'object') persistLib(lib);
        else writeLibFile(store());   // empty/new file: adopt it, write the library out
        rememberLibHandle(h);
    }
    async function restoreLibHandle() {
        const h = await recallLibHandle();
        if (!h) return;
        try {
            if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') {
                await attachLibHandle(h);
            } else {
                // permission lapsed: surface the name; File… (a gesture) reclaims it
                LAB.pendingHandle = h;
                ui.querySelector('#lab-libname').textContent = (h.name || 'library') + ' — click File… to reattach';
            }
        } catch (e) {
            // moved or deleted since last session — fall back to the picker path
            LAB.pendingHandle = null;
        }
    }
    async function writeLibFile(lib) {
        const text = '// The SCYC scenario library — one file, every scenario.\n'
            + '// Written by scenario.html; JS not JSON so it loads over file://.\n'
            + 'window.SCENARIO_DOC = ' + JSON.stringify(lib, null, 2) + ';\n';
        try {
            const w = await LAB.libHandle.createWritable();
            try { await w.write(text); await w.close(); }
            catch (e) { try { await w.abort(); } catch (_) { } throw e; }
        } catch (e) { console.error('library write failed', e); }
    }
    async function chooseLibFile() {
        try {
            // a remembered handle whose permission lapsed: this click is the
            // gesture that reclaims it — no picker needed
            if (LAB.pendingHandle) {
                const h = LAB.pendingHandle;
                try {
                    if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') {
                        LAB.pendingHandle = null;
                        await attachLibHandle(h);
                        return;
                    }
                } catch (_) { /* fall through to the picker */ }
                LAB.pendingHandle = null;
            }
            if (window.showOpenFilePicker) {
                const [h] = await window.showOpenFilePicker({
                    id: 'scenario-lib',
                    types: [{ description: 'Scenario library', accept: { 'text/javascript': ['.js'], 'application/json': ['.json'] } }],
                });
                await attachLibHandle(h);
            } else {
                // no File System Access API: export as a download instead
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([
                    'window.SCENARIO_DOC = ' + JSON.stringify(store(), null, 2) + ';\n'
                ], { type: 'text/javascript' }));
                a.download = 'scenarios.js'; a.click();
                URL.revokeObjectURL(a.href);
            }
        } catch (e) { if (!e || e.name !== 'AbortError') console.error('library open failed', e); }
    }

    // ── in-window dialogs (no browser confirm/prompt on this page) ─────
    function dialog(title, bodyEl, buttons) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:0;z-index:95;background:rgba(4,8,14,0.55);display:flex;align-items:center;justify-content:center';
        const box = document.createElement('div');
        box.style.cssText = 'min-width:280px;max-width:400px;max-height:70vh;display:flex;flex-direction:column;background:rgba(10,18,28,0.98);border:1px solid rgba(120,180,220,0.4);border-radius:10px;padding:14px 16px;color:#dbe7f3;font:13px/1.5 system-ui';
        const h = document.createElement('div');
        h.textContent = title;
        h.style.cssText = 'font-weight:700;color:#8fd0ff;margin-bottom:8px';
        box.appendChild(h);
        if (bodyEl) { bodyEl.style.overflowY = 'auto'; box.appendChild(bodyEl); }
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px';
        const close = () => { wrap.remove(); LAB.modal = null; };
        for (const b of buttons) {
            const btn = document.createElement('button');
            btn.textContent = b.label;
            btn.style.cssText = 'border:1px solid #467;color:#cde;padding:3px 12px;border-radius:6px;cursor:pointer;background:' + (b.primary ? '#2a5a8a' : '#123');
            btn.onclick = () => { close(); if (b.onClick) b.onClick(); };
            row.appendChild(btn);
        }
        box.appendChild(row);
        wrap.appendChild(box);
        wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); e.stopPropagation(); });
        document.body.appendChild(wrap);
        LAB.modal = { close };
        return { close };
    }
    function confirmDialog(title, text, onYes, yesLabel) {
        const p = document.createElement('div');
        p.textContent = text;
        dialog(title, p, [{ label: 'Cancel' }, { label: yesLabel || 'OK', primary: true, onClick: onYes }]);
    }

    // ── dirty tracking + New / Open / Save / Save As ───────────────────
    function currentDoc() { return JSON.stringify({ name: (nameIn.value || '').trim(), ...sceneObj() }); }
    function markSaved() { LAB.savedJSON = currentDoc(); }
    function isDirty() {
        const empty = !LAB.boats.length && !LAB.marks.length && !LAB.sands.length && !LAB.lines.length;
        if (LAB.savedJSON == null) return !empty;
        return currentDoc() !== LAB.savedJSON;
    }
    function ifClean(action, then) {
        if (!isDirty()) return then();
        confirmDialog(action, 'There are unsaved changes. Discard them?', then, 'Discard');
    }
    function newScenario() {
        ifClean('New scenario', () => {
            clearScene();
            nameIn.value = '';
            LAB.durationS = 10; ui.querySelector('#lab-dur').value = 10;
            LAB.windKt = 12; ui.querySelector('#lab-wind').value = 12;
            markSaved();
            select({ kind: 'scenario' });
        });
    }
    function saveScenario(asNew) {
        const doIt = (name) => {
            const lib = store();
            lib[name] = sceneObj();
            persistLib(lib);
            nameIn.value = name;
            markSaved();
        };
        const name = (nameIn.value || '').trim();
        if (asNew || !name) {
            const body = document.createElement('div');
            const inp = document.createElement('input');
            inp.type = 'text'; inp.placeholder = 'Scenario Name';
            inp.value = name ? name + ' copy' : '';
            inp.style.cssText = 'width:100%;background:#0a141c;border:1px solid #345;color:#dbe7f3;border-radius:4px;padding:3px 6px';
            body.appendChild(inp);
            dialog(asNew ? 'Save As' : 'Save', body, [
                { label: 'Cancel' },
                { label: 'Save', primary: true, onClick: () => { const n = (inp.value || '').trim(); if (n) doIt(n); } },
            ]);
            setTimeout(() => inp.focus(), 50);
        } else doIt(name);
    }
    function openScenario() {
        const lib = store();
        const names = Object.keys(lib).sort((a, b) => a.localeCompare(b));
        const body = document.createElement('div');
        if (!names.length) {
            const p = document.createElement('div');
            p.style.opacity = '0.7';
            p.textContent = 'No saved scenarios yet.';
            body.appendChild(p);
        }
        for (const n of names) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 6px;border-radius:6px;cursor:pointer';
            row.onmouseenter = () => row.style.background = '#1a3550';
            row.onmouseleave = () => row.style.background = '';
            const label = document.createElement('span');
            label.textContent = n;
            label.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            label.onclick = () => {
                dlg.close();
                ifClean('Open scenario', () => {
                    LAB._loading = true;
                    loadScene(lib[n]);
                    nameIn.value = n;
                    LAB._loading = false;
                    markSaved();
                    select({ kind: 'scenario' });
                });
            };
            const del = document.createElement('span');
            del.innerHTML = '&#10005;';
            del.title = 'delete';
            del.style.cssText = 'cursor:pointer;opacity:0.6;padding:0 4px';
            del.onclick = (e) => {
                e.stopPropagation();
                dlg.close();
                confirmDialog('Delete scenario', `Delete “${n}”? This cannot be undone.`, () => {
                    const l2 = store(); delete l2[n]; persistLib(l2);
                    openScenario();
                }, 'Delete');
            };
            row.append(label, del);
            body.appendChild(row);
        }
        const dlg = dialog('Open scenario', body, [{ label: 'Close' }]);
    }
    ui.querySelector('#lab-new').onclick = newScenario;
    ui.querySelector('#lab-open').onclick = openScenario;
    ui.querySelector('#lab-save').onclick = () => saveScenario(false);
    ui.querySelector('#lab-saveas').onclick = () => saveScenario(true);
    ui.querySelector('#lab-libopen').onclick = chooseLibFile;

    // ── pointer input ──────────────────────────────────────────────────
    ov.addEventListener('contextmenu', e => e.preventDefault());
    ov.addEventListener('mousedown', e => {
        e.stopPropagation();   // the game's window-level mouse handlers stay out
        if (!LAB.ready) return;
        // right-drag pans the map from anywhere — over objects, tools armed,
        // playing — without touching the selection
        if (e.button === 2) {
            LAB.drag = { pan: true, sx: e.clientX, sy: e.clientY, cx: LAB.cam.x, cy: LAB.cam.y };
            return;
        }
        const [wx, wy] = s2w(e.clientX, e.clientY);
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
        // silence, enforced: reset/start re-apply stored settings, so the mute
        // is re-asserted per frame (in memory only — never written back)
        if (typeof settings !== 'undefined') {
            settings.soundEnabled = false; settings.bgSoundEnabled = false; settings.musicEnabled = false;
        }
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
                // pin the recorded kite state so scrubbing replays the hoist
                // (the live per-frame AWA rule would otherwise repaint it)
                bt.spinnaker = fb.sp; bt.spinnakerDeployProgress = fb.spp;
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
        // realized tracks during playback — the sailed line in the hull colour
        for (let i = 0; i < LAB.boats.length; i++) {
            const lb = LAB.boats[i];
            const col = (lb.bot.colors && lb.bot.colors.hull) || '#8fd0ff';
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
