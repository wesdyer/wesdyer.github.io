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

    // ── force the open-water venue ─────────────────────────────────────
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

    // ── UI panel ───────────────────────────────────────────────────────
    const ui = document.createElement('div');
    ui.style.cssText = 'position:fixed;top:12px;right:12px;z-index:70;width:238px;background:rgba(10,18,28,0.92);color:#dbe7f3;font:13px/1.5 system-ui,sans-serif;padding:12px 14px;border:1px solid rgba(120,180,220,0.35);border-radius:10px;max-height:calc(100vh - 40px);overflow-y:auto';
    ui.innerHTML = `
      <div style="font-weight:700;font-size:15px;color:#8fd0ff;margin-bottom:4px">SCENARIO</div>
      <div style="opacity:0.7;margin-bottom:8px;font-size:12px">wind from the top &#8595; · click water to place<br>&#8984;-drag rotate boat · &#8997;-drag resize</div>
      <div id="lab-tools" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px"></div>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">
        <span><label>wind </label><input id="lab-wind" type="number" min="2" max="30" step="1" style="width:44px" value="12"> kt</span>
        <span><label>length </label><input id="lab-dur" type="number" min="2" max="120" step="1" style="width:44px" value="10"> s</span>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button id="lab-run">&#9654; Play</button><button id="lab-reset">Edit</button><button id="lab-clear">Clear</button>
      </div>
      <div id="lab-selpanel" style="border-top:1px solid #345;padding-top:6px;margin-bottom:6px;display:none">
        <div style="font-weight:600" id="lab-selname"></div>
        <div id="lab-boatfields" style="display:none">
          <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
            <label>heading</label><input id="lab-hdg" type="number" step="5" style="width:58px"> &deg;
          </div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
            <label>speed</label><input id="lab-spd" type="number" min="0" max="10" step="0.5" style="width:58px"> kt
          </div>
        </div>
        <button id="lab-del" style="margin-top:6px">Delete</button>
      </div>
      <div style="border-top:1px solid #345;padding-top:6px;margin-bottom:8px">
        <div style="font-weight:600;margin-bottom:3px">RIGHTS &amp; UMPIRE <span id="lab-time" style="opacity:0.7;font-weight:400"></span></div>
        <div id="lab-rights" style="font:12px/1.5 ui-monospace,monospace;color:#bfe3c0;min-height:40px">&mdash;</div>
      </div>
      <div style="border-top:1px solid #345;padding-top:6px">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input id="lab-name" type="text" placeholder="scenario name" style="flex:1;min-width:0">
          <button id="lab-save">Save</button>
        </div>
        <div style="display:flex;gap:6px">
          <select id="lab-list" style="flex:1;min-width:0;background:#0a141c;border:1px solid #345;color:#dbe7f3;border-radius:4px"></select>
          <button id="lab-load">Load</button><button id="lab-delsc">&#10005;</button>
        </div>
      </div>
      <button id="lab-json" style="margin-top:8px">Copy scene JSON</button>`;
    document.body.appendChild(ui);
    for (const b of ui.querySelectorAll('button')) b.style.cssText += 'background:#123;border:1px solid #467;color:#cde;padding:2px 10px;border-radius:6px;cursor:pointer';
    for (const i of ui.querySelectorAll('input')) i.style.cssText += 'background:#0a141c;border:1px solid #345;color:#dbe7f3;border-radius:4px;padding:1px 4px';

    const TOOLS = [['select', 'Select'], ['boat', '+ Boat'], ['mark', '+ Mark'], ['sand', '+ Sand'], ['line', '+ Line']];
    const toolBtns = {};
    const toolsDiv = ui.querySelector('#lab-tools');
    for (const [id, label] of TOOLS) {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'background:#123;border:1px solid #467;color:#cde;padding:2px 8px;border-radius:6px;cursor:pointer';
        b.onclick = () => setTool(id);
        toolsDiv.appendChild(b);
        toolBtns[id] = b;
    }
    function setTool(id) {
        LAB.tool = id;
        for (const k of Object.keys(toolBtns)) toolBtns[k].style.background = k === id ? '#2a5a8a' : '#123';
    }
    setTool('boat');

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
        } catch (e) { console.error('scenario boot', e); return; }
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
        LAB.ready = true;
    }

    // ── objects ────────────────────────────────────────────────────────
    function invalidate() {
        LAB.rec = null; LAB.playing = false; LAB.frame = 0;
        if (LAB.mode !== 'edit') LAB.mode = 'edit';
        bar.style.display = 'none';
        pbPlay.innerHTML = '&#9654;';
    }
    function addBoat(wx, wy) {
        const bot = LAB.pool.shift();
        if (!bot) return;
        bot.raceState.finished = false; bot.raceState.ocs = false;
        bot.raceState.penalty = false; bot.raceState.totalPenalties = 0;
        bot.raceState.isTacking = false; bot.raceState.leg = 1;
        bot.fadeTimer = 999; bot.opacity = 1;
        const lb = { bot, x: wx, y: wy, heading: Math.PI / 2, speedKt: 6 };
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

    const selPanel = ui.querySelector('#lab-selpanel');
    const selName = ui.querySelector('#lab-selname');
    const boatFields = ui.querySelector('#lab-boatfields');
    const hdgIn = ui.querySelector('#lab-hdg'), spdIn = ui.querySelector('#lab-spd');
    function select(s) {
        LAB.sel = s;
        selPanel.style.display = s ? 'block' : 'none';
        if (!s) return;
        boatFields.style.display = s.kind === 'boat' ? 'block' : 'none';
        selName.textContent = s.kind === 'boat' ? ('Boat ' + s.ref.bot.name) : s.kind;
        if (s.kind === 'boat') {
            hdgIn.value = Math.round(((s.ref.heading * DEG) % 360 + 360) % 360);
            spdIn.value = s.ref.speedKt;
        }
    }
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
                    role: c ? (c.avoidanceRole || '-') : '-',
                    risk: c ? (c.riskState || '-') : '-',
                    dev: c ? +((c.lastAvoidDeviation || 0)).toFixed(2) : 0 };
            }),
            pairs: pairRights(),
        };
    }
    function simulate() {
        applyInitial();
        for (const lb of LAB.boats) {
            const bt = lb.bot;
            // sail your course: navigation is a far point along the SET heading;
            // strategy (tacks toward it), avoidance, rules and the umpire all
            // run live — the question this page exists to answer
            const gx = bt.x + Math.sin(lb.heading) * 8000;
            const gy = bt.y - Math.cos(lb.heading) * 8000;
            if (bt.controller) bt.controller.getNavigationTarget = () => ({ x: gx, y: gy });
        }
        const nF = Math.round(LAB.durationS * 60);
        const frames = [snapshot()];
        LAB.recording = true;
        for (let f = 1; f <= nF; f++) {
            _update(1 / 60);
            frames.push(snapshot());
        }
        LAB.recording = false;
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
    const runBtn = ui.querySelector('#lab-run');
    function play() {
        if (!LAB.rec) simulate();
        if (LAB.frame >= LAB.rec.nF) LAB.frame = 0;
        LAB.mode = 'play'; LAB.playing = true;
        pbPlay.innerHTML = '&#10074;&#10074;';
    }
    function pause() { LAB.playing = false; pbPlay.innerHTML = '&#9654;'; }
    runBtn.onclick = () => { if (LAB.mode === 'play' && LAB.playing) pause(); else play(); };
    pbPlay.onclick = runBtn.onclick;
    bar.querySelector('#pb-back').onclick = () => { pause(); setFrame(LAB.frame - 30); };
    bar.querySelector('#pb-fwd').onclick = () => { if (LAB.mode !== 'play') play(); pause(); setFrame(LAB.frame + 30); };
    pbSlider.addEventListener('input', () => { if (LAB.mode !== 'play' && LAB.rec) LAB.mode = 'play'; pause(); setFrame(+pbSlider.value); });
    ui.querySelector('#lab-reset').onclick = () => { pause(); LAB.mode = 'edit'; LAB.frame = 0; };
    ui.querySelector('#lab-clear').onclick = clearScene;
    window.addEventListener('keydown', e => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        if (e.key === 'Delete' || e.key === 'Backspace') deleteSel();
        if (LAB.rec && LAB.mode === 'play') {
            if (e.key === 'ArrowLeft') { pause(); setFrame(LAB.frame - 1); e.preventDefault(); }
            if (e.key === 'ArrowRight') { pause(); setFrame(LAB.frame + 1); e.preventDefault(); }
            if (e.key === ' ') { runBtn.onclick(); e.preventDefault(); }
        }
    });

    // ── save / load ────────────────────────────────────────────────────
    function store() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
    function sceneObj() {
        const S = LAB.stage;
        return {
            v: 1, durationS: LAB.durationS, windKt: LAB.windKt,
            boats: LAB.boats.map(lb => ({ x: Math.round(lb.x - S.x), y: Math.round(lb.y - S.y), headingDeg: Math.round(lb.heading * DEG), speedKt: lb.speedKt })),
            marks: LAB.marks.map(m => ({ x: Math.round(m.x - S.x), y: Math.round(m.y - S.y) })),
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
            if (lb) { lb.heading = (bs.headingDeg || 0) / DEG; lb.speedKt = bs.speedKt != null ? bs.speedKt : 6; }
        }
        for (const ms of (sc.marks || [])) addMark(S.x + ms.x, S.y + ms.y);
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
        const hit = pick(wx, wy);
        if (!hit && LAB.tool !== 'select') {
            if (LAB.tool === 'boat') addBoat(wx, wy);
            else if (LAB.tool === 'mark') addMark(wx, wy);
            else if (LAB.tool === 'sand') addSand(wx, wy);
            else if (LAB.tool === 'line') addLine(wx, wy);
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
    window.addEventListener('mouseup', () => { LAB.drag = null; });

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
                if (bi.role && bi.role !== 'NONE' && bi.role !== '-') bits.push(bi.role === 'GIVE_WAY' ? 'give-way' : 'stand-on');
                if (bi.risk && bi.risk !== 'LOW' && bi.risk !== '-') bits.push('risk ' + bi.risk);
                if (Math.abs(bi.dev) > 0.05) bits.push('deflecting ' + Math.round(Math.abs(bi.dev) * DEG) + '°');
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
        if (LAB.sel && LAB.mode === 'edit') {
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
        // wind arrow, top centre
        octx.save();
        octx.translate(ov.width / 2, 46);
        octx.strokeStyle = 'rgba(255,255,255,0.9)'; octx.fillStyle = 'rgba(255,255,255,0.9)'; octx.lineWidth = 3;
        octx.beginPath(); octx.moveTo(0, -16); octx.lineTo(0, 14); octx.stroke();
        octx.beginPath(); octx.moveTo(-7, 6); octx.lineTo(0, 18); octx.lineTo(7, 6); octx.closePath(); octx.fill();
        octx.font = '12px ui-monospace'; octx.textAlign = 'center';
        octx.fillText(LAB.windKt + ' kt', 0, -24);
        octx.restore();
    }

    _update = window.update;
    window.update = function (dt) { _update(dt); try { frame(); } catch (e) { } };

    window.addEventListener('load', () => setTimeout(boot, 400));
})();
