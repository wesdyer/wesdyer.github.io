// regatta/js/ui/raceresults.js — THE RACE RESULTS' LEFT HALF AND YOUR LEGS (PT-007, Oct 2026).
//
// Wes, over five playtests: the Time Trial page's chart was "almost better than the race post results";
// he wanted the chart, a replay ("I don't know exactly where I won so well against the fleet... if I had a
// better replay I would be able to figure that out"), zoom, and his own legs — tacks, gybes, overtakes —
// with the table cut down to what he reads. So the race page is the Time Trial's shape:
//
//   the chart   every boat's track from RaceLog (yours by leg colour, the fleet in its own hues), the boats
//               where they were at the replay's clock, a scrubber with your roundings, penalties, hits and
//               overtakes on it, play at 4/8/16×; wheel or pinch to zoom, drag to pan, double-click to reset
//   your legs   time, place at the end of the leg and the places it won or lost, tacks, gybes, boats passed
//               and passed by, hits and penalties; a row picks its leg out on the chart and jumps there
//
// Nothing here touches the race: it reads RaceLog and raceState. Classic script; loads after screens.js.

let _raceMap = null;
const RR_SPEEDS = [4, 8, 16];

function renderRaceResults(player, sorted) {
    if (!window.RaceLog) return;
    _raceLegs(player);   // from raceState; the counts are empty without a log
    if (RaceLog.t0 == null) return;
    _raceMapBuild(player);
    _raceMapLegend(player);
    _raceReplayBar();
    _raceMapDraw();
}

// ── THE CHART ───────────────────────────────────────────────────────────────────────────────────────────
// The minimap's own drawing, rendered once per race onto a base canvas at up to twice the display size
// (so a zoom has pixels to show); tracks and boats go over it on every redraw.
function _raceMapBuild(player) {
    const cv = document.getElementById('res-race-map'); if (!cv) return;
    const px = Math.round(cv.clientWidth * (window.devicePixelRatio || 1)) || 640;
    if (_raceMap && _raceMap.cv === cv && _raceMap.t0 === RaceLog.t0 && _raceMap.boats === RaceLog.boats && _raceMap.px === px) return;
    const B = Math.min(px * 3, 3000);   // a zoom has pixels to show, up to 4× at 1×-dpr
    const base = document.createElement('canvas'); base.width = B; base.height = B;
    drawMinimap.target = { ctx: base.getContext('2d') };
    try { drawMinimap(); } finally { drawMinimap.target = null; }
    const P = drawMinimap.last; if (!P) return;
    cv.width = px; cv.height = px;
    const meI = RaceLog.boats.findIndex(Bx => Bx.boat === player);
    _raceMap = { cv, base, P, px, B, t0: RaceLog.t0, boats: RaceLog.boats, me: meI, sel: null,
                 z: 1, vx: B / 2, vy: B / 2, T: null, playing: false, speed: 8, follow: true, raf: 0 };
    _raceMapWire();
}
function _rrXY(x, y) { const P = _raceMap.P; return [(x - P.cx) * P.scale + P.width / 2, (y - P.cy) * P.scale + P.height / 2]; }
function _rrColour(b) { return (typeof deepBandFor === 'function') ? deepBandFor(b.colors.hull, b.colors.spinnaker, b.colors.spinAccent) : (b.colors && b.colors.hull) || '#ccc'; }
function _rrT() { const M = _raceMap; const tm = RaceLog.tMax(); return (M.T == null || M.follow) ? tm : Math.min(M.T, tm); }

function _raceMapDraw() {
    const M = _raceMap; if (!M) return;
    const g = M.cv.getContext('2d'), k = M.z * M.px / M.B, T = _rrT();
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, M.px, M.px);
    g.setTransform(k, 0, 0, k, M.px / 2 - M.vx * k, M.px / 2 - M.vy * k);
    g.drawImage(M.base, 0, 0);
    const lw = Math.max(2, M.px / 300) / k, upto = Math.floor((T - RaceLog.t0) / RACELOG_DT);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // THE FLEET, faint, each in its own colour — up to the replay's clock, so the race unfolds as it plays.
    RaceLog.boats.forEach((Bx, i) => {
        if (i === M.me || Bx.s.length < 2) return;
        g.globalAlpha = M.sel == null ? 0.42 : 0.18; g.strokeStyle = _rrColour(Bx.boat); g.lineWidth = lw * 0.7;
        g.beginPath(); let first = true;
        for (let j = 0; j < Bx.s.length && j <= upto; j++) { const q = Bx.s[j]; if (M.sel != null && q[3] !== M.sel) { first = true; continue; }
            const [x, y] = _rrXY(q[0], q[1]); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); }
        g.stroke();
    });
    // YOU, leg by leg in the Time Trial's colours, over an outline that reads on any water.
    const run = M.me >= 0 ? RaceLog.boats[M.me].s : [];
    for (const pass of [0, 1]) for (let j = 1; j < run.length && j <= upto; j++) {
        const a = run[j - 1], b = run[j], leg = b[3] || 0, on = M.sel == null || leg === M.sel;
        g.globalAlpha = on ? (leg === 0 && pass ? 0.6 : 1) : 0.15;
        const [x0, y0] = _rrXY(a[0], a[1]), [x1, y1] = _rrXY(b[0], b[1]);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
        g.strokeStyle = pass ? _trialLegColour(leg) : 'rgba(8,16,28,0.75)'; g.lineWidth = pass ? lw * (M.sel === leg ? 1.6 : 1) : lw * 1.6 + 2.5 / k; g.stroke();
    }
    g.globalAlpha = 1;
    // THE BOATS at the replay's clock: a hull-coloured dart each, yours bigger with a white edge.
    const dart = (x, y, h, c, big, ended) => {
        const s = (big ? 7 : 5) * lw * (k > 2 ? 0.8 : 1);
        g.save(); g.translate(x, y); g.rotate(h); g.globalAlpha = ended ? 0.55 : 1;
        g.beginPath(); g.moveTo(0, -s * 1.5); g.lineTo(s, s); g.lineTo(0, s * 0.45); g.lineTo(-s, s); g.closePath();
        g.fillStyle = c; g.fill(); g.lineWidth = (big ? 2.4 : 1.4) / k; g.strokeStyle = big ? '#ffffff' : 'rgba(6,14,26,0.9)'; g.stroke(); g.restore();
    };
    RaceLog.boats.forEach((Bx, i) => { if (i === M.me) return; const p = RaceLog.poseAt(i, T); if (p) { const [x, y] = _rrXY(p.x, p.y); dart(x, y, p.heading, _rrColour(Bx.boat), false, p.ended); } });
    if (M.me >= 0) { const p = RaceLog.poseAt(M.me, T); if (p) { const [x, y] = _rrXY(p.x, p.y); dart(x, y, p.heading, _rrColour(RaceLog.boats[M.me].boat), true, false);
        // ...and a label, so "which one is me" is never a question at a glance
        g.save(); g.translate(x, y); g.scale(1 / k, 1 / k); g.font = '800 11px Inter, system-ui, sans-serif'; g.textAlign = 'center';
        g.lineWidth = 3; g.strokeStyle = 'rgba(6,14,26,0.9)'; g.strokeText('YOU', 0, -18); g.fillStyle = '#ffffff'; g.fillText('YOU', 0, -18); g.restore(); } }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const zb = document.getElementById('res-race-zoom'); if (zb) zb.style.display = M.z > 1.01 ? '' : 'none';
    _raceReplaySync();
}

function _raceMapWire() {
    const M = _raceMap, cv = M.cv;
    if (cv.dataset.wired) return;   // the canvas outlives the race; its listeners read the current _raceMap
    cv.dataset.wired = '1';
    const at = (e) => { const r = cv.getBoundingClientRect(), s = _raceMap.px / r.width; return [(e.clientX - r.left) * s, (e.clientY - r.top) * s]; };
    // screen pixel → base pixel, and the view kept on the chart
    const toBase = (sx, sy) => { const R = _raceMap, k = R.z * R.px / R.B; return [R.vx + (sx - R.px / 2) / k, R.vy + (sy - R.px / 2) / k]; };
    const clamp = () => { const R = _raceMap, half = R.B / (2 * R.z); R.vx = Math.max(half, Math.min(R.B - half, R.vx)); R.vy = Math.max(half, Math.min(R.B - half, R.vy)); };
    cv.addEventListener('wheel', (e) => {
        if (!_raceMap) return; e.preventDefault();
        const R = _raceMap, [sx, sy] = at(e), [bx, by] = toBase(sx, sy);
        R.z = Math.max(1, Math.min(4, R.z * Math.pow(1.0018, -e.deltaY)));
        const k = R.z * R.px / R.B; R.vx = bx - (sx - R.px / 2) / k; R.vy = by - (sy - R.px / 2) / k; clamp(); _raceMapDraw();
    }, { passive: false });
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { if (!_raceMap || _raceMap.z <= 1.01) return; drag = { x: e.clientX, y: e.clientY, vx: _raceMap.vx, vy: _raceMap.vy }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => { if (!drag || !_raceMap) return; const R = _raceMap, r = cv.getBoundingClientRect(), s = R.px / r.width, k = R.z * R.px / R.B;
        R.vx = drag.vx - (e.clientX - drag.x) * s / k; R.vy = drag.vy - (e.clientY - drag.y) * s / k; clamp(); _raceMapDraw(); });
    const end = () => { drag = null; cv.style.cursor = _raceMap && _raceMap.z > 1.01 ? 'grab' : ''; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    const reset = () => { if (!_raceMap) return; const R = _raceMap; R.z = 1; R.vx = R.vy = R.B / 2; end(); _raceMapDraw(); };
    cv.addEventListener('dblclick', reset);
    const zb = document.getElementById('res-race-zoom'); if (zb) zb.addEventListener('click', reset);
}

function _raceMapSelect(leg) {
    const M = _raceMap; if (!M) return;
    M.sel = (leg == null || M.sel === leg) ? null : leg;
    document.querySelectorAll('#res-race-legs .res-race-leg').forEach(r => { const on = M.sel != null && +r.dataset.leg === M.sel;
        r.style.background = on ? 'rgba(255,255,255,0.08)' : ''; r.style.boxShadow = on ? `inset 3px 0 0 ${_trialLegColour(M.sel)}` : ''; r.style.opacity = M.sel == null || on ? '' : '0.55'; });
    _raceMapDraw();
}
function _raceMapLegend(player) {
    const el = document.getElementById('res-race-legend'); if (!el || !_raceMap) return;
    const legs = player.raceState.legTimes.length, sig = String(legs);
    if (el.dataset.sig === sig) return; el.dataset.sig = sig;
    const sw = (c) => `<span style="display:inline-block; width:20px; height:0; border-top:3px solid ${c}; vertical-align:middle; margin-right:6px;"></span>`;
    el.innerHTML = [`<span data-leg="0" style="cursor:pointer;">${sw(_trialLegColour(0))}Start</span>`,
        ...Array.from({ length: legs }, (_, i) => `<span data-leg="${i + 1}" style="cursor:pointer;">${sw(_trialLegColour(i + 1))}Leg ${i + 1}</span>`),
        `<span>${sw('rgba(200,210,230,0.5)')}The fleet</span>`].join('')
        + `<span style="color:#66748c; margin-left:auto;">Scroll to zoom · drag to pan</span>`;
    el.querySelectorAll('[data-leg]').forEach(s => s.addEventListener('click', () => _raceMapSelect(+s.dataset.leg)));
}

// ── THE REPLAY BAR ──────────────────────────────────────────────────────────────────────────────────────
// Play/pause, the clock, a scrubber from the gun (the prestart is there to drag back into) to the last
// sample, with your race's moments as ticks, and the speed. It FOLLOWS the end while boats are still
// finishing behind you, until you take hold of it.
const _RR_TICK = { leg: ['#e2e8f0', 'Mark rounded'], pass: ['#34d399', 'You passed'], passedBy: ['#f87171', 'Passed by'], pen: ['#fbbf24', 'Penalty'], hit: ['#fb923c', 'Hit'] };
function _raceReplayBar() {
    const host = document.getElementById('res-race-replay'); if (!host || !_raceMap) return;
    if (host.dataset.t0 !== String(RaceLog.t0) || !host.firstChild) {
        host.dataset.t0 = String(RaceLog.t0);
        const chip = (txt, attr) => `<span ${attr} class="t-mono" style="cursor:pointer; user-select:none; border:1px solid rgba(255,255,255,0.16); border-radius:999px; padding:4px 9px; font-size:11px; color:#c4d2e6;">${txt}</span>`;
        host.innerHTML = `<div class="flex items-center" style="gap:10px;">
            <span id="rr-play" role="button" aria-label="Play the replay" style="cursor:pointer; user-select:none; width:34px; height:34px; flex:none; border-radius:50%; background:#2f6bff; display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px;"></span>
            <span id="rr-clock" class="t-mono" style="font-size:12px; color:#dbeafe; width:66px; flex:none;"></span>
            <div style="position:relative; flex:1; min-width:0; height:34px;">
                <div id="rr-ticks" style="position:absolute; left:8px; right:8px; top:0; height:10px;"></div>
                <input id="rr-scrub" type="range" min="0" max="1000" step="1" value="1000" style="position:absolute; left:0; right:0; top:12px; width:100%; accent-color:#5aa7ff;">
            </div>
            <span class="flex" style="gap:4px; flex:none;">${RR_SPEEDS.map(v => chip(v + '×', `data-speed="${v}"`)).join('')}</span>
        </div>
        <div class="flex flex-wrap" style="gap:12px; margin-top:4px; font-size:11px; color:#66748c;">${Object.entries(_RR_TICK).map(([, [c, n]]) => `<span><span style="display:inline-block; width:7px; height:7px; border-radius:2px; background:${c}; margin-right:5px;"></span>${n}</span>`).join('')}</div>`;
        const scrub = host.querySelector('#rr-scrub');
        scrub.addEventListener('input', () => { const M = _raceMap; if (!M) return; M.playing = false; const t = _rrScrubT(+scrub.value); M.T = t; M.follow = +scrub.value >= 1000; _raceMapDraw(); });
        host.querySelector('#rr-play').addEventListener('click', () => _raceReplayToggle());
        host.querySelectorAll('[data-speed]').forEach(s => s.addEventListener('click', () => { if (_raceMap) { _raceMap.speed = +s.dataset.speed; _raceReplaySync(); } }));
    }
    // the ticks: re-laid when the clock's span grows (boats still finishing) or the events change
    const ticks = host.querySelector('#rr-ticks'), lo = _rrLo(), hi = RaceLog.tMax(), sig = `${lo}|${hi.toFixed(1)}|${RaceLog.events.length}`;
    if (ticks && ticks.dataset.sig !== sig) {
        ticks.dataset.sig = sig;
        ticks.innerHTML = RaceLog.events.filter(e => e.t >= lo && _RR_TICK[e.kind]).map(e => {
            const f = (e.t - lo) / Math.max(1, hi - lo), [c, n] = _RR_TICK[e.kind];
            const tip = e.kind === 'leg' ? `${n}: end of leg ${e.leg}` : e.who ? `${n} ${e.who} (leg ${e.leg})` : `${n} (leg ${e.leg})`;
            return `<span title="${tip} · ${formatSplitTime(Math.max(0, e.t))}" data-t="${e.t}" style="position:absolute; left:calc(${(f * 100).toFixed(2)}% - 3px); top:0; width:6px; height:${e.kind === 'leg' ? 10 : 7}px; border-radius:2px; background:${c}; cursor:pointer;"></span>`;
        }).join('');
        ticks.querySelectorAll('[data-t]').forEach(s => s.addEventListener('click', () => _raceSeek(+s.dataset.t - 4)));
    }
}
function _rrLo() { return Math.min(0, RaceLog.t0 != null ? 0 : 0); }   // the scrubber starts at the gun
function _rrScrubT(v) { const lo = _rrLo(), hi = RaceLog.tMax(); return lo + (hi - lo) * v / 1000; }
function _raceSeek(t) { const M = _raceMap; if (!M) return; M.T = Math.max(RaceLog.t0, Math.min(RaceLog.tMax(), t)); M.follow = false; _raceMapDraw(); }
function _raceReplaySync() {
    const M = _raceMap; if (!M) return;
    const T = _rrT(), lo = _rrLo(), hi = RaceLog.tMax();
    const scrub = document.getElementById('rr-scrub'); if (scrub && document.activeElement !== scrub) scrub.value = String(Math.round(Math.max(0, Math.min(1, (T - lo) / Math.max(1, hi - lo))) * 1000));
    const clock = document.getElementById('rr-clock'); if (clock) clock.textContent = (T < 0 ? '−' : '') + formatSplitTime(Math.abs(T)).replace(/\.\d+$/, '');
    const play = document.getElementById('rr-play'); if (play) play.innerHTML = M.playing ? '&#10074;&#10074;' : '&#9654;';
    document.querySelectorAll('#res-race-replay [data-speed]').forEach(s => { const on = +s.dataset.speed === M.speed; s.style.background = on ? '#2f6bff' : ''; s.style.color = on ? '#fff' : '#c4d2e6'; s.style.borderColor = on ? 'transparent' : 'rgba(255,255,255,0.16)'; });
}
function _raceReplayToggle() {
    const M = _raceMap; if (!M) return;
    M.playing = !M.playing;
    if (M.playing) {
        if (M.follow || _rrT() >= RaceLog.tMax() - 0.1) M.T = _rrLo();   // from the end, play from the gun
        M.follow = false;
        let last = performance.now();
        const step = (now) => {
            const R = _raceMap; if (!R || !R.playing) return;
            const ov = document.getElementById('results-overlay'); if (!ov || ov.classList.contains('hidden')) { R.playing = false; return; }
            R.T += (now - last) / 1000 * R.speed; last = now;
            if (R.T >= RaceLog.tMax()) { R.T = RaceLog.tMax(); R.playing = false; }
            _raceMapDraw();
            if (R.playing) R.raf = requestAnimationFrame(step);
        };
        M.raf = requestAnimationFrame(step);
    }
    _raceReplaySync();
}

// ── YOUR RACE, LEG BY LEG ───────────────────────────────────────────────────────────────────────────────
// What changed the race on each leg, green and red: the places it won or lost, and the boats behind them.
function _raceLegs(player) {
    const host = document.getElementById('res-race-legs'); if (!host) return;
    const rs = player.raceState, M = RaceLog.me || {}, legs = rs.legTimes.length;
    const sig = [legs, rs.legTimes.map(t => t.toFixed(2)).join(','), rs.legRanks.join(','), rs.startRank, RaceLog.events.length, JSON.stringify(M.place || {})].join('|');
    if (host.dataset.sig === sig) return; host.dataset.sig = sig;
    const n = (o, k) => (o && o[k]) || 0;
    const cell = (v, col) => `<span class="t-mono" style="color:${col || '#c4d2e6'};">${v}</span>`;
    const num = (v, good) => cell(v || '—', v ? (good === true ? '#34d399' : good === false ? '#f87171' : '#c4d2e6') : '#4a5a72');
    const cols = '16px 64px 1fr 0.7fr 0.6fr 0.55fr 0.55fr 0.65fr 0.65fr 0.5fr';
    const row = (k, label, t, rank, prev) => {
        const d = rank && prev ? prev - rank : 0;
        const move = !rank || !prev ? cell('—', '#4a5a72') : d > 0 ? cell(`▲${d}`, '#34d399') : d < 0 ? cell(`▼${-d}`, '#f87171') : cell('–', '#66748c');
        const pen = n(M.pens, k), hit = n(M.hits, k);
        return `<div class="grid items-center res-race-leg" data-leg="${k}" style="grid-template-columns:${cols}; gap:8px; padding:8px 12px; border-top:1px solid rgba(255,255,255,0.06); font-size:13px; cursor:pointer; border-radius:8px;">
            <span style="width:10px; height:10px; border-radius:3px; background:${_trialLegColour(k)};"></span>
            <span class="t-label t-label-sm" style="color:#dbeafe;">${label}</span>
            ${cell(t != null ? t : '—', '#eef3fb')}
            ${cell(rank ? ordinalOf(rank) : '—', '#dbeafe')}
            ${move}
            ${num(n(M.tacks, k))}${num(n(M.gybes, k))}
            ${num(n(M.passed, k), true)}${num(n(M.passedBy, k), false)}
            ${num(pen + hit ? `${hit}${pen ? ' / ' + pen + 'P' : ''}` : 0, false)}</div>`;
    };
    const split = (t) => { const m = Math.floor(t / 60), s = (t % 60).toFixed(1); return `${m}:${s.padStart(4, '0')}`; };
    const rows = [];
    // THE PLACE AS EACH LEG ENDED, from RaceLog's count when there is one — the same count as the passes beside
    // it, so a row always adds up (the engine's own rank at the finish frame misses a boat finishing that frame).
    const placeAt = (k) => (M.place && M.place[k]) || (k === 0 ? rs.startRank : rs.legRanks[k - 1]) || 0;
    if (rs.startTimeDisplay > 0 || rs.startRank) rows.push(row(0, 'Start', rs.startTimeDisplay > 0 ? '+' + rs.startTimeDisplay.toFixed(1) + 's' : null, placeAt(0), 0));
    let prev = placeAt(0);
    for (let i = 0; i < legs; i++) { const r = placeAt(i + 1); rows.push(row(i + 1, `Leg ${i + 1}`, split(rs.legTimes[i]), r, prev)); if (r) prev = r; }
    const head = `<div class="grid t-label" style="grid-template-columns:${cols}; gap:8px; padding:0 12px 8px; font-size:10px; letter-spacing:0.12em; color:#66748c;">
        <span></span><span>Leg</span><span>Time</span><span>Place</span><span>+/−</span><span title="Tacks">Tacks</span><span title="Gybes">Gybes</span><span title="Boats you passed">Passed</span><span title="Boats that passed you">Lost to</span><span title="Hits / penalties">Hits</span></div>`;
    const sum = (o) => Object.values(o || {}).reduce((a, c) => a + c, 0);
    const totals = `<span style="color:#66748c;">· ${sum(M.tacks)} tacks, ${sum(M.gybes)} gybes, passed ${sum(M.passed)}, passed by ${sum(M.passedBy)}</span>`;
    host.innerHTML = `<div style="background:#101a2e; border:1px solid rgba(255,255,255,0.09); border-radius:16px; padding:14px 4px 6px;">
        <div class="t-label t-label-sm" style="color:#dbeafe; padding:0 12px 10px;">Your race, leg by leg ${totals}</div>
        ${head}${rows.join('') || '<div style="padding:10px 12px; color:#66748c;">No legs sailed.</div>'}</div>`;
    host.querySelectorAll('.res-race-leg').forEach(r => r.addEventListener('click', () => {
        const k = +r.dataset.leg; _raceMapSelect(k);
        if (_raceMap && _raceMap.sel === k && RaceLog.legStart[k] != null) _raceSeek(RaceLog.legStart[k]);
    }));
}
