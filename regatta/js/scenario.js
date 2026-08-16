// THE SCENARIO CONSTRUCTOR (scenario.html) — for building scenarios that test the
// umpire and the AI: who has rights, and will they duck?
//
// Owner's spec (2026-08-16): no loading screen; just open water; add simple
// objects (sand), marks, lines and boats; choose each boat's initial rotation
// and speed; wind is ALWAYS FROM THE TOP. Simple is better.
//
// How it works: the real game boots on Sea Trials (open water), every stock
// boat is parked far offshore, and getWindAt is pinned to a uniform breeze
// from the top of the screen. EDIT mode freezes placed boats at their initial
// conditions; RUN releases them with live AI — each boat's navigation target
// is a far point along its set heading, so strategy/avoidance/rules/umpire
// all run for real and the rights panel reports what the engine rules.
(function () {
    'use strict';

    // ── force the open-water venue ─────────────────────────────────────
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('regatta_settings') || '{}'); } catch (e) { }
    if (saved.venue !== 'seatrials') {
        saved.venue = 'seatrials';
        localStorage.setItem('regatta_settings', JSON.stringify(saved));
        location.reload();
        return;
    }

    const LAB = {
        ready: false, mode: 'edit', tool: 'boat',
        boats: [],           // {bot, x, y, heading, speedKt}
        marks: [],           // engine mark objects we added
        sands: [],           // {isl, x, y, r}
        lines: [],           // {x1,y1,x2,y2}
        sel: null,           // {kind, ref, part}
        windKt: 12,
        cam: { x: 0, y: 0 },
        drag: null,
        pool: [],            // parked stock bots available for recruiting
    };
    const DEG = 180 / Math.PI;

    // ── UI ─────────────────────────────────────────────────────────────
    const ui = document.createElement('div');
    ui.style.cssText = 'position:fixed;top:12px;right:12px;z-index:70;width:230px;background:rgba(10,18,28,0.92);color:#dbe7f3;font:13px/1.5 system-ui,sans-serif;padding:12px 14px;border:1px solid rgba(120,180,220,0.35);border-radius:10px';
    ui.innerHTML = `
      <div style="font-weight:700;font-size:15px;color:#8fd0ff;margin-bottom:6px">SCENARIO LAB</div>
      <div style="opacity:0.75;margin-bottom:8px">wind is from the top &#8595; · click water to place</div>
      <div id="lab-tools" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px"></div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
        <label>wind</label><input id="lab-wind" type="number" min="2" max="30" step="1" style="width:52px" value="12"> kt
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button id="lab-run">&#9654; Run</button><button id="lab-reset">Reset</button><button id="lab-clear">Clear</button>
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
      <div style="border-top:1px solid #345;padding-top:6px">
        <div style="font-weight:600;margin-bottom:3px">RIGHTS &amp; UMPIRE</div>
        <div id="lab-rights" style="font:12px/1.5 ui-monospace,monospace;color:#bfe3c0;min-height:40px">&mdash;</div>
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

    // ── overlay canvas (sand, lines, selection, wind arrow) ────────────
    const game = document.getElementById('gameCanvas');
    const ov = document.createElement('canvas');
    ov.style.cssText = 'position:fixed;inset:0;z-index:40;cursor:crosshair';
    document.body.appendChild(ov);
    const octx = ov.getContext('2d');
    function sizeOv() { ov.width = window.innerWidth; ov.height = window.innerHeight; }
    sizeOv(); window.addEventListener('resize', sizeOv);

    const w2s = (wx, wy) => [wx - LAB.cam.x + ov.width / 2, wy - LAB.cam.y + ov.height / 2];
    const s2w = (sx, sy) => [sx - ov.width / 2 + LAB.cam.x, sy - ov.height / 2 + LAB.cam.y];

    // ── boot ───────────────────────────────────────────────────────────
    function boot() {
        const st = window.state;
        if (!st || !st.course || typeof window.resetGame !== 'function') return void setTimeout(boot, 250);
        try {
            window.resetGame(); window.startRace();
            for (let i = 0; i < 60 * 120 && st.race.status !== 'racing'; i++) window.update(1 / 60);
        } catch (e) { console.error('lab boot', e); return; }
        // uniform breeze from the top, forever
        window.getWindAt = () => ({ speed: LAB.windKt, direction: 0 });
        st.showNavAids = false;   // waypoint balls + distance chips are race chrome
        // the stage: boundary centre; push the venue's own course marks far away
        const b = st.course.boundary || { x: 0, y: 0 };
        LAB.cam.x = b.x; LAB.cam.y = b.y;
        LAB.markProto = (st.course.marks || [])[0] ? JSON.parse(JSON.stringify(st.course.marks[0])) : null;
        for (const m of (st.course.marks || [])) {
            m.x += 1e6; m.y += 1e6;
            if (m.body) for (const c of m.body) { c.x += 1e6; c.y += 1e6; }
        }
        // park everyone; the pool is what "+ Boat" recruits from
        for (const o of st.boats) {
            o.x = b.x - 1e6; o.y = b.y - 1e6; o.speed = 0;
            if (o.isPlayer) { o.raceState.finished = false; }
            else { o.raceState.finished = true; o.fadeTimer = 0; LAB.pool.push(o); }
        }
        LAB.ready = true;
    }

    // ── objects ────────────────────────────────────────────────────────
    function addBoat(wx, wy) {
        const bot = LAB.pool.shift();
        if (!bot) return;
        bot.raceState.finished = false; bot.raceState.ocs = false;
        bot.raceState.penalty = false; bot.raceState.totalPenalties = 0;
        bot.raceState.isTacking = false; bot.raceState.leg = 1;
        // un-fade: opacity is only recomputed while finished, so a recruit from
        // the parked pool would otherwise keep the ghost opacity the fade left
        bot.fadeTimer = 999; bot.opacity = 1;
        const lb = { bot, x: wx, y: wy, heading: Math.PI / 2, speedKt: 6 };
        bot.name = String.fromCharCode(65 + LAB.boats.length); // A, B, C...
        LAB.boats.push(lb);
        select({ kind: 'boat', ref: lb });
    }
    function addMark(wx, wy) {
        // Clone a real venue mark so every field the renderer and umpire expect
        // (body capsule, sprite type, zone…) is present — a bare {x,y} object
        // throws inside draw() and aborts the whole frame's rendering.
        const proto = LAB.markProto || {};
        const m = JSON.parse(JSON.stringify(proto));
        m.x = wx; m.y = wy;
        if (m.body) { const dx = wx - (proto.x || 0), dy = wy - (proto.y || 0); for (const c of m.body) { c.x += dx; c.y += dy; } }
        window.state.course.marks.push(m);
        LAB.marks.push(m);
        select({ kind: 'mark', ref: m });
    }
    function addSand(wx, wy) {
        const R = 90, verts = [];
        for (let k = 0; k < 10; k++) {
            const a = k / 10 * Math.PI * 2;
            const r = R * (0.85 + 0.3 * Math.abs(Math.sin(k * 2.7)));
            verts.push({ x: wx + Math.cos(a) * r, y: wy + Math.sin(a) * r });
        }
        // hidden: the engine's island renderer needs baked art this synthetic
        // shape doesn't have (and drawIslands skips hidden before baking);
        // the lab draws the sand itself on the overlay. Collisions, rule 19
        // and avoidance all still see it — they don't check `hidden`.
        const isl = { x: wx, y: wy, radius: R, vertices: verts, isFloe: false, awash: false, hidden: true, labSand: true };
        (window.state.course.islands = window.state.course.islands || []).push(isl);
        const s = { isl, x: wx, y: wy, r: R };
        LAB.sands.push(s);
        select({ kind: 'sand', ref: s });
    }
    function addLine(wx, wy) {
        const ln = { x1: wx - 150, y1: wy, x2: wx + 150, y2: wy };
        LAB.lines.push(ln);
        select({ kind: 'line', ref: ln, part: 0 });
    }
    function moveObj(sel, wx, wy) {
        if (sel.kind === 'boat') { sel.ref.x = wx; sel.ref.y = wy; }
        else if (sel.kind === 'mark') { sel.ref.x = wx; sel.ref.y = wy; }
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
    hdgIn.addEventListener('input', () => { if (LAB.sel && LAB.sel.kind === 'boat') LAB.sel.ref.heading = (parseFloat(hdgIn.value) || 0) / DEG; });
    spdIn.addEventListener('input', () => { if (LAB.sel && LAB.sel.kind === 'boat') LAB.sel.ref.speedKt = Math.max(0, parseFloat(spdIn.value) || 0); });
    ui.querySelector('#lab-del').onclick = deleteSel;
    ui.querySelector('#lab-wind').addEventListener('input', e => { LAB.windKt = Math.max(2, parseFloat(e.target.value) || 12); });

    // ── run / reset ────────────────────────────────────────────────────
    const runBtn = ui.querySelector('#lab-run');
    function setMode(m) {
        LAB.mode = m;
        runBtn.innerHTML = m === 'run' ? '&#10074;&#10074; Pause' : '&#9654; Run';
        if (m === 'run') {
            window.Rules.interactions = {};
            for (const lb of LAB.boats) {
                const bt = lb.bot;
                bt.raceState.penalty = false; bt.raceState.totalPenalties = 0;
                bt.raceState.penaltyTurnsOwed = 0;
                // sail your course: navigation is a far point along the SET
                // heading; strategy (tacks toward it), avoidance, rules and the
                // umpire all run live — the question this lab exists to answer.
                const gx = bt.x + Math.sin(lb.heading) * 6000;
                const gy = bt.y - Math.cos(lb.heading) * 6000;
                if (bt.controller) bt.controller.getNavigationTarget = () => ({ x: gx, y: gy });
            }
        }
    }
    runBtn.onclick = () => setMode(LAB.mode === 'run' ? 'edit' : 'run');
    ui.querySelector('#lab-reset').onclick = () => {
        setMode('edit');
        for (const lb of LAB.boats) {
            lb.bot.raceState.penalty = false; lb.bot.raceState.totalPenalties = 0;
            lb.bot.raceState.penaltyTurnsOwed = 0; lb.bot.raceState.isTacking = false;
        }
        window.Rules.interactions = {};
    };
    ui.querySelector('#lab-clear').onclick = () => { while (LAB.sel || LAB.boats.length || LAB.marks.length || LAB.sands.length || LAB.lines.length) { select(LAB.boats[0] ? { kind: 'boat', ref: LAB.boats[0] } : LAB.marks[0] ? { kind: 'mark', ref: LAB.marks[0] } : LAB.sands[0] ? { kind: 'sand', ref: LAB.sands[0] } : LAB.lines[0] ? { kind: 'line', ref: LAB.lines[0], part: 0 } : null); if (!LAB.sel) break; deleteSel(); } };
    ui.querySelector('#lab-json').onclick = () => {
        const scene = {
            wind: { fromTopKt: LAB.windKt },
            boats: LAB.boats.map(lb => ({ name: lb.bot.name, x: Math.round(lb.x - LAB.cam.x), y: Math.round(lb.y - LAB.cam.y), headingDeg: Math.round(lb.heading * DEG), speedKt: lb.speedKt })),
            marks: LAB.marks.map(m => ({ x: Math.round(m.x - LAB.cam.x), y: Math.round(m.y - LAB.cam.y) })),
            sands: LAB.sands.map(s => ({ x: Math.round(s.x - LAB.cam.x), y: Math.round(s.y - LAB.cam.y), r: s.r })),
            lines: LAB.lines.map(l => ({ x1: Math.round(l.x1 - LAB.cam.x), y1: Math.round(l.y1 - LAB.cam.y), x2: Math.round(l.x2 - LAB.cam.x), y2: Math.round(l.y2 - LAB.cam.y) })),
        };
        const txt = JSON.stringify(scene, null, 1);
        if (navigator.clipboard) navigator.clipboard.writeText(txt);
        console.log(txt);
    };

    // ── pointer input ──────────────────────────────────────────────────
    ov.addEventListener('mousedown', e => {
        if (!LAB.ready) return;
        const [wx, wy] = s2w(e.clientX, e.clientY);
        const hit = pick(wx, wy);
        if (LAB.tool === 'boat' && !hit) { addBoat(wx, wy); LAB.drag = { sel: LAB.sel }; return; }
        if (LAB.tool === 'mark' && !hit) { addMark(wx, wy); LAB.drag = { sel: LAB.sel }; return; }
        if (LAB.tool === 'sand' && !hit) { addSand(wx, wy); LAB.drag = { sel: LAB.sel }; return; }
        if (LAB.tool === 'line' && !hit) { addLine(wx, wy); LAB.drag = { sel: LAB.sel }; return; }
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
        moveObj(LAB.drag.sel, wx, wy);
        if (LAB.drag.sel.kind === 'boat') { LAB.drag.sel.ref.x = wx; LAB.drag.sel.ref.y = wy; }
    });
    window.addEventListener('mouseup', () => { LAB.drag = null; });
    window.addEventListener('keydown', e => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            deleteSel();
        }
    });

    // ── per-frame: pin, camera, readout, overlay ───────────────────────
    const rightsEl = ui.querySelector('#lab-rights');
    function frame() {
        if (!LAB.ready) return;
        const st = window.state;
        st.wind.direction = 0; st.wind.baseDirection = 0;
        st.wind.speed = LAB.windKt; st.wind.baseSpeed = LAB.windKt;
        // parked pool + player stay far away
        const b0 = st.course.boundary || { x: 0, y: 0 };
        for (const o of st.boats) {
            const mine = LAB.boats.some(lb => lb.bot === o);
            if (!mine) { o.x = b0.x - 1e6; o.y = b0.y - 1e6; o.speed = 0; o.velocity = { x: 0, y: 0 }; }
        }
        if (LAB.mode === 'edit') {
            for (const lb of LAB.boats) {
                const bt = lb.bot;
                bt.x = lb.x; bt.y = lb.y; bt.heading = lb.heading;
                bt.speed = lb.speedKt / 4;   // boat.speed*4 = knots
                bt.velocity = { x: Math.sin(bt.heading) * bt.speed, y: -Math.cos(bt.heading) * bt.speed };
                bt.raceState.isTacking = false;
                // edit mode is a clean slate: whatever the umpire ruled while
                // dragging pieces around is stage noise, not a determination
                bt.raceState.penalty = false; bt.raceState.totalPenalties = 0;
                bt.raceState.penaltyTurnsOwed = 0; bt.raceState.ocs = false;
            }
        } else {
            for (const lb of LAB.boats) { lb.x = lb.bot.x; lb.y = lb.bot.y; }
        }
        // camera: ours, north-up
        st.camera.rotation = 0;
        st.camera.x = LAB.cam.x; st.camera.y = LAB.cam.y;
        st.camera.fx = LAB.cam.x; st.camera.fy = LAB.cam.y;
        st.camera.target = 'boat';
        // rights & umpire readout
        const rows = [];
        for (let i = 0; i < LAB.boats.length; i++) {
            for (let j = i + 1; j < LAB.boats.length; j++) {
                const A = LAB.boats[i].bot, B = LAB.boats[j].bot;
                const d = Math.hypot(A.x - B.x, A.y - B.y);
                if (d > 600) continue;
                const res = window.Rules.getRightOfWay(A, B);
                const row = res.boat ? res.boat.name : '—';
                rows.push(`${A.name}·${B.name}: row <b>${row}</b> (${res.rule || '—'})` +
                    (res.markRoom ? ` mk-room <b>${res.markRoom === A.id ? A.name : B.name}</b>` : ''));
            }
        }
        for (const lb of LAB.boats) {
            if (lb.bot.raceState.penalty) rows.push(`<span style="color:#ff9b8f">${lb.bot.name}: PENALTY</span>`);
        }
        rightsEl.innerHTML = rows.length ? rows.join('<br>') : '—';
        // overlay drawing
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
        if (LAB.sel) {
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

    const _update = window.update;
    window.update = function (dt) { _update(dt); try { frame(); } catch (e) { } };

    window.addEventListener('load', () => setTimeout(boot, 400));
})();
