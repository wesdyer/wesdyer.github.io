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
        tags: [],            // free organization labels, searchable in Open
        assertResults: null, // last run's verdicts (ScenarioAsserts.evaluate)
    };
    // debug/test seam: lets the console (and the Playwright checks) see the
    // lab's state without threading it through the page
    window.__LAB = LAB;

    // ── UI: the editor convention — the SCENE list on the left (boats,
    // marks, lines, terrain; “＋” on a group arms placement), DETAILS on
    // the right (the selected object). The play transport stays on the
    // bottom when in use. ──────────────────────────────────────────────
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
      .sl-btn:disabled{opacity:.35;cursor:default;pointer-events:none}
      .sl-btn-pri{background:#2f6bff;border-color:#2f6bff;color:#fff;font-weight:900}
      .sl-btn-pri:hover{background:#4a80ff}
      .sl-btn-danger{appearance:none;flex:none;background:none;border:1px solid rgba(236,48,19,.4);color:#ff8a75;padding:7px 14px;border-radius:8px;font:800 11px Archivo,system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}
      .sl-btn-danger:hover{background:rgba(236,48,19,.15)}
      .sl-btn-red{background:#c9392a;border-color:#c9392a;color:#fff;font-weight:900}
      .sl-btn-red:hover{background:#e0503f}
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
      .sl-mitem{padding:9px 10px;border-radius:8px;font-size:13.5px;font-weight:800;cursor:pointer;letter-spacing:.01em}
      .sl-mitem:hover{background:rgba(255,255,255,.07)}
      .sl-mitem-red{color:#ff8a75}
      .sl-fold{display:flex;align-items:center;gap:8px;cursor:pointer;padding:7px 8px;margin:0 -8px;border-radius:8px;font-size:12.5px;font-weight:800;letter-spacing:.03em;user-select:none}
      .sl-fold:hover{background:rgba(255,255,255,.07)}
      .sl-fold .sl-chev{display:inline-flex;color:#66748c;flex:none}
      .sl-fold .sl-chev svg{transition:transform .15s ease}
      .sl-fold.open .sl-chev svg{transform:rotate(90deg)}
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
      .sl-adlg .sl-step{font-size:13px;gap:8px;padding:10px 12px;margin-bottom:8px}
      .sl-adlg .sl-stepn{width:20px;height:20px;font-size:11px}
      .sl-adlg .sl-bare{font-size:14px}
      .sl-adlg .sl-msel{font-size:12px;padding:5px 8px}
      .sl-adlg .sl-hint{font-size:12px}
      .sl-adlg .sl-schip{font-size:11px;padding:4px 9px}
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
        <span title="Scenario Lab" style="display:inline-flex;color:#8fd8d0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path fill="currentColor" stroke="none" d="M4.55 10 H11.45 L12.9 12.55 a1.1 1.1 0 0 1 -1.02 1.65 H4.12 a1.1 1.1 0 0 1 -1.02 -1.65 Z"/>
            <path d="M5.6 1.8 h4.8"/>
            <path d="M6.6 1.8 v4.1 L3.1 12.3 a1.25 1.25 0 0 0 1.15 1.9 h7.5 a1.25 1.25 0 0 0 1.15 -1.9 L9.4 5.9 V1.8"/>
          </svg>
        </span>
      </div>
      <div class="sl-sect">
        <div style="display:flex;gap:8px">
          <button id="lab-mode-edit" class="sl-btn sl-btn-pri" style="flex:1;padding:9px 0;letter-spacing:.1em" title="author the scenario — transport hidden, everything at t=0">EDIT</button>
          <button id="lab-mode-sim" class="sl-btn" style="flex:1;padding:9px 0;letter-spacing:.1em;display:inline-flex;align-items:center;justify-content:center;gap:7px" title="run every seed and scrub the recordings (SPACE)"><svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2.5 1.2 L10.5 6 L2.5 10.8 Z"/></svg>SIMULATE</button>
        </div>
      </div>
      <div id="lab-summary" style="display:none;padding:14px 16px 16px">
        <div id="lab-sum-name" style="font-size:15px;font-weight:900;font-style:italic;letter-spacing:.02em"></div>
        <div id="lab-sum-pass" style="margin-top:8px;display:flex"></div>
        <button id="lab-sum-seed" class="sl-btn" style="width:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;margin-top:8px;font-variant-numeric:tabular-nums;letter-spacing:.02em"></button>
      </div>
      <div id="lab-editbody">
      <div class="sl-sect">
        <div class="sl-inp"><input id="lab-name" type="text" placeholder="Scenario Name"></div>
        <div id="lab-tagbox" class="sl-inp" style="margin-top:6px;flex-wrap:wrap;gap:4px;padding:5px 8px;cursor:text" title="tags — Enter or comma adds; searchable in Open">
          <span id="lab-tagchips" style="display:contents"></span>
          <input id="lab-tagin" type="text" placeholder="add tag" style="flex:1;min-width:64px;padding:3px 0;font-weight:700">
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button id="lab-save" class="sl-btn sl-btn-pri">SAVE</button>
          <span id="lab-morewrap" style="position:relative;flex:none">
            <button id="lab-more" class="sl-btn" style="width:44px;padding:9px 0;font-weight:900;letter-spacing:.1em" title="more scenario actions">&#8943;</button>
            <div id="lab-moremenu" style="display:none;position:fixed;min-width:232px;color:#eef3fb;font:13px/1.4 Archivo,system-ui,sans-serif;background:rgba(7,19,34,.88);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 10px 34px rgba(4,16,28,.4);padding:8px;z-index:92">
              <div class="sl-mitem" id="lab-saveas">Save as&hellip;</div>
              <div class="sl-mitem" id="lab-new">New scenario</div>
              <div class="sl-mitem" id="lab-open">Open&hellip;</div>
              <div style="border-top:1px solid rgba(255,255,255,.1);margin:6px 2px"></div>
              <div class="sl-hint" style="padding:7px 10px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">library: <span id="lab-libname">not attached</span> &middot; <span id="lab-libopen" style="cursor:pointer;text-decoration:underline;text-underline-offset:2px" title="attach assets/scenarios.js so saves write to it">change</span></div>
              <div style="border-top:1px solid rgba(255,255,255,.1);margin:6px 2px"></div>
              <div class="sl-mitem sl-mitem-red" id="lab-discard" title="throw away unsaved changes and restore the saved scenario">Discard changes&hellip;</div>
              <div class="sl-mitem sl-mitem-red" id="lab-clear">Clear scene&hellip;</div>
              <div class="sl-mitem sl-mitem-red" id="lab-delete" title="delete this scenario from the library">Delete scenario&hellip;</div>
            </div>
          </span>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,.08);margin:12px -16px 12px"></div>
        <div class="sl-grid2">
          <div>
            <div class="sl-lab">Duration</div>
            <div class="sl-inp"><input id="lab-dur" type="text" inputmode="decimal" value="10"><span class="sl-unit">s</span></div>
          </div>
          <div>
            <div class="sl-lab">Wind</div>
            <div class="sl-inp"><input id="lab-wind" type="text" inputmode="decimal" value="12"><span class="sl-unit">kt</span></div>
          </div>
        </div>
        <div style="margin-top:6px">
          <div id="lab-seedrow" class="sl-fold" title="the seed set — status, switch, add, remove — click to open">
            <span>Seeds</span>
            <span class="sl-count" id="lab-seedcount"></span>
            <span id="lab-seeddots" style="display:inline-flex;margin-left:auto"></span>
          </div>
        </div>
        <div>
          <div id="lab-assertrow" class="sl-fold" title="expectations judged against every run — click to open">
            <span>Assertions</span>
            <span class="sl-count" id="lab-assertcount"></span>
            <span id="lab-assertpill" style="display:inline-flex;margin-left:auto"></span>
          </div>
        </div>
      </div>
      <div style="padding:8px 8px 10px">
        <div class="sl-sectlabel" style="padding:4px 8px 6px;margin:0">SCENE</div>
        <div id="lab-layers"></div>
      </div>
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

    // the object inspector lives on the RIGHT and only in EDIT mode; RIGHTS
    // & UMPIRE owns the same spot in SIMULATE mode (owner: one bar on the
    // left, at most one on the right)
    const right = document.createElement('div');
    right.className = 'sl-panel';
    right.style.cssText = 'right:20px;top:20px;width:300px;max-height:calc(100vh - 120px);display:none';
    right.innerHTML = `
      <div class="sl-head">
        <span id="lab-seldot" style="width:12px;height:12px;border-radius:50%;flex:none;display:none"></span>
        <span id="lab-selname" class="sl-title"></span>
        <span id="lab-kindchip" class="sl-chip"></span>
      </div>
      <div class="sl-sect">
        <div class="sl-lab">Name</div>
        <div class="sl-inp"><input id="lab-objname" type="text" title="blank = the default name"></div>
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
            <div>
              <div class="sl-lab" title="east of the scenario origin">X</div>
              <div class="sl-inp"><input id="lab-x" type="text" inputmode="decimal"><span class="sl-unit">m</span></div>
            </div>
            <div>
              <div class="sl-lab" title="south of the scenario origin">Y</div>
              <div class="sl-inp"><input id="lab-y" type="text" inputmode="decimal"><span class="sl-unit">m</span></div>
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
        <div class="sl-sect"><div class="sl-hint">solid sand &middot; drag a vertex to reshape &middot; &#8984;-drag rotates &middot; &#8997;-drag scales &middot; boats ground on it</div></div>
      </div>
      <div id="det-line" style="display:none">
        <div class="sl-sect"><div class="sl-hint">a line on the water &middot; drag the end handles &middot; &#8997;-drag stretches</div></div>
      </div>
      <div id="lab-delrow" style="display:none;justify-content:flex-end;padding:12px 16px">
        <button id="lab-del" class="sl-btn-danger">DELETE</button>
      </div>`;
    col.append(left);
    document.body.appendChild(col);
    document.body.appendChild(right);
    const ui = { querySelector: (s) => left.querySelector(s) || right.querySelector(s) || ump.querySelector(s) || document.querySelector(s),
                 querySelectorAll: (s) => [...left.querySelectorAll(s), ...right.querySelectorAll(s), ...ump.querySelectorAll(s)] };
    // the … menu portals to <body>: the panel's backdrop-filter makes it the
    // containing block for fixed descendants, so a child flyout would be
    // clipped by the panel's own overflow
    document.body.appendChild(left.querySelector('#lab-moremenu'));

    // the layer list — the object layers with “＋” adders (the Scenario row
    // is gone: its details are pinned at the top of the panel now).
    // An armed “＋” means the next click on open water places that kind.
    const LAYERS = [
        ['boat', 'Boats', () => LAB.boats.map((lb) => ({ label: lb.bot.name, sel: { kind: 'boat', ref: lb } }))],
        ['sand', 'Objects', () => LAB.sands.map((s) => ({ label: sandName(s), sel: { kind: 'sand', ref: s } }))],
        ['mark', 'Marks', () => LAB.marks.map((m) => ({ label: markName(m), sel: { kind: 'mark', ref: m } }))],
        ['line', 'Lines', () => LAB.lines.map((l) => ({ label: lineName(l), sel: { kind: 'line', ref: l, part: 0 } }))],
    ];
    const layersDiv = left.querySelector('#lab-layers');
    function setArmed(kind) {
        LAB.armed = LAB.armed === kind ? null : kind;
        LAB.sandDraft = null;   // arming/disarming abandons a polygon draft
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
    const SVG_START = '<svg width="13" height="12" viewBox="0 0 13 12" fill="currentColor" aria-hidden="true"><rect x="1.2" y="1.6" width="2" height="8.8" rx="0.8"/><path d="M12 1.6 L5 6 L12 10.4 Z"/></svg>';
    const SVG_FWD = '<svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" aria-hidden="true"><path d="M1.4 1.6 L6.2 6 L1.4 10.4 Z"/><path d="M6.6 1.6 L11.4 6 L6.6 10.4 Z"/></svg>';
    const SVG_END = '<svg width="13" height="12" viewBox="0 0 13 12" fill="currentColor" aria-hidden="true"><path d="M1 1.6 L8 6 L1 10.4 Z"/><rect x="9.8" y="1.6" width="2" height="8.8" rx="0.8"/></svg>';
    const bar = document.createElement('div');
    bar.className = 'sl-panel';
    bar.style.cssText = 'top:auto;left:50%;transform:translateX(-50%);bottom:20px;display:flex;align-items:center;gap:14px;padding:12px 18px;width:min(900px,calc(100vw - 440px));overflow:visible';
    bar.innerHTML = `
      <span id="pb-controls" style="display:flex;flex:1;align-items:center;gap:14px">
      <div style="display:flex;gap:6px">
        <button id="pb-start" class="sl-tbtn" title="to the start (t=0) — where editing lives">${SVG_START}</button>
        <button id="pb-back" class="sl-tbtn" title="step back 0.5s">${SVG_BACK}</button>
        <button id="pb-play" class="sl-tbtn sl-tbtn-pri">${SVG_PLAY}</button>
        <button id="pb-fwd" class="sl-tbtn" title="step forward 0.5s">${SVG_FWD}</button>
        <button id="pb-end" class="sl-tbtn" title="to the end">${SVG_END}</button>
      </div>
      <span style="flex:1;position:relative;display:block">
        <input id="pb-slider" type="range" min="0" max="600" value="0">
        <span id="pb-ticks" style="position:absolute;left:0;right:0;top:-11px;height:8px;pointer-events:none"></span>
      </span>
      <span id="pb-time" style="font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;color:#c4d2e6;min-width:84px;text-align:right">0.0 / 10.0s</span>
      </span>`;
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
        // fit into the USABLE viewport, not the raw one — the left bar (and
        // a right panel, when up) occlude the stage, and a "fitted" boat
        // under a panel is not in view (owner: Rule 10 opened with B hidden)
        const insL = 310;
        const insR = (right.style.display !== 'none' || ump.style.display !== 'none') ? 340 : 20;
        const insT = 20, insB = 90;   // transport / zoom cluster strip
        const uw = Math.max(200, ov.width - insL - insR);
        const uh = Math.max(200, ov.height - insT - insB);
        const z = Math.min(1.5, Math.min(uw / Math.max(200, (x1 - x0) * 1.15),
                                         uh / Math.max(200, (y1 - y0) * 1.15)));
        // place the content centre at the usable area's centre
        LAB.cam.x = (x0 + x1) / 2 - ((insL + uw / 2) - ov.width / 2) / z;
        LAB.cam.y = (y0 + y1) / 2 - ((insT + uh / 2) - ov.height / 2) / z;
        setZoom(z);   // fit frames the scene, never magnifies past 150%
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
        // during edit, so their trails just smear the stage. The wake SLOT is
        // exactly the right layer for the hull-colour track lines instead —
        // after the swell, below every water effect and below the fleet
        // (owner ruling: paths under boats and water effects) — and drawing
        // them in world space makes their width scale with zoom
        window.drawWakes = (ctx) => drawLabTracks(ctx);
        // disturbed air: not visualized, still COMPUTED (owner ruling) — the
        // wind-shadow physics (badAirIntensity, the AI's dirty-air escape)
        // lives elsewhere and keeps running. ⚠️ render-only on purpose:
        // updateTurbulence also keeps running because its seeded
        // Math.random draws are part of the pinned stream — silencing it
        // would shift every recorded verdict
        window.drawDisturbedAir = () => { };
        // …and the wake's foam bubbles (the 'wake' particle family). Spawned
        // off fxRand — the ISOLATED fx stream, not the pinned seeded one —
        // so filtering them cannot shift a verdict. Wind streaks and current
        // particles stay: those are pressure/flow cues, not wake.
        const _cp = window.createParticle;
        window.createParticle = function (x, y, type, props) {
            if (type === 'wake' || type === 'wake-wave' || type === 'mark-wake') return;
            return _cp(x, y, type, props);
        };
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
        // boats carry NO race places on this page — and the name pills draw
        // on the full-res OVERLAY, not here: zoomed in, the game canvas is a
        // low-res backing store stretched up by CSS, so canvas text goes
        // blurry exactly when the user leans in (owner bug report)
        window.drawBoatIndicator = function () { };
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
                // the dirty association at boot is decided SEMANTICALLY, not
                // by a stored string: earlier builds persisted the serialized
                // saved-state in the draft (_saved), but the doc format keeps
                // evolving — any snapshot from an older build could never
                // byte-match a freshly generated currentDoc, so SAVE lit on
                // every open. Truth: clean iff the restored scene matches its
                // own library entry (sorted keys, legacy fields normalized);
                // the snapshot is regenerated in the CURRENT format.
                LAB.savedJSON = null;
                const nm = (d.name || '').trim();
                const lib = store();
                if (nm && lib[nm]) {
                    const cur = JSON.parse(JSON.stringify({ name: nm, ...sceneObj() }));
                    if (JSON.stringify(canonDoc(cur)) === JSON.stringify(canonDoc({ name: nm, ...lib[nm] }))) {
                        LAB.savedJSON = JSON.stringify({ name: nm, ...sceneObj() });
                    } else {
                        console.info(`[lab] SAVE lit on open: the restored draft differs from the saved “${nm}” — DISCARD restores the saved version.`);
                    }
                } else if (nm) {
                    console.info(`[lab] SAVE lit on open: “${nm}” is not in the library (never saved under this name).`);
                }
                LAB._loading = false;
                select(null);
            }
        } catch (e) { LAB._loading = false; }
        restoreLibHandle();
        refreshSaveBtn();
        pushHistIfChanged();   // the undo baseline: where the page opened
        dismissCover();
    }

    // ── objects ────────────────────────────────────────────────────────
    function invalidate() {
        LAB.rec = null; LAB.recs = {}; LAB.playing = false; LAB.frame = 0;
        LAB.assertResults = null;
        if (typeof renderAsserts === 'function' && LAB.ready) evaluateAsserts();
        if (LAB.mode !== 'edit') LAB.mode = 'edit';
        pbPlay.innerHTML = SVG_PLAY;
        pbSlider.value = 0;
        pbTicks.innerHTML = '';
        // an invalidating edit IS editing: the mode pair follows suit and
        // the transport leaves until SIMULATE is chosen again
        if (LAB.ready && LAB.uiMode === 'sim') setUIMode('edit');
        saveDraft();
    }
    // the working scene survives a reload: every edit stores a draft, boot
    // restores it. Debounced a beat so drag storms don't hammer storage.
    let _draftT = null;
    function saveDraft() {
        if (!LAB.ready || LAB._loading) return;
        refreshSaveBtn();   // immediate — only the storage write is debounced
        clearTimeout(_draftT);
        _draftT = setTimeout(() => {
            try {
                localStorage.setItem(STORE_KEY + '_draft', JSON.stringify({
                    name: (ui.querySelector('#lab-name').value || '').trim(),
                    ...sceneObj() }));
            } catch (e) { }
            pushHistIfChanged();   // history coalesces on the same quiet beat
        }, 400);
    }

    // ── UNDO / REDO: snapshot history over the DOCUMENT (everything that
    // saves — scene, plans, goals, seeds, asserts, name, duration, wind).
    // Snapshots are captured on saveDraft's 400ms quiet beat, so a drag
    // storm coalesces into one entry; restoring is just loadScene, and the
    // recording/selection reset like any other edit. ⌘Z / ⌘⇧Z / ⌘Y.
    const hist = [];
    let histIx = -1;
    function pushHistIfChanged() {
        const s = currentDoc();
        if (hist[histIx] === s) return;
        hist.length = histIx + 1;
        hist.push(s);
        if (hist.length > 100) hist.shift();
        histIx = hist.length - 1;
    }
    function applyHist(s) {
        const d = JSON.parse(s);
        LAB._loading = true;
        loadScene(d);
        ui.querySelector('#lab-name').value = d.name || '';
        LAB._loading = false;
        select(null);
        refreshSaveBtn();
        saveDraft();   // draft follows; the capture no-ops (state == hist[histIx])
    }
    function undo() { if (histIx > 0) { histIx--; applyHist(hist[histIx]); } }
    function redo() { if (histIx < hist.length - 1) { histIx++; applyHist(hist[histIx]); } }
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
        // default = the first unused letter (deleting A then adding must not
        // mint a second B); the hull color rides the letter so A is always
        // Blue, B always Red, … regardless of add/delete history
        const used = new Set(LAB.boats.filter(b => b !== lb).map(b => b.bot._defLetter || b.bot.name));
        let li = 0;
        while (li < 25 && used.has(String.fromCharCode(65 + li))) li++;
        lb._defName = String.fromCharCode(65 + li);
        lb.bot._defLetter = lb._defName;
        const cfg = {
            name: lb._defName,
            hull: LAB_HULLS[li % LAB_HULLS.length],
            sail: '#ffffff',
            cockpit: '#c9cdd2',
            spinnaker: LAB_HULLS[li % LAB_HULLS.length],
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
        // legacy circle-ish sand: still the loader for old {x,y,r} docs
        R = R || 90;
        return addSandPoly(sandVerts(wx, wy, R));
    }
    // objects are POLYGONS (owner): authored point by point. The engine
    // island carries the vertices; x/y/radius are its broad-phase circle,
    // kept in sync as vertices move.
    // hidden: the engine island renderer needs baked art this synthetic shape
    // doesn't have; the overlay draws the sand. Collisions/rule 19/avoidance
    // still see it — they don't check `hidden`.
    function addSandPoly(pts) {
        const isl = { x: 0, y: 0, radius: 1, vertices: pts.map(p => ({ x: p.x, y: p.y })),
                      isFloe: false, awash: false, hidden: true, labSand: true };
        (window.state.course.islands = window.state.course.islands || []).push(isl);
        const s = { isl, x: 0, y: 0, r: 1 };
        recomputeSand(s);
        LAB.sands.push(s);
        select({ kind: 'sand', ref: s });
        invalidate();
        return s;
    }
    function recomputeSand(s) {
        const vs = s.isl.vertices;
        let cx = 0, cy = 0;
        for (const v of vs) { cx += v.x; cy += v.y; }
        cx /= vs.length; cy /= vs.length;
        let r = 30;
        for (const v of vs) r = Math.max(r, Math.hypot(v.x - cx, v.y - cy));
        s.x = s.isl.x = cx; s.y = s.isl.y = cy;
        s.r = s.isl.radius = r;
    }
    function addLine(wx, wy, half) {
        half = half || 150;
        const ln = { x1: wx - half, y1: wy, x2: wx + half, y2: wy };
        LAB.lines.push(ln);
        select({ kind: 'line', ref: ln, part: 0 });
        invalidate();
        return ln;
    }
    // drag anchor for a sand body grab: everything relative to the GRAB
    // POINT and the shape at mousedown, so translate doesn't snap the
    // centroid to the cursor and rotate/scale are smooth from the first
    // pixel (owner: "kind of works but needs improvement")
    function sandGrab(s, wx, wy) {
        return {
            verts: s.isl.vertices.map(v => ({ x: v.x, y: v.y })),
            cx: s.x, cy: s.y, r0: s.r,
            gx: wx, gy: wy,
            a0: Math.atan2(wy - s.y, wx - s.x),
            d0: Math.max(20, Math.hypot(wx - s.x, wy - s.y)),
        };
    }
    function closeSandDraft() {
        const draft = LAB.sandDraft;
        LAB.sandDraft = null;
        if (draft && draft.length >= 3) addSandPoly(draft);
        // fewer than 3 points closes to nothing — a degenerate polygon is
        // not an island
    }
    function moveObj(sel, wx, wy) {
        if (sel.kind === 'goalpt') { sel.ref.x = wx; sel.ref.y = wy; }
        else if (sel.kind === 'sandvert') {
            const v = sel.ref.isl.vertices[sel.vi];
            v.x = wx; v.y = wy;
            recomputeSand(sel.ref);
        }
        else if (sel.kind === 'boat') { sel.ref.x = wx; sel.ref.y = wy; }
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
        if (s.kind === 'mark') return markName(s.ref);
        if (s.kind === 'sand') return sandName(s.ref);
        return lineName(s.ref);
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
            // identities are STABLE on delete (custom names must survive);
            // the freed letter is simply available to the next added boat
            // assertions address boats by index: drop rows that named the
            // deleted boat, slide the rest down (who === -1 "nobody" is safe:
            // this only runs for a found index, i >= 0)
            if (i >= 0) {
                const BK = { penalty: ['who'], row: ['of', 'over'], clear: ['a', 'b'], tack: ['who'], goals: ['who'], proper: ['who'] };
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

    function pointInPoly(x, y, vs) {
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            if ((vs[i].y > y) !== (vs[j].y > y)
                && x < (vs[j].x - vs[i].x) * (y - vs[i].y) / (vs[j].y - vs[i].y) + vs[i].x) inside = !inside;
        }
        return inside;
    }
    function pick(wx, wy) {
        // the selected boat's WAYPOINT pips are draggable (owner ruling) —
        // they render on top, so they pick first. Only where they're visible:
        // authoring (edit mode, or paused at the start of a recording).
        // Mark/gate goal pips need nothing here: they sit ON their objects,
        // whose own picks (and drags) already move the goal with them.
        const authoring = LAB.mode === 'edit' || LAB.frame === 0;
        // the selected sand's VERTEX handles pick first (they render on top);
        // dragging one reshapes the polygon without touching the selection
        if (authoring && LAB.sel && LAB.sel.kind === 'sand') {
            const s = LAB.sel.ref, r = 12 / LAB.zoom;
            for (let vi = 0; vi < s.isl.vertices.length; vi++) {
                const v = s.isl.vertices[vi];
                if (Math.hypot(wx - v.x, wy - v.y) < r) return { kind: 'sandvert', ref: s, vi };
            }
        }
        if (authoring && LAB.sel && LAB.sel.kind === 'boat' && LAB.sel.ref.goals) {
            const lb = LAB.sel.ref;
            const r = 14 / LAB.zoom;
            for (const g of lb.goals) {
                if (g.type !== 'point') continue;
                if (Math.hypot(wx - g.x, wy - g.y) < r) return { kind: 'goalpt', ref: g, lb };
            }
        }
        for (const ln of LAB.lines) {
            if (Math.hypot(wx - ln.x1, wy - ln.y1) < 30) return { kind: 'line', ref: ln, part: 1 };
            if (Math.hypot(wx - ln.x2, wy - ln.y2) < 30) return { kind: 'line', ref: ln, part: 2 };
        }
        for (const lb of LAB.boats) if (Math.hypot(wx - lb.bot.x, wy - lb.bot.y) < 45) return { kind: 'boat', ref: lb };
        for (const m of LAB.marks) if (Math.hypot(wx - m.x, wy - m.y) < 30) return { kind: 'mark', ref: m };
        for (const s of LAB.sands) if (pointInPoly(wx, wy, s.isl.vertices)) return { kind: 'sand', ref: s };
        for (const ln of LAB.lines) {
            const cx = (ln.x1 + ln.x2) / 2, cy = (ln.y1 + ln.y2) / 2;
            if (Math.hypot(wx - cx, wy - cy) < 40) return { kind: 'line', ref: ln, part: 0 };
        }
        return null;
    }

    const selName = ui.querySelector('#lab-selname');
    const objNameIn = ui.querySelector('#lab-objname');
    // renaming: boats change the RECORDING's name column (umpire, asserts),
    // so a boat rename invalidates; mark/sand/line names are cosmetic and
    // just ride the doc. Blank reverts to the default.
    objNameIn.addEventListener('input', () => {
        const s = LAB.sel;
        if (!s || s.kind === 'play') return;
        const v = objNameIn.value.trim();
        if (s.kind === 'boat') {
            s.ref.bot.name = v || s.ref._defName;
            invalidate();
        } else {
            s.ref.labName = v || undefined;
            saveDraft();
        }
        selName.textContent = (v || objNameIn.placeholder).toUpperCase();
        renderLayers();
    });
    const hdgIn = ui.querySelector('#lab-hdg'), spdIn = ui.querySelector('#lab-spd');
    const xIn = ui.querySelector('#lab-x'), yIn = ui.querySelector('#lab-y');
    // metres: the seatrials document states its 4000u beat as "800 m",
    // so 5 world units = 1 m (hull 55u = an 11 m boat — consistent)
    const UPM = 5;
    function refreshBoatXY(lb) {
        const S = LAB.stage || { x: 0, y: 0 };
        xIn.value = ((lb.x - S.x) / UPM).toFixed(1);
        yIn.value = ((lb.y - S.y) / UPM).toFixed(1);
    }
    // display names: everything can carry a custom name (owner); the
    // positional default stays the fallback and the input's placeholder.
    // Stored as labName: lab marks are CLONES of an engine course mark and
    // already carry its .name (e.g. 'Pin') — that field is not ours.
    function markName(m) { return m.labName || 'Mark ' + (LAB.marks.indexOf(m) + 1); }
    function sandName(s) { return s.labName || 'Sand ' + (LAB.sands.indexOf(s) + 1); }
    function lineName(l) { return l.labName || 'Line ' + (LAB.lines.indexOf(l) + 1); }
    const detSections = { boat: '#det-boat', mark: '#det-mark', sand: '#det-sand', line: '#det-line' };
    function select(s) {
        // no selection ('play' kind): the inspector hides. It only shows in
        // EDIT mode — SIMULATE gives the right side to Rights & Umpire.
        if (!s) s = { kind: 'play' };
        LAB.sel = s;
        right.style.display = (s.kind === 'play' || LAB.uiMode === 'sim') ? 'none' : 'block';
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
        else if (s.kind === 'mark') { header.title = markName(s.ref).toUpperCase(); header.chip = 'MARK'; header.dot = KIND_DOT.mark; }
        else if (s.kind === 'sand') { header.title = sandName(s.ref).toUpperCase(); header.chip = 'OBJECT'; header.dot = KIND_DOT.sand; }
        else if (s.kind === 'line') { header.title = lineName(s.ref).toUpperCase(); header.chip = 'LINE'; header.dot = KIND_DOT.line; }
        selName.textContent = header.title;
        // the shared NAME field: value = the custom name (blank when on the
        // default), placeholder = what blank falls back to
        if (s.kind !== 'play') {
            const def = s.kind === 'boat' ? (s.ref._defName || s.ref.bot.name)
                : s.kind === 'mark' ? 'Mark ' + (LAB.marks.indexOf(s.ref) + 1)
                : s.kind === 'sand' ? 'Sand ' + (LAB.sands.indexOf(s.ref) + 1)
                : 'Line ' + (LAB.lines.indexOf(s.ref) + 1);
            objNameIn.placeholder = def;
            objNameIn.value = s.kind === 'boat'
                ? (s.ref.bot.name === s.ref._defName ? '' : s.ref.bot.name)
                : (s.ref.labName || '');
        }
        selDot.style.display = header.dot ? 'inline-block' : 'none';
        if (header.dot) { selDot.style.background = header.dot; selDot.style.border = '1px solid rgba(255,255,255,.3)'; }
        kindChip.style.display = header.chip ? 'inline-block' : 'none';
        kindChip.textContent = header.chip;
        setGoalArm(false);   // goal placement never survives a selection change
        if (s.kind === 'boat') {
            hdgIn.value = Math.round(((s.ref.heading * DEG) % 360 + 360) % 360);
            spdIn.value = s.ref.speedKt;
            refreshBoatXY(s.ref);
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
        aiAtIn.title = 'blank = scripted to the end · 0 = AI from the start';
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
            p.textContent = 'no steps — she holds her set heading, scripted. + ADD STEP for helm orders; set Hand to AI (0 = from the start) for the AI';
            planDiv.appendChild(p);
        }
        refreshPathRow(lb);   // hand-to-AI enablement tracks the plan
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
        if (g.type === 'mark') return markName(g.ref) + ' · ' + (g.ref.side === 'starboard' ? 'stbd' : 'port');
        if (g.type === 'gate') return lineName(g.ref) + ' · through';
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
        } else if (lb.aiAtS == null) {
            // goals are the AI's — a boat never handed over won't sail them
            const w = document.createElement('div');
            w.className = 'sl-hint';
            w.style.color = '#f2c14e';
            w.textContent = 'inert: she is never handed to the AI — set Hand to AI (0 = from the start)';
            goalsDiv.appendChild(w);
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
    let assertsDiv = null;   // the assertions dialog's list while it is open
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
            LAB.seedFail = {};
            LAB.assertPer = null;
            renderAsserts();
            renderSeeds();
            if (typeof refreshTicks === 'function') refreshTicks();
            aggChip.style.display = 'none';
            return;
        }
        const per = seeds.map(s => window.ScenarioAsserts.evaluate(LAB.asserts, LAB.recs[s], { proper: LAB.recs.proper }));
        // per-seed rows, kept: the transport's tick strip marks WHERE each
        // assert failed on the watched trace
        LAB.assertPer = {};
        seeds.forEach((s, si) => { LAB.assertPer[s] = per[si]; });
        // which seeds does anything fail on — the transport dropdown reads red
        LAB.seedFail = {};
        seeds.forEach((s, si) => {
            if (per[si].some(r => r.status !== 'pass' && r.status !== 'gap')) LAB.seedFail[s] = true;
        });
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
        renderSeeds();
        const rs = LAB.assertResults;
        const okRows = rs.filter(r => r.ok === r.n).length;
        aggChip.textContent = 'ASSERTS ' + okRows + '/' + rs.length + (seeds.length > 1 ? ' · ' + seeds.length + ' SEEDS' : '');
        aggChip.className = 'sl-schip ' + (okRows === rs.length ? 'sl-schip-teal' : 'sl-schip-red');
        aggChip.style.display = 'inline-block';
        if (typeof refreshTicks === 'function') refreshTicks();
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
        // rows render only in the roomier dialog — widths scale with it
        i.style.width = Math.round(w * 1.5) + 'px'; i.title = title; i.value = val;
        i.addEventListener('change', () => { onSet(i.value.trim()); assertsChanged(); });
        return i;
    }
    const hintSpan = (txt) => { const s = document.createElement('span'); s.className = 'sl-hint'; s.textContent = txt; return s; };
    function renderAsserts() {
        const cnt = ui.querySelector('#lab-assertcount');
        if (cnt) cnt.textContent = LAB.asserts.length || '';
        ui.querySelector('#lab-assertpill').innerHTML = assertSummaryHTML();
        // the rows themselves live in the assertions dialog (owner: one
        // place) — nothing more to draw unless it is open
        if (!assertsDiv || !assertsDiv.isConnected) return;
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
            } else if (a.kind === 'proper') {
                row.appendChild(boatSel(a.who, v => a.who = v));
                row.appendChild(hintSpan('holds proper \u00b1'));
                row.appendChild(bareIn(a.tol != null ? a.tol : 10, 26, 'max deviation from her proper course (m) — 0 = exact match',
                    v => { const p = parseFloat(v); a.tol = Number.isFinite(p) && p >= 0 ? p : 10; }));
                row.appendChild(hintSpan('m'));
            } else if (a.kind === 'nocollide') {
                row.appendChild(hintSpan('no collisions \u2014 hulls never touch'));
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
                    chip.onclick = () => { if (LAB.modal) LAB.modal.close(); setUIMode('sim'); pause(); setFrame(Math.round(res.single.atS * 60)); };
                }
            } else if (res) {
                chip.className = 'sl-schip ' + (res.ok === res.n ? 'sl-schip-teal' : 'sl-schip-red');
                chip.textContent = res.ok + '/' + res.n;
                chip.title = res.ok === res.n ? 'held on every seed'
                    : `fails on seed ${res.fail.seed} — ${res.fail.why || ''} (click to watch that run)`;
                if (res.fail) {
                    chip.style.cursor = 'pointer';
                    chip.onclick = () => {
                        if (LAB.modal) LAB.modal.close();
                        setUIMode('sim');
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
    // THE ASSERTIONS DIALOG (owner: one place, roomier type): the rows with
    // their verdict chips, plus adding — the + ADD kind picker folds out
    // INSIDE the dialog because the modal system is single-slot
    function openAssertDialog() {
        const body = document.createElement('div');
        body.className = 'sl-adlg';
        body.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:520px';
        const list = document.createElement('div');
        list.style.cssText = 'overflow-y:auto;max-height:52vh;min-height:40px';
        body.appendChild(list);
        const KINDS = [   // owner's order
            ['nocollide', 'NO COLLISION', "the hulls never actually touch \u2014 the engine's own contact test, not a distance"],
            ['penalty', 'PENALTY', 'a boat is (or nobody is) penalized, optionally under a rule'],
            ['proper', 'HOLDS PROPER COURSE', 'a boat never strays from her proper-course line beyond a tolerance \u2014 0 m = exact match'],
            ['row', 'RIGHTS', 'at a time, one boat holds right of way over another'],
            ['clear', 'NEVER CLOSE', 'two boats never get closer than a distance, the whole run'],
            ['goals', 'GOALS DONE', 'a boat completes its goal list by the end'],
            ['tack', 'TACK', 'at a time, a boat is on port or starboard'],
        ];
        const addBox = document.createElement('div');
        addBox.style.cssText = 'display:none;flex-direction:column;gap:6px';
        const addBtn = document.createElement('button');
        addBtn.className = 'sl-btn';
        addBtn.style.cssText = 'flex:none;padding:10px 0';
        addBtn.textContent = '+ ADD ASSERTION';
        addBtn.onclick = () => {
            if (!LAB.boats.length) return;
            const open = addBox.style.display === 'none';
            addBox.style.display = open ? 'flex' : 'none';
            addBtn.textContent = open ? 'CANCEL' : '+ ADD ASSERTION';
        };
        for (const [kind, lbl, desc] of KINDS) {
            const b = document.createElement('button');
            b.className = 'sl-btn';
            b.style.cssText = 'flex:none;padding:10px 12px;text-align:left';
            b.innerHTML = `${lbl} <span class="sl-hint" style="letter-spacing:0;font-weight:700"> — ${desc}</span>`;
            b.onclick = () => {
                const second = LAB.boats.length > 1 ? 1 : 0;
                const def = {
                    penalty: { kind: 'penalty', who: 0 },
                    row: { kind: 'row', of: 0, over: second, t: Math.round(LAB.durationS / 2) },
                    clear: { kind: 'clear', a: 0, b: second, min: 55 },
                    tack: { kind: 'tack', who: 0, tack: 'stbd', t: Math.round(LAB.durationS / 2) },
                    goals: { kind: 'goals', who: 0 },
                    proper: { kind: 'proper', who: 0, tol: 10 },
                    nocollide: { kind: 'nocollide' },
                }[kind];
                LAB.asserts.push(def);
                addBox.style.display = 'none';
                addBtn.textContent = '+ ADD ASSERTION';
                assertsChanged();   // re-renders the rows in place
            };
            addBox.appendChild(b);
        }
        body.appendChild(addBtn);
        body.appendChild(addBox);
        assertsDiv = list;
        // attach FIRST — renderAsserts skips containers not in the DOM
        dialog('Assertions', body, [{ label: 'Close' }], { width: 600 });
        renderAsserts();
    }
    ui.querySelector('#lab-assertrow').onclick = () => openAssertDialog();
    aiAtIn.addEventListener('input', () => {
        if (LAB.sel && LAB.sel.kind === 'boat') {
            const v = aiAtIn.value.trim();
            LAB.sel.ref.aiAtS = v === '' ? null : Math.max(0, parseFloat(v) || 0);
            invalidate();
        }
    });
    hdgIn.addEventListener('input', () => { if (LAB.sel && LAB.sel.kind === 'boat') { LAB.sel.ref.heading = (parseFloat(hdgIn.value) || 0) / DEG; invalidate(); } });
    spdIn.addEventListener('input', () => { if (LAB.sel && LAB.sel.kind === 'boat') { LAB.sel.ref.speedKt = Math.max(0, parseFloat(spdIn.value) || 0); invalidate(); } });
    xIn.addEventListener('input', () => {
        if (LAB.sel && LAB.sel.kind === 'boat') {
            const S = LAB.stage || { x: 0, y: 0 };
            LAB.sel.ref.x = S.x + (parseFloat(xIn.value) || 0) * UPM;
            invalidate();
        }
    });
    yIn.addEventListener('input', () => {
        if (LAB.sel && LAB.sel.kind === 'boat') {
            const S = LAB.stage || { x: 0, y: 0 };
            LAB.sel.ref.y = S.y + (parseFloat(yIn.value) || 0) * UPM;
            invalidate();
        }
    });
    ui.querySelector('#lab-del').onclick = deleteSel;
    ui.querySelector('#lab-wind').addEventListener('input', e => { LAB.windKt = Math.max(2, parseFloat(e.target.value) || 12); invalidate(); });
    ui.querySelector('#lab-dur').addEventListener('input', e => { LAB.durationS = Math.max(2, Math.min(120, parseFloat(e.target.value) || 10)); invalidate(); });
    // ── the SEED SET: one summary row in the panel (count + verdict pill);
    // EVERYTHING else — status list, switching, add/roll, ADD ×N, CLEAR —
    // lives in the seeds dialog (owner: one place). ──────────────────────
    // seedIx -1 = the PROPER COURSE pseudo seed (always present)
    function activeSeed() {
        if (LAB.seedIx < 0) return 'proper';
        return LAB.seeds[Math.min(LAB.seedIx, LAB.seeds.length - 1)] >>> 0;
    }
    // one colour rule everywhere a seed's run shows (owner ruling, in
    // priority order): assertion FAIL red > COLLISION orange > PENALTY
    // yellow > clean white. Unrun = muted (no data yet).
    function seedStatus(s) {
        s = s >>> 0;
        if (LAB.seedFail && LAB.seedFail[s]) return 'fail';
        const rec = LAB.recs[s];
        if (!rec) return 'unrun';
        if (rec.pens.some(p => p.kind === 'contact')) return 'collision';
        if (rec.pens.length) return 'penalty';
        return 'ok';
    }
    const SEED_COLORS = { fail: '#ff8a75', collision: '#ffa14f', penalty: '#f2c14e', ok: '#eef3fb', unrun: '#66748c' };
    // OUTCOME clustering (owner: "show me the distinct behaviors"): seeds
    // whose runs END the same way group together. The signature is
    // behavioral, not positional — penalties (who/rule/when), each boat's
    // final tack + goals done + penalty count, and whether an assertion
    // failed — so metre-level trajectory jitter stays one cluster and a
    // different STORY (a duck vs a foul) splits.
    function outcomeSig(s) {
        const rec = LAB.recs[s >>> 0];
        if (!rec) return null;
        const last = rec.frames[rec.nF].boats;
        return JSON.stringify({
            pens: rec.pens.map(p => [p.boat, p.rule || p.kind || '?', Math.round(p.t)]),
            boats: last.map(b => [b.ta, b.gi || 0, b.penN || 0]),
            fail: !!(LAB.seedFail && LAB.seedFail[s >>> 0]),
        });
    }
    function outcomeSummary(sig, names) {
        const o = JSON.parse(sig);
        const bits = [];
        bits.push(o.pens.length
            ? o.pens.map(p => `${names[p[0]] || 'boat ' + p[0]} ${p[1]}@${p[2]}s`).join(', ')
            : 'no penalties');
        if (o.fail) bits.push('assert FAIL');
        return bits.join(' · ');
    }
    const SEED_TITLES = { fail: 'an assertion fails on this run', collision: 'boats collide on this run',
                          penalty: 'a penalty on this run (no collision)', ok: 'clean run', unrun: 'not run yet' };
    function removeSeed(i) {
        if (LAB.seeds.length <= 1) return;   // a scenario is at least one seed
        const s = LAB.seeds[i] >>> 0;
        LAB.seeds.splice(i, 1);
        delete LAB.recs[s];
        if (LAB.seedIx >= LAB.seeds.length) LAB.seedIx = LAB.seeds.length - 1;
        else if (LAB.seedIx > i) LAB.seedIx--;
        seedsChanged();
    }
    // THE SEEDS DIALOG — replaces the dropdowns (owner: works at 100 or
    // 1000). Same scalable pattern as the Open box: rows built per filter
    // pass, capped at 400 rendered, filter + count line — plus outcome-TIER
    // chips (fail/collision/penalty/clean) so "show me the red ones" is one
    // click at any size. Enter switches to the first match.
    function openSeedDialog() {
        const MAXROWS = 400;
        // SIMULATE mode = READ-ONLY (owner ruling): the set is what was
        // simulated — switch what you watch, but no add/remove/clear (an
        // edit would silently desync the recordings and the verdict pill)
        const readOnly = LAB.uiMode === 'sim';
        let tier = 'all';
        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:340px';
        const filterWrap = document.createElement('div');
        filterWrap.className = 'sl-inp';
        const filterIn = document.createElement('input');
        filterIn.type = 'text';
        filterIn.inputMode = 'numeric';
        filterIn.placeholder = 'Filter seeds';
        filterWrap.appendChild(filterIn);
        body.appendChild(filterWrap);
        const chips = document.createElement('div');
        chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
        body.appendChild(chips);
        const countEl = document.createElement('div');
        countEl.className = 'sl-hint';
        countEl.style.padding = '0 2px';
        body.appendChild(countEl);
        const list = document.createElement('div');
        list.style.cssText = 'overflow-y:auto;max-height:46vh;min-height:40px';
        body.appendChild(list);
        let firstMatch = null;
        let dlg = null;
        const pick = (i) => { dlg.close(); setActiveSeed(i); };
        const TIERS = [['all', 'ALL'], ['fail', 'FAIL'], ['collision', 'COLLISION'], ['penalty', 'PENALTY'], ['ok', 'CLEAN'], ['unrun', 'UNRUN']];
        const rebuild = () => {
            // tier chips with live counts (zero tiers hidden, ALL always)
            const counts = { all: LAB.seeds.length, fail: 0, collision: 0, penalty: 0, ok: 0, unrun: 0 };
            for (const s of LAB.seeds) counts[seedStatus(s)]++;
            chips.innerHTML = '';
            for (const [key, lbl] of TIERS) {
                if (key !== 'all' && !counts[key]) { if (tier === key) tier = 'all'; continue; }
                const c = document.createElement('span');
                c.className = 'sl-schip';
                c.style.cssText = 'cursor:pointer;font-variant-numeric:tabular-nums;'
                    + `color:${key === 'all' ? '#8fa3bd' : SEED_COLORS[key]};`
                    + (tier === key ? 'background:rgba(47,107,255,.28)' : 'background:rgba(255,255,255,.06)');
                c.textContent = `${lbl} ${counts[key]}`;
                c.onclick = () => { tier = key; rebuild(); };
                chips.appendChild(c);
            }
            // rows: tier + substring filter, numeric order, capped
            const q = filterIn.value.trim();
            const matches = LAB.seeds.map((s, i) => [s >>> 0, i])
                .filter(([s]) => (tier === 'all' || seedStatus(s) === tier) && (!q || String(s).includes(q)))
                .sort((a, b) => a[0] - b[0]);
            firstMatch = matches.length ? matches[0][1] : null;
            list.innerHTML = '';
            // PROPER COURSE is always first: each boat alone, no interactions
            {
                const on = LAB.seedIx === -1;
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:7px;cursor:pointer;'
                    + 'font:800 11px Archivo,system-ui,sans-serif;'
                    + (on ? 'background:rgba(47,107,255,.25)' : '');
                const lab = document.createElement('span');
                lab.innerHTML = '<span style="font-style:italic;color:#8fd8d0">PROPER COURSE</span>';
                lab.style.cssText = 'flex:1;text-align:center';
                lab.title = 'each boat alone \u2014 no other boats, no fouls (RRS proper course)';
                row.appendChild(lab);
                if (on) {
                    const a = document.createElement('span');
                    a.className = 'sl-schip sl-schip-blue';
                    a.textContent = 'WATCHING';
                    row.appendChild(a);
                }
                row.onmouseenter = () => { if (!on) row.style.background = 'rgba(255,255,255,.07)'; };
                row.onmouseleave = () => { if (!on) row.style.background = ''; };
                row.onclick = () => { dlg.close(); setActiveSeed(-1); };
                list.appendChild(row);
            }
            // group by OUTCOME: one header per distinct behavior, biggest
            // first; unrun seeds gather at the bottom unclustered
            const names = LAB.boats.map(lb => lb.bot.name);
            const clusters = new Map();
            for (const [s, i] of matches.slice(0, MAXROWS)) {
                const sig = outcomeSig(s) || 'unrun';
                if (!clusters.has(sig)) clusters.set(sig, []);
                clusters.get(sig).push([s, i]);
            }
            const ordered = [...clusters.entries()].sort((a, b) =>
                (a[0] === 'unrun') - (b[0] === 'unrun') || b[1].length - a[1].length);
            const manyClusters = ordered.length > 1 || (ordered[0] && ordered[0][0] !== 'unrun');
            let cn = 0;
            const emitHeader = (sig, group) => {
                if (!manyClusters) return;
                const h = document.createElement('div');
                h.className = 'sl-hint';
                h.style.cssText = 'padding:8px 12px 3px;letter-spacing:.08em';
                h.textContent = sig === 'unrun' ? `NOT RUN · ${group.length}`
                    : `OUTCOME ${++cn} · ${group.length} seed${group.length === 1 ? '' : 's'} · ${outcomeSummary(sig, names).toUpperCase()}`;
                list.appendChild(h);
            };
            const emitRow = ([s, i]) => {
                const st = seedStatus(s);
                const on = i === LAB.seedIx;
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:7px;cursor:pointer;'
                    + 'font:800 12px Archivo,system-ui,sans-serif;font-variant-numeric:tabular-nums;'
                    + (on ? 'background:rgba(47,107,255,.25)' : '');
                row.onmouseenter = () => { if (!on) row.style.background = 'rgba(255,255,255,.07)'; };
                row.onmouseleave = () => { if (!on) row.style.background = ''; };
                const num = document.createElement('span');
                num.textContent = s;
                num.style.cssText = 'flex:1;color:' + SEED_COLORS[st];
                num.title = SEED_TITLES[st];
                row.appendChild(num);
                if (on) {
                    const a = document.createElement('span');
                    a.className = 'sl-schip sl-schip-blue';
                    a.textContent = 'WATCHING';
                    row.appendChild(a);
                }
                if (!readOnly) {
                    const x = document.createElement('span');
                    x.innerHTML = '&#10005;';
                    x.style.cssText = 'font-size:10px;color:#66748c;cursor:pointer;padding:0 2px';
                    x.title = 'remove this seed from the set';
                    x.onmouseenter = () => x.style.color = '#ff8a75';
                    x.onmouseleave = () => x.style.color = '#66748c';
                    x.onclick = (e) => { e.stopPropagation(); removeSeed(i); rebuild(); };
                    row.appendChild(x);
                }
                row.onclick = () => pick(i);
                list.appendChild(row);
            };
            for (const [sig, group] of ordered) {
                emitHeader(sig, group);
                group.forEach(emitRow);
            }
            const nOut = ordered.filter(([sig]) => sig !== 'unrun').length;
            countEl.textContent = !matches.length ? 'nothing matches'
                : matches.length > MAXROWS ? `showing ${MAXROWS} of ${matches.length} \u00b7 refine the filter`
                : `${matches.length} of ${LAB.seeds.length}`
                  + (nOut ? ` \u00b7 ${nOut} distinct outcome${nOut === 1 ? '' : 's'}` : '')
                  + ' \u00b7 Enter watches the first';
        };
        filterIn.addEventListener('input', rebuild);
        filterIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && firstMatch != null) pick(firstMatch); });
        // the set's TOOLS live here too (owner: one place): typed-or-rolled
        // add, ADD ×N randoms, and CLEAR with an in-button confirm (a nested
        // confirm dialog would fight the single-modal system). Read-only
        // (SIMULATE mode) shows none of them — just a hint.
        if (readOnly) {
            const ro = document.createElement('div');
            ro.className = 'sl-hint';
            ro.style.cssText = 'flex:none;padding:2px 2px 0';
            ro.textContent = 'viewing only — EDIT mode to change the set';
            body.appendChild(ro);
        }
        const tools = document.createElement('div');
        tools.style.cssText = 'display:flex;gap:6px;flex:none';
        if (readOnly) tools.style.display = 'none';
        tools.innerHTML = `
          <div class="sl-inp" style="flex:1"><input id="sd-add" type="text" inputmode="numeric" placeholder="type a seed, or just roll"></div>
          <button id="sd-roll" class="sl-tbtn" title="add it — blank rolls a random seed">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="5" r="1.4"/><circle cx="11" cy="5" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="5" cy="11" r="1.4"/><circle cx="11" cy="11" r="1.4"/></svg>
          </button>`;
        body.appendChild(tools);
        const tools2 = document.createElement('div');
        tools2.style.cssText = 'display:flex;gap:6px;flex:none';
        if (readOnly) tools2.style.display = 'none';
        tools2.innerHTML = `
          <div class="sl-inp" style="width:52px;flex:none"><input id="sd-n" type="text" inputmode="numeric" value="10" title="how many random seeds ADD rolls"></div>
          <button id="sd-addn" class="sl-btn" title="add N random seeds to the set">ADD &times;N</button>
          <button id="sd-clear" class="sl-btn" style="flex:none;padding:9px 12px;color:#ff8a75" title="reset the set to the single default seed">CLEAR</button>`;
        body.appendChild(tools2);
        const addIn = tools.querySelector('#sd-add');
        tools.querySelector('#sd-roll').onclick = () => {
            const typed = parseInt(addIn.value.trim(), 10);
            const s = (Number.isFinite(typed) ? typed : rollSeed()) >>> 0;
            addIn.value = '';
            if (LAB.seeds.some(x => (x >>> 0) === s)) return;   // a set, not a list
            LAB.seeds.push(s);
            LAB.seedIx = LAB.seeds.length - 1;
            seedsChanged();
            rebuild();
        };
        addIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') tools.querySelector('#sd-roll').onclick(); });
        tools2.querySelector('#sd-addn').onclick = () => {
            const nIn = tools2.querySelector('#sd-n');
            const n = Math.max(1, Math.min(200, parseInt(nIn.value, 10) || 10));
            nIn.value = n;
            const have = new Set(LAB.seeds.map(x => x >>> 0));
            for (let k = 0; k < n; k++) {
                let s = rollSeed();
                while (have.has(s)) s = rollSeed();
                have.add(s);
                LAB.seeds.push(s);
            }
            seedsChanged();
            rebuild();
        };
        const clearBtn = tools2.querySelector('#sd-clear');
        let clearArmT = null;
        const disarmClear = () => {
            clearTimeout(clearArmT);
            delete clearBtn.dataset.armed;
            clearBtn.classList.remove('sl-btn-red');
            clearBtn.textContent = 'CLEAR';
        };
        clearBtn.onclick = () => {
            if (LAB.seeds.length <= 1) return;
            if (clearBtn.dataset.armed) {
                LAB.seeds = [0x9e3779b9]; LAB.seedIx = 0; LAB.recs = {};
                seedsChanged();
                disarmClear();
                rebuild();
            } else {
                clearBtn.dataset.armed = '1';
                clearBtn.classList.add('sl-btn-red');
                clearBtn.textContent = 'SURE?';
                clearArmT = setTimeout(disarmClear, 2500);
            }
        };
        rebuild();
        dlg = dialog('Seeds', body, [{ label: 'Close' }]);
        setTimeout(() => filterIn.focus(), 50);
    }
    // the verdict PILL (owner mockup): "8/10 PASS" — green when everything
    // passes, red when anything fails, muted while unrun
    const verdictPill = (c, txt, title) =>
        `<span style="display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;`
        + `border:1.5px solid ${c};color:${c};background:rgba(0,0,0,.28);`
        + `font-weight:800;font-size:10px;letter-spacing:.06em;font-variant-numeric:tabular-nums" title="${title}">${txt}</span>`;
    // seeds: per-tier breakdown lives in the tooltip
    function seedSummaryHTML() {
        const counts = { fail: 0, collision: 0, penalty: 0, ok: 0, unrun: 0 };
        for (const s of LAB.seeds) counts[seedStatus(s)]++;
        const n = LAB.seeds.length;
        if (counts.unrun) return verdictPill('#66748c', `${n - counts.unrun}/${n} RUN`,
            `${counts.unrun} seed(s) not simulated yet`);
        const pass = n - counts.fail;
        const detail = [`${pass} pass`, counts.fail && `${counts.fail} fail`,
            counts.collision && `${counts.collision} with a collision`,
            counts.penalty && `${counts.penalty} with a penalty (no collision)`]
            .filter(Boolean).join(' · ');
        return verdictPill(pass === n ? '#7ed491' : '#ff8a75', `${pass}/${n} PASS`, detail);
    }
    // assertions: a row counts as passing only when it holds on EVERY seed
    function assertSummaryHTML() {
        const n = LAB.asserts.length;
        if (!n) return '';
        const rs = LAB.assertResults;
        if (!rs) return verdictPill('#66748c', `–/${n} PASS`,
            'run the scenario to judge (every seed in the set)');
        const ok = rs.filter(r => r.ok === r.n).length;
        return verdictPill(ok === n ? '#7ed491' : '#ff8a75', `${ok}/${n} PASS`,
            ok === n ? 'every assertion holds on every seed'
                     : `${n - ok} assertion(s) failing somewhere in the seed set`);
    }
    // the transport appears only in SIMULATE mode once every seed (and the
    // proper course) has a recording (owner ruling) — while simulating, and
    // in EDIT mode, there is no bar at all
    function refreshTransport() {
        const complete = LAB.seeds.length && LAB.seeds.every(s => LAB.recs[s >>> 0]) && !!LAB.recs.proper;
        bar.style.display = (LAB.uiMode === 'sim' && complete) ? 'flex' : 'none';
    }
    function renderSeeds() {
        refreshTransport();   // renderSeeds runs at every rec/seed chokepoint
        // collapsed header: just the count (+ outcome dots), chevron to expand
        ui.querySelector('#lab-seedcount').textContent = LAB.seeds.length;
        ui.querySelector('#lab-seeddots').innerHTML = seedSummaryHTML();
        const act = activeSeed();
        const proper = act === 'proper';
        const actLabel = proper ? '<span style="font-style:italic">PROPER COURSE</span>' : String(act);
        const actColor = proper ? '#8fd8d0' : SEED_COLORS[seedStatus(act)];
        const actTitle = proper ? 'each boat alone \u2014 no other boats, no fouls (RRS proper course)' : SEED_TITLES[seedStatus(act)];
        // the SIMULATE summary card: verdict pill + the seed selector (the
        // play bar carries no seed control \u2014 this is its home)
        ui.querySelector('#lab-sum-pass').innerHTML = seedSummaryHTML();
        const sBtn = ui.querySelector('#lab-sum-seed');
        sBtn.innerHTML = `<span style="color:${actColor}">${actLabel}</span>`
            + '<span style="color:#66748c;font-size:9px">&#9662;</span>';
        sBtn.title = actTitle + ' \u2014 open the seed list';
    }
    // the slider's tick strip for the WATCHED trace: penalty ▼ marks, plus a
    // red A<n> wherever assertion row n FAILS on this seed (owner) — the
    // marker sits at the failure's own timestamp
    function refreshTicks() {
        const act = activeSeed();
        const rec = LAB.recs[act];
        if (!rec) { pbTicks.innerHTML = ''; return; }
        let html = rec.ticks.map(f =>
            `<span style="position:absolute;left:${(100 * f / rec.nF).toFixed(1)}%;top:0;transform:translateX(-50%);color:#ff8a75;font-size:8px" title="penalty">&#9660;</span>`).join('');
        const per = act !== 'proper' && LAB.assertPer && LAB.assertPer[act];
        if (per) {
            const names = LAB.boats.map(lb => lb.bot.name);
            per.forEach((r, k) => {
                if (r.status !== 'fail' || r.atS == null) return;
                const label = window.ScenarioAsserts ? window.ScenarioAsserts.label(LAB.asserts[k], names) : '';
                html += `<span style="position:absolute;left:${(100 * Math.min(rec.nF, Math.round(r.atS * 60)) / rec.nF).toFixed(1)}%;`
                    + 'top:-10px;transform:translateX(-50%);color:#ff8a75;font:800 9px Archivo,system-ui,sans-serif;'
                    + `letter-spacing:.02em;pointer-events:auto;cursor:default" title="FAIL ${label} — ${r.why || ''}">A${k + 1}</span>`;
            });
        }
        pbTicks.innerHTML = html;
    }
    // switching seeds swaps CACHED recordings — no resim; the playhead time
    // carries across so the same moment can be compared between seeds
    function setActiveSeed(i) {
        LAB.seedIx = i < 0 ? -1 : Math.min(LAB.seeds.length - 1, i);
        const rec = LAB.recs[activeSeed()];
        if (rec) {
            LAB.rec = rec;
            pbSlider.max = rec.nF;
            LAB.frame = Math.min(LAB.frame, rec.nF);
        }
        refreshTicks();
        renderSeeds();
    }
    // ONE way in: the summary row (and the SIMULATE card's selector) open
    // the seeds dialog, which holds the list AND the tools
    ui.querySelector('#lab-seedrow').onclick = () => openSeedDialog();
    ui.querySelector('#lab-sum-seed').onclick = () => openSeedDialog();
    // seed edits change the DOC (dirty + draft) and drop only what they must:
    // removed seeds lose their cache; survivors keep theirs
    function seedsChanged() {
        LAB.assertResults = null;
        setActiveSeed(LAB.seedIx);
        saveDraft();
        if (Object.keys(LAB.recs).length) evaluateAsserts();
        else { LAB.rec = null; evaluateAsserts(); }
    }
    function rollSeed() { return (Math.random() * 4294967296) >>> 0; }
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
            // ⚠️ re-assert the LAB INVARIANT after the canonical-scalar
            // restore above: the canon Boat's raceState carries leg 0, and
            // leg 0 turns the whole START machinery on (the strategic
            // leg-0 close-hauled drive is wd ± 0.75 rad — measured: every
            // AI boat settled at exactly TWA 43° instead of sailing her
            // fetchable course). Leg 2 is also what lets rule 18's zone
            // latch arm at lab marks.
            bt.raceState.leg = 2;
            bt.raceState.finished = false;
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
    function simulateSeed(SEED, soloLb) {
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
            // PROPER COURSE runs are SOLO: every other boat leaves the water
            // for this burst, so nothing can interact with her
            if (soloLb && lb !== soloLb) {
                bt.raceState.finished = true;
                bt.x = -1e6; bt.y = -1e6; bt.speed = 0;
                bt.velocity = { x: 0, y: 0 };
                continue;
            }
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
            // start IN HER GROOVE: the fresh helm's constructor aims NORTH
            // (targetHeading 0) — measured as every boat pinching toward the
            // wind for the opening 0.2s. Aim her at the authored heading so
            // the pre-decision hold sails HER course…
            bt.controller.targetHeading = lb.heading;
            // …but keep the SEEDED 0-0.2s decision-clock phase: it is the
            // seed set's main behavioral variation (zeroing it here made all
            // ten seeds bit-identical — owner caught it). Harmless now that
            // the hold aims at the authored heading, deterministic per seed.
            bt.controller.updateTimer = Math.random() * 0.2;
            // the rules module's per-boat clocks (tack-flip times feed the
            // rule-15 acquisition test) must not leak between runs either
            if (window.Rules) {
                if (window.Rules._tackFlipT) delete window.Rules._tackFlipT[bt.id];
                if (window.Rules._lastTack) delete window.Rules._lastTack[bt.id];
            }
            const c = bt.controller;
            // per-run goal state: fresh queue every simulation
            lb._goalIdx = 0; lb._sweep = null; lb._gSide = null; lb._goalOut = null;
            // DEFAULT = SCRIPTED (owner ruling): every boat holds her set
            // heading and course unless handed to the AI. `Hand to AI at`
            // is the one switch — blank/never = scripted the whole run,
            // 0 = AI from the very start, t = handoff mid-run. Plan steps
            // just refine the scripted phase (empty plan = hold course).
            const scripted = lb.aiAtS !== 0;
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
            // solo burst over: the parked rivals rejoin the stage
            if (soloLb) for (const lb of LAB.boats) {
                if (lb === soloLb) continue;
                lb.bot.raceState.finished = false;
                lb.bot.fadeTimer = 999; lb.bot.opacity = 1;
            }
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
    // PROPER COURSE (RRS definition: "the course a boat would sail ... in
    // the absence of the other boats"): every scenario's ever-present pseudo
    // seed. Each boat simulates ALONE on a fixed canonical seed, and the
    // solo recordings composite into one playback — by construction there
    // are no interactions, no collisions, no penalties: just each helm's
    // default line (scripted plan, or AI with her goals).
    function simulateProper() {
        const solos = LAB.boats.map(lb => simulateSeed(0x9e3779b9, lb));
        const nF = solos.length ? solos[0].nF : Math.round(LAB.durationS * 60);
        const frames = [];
        for (let f = 0; f <= nF; f++) {
            frames.push({
                boats: LAB.boats.map((lb, i) => {
                    const b = { ...solos[i].frames[f].boats[i] };
                    b.pen = false; b.penN = 0;   // a proper course carries no fouls
                    return b;
                }),
                pairs: [],
            });
        }
        return { frames, ticks: [], nF, pens: [],
            names: LAB.boats.map(lb => lb.bot.name),
            goalCounts: LAB.boats.map(lb => (lb.goals || []).length),
            seed: 'proper' };
    }
    function runAllSync() {
        for (const s of LAB.seeds.map(x => x >>> 0)) {
            if (!LAB.recs[s]) LAB.recs[s] = simulateSeed(s);
        }
        if (!LAB.recs.proper) LAB.recs.proper = simulateProper();
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
    // the async batch: SIMULATING card up, one painted frame per seed burst
    function runBatch(after) {
        simCover.style.display = 'flex';
        const prog = simCover.querySelector('#sim-prog');
        const total = LAB.seeds.map(s => s >>> 0).filter(s => !LAB.recs[s]).length;
        let done = 0;
        const step = () => {
            let s = LAB.seeds.map(x => x >>> 0).find(x => !LAB.recs[x]);
            if (s == null && !LAB.recs.proper) s = 'proper';
            if (s == null) {
                simCover.style.display = 'none';
                setActiveSeed(LAB.seedIx);
                evaluateAsserts();
                if (after) after();
                return;
            }
            prog.textContent = total > 1 ? `seed ${++done} / ${total}` : '';
            requestAnimationFrame(() => setTimeout(() => {
                LAB.recs[s] = s === 'proper' ? simulateProper() : simulateSeed(s);
                step();
            }, 15));
        };
        step();
    }
    // SIMULATE runs the set and STOPS at the start (owner ruling): the stage
    // lands paused at t=0 — which is the setup view — with the umpire panel
    // reading the fresh run. Playback is the ▶ button's job.
    function simulateOnly() {
        const missing = LAB.seeds.map(s => s >>> 0).filter(s => !LAB.recs[s]);
        if (!LAB.recs.proper) missing.push('proper');
        if (!missing.length) return;
        runBatch(() => {
            LAB.mode = 'play';
            LAB.frame = 0;
            pause();
            select(null);   // a fresh run fronts Rights & Umpire
        });
    }
    function play() {
        const missing = LAB.seeds.map(s => s >>> 0).filter(s => !LAB.recs[s]);
        if (!LAB.recs.proper) missing.push('proper');
        if (missing.length) { simulateOnly(); return; }   // SPACE parity with the visible button
        if (!LAB.rec) setActiveSeed(LAB.seedIx);
        if (!LAB.rec) return;
        if (LAB.frame >= LAB.rec.nF) LAB.frame = 0;
        LAB.mode = 'play'; LAB.playing = true;
        pbPlay.innerHTML = SVG_PAUSE;
    }
    function pause() { LAB.playing = false; pbPlay.innerHTML = SVG_PLAY; }
    pbPlay.onclick = () => { if (LAB.playing) pause(); else play(); };
    // EDIT / SIMULATE — the top-of-panel mode pair (owner mockup, back by
    // request). SIMULATE = sim anything stale, then the transport; EDIT =
    // transport away, stage back to the t=0 setup. Frame-0-is-authoring
    // semantics underneath are unchanged — this is a view switch.
    function setUIMode(m) {
        LAB.uiMode = m;
        ui.querySelector('#lab-mode-edit').classList.toggle('sl-btn-pri', m === 'edit');
        ui.querySelector('#lab-mode-sim').classList.toggle('sl-btn-pri', m === 'sim');
        // in SIMULATE mode the left bar shrinks to a one-card summary (owner
        // mockup) — the full authoring stack comes back with EDIT
        ui.querySelector('#lab-editbody').style.display = m === 'sim' ? 'none' : 'block';
        ui.querySelector('#lab-summary').style.display = m === 'sim' ? 'block' : 'none';
        // the RIGHT side holds at most one bar: Rights & Umpire in SIMULATE,
        // the object inspector (when something is selected) in EDIT
        ump.style.display = m === 'sim' ? 'block' : 'none';
        right.style.display = (m === 'edit' && LAB.sel && LAB.sel.kind !== 'play') ? 'block' : 'none';
        if (m === 'sim') {
            ui.querySelector('#lab-sum-name').textContent =
                (ui.querySelector('#lab-name').value || '').trim() || 'Untitled scenario';
        }
        if (m === 'sim') {
            simulateOnly();   // no-op when the whole set is already simulated
        } else {
            pause();
            if (LAB.rec) setFrame(0);   // recordings are KEPT — just rewound
        }
        refreshTransport();   // the bar shows only when sim mode has a full set
    }
    ui.querySelector('#lab-mode-edit').onclick = () => setUIMode('edit');
    ui.querySelector('#lab-mode-sim').onclick = () => setUIMode('sim');
    setUIMode('edit');
    bar.querySelector('#pb-start').onclick = () => { if (!LAB.rec) return; pause(); setFrame(0); };
    bar.querySelector('#pb-back').onclick = () => { if (!LAB.rec) return; pause(); setFrame(LAB.frame - 30); };
    bar.querySelector('#pb-fwd').onclick = () => { if (!LAB.rec) return; pause(); setFrame(LAB.frame + 30); };
    bar.querySelector('#pb-end').onclick = () => { if (!LAB.rec) return; pause(); setFrame(LAB.rec.nF); };
    pbSlider.addEventListener('input', () => { if (!LAB.rec) { pbSlider.value = 0; return; } pause(); setFrame(+pbSlider.value); });
    // the … menu: toggles on its button, closes on any item or outside press
    ui.querySelector('#lab-more').onclick = () => {
        const m = ui.querySelector('#lab-moremenu');
        if (m.style.display === 'none') {
            // fly out to the RIGHT of the left bar, level with the button
            // (fixed positioning: the panel's overflow would clip a child)
            const panel = left.getBoundingClientRect();
            const btn = ui.querySelector('#lab-more').getBoundingClientRect();
            m.style.left = (panel.right + 10) + 'px';
            m.style.top = Math.round(btn.top) + 'px';
            m.style.display = 'block';
        } else m.style.display = 'none';
    };
    ui.querySelector('#lab-moremenu').addEventListener('click', (e) => {
        if (e.target.closest('.sl-mitem') || e.target.id === 'lab-libopen') {
            ui.querySelector('#lab-moremenu').style.display = 'none';
        }
    });
    document.addEventListener('mousedown', (e) => {
        const m = ui.querySelector('#lab-moremenu');
        if (m && m.style.display !== 'none'
            && !ui.querySelector('#lab-morewrap').contains(e.target)
            && !m.contains(e.target)) {
            m.style.display = 'none';
        }
    }, true);
    ui.querySelector('#lab-discard').onclick = () => discardChanges();
    // DELETE removes the CURRENT scenario from the library (confirmed). The
    // scene stays on stage as an unsaved doc — SAVE would re-add it.
    ui.querySelector('#lab-delete').onclick = () => {
        const nm = (nameIn.value || '').trim();
        if (!nm || !store()[nm]) return;
        confirmDialog('Delete scenario', `Delete “${nm}” from the library? This cannot be undone.`, () => {
            const l2 = store(); delete l2[nm];
            const t = loadTombs(); t.add(nm); saveTombs(t);
            if (window.SCENARIO_DOC) delete window.SCENARIO_DOC[nm];
            persistLib(l2);
            LAB.savedJSON = null;   // the doc on stage is now UNSAVED — SAVE re-adds it
            refreshSaveBtn();
        }, 'Delete');
    };
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
        // ESCAPE DISMISSES, wherever focus is (owner ruling): an open
        // dialog closes even while its filter input has focus, and the
        // … popout closes before anything else fires
        const moreMenu = document.getElementById('lab-moremenu');
        const moreOpen = moreMenu && moreMenu.style.display !== 'none';
        if (e.type === 'keydown') {
            if (typing) {
                if (e.key === 'Escape') {
                    t.blur();
                    if (LAB.modal) LAB.modal.close();
                    else if (moreOpen) moreMenu.style.display = 'none';
                    e.preventDefault();
                }
            } else if (LAB.modal) {
                if (e.key === 'Escape') { LAB.modal.close(); e.preventDefault(); }
                // any other key while a dialog is up: dead air
            } else {
                if (e.key === 'Delete' || e.key === 'Backspace') deleteSel();
                else if (e.key === 'Enter') {
                    // RETURN closes an in-progress polygon draft
                    if (LAB.armed === 'sand' && LAB.sandDraft && LAB.sandDraft.length) closeSandDraft();
                }
                else if (e.key === 'Escape') {
                    if (moreOpen) moreMenu.style.display = 'none';
                    else if (LAB.sandDraft && LAB.sandDraft.length) LAB.sandDraft = null;   // drop the draft, stay armed
                    else if (LAB.goalArm) setGoalArm(false);
                    else if (LAB.armed) setArmed(LAB.armed);
                    else select(null);
                }
                else if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { if (e.shiftKey) redo(); else undo(); }
                else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) redo();
                else if (e.key === '+' || e.key === '=') setZoom(LAB.zoom * 1.25);
                else if (e.key === '-' || e.key === '_') setZoom(LAB.zoom / 1.25);
                else if (e.key === '0') setZoom(1);
                else if (e.key === 'f' || e.key === 'F') zoomFit();
                else if (e.key === ' ') {
                    // SPACE in EDIT enters SIMULATE mode; in SIMULATE it is play/pause
                    if (LAB.uiMode !== 'sim') setUIMode('sim'); else pbPlay.onclick();
                }
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
            tags: LAB.tags.length ? [...LAB.tags] : undefined,
            asserts: LAB.asserts.length ? LAB.asserts.map(a => ({ ...a })) : undefined,
            boats: LAB.boats.map(lb => ({ x: Math.round(lb.x - S.x), y: Math.round(lb.y - S.y), headingDeg: Math.round(lb.heading * DEG), speedKt: lb.speedKt,
                name: lb.bot.name !== lb._defName ? lb.bot.name : undefined,
                plan: (lb.plan && lb.plan.length) ? lb.plan.map(en => ({ t: en.t, headingDeg: en.headingDeg })) : undefined,
                aiAtS: lb.aiAtS == null ? undefined : lb.aiAtS,
                goals: (lb.goals && lb.goals.length) ? lb.goals.map(g =>
                    g.type === 'point' ? { k: 'p', x: Math.round(g.x - S.x), y: Math.round(g.y - S.y) }
                    : g.type === 'mark' ? { k: 'm', i: LAB.marks.indexOf(g.ref) }
                    : { k: 'g', i: LAB.lines.indexOf(g.ref) }).filter(g => g.k === 'p' || g.i >= 0) : undefined })),
            marks: LAB.marks.map(m => ({ x: Math.round(m.x - S.x), y: Math.round(m.y - S.y), side: m.side || 'port', zone: Math.round(m.zone || 165), name: m.labName || undefined })),
            sands: LAB.sands.map(s => ({ pts: s.isl.vertices.map(v => [Math.round(v.x - S.x), Math.round(v.y - S.y)]), name: s.labName || undefined })),
            lines: LAB.lines.map(l => ({ x1: Math.round(l.x1 - S.x), y1: Math.round(l.y1 - S.y), x2: Math.round(l.x2 - S.x), y2: Math.round(l.y2 - S.y), name: l.labName || undefined })),
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
        LAB.tags = (sc.tags || []).slice();
        renderTags();
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
                if (bs.name) lb.bot.name = bs.name;
                if (bs.goals && bs.goals.length) pendingGoals.push([lb, bs.goals]);
            }
        }
        for (const ms of (sc.marks || [])) {
            const m = addMark(S.x + ms.x, S.y + ms.y);
            if (ms.side) m.side = ms.side;
            if (ms.zone) m.zone = ms.zone;
            if (ms.name) m.labName = ms.name;
        }
        for (const ss of (sc.sands || [])) {
            // pts = authored polygon; {x,y,r} = legacy circle doc
            const sd = ss.pts ? addSandPoly(ss.pts.map(p => ({ x: S.x + p[0], y: S.y + p[1] })))
                              : addSand(S.x + ss.x, S.y + ss.y, ss.r);
            if (ss.name) sd.labName = ss.name;
        }
        for (const ls of (sc.lines || [])) { const ln = addLine(S.x + (ls.x1 + ls.x2) / 2, S.y + (ls.y1 + ls.y2) / 2); ln.x1 = S.x + ls.x1; ln.y1 = S.y + ls.y1; ln.x2 = S.x + ls.x2; ln.y2 = S.y + ls.y2; if (ls.name) ln.labName = ls.name; }
        for (const [lb, gs] of pendingGoals) {
            lb.goals = gs.map(g =>
                g.k === 'p' ? { type: 'point', x: S.x + g.x, y: S.y + g.y }
                : g.k === 'm' ? (LAB.marks[g.i] && { type: 'mark', ref: LAB.marks[g.i] })
                : (LAB.lines[g.i] && { type: 'gate', ref: LAB.lines[g.i] })).filter(Boolean);
        }
        select(null);
        invalidate();
        // open ON the action: every load (Open, boot restore, discard) frames
        // the scene — boats off-screen at 100% was the Rule 10 first look
        zoomFit();
    }
    const nameIn = ui.querySelector('#lab-name');
    nameIn.addEventListener('input', () => saveDraft());

    // ── TAGS: chips in the box, an inline input to add (Enter/comma;
    // Backspace on empty removes the last). Tags ride the doc — save,
    // draft, dirty, undo — but never touch the sim, so no invalidate.
    const tagIn = ui.querySelector('#lab-tagin');
    function renderTags() {
        const box = ui.querySelector('#lab-tagchips');
        box.innerHTML = '';
        LAB.tags.forEach((t, i) => {
            const chip = document.createElement('span');
            chip.className = 'sl-schip sl-schip-mute';
            chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px';
            const txt = document.createElement('span');
            txt.textContent = t;
            const x = document.createElement('span');
            x.innerHTML = '&#10005;';
            x.style.cssText = 'font-size:8px;color:#66748c;cursor:pointer';
            x.onmouseenter = () => x.style.color = '#ff8a75';
            x.onmouseleave = () => x.style.color = '#66748c';
            x.onclick = () => { LAB.tags.splice(i, 1); renderTags(); saveDraft(); };
            chip.append(txt, x);
            box.appendChild(chip);
        });
    }
    function addTag(raw) {
        const t = raw.trim().replace(/^#/, '').replace(/,+$/, '').trim();
        if (!t) return;
        if (!LAB.tags.some(x => x.toLowerCase() === t.toLowerCase())) {
            LAB.tags.push(t);
            renderTags();
            saveDraft();
        }
    }
    tagIn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(tagIn.value);
            tagIn.value = '';
        } else if (e.key === 'Backspace' && !tagIn.value && LAB.tags.length) {
            LAB.tags.pop();
            renderTags();
            saveDraft();
        }
    });
    tagIn.addEventListener('blur', () => { addTag(tagIn.value); tagIn.value = ''; });
    ui.querySelector('#lab-tagbox').addEventListener('mousedown', (e) => {
        if (e.target.id === 'lab-tagbox') { e.preventDefault(); tagIn.focus(); }
    });

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
        // per-name merge by SAVE TIME, not blanket local-wins: the old rule
        // let a stale localStorage mirror silently mask — and on the next
        // save, clobber — newer copies committed into the shipped file
        // (measured: the tack scenarios' asserts vanished from the file that
        // way). Undated ties keep the old local-wins behavior.
        const merged = { ...shipped };
        for (const k of Object.keys(local)) {
            const l = local[k], s2 = shipped[k];
            if (!s2 || (l && (l.savedAt || 0) >= (s2.savedAt || 0))) merged[k] = l;
        }
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
    function dialog(title, bodyEl, buttons, opts) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:0;z-index:95;background:rgba(4,8,14,0.55);display:flex;align-items:center;justify-content:center';
        const box = document.createElement('div');
        box.style.cssText = 'min-width:300px;max-width:420px;max-height:70vh;display:flex;flex-direction:column;background:rgba(7,19,34,.96);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 10px 34px rgba(4,16,28,.5);padding:16px 18px;color:#eef3fb;font:13px/1.4 Archivo,system-ui,sans-serif';
        if (opts && opts.width) box.style.maxWidth = `min(${opts.width}px, 92vw)`;
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
            btn.className = 'sl-btn' + (b.danger ? ' sl-btn-red' : b.primary ? ' sl-btn-pri' : '');
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
        // every confirmDialog guards a PERMANENT effect (delete / clear /
        // discard), so the committing button is RED, never the primary blue
        dialog(title, p, [{ label: 'Cancel' }, { label: yesLabel || 'OK', danger: true, onClick: onYes }]);
    }

    // ── dirty tracking + New / Open / Save / Save As ───────────────────
    function currentDoc() { return JSON.stringify({ name: (nameIn.value || '').trim(), ...sceneObj() }); }
    // SAVE is only offered when there is something to save (owner ruling):
    // dirty-tracking already exists, the button just reads it. Refreshed at
    // every doc-changing chokepoint (saveDraft) and every save/load/new.
    // WHY is the doc dirty — named sections, not a boolean. Surfaced as the
    // SAVE/DISCARD tooltips (owner: "why is Save enabled?" must be
    // answerable from the page, not the console)
    function dirtyWhy() {
        const nm = (ui.querySelector('#lab-name').value || '').trim();
        if (!nm) return 'unsaved scenario (no name yet)';
        const lib = store();
        if (!lib[nm]) return `“${nm}” is not in the library yet`;
        const cur = canonDoc(JSON.parse(JSON.stringify({ name: nm, ...sceneObj() })));
        const sav = canonDoc({ name: nm, ...lib[nm] });
        const diffs = [];
        for (const k of new Set([...Object.keys(cur), ...Object.keys(sav)])) {
            if (JSON.stringify(cur[k]) !== JSON.stringify(sav[k])) diffs.push(k);
        }
        return diffs.length ? `differs from saved: ${diffs.join(', ')}` : 'differs from saved';
    }
    function refreshSaveBtn() {
        const dirty = isDirty();
        const why = dirty ? dirtyWhy() : 'no unsaved changes';
        const b = ui.querySelector('#lab-save');
        if (b) { b.disabled = !dirty; b.title = why; }
        // DISCARD mirrors SAVE: only offered when there is something to lose
        const d = ui.querySelector('#lab-discard');
        if (d) {
            d.style.opacity = dirty ? '1' : '.35';
            d.style.pointerEvents = dirty ? 'auto' : 'none';
            d.title = dirty ? `${why} — restore the saved version` : 'no unsaved changes';
        }
        // DELETE only offers when the current name exists in the library
        const del = ui.querySelector('#lab-delete');
        if (del) {
            const nm = (ui.querySelector('#lab-name').value || '').trim();
            const inLib = !!(nm && store()[nm]);
            del.style.opacity = inLib ? '1' : '.35';
            del.style.pointerEvents = inLib ? 'auto' : 'none';
            del.title = inLib ? `delete “${nm}” from the library` : 'not in the library';
        }
    }
    function markSaved() {
        LAB.savedJSON = currentDoc();
        refreshSaveBtn();
        // the draft must learn about the save too — without this, a save
        // landing >400ms after the last edit left the draft carrying a STALE
        // _saved, and the next page open showed unsaved changes
        saveDraft();
    }
    // semantic doc equality for the boot fallback: sorted keys, legacy seed
    // fields normalized — so a pre-_saved draft that matches its library
    // entry still opens clean
    function canonDoc(o) {
        if (Array.isArray(o)) return o.map(canonDoc);
        if (o && typeof o === 'object') {
            const c = { ...o };
            if (c.seeds == null) c.seeds = [c.seed != null ? c.seed >>> 0 : 0x9e3779b9];
            delete c.seed;
            delete c.savedAt;   // storage metadata, not scenario content
            const out = {};
            for (const k of Object.keys(c).sort()) {
                if (c[k] === undefined) continue;
                out[k] = Array.isArray(c[k]) || (c[k] && typeof c[k] === 'object')
                    ? (Array.isArray(c[k]) ? c[k].map(x => (x && typeof x === 'object') ? sortKeys(x) : x) : sortKeys(c[k]))
                    : c[k];
            }
            return out;
        }
        return o;
    }
    function sortKeys(o) {
        if (Array.isArray(o)) return o.map(sortKeys);
        if (o && typeof o === 'object') {
            const out = {};
            for (const k of Object.keys(o).sort()) if (o[k] !== undefined) out[k] = sortKeys(o[k]);
            return out;
        }
        return o;
    }
    function isDirty() {
        const empty = !LAB.boats.length && !LAB.marks.length && !LAB.sands.length && !LAB.lines.length;
        if (LAB.savedJSON == null) return !empty;
        return currentDoc() !== LAB.savedJSON;
    }
    function ifClean(action, then) {
        if (!isDirty()) return then();
        confirmDialog(action, 'There are unsaved changes. Discard them?', then, 'Discard');
    }
    function freshScenario() {
        clearScene();
        nameIn.value = '';
        LAB.durationS = 10; ui.querySelector('#lab-dur').value = 10;
        LAB.windKt = 12; ui.querySelector('#lab-wind').value = 12;
        LAB.seeds = [0x9e3779b9]; LAB.seedIx = 0; LAB.recs = {};
        renderSeeds();
        LAB.asserts = []; LAB.assertResults = null;
        renderAsserts();
        LAB.tags = [];
        renderTags();
        markSaved();
        select(null);
    }
    function newScenario() {
        ifClean('New scenario', freshScenario);
    }
    // DISCARD: the other exit from a dirty doc — restore the saved version
    // (or empty, for a never-saved scene). Confirmed, and only offered when
    // there is something to throw away.
    function discardChanges() {
        if (!isDirty()) return;
        const nm = (nameIn.value || '').trim();
        const lib = store();
        const hasSaved = !!(nm && lib[nm]);
        confirmDialog('Discard changes',
            hasSaved ? `Throw away your changes and restore “${nm}” as last saved?`
                     : 'Throw away this unsaved scenario and start empty?',
            () => {
                if (hasSaved) {
                    LAB._loading = true;
                    loadScene(lib[nm]);
                    nameIn.value = nm;
                    LAB._loading = false;
                    markSaved();
                    select(null);
                } else freshScenario();
            }, 'Discard');
    }
    function saveScenario(asNew) {
        const doIt = (name) => {
            const t = loadTombs();
            if (t.has(name)) { t.delete(name); saveTombs(t); }   // saving revives the name
            const lib = store();
            // plain SAVE after a name edit is a RENAME (owner ruling): the
            // old entry moves, it doesn't stay behind as a copy. SAVE AS…
            // is the copy-under-a-new-name path.
            if (!asNew && LAB.savedJSON) {
                let prev = '';
                try { prev = (JSON.parse(LAB.savedJSON).name || '').trim(); } catch (e) { }
                if (prev && prev !== name && lib[prev]) {
                    delete lib[prev];
                    const t2 = loadTombs(); t2.add(prev); saveTombs(t2);
                    if (window.SCENARIO_DOC) delete window.SCENARIO_DOC[prev];
                }
            }
            lib[name] = { ...sceneObj(), savedAt: Date.now() };
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
    // the Open box is built for a LARGE library: rows are created per
    // filter pass (capped at 400 rendered matches — refine past that), the
    // count line says what the filter is doing, Enter opens the first
    // (highlighted) match, and a delete re-opens with the filter intact.
    function openScenario(initialFilter) {
        const lib = store();
        const names = Object.keys(lib).sort((a, b) => a.localeCompare(b));
        const MAXROWS = 400;
        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:320px';
        const filterWrap = document.createElement('div');
        filterWrap.className = 'sl-inp';
        const filterIn = document.createElement('input');
        filterIn.type = 'text';
        filterIn.placeholder = 'Filter by name or tag';
        filterIn.style.fontVariantNumeric = 'normal';
        filterIn.value = typeof initialFilter === 'string' ? initialFilter : '';
        filterWrap.appendChild(filterIn);
        body.appendChild(filterWrap);
        const countEl = document.createElement('div');
        countEl.className = 'sl-hint';
        countEl.style.padding = '0 2px';
        body.appendChild(countEl);
        const list = document.createElement('div');
        list.style.cssText = 'overflow-y:auto;max-height:50vh;min-height:40px';
        body.appendChild(list);
        let dlg = null;
        let firstVisible = null;
        const openByName = (n) => {
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
        const buildRow = (n, highlight) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;font-weight:700'
                + (highlight ? ';background:rgba(47,107,255,.18)' : '');
            row.onmouseenter = () => { if (!highlight) row.style.background = 'rgba(255,255,255,.07)'; };
            row.onmouseleave = () => { if (!highlight) row.style.background = ''; };
            const label = document.createElement('span');
            label.textContent = n;
            label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            label.onclick = () => openByName(n);
            const tagWrap = document.createElement('span');
            tagWrap.style.cssText = 'flex:1;display:inline-flex;gap:4px;overflow:hidden;margin-left:2px';
            for (const t of (lib[n].tags || [])) {
                const tc = document.createElement('span');
                tc.className = 'sl-schip sl-schip-mute';
                tc.style.cssText = 'font-size:9px;padding:2px 6px;cursor:pointer;flex:none';
                tc.textContent = t;
                tc.title = `filter by “${t}”`;
                tc.onclick = (e) => { e.stopPropagation(); filterIn.value = t; applyFilter(); };
                tagWrap.appendChild(tc);
            }
            const del = document.createElement('span');
            del.innerHTML = '&#10005;';
            del.title = 'delete';
            del.style.cssText = 'cursor:pointer;color:#66748c;padding:0 4px;font-size:11px';
            del.onmouseenter = () => del.style.color = '#ff8a75';
            del.onmouseleave = () => del.style.color = '#66748c';
            del.onclick = (e) => {
                e.stopPropagation();
                const keepFilter = filterIn.value;
                dlg.close();
                confirmDialog('Delete scenario', `Delete \u201c${n}\u201d? This cannot be undone.`, () => {
                    const l2 = store(); delete l2[n];
                    const t = loadTombs(); t.add(n); saveTombs(t);
                    // the in-memory shipped copy too, or store() resurrects it
                    if (window.SCENARIO_DOC) delete window.SCENARIO_DOC[n];
                    persistLib(l2);
                    openScenario(keepFilter);
                }, 'Delete');
            };
            row.append(label, tagWrap, del);
            return row;
        };
        const applyFilter = () => {
            // every space-separated term must match the NAME or a TAG
            const terms = filterIn.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            const q = terms.length > 0;
            const matches = !q ? names : names.filter(n => {
                const nl = n.toLowerCase();
                const tags = (lib[n].tags || []).map(t => t.toLowerCase());
                return terms.every(t => nl.includes(t) || tags.some(tag => tag.includes(t)));
            });
            list.innerHTML = '';
            firstVisible = matches[0] || null;
            matches.slice(0, MAXROWS).forEach((n, i) => list.appendChild(buildRow(n, i === 0 && !!q)));
            if (!names.length) countEl.textContent = 'No saved scenarios yet.';
            else if (!matches.length) countEl.textContent = 'nothing matches';
            else if (matches.length > MAXROWS) countEl.textContent = `showing ${MAXROWS} of ${matches.length} matches \u00b7 refine the filter`;
            else if (q) countEl.textContent = `${matches.length} of ${names.length} \u00b7 Enter opens the first`;
            else countEl.textContent = `${names.length} scenario${names.length === 1 ? '' : 's'}`;
        };
        filterIn.addEventListener('input', applyFilter);
        filterIn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && firstVisible) openByName(firstVisible);
        });
        applyFilter();
        dlg = dialog('Open scenario', body, [{ label: 'Close' }]);
        setTimeout(() => filterIn.focus(), 50);
    }
    ui.querySelector('#lab-new').onclick = newScenario;
    ui.querySelector('#lab-open').onclick = () => openScenario();
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
        // armed OBJECT tool = polygon drafting (owner): every click drops a
        // vertex; clicking the first point again (≥3 points) or RETURN
        // closes; ESC cancels the draft
        if (LAB.armed === 'sand') {
            const draft = LAB.sandDraft || (LAB.sandDraft = []);
            if (draft.length >= 3) {
                const p0 = draft[0];
                if (Math.hypot(wx - p0.x, wy - p0.y) < 14 / LAB.zoom) { closeSandDraft(); return; }
            }
            draft.push({ x: wx, y: wy });
            return;
        }
        if (!hit && LAB.armed) {
            // an armed layer "+": place that kind here, stay armed for more
            if (LAB.armed === 'boat') addBoat(wx, wy);
            else if (LAB.armed === 'mark') addMark(wx, wy);
            else if (LAB.armed === 'line') addLine(wx, wy);
            LAB.drag = { sel: LAB.sel };
            return;
        }
        // PLAYHEAD AS MODE: t=0 is authoring, t>0 is observation. A touch on
        // an object mid-playback INSPECTS it and returns the stage to the
        // start — where the recorded pose IS the setup pose — so the next
        // drag edits exactly what the eye sees. Nothing mutates on the first
        // touch: the recording survives mere inspection. (Dragging at t>0
        // used to rewrite the SETUP position from cursor coordinates in the
        // RECORDED frame — the boat teleported.)
        // a waypoint pip drags without touching the selection (the boat that
        // owns it stays selected; its inspector rows update on release)
        if (hit && hit.kind === 'goalpt') {
            LAB.drag = { sel: hit };
            return;
        }
        // a sand VERTEX drags without touching the selection (the sand that
        // owns it stays selected; the polygon reshapes live)
        if (hit && hit.kind === 'sandvert') {
            LAB.drag = { sel: hit };
            return;
        }
        if (hit && LAB.mode === 'play' && LAB.rec && LAB.frame > 0) {
            pause();
            setFrame(0);
            select(hit);
            // a boat's setup pose can be far from its recorded pose — if the
            // rewind would put the target off-screen, bring the camera to it
            if (hit.kind === 'boat') {
                const [tx, ty] = w2s(hit.ref.x, hit.ref.y);
                const M = 80;
                if (tx < M || tx > ov.width - M || ty < M || ty > ov.height - M) {
                    LAB.cam.x = hit.ref.x; LAB.cam.y = hit.ref.y;
                }
            }
            return;   // no drag from this gesture — the target just moved to its setup pose
        }
        if (hit) {
            select(hit);
            LAB.drag = { sel: hit };
            if (hit.kind === 'sand') LAB.drag.grab = sandGrab(hit.ref, wx, wy);
        }
        else { select(null); LAB.drag = { pan: true, sx: e.clientX, sy: e.clientY, cx: LAB.cam.x, cy: LAB.cam.y }; }
    });
    ov.addEventListener('mousemove', e => {
        LAB.mouse = s2w(e.clientX, e.clientY);   // the draft's rubber band reads this
        if (!LAB.drag) return;
        if (LAB.drag.pan) {
            LAB.cam.x = LAB.drag.cx - (e.clientX - LAB.drag.sx) / LAB.zoom;
            LAB.cam.y = LAB.drag.cy - (e.clientY - LAB.drag.sy) / LAB.zoom;
            return;
        }
        const [wx, wy] = s2w(e.clientX, e.clientY);
        const s = LAB.drag.sel;
        // sand body drag, all three gestures relative to the GRAB anchor:
        // plain = translate by cursor delta (no centroid snap), ⌘ = rotate
        // about the centroid, ⌥ = scale about the centroid
        if (s.kind === 'sand' && LAB.drag.grab) {
            const g = LAB.drag.grab, vs = s.ref.isl.vertices;
            if (e.metaKey) {
                const da = Math.atan2(wy - g.cy, wx - g.cx) - g.a0;
                const cos = Math.cos(da), sin = Math.sin(da);
                for (let k = 0; k < vs.length; k++) {
                    const ox = g.verts[k].x - g.cx, oy = g.verts[k].y - g.cy;
                    vs[k].x = g.cx + ox * cos - oy * sin;
                    vs[k].y = g.cy + ox * sin + oy * cos;
                }
            } else if (e.altKey) {
                let k = Math.hypot(wx - g.cx, wy - g.cy) / g.d0;
                k = Math.max(30 / g.r0, Math.min(1200 / g.r0, k));   // radius stays sane
                for (let i = 0; i < vs.length; i++) {
                    vs[i].x = g.cx + (g.verts[i].x - g.cx) * k;
                    vs[i].y = g.cy + (g.verts[i].y - g.cy) * k;
                }
            } else {
                const dx = wx - g.gx, dy = wy - g.gy;
                for (let i = 0; i < vs.length; i++) { vs[i].x = g.verts[i].x + dx; vs[i].y = g.verts[i].y + dy; }
            }
            recomputeSand(s.ref);
            invalidate();
            return;
        }
        if (e.metaKey && s.kind === 'boat') {
            // ⌘-drag: rotate — point the bow at the cursor
            s.ref.heading = Math.atan2(wx - s.ref.x, -(wy - s.ref.y));
            hdgIn.value = Math.round(((s.ref.heading * DEG) % 360 + 360) % 360);
            invalidate();
            return;
        }
        if (e.altKey) {
            // ⌥-drag: resize (sand handles its own scale above, grab-relative)
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
        if (s.kind === 'boat' && LAB.sel && LAB.sel.ref === s.ref) refreshBoatXY(s.ref);
        invalidate();
    });
    window.addEventListener('mouseup', () => {
        // a finished waypoint drag refreshes its inspector row (coords label)
        if (LAB.drag && LAB.drag.sel && LAB.drag.sel.kind === 'goalpt') renderGoals(LAB.drag.sel.lb);
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
            for (const lb of LAB.boats) lb._dispMode = lb.aiAtS !== 0 ? 'S' : 'AI';
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
    // the sailed line in the hull colour, drawn in WORLD space from the
    // game's wake slot: under the fleet, under the water effects, 2.5× the
    // old overlay weight (7.5u), width scaling with zoom like the world does
    function drawLabTracks(ctx) {
        if (LAB.mode !== 'play' || !LAB.rec || LAB.frame <= 1) return;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 7.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < LAB.boats.length; i++) {
            const lb = LAB.boats[i];
            ctx.beginPath();
            let started = false;
            for (let f = 0; f <= LAB.frame; f += 4) {
                const fb = LAB.rec.frames[f].boats[i];
                if (!fb) break;
                if (!started) { ctx.moveTo(fb.x, fb.y); started = true; } else ctx.lineTo(fb.x, fb.y);
            }
            ctx.strokeStyle = (lb.bot.colors && lb.bot.colors.hull) || '#8fd0ff';
            ctx.stroke();
        }
        ctx.restore();
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
        // polygon DRAFT: the points so far, a rubber band to the cursor, and
        // a highlighted first point once it can close the shape
        if (LAB.armed === 'sand' && LAB.sandDraft && LAB.sandDraft.length) {
            const d = LAB.sandDraft;
            octx.beginPath();
            const [dx0, dy0] = w2s(d[0].x, d[0].y);
            octx.moveTo(dx0, dy0);
            for (let k = 1; k < d.length; k++) { const [px, py] = w2s(d[k].x, d[k].y); octx.lineTo(px, py); }
            if (LAB.mouse) { const [mx, my] = w2s(LAB.mouse[0], LAB.mouse[1]); octx.lineTo(mx, my); }
            octx.strokeStyle = 'rgba(224,201,155,0.95)'; octx.lineWidth = 2.5; octx.setLineDash([6, 6]);
            octx.stroke(); octx.setLineDash([]);
            d.forEach((p, k) => {
                const [px, py] = w2s(p.x, p.y);
                const closable = k === 0 && d.length >= 3;
                octx.beginPath(); octx.arc(px, py, closable ? 8 : 5, 0, 7);
                octx.fillStyle = closable ? '#f0a02a' : 'rgba(224,201,155,0.95)'; octx.fill();
                octx.strokeStyle = '#fff'; octx.lineWidth = 1.5; octx.stroke();
            });
        }
        // the selected sand's VERTEX handles (authoring only): drag to reshape
        if ((LAB.mode === 'edit' || LAB.frame === 0) && LAB.sel && LAB.sel.kind === 'sand') {
            for (const v of LAB.sel.ref.isl.vertices) {
                const [px, py] = w2s(v.x, v.y);
                octx.beginPath(); octx.arc(px, py, 6, 0, 7);
                octx.fillStyle = '#e0c99b'; octx.fill();
                octx.strokeStyle = 'rgba(7,19,34,0.9)'; octx.lineWidth = 2; octx.stroke();
            }
        }
        // name pills: constant screen size, drawn HERE (full-res canvas)
        // so the letters stay crisp at any zoom — the game canvas's backing
        // store is viewport/zoom and blurs its text when zoomed in
        for (const lb of LAB.boats) {
            const bot = lb.bot;
            if (bot.opacity !== undefined && bot.opacity <= 0) continue;
            const [px, py] = w2s(bot.x, bot.y);
            octx.font = '800 13px Archivo,system-ui';
            const w = octx.measureText(bot.name).width + 16;
            octx.fillStyle = 'rgba(15,23,42,0.6)';
            octx.beginPath(); octx.roundRect(px - w / 2, py + 36, w, 20, 6); octx.fill();
            // WHITE name = scripted helm, GREEN name = the AI's — and a boat
            // that hands off mid-scenario changes colour at that frame
            octx.fillStyle = lb._dispMode === 'S' ? '#ffffff' : '#7de28f';
            octx.textAlign = 'center'; octx.textBaseline = 'middle';
            octx.fillText(bot.name, px, py + 46);
        }
        // (the realized playback tracks moved off this overlay — they draw
        // in the game's wake slot now, in world space, UNDER the fleet and
        // the water effects; see drawLabTracks)
        // the goal route: boat → 1 → 2 → … dotted in the hull colour, with
        // numbered pips matching the inspector's step badges (edit mode,
        // selected boat only — the water stays quiet otherwise)
        if ((LAB.mode === 'edit' || LAB.frame === 0) && LAB.sel && LAB.sel.kind === 'boat'
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
        // dragging a waypoint: a live readout of the leg INTO it — the course
        // to sail (HDG), its true wind angle (wind is always from the top),
        // and the turn from the previous leg (Δ). Reads whether the leg is
        // even sailable (a TWA inside the close-hauled cone is a beat).
        if (LAB.drag && LAB.drag.sel && LAB.drag.sel.kind === 'goalpt') {
            const g = LAB.drag.sel.ref, lb = LAB.drag.sel.lb;
            const idx = lb.goals.indexOf(g);
            const normD = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
            const brgDeg = (x0, y0, x1, y1) => ((Math.atan2(x1 - x0, -(y1 - y0)) * DEG) % 360 + 360) % 360;
            const prev = idx > 0 ? goalPoint(lb.goals[idx - 1]) : [lb.x, lb.y];
            const hdg = brgDeg(prev[0], prev[1], g.x, g.y);
            const twa = normD(hdg);   // wind from 000
            const prevHdg = idx > 1 ? brgDeg(...goalPoint(lb.goals[idx - 2]), prev[0], prev[1])
                : idx === 1 ? brgDeg(lb.x, lb.y, prev[0], prev[1])
                : ((lb.heading * DEG) % 360 + 360) % 360;
            const dlt = normD(hdg - prevHdg);
            const [sx, sy] = w2s(g.x, g.y);
            const txt = `HDG ${String(Math.round(hdg)).padStart(3, '0')}° · TWA ${Math.round(Math.abs(twa))}°${twa < 0 ? ' STBD' : twa > 0 ? ' PORT' : ''} · Δ${dlt >= 0 ? '+' : ''}${Math.round(dlt)}°`;
            octx.font = '800 11px Archivo,system-ui';
            const w = octx.measureText(txt).width + 18;
            octx.fillStyle = 'rgba(7,19,34,0.92)';
            octx.beginPath(); octx.roundRect(sx + 16, sy - 34, w, 22, 7); octx.fill();
            octx.strokeStyle = 'rgba(255,255,255,0.14)'; octx.lineWidth = 1; octx.stroke();
            octx.fillStyle = '#8fd8d0';
            octx.textAlign = 'left'; octx.textBaseline = 'middle';
            octx.fillText(txt, sx + 25, sy - 23);
        }
        // the selection ring shows in playback too (inspection is allowed
        // there); for boats it rides the recorded pose
        if (LAB.sel && LAB.sel.kind !== 'play') {
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
