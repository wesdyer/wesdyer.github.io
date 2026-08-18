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
// How it works: the real game boots on the lab venue (open water), the stock
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
    cover.innerHTML = '<div style="font:italic 900 26px Archivo,system-ui;letter-spacing:0.06em;color:#eef3fb">SCENARIO LAB</div>' +
        '<div id="cover-msg" style="opacity:0.7">setting up open water&hellip;</div>';
    (document.body ? Promise.resolve() : new Promise(r => window.addEventListener('DOMContentLoaded', r)))
        .then(() => document.body.appendChild(cover));
    function dismissCover() {
        cover.style.opacity = '0';
        setTimeout(() => cover.remove(), 400);
    }

    // ── force the lab venue (cover stays up through the reload). 'lab' is
    // the Scenario Lab's own stage: Sea Trials water, a big circular arena,
    // nothing else — assets/venues/lab.venue.js, loaded by scenario.html
    // only, absent from VENUE_ORDER so the game's picker never offers it
    // (and the game itself falls back to bay if this setting leaks over) ──
    let savedSettings = {};
    try { savedSettings = JSON.parse(localStorage.getItem('regatta_settings') || '{}'); } catch (e) { }
    if (savedSettings.venue !== 'lab') {
        savedSettings.venue = 'lab';
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
        // A SCENARIO IS A SET OF SEEDS (owner ruling): one or more, fixed,
        // saved with the doc. Running simulates EVERY seed; the transport
        // shows the ACTIVE one and switching swaps cached recordings.
        // Assertions must hold on all of them. (0x9e3779b9 is the
        // pre-seed-field constant, so older docs replay bit-identically.)
        seeds: [0x9e3779b9],
        seedIx: 0,           // which seed the transport is showing
        recs: {},            // seed -> recording cache (cleared on any edit)
        cam: { x: 0, y: 0 },
        drag: null,
        pool: [],
        rec: null,           // {frames:[...], ticks:[frameIdx], nF}
        frame: 0, playing: false,
        recording: false,
        goalArm: false,      // "+ ADD GOAL" armed: next click appends a goal
        zoom: 1,             // 1 = 100%; the game canvas renders at viewport/zoom
        asserts: [],         // structured expectations, saved with the doc
        assertResults: null, // last run's verdicts (ScenarioAsserts.evaluate)
    };
    // debug/test seam: lets the console (and the Playwright checks) see the
    // lab's state without threading it through the page
    window.__LAB = LAB;

    // ── UI: the editor convention — LAYERS on the left (the list is the
    // mode switch; “＋” on a layer arms placement), DETAILS on the right
    // (the selected object, or the Scenario layer itself). The play
    // transport stays on the bottom when in use. ───────────────────────
    // one type system, one panel material — the design-doc glass language
    // (t11): Archivo, dark glass panels, blue primary, teal "scripted" accents,
    // amber for right-of-way, red only for penalties and deletion.
    const style = document.createElement('style');
    style.textContent = `
      .sl-panel{position:fixed;top:20px;z-index:70;background:rgba(7,19,34,.88);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 10px 34px rgba(4,16,28,.4);color:#eef3fb;font:13px/1.4 Archivo,system-ui,sans-serif;overflow-x:hidden;overflow-y:auto;max-height:calc(100vh - 40px)}
      .sl-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1)}
      .sl-title{flex:1;font-size:15px;font-weight:900;font-style:italic;letter-spacing:.04em}
      .sl-chip{font-size:9px;font-weight:800;letter-spacing:.12em;color:#8fa3bd;background:rgba(255,255,255,.07);border-radius:5px;padding:3px 8px;white-space:nowrap}
      .sl-chip-teal{color:#8fd8d0;background:rgba(127,240,212,.12);border:1px solid rgba(127,240,212,.35);padding:2px 7px}
      .sl-sect{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
      .sl-sectlabel{font-size:9px;letter-spacing:.2em;font-weight:800;color:#66748c;margin-bottom:8px}
      .sl-lab{font-size:10px;font-weight:700;color:#8fa3bd;margin-bottom:4px}
      .sl-hint{font-size:10px;font-weight:700;color:#66748c}
      .sl-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .sl-inp{display:flex;align-items:center;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:0 10px}
      .sl-inp:focus-within{border-color:#2f6bff}
      .sl-inp input{flex:1;width:100%;min-width:0;background:none;border:none;outline:none;color:#eef3fb;font:800 13px Archivo,system-ui,sans-serif;font-variant-numeric:tabular-nums;padding:7px 0}
      .sl-inp input::placeholder{color:#66748c;font-weight:700}
      .sl-unit{font-size:11px;color:#66748c;font-weight:700;margin-left:6px}
      .sl-btn{appearance:none;flex:1;text-align:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 0;font:800 11px Archivo,system-ui,sans-serif;letter-spacing:.08em;color:#c4d2e6;cursor:pointer}
      .sl-btn:hover{background:rgba(255,255,255,.12)}
      .sl-btn-pri{background:#2f6bff;border-color:#2f6bff;color:#fff;font-weight:900}
      .sl-btn-pri:hover{background:#4a80ff}
      .sl-btn-danger{appearance:none;flex:none;background:none;border:1px solid rgba(236,48,19,.4);color:#ff8a75;padding:7px 14px;border-radius:8px;font:800 11px Archivo,system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}
      .sl-btn-danger:hover{background:rgba(236,48,19,.15)}
      .sl-mode{appearance:none;flex:1;text-align:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:8px 0;font:800 11px Archivo,system-ui,sans-serif;letter-spacing:.1em;color:#8fa3bd;cursor:pointer}
      .sl-mode:hover{background:rgba(255,255,255,.12)}
      .sl-mode.on{background:#2f6bff;border-color:#2f6bff;color:#fff;font-weight:900}
      .sl-lrow{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:12.5px;font-weight:600;letter-spacing:.03em}
      .sl-lrow:hover{background:rgba(255,255,255,.07)}
      .sl-lrow.on{background:rgba(47,107,255,.22);border-color:rgba(47,107,255,.5)}
      .sl-lchild{padding-left:26px}
      .sl-dot{width:8px;height:8px;border-radius:50%;flex:none}
      .sl-count{font-size:10px;font-weight:700;color:#66748c;font-variant-numeric:tabular-nums}
      .sl-add{width:18px;height:18px;border-radius:5px;background:rgba(255,255,255,.08);display:grid;place-items:center;font-size:12px;font-weight:800;color:#8fa3bd;cursor:pointer;flex:none}
      .sl-add:hover,.sl-add.on{background:#2f6bff;color:#fff}
      .sl-link{font-size:10px;font-weight:800;color:#5aa7ff;cursor:pointer;letter-spacing:.04em}
      .sl-link:hover{color:#8fc2ff}
      .sl-step{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:7px 8px;margin-bottom:6px}
      .sl-stepn{width:16px;height:16px;border-radius:5px;background:rgba(47,107,255,.3);display:grid;place-items:center;font-size:9px;font-weight:900;color:#8fc2ff;flex:none}
      .sl-bare{background:none;border:none;outline:none;color:#eef3fb;font:800 12px Archivo,system-ui,sans-serif;font-variant-numeric:tabular-nums;text-align:right;padding:0}
      .sl-card{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 12px}
      .sl-rowcard{background:rgba(242,193,78,.1);border:1px solid rgba(242,193,78,.4);border-radius:10px;padding:10px 12px;margin-bottom:6px}
      .sl-rulelabel{font-size:9px;letter-spacing:.18em;font-weight:900;color:#f2c14e}
      .sl-bname{font-size:12px;font-weight:900;font-style:italic;letter-spacing:.03em}
      .sl-schip{font-size:10px;font-weight:800;letter-spacing:.06em;border-radius:5px;padding:3px 7px;white-space:nowrap}
      .sl-schip-teal{color:#8fd8d0;background:rgba(127,240,212,.1)}
      .sl-schip-amber{color:#f2c14e;background:rgba(242,193,78,.1)}
      .sl-schip-red{color:#ff8a75;background:rgba(236,48,19,.14)}
      .sl-schip-mute{color:#8fa3bd;background:rgba(255,255,255,.07)}
      .sl-schip-blue{color:#8fc2ff;background:rgba(47,107,255,.18)}
      .sl-msel{appearance:none;-webkit-appearance:none;background:rgba(255,255,255,.08);color:#eef3fb;border:none;border-radius:5px;font:800 10px Archivo,system-ui,sans-serif;letter-spacing:.04em;padding:3px 5px;cursor:pointer;text-align:center}
      .sl-tbtn{appearance:none;width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.07);border:none;display:grid;place-items:center;font-size:12px;color:#eef3fb;cursor:pointer;padding:0}
      .sl-tbtn:hover{background:rgba(255,255,255,.15)}
      .sl-tbtn-pri{background:#2f6bff}
      .sl-tbtn-pri:hover{background:#4a80ff}
      #pb-slider{-webkit-appearance:none;appearance:none;display:block;width:100%;height:6px;border-radius:3px;background:rgba(255,255,255,.14);outline:none;margin:0}
      #pb-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:pointer}
      #pb-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:none;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:pointer}`;
    document.head.appendChild(style);

    // ONE LEFT COLUMN (owner ruling 2026-08-17): the scenario details live at
    // the top of the lab panel, the selected object's details in a second
    // panel stacked just below it, and the transport is ALWAYS on the bottom
    // — pressing its play button is how a run starts. No mode buttons.
    const col = document.createElement('div');
    col.style.cssText = 'position:fixed;left:20px;top:20px;z-index:70;display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 40px);width:270px';
    const left = document.createElement('div');
    left.className = 'sl-panel';
    left.style.cssText = 'position:static;width:100%;max-height:none;flex:0 1 auto;min-height:0';
    left.innerHTML = `
      <div class="sl-head" style="justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <img src="assets/images/misc/salty-crew-yacht-club-burgee.png" alt="" style="width:22px;height:auto">
          <span style="font-size:13px;font-weight:900;font-style:italic;letter-spacing:.04em">SCENARIO LAB</span>
        </div>
        <span class="sl-chip sl-chip-teal">DEV</span>
      </div>
      <div class="sl-sect">
        <div class="sl-inp"><input id="lab-name" type="text" placeholder="Scenario Name"></div>
        <div class="sl-grid2" style="margin-top:8px">
          <div>
            <div class="sl-lab">Duration</div>
            <div class="sl-inp"><input id="lab-dur" type="text" inputmode="decimal" value="10"><span class="sl-unit">s</span></div>
          </div>
          <div>
            <div class="sl-lab">Wind</div>
            <div class="sl-inp"><input id="lab-wind" type="text" inputmode="decimal" value="12"><span class="sl-unit">kt</span></div>
          </div>
        </div>
        <div style="margin-top:8px">
          <div class="sl-lab" title="a scenario runs on EVERY seed in its set; click a pill to watch that run">Seeds</div>
          <div id="lab-seedpills" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px"></div>
          <div style="display:flex;gap:6px">
            <div class="sl-inp" style="flex:1"><input id="lab-seedadd" type="text" inputmode="numeric" placeholder="type a seed, or just roll"></div>
            <button id="lab-seed-rnd" class="sl-tbtn" title="add it — blank rolls a random seed">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="5" r="1.4"/><circle cx="11" cy="5" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="5" cy="11" r="1.4"/><circle cx="11" cy="11" r="1.4"/></svg>
            </button>
          </div>
        </div>
        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
            <span class="sl-sectlabel" style="margin:0" title="expectations checked against every run">ASSERTIONS</span>
            <span id="lab-assertadd" class="sl-link">+ ADD</span>
          </div>
          <div id="lab-asserts"></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button id="lab-save" class="sl-btn sl-btn-pri">SAVE</button>
          <button id="lab-saveas" class="sl-btn">SAVE AS&hellip;</button>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button id="lab-new" class="sl-btn">NEW</button>
          <button id="lab-open" class="sl-btn">OPEN&hellip;</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px">
          <span class="sl-hint" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums">library: <span id="lab-libname">not attached</span> &middot; <span id="lab-libopen" style="cursor:pointer;text-decoration:underline;text-underline-offset:2px" title="attach assets/scenarios.js so saves write to it">change</span></span>
          <span id="lab-clear" style="font-size:10px;font-weight:800;letter-spacing:.06em;color:#ff8a75;cursor:pointer;white-space:nowrap">CLEAR SCENE</span>
        </div>
      </div>
      <div style="padding:8px 8px 10px">
        <div class="sl-sectlabel" style="padding:4px 8px 6px;margin:0">LAYERS</div>
        <div id="lab-layers"></div>
      </div>`;

    // RIGHTS & UMPIRE stays on the RIGHT (owner ruling), its own always-on
    // panel: live rights at initial conditions while editing, the recording
    // while scrubbing.
    const ump = document.createElement('div');
    ump.className = 'sl-panel';
    ump.style.cssText = 'right:20px;top:20px;width:300px;max-height:calc(100vh - 120px)';
    ump.innerHTML = `
      <div class="sl-head">
        <span class="sl-title">RIGHTS &amp; UMPIRE</span>
        <span id="lab-agg" class="sl-schip" style="display:none" title="assertions passing on the last run"></span>
        <span id="lab-time" style="font-size:11px;font-weight:800;color:#8fd8d0;font-variant-numeric:tabular-nums"></span>
      </div>
      <div id="lab-rights" style="padding:12px 16px 8px"></div>
      <div class="sl-hint" style="padding:0 18px 12px">Scrub or step the transport &middot; SPACE plays and pauses</div>`;
    document.body.appendChild(ump);

    const right = document.createElement('div');
    right.className = 'sl-panel';
    right.style.cssText = 'position:static;width:100%;max-height:none;flex:0 1 auto;min-height:0;display:none';
    right.innerHTML = `
      <div class="sl-head">
        <span id="lab-seldot" style="width:12px;height:12px;border-radius:50%;flex:none;display:none"></span>
        <span id="lab-selname" class="sl-title"></span>
        <span id="lab-kindchip" class="sl-chip"></span>
      </div>
      <div id="det-boat" style="display:none">
        <div class="sl-sect">
          <div class="sl-sectlabel">START STATE</div>
          <div class="sl-grid2">
            <div>
              <div class="sl-lab">Heading</div>
              <div class="sl-inp"><input id="lab-hdg" type="text" inputmode="decimal"><span class="sl-unit">&deg;</span></div>
            </div>
            <div>
              <div class="sl-lab">Speed</div>
              <div class="sl-inp"><input id="lab-spd" type="text" inputmode="decimal"><span class="sl-unit">kt</span></div>
            </div>
          </div>
        </div>
        <div class="sl-sect">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <span class="sl-sectlabel" style="margin:0">PLAN</span>
            <span id="lab-planadd" class="sl-link">+ ADD STEP</span>
          </div>
          <div id="lab-plan"></div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
            <span class="sl-lab" style="margin:0" title="blank = scripted to the end">Hand to AI at</span>
            <div class="sl-inp" style="flex:1"><input id="lab-aiat" type="text" inputmode="decimal" placeholder="never"></div>
            <span class="sl-hint">s</span>
          </div>
        </div>
        <div class="sl-sect">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <span class="sl-sectlabel" style="margin:0" title="the AI sails these in order">GOALS</span>
            <span id="lab-goaladd" class="sl-link">+ ADD GOAL</span>
          </div>
          <div id="lab-goals"></div>
        </div>
      </div>
      <div id="det-mark" style="display:none">
        <div class="sl-sect">
          <div class="sl-sectlabel">ROUNDING</div>
          <div style="display:flex;gap:6px">
            <button id="lab-side-port" class="sl-btn">&#8634; PORT</button>
            <button id="lab-side-stbd" class="sl-btn">&#8635; STBD</button>
          </div>
          <div class="sl-hint" style="margin-top:8px">zone = 3 boat lengths &middot; &#8997;-drag resizes</div>
        </div>
      </div>
      <div id="det-sand" style="display:none">
        <div class="sl-sect"><div class="sl-hint">solid sand &middot; &#8997;-drag resizes &middot; boats ground on it</div></div>
      </div>
      <div id="det-line" style="display:none">
        <div class="sl-sect"><div class="sl-hint">a line on the water &middot; drag the end handles &middot; &#8997;-drag stretches</div></div>
      </div>
      <div id="lab-delrow" style="display:none;justify-content:flex-end;padding:12px 16px">
        <button id="lab-del" class="sl-btn-danger">DELETE</button>
      </div>`;
    col.append(left, right);
    document.body.appendChild(col);
    const ui = { querySelector: (s) => left.querySelector(s) || right.querySelector(s) || ump.querySelector(s),
                 querySelectorAll: (s) => [...left.querySelectorAll(s), ...right.querySelectorAll(s), ...ump.querySelectorAll(s)] };

    // the layer list — the object layers with “＋” adders (the Scenario row
    // is gone: its details are pinned at the top of the panel now).
    // An armed “＋” means the next click on open water places that kind.
    const LAYERS = [
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
    const KIND_DOT = { scenario: '#8fd8d0', boat: null, sand: '#e0c99b', mark: '#f0a02a', line: '#ffffff' };
    function renderLayers() {
        layersDiv.innerHTML = '';
        for (const [kind, label, items] of LAYERS) {
            const list = items ? items() : null;
            const head = document.createElement('div');
            head.className = 'sl-lrow';
            const dot = document.createElement('span');
            dot.className = 'sl-dot';
            dot.style.background = '#66748c';
            const name = document.createElement('span');
            name.textContent = label;
            name.style.cssText = 'flex:1;font-weight:800';
            head.append(dot, name);
            if (list) {
                const cnt = document.createElement('span');
                cnt.className = 'sl-count';
                cnt.textContent = list.length || '';
                head.appendChild(cnt);
                const add = document.createElement('span');
                add.className = 'sl-add' + (LAB.armed === kind ? ' on' : '');
                add.textContent = '+';
                add.title = 'add, then click the water';
                add.onclick = (e) => { e.stopPropagation(); setArmed(kind); };
                head.appendChild(add);
            }
            layersDiv.appendChild(head);
            if (list) for (const it of list) {
                const row = document.createElement('div');
                row.className = 'sl-lrow sl-lchild' + (LAB.sel && LAB.sel.ref === it.sel.ref ? ' on' : '');
                const d = document.createElement('span');
                d.className = 'sl-dot';
                d.style.background = kind === 'boat'
                    ? ((it.sel.ref.bot.colors && it.sel.ref.bot.colors.hull) || '#8fd0ff')
                    : KIND_DOT[kind];
                d.style.border = '1px solid rgba(255,255,255,.3)';   // dark hulls stay visible
                const nm = document.createElement('span');
                nm.textContent = it.label;
                nm.style.flex = '1';
                row.append(d, nm);
                row.onclick = () => select(it.sel);
                layersDiv.appendChild(row);
            }
        }
        // assertion rows carry boat pickers — rebuild them when the fleet changes
        if (typeof renderAsserts === 'function' && LAB.ready !== undefined) renderAsserts();
    }

    // ── playback bar ───────────────────────────────────────────────────
    // transport icons: inline SVGs on currentColor, one visual family — the
    // emoji glyphs (⏪/⏩) rendered as full-colour emoji next to a text ▶
    const SVG_PLAY = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2.8 1.4 L10.6 6 L2.8 10.6 Z"/></svg>';
    const SVG_PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2" y="1.6" width="3" height="8.8" rx="1"/><rect x="7" y="1.6" width="3" height="8.8" rx="1"/></svg>';
    const SVG_BACK = '<svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" aria-hidden="true"><path d="M7.4 1.6 L2.6 6 L7.4 10.4 Z"/><path d="M12.6 1.6 L7.8 6 L12.6 10.4 Z"/></svg>';
    const SVG_FWD = '<svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" aria-hidden="true"><path d="M1.4 1.6 L6.2 6 L1.4 10.4 Z"/><path d="M6.6 1.6 L11.4 6 L6.6 10.4 Z"/></svg>';
    const bar = document.createElement('div');
    bar.className = 'sl-panel';
    bar.style.cssText = 'top:auto;left:50%;transform:translateX(-50%);bottom:20px;display:flex;align-items:center;gap:14px;padding:12px 18px;width:min(620px,calc(100vw - 80px));overflow:visible';
    bar.innerHTML = `
      <div style="display:flex;gap:6px">
        <button id="pb-back" class="sl-tbtn" title="step back 0.5s">${SVG_BACK}</button>
        <button id="pb-play" class="sl-tbtn sl-tbtn-pri">${SVG_PLAY}</button>
        <button id="pb-fwd" class="sl-tbtn" title="step forward 0.5s">${SVG_FWD}</button>
      </div>
      <select id="pb-seed" class="sl-msel" style="display:none;max-width:118px;padding:6px 6px;font-variant-numeric:tabular-nums" title="which seed's run the transport shows"></select>
      <span style="flex:1;position:relative;display:block">
        <input id="pb-slider" type="range" min="0" max="600" value="0">
        <span id="pb-ticks" style="position:absolute;left:0;right:0;top:-11px;height:8px;pointer-events:none"></span>
      </span>
      <span id="pb-time" style="font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;color:#c4d2e6;min-width:84px;text-align:right">0.0 / 10.0s</span>`;
    document.body.appendChild(bar);
    // SIMULATING…: the burst blocks the main thread, so this goes up and
    // PAINTS before the batch starts (play() yields a frame first)
    const simCover = document.createElement('div');
    simCover.className = 'sl-panel';
    simCover.style.cssText = 'top:50%;left:50%;transform:translate(-50%,-50%);display:none;align-items:center;gap:10px;padding:14px 22px;z-index:96;overflow:visible';
    simCover.innerHTML = '<span style="font-size:13px;font-weight:900;font-style:italic;letter-spacing:.06em">SIMULATING</span>' +
        '<span id="sim-prog" style="font-size:11px;font-weight:800;color:#8fd8d0;font-variant-numeric:tabular-nums"></span>';
    document.body.appendChild(simCover);
    const pbSlider = bar.querySelector('#pb-slider');
    // the filled-track look: blue up to the playhead, glass beyond it
    function pbFill() {
        const pct = 100 * (+pbSlider.value) / Math.max(1, +pbSlider.max);
        pbSlider.style.background = `linear-gradient(to right,#2f6bff ${pct}%,rgba(255,255,255,.14) ${pct}%)`;
    }
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
    const w2s = (wx, wy) => [(wx - LAB.cam.x) * LAB.zoom + ov.width / 2, (wy - LAB.cam.y) * LAB.zoom + ov.height / 2];
    const s2w = (sx, sy) => [(sx - ov.width / 2) / LAB.zoom + LAB.cam.x, (sy - ov.height / 2) / LAB.zoom + LAB.cam.y];

    // ── ZOOM. The game camera is translate-only, so zoom is a RESOLUTION
    // trick: the world canvas renders at viewport/zoom logical pixels and CSS
    // stretches it to the viewport — zoomed OUT renders more world (crisp),
    // zoomed IN renders less (a little soft). frame() enforces the size each
    // frame, which also undoes the game's own window-resize handler. ───────
    const ZMIN = 0.25, ZMAX = 2.5;
    const zbar = document.createElement('div');
    zbar.className = 'sl-panel';
    zbar.style.cssText = 'top:auto;left:auto;right:20px;bottom:20px;display:flex;align-items:center;gap:6px;padding:8px 10px;overflow:visible';
    zbar.innerHTML = `
      <button id="zm-out" class="sl-tbtn" title="zoom out (&minus;)">&minus;</button>
      <button id="zm-pct" class="sl-tbtn" style="width:auto;padding:0 10px;font:800 11px Archivo,system-ui,sans-serif;letter-spacing:.04em;font-variant-numeric:tabular-nums" title="reset to 100% (0)">100%</button>
      <button id="zm-in" class="sl-tbtn" title="zoom in (+)">+</button>
      <button id="zm-fit" class="sl-tbtn" style="width:auto;padding:0 10px;font:800 11px Archivo,system-ui,sans-serif;letter-spacing:.08em" title="fit everything (F)">FIT</button>`;
    document.body.appendChild(zbar);
    function setZoom(z, sx, sy) {
        z = Math.max(ZMIN, Math.min(ZMAX, z));
        if (sx == null) { sx = ov.width / 2; sy = ov.height / 2; }
        const [wx, wy] = s2w(sx, sy);   // world point under the anchor…
        LAB.zoom = z;
        LAB.cam.x = wx - (sx - ov.width / 2) / z;   // …stays under it
        LAB.cam.y = wy - (sy - ov.height / 2) / z;
        zbar.querySelector('#zm-pct').textContent = Math.round(z * 100) + '%';
    }
    function zoomFit() {
        const xs = [], ys = [];
        const add = (x, y, r) => { xs.push(x - r, x + r); ys.push(y - r, y + r); };
        for (const lb of LAB.boats) {
            add(lb.x, lb.y, 90);
            for (const g of (lb.goals || [])) { const [gx, gy] = goalPoint(g); add(gx, gy, 40); }
        }
        for (const m of LAB.marks) add(m.x, m.y, (m.zone || 165) + 30);
        for (const s of LAB.sands) add(s.x, s.y, s.r + 30);
        for (const ln of LAB.lines) { add(ln.x1, ln.y1, 30); add(ln.x2, ln.y2, 30); }
        if (!xs.length) {   // empty scene: home to the stage at 100%
            if (LAB.stage) { LAB.cam.x = LAB.stage.x; LAB.cam.y = LAB.stage.y; }
            setZoom(1);
            return;
        }
        const x0 = Math.min(...xs), x1 = Math.max(...xs);
        const y0 = Math.min(...ys), y1 = Math.max(...ys);
        LAB.cam.x = (x0 + x1) / 2; LAB.cam.y = (y0 + y1) / 2;
        const z = Math.min(ov.width / Math.max(200, (x1 - x0) * 1.15),
                           ov.height / Math.max(200, (y1 - y0) * 1.15));
        setZoom(Math.min(1.5, z));   // fit frames the scene, never magnifies past 150%
    }
    zbar.querySelector('#zm-in').onclick = () => setZoom(LAB.zoom * 1.25);
    zbar.querySelector('#zm-out').onclick = () => setZoom(LAB.zoom / 1.25);
    zbar.querySelector('#zm-pct').onclick = () => setZoom(1);
    zbar.querySelector('#zm-fit').onclick = zoomFit;
    ov.addEventListener('wheel', e => {
        e.preventDefault();
        setZoom(LAB.zoom * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });

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
        // no wakes in the lab (owner ruling): pinned boats "sail in place"
        // during edit, so their trails just smear the stage — and in playback
        // the hull-colour track lines already tell the story better
        window.drawWakes = () => { };
        // disturbed air: not visualized, still COMPUTED (owner ruling) — the
        // wind-shadow physics (badAirIntensity, the AI's dirty-air escape)
        // lives elsewhere and keeps running. ⚠️ render-only on purpose:
        // updateTurbulence also keeps running because its seeded
        // Math.random draws are part of the pinned stream — silencing it
        // would shift every recorded verdict
        window.drawDisturbedAir = () => { };
        const b = st.course.boundary || { x: 0, y: 0 };
        LAB.cam.x = b.x; LAB.cam.y = b.y;
        LAB.stage = { x: b.x, y: b.y };
        LAB.markProto = (st.course.marks || [])[0] ? JSON.parse(JSON.stringify(st.course.marks[0])) : null;
        for (const m of (st.course.marks || [])) {
            m.x += 1e6; m.y += 1e6;
            // drawX/drawY: orientCourseMarks' sprite anchor — drawMarkBodies
            // prefers it over x/y, so an unshifted one leaves a ghost can
            // floating at the original line position (invisible on seatrials
            // only because its stage centre sat 2100u from the line)
            if (m.drawX != null) m.drawX += 1e6;
            if (m.drawY != null) m.drawY += 1e6;
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
            const lb = LAB.boats.find(l => l.bot === boat);
            if (!lb) return;
            ctx.save();
            ctx.translate(boat.x, boat.y);
            // counter-scale: the pill keeps its SCREEN size at any zoom
            ctx.scale(1 / LAB.zoom, 1 / LAB.zoom);
            ctx.translate(0, 36);
            ctx.font = '800 13px Archivo,system-ui';
            const w = ctx.measureText(boat.name).width + 16;
            ctx.fillStyle = 'rgba(15,23,42,0.6)';
            ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, 20, 6); ctx.fill();
            // WHITE name = scripted helm, GREEN name = the AI's — and a boat
            // that hands off mid-scenario changes colour at that frame
            ctx.fillStyle = lb._dispMode === 'S' ? '#ffffff' : '#7de28f';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(boat.name, 0, 10);
            ctx.restore();
        };
        select(null);
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
                select(null);
            }
        } catch (e) { LAB._loading = false; }
        restoreLibHandle();
        dismissCover();
    }

    // ── objects ────────────────────────────────────────────────────────
    function invalidate() {
        LAB.rec = null; LAB.recs = {}; LAB.playing = false; LAB.frame = 0;
        LAB.assertResults = null;
        if (typeof renderAsserts === 'function' && LAB.ready) evaluateAsserts();
        if (LAB.mode !== 'edit') LAB.mode = 'edit';
        // the transport stays put — it just rewinds and disarms
        pbPlay.innerHTML = SVG_PLAY;
        pbSlider.value = 0;
        pbTicks.innerHTML = '';
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
    // NEUTRAL BOATS, NOT CHARACTERS (owner ruling 2026-08-17): a scenario is a
    // statement about the ENGINE — who has rights and will they duck — and a
    // named character carries per-character stats and a controller persona
    // that would make the answer depend on who drew which slot. Boats are
    // A, B, C, … in his color order; every hull gets white sails and a solid
    // spinnaker in the hull color.
    const LAB_HULLS = [
        '#1e56d6',   // Blue (deep, so it reads against the water)
        '#d92e2e',   // Red
        '#1fa03c',   // Green
        '#f28218',   // Orange
        '#7d3bd4',   // Purple
        '#f2d024',   // Yellow
        '#f06ab4',   // Pink
        '#f4f6f8',   // White
        '#16181d',   // Black
        '#7a4a26',   // Brown
    ];
    function applyLabIdentity(lb, i) {
        const cfg = {
            name: String.fromCharCode(65 + i),
            hull: LAB_HULLS[i % LAB_HULLS.length],
            sail: '#ffffff',
            cockpit: '#c9cdd2',
            spinnaker: LAB_HULLS[i % LAB_HULLS.length],
            spinPattern: 'solid',
            // no `stats` key: applyBoatIdentity falls back to STAT_DEFAULTS
            // (+ the flat difficulty bonus, identical for every lab boat)
        };
        if (typeof applyBoatIdentity === 'function') applyBoatIdentity(lb.bot, cfg, false);
        else { lb.bot.name = cfg.name; lb.bot.colors = { hull: cfg.hull, sail: cfg.sail, cockpit: cfg.cockpit, spinnaker: cfg.spinnaker }; }
        // neutral PERSONA too. ⚠️ archetype + traits live on the BOAT (the
        // Boat constructor sets them from the dealt character config), not on
        // the controller — the first cut of this neutralization wrote to the
        // controller and every lab boat kept sailing its boot-dealt persona.
        lb.bot.archetype = null;
        if (typeof DEFAULT_TRAITS !== 'undefined') lb.bot.traits = Object.assign({}, DEFAULT_TRAITS);
    }
    function addBoat(wx, wy) {
        const bot = LAB.pool.shift();
        if (!bot) return;
        bot.raceState.finished = false; bot.raceState.ocs = false;
        bot.raceState.penalty = false; bot.raceState.totalPenalties = 0;
        // leg 2, deliberately: on the lab course leg 1 TARGETS WINDWARD, and the
        // rules engine's zone-latch leg filter skips non-windward marks for a
        // windward-bound pair — rule 18 would never arm at a lab mark. Leg 2
        // targets nothing, so zone snapshots latch on plain geometry.
        bot.raceState.isTacking = false; bot.raceState.leg = 2;
        bot.fadeTimer = 999; bot.opacity = 1;
        const lb = { bot, x: wx, y: wy, heading: Math.PI / 2, speedKt: 6, plan: [], aiAtS: null, goals: [] };
        LAB.boats.push(lb);
        applyLabIdentity(lb, LAB.boats.length - 1);
        // pristine-physics snapshot: every scalar on the boat (heel, sail
        // angles, trim, leeway, …). applyInitial restores these before each
        // burst — measured: a first-ever run diverged from every later run by
        // 1.4e-4u on frame ONE because eased sail physics survived the burst.
        // The recruit's own values are NOT canonical either (they reflect the
        // parked bot's analog state at recruit time, which varies per boot —
        // measured 1-in-6 fresh boots diverging), so scalars that exist on a
        // freshly CONSTRUCTED Boat are overlaid with those constructor
        // constants — identical on every boot, on every machine.
        lb._phys0 = {}; lb._rs0 = {};
        const scal = (o) => {
            const out = {};
            for (const k of Object.keys(o)) {
                const t = typeof o[k];
                if (t === 'number' || t === 'boolean' || o[k] === null) out[k] = o[k];
            }
            return out;
        };
        lb._phys0 = scal(bot); lb._rs0 = scal(bot.raceState);
        if (!LAB._canon && typeof Boat !== 'undefined') {
            try {
                const cb = new Boat(-1, false, 0, 0, 'canon', null);
                LAB._canon = { phys: scal(cb), rs: scal(cb.raceState) };
                delete LAB._canon.phys.id;
            } catch (e) { LAB._canon = null; }
        }
        if (LAB._canon) {
            Object.assign(lb._phys0, LAB._canon.phys);
            Object.assign(lb._rs0, LAB._canon.rs);
        }
        select({ kind: 'boat', ref: lb });
        invalidate();
        return lb;
    }
    function addMark(wx, wy) {
        const proto = LAB.markProto || {};
        const m = JSON.parse(JSON.stringify(proto));
        m.x = wx; m.y = wy;
        // the clone must not inherit the proto's sprite anchor or vessel
        // heading — with these gone the engine draws its can ON the mark
        delete m.drawX; delete m.drawY; delete m.heading;
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
    // deletion always confirms in-window (owner ruling) — deleteSel is the
    // confirming entry point (button + Delete key); deleteSelNow is the raw
    // remover that clearScene's sweep and the confirm itself go through
    function selDesc(s) {
        if (s.kind === 'boat') return 'boat ' + s.ref.bot.name;
        if (s.kind === 'mark') return 'mark ' + (LAB.marks.indexOf(s.ref) + 1);
        if (s.kind === 'sand') return 'object ' + (LAB.sands.indexOf(s.ref) + 1);
        return 'line ' + (LAB.lines.indexOf(s.ref) + 1);
    }
    function deleteSel() {
        const s = LAB.sel;
        if (!s || s.kind === 'play') return;
        confirmDialog('Delete ' + (s.kind === 'sand' ? 'object' : s.kind),
            `Delete ${selDesc(s)}?`, deleteSelNow, 'Delete');
    }
    function deleteSelNow() {
        const s = LAB.sel;
        if (!s) return;
        if (s.kind === 'boat') {
            const i = LAB.boats.indexOf(s.ref);
            if (i >= 0) LAB.boats.splice(i, 1);
            s.ref.bot.raceState.finished = true; s.ref.bot.fadeTimer = 0;
            s.ref.bot.x = -1e6; s.ref.bot.y = -1e6;
            // a pooled bot must carry no lab overrides into its next recruit
            const c = s.ref.bot.controller;
            if (c) {
                if (Object.prototype.hasOwnProperty.call(c, 'update')) delete c.update;
                if (Object.prototype.hasOwnProperty.call(c, 'getNavigationTarget')) delete c.getNavigationTarget;
            }
            LAB.pool.unshift(s.ref.bot);
            // keep the alphabet contiguous: later boats take over the freed identities
            LAB.boats.forEach((lb, k) => applyLabIdentity(lb, k));
            // assertions address boats by index: drop rows that named the
            // deleted boat, slide the rest down (who === -1 "nobody" is safe:
            // this only runs for a found index, i >= 0)
            if (i >= 0) {
                const BK = { penalty: ['who'], row: ['of', 'over'], clear: ['a', 'b'], tack: ['who'], goals: ['who'] };
                LAB.asserts = LAB.asserts.filter(a => !(BK[a.kind] || []).some(kf => a[kf] === i));
                for (const a of LAB.asserts) for (const kf of (BK[a.kind] || [])) if (a[kf] > i) a[kf]--;
            }
        } else if (s.kind === 'mark') {
            const ms = window.state.course.marks;
            const i = ms.indexOf(s.ref); if (i >= 0) ms.splice(i, 1);
            const j = LAB.marks.indexOf(s.ref); if (j >= 0) LAB.marks.splice(j, 1);
            for (const lb of LAB.boats) lb.goals = lb.goals.filter(g => g.ref !== s.ref);
        } else if (s.kind === 'sand') {
            const is = window.state.course.islands;
            const i = is.indexOf(s.ref.isl); if (i >= 0) is.splice(i, 1);
            const j = LAB.sands.indexOf(s.ref); if (j >= 0) LAB.sands.splice(j, 1);
        } else if (s.kind === 'line') {
            const i = LAB.lines.indexOf(s.ref); if (i >= 0) LAB.lines.splice(i, 1);
            for (const lb of LAB.boats) lb.goals = lb.goals.filter(g => g.ref !== s.ref);
        }
        select(null);
        invalidate();
    }
    // raw sweep — no per-object confirms; callers that need one (the CLEAR
    // SCENE control) confirm once up front, and New/Open go through their own
    // unsaved-changes gate instead
    function clearScene() {
        while (LAB.boats.length) { select({ kind: 'boat', ref: LAB.boats[0] }); deleteSelNow(); }
        while (LAB.marks.length) { select({ kind: 'mark', ref: LAB.marks[0] }); deleteSelNow(); }
        while (LAB.sands.length) { select({ kind: 'sand', ref: LAB.sands[0] }); deleteSelNow(); }
        while (LAB.lines.length) { select({ kind: 'line', ref: LAB.lines[0], part: 0 }); deleteSelNow(); }
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
    const detSections = { boat: '#det-boat', mark: '#det-mark', sand: '#det-sand', line: '#det-line' };
    function select(s) {
        // no selection ('play' kind): the details panel hides — the umpire
        // panel on the right is always on and covers the "nothing selected"
        // reading. Selecting an object opens its inspector below the lab bar.
        if (!s) s = { kind: 'play' };
        LAB.sel = s;
        right.style.display = s.kind === 'play' ? 'none' : 'block';
        for (const k of Object.keys(detSections)) {
            right.querySelector(detSections[k]).style.display = k === s.kind ? 'block' : 'none';
        }
        const delRow = right.querySelector('#lab-delrow');
        const showDel = s.kind !== 'play';
        delRow.style.display = showDel ? 'flex' : 'none';
        if (showDel) right.querySelector('#lab-del').textContent = 'DELETE ' + (s.kind === 'sand' ? 'OBJECT' : s.kind.toUpperCase());
        // the inspector header: dot + title + kind chip
        const selDot = right.querySelector('#lab-seldot');
        const kindChip = right.querySelector('#lab-kindchip');
        const header = { dot: null, title: '', chip: '' };
        if (s.kind === 'boat') {
            header.title = s.ref.bot.name.toUpperCase(); header.chip = 'BOAT';
            header.dot = (s.ref.bot.colors && s.ref.bot.colors.hull) || '#8fd0ff';
        }
        else if (s.kind === 'mark') { header.title = 'MARK ' + (LAB.marks.indexOf(s.ref) + 1); header.chip = 'MARK'; header.dot = KIND_DOT.mark; }
        else if (s.kind === 'sand') { header.title = 'SAND ' + (LAB.sands.indexOf(s.ref) + 1); header.chip = 'OBJECT'; header.dot = KIND_DOT.sand; }
        else if (s.kind === 'line') { header.title = 'LINE ' + (LAB.lines.indexOf(s.ref) + 1); header.chip = 'LINE'; header.dot = KIND_DOT.line; }
        selName.textContent = header.title;
        selDot.style.display = header.dot ? 'inline-block' : 'none';
        if (header.dot) { selDot.style.background = header.dot; selDot.style.border = '1px solid rgba(255,255,255,.3)'; }
        kindChip.style.display = header.chip ? 'inline-block' : 'none';
        kindChip.textContent = header.chip;
        setGoalArm(false);   // goal placement never survives a selection change
        if (s.kind === 'boat') {
            hdgIn.value = Math.round(((s.ref.heading * DEG) % 360 + 360) % 360);
            spdIn.value = s.ref.speedKt;
            refreshPathRow(s.ref);
            renderPlan(s.ref);
            renderGoals(s.ref);
        }
        if (s.kind === 'mark') refreshSideBtns(s.ref);
        renderLayers();
    }
    const sidePortB = ui.querySelector('#lab-side-port');
    const sideStbdB = ui.querySelector('#lab-side-stbd');
    function refreshSideBtns(m) {
        sidePortB.classList.toggle('sl-btn-pri', m.side === 'port');
        sideStbdB.classList.toggle('sl-btn-pri', m.side === 'starboard');
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
    // speed follows the polar for wherever she points). The spinnaker is
    // NEVER scripted (owner ruling 2026-08-17): the engine's own AWA rule
    // hoists and douses it for scripted boats exactly as it does for AI,
    // with the 5-second crossfade playing out on every change.
    // (the plan is the only scripting mode — the freehand drawn path retired
    // in its favour) ─────────────────────────────────────────────────────
    const planDiv = ui.querySelector('#lab-plan');
    function renderPlan(lb) {
        planDiv.innerHTML = '';
        const plan = lb.plan || (lb.plan = []);
        plan.sort((a, b) => a.t - b.t);
        plan.forEach((en, k) => {
            const row = document.createElement('div');
            row.className = 'sl-step';
            const nB = document.createElement('span');
            nB.className = 'sl-stepn';
            nB.textContent = k + 1;
            const tIn = document.createElement('input');
            tIn.type = 'text'; tIn.inputMode = 'decimal'; tIn.value = en.t;
            tIn.className = 'sl-bare'; tIn.style.width = '30px';
            tIn.title = 'time (s)';
            tIn.addEventListener('change', () => { en.t = Math.max(0, parseFloat(tIn.value) || 0); renderPlan(lb); invalidate(); });
            const sLab = document.createElement('span'); sLab.className = 'sl-hint'; sLab.textContent = 's';
            const dotSep = document.createElement('span');
            dotSep.textContent = '·'; dotSep.style.cssText = 'color:#4a5a72;font-size:10px';
            const hIn = document.createElement('input');
            hIn.type = 'text'; hIn.inputMode = 'decimal'; hIn.value = en.headingDeg;
            hIn.className = 'sl-bare'; hIn.style.width = '30px';
            hIn.title = 'new heading (°)';
            hIn.addEventListener('change', () => { en.headingDeg = parseFloat(hIn.value) || 0; invalidate(); });
            const dLab = document.createElement('span'); dLab.className = 'sl-hint'; dLab.innerHTML = '&deg;';
            const del = document.createElement('span');
            del.innerHTML = '&#10005;';
            del.style.cssText = 'cursor:pointer;color:#66748c;font-size:11px;padding:0 2px;margin-left:auto';
            del.onmouseenter = () => del.style.color = '#ff8a75';
            del.onmouseleave = () => del.style.color = '#66748c';
            del.onclick = () => { plan.splice(plan.indexOf(en), 1); renderPlan(lb); invalidate(); };
            row.append(nB, tIn, sLab, dotSep, hIn, dLab, del);
            planDiv.appendChild(row);
        });
        if (!plan.length) {
            const p = document.createElement('div');
            p.className = 'sl-hint';
            p.textContent = 'initial heading + speed, then steps';
            planDiv.appendChild(p);
        }
    }
    ui.querySelector('#lab-planadd').onclick = () => {
        if (!LAB.sel || LAB.sel.kind !== 'boat') return;
        const lb = LAB.sel.ref;
        const last = lb.plan.length ? lb.plan[lb.plan.length - 1] : null;
        lb.plan.push({ t: last ? last.t + 5 : 5, headingDeg: Math.round(lb.heading * DEG) });
        renderPlan(lb);
        invalidate();
    };

    // ── GOALS: the AI's intentions, sailed in order. Three kinds — a point
    // (pass within ~2 boat lengths, cookie-crumb style), a mark (round it on
    // its set side, completion by the winding sweep), a line-as-gate (cross
    // the segment, either direction). Only the DESTINATION comes from here:
    // strategy, tacking, avoidance, rules and the umpire are the shipping
    // AI's own. After the last goal the boat holds her final bearing. ─────
    const goalsDiv = ui.querySelector('#lab-goals');
    const goalAddLink = ui.querySelector('#lab-goaladd');
    function goalPoint(g) {
        if (g.type === 'point') return [g.x, g.y];
        if (g.type === 'mark') return [g.ref.x, g.ref.y];
        return [(g.ref.x1 + g.ref.x2) / 2, (g.ref.y1 + g.ref.y2) / 2];
    }
    function goalLabel(g) {
        if (g.type === 'mark') return 'Mark ' + (LAB.marks.indexOf(g.ref) + 1) + ' · ' + (g.ref.side === 'starboard' ? 'stbd' : 'port');
        if (g.type === 'gate') return 'Line ' + (LAB.lines.indexOf(g.ref) + 1) + ' · through';
        const S = LAB.stage || { x: 0, y: 0 };
        return 'waypoint ' + Math.round(g.x - S.x) + ', ' + Math.round(g.y - S.y);
    }
    function setGoalArm(on) {
        LAB.goalArm = on;
        goalAddLink.textContent = on ? 'CLICK THE WATER · ESC ENDS' : '+ ADD GOAL';
        goalAddLink.style.color = on ? '#8fd8d0' : '';
    }
    function renderGoals(lb) {
        goalsDiv.innerHTML = '';
        const goals = lb.goals || (lb.goals = []);
        goals.forEach((g, k) => {
            const row = document.createElement('div');
            row.className = 'sl-step';
            const nB = document.createElement('span');
            nB.className = 'sl-stepn';
            nB.textContent = k + 1;
            const lab = document.createElement('span');
            lab.textContent = goalLabel(g);
            lab.style.cssText = 'flex:1;font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            const del = document.createElement('span');
            del.innerHTML = '&#10005;';
            del.style.cssText = 'cursor:pointer;color:#66748c;font-size:11px;padding:0 2px';
            del.onmouseenter = () => del.style.color = '#ff8a75';
            del.onmouseleave = () => del.style.color = '#66748c';
            del.onclick = () => { goals.splice(k, 1); renderGoals(lb); invalidate(); };
            row.append(nB, lab, del);
            goalsDiv.appendChild(row);
        });
        if (!goals.length) {
            const p = document.createElement('div');
            p.className = 'sl-hint';
            p.textContent = 'the AI sails these in order · click water, a mark, or a line';
            goalsDiv.appendChild(p);
        }
    }
    goalAddLink.onclick = () => {
        if (!LAB.sel || LAB.sel.kind !== 'boat') return;
        setGoalArm(!LAB.goalArm);
    };

    // ── ASSERTIONS: the scenario as a TEST. Structured rows saved with the
    // doc; ScenarioAsserts (shared with eval/run_scenario.js) judges them
    // against the recording after every run. Editing an assertion never
    // invalidates the recording — expectations don't change the sailing.
    const assertsDiv = ui.querySelector('#lab-asserts');
    const aggChip = ui.querySelector('#lab-agg');
    function boatNames() { return LAB.boats.map(lb => lb.bot.name); }
    function assertsChanged() {
        saveDraft();
        evaluateAsserts();
    }
    // assertions are judged across the WHOLE seed set: a row is green only
    // if it holds on every seed. Incomplete cache (a seed not yet run) =
    // not judged; play fills it.
    function evaluateAsserts() {
        const seeds = LAB.seeds.map(s => s >>> 0);
        const complete = seeds.length && seeds.every(s => LAB.recs[s]);
        if (!complete || !window.ScenarioAsserts || !LAB.asserts.length) {
            LAB.assertResults = null;
            renderAsserts();
            aggChip.style.display = 'none';
            return;
        }
        const per = seeds.map(s => window.ScenarioAsserts.evaluate(LAB.asserts, LAB.recs[s]));
        LAB.assertResults = LAB.asserts.map((a, k) => {
            let ok = 0, fail = null;
            seeds.forEach((s, si) => {
                const r = per[si][k];
                if (r.status === 'pass' || r.status === 'gap') ok++;
                else if (!fail) fail = { seed: s, ix: si, why: r.why, atS: r.atS };
            });
            return { n: seeds.length, ok, fail, single: per[0][k] };
        });
        renderAsserts();
        const rs = LAB.assertResults;
        const okRows = rs.filter(r => r.ok === r.n).length;
        aggChip.textContent = 'ASSERTS ' + okRows + '/' + rs.length + (seeds.length > 1 ? ' · ' + seeds.length + ' SEEDS' : '');
        aggChip.className = 'sl-schip ' + (okRows === rs.length ? 'sl-schip-teal' : 'sl-schip-red');
        aggChip.style.display = 'inline-block';
    }
    function boatSel(val, onPick, allowNobody) {
        const s = document.createElement('select');
        s.className = 'sl-msel';
        if (allowNobody) { const o = document.createElement('option'); o.value = '-1'; o.textContent = 'NOBODY'; s.appendChild(o); }
        LAB.boats.forEach((lb, i) => {
            const o = document.createElement('option'); o.value = String(i); o.textContent = lb.bot.name; s.appendChild(o);
        });
        s.value = String(val);
        s.addEventListener('change', () => { onPick(parseInt(s.value, 10)); assertsChanged(); });
        return s;
    }
    function bareIn(val, w, title, onSet) {
        const i = document.createElement('input');
        i.type = 'text'; i.inputMode = 'decimal'; i.className = 'sl-bare';
        i.style.width = w + 'px'; i.title = title; i.value = val;
        i.addEventListener('change', () => { onSet(i.value.trim()); assertsChanged(); });
        return i;
    }
    const hintSpan = (txt) => { const s = document.createElement('span'); s.className = 'sl-hint'; s.textContent = txt; return s; };
    function renderAsserts() {
        assertsDiv.innerHTML = '';
        LAB.asserts.forEach((a, k) => {
            const row = document.createElement('div');
            row.className = 'sl-step';
            row.style.flexWrap = 'wrap';
            const nB = document.createElement('span');
            nB.className = 'sl-stepn'; nB.textContent = k + 1;
            row.appendChild(nB);
            if (a.kind === 'penalty') {
                row.appendChild(boatSel(a.who, v => a.who = v, true));
                row.appendChild(hintSpan(a.who === -1 ? 'penalized' : 'penalized · rule'));
                if (a.who !== -1) row.appendChild(bareIn(a.rule || '', 26, 'rule number (blank = any)', v => a.rule = v || undefined));
            } else if (a.kind === 'row') {
                row.appendChild(bareIn(a.t, 26, 'time (s)', v => a.t = Math.max(0, parseFloat(v) || 0)));
                row.appendChild(hintSpan('s'));
                row.appendChild(boatSel(a.of, v => a.of = v));
                row.appendChild(hintSpan('rights over'));
                row.appendChild(boatSel(a.over, v => a.over = v));
                row.appendChild(bareIn(a.rule || '', 26, 'rule number (blank = any)', v => a.rule = v || undefined));
            } else if (a.kind === 'clear') {
                row.appendChild(boatSel(a.a, v => a.a = v));
                row.appendChild(boatSel(a.b, v => a.b = v));
                row.appendChild(hintSpan('clear ≥'));
                row.appendChild(bareIn(a.min != null ? a.min : 55, 30, 'minimum distance (u)', v => a.min = Math.max(0, parseFloat(v) || 55)));
                row.appendChild(hintSpan('u'));
            } else if (a.kind === 'tack') {
                row.appendChild(bareIn(a.t, 26, 'time (s)', v => a.t = Math.max(0, parseFloat(v) || 0)));
                row.appendChild(hintSpan('s'));
                row.appendChild(boatSel(a.who, v => a.who = v));
                const tSel = document.createElement('select');
                tSel.className = 'sl-msel';
                for (const v of ['port', 'stbd']) { const o = document.createElement('option'); o.value = v; o.textContent = v.toUpperCase(); tSel.appendChild(o); }
                tSel.value = a.tack || 'stbd';
                tSel.addEventListener('change', () => { a.tack = tSel.value; assertsChanged(); });
                row.appendChild(tSel);
            } else if (a.kind === 'goals') {
                row.appendChild(boatSel(a.who, v => a.who = v));
                row.appendChild(hintSpan('completes goals'));
            }
            // status chip: judged across the whole seed set. One seed shows
            // the plain verdict; several show k/N. Clicking a failure
            // switches the transport to the failing seed and scrubs there.
            const res = LAB.assertResults && LAB.assertResults[k];
            const chip = document.createElement('span');
            chip.style.marginLeft = 'auto';
            if (res && res.n === 1) {
                const st = res.single.status;
                const cls = { pass: 'sl-schip-teal', fail: 'sl-schip-red', gap: 'sl-schip-amber', fixed: 'sl-schip-blue' }[st];
                chip.className = 'sl-schip ' + cls;
                chip.textContent = st.toUpperCase();
                chip.title = res.single.why + (st === 'gap' ? ' (expected — documented gap)'
                    : st === 'fixed' ? ' (expected to fail but PASSED — the gap closed?)' : '');
                if (res.single.atS != null) {
                    chip.style.cursor = 'pointer';
                    chip.title += ' · click to scrub there';
                    chip.onclick = () => { pause(); setFrame(Math.round(res.single.atS * 60)); };
                }
            } else if (res) {
                chip.className = 'sl-schip ' + (res.ok === res.n ? 'sl-schip-teal' : 'sl-schip-red');
                chip.textContent = res.ok + '/' + res.n;
                chip.title = res.ok === res.n ? 'held on every seed'
                    : `fails on seed ${res.fail.seed} — ${res.fail.why || ''} (click to watch that run)`;
                if (res.fail) {
                    chip.style.cursor = 'pointer';
                    chip.onclick = () => {
                        setActiveSeed(res.fail.ix);
                        if (res.fail.atS != null) { pause(); LAB.mode = 'play'; setFrame(Math.round(res.fail.atS * 60)); }
                    };
                }
            } else {
                chip.className = 'sl-schip sl-schip-mute';
                chip.textContent = '·';
                chip.title = 'run the scenario to judge (every seed in the set)';
            }
            row.appendChild(chip);
            // XF: expected-to-fail (the battery's knownGap in lab clothes)
            const xf = document.createElement('span');
            xf.className = 'sl-schip ' + (a.xfail ? 'sl-schip-amber' : 'sl-schip-mute');
            xf.textContent = 'XF';
            xf.style.cursor = 'pointer';
            xf.title = 'expected to fail — a documented engine gap (amber = on)';
            xf.onclick = () => { a.xfail = !a.xfail || undefined; assertsChanged(); };
            row.appendChild(xf);
            const del = document.createElement('span');
            del.innerHTML = '&#10005;';
            del.style.cssText = 'cursor:pointer;color:#66748c;font-size:11px;padding:0 2px';
            del.onmouseenter = () => del.style.color = '#ff8a75';
            del.onmouseleave = () => del.style.color = '#66748c';
            del.onclick = () => { LAB.asserts.splice(k, 1); assertsChanged(); };
            row.appendChild(del);
            assertsDiv.appendChild(row);
        });
        if (!LAB.asserts.length) {
            const p = document.createElement('div');
            p.className = 'sl-hint';
            p.textContent = 'expectations judged after every run · + ADD';
            assertsDiv.appendChild(p);
        }
    }
    ui.querySelector('#lab-assertadd').onclick = () => {
        if (!LAB.boats.length) return;
        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex-direction:column;gap:6px';
        const KINDS = [
            ['penalty', 'PENALTY', 'a boat is (or nobody is) penalized, optionally under a rule'],
            ['row', 'RIGHTS', 'at a time, one boat holds right of way over another'],
            ['clear', 'NEVER TOUCH', 'two boats stay at least a distance apart, the whole run'],
            ['tack', 'TACK', 'at a time, a boat is on port or starboard'],
            ['goals', 'GOALS DONE', 'a boat completes its goal list by the end'],
        ];
        let dlg;
        for (const [kind, lbl, desc] of KINDS) {
            const b = document.createElement('button');
            b.className = 'sl-btn';
            b.style.cssText = 'flex:none;padding:9px 12px;text-align:left';
            b.innerHTML = `${lbl} <span class="sl-hint" style="letter-spacing:0;font-weight:700"> — ${desc}</span>`;
            b.onclick = () => {
                dlg.close();
                const second = LAB.boats.length > 1 ? 1 : 0;
                const def = {
                    penalty: { kind: 'penalty', who: 0 },
                    row: { kind: 'row', of: 0, over: second, t: Math.round(LAB.durationS / 2) },
                    clear: { kind: 'clear', a: 0, b: second, min: 55 },
                    tack: { kind: 'tack', who: 0, tack: 'stbd', t: Math.round(LAB.durationS / 2) },
                    goals: { kind: 'goals', who: 0 },
                }[kind];
                LAB.asserts.push(def);
                assertsChanged();
            };
            body.appendChild(b);
        }
        dlg = dialog('Add assertion', body, [{ label: 'Cancel' }]);
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
    // ── the SEED SET: pills in the panel (manage + switch), a dropdown on
    // the transport (switch mid-playback), one add control (typed seed, or
    // the dice roll one when blank). Deleting keeps at least one. ────────
    const seedAddIn = ui.querySelector('#lab-seedadd');
    const seedPills = ui.querySelector('#lab-seedpills');
    const pbSeedSel = bar.querySelector('#pb-seed');
    function activeSeed() { return LAB.seeds[Math.min(LAB.seedIx, LAB.seeds.length - 1)] >>> 0; }
    function renderSeeds() {
        seedPills.innerHTML = '';
        LAB.seeds.forEach((s, i) => {
            const pill = document.createElement('span');
            pill.className = 'sl-schip ' + (i === LAB.seedIx ? 'sl-schip-blue' : 'sl-schip-mute');
            pill.style.cssText = 'cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums';
            pill.title = i === LAB.seedIx ? 'the transport shows this seed' : 'switch the transport to this seed';
            const num = document.createElement('span');
            num.textContent = s >>> 0;
            const x = document.createElement('span');
            x.innerHTML = '&#10005;';
            x.style.cssText = 'font-size:9px;color:#66748c;cursor:pointer';
            x.title = 'remove this seed from the set';
            x.onclick = (e) => {
                e.stopPropagation();
                if (LAB.seeds.length <= 1) return;   // a scenario is at least one seed
                LAB.seeds.splice(i, 1);
                delete LAB.recs[s >>> 0];
                if (LAB.seedIx >= LAB.seeds.length) LAB.seedIx = LAB.seeds.length - 1;
                seedsChanged();
            };
            pill.append(num, x);
            pill.onclick = () => setActiveSeed(i);
            seedPills.appendChild(pill);
        });
        // the transport dropdown mirrors the set; hidden for a single seed
        pbSeedSel.innerHTML = '';
        LAB.seeds.forEach((s, i) => {
            const o = document.createElement('option');
            o.value = String(i); o.textContent = s >>> 0;
            pbSeedSel.appendChild(o);
        });
        pbSeedSel.value = String(LAB.seedIx);
        pbSeedSel.style.display = LAB.seeds.length > 1 ? 'inline-block' : 'none';
    }
    // switching seeds swaps CACHED recordings — no resim; the playhead time
    // carries across so the same moment can be compared between seeds
    function setActiveSeed(i) {
        LAB.seedIx = Math.max(0, Math.min(LAB.seeds.length - 1, i));
        const rec = LAB.recs[activeSeed()];
        if (rec) {
            LAB.rec = rec;
            pbSlider.max = rec.nF;
            LAB.frame = Math.min(LAB.frame, rec.nF);
            pbTicks.innerHTML = rec.ticks.map(f =>
                `<span style="position:absolute;left:${(100 * f / rec.nF).toFixed(1)}%;top:0;transform:translateX(-50%);color:#ff8a75;font-size:8px" title="penalty">&#9660;</span>`).join('');
        }
        renderSeeds();
    }
    pbSeedSel.addEventListener('change', () => setActiveSeed(parseInt(pbSeedSel.value, 10)));
    // seed edits change the DOC (dirty + draft) and drop only what they must:
    // removed seeds lose their cache; survivors keep theirs
    function seedsChanged() {
        LAB.assertResults = null;
        setActiveSeed(LAB.seedIx);
        saveDraft();
        if (Object.keys(LAB.recs).length) evaluateAsserts();
        else { LAB.rec = null; evaluateAsserts(); }
    }
    ui.querySelector('#lab-seed-rnd').onclick = () => {
        const typed = parseInt(seedAddIn.value.trim(), 10);
        const s = (Number.isFinite(typed) ? typed : Math.random() * 4294967296) >>> 0;
        seedAddIn.value = '';
        if (LAB.seeds.some(x => (x >>> 0) === s)) return;   // a set, not a list
        LAB.seeds.push(s);
        LAB.seedIx = LAB.seeds.length - 1;
        seedsChanged();
    };
    seedAddIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') ui.querySelector('#lab-seed-rnd').onclick(); });
    renderSeeds();

    // ── initial conditions / simulate / playback ───────────────────────
    function applyInitial() {
        for (const lb of LAB.boats) {
            const bt = lb.bot;
            // pristine scalars first (see the snapshot note in addBoat);
            // the explicit initial conditions below override on top
            if (lb._phys0) for (const k of Object.keys(lb._phys0)) bt[k] = lb._phys0[k];
            if (lb._rs0) for (const k of Object.keys(lb._rs0)) bt.raceState[k] = lb._rs0[k];
            bt.x = lb.x; bt.y = lb.y; bt.heading = lb.heading;
            bt.speed = lb.speedKt / 4;   // boat.speed*4 = knots
            bt.velocity = { x: Math.sin(bt.heading) * bt.speed, y: -Math.cos(bt.heading) * bt.speed };
            bt.raceState.isTacking = false; bt.raceState.ocs = false;
            bt.raceState.penalty = false; bt.raceState.totalPenalties = 0;
            bt.raceState.penaltyTurnsOwed = 0;
            // kite starts stowed — a pool recruit otherwise carries whatever
            // hoist state its parked racing life left behind
            bt.spinnaker = false; bt.spinnakerDeployProgress = 0;
            // boom settled for the starting tack (the engine's own sail rule:
            // relWind > 0 → boom to starboard) — physical state must be
            // identical every run or getTack's by-the-lee case can differ
            const relW = (() => { let a = -bt.heading; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; })();
            bt.targetBoomSide = Math.abs(relW) > 0.1 ? (relW > 0 ? 1 : -1) : 1;
            bt.boomSide = bt.targetBoomSide;
            // no rules residue from a previous run
            delete bt._r19Since;
            bt.raceState.roundArmed = false; bt.raceState.roundSweep = 0;
            // turbulence spawns draw Math.random per frame in update() — an
            // edit-time population would consume the burst's seeded stream
            // differently run to run (see the gusts note below)
            bt.turbulence = []; bt.turbulenceTimer = 0;
            const c = bt.controller;
            if (c) { c.lowSpeedTimer = 0; c.wiggleActive = false; c.escActive = false; c.iceEscapeTimer = 0; }
        }
        // every simulation runs over the same clock window (determinism, and
        // the burst can never reach the venue's time limit)
        window.state.race.timer = 100;
        window.state.race.status = 'racing';
        // state.time too: the rules ledger anchors windows to it (a fresh
        // pair's rowChangeTime starts at 0, so `now - 0` compares the ABSOLUTE
        // session clock against the rule-15 window) — unpinned, the verdict
        // depended on how soon after boot you pressed play
        window.state.time = 100;
        // the gust field spawns cells with Math.random INSIDE update(): a
        // pre-burst population (grown during edit time with the real RNG)
        // would consume the seeded stream differently every run, shifting
        // every downstream AI tie-break — measured as a knife-edge contact
        // flipping once in ~15 otherwise identical runs. Cleared, the cells
        // respawn deterministically from the seeded stream.
        window.state.gusts = [];
        // Sayings chatter draws Math.random too (a random boat quote fires
        // after 10 quiet seconds, and quote picks roll for length): its
        // module timers/queue persist across runs, so whether a draw lands
        // inside the burst depended on carried-in state — one stream shift =
        // one tail-frame divergence (caught by the runner's tripwire)
        if (typeof Sayings !== 'undefined') {
            Sayings.queue = []; Sayings.current = null;
            Sayings.timer = 0; Sayings.silenceTimer = 0;
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
                    // the RULES definition of tack (boom-aware by the lee),
                    // recorded live in the burst — playback can't re-derive it
                    // because boomSide animates off live physics, not the pin
                    ta: (window.Rules && window.Rules.getTack) ? window.Rules.getTack(bt) : 0,
                    tk: bt.raceState.isTacking, pen: bt.raceState.penalty,
                    sp: !!bt.spinnaker, spp: +(bt.spinnakerDeployProgress || 0).toFixed(3),
                    penN: bt.raceState.totalPenalties || 0,
                    gi: lb._goalIdx || 0,
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
    // the polar for the point of sail she passes through. The kite is not
    // the plan's to give: updateAI's AWA rule (which runs every frame for
    // every boat, scripted or not) hoists and douses it automatically.
    function planUpdate(lb) {
        return function () {
            let hdg = lb.heading;
            for (const en of lb.plan) {
                if (LAB.simT >= en.t) hdg = (en.headingDeg || 0) / DEG;
                else break;
            }
            this.targetHeading = hdg;
            this.speedLimit = 1.0;
        };
    }
    // ── THE GOAL NAVIGATOR. Replaces only the DESTINATION layer of the AI
    // (which for standard courses is just "aim near the gate end / centre /
    // nearest segment point"); getStrategicHeading still turns the target
    // into a sailable heading, applyAvoidance still deflects, the rules and
    // umpire still judge. The native single-mark rounding orbit is welded to
    // the islandRound course type + global DMC paths, so the mark goal reuses
    // its DESTINATION MATH (the armed-orbit carrot: bearing + sgn·0.85 at
    // 0.85×zone, the engine's own constants) rather than the machinery.
    function goalNav(lb) {
        const normA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
        return function () {
            const boat = lb.bot;
            const goals = lb.goals || [];
            let g = goals[lb._goalIdx];
            // completion tests advance the queue — only while the burst
            // records, so playback scrubbing can never corrupt the sequence
            while (g && LAB.recording) {
                let done = false;
                if (g.type === 'point') {
                    done = Math.hypot(boat.x - g.x, boat.y - g.y) < 110;   // ~2 hulls: pass through, never park
                } else if (g.type === 'gate') {
                    // crossed the segment (either direction) = through the gate
                    const ln = g.ref;
                    const dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1;
                    const L2 = dx * dx + dy * dy || 1;
                    const t = ((boat.x - ln.x1) * dx + (boat.y - ln.y1) * dy) / L2;
                    const side = Math.sign((boat.x - ln.x1) * dy - (boat.y - ln.y1) * dx) || 1;
                    if (lb._gSide != null && side !== lb._gSide && t > -0.05 && t < 1.05) done = true;
                    lb._gSide = side;
                } else if (g.type === 'mark') {
                    // rounded = the winding sweep from zone entry reaches the
                    // turn the next goal requires (the course-string rule in
                    // miniature; half a turn when there is no next goal)
                    const m = g.ref, Z = m.zone || 165;
                    const sgn = m.side === 'port' ? -1 : 1;   // the engine's own sign
                    const d = Math.hypot(boat.x - m.x, boat.y - m.y);
                    const brg = Math.atan2(boat.y - m.y, boat.x - m.x);
                    if (d < Z * 3) {
                        if (lb._sweep == null) {
                            lb._sweep = 0; lb._prevBrg = brg;
                            const nxt = goals[lb._goalIdx + 1];
                            let need = Math.PI;
                            if (nxt) {
                                const [ex, ey] = goalPoint(nxt);
                                need = sgn * normA(Math.atan2(ey - m.y, ex - m.x) - brg);
                                if (need <= 0) need += Math.PI * 2;
                            }
                            lb._need = Math.max(Math.PI / 3, Math.min(Math.PI * 1.9, need));
                        } else {
                            lb._sweep += sgn * normA(brg - lb._prevBrg);
                            lb._prevBrg = brg;
                            if (lb._sweep >= lb._need) done = true;
                        }
                    } else if (lb._sweep != null) {
                        lb._prevBrg = brg;                    // no credit while outside
                        if (d > Z * 3.5) lb._sweep = null;    // blown out: restart
                    }
                }
                if (!done) break;
                lb._goalIdx++;
                lb._sweep = null; lb._gSide = null;
                g = goals[lb._goalIdx];
            }
            if (!g) {
                // past the last goal: hold the bearing she finished on
                if (!lb._goalOut) lb._goalOut = {
                    x: boat.x + Math.sin(boat.heading) * 8000,
                    y: boat.y - Math.cos(boat.heading) * 8000,
                };
                return lb._goalOut;
            }
            if (g.type === 'point') return { x: g.x, y: g.y };
            if (g.type === 'gate') {
                // the finish-line policy: nearest point on the segment
                // (clamped 0.08–0.92, verbatim), nudged 90u past the line so
                // momentum completes the crossing
                const ln = g.ref;
                const dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1;
                const L2 = dx * dx + dy * dy || 1;
                let t = ((boat.x - ln.x1) * dx + (boat.y - ln.y1) * dy) / L2;
                t = Math.max(0.08, Math.min(0.92, t));
                const px = ln.x1 + dx * t, py = ln.y1 + dy * t;
                const L = Math.sqrt(L2);
                const side = Math.sign((boat.x - ln.x1) * dy - (boat.y - ln.y1) * dx) || 1;
                return { x: px - (dy / L) * side * 90, y: py + (dx / L) * side * 90 };
            }
            // mark: the armed-orbit carrot — lead the bearing the required way
            // round; the radius formula closes from any distance to the ring
            const m = g.ref, Z = m.zone || 165;
            const sgn = m.side === 'port' ? -1 : 1;
            const d = Math.hypot(boat.x - m.x, boat.y - m.y);
            const brg = Math.atan2(boat.y - m.y, boat.x - m.x);
            const a = brg + sgn * 0.85;
            const R = Math.min(Z * 1.6, Math.max(Z * 0.85, d - 80));
            return { x: m.x + Math.cos(a) * R, y: m.y + Math.sin(a) * R };
        };
    }
    function aiNavFor(lb, heading) {
        const c = lb.bot.controller;
        if (!c) return;
        if (lb.goals && lb.goals.length) { c.getNavigationTarget = goalNav(lb); return; }
        // no goals: sail the given bearing as the course (the old behavior)
        const gx = lb.bot.x + Math.sin(heading) * 8000;
        const gy = lb.bot.y - Math.cos(heading) * 8000;
        c.getNavigationTarget = () => ({ x: gx, y: gy });
    }
    function handoffToAI(lb) {
        const bt = lb.bot, c = bt.controller;
        if (c && Object.prototype.hasOwnProperty.call(c, 'update')) delete c.update;
        aiNavFor(lb, bt.heading);
        lb._mode = 'AI';
    }
    // one seed → one recording (returned, not applied — runAll owns the
    // cache and the transport)
    function simulateSeed(SEED) {
        applyInitial();
        // DETERMINISM: a testing tool must give the same verdict for the same
        // scenario. Two layers:
        // 1. the burst runs under a seeded PRNG (mulberry32) — the AI rolls
        //    Math.random for wiggle sides and tie-breaks;
        // 2. every lab boat's HELM is rebuilt from scratch INSIDE the seeded
        //    scope. A controller carries timers, EMAs and boot-time randoms
        //    (prestart side, congestion phase), it keeps mutating while you
        //    sit in EDIT (updateAI runs on pinned boats every frame), and it
        //    survives from run to run — measured: the same scenario gave
        //    penalty/no-penalty depending on what was played before it.
        const realRandom = Math.random;
        let rngState = SEED | 0;
        Math.random = function () {
            rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
            let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const nF = Math.round(LAB.durationS * 60);
        let frames;
        try {
        for (const lb of LAB.boats) {
            const bt = lb.bot;
            // fresh, neutral persona + helm (all randoms drawn seeded)
            bt.archetype = null;
            if (typeof DEFAULT_TRAITS !== 'undefined') bt.traits = Object.assign({}, DEFAULT_TRAITS);
            bt.ai = {
                targetHeading: 0, state: 'start', tackCooldown: 0, stuckTimer: 0,
                recoveryMode: false, recoveryTarget: 0,
                prestartSide: (Math.random() > 0.5) ? 1 : -1,
                trimTimer: 0, currentTrimTarget: 0,
                congestionTimer: Math.random() * 2.0,
            };
            if (typeof BotController !== 'undefined') bt.controller = new BotController(bt);
            // the rules module's per-boat clocks (tack-flip times feed the
            // rule-15 acquisition test) must not leak between runs either
            if (window.Rules) {
                if (window.Rules._tackFlipT) delete window.Rules._tackFlipT[bt.id];
                if (window.Rules._lastTack) delete window.Rules._lastTack[bt.id];
            }
            const c = bt.controller;
            // per-run goal state: fresh queue every simulation
            lb._goalIdx = 0; lb._sweep = null; lb._gSide = null; lb._goalOut = null;
            const scripted = lb.plan && lb.plan.length > 0 && lb.aiAtS !== 0;
            if (scripted) {
                lb._mode = 'S';
                if (c) c.update = planUpdate(lb);
            } else {
                // AI from the start: sail the goals in order (or the SET
                // heading if there are none) — strategy, avoidance, rules
                // and the umpire all live
                lb._mode = 'AI';
                aiNavFor(lb, lb.heading);
            }
        }
        frames = [snapshot()];
        LAB.recording = true;
        // penalty EVENTS with the umpire's cited rule, via the engine's own
        // onRaceEvent hook — the recording carries the citation, not a guess
        var pens = [];
        var prevORE = window.onRaceEvent;
        window.onRaceEvent = function (type, data) {
            if (type === 'penalty' && data && data.boat) {
                const bi = LAB.boats.findIndex(lb => lb.bot === data.boat);
                if (bi >= 0) pens.push({ t: +LAB.simT.toFixed(2), boat: bi, rule: data.rule || null, kind: data.kind || null });
            }
            if (prevORE) prevORE(type, data);
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
            window.onRaceEvent = prevORE;
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
        return { frames, ticks, nF, pens,
            names: LAB.boats.map(lb => lb.bot.name),
            goalCounts: LAB.boats.map(lb => (lb.goals || []).length),
            seed: SEED >>> 0 };
    }
    // fill the cache for every seed missing a recording, then point the
    // transport at the active one and judge the assertions across the set
    function runAllSync() {
        for (const s of LAB.seeds.map(x => x >>> 0)) {
            if (!LAB.recs[s]) LAB.recs[s] = simulateSeed(s);
        }
        LAB.frame = Math.min(LAB.frame, Math.round(LAB.durationS * 60));
        setActiveSeed(LAB.seedIx);
        evaluateAsserts();
    }
    function setFrame(f) {
        if (!LAB.rec) return;
        LAB.frame = Math.max(0, Math.min(LAB.rec.nF, Math.round(f)));
        LAB.mode = 'play';   // scrubbing a recording IS playback
    }
    // NO MODE BUTTONS (owner ruling 2026-08-17): the transport is always on
    // the bottom and its play button is how a run starts — simulating first
    // if no recording exists. Any EDIT (drag, field change, add, delete)
    // invalidates the recording and drops back to initial conditions; the
    // transport just rewinds. Objects stay selectable while scrubbing.
    function play() {
        const missing = LAB.seeds.map(s => s >>> 0).filter(s => !LAB.recs[s]);
        const begin = () => {
            if (!LAB.rec) setActiveSeed(LAB.seedIx);
            if (!LAB.rec) return;
            if (LAB.frame >= LAB.rec.nF) LAB.frame = 0;
            LAB.mode = 'play'; LAB.playing = true;
            pbPlay.innerHTML = SVG_PAUSE;
            // a NEW run shows Rights & Umpire; resuming keeps the selection
            if (missing.length) select(null);
        };
        if (!missing.length) { begin(); return; }
        // the burst blocks the main thread — the SIMULATING card goes up and
        // gets a painted frame before each seed runs
        simCover.style.display = 'flex';
        const prog = simCover.querySelector('#sim-prog');
        let done = 0;
        const step = () => {
            const s = LAB.seeds.map(x => x >>> 0).find(x => !LAB.recs[x]);
            if (s == null) {
                simCover.style.display = 'none';
                setActiveSeed(LAB.seedIx);
                evaluateAsserts();
                begin();
                return;
            }
            prog.textContent = missing.length > 1 ? `seed ${++done} / ${missing.length}` : '';
            requestAnimationFrame(() => setTimeout(() => { LAB.recs[s] = simulateSeed(s); step(); }, 15));
        };
        step();
    }
    function pause() { LAB.playing = false; pbPlay.innerHTML = SVG_PLAY; }
    pbPlay.onclick = () => { if (LAB.playing) pause(); else play(); };
    bar.querySelector('#pb-back').onclick = () => { if (!LAB.rec) return; pause(); setFrame(LAB.frame - 30); };
    bar.querySelector('#pb-fwd').onclick = () => { if (!LAB.rec) return; pause(); setFrame(LAB.frame + 30); };
    pbSlider.addEventListener('input', () => { if (!LAB.rec) { pbSlider.value = 0; return; } pause(); setFrame(+pbSlider.value); });
    ui.querySelector('#lab-clear').onclick = () => {
        if (!LAB.boats.length && !LAB.marks.length && !LAB.sands.length && !LAB.lines.length) return;
        confirmDialog('Clear scene', 'Remove every boat, object, mark and line from the scene?', clearScene, 'Clear');
    };
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
                else if (e.key === 'Escape') {
                    if (LAB.goalArm) setGoalArm(false);
                    else if (LAB.armed) setArmed(LAB.armed);
                    else select(null);
                }
                else if (e.key === '+' || e.key === '=') setZoom(LAB.zoom * 1.25);
                else if (e.key === '-' || e.key === '_') setZoom(LAB.zoom / 1.25);
                else if (e.key === '0') setZoom(1);
                else if (e.key === 'f' || e.key === 'F') zoomFit();
                else if (e.key === ' ') pbPlay.onclick();   // starts a run too, like the button
                else if (LAB.rec) {
                    if (e.key === 'ArrowLeft') { pause(); setFrame(LAB.frame - 1); }
                    else if (e.key === 'ArrowRight') { pause(); setFrame(LAB.frame + 1); }
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
    // (store() lives with the library machinery below)
    function sceneObj() {
        const S = LAB.stage;
        return {
            v: 1, durationS: LAB.durationS, windKt: LAB.windKt,
            seeds: LAB.seeds.map(s => s >>> 0),
            asserts: LAB.asserts.length ? LAB.asserts.map(a => ({ ...a })) : undefined,
            boats: LAB.boats.map(lb => ({ x: Math.round(lb.x - S.x), y: Math.round(lb.y - S.y), headingDeg: Math.round(lb.heading * DEG), speedKt: lb.speedKt,
                plan: (lb.plan && lb.plan.length) ? lb.plan.map(en => ({ t: en.t, headingDeg: en.headingDeg })) : undefined,
                aiAtS: lb.aiAtS == null ? undefined : lb.aiAtS,
                goals: (lb.goals && lb.goals.length) ? lb.goals.map(g =>
                    g.type === 'point' ? { k: 'p', x: Math.round(g.x - S.x), y: Math.round(g.y - S.y) }
                    : g.type === 'mark' ? { k: 'm', i: LAB.marks.indexOf(g.ref) }
                    : { k: 'g', i: LAB.lines.indexOf(g.ref) }).filter(g => g.k === 'p' || g.i >= 0) : undefined })),
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
        // migration: scalar-seed docs become one-seed sets; pre-seed docs
        // replay on the old constant
        LAB.seeds = (sc.seeds && sc.seeds.length) ? sc.seeds.map(s => s >>> 0)
            : [(sc.seed != null ? sc.seed : 0x9e3779b9) >>> 0];
        LAB.seedIx = 0;
        LAB.recs = {};
        renderSeeds();
        LAB.asserts = (sc.asserts || []).map(a => ({ ...a }));
        LAB.assertResults = null;
        renderAsserts();
        const pendingGoals = [];   // goals reference marks/lines added below
        for (const bs of (sc.boats || [])) {
            const lb = addBoat(S.x + bs.x, S.y + bs.y);
            if (lb) {
                lb.heading = (bs.headingDeg || 0) / DEG;
                lb.speedKt = bs.speedKt != null ? bs.speedKt : 6;
                // (older docs carried a per-step `spin` order — dropped on load;
                // the kite is auto-only now)
                lb.plan = bs.plan ? bs.plan.map(en => ({ t: en.t, headingDeg: en.headingDeg })).sort((a, b) => a.t - b.t) : [];
                lb.aiAtS = bs.aiAtS == null ? null : bs.aiAtS;
                if (bs.goals && bs.goals.length) pendingGoals.push([lb, bs.goals]);
            }
        }
        for (const ms of (sc.marks || [])) {
            const m = addMark(S.x + ms.x, S.y + ms.y);
            if (ms.side) m.side = ms.side;
            if (ms.zone) m.zone = ms.zone;
        }
        for (const ss of (sc.sands || [])) addSand(S.x + ss.x, S.y + ss.y, ss.r);
        for (const ls of (sc.lines || [])) { const ln = addLine(S.x + (ls.x1 + ls.x2) / 2, S.y + (ls.y1 + ls.y2) / 2); ln.x1 = S.x + ls.x1; ln.y1 = S.y + ls.y1; ln.x2 = S.x + ls.x2; ln.y2 = S.y + ls.y2; }
        for (const [lb, gs] of pendingGoals) {
            lb.goals = gs.map(g =>
                g.k === 'p' ? { type: 'point', x: S.x + g.x, y: S.y + g.y }
                : g.k === 'm' ? (LAB.marks[g.i] && { type: 'mark', ref: LAB.marks[g.i] })
                : (LAB.lines[g.i] && { type: 'gate', ref: LAB.lines[g.i] })).filter(Boolean);
        }
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
    // DELETION TOMBSTONES. The shipped file re-seeds the library on every
    // store() call and every page load, so "delete" must be a recorded fact,
    // not just a removal — without the tombstone a shipped scenario popped
    // straight back into the Open list (the delete-in-Open bug). Saving a
    // scenario under a tombstoned name clears its tombstone.
    function loadTombs() {
        try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY + '_tombs') || '[]')); } catch (e) { return new Set(); }
    }
    function saveTombs(t) { localStorage.setItem(STORE_KEY + '_tombs', JSON.stringify([...t])); }
    function store() {
        let local = {};
        try { local = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { }
        const shipped = (window.SCENARIO_DOC && typeof window.SCENARIO_DOC === 'object') ? window.SCENARIO_DOC : {};
        const merged = { ...shipped, ...local };
        for (const t of loadTombs()) delete merged[t];
        return merged;
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
                ui.querySelector('#lab-libname').textContent = (h.name || 'library') + ' — click change to reattach';
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
        box.style.cssText = 'min-width:300px;max-width:420px;max-height:70vh;display:flex;flex-direction:column;background:rgba(7,19,34,.96);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 10px 34px rgba(4,16,28,.5);padding:16px 18px;color:#eef3fb;font:13px/1.4 Archivo,system-ui,sans-serif';
        const h = document.createElement('div');
        h.textContent = title.toUpperCase();
        h.style.cssText = 'font-size:13px;font-weight:900;font-style:italic;letter-spacing:.04em;margin-bottom:10px';
        box.appendChild(h);
        if (bodyEl) { bodyEl.style.overflowY = 'auto'; box.appendChild(bodyEl); }
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:14px';
        const close = () => { wrap.remove(); LAB.modal = null; };
        for (const b of buttons) {
            const btn = document.createElement('button');
            btn.textContent = b.label.toUpperCase();
            btn.className = 'sl-btn' + (b.primary ? ' sl-btn-pri' : '');
            btn.style.cssText = 'flex:none;padding:8px 16px';
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
            LAB.seeds = [0x9e3779b9]; LAB.seedIx = 0; LAB.recs = {};
            renderSeeds();
            LAB.asserts = []; LAB.assertResults = null;
            renderAsserts();
            markSaved();
            select(null);
        });
    }
    function saveScenario(asNew) {
        const doIt = (name) => {
            const t = loadTombs();
            if (t.has(name)) { t.delete(name); saveTombs(t); }   // saving revives the name
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
            inp.style.cssText = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;color:#eef3fb;font:800 13px Archivo,system-ui,sans-serif;outline:none';
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
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;font-weight:700';
            row.onmouseenter = () => row.style.background = 'rgba(255,255,255,.07)';
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
                    select(null);
                });
            };
            const del = document.createElement('span');
            del.innerHTML = '&#10005;';
            del.title = 'delete';
            del.style.cssText = 'cursor:pointer;color:#66748c;padding:0 4px;font-size:11px';
            del.onmouseenter = () => del.style.color = '#ff8a75';
            del.onmouseleave = () => del.style.color = '#66748c';
            del.onclick = (e) => {
                e.stopPropagation();
                dlg.close();
                confirmDialog('Delete scenario', `Delete “${n}”? This cannot be undone.`, () => {
                    const l2 = store(); delete l2[n];
                    const t = loadTombs(); t.add(n); saveTombs(t);
                    // the in-memory shipped copy too, or store() resurrects it
                    if (window.SCENARIO_DOC) delete window.SCENARIO_DOC[n];
                    persistLib(l2);
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
        // goal placement: a click while armed APPENDS a goal for the selected
        // boat and never disturbs the selection — a mark means round it, a
        // line means go through it, open water means a waypoint
        if (LAB.goalArm && LAB.sel && LAB.sel.kind === 'boat' && LAB.mode === 'edit') {
            const lb = LAB.sel.ref;
            if (hit && hit.kind === 'mark') lb.goals.push({ type: 'mark', ref: hit.ref });
            else if (hit && hit.kind === 'line') lb.goals.push({ type: 'gate', ref: hit.ref });
            else if (!hit || hit.kind === 'sand') lb.goals.push({ type: 'point', x: wx, y: wy });
            else return;   // a click on a boat places nothing
            renderGoals(lb);
            invalidate();
            return;
        }
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
            LAB.cam.x = LAB.drag.cx - (e.clientX - LAB.drag.sx) / LAB.zoom;
            LAB.cam.y = LAB.drag.cy - (e.clientY - LAB.drag.sy) / LAB.zoom;
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
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const hull = {};
        for (const lb of LAB.boats) hull[lb.bot.name] = (lb.bot.colors && lb.bot.colors.hull) || '#8fd0ff';
        const dot = (nm, sz) => `<span style="width:${sz || 10}px;height:${sz || 10}px;border-radius:50%;background:${hull[nm] || '#8fd0ff'};border:1px solid rgba(255,255,255,.3);flex:none"></span>`;
        const html = [];
        // right-of-way, one amber card per engaged pair
        for (const p of pairs) {
            if (p.row) {
                const other = p.row === p.a ? p.b : p.a;
                const ruleTxt = p.rule ? String(p.rule).replace(/^rule\s*/i, '').toUpperCase() : '';
                html.push(`<div class="sl-rowcard">
                    <div class="sl-rulelabel">RIGHT OF WAY${ruleTxt ? ' · RULE ' + esc(ruleTxt) : ''}</div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
                      ${dot(p.row)}<span style="font-size:13px;font-weight:900;font-style:italic">${esc(p.row.toUpperCase())}</span>
                      <span style="font-size:11px;font-weight:700;color:#9fb2cc">holds right of way over ${esc(other)}</span>
                    </div>` +
                    (p.mk ? `<div style="display:flex;align-items:center;gap:8px;margin-top:6px">
                      ${dot(p.mk)}<span style="font-size:11px;font-weight:700;color:#9fb2cc"><b style="color:#eef3fb">${esc(p.mk)}</b> is owed mark-room</span>
                    </div>` : '') + `</div>`);
            } else {
                html.push(`<div class="sl-card" style="margin-bottom:6px">
                    <span style="font-size:11px;font-weight:700;color:#9fb2cc">${esc(p.a)} · ${esc(p.b)} — no right of way determined</span></div>`);
            }
        }
        // one status card per boat: heading · speed · tack, the helm, and
        // what the AI is doing about it
        for (let i = 0; i < LAB.boats.length; i++) {
            const nm = LAB.boats[i].bot.name;
            const bi = boats ? boats[i] : null;
            let stats = '';
            if (bi) {
                const hdg = String(Math.round(((bi.h * DEG) % 360 + 360) % 360) % 360).padStart(3, '0');
                const kt = (bi.s * 4).toFixed(1);
                const tack = bi.ta === 1 ? 'STBD' : bi.ta === -1 ? 'PORT' : null;
                stats = `${hdg}&deg; &middot; ${kt} kt${tack ? ' &middot; ' + tack : ''}`;
            }
            const chips = [];
            if (bi) {
                if (bi.mode === 'S') {
                    // a scripted boat doesn't react, so her controller's
                    // role/risk/deflection are stale — show only the mode
                    chips.push(['teal', 'SCRIPTED']);
                } else {
                    if (bi.role && bi.role !== 'NONE' && bi.role !== '-') chips.push([bi.role === 'GIVE_WAY' ? 'amber' : 'teal', bi.role === 'GIVE_WAY' ? 'GIVE-WAY' : 'STAND-ON']);
                    if (bi.risk && bi.risk !== 'LOW' && bi.risk !== '-') chips.push(['amber', 'RISK ' + esc(bi.risk)]);
                    if (Math.abs(bi.dev) > 0.05) chips.push(['amber', 'DEFLECTING ' + Math.round(Math.abs(bi.dev) * DEG) + '°']);
                    const nG = LAB.boats[i].goals ? LAB.boats[i].goals.length : 0;
                    if (nG) chips.push(bi.gi >= nG ? ['teal', 'GOALS DONE'] : ['mute', 'GOAL ' + (bi.gi + 1) + '/' + nG]);
                }
                if (bi.tk) chips.push(['mute', 'TACKING']);
                if (bi.pen) chips.push(['red', 'PENALTY']);
                if (bi.penN) chips.push(['red', bi.penN + ' PEN']);
            } else if (LAB.boats[i].bot.raceState.penalty) {
                chips.push(['red', 'PENALTY']);
            }
            if (!chips.length && !stats) continue;
            html.push(`<div class="sl-card" style="margin-bottom:6px;flex-wrap:wrap">
                ${dot(nm)}<span class="sl-bname" style="min-width:20px">${esc(nm.toUpperCase())}</span>
                ${stats ? `<span style="font-size:11px;font-weight:800;font-variant-numeric:tabular-nums;color:#9fb2cc;white-space:nowrap">${stats}</span>` : ''}
                ${chips.map(([c, t]) => `<span class="sl-schip sl-schip-${c}">${t}</span>`).join('')}</div>`);
        }
        rightsEl.innerHTML = html.length ? html.join('')
            : '<div class="sl-hint" style="padding:2px 2px 4px">no boats within hailing distance</div>';
    }
    function frame() {
        if (!LAB.ready || LAB.recording) return;
        const st = window.state;
        // silence, enforced: reset/start re-apply stored settings, so the mute
        // is re-asserted per frame (in memory only — never written back)
        if (typeof settings !== 'undefined') {
            settings.soundEnabled = false; settings.bgSoundEnabled = false; settings.musicEnabled = false;
        }
        // THE RACE NEVER ENDS HERE. Outside the simulation burst the clock is
        // pinned, so the venue's time limit can never fire — which is what
        // used to finish the underlying stage race after a few minutes
        // of editing: the trajectory-save path ran, the (hidden) results
        // overlay went up, and the loop's results catch-up (iterations=10)
        // sent the whole world — wind comets included — into fast-forward.
        st.race.timer = 100;
        if (st.race.status !== 'racing') st.race.status = 'racing';
        // belt-and-braces: the results catch-up reads the overlay's CLASS, and
        // our CSS hide doesn't touch classList — keep 'hidden' on it always
        const ro = document.getElementById('results-overlay');
        if (ro && !ro.classList.contains('hidden')) ro.classList.add('hidden');
        st.wind.direction = 0; st.wind.baseDirection = 0;
        st.wind.speed = LAB.windKt; st.wind.baseSpeed = LAB.windKt;
        const b0 = LAB.stage || { x: 0, y: 0 };
        for (const o of st.boats) {
            const mine = LAB.boats.some(lb => lb.bot === o);
            if (!mine) { o.x = b0.x - 1e6; o.y = b0.y - 1e6; o.speed = 0; o.velocity = { x: 0, y: 0 }; }
        }
        if (LAB.mode === 'edit') {
            applyInitialFrame();
            // name colour previews the opening helm: white = scripted, green = AI
            for (const lb of LAB.boats) lb._dispMode = (lb.plan && lb.plan.length && lb.aiAtS !== 0) ? 'S' : 'AI';
            renderRights(pairRights(), null);
            timeEl.textContent = 't = 0.0s';
            // the always-on transport reads true while editing: rewound, armed
            pbSlider.value = 0;
            pbFill();
            pbTime.textContent = `0.0 / ${LAB.durationS.toFixed(1)}s`;
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
                LAB.boats[i]._dispMode = fb.mode;   // tag colour tracks the recorded helm
            }
            pbSlider.value = LAB.frame;
            pbFill();
            const t = LAB.frame / 60;
            pbTime.textContent = `${t.toFixed(1)} / ${LAB.durationS.toFixed(1)}s`;
            timeEl.textContent = `t = ${t.toFixed(1)}s`;
            renderRights(fr.pairs, fr.boats);
        }
        // camera: ours, north-up
        st.camera.rotation = 0;
        st.camera.x = LAB.cam.x; st.camera.y = LAB.cam.y;
        st.camera.fx = LAB.cam.x; st.camera.fy = LAB.cam.y;
        st.camera.target = 'boat';
        // zoom enforcement: the world canvas renders at viewport/zoom and CSS
        // stretches it back — re-asserted every frame, which also undoes the
        // game's own window-resize handler setting it back to 1:1
        const gc = document.getElementById('gameCanvas');
        if (gc) {
            const lw = Math.max(64, Math.round(window.innerWidth / LAB.zoom));
            const lh = Math.max(64, Math.round(window.innerHeight / LAB.zoom));
            if (gc.width !== lw || gc.height !== lh) { gc.width = lw; gc.height = lh; }
            if (gc.style.width !== '100vw') { gc.style.width = '100vw'; gc.style.height = '100vh'; }
        }
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
            const Z = (m.zone || 165) * LAB.zoom;   // world radius on a zoomed screen
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
            octx.beginPath(); octx.arc(px, py, Math.max(6, 12 * LAB.zoom), 0, 7);
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
        // the goal route: boat → 1 → 2 → … dotted in the hull colour, with
        // numbered pips matching the inspector's step badges (edit mode,
        // selected boat only — the water stays quiet otherwise)
        if (LAB.mode === 'edit' && LAB.sel && LAB.sel.kind === 'boat'
            && LAB.sel.ref.goals && LAB.sel.ref.goals.length) {
            const lb = LAB.sel.ref;
            const col = (lb.bot.colors && lb.bot.colors.hull) || '#8fd0ff';
            octx.beginPath();
            const [bx, by] = w2s(lb.x, lb.y);
            octx.moveTo(bx, by);
            for (const g of lb.goals) { const [gx, gy] = goalPoint(g); const [sx, sy] = w2s(gx, gy); octx.lineTo(sx, sy); }
            octx.strokeStyle = col; octx.globalAlpha = 0.75; octx.lineWidth = 2.5;
            octx.setLineDash([4, 7]); octx.stroke(); octx.setLineDash([]); octx.globalAlpha = 1;
            lb.goals.forEach((g, k) => {
                const [gx, gy] = goalPoint(g);
                const [sx, sy] = w2s(gx, gy);
                octx.beginPath(); octx.arc(sx, sy, 11, 0, 7);
                octx.fillStyle = 'rgba(7,19,34,0.85)'; octx.fill();
                octx.strokeStyle = col; octx.lineWidth = 2; octx.stroke();
                octx.fillStyle = '#eef3fb'; octx.font = '800 11px Archivo,system-ui';
                octx.textAlign = 'center'; octx.textBaseline = 'middle';
                octx.fillText(String(k + 1), sx, sy);
            });
        }
        if (LAB.sel && LAB.sel.kind !== 'play' && LAB.mode === 'edit') {
            let cx, cy, r = 40;
            const s = LAB.sel;
            if (s.kind === 'boat') { cx = s.ref.bot.x; cy = s.ref.bot.y; r = 48; }
            else if (s.kind === 'mark') { cx = s.ref.x; cy = s.ref.y; r = 26; }
            else if (s.kind === 'sand') { cx = s.ref.x; cy = s.ref.y; r = s.ref.r + 14; }
            else { cx = (s.ref.x1 + s.ref.x2) / 2; cy = (s.ref.y1 + s.ref.y2) / 2; r = 30; }
            const [px, py] = w2s(cx, cy);
            octx.beginPath(); octx.arc(px, py, Math.max(14, r * LAB.zoom), 0, 7);
            octx.strokeStyle = 'rgba(143,208,255,0.9)'; octx.lineWidth = 2; octx.setLineDash([6, 6]); octx.stroke(); octx.setLineDash([]);
        }
        // (no wind arrow: the wind comets on the water already show direction
        // and strength, and the knots value is editable in the panel)
    }

    // ── TEST API: the headless runner's seam (eval/run_scenario.js drives
    // this page — the page IS the fixture, so page and runner can never
    // disagree about what a scenario does) ─────────────────────────────
    LAB.testAPI = {
        load(name) {
            const lib = store();
            if (!lib[name]) throw new Error('no scenario named "' + name + '"');
            LAB._loading = true;
            loadScene(lib[name]);
            nameIn.value = name;
            LAB._loading = false;
            markSaved();
        },
        run() {
            runAllSync();   // every seed in the set
            const names = LAB.rec ? LAB.rec.names : [];
            return {
                seeds: LAB.seeds.map(s => s >>> 0),
                runs: LAB.seeds.map(s => {
                    const r = LAB.recs[s >>> 0];
                    return { seed: s >>> 0, ticks: r.ticks.map(f => +(f / 60).toFixed(2)), pens: r.pens };
                }),
                asserts: (LAB.assertResults || []).map((r, k) => ({
                    label: window.ScenarioAsserts.label(LAB.asserts[k], names),
                    n: r.n, ok: r.ok,
                    status: r.n === 1 ? r.single.status : (r.ok === r.n ? 'pass' : 'fail'),
                    why: r.n === 1 ? r.single.why : (r.fail ? `seed ${r.fail.seed}: ${r.fail.why}` : 'held on every seed'),
                })),
            };
        },
    };

    _update = window.update;
    window.update = function (dt) { _update(dt); try { frame(); } catch (e) { } };

    window.addEventListener('load', () => setTimeout(boot, 400));
})();
