// THE RULE-INSPECTION PAGE (rules.html) — renders js/rule_scenarios.js with
// the real game. One scenario loops at a time: the boats are PINNED to the
// scenario's scripted geometry every frame while the live engine (rules oracle,
// contact/mark/island umpires) runs underneath, so what the overlay reports is
// what the shipping game would actually rule. Rule text underneath, a
// DETERMINATION line per phase (expected vs what the engine says, with a
// verdict), prev/next to move through the battery. Only the boats under
// consideration are on the water — they are renamed A and B, the camera is a
// fixed north-up view centred on them, and the player boat is parked offshore.
// The same data file drives eval/test_scenarios.js.
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
        frame: null,
        t: 0,
        program: null,      // [{pose, label, oracle, behavior}]
        boats: null,
        ready: false,
    };

    const PHASE_HOLD = 3.0;   // seconds a phase's pose is held
    const PHASE_MOVE = 1.2;   // seconds animating into the next pose

    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    // ── overlay ────────────────────────────────────────────────────────
    const box = el('div');
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(10,18,28,0.90);color:#dbe7f3;font:14px/1.45 system-ui,sans-serif;padding:14px 18px 12px;border-top:1px solid rgba(120,180,220,0.35)';
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
    const detEl = el('div'); detEl.style.cssText = 'margin-top:9px;font:13px/1.5 ui-monospace,monospace';
    box.append(head, textEl, detEl);
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

    // Playback program: one segment per PHASE (pose after its move, plus that
    // phase's oracle/behavior asserts, so the determination tracks the phase).
    function buildProgram(s, F) {
        const wd = getWindAt(F.origin.x, F.origin.y).direction;
        const segs = [];
        const base = {};
        for (const bs of s.boats) {
            base[bs.name] = { ...posOf(F, s, bs), heading: hdgOf(F, wd, bs.heading), isTacking: !!bs.isTacking };
        }
        segs.push({ pose: JSON.parse(JSON.stringify(base)), label: 'setup', oracle: null, behavior: null });
        let cur = base;
        for (let k = 0; k < s.phases.length; k++) {
            const ph = s.phases[k];
            let pose = cur;
            if (ph.move || ph.marchToLand) {
                pose = JSON.parse(JSON.stringify(cur));
                if (ph.move) for (const n of Object.keys(ph.move)) {
                    const mv = ph.move[n];
                    const P = posOf(F, s, mv);
                    pose[n] = { ...pose[n], x: P.x, y: P.y };
                    if (mv.heading != null) pose[n].heading = hdgOf(F, wd, mv.heading);
                }
                if (ph.marchToLand) {
                    const mb = ph.marchToLand;
                    pose[mb.boat] = { ...pose[mb.boat], x: F.origin.x + F.ux * 110, y: F.origin.y + F.uy * 110 };
                    pose[mb.follower] = { ...pose[mb.follower], x: F.origin.x + F.ux * 50, y: F.origin.y + F.uy * 50 };
                }
                cur = pose;
            }
            segs.push({ pose, label: 'phase ' + (k + 1) + '/' + s.phases.length,
                        oracle: ph.oracle || null, behavior: ph.behavior || null });
        }
        return segs;
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
        // ONLY the boats under consideration exist on this page: they carry the
        // scenario's own names, everything else is parked far offshore — the
        // player included (the camera is decoupled below, and the player must
        // stay un-finished or the results overlay fires).
        V.boats.A.name = 'A';
        V.boats.B.name = 'B';
        for (const o of st.boats) {
            if (o === bots[0] || o === bots[1]) continue;
            o.x = -1e6; o.y = -1e6; o.speed = 0;
            if (!o.isPlayer) { o.raceState.finished = true; o.fadeTimer = 0; }
        }
        V.frame = resolveFrame(V.s);
        if (!V.frame) { detEl.textContent = 'No anchor found on this venue for ' + V.s.id; return; }
        V.program = buildProgram(V.s, V.frame);
        ruleEl.textContent = V.s.rule;
        titleEl.textContent = V.s.title;
        countEl.textContent = (V.i + 1) + ' / ' + SCN.length;
        textEl.textContent = '“' + V.s.ruleText + '”';
        window.Rules.interactions = {};
        hideHud();
        V.t = 0; V.ready = true;
    }

    function segAt(t) {
        const P = V.program;
        let acc = 0;
        for (let i = 0; i < P.length; i++) {
            if (t < acc + PHASE_HOLD) return { a: P[i].pose, b: P[i].pose, f: 0, seg: P[i] };
            acc += PHASE_HOLD;
            if (i < P.length - 1) {
                if (t < acc + PHASE_MOVE) {
                    const f = (t - acc) / PHASE_MOVE;
                    return { a: P[i].pose, b: P[i + 1].pose, f, seg: P[i + 1] };
                }
                acc += PHASE_MOVE;
            }
        }
        return null;
    }

    // live observation, same vocabulary as the runner
    function observe() {
        const A = V.boats.A, B = V.boats.B;
        const res = window.Rules.getRightOfWay(A, B);
        return {
            row: res.boat ? (res.boat === A ? 'A' : 'B') : null,
            rule: res.rule || null,
            markRoom: res.markRoom === A.id ? 'A' : res.markRoom === B.id ? 'B' : null,
            overlapped: window.Rules.isOverlapped(A, B),
            constraintR15: !!(res.constraints && res.constraints.indexOf('Rule 15') !== -1),
            penA: !!A.raceState.penalty, penB: !!B.raceState.penalty,
            isTackingA: !!A.raceState.isTacking, isTackingB: !!B.raceState.isTacking,
            contact: Math.hypot(A.x - B.x, A.y - B.y) < 60,
        };
    }

    const LABELS = {
        row: 'right of way', rule: 'rule applied', markRoom: 'mark-room',
        overlapped: 'overlapped', constraintR15: 'rule-15 window',
        penA: 'penalty on A', penB: 'penalty on B',
        isTackingA: 'A tacking flag', isTackingB: 'B tacking flag',
        contact: 'hulls in contact', grounded: 'aground',
    };
    const show = (v) => v === null ? 'none' : v === true ? 'yes' : v === false ? 'no' : String(v);

    function determination(seg, obs) {
        const parts = [];
        let allOk = true, any = false;
        for (const [spec, tag] of [[seg.oracle, ''], [seg.behavior, '']]) {
            if (!spec) continue;
            for (const key of Object.keys(spec)) {
                if (!(key in LABELS)) continue;
                any = true;
                const want = spec[key];
                if (key === 'grounded') { parts.push(`${LABELS[key]}: expected ${show(want)}`); continue; }
                const got = obs[key];
                const ok = got === want;
                if (!ok) allOk = false;
                parts.push(`${LABELS[key]} → expected <b>${show(want)}</b>, engine says <b>${show(got)}</b> ` +
                    (ok ? '<span style="color:#8fe38f">✓</span>' : '<span style="color:#ff9b8f">✗</span>'));
            }
        }
        if (!any) return `<span style="opacity:0.65">${seg.label}: setting up — no determination asserted in this phase</span>`;
        let verdict;
        if (allOk) verdict = '<b style="color:#8fe38f">ENGINE MATCHES THE RULE</b>';
        else if (V.s.knownGap) verdict = '<b style="color:#ffc46b">ENGINE DIFFERS — KNOWN GAP (not yet encoded)</b>';
        else verdict = '<b style="color:#ff9b8f">ENGINE DIFFERS FROM THE RULE</b>';
        return `<span style="opacity:0.75">${seg.label}</span> · ${parts.join(' · ')}<br>DETERMINATION: ${verdict}`;
    }

    function pin() {
        if (!V.ready) return;
        const st = window.state;
        V.t += 1 / 60;
        let pp = segAt(V.t);
        if (!pp) {
            for (const n of Object.keys(V.boats)) {
                V.boats[n].raceState.penalty = false;
                V.boats[n].raceState.totalPenalties = 0;
                V.boats[n].raceState.penaltyTurnsOwed = 0;
            }
            window.Rules.interactions = {};
            V.t = 0; pp = segAt(0);
        }
        for (const n of Object.keys(V.boats)) {
            const bt = V.boats[n];
            const a = pp.a[n], b = pp.b[n];
            bt.x = a.x + (b.x - a.x) * pp.f;
            bt.y = a.y + (b.y - a.y) * pp.f;
            bt.heading = a.heading + normalizeAngle(b.heading - a.heading) * pp.f;
            bt.speed = 1.5;
            bt.velocity = { x: Math.sin(bt.heading) * 1.5, y: -Math.cos(bt.heading) * 1.5 };
            bt.raceState.finished = false; bt.raceState.ocs = false;
            bt.raceState.isTacking = !!a.isTacking;
            if (V.s.anchor === 'roundMark' && V.frame.leg != null) bt.raceState.leg = V.frame.leg;
        }
        // the player stays parked offshore, un-finished (a finished player
        // fires the results overlay), and the camera is OURS: a fixed
        // north-up view centred between the two boats. pin() runs after
        // update()'s camera block, so these writes win the frame.
        const pl = st.boats.find(b => b.isPlayer);
        if (pl) { pl.x = -1e6; pl.y = -1e6; pl.speed = 0; pl.velocity = { x: 0, y: 0 }; pl.raceState.finished = false; }
        const A = V.boats.A, B = V.boats.B;
        const cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2;
        st.camera.rotation = 0;
        st.camera.fx = cx; st.camera.fy = cy;
        st.camera.x = cx; st.camera.y = cy;
        st.camera.target = 'boat';
        detEl.innerHTML = determination(pp.seg, observe());
    }

    // wrap the game's update so the pin runs after physics, before draw
    const _update = window.update;
    window.update = function (dt) { _update(dt); try { pin(); } catch (e) { } };

    // the racing HUD is noise here — this page is about two boats and a rule
    function hideHud() {
        for (const sel of ['#leaderboard', '#raceInfo', '#quoteBar', '#minimapPanel', '#minimap',
                           '#pre-race-overlay', '#results-overlay', '#ai-saying-overlay']) {
            const e = document.querySelector(sel);
            if (e) { let p = e; if (sel === '#minimap' && e.parentElement) p = e.parentElement; p.style.display = 'none'; }
        }
        for (const e of document.querySelectorAll('[id*="eaderboard"],[id*="uote"]')) e.style.display = 'none';
    }

    window.addEventListener('load', () => setTimeout(boot, 400));
})();
