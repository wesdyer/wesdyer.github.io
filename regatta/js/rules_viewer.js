// THE RULE-INSPECTION PAGE (rules.html) — renders js/rule_scenarios.js with
// the real game. One scenario loops at a time: the boats are PINNED to the
// scenario's scripted geometry every frame while the live engine (rules oracle,
// contact/mark/island umpires) runs underneath, so what the overlay reports is
// what the shipping game would actually rule. Rule text underneath, prev/next
// to move through the battery. The same data file drives eval/test_scenarios.js.
(function () {
    'use strict';
    const SCN = (window.RuleScenarios && window.RuleScenarios.scenarios) || [];
    if (!SCN.length) return;

    // ── scenario selection & venue routing ─────────────────────────────
    const idx0 = Math.max(0, Math.min(SCN.length - 1, parseInt((location.hash || '#0').slice(1), 10) || 0));
    const wantVenue = SCN[idx0].venue;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('regatta_settings') || '{}'); } catch (e) { }
    if (saved.venue !== wantVenue) {
        saved.venue = wantVenue;
        localStorage.setItem('regatta_settings', JSON.stringify(saved));
        location.reload();
        return;
    }

    const V = {
        i: idx0, s: SCN[idx0],
        frame: null,        // resolved anchor frame
        t: 0,               // seconds into the loop
        program: null,      // [{dur, poseAt(tFrac)->{A:{x,y,heading},B:...}, phase}]
        boats: null,
        ready: false,
    };

    const PHASE_HOLD = 2.5;   // seconds a phase's final pose is held
    const PHASE_MOVE = 1.2;   // seconds animating into a phase's pose

    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    // ── overlay ────────────────────────────────────────────────────────
    const box = el('div');
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(10,18,28,0.88);color:#dbe7f3;font:14px/1.45 system-ui,sans-serif;padding:14px 18px 12px;border-top:1px solid rgba(120,180,220,0.35)';
    const head = el('div'); head.style.cssText = 'display:flex;gap:12px;align-items:baseline;flex-wrap:wrap';
    const ruleEl = el('span'); ruleEl.style.cssText = 'font-weight:700;font-size:16px;color:#8fd0ff';
    const titleEl = el('span'); titleEl.style.cssText = 'font-weight:600';
    const navEl = el('span'); navEl.style.cssText = 'margin-left:auto;display:flex;gap:8px;align-items:center';
    const prevB = el('button', null, '&#9664; prev'); const nextB = el('button', null, 'next &#9654;');
    for (const b of [prevB, nextB]) b.style.cssText = 'background:#123;border:1px solid #467;color:#cde;padding:2px 10px;border-radius:6px;cursor:pointer';
    const countEl = el('span'); countEl.style.cssText = 'opacity:0.7';
    navEl.append(prevB, countEl, nextB);
    head.append(ruleEl, titleEl, navEl);
    const textEl = el('div'); textEl.style.cssText = 'margin-top:6px;max-width:1100px;opacity:0.9;font-style:italic';
    const liveEl = el('div'); liveEl.style.cssText = 'margin-top:8px;font:13px/1.4 ui-monospace,monospace;color:#bfe3c0';
    box.append(head, textEl, liveEl);
    document.body.appendChild(box);

    function go(i) {
        const n = SCN.length;
        location.hash = '#' + ((i % n) + n) % n;
        location.reload();
    }
    prevB.onclick = () => go(V.i - 1);
    nextB.onclick = () => go(V.i + 1);
    window.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') go(V.i + 1);
        if (e.key === 'ArrowLeft') go(V.i - 1);
    });

    // ── anchor frame resolution (mirrors eval/test_scenarios.js) ───────
    function resolveFrame(s) {
        const st = window.state;
        if (s.anchor === 'roundMark') {
            for (let i = 0; i < st.course.route.length; i++) {
                const e = st.course.route[i];
                if (e && e.kind === 'round' && e.mark) {
                    let mIdx = st.course.marks.indexOf(e.mark);
                    if (mIdx === -1) mIdx = st.course.marks.findIndex(m => Math.hypot(m.x - e.mark.x, m.y - e.mark.y) < 1);
                    const mark = mIdx >= 0 ? st.course.marks[mIdx] : e.mark;
                    if (mark.zone == null) mark.zone = e.mark.zone;
                    return { origin: { x: mark.x, y: mark.y }, zone: mark.zone, mark, leg: i };
                }
            }
            return null;
        }
        const g = st.course.botGrid;
        if (g) {
            // first clean bank spot (land upwind of a sailable heading, 8 open
            // cells to leeward); openWater = the same spot 150u to leeward
            for (let j = 2; j < g.n - 2; j++) for (let i = 2; i < g.n - 2; i++) {
                if (g.at(i, j)) continue;
                const w0 = g.world(i, j);
                const wd = getWindAt(w0[0], w0[1]).direction;
                for (const side of [1, -1]) {
                    for (const dd of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                        let ok = true;
                        for (let k = 1; k <= 8; k++) if (!g.at(i + k * dd[0], j + k * dd[1])) { ok = false; break; }
                        if (!ok) continue;
                        const wO = g.world(i + dd[0], j + dd[1]);
                        const lx = w0[0] - wO[0], ly = w0[1] - wO[1], ll = Math.hypot(lx, ly) || 1;
                        const ux = lx / ll, uy = ly / ll;
                        const hdg = Math.atan2(ux, -uy) - side * Math.PI / 2;
                        const twa = Math.abs(normalizeAngle(hdg - wd));
                        if (twa < 0.7 || twa > 2.2) continue;
                        const uwx = Math.sin(wd), uwy = -Math.cos(wd);
                        if (ux * uwx + uy * uwy < 0.3) continue;
                        let ox = w0[0] - ux * 95, oy = w0[1] - uy * 95;
                        if (s.anchor === 'openWater') { ox -= ux * 150; oy -= uy * 150; }
                        return { origin: { x: ox, y: oy }, ux, uy, hx: Math.sin(hdg), hy: -Math.cos(hdg), spotHdg: hdg };
                    }
                }
            }
            // no usable bank spot: an openWater scenario can still run on the
            // open-water frame below; a bankSpot scenario genuinely needs one
            if (s.anchor === 'bankSpot') return null;
        }
        const b = st.course.boundary || { x: 0, y: 0 };
        const wd0 = getWindAt(b.x, b.y).direction;
        const hdg = wd0 - 0.66;
        return { origin: { x: b.x, y: b.y }, ux: Math.sin(wd0), uy: -Math.cos(wd0),
                 hx: Math.sin(hdg), hy: -Math.cos(hdg), spotHdg: hdg };
    }

    function hdgOf(F, wd, h) {
        if (typeof h === 'number') return h;
        if (h === 'spot') return F.spotHdg;
        if (h === 'stbdCH') return normalizeAngle(wd - 0.66);
        if (h === 'portCH') return normalizeAngle(wd + 0.66);
        if (h === 'stbdRun') return normalizeAngle(wd - 2.4);
        if (h === 'portRun') return normalizeAngle(wd + 2.4);
        const m = /^(wd|spot)([+-][\d.]+)$/.exec(h);
        if (m) return normalizeAngle((m[1] === 'wd' ? wd : F.spotHdg) + parseFloat(m[2]));
        return 0;
    }
    function posOf(F, s, p) {
        if (s.anchor === 'roundMark') {
            if (p.du != null || p.dv != null) return { x: F.origin.x + (p.du || 0), y: F.origin.y + (p.dv || 0) };
            return { x: F.origin.x + (p.dx || 0) * F.zone, y: F.origin.y + (p.dy || 0) * F.zone };
        }
        return { x: F.origin.x + F.ux * (p.dl || 0) + F.hx * (p.dh || 0),
                 y: F.origin.y + F.uy * (p.dl || 0) + F.hy * (p.dh || 0) };
    }

    // Build the playback program: a list of poses (per boat) with durations.
    function buildProgram(s, F) {
        const wd = getWindAt(F.origin.x, F.origin.y).direction;
        const poses = [];    // each: {A:{x,y,heading}, B:{...}}
        const base = {};
        for (const bs of s.boats) {
            base[bs.name] = { ...posOf(F, s, bs), heading: hdgOf(F, wd, bs.heading), isTacking: !!bs.isTacking };
        }
        poses.push({ pose: JSON.parse(JSON.stringify(base)), label: 'setup' });
        let cur = base;
        for (let k = 0; k < s.phases.length; k++) {
            const ph = s.phases[k];
            if (ph.move || ph.marchToLand) {
                const next = JSON.parse(JSON.stringify(cur));
                if (ph.move) for (const n of Object.keys(ph.move)) {
                    const mv = ph.move[n];
                    const P = posOf(F, s, mv);
                    next[n] = { ...next[n], x: P.x, y: P.y };
                    if (mv.heading != null) next[n].heading = hdgOf(F, wd, mv.heading);
                }
                if (ph.marchToLand) {
                    const mb = ph.marchToLand;
                    next[mb.boat] = { ...next[mb.boat], x: F.origin.x + F.ux * 110, y: F.origin.y + F.uy * 110 };
                    next[mb.follower] = { ...next[mb.follower], x: F.origin.x + F.ux * 50, y: F.origin.y + F.uy * 50 };
                }
                poses.push({ pose: next, label: 'phase ' + (k + 1) });
                cur = next;
            }
        }
        return poses;
    }

    // ── boot ───────────────────────────────────────────────────────────
    function boot() {
        const st = window.state;
        if (!st || !st.course || !st.course.marks || typeof window.resetGame !== 'function') {
            return void setTimeout(boot, 250);
        }
        try {
            window.resetGame(); window.startRace();
            for (let i = 0; i < 60 * 120 && st.race.status !== 'racing'; i++) window.update(1 / 60);
        } catch (e) { console.error('rules_viewer boot', e); return; }
        const bots = st.boats.filter(b => !b.isPlayer);
        V.boats = { A: bots[0], B: bots[1] };
        for (const o of st.boats) {
            if (o === bots[0] || o === bots[1] || o.isPlayer) continue;
            o.x = -1e6; o.y = -1e6; o.raceState.finished = true; o.fadeTimer = 0;
        }
        V.frame = resolveFrame(V.s);
        if (!V.frame) { liveEl.textContent = 'No anchor found on this venue for ' + V.s.id; return; }
        V.program = buildProgram(V.s, V.frame);
        ruleEl.textContent = V.s.rule;
        titleEl.textContent = V.s.title;
        countEl.textContent = (V.i + 1) + ' / ' + SCN.length;
        textEl.textContent = '“' + V.s.ruleText + '”';
        window.Rules.interactions = {};
        hideHud();
        V.t = 0; V.ready = true;
    }

    // The whole loop duration
    function loopDur() { return V.program.length * PHASE_HOLD + (V.program.length - 1) * PHASE_MOVE; }

    // pose at time t (with interpolation between poses)
    function poseAt(t) {
        const P = V.program;
        let seg = 0, acc = 0;
        for (let i = 0; i < P.length; i++) {
            const hold = PHASE_HOLD;
            if (t < acc + hold) return { a: P[i].pose, b: P[i].pose, f: 0, label: P[i].label };
            acc += hold;
            if (i < P.length - 1) {
                if (t < acc + PHASE_MOVE) {
                    const f = (t - acc) / PHASE_MOVE;
                    return { a: P[i].pose, b: P[i + 1].pose, f, label: P[i + 1].label };
                }
                acc += PHASE_MOVE;
            }
        }
        return null; // loop over
    }

    function pin() {
        if (!V.ready) return;
        const st = window.state;
        V.t += 1 / 60;
        let pp = poseAt(V.t);
        if (!pp) {
            // loop: clear penalties + interactions, restart
            for (const n of Object.keys(V.boats)) {
                V.boats[n].raceState.penalty = false;
                V.boats[n].raceState.totalPenalties = 0;
                V.boats[n].raceState.penaltyTurnsOwed = 0;
            }
            window.Rules.interactions = {};
            V.t = 0; pp = poseAt(0);
        }
        for (const n of Object.keys(V.boats)) {
            const bt = V.boats[n];
            const a = pp.a[n], b = pp.b[n];
            bt.x = a.x + (b.x - a.x) * pp.f;
            bt.y = a.y + (b.y - a.y) * pp.f;
            bt.heading = a.heading + normalizeAngle(b.heading - a.heading) * pp.f;
            bt.speed = 1.5; // way on, for rendering
            bt.velocity = { x: Math.sin(bt.heading) * 1.5, y: -Math.cos(bt.heading) * 1.5 };
            bt.raceState.finished = false; bt.raceState.ocs = false;
            bt.raceState.isTacking = !!a.isTacking;
            if (V.s.anchor === 'roundMark' && V.frame.leg != null) bt.raceState.leg = V.frame.leg;
        }
        // camera platform: park the player behind the action, looking at it
        const pl = st.boats.find(b => b.isPlayer);
        if (pl) {
            const F = V.frame;
            const back = 420;
            const dirX = F.ux != null ? F.ux : 0, dirY = F.uy != null ? F.uy : -1;
            pl.x = F.origin.x - dirX * back; pl.y = F.origin.y - dirY * back;
            pl.heading = Math.atan2(F.origin.x - pl.x, -(F.origin.y - pl.y));
            pl.speed = 0; pl.velocity = { x: 0, y: 0 };
            pl.raceState.finished = false;
        }
        // live readout
        const A = V.boats.A, B = V.boats.B;
        const res = window.Rules.getRightOfWay(A, B);
        const row = res.boat ? (res.boat === A ? 'A' : 'B') : '—';
        const mr = res.markRoom === A.id ? 'A' : res.markRoom === B.id ? 'B' : '—';
        liveEl.innerHTML =
            `oracle: right-of-way <b>${row}</b> (${res.rule || '—'})  ·  mark-room <b>${mr}</b>` +
            (res.constraints && res.constraints.length ? `  ·  limits: ${res.constraints.join(', ')}` : '') +
            `<br>umpire: A ${A.raceState.penalty ? '<span style="color:#ff9b8f">PENALTY</span>' : 'clear'}` +
            `  ·  B ${B.raceState.penalty ? '<span style="color:#ff9b8f">PENALTY</span>' : 'clear'}` +
            `   <span style="opacity:0.6">(${pp.label}, boat A = ${A.name}, B = ${B.name})</span>`;
    }

    // wrap the game's update so the pin runs after physics, before draw
    const _update = window.update;
    window.update = function (dt) { _update(dt); try { pin(); } catch (e) { } };

    // the racing HUD is noise here — this page is about two boats and a rule
    function hideHud() {
        for (const sel of ['#leaderboard', '#raceInfo', '#quoteBar', '#minimapPanel', '#minimap']) {
            const e = document.querySelector(sel);
            if (e) { let p = e; if (sel === '#minimap' && e.parentElement) p = e.parentElement; p.style.display = 'none'; }
        }
        // any fixed panels that carry a leaderboard-like list
        for (const e of document.querySelectorAll('[id*="eaderboard"],[id*="uote"]')) e.style.display = 'none';
    }

    window.addEventListener('load', () => setTimeout(boot, 400));
})();
