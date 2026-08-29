// ── SAILING SCHOOL at Duckling Pond ───────────────────────────────────────────
// The seven-minute onboarding: one continuous sail, one start, one graduation race.
// guidelines/tutorial.md is the spec; this file is the segment driver, the instructor
// card and the two pond-only overlays (wind ribbon, no-go cone).
//
// Shape, from the spec:
//   • NOTHING IS A DOOR. Every segment advances on the player demonstrating its verb OR
//     on a timer; the sail never stops and the player is never stuck.
//   • Name after the experience. The card says "that's a tack" after the tack.
//   • Twelve words, one line, non-modal, low-centre, over a world that keeps sailing.
//   • Two engineered failures only: in irons (unit 1b) and over early (unit 2).
//
// Integration is deliberately thin: resetGame() asks School for the player's boat and the
// fleet; update() and draw() each make one call; the results flag routes here instead of
// to the results screen. Everything else is the shipped race running under a script.

const SCHOOL_PROGRESS_KEY = 'regatta_progress';

const School = {
    active: false,
    unit: 0,                 // 1 First Sail (open water) · 2 the pond, free sailing · 3 the Start · 4 the race
    venueKey: 'pond',
    controlsLocked: false,   // physics reads this: the helm is held during "feel the wind"
    kiteLocked: false,       // input.js reads this: SPACE does nothing until the downwind beat
    hudHidden: false,        // the DOM instruments (rose, minimap)
    panelHidden: false,      // the canvas panel under the boat (TWA)
    windScale: null,         // regionWindAt multiplies by this while the school runs (null = 1)
    highlight: null,         // { world: (player) => {x,y,r} } or { dom: () => {x,y,w,h} } — the teal ring

    // The assigned training dinghy: white hull, yellow training sail (venues.md §15). Not a
    // character — the picker is withheld until Lighthouse Cove. Baseline stats.
    TRAINER: { name: 'Trainer', creature: 'Training Dinghy', hull: '#FFFFFF', sail: '#F5C518',
               spinnaker: '#22E05A', spinnaker2: '#FFFFFF', cockpit: '#C9CCD6', spinPattern: 'solid',
               personality: 'A rented boat with a yellow sail.', beat: '', archetype: 'metronome', stats: {} },

    // The classmates (tutorial.md §8): all from the Starting Ten, none of the bullies. Each
    // carries ONE characteristic error drawn from the curriculum, so every lesson gets a
    // second showing from the outside.
    CLASSMATES: [
        { name: 'Sunshine', traits: { startBufAdj: 1.2 } },              // over early, has to dip back
        { name: 'Wobble',   traits: { pinch: 8 * Math.PI / 180 } },      // pinches up the beat
        { name: 'Cheer',    traits: { kiteHold: 22 * Math.PI / 180 } },  // carries the kite too long
    ],
    HANDICAP: -3,   // per performance stat, below the zero baseline (AI bonus removed too)

    // ── persistence: the graduated flag only (unlocks come later) ─────────────
    progress() {
        try { return JSON.parse(localStorage.getItem(SCHOOL_PROGRESS_KEY)) || {}; } catch (e) { return {}; }
    },
    graduated() { return !!this.progress().graduated; },
    saveProgress(patch) {
        const p = Object.assign(this.progress(), patch);
        try { localStorage.setItem(SCHOOL_PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
    },

    // ── entry / exit ───────────────────────────────────────────────────────────
    start(unit) {
        unit = unit || 1;
        if (!this.active) {
            this._saved = {
                venue: settings.venue, autoTrim: settings.autoTrim, navAids: state.showNavAids,
                penalties: settings.penaltiesEnabled, character: settings.character,
            };
        }
        this.active = true;
        this.unit = unit;
        // The First Sail runs on the open-water twin of the pond (see registerOpenWater);
        // everything from unit 2 on is the pond itself, lawn and all.
        settings.venue = unit === 1 ? 'pond-open' : this.venueKey;
        settings.autoTrim = true;
        // The lesson points at BOTH faces of the instruments — the panel under the boat and
        // the rose — so the school runs with both, whatever the player has set.
        if (this._saved && this._saved.hudMode === undefined) this._saved.hudMode = settings.hudMode;
        settings.hudMode = 'both';
        saveSettings();                      // resetGame() re-reads settings from storage first
        if (typeof applyHudMode === 'function') applyHudMode();

        state.showNavAids = true;
        this.s = null;                       // per-unit script state
        this.log = this.log || [];
        this.hideDebrief();
        this.ensureDom();
        this.windScale = null;
        this.highlight = null;
        if (UI.preRaceOverlay) UI.preRaceOverlay.classList.add('hidden');
        if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
        if (typeof Sayings !== 'undefined') { Sayings.queue = []; if (Sayings.current && Sayings.hide) Sayings.hide(); }

        if (unit === 4) this.beginRace();
        else {
            settings.penaltiesEnabled = false;
            resetGame();                     // asks School for the fleet (see resetGame)
            if (unit === 1) this.liftArena();   // no edge of the world on the First Sail
            state.course.cutoff = 1e9;       // no clock on a lesson
            if (unit === 1) this.beginFirstSail();
            else if (unit === 2) this.beginPond();
            else this.beginStart();
        }
        // resetGame() reopens the clubhouse; the school has zero screens between the click
        // and the water.
        if (UI.preRaceOverlay) UI.preRaceOverlay.classList.add('hidden');
        if (UI.legInfo) UI.legInfo.parentElement.classList.remove('hidden');
        if ((settings.soundEnabled || settings.musicEnabled) && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();
        Sound.updateMusic();
        this.showFrame(true);
    },

    exit(nextVenue) {
        if (!this.active) return;
        const sv = this._saved || {};
        this.active = false;
        this.unit = 0;
        this.s = null;
        this.hideCard();
        this.hideDebrief();
        this.showFrame(false);
        this.setControls(true); this.setHud(true); this.setPanel(true); this.goal(null);
        this.windScale = null; this.highlight = null;
        settings.hudMode = sv.hudMode || 'boat';
        if (typeof applyHudMode === 'function') applyHudMode();
        settings.venue = nextVenue || sv.venue || 'bay';
        settings.autoTrim = sv.autoTrim !== undefined ? sv.autoTrim : true;
        settings.penaltiesEnabled = sv.penalties !== undefined ? sv.penalties : true;
        state.showNavAids = sv.navAids !== undefined ? sv.navAids : true;
        if (UI.timer) UI.timer.style.visibility = '';
        { const mm = document.getElementById('minimap'); if (mm && mm.parentElement) mm.parentElement.style.visibility = ''; }
        saveSettings();
        restartRace();                       // back to the clubhouse, on the chosen venue
        if (typeof selectVenue === 'function') selectVenue(settings.venue);
        if (window.__styleSchoolBtn) window.__styleSchoolBtn();
    },

    // A lesson (units 1 and 2) as opposed to the graduation race: the HUD hides its race
    // furniture — clock, leaderboard, caption, course edge indicators — while this is true.
    lesson() { return this.active && !!this.s && this.s.kind !== 'race'; },

    // resetGame() asks these.
    playerConfig() { return this.TRAINER; },
    classmateConfigs() {
        // The lessons are one boat alone on the water; the classmates arrive for the race.
        if (this.unit !== 4) return [];
        return this.CLASSMATES.map(c => {
            const base = AI_CONFIG.find(a => a.name === c.name);
            return base ? Object.assign({}, base, { traits: Object.assign({}, base.traits || {}, c.traits) }) : null;
        }).filter(Boolean);
    },
    onFleetBuilt() {
        // Handicap, don't zero (tutorial.md §8): a baseline-competent boat beats a
        // five-minute-old sailor. Below zero on every performance stat, AI bonus gone.
        for (const b of state.boats) {
            if (b.isPlayer) { b.manualTrim = false; continue; }
            for (const k of BONUS_STATS) b.stats[k] = this.HANDICAP;
        }
    },

    // ── geometry helpers (wind-relative, so any seed works) ───────────────────
    wd() { return state.wind.baseDirection; },
    U()  { const w = this.wd(); return { x: Math.sin(w), y: -Math.cos(w) }; },   // toward the wind
    R()  { const w = this.wd(); return { x: Math.cos(w), y: Math.sin(w) }; },    // across, to the right when facing upwind
    pt(ox, oy, u, r) { const U = this.U(), R = this.R(); return { x: ox + U.x * u + R.x * r, y: oy + U.y * u + R.y * r }; },
    headingOf(vx, vy) { return Math.atan2(vx, -vy); },
    dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
    placeBoat(boat, p, heading, kts) {
        boat.x = p.x; boat.y = p.y;
        boat.heading = heading; boat.prevHeading = heading;
        const sp = (kts || 0) * 0.25;
        boat.speed = sp;
        boat.velocity = { x: Math.sin(heading) * sp, y: -Math.cos(heading) * sp };
        boat.raceState.lastPos = { x: p.x, y: p.y };
        boat.spinnaker = false;
        boat.spinnakerDeployProgress = 0;
    },
    playerRead() {
        const p = state.boats[0];
        const w = getWindAt(p.x, p.y);
        const twa = normalizeAngle(p.heading - w.direction);
        return { p, twa, abs: Math.abs(twa), kts: p.speed / 0.25, kite: p.spinnaker && p.spinnakerDeployProgress > 0.5 };
    },

    // ── UNIT 1 · THE FIRST SAIL ───────────────────────────────────────────────
    beginFirstSail() {
        // The opening is bare: one boat on a beam reach, no HUD, no marks, no launch, no
        // ducklings — just water, wind and a boat moving. The helm is held until Paddle
        // hands it over. The lesson geometry is laid out later, from wherever the player is
        // when the reach begins (layoutFirstSail).
        const C = state.course.marks;
        const cx = (C[0].x + C[1].x) / 2, cy = (C[0].y + C[1].y) / 2;
        const S = this.pt(cx, cy, -300, 1200);            // beside the course, a little downwind of the line
        const player = state.boats[0];
        const reachHeading = normalizeAngle(this.wd() + Math.PI / 2);
        this.placeBoat(player, S, reachHeading, 5);
        state.race.status = 'racing';
        state.race.timer = 0;
        snapCameraToStart();

        this.s = {
            kind: 'sail', S, path: null, buoys: [],
            coneOn: false, stalled: false, tacks: 0, gybes: 0, lastSide: 0,
            launch: null, ducks: [], duckMode: 'launch',
            windIndicator: false,
            windTarget: 0, windRate: 0,
            turnL: 0, turnR: 0, prevHeading: player.heading,
            segIdx: -1, segT: 0, lineIdx: -1, exitLine: null, exitT: 0,
            t: 0, timerAdvances: 0,
        };
        this.windScale = 0;                  // glassy: the wind arrives when Paddle says so
        this.placeBoat(player, S, reachHeading, 0);
        this.setControls(false);
        this.kiteLocked = true;
        this.setHud(false);
        this.setPanel(false);
        this.segments = this.firstSailSegments();
        this.nextSegment();
    },

    // The lesson water, laid out from where the player is when the reach begins: a lazy S of
    // three reach buoys in the direction they are already reaching, a buoy dead upwind of
    // the last, and a gate home off to one side so getting there needs one gybe.
    layoutFirstSail() {
        const s = this.s, player = state.boats[0];
        const R = this.R();
        const hx = Math.sin(player.heading), hy = -Math.cos(player.heading);
        const dir = (hx * R.x + hy * R.y) >= 0 ? 1 : -1;      // which way along the wind they are reaching
        const S  = { x: player.x, y: player.y };
        const at = (o, u, r) => this.pt(o.x, o.y, u, r * dir);
        const B1 = at(S,  110, 650);
        const B2 = at(S, -110, 1250);
        const B3 = at(S,   80, 1850);
        const W  = at(B3, 850, 0);
        const H  = at(W, -1300, -600);
        const HL = at(H, 0, -110), HR = at(H, 0, 110);
        Object.assign(s, { S, B1, B2, B3, W, H, HL, HR, path: [S, B1, B2, B3],
            buoys: [{ p: B1, on: true }, { p: B2, on: true }, { p: B3, on: true }, { p: W, on: false }, { p: HL, on: false }, { p: HR, on: false }] });
        s.launch = { x: player.x - hx * 40 + (-hy) * 230, y: player.y - hy * 40 + hx * 230, h: player.heading };
        s.ducks = this.makeDucks(at(S, 0, 160));
        s.duckMode = 'lead';
    },

    // NO EDGE OF THE WORLD IN THE TUTORIAL. The venue document still carries a boundary —
    // a dozen systems read course.boundary unguarded and would fall over on null — so the
    // school replaces it with one so large that nothing can reach it: no ribbon in frame,
    // no boundary event, and the minimap frames the player instead (see drawMinimap).
    liftArena() {
        const r = 1e6;
        state.course.boundary = { x: 0, y: 0, radius: r, poly: null, circle: { x: 0, y: 0, r } };
        // THE WIND GOES WITH IT. Outside every wind region regionWindAt blends to nothing, so
        // the document's ±9000 region would have been an invisible edge where the breeze died.
        // Stretch the compiled regions (a clone — the document is untouched) to the same horizon.
        for (const reg of state.course.windRegions || []) {
            reg.poly = [[-r, -r], [r, -r], [r, r], [-r, r]];
            reg.bb = { minX: -r, minY: -r, maxX: r, maxY: r };
        }
    },

    // THE DUCKLINGS AS A GOAL. They sit at the edge of the screen, directly on a beam reach —
    // whichever beam is nearer the player's heading — in a line facing away. While the player
    // points anywhere else they keep station there (the edge of the screen, on the beam), so
    // the only way to reach them is to sail the beam reach at them.
    spawnBeamDucks() {
        const p = state.boats[0], w = this.wd();
        const a = normalizeAngle(w + Math.PI / 2), b = normalizeAngle(w - Math.PI / 2);
        this.spawnDucksAt(Math.abs(normalizeAngle(p.heading - a)) <= Math.abs(normalizeAngle(p.heading - b)) ? a : b);
    },
    // The ducklings as a goal on ANY bearing: at the screen's edge that way, in a line facing
    // away; they hold the edge unless the player is pointed at them (see updateCompanions).
    spawnDucksAt(bearing) {
        const s = this.s;
        s.beamBearing = bearing;
        s.duckMode = 'beam';
        const T = this.beamTarget();
        s.ducks = [];
        for (let i = 0; i < 5; i++) {
            const back = -Math.sin(s.beamBearing) * i * 24, backY = Math.cos(s.beamBearing) * i * 24;
            s.ducks.push({ x: T.x + back, y: T.y + backY, h: s.beamBearing });
        }
        s.duckLead = { x: T.x, y: T.y };
    },
    // UPWIND, THE SAME IDEA: the ducklings stand dead upwind at the screen's edge, but their
    // along-wind station only ever comes DOWN toward the player — sail downwind or sideways
    // and they slide to keep the edge; make ground to windward and the gap closes for good.
    spawnUpwindDucks() {
        const s = this.s, p = state.boats[0];
        const U = this.U();
        s.duckMode = 'upwind';
        s.beamBearing = this.wd();                               // "away" is upwind
        const T = this.edgeTarget(this.wd());
        s.upAlong = (T.x - p.x) * U.x + (T.y - p.y) * U.y;       // the ducks' lead over the player, along the wind
        s.upGap = s.upAlong;
        s.ducks = [];
        for (let i = 0; i < 5; i++) s.ducks.push({ x: T.x - U.x * i * 24, y: T.y - U.y * i * 24, h: this.wd() });
        s.duckLead = { x: T.x, y: T.y };
        s.upBase = { x: p.x, y: p.y };                           // the along-wind origin
    },
    tickUpwind(s, r) {
        const up = s.up, p = r.p;
        const inZone = r.abs < 38 * Math.PI / 180;
        up.zoneT = inZone ? up.zoneT + 1 / 60 : 0;
        const tacks = s.tacks - up.tacks0;
        if (up.phase === 'sail' && up.zoneT >= 3) {
            up.phase = 'zone'; s.coneOn = true;
            this.instruct("You're in the <em>no sail zone</em>. You can't sail directly upwind. Instead, zig zag back and forth just outside of the no sail zone to head upwind.", 'Turn outside of the no sail zone');
        } else if (up.phase === 'zone' && !inZone && r.abs > 42 * Math.PI / 180) {
            up.phase = 'zigzag'; up.tacksAt = tacks;
            this.instruct('Zig zag back and forth upwind.', 'Follow the ducklings');
        } else if ((up.phase === 'zigzag' || up.phase === 'sail') && tacks >= 1 && !up.saidTack) {
            up.saidTack = true; up.phase = 'tack1';
            this.instruct('Good job! That was your first tack. A tack is when you cross the wind to zig zag back and forth.', 'Follow the ducklings');
        } else if (up.phase === 'tack1' && tacks >= 2) {
            up.phase = 'zigzag2';
            this.instruct('Zig zag back and forth upwind.', 'Follow the ducklings');
        }
    },
    tickDownwind(s, r) {
        const dw = s.dw;
        if (dw.phase === 'sail' && r.abs > 150 * Math.PI / 180) {
            dw.phase = 'hoist'; this.kiteLocked = false;
            this.instruct("Good, but it's faster to sail downwind with your spinnaker. Hoist your spinnaker.", 'Press ' + this.K('Space') + ' to raise your spinnaker.');
        } else if (dw.phase === 'hoist' && r.kite) {
            dw.phase = 'kite'; s.duckHoldOff = false;
            this.instruct('Sail downwind with your spinnaker.', 'Follow the ducklings');
        }
    },
    tickCloseReach(s, r) {
        const cr = s.cr, p = r.p;
        if (cr.phase === 'sail' && p.spinnaker && (p.kiteLuff || 0) > 0.05) {
            cr.phase = 'douse';
            this.instruct("The spinnaker is not for sailing upwind. Let's put it away.", 'Press ' + this.K('Space') + ' to put your spinnaker away.');
        } else if (cr.phase === 'douse' && !p.spinnaker) {
            cr.phase = 'again'; s.duckHoldOff = false;
            this.instruct('Sail upwind again.', 'Follow the ducklings');
        } else if (cr.phase === 'sail' && !p.spinnaker && s.segT > 1) {
            cr.phase = 'again'; s.duckHoldOff = false;           // dropped it unprompted: already learned
        }
    },
    instruct(line, goal) {
        this._lines = [line]; this.renderLines();
        this.goal(goal);
    },
    // Where the lead duckling stands: along a bearing from the player, as far as the viewport
    // allows with a margin — the boat sits low in frame, so the room differs by side.
    beamTarget() { return this.edgeTarget(this.s.beamBearing); },
    edgeTarget(bearing) {
        const p = state.boats[0];
        const dx = Math.sin(bearing), dy = -Math.cos(bearing);                  // world dir
        const rot = -state.camera.rotation;
        const sdx = dx * Math.cos(rot) - dy * Math.sin(rot), sdy = dx * Math.sin(rot) + dy * Math.cos(rot);
        const bx = canvas.width / 2 + (p.x - state.camera.x) * Math.cos(rot) - (p.y - state.camera.y) * Math.sin(rot);
        const by = canvas.height / 2 + (p.x - state.camera.x) * Math.sin(rot) + (p.y - state.camera.y) * Math.cos(rot);
        const m = 90;
        let D = 1e9;
        if (sdx > 1e-6) D = Math.min(D, (canvas.width - m - bx) / sdx); else if (sdx < -1e-6) D = Math.min(D, (m - bx) / sdx);
        if (sdy > 1e-6) D = Math.min(D, (canvas.height - m - by) / sdy); else if (sdy < -1e-6) D = Math.min(D, (m - by) / sdy);
        D = Math.max(160, Math.min(D, 900));
        return { x: p.x + dx * D, y: p.y + dy * D };
    },
    // The upwind lesson, laid out from wherever the player is: a buoy 850u dead upwind, and a
    // gate home down and off to one side so getting there needs one gybe.
    layoutUpwind() {
        const s = this.s, player = state.boats[0];
        const S = { x: player.x, y: player.y };
        const W  = this.pt(S.x, S.y, 850, 0);
        const H  = this.pt(W.x, W.y, -1300, -600);
        const HL = this.pt(H.x, H.y, 0, -110), HR = this.pt(H.x, H.y, 0, 110);
        Object.assign(s, { W, H, HL, HR, buoys: [{ p: W, on: true }, { p: HL, on: false }, { p: HR, on: false }] });
    },

    setControls(on) {
        this.controlsLocked = !on;
        if (on) this.kiteLocked = false;     // every hand-back (start, race, exit) frees the kite too
        if (!on) for (const k in state.keys) state.keys[k] = false;
    },
    setHud(on) {
        this.hudHidden = !on;
        const v = on ? '' : 'hidden';
        const ids = ['hud-instruments', 'hud-minimap-wrap'];
        for (const id of ids) { const el = document.getElementById(id); if (el) el.style.visibility = v; }
        if (UI.timer && UI.timer.parentElement) UI.timer.parentElement.style.visibility = v;
    },
    setPanel(on) { this.panelHidden = !on; },
    // "Here comes the wind": ramp the wind scale to a target over `secs`.
    windRamp(knots, secs) {
        const s = this.s; if (!s) return;
        const full = state.wind.baseSpeed || 7;
        s.windTarget = Math.min(1, knots / full);
        s.windRate = Math.abs(s.windTarget - (this.windScale || 0)) / Math.max(0.1, secs);
    },
    updateWind(dt) {
        const s = this.s; if (!s || s.windTarget == null || this.windScale == null) return;
        const d = s.windTarget - this.windScale;
        if (Math.abs(d) < 1e-4) return;
        this.windScale += Math.sign(d) * Math.min(Math.abs(d), s.windRate * dt);
    },
    // The keycap, drawn the way the Controls menu draws one.
    K(label) { return `<span class="ov-kbd" style="font-size:12px; margin:0 2px;">${label}</span>`; },

    firstSailSegments() {
        const S = this;
        const near = (pt, r) => S.dist(state.boats[0], pt) < r;
        const ENTER = 'Press ' + S.K('Enter') + ' to continue';
        const enterAfter = (secs) => (s) => S._enter && s.segT > secs;
        const armEnter = (s) => { S._enter = false; };
        const player = () => state.boats[0];
        const flow = () => { const w = state.wind.direction; return { x: -Math.sin(w), y: Math.cos(w) }; };
        // Each entry is one ring: a CSS selector, or a list of selectors merged into one ring.
        const rings = (...sels) => () => sels.map(sel => S.domRect(Array.isArray(sel) ? sel : [sel])).filter(Boolean);
        const TWA_PILL = '#hud-wind-angle', TWS_PILL = '#hud-wind-speed', SOG = '#hud-speed';
        const WIND_ARROW = '#hud-wind-arrow > div';   // the blue triangle itself, not its full-dial rotor
        return [
            { id: 'welcome', timeout: Infinity,
              enter: (s) => { armEnter(s); S.highlight = null; },
              lines: [{ t: 0.3, text: 'Welcome to sailing school!' }],
              goal: ENTER, done: enterAfter(1.5) },
            { id: 'boat', timeout: Infinity,
              enter: (s) => { armEnter(s); S.highlight = { world: (p) => ({ x: p.x, y: p.y, r: 70 }) }; },
              lines: [{ t: 0, text: 'This is your boat. It will stay here in the center of the screen.' }],
              goal: ENTER, done: enterAfter(1.5) },
            { id: 'wind', timeout: Infinity,
              enter: (s) => { armEnter(s); S.highlight = null; s.windIndicator = true; S.windRamp(5, 4); },
              lines: [{ t: 0, text: 'Here comes the wind from the left. Notice the wind comets showing the wind direction and speed.' }],
              goal: ENTER, done: enterAfter(2.5) },
            { id: 'wake', timeout: Infinity,
              enter: (s) => { armEnter(s); s.windIndicator = false; S.highlight = { world: (p) => ({ x: p.x - Math.sin(p.heading) * 55, y: p.y + Math.cos(p.heading) * 55, r: 48 }) }; },
              lines: [{ t: 0, text: 'Your boat is picking up speed. When your boat is moving it has a wake.' }],
              goal: ENTER, done: enterAfter(1.5) },
            { id: 'air', timeout: Infinity,
              enter: (s) => { armEnter(s); S.highlight = { world: (p) => S.dirtyAirCircle(p) }; },
              lines: [{ t: 0, text: 'The air is disturbed downwind of your sails.' }],
              goal: ENTER, done: enterAfter(1.5) },
            { id: 'angle', timeout: Infinity,
              enter: (s) => { armEnter(s); S.setPanel(true); S.highlight = { dom: () => [S.panelRect()].filter(Boolean) }; },
              lines: [{ t: 0, text: 'The wind is blowing at 90 degrees to your boat. Just on the side.' }],
              goal: ENTER, done: enterAfter(1.5) },
            { id: 'twa', timeout: Infinity,
              enter: (s) => { armEnter(s); S.setHud(true); S.highlight = { dom: rings(TWA_PILL, WIND_ARROW) }; },
              lines: [{ t: 0, text: 'Your angle to the wind is also shown on your instruments.' }],
              goal: ENTER, done: enterAfter(1.5) },
            { id: 'tws', timeout: Infinity,
              enter: (s) => { armEnter(s); S.highlight = { dom: rings(TWS_PILL) }; },
              lines: [{ t: 0, text: 'Your instruments also tell you the wind speed.' }],
              goal: ENTER, done: enterAfter(1.5) },
            { id: 'sog', timeout: Infinity,
              enter: (s) => { armEnter(s); S.highlight = { dom: rings(SOG) }; },
              lines: [{ t: 0, text: 'You can see your boat speed.' }],
              goal: ENTER, done: enterAfter(1.5) },
            { id: 'build', timeout: Infinity,
              enter: (s) => { armEnter(s); S.windRamp(7, 5); S.highlight = { dom: rings(TWS_PILL, SOG) }; },
              lines: [{ t: 0, text: 'The wind is building, increasing its speed and your boat speed.' }],
              goal: ENTER, done: enterAfter(3) },
            { id: 'steer', timeout: Infinity,
              enter: (s) => { S.highlight = null; S.setControls(true); S.kiteLocked = true; s.turnL = 0; s.turnR = 0; },
              lines: [{ t: 0, text: 'Turn the boat with ' + S.K('&larr;') + '/' + S.K('&rarr;') + ' or ' + S.K('A') + '/' + S.K('D') + '.' }],
              goal: 'Turn to the left and right.',
              done: (s) => s.turnL >= Math.PI / 4 && s.turnR >= Math.PI / 4 },
            { id: 'twa-turn', timeout: Infinity,
              enter: (s) => { s.turnL = 0; s.turnR = 0; S.highlight = { dom: () => [S.panelRect()].filter(Boolean) }; },
              lines: [{ t: 0, text: 'Notice that your angle to the wind changes as you turn.' }],
              goal: 'Turn to the left and right.',
              done: (s) => s.turnL >= Math.PI / 4 && s.turnR >= Math.PI / 4 },
            { id: 'ducks', timeout: Infinity,
              enter: (s) => { S.highlight = null; S.setHud(true); S.setPanel(true); S.spawnBeamDucks(); s.duckHoldOff = false; },
              lines: [{ t: 0, text: 'Try sailing towards a goal.' }],
              goal: 'Follow the ducklings',
              done: (s) => s.ducks.length > 0 && S.dist(player(), s.ducks[0]) < 60,
              exitLine: "That's a reach — wind on your side. Fastest, easiest point of sail." },
            { id: 'upwind', timeout: Infinity,
              enter: (s) => { S.spawnUpwindDucks(); s.up = { phase: 'sail', zoneT: 0, tacks0: s.tacks }; },
              lines: [{ t: 0, text: 'Try sailing upwind.' }],
              goal: 'Follow the ducklings',
              tick: (s, r) => S.tickUpwind(s, r),
              done: (s) => s.upGap != null && s.upGap < 60 },
            { id: 'downwind', timeout: Infinity,
              enter: (s) => { s.coneOn = false; S.spawnDucksAt(normalizeAngle(S.wd() + Math.PI)); s.dw = { phase: 'sail' }; s.duckHoldOff = true; },
              lines: [{ t: 0, text: "Let's sail downwind." }],
              goal: 'Follow the ducklings',
              tick: (s, r) => S.tickDownwind(s, r),
              done: (s) => s.dw.phase === 'kite' && s.ducks.length > 0 && S.dist(player(), s.ducks[0]) < 60 },
            { id: 'closereach', timeout: Infinity,
              enter: (s) => { const side = S.playerRead().twa >= 0 ? 1 : -1; S.spawnDucksAt(normalizeAngle(S.wd() + side * 60 * Math.PI / 180)); s.cr = { phase: 'sail' }; s.duckHoldOff = true; },
              lines: [{ t: 0, text: 'Sail upwind again.' }],
              goal: 'Follow the ducklings',
              tick: (s, r) => S.tickCloseReach(s, r),
              done: (s) => s.cr.phase === 'again' && s.ducks.length > 0 && S.dist(player(), s.ducks[0]) < 60 },
        ];
    },

    nextSegment() {
        const s = this.s;
        if (s.segIdx >= 0 && this.segments[s.segIdx]) {
            const seg = this.segments[s.segIdx];
            this.log.push({ unit: this.unit, seg: seg.id, t: +s.segT.toFixed(1), by: s.byTimer ? 'timer' : 'verb' });
            if (seg.exitLine && !s.byTimer) { s.exitLine = seg.exitLine; s.exitT = 0; this.say(seg.exitLine); }
        }
        s.segIdx++;
        s.segT = 0; s.lineIdx = -1; s.byTimer = false;
        while (this.segments[s.segIdx] && this.segments[s.segIdx].skipIf && this.segments[s.segIdx].skipIf(s)) s.segIdx++;
        const seg = this.segments[s.segIdx];
        if (!seg) { this.goal(null); this.onFirstSailDone(); return; }
        this.goal(null);
        this._lines = s.exitLine ? [s.exitLine] : []; this.renderLines();
        if (seg.enter) seg.enter(s);
        this.goal(seg.goal || null);
    },

    updateFirstSail(dt) {
        const s = this.s, r = this.playerRead();
        s.t += dt; s.segT += dt;
        if (s.exitLine) s.exitT += dt;

        // Helm travel, for the first goal: how far they have turned each way, cumulative.
        { const dh = normalizeAngle(r.p.heading - s.prevHeading); s.prevHeading = r.p.heading;
          if (dh > 0) s.turnR += dh; else s.turnL -= dh; }

        // Verb tracking, every frame, whatever the script is saying.
        // A tack or a gybe is the wind changing sides. Sampled only outside a dead band
        // around head-to-wind and dead downwind, so a bow hunting through the eye counts
        // once, when it comes out the other side, not every frame it wavers.
        if (r.abs > 12 * Math.PI / 180 && r.abs < 168 * Math.PI / 180) {
            const side = r.twa > 0 ? 1 : -1;
            if (s.lastSide !== 0 && side !== s.lastSide) {
                if (r.abs < 90 * Math.PI / 180) s.tacks++; else s.gybes++;
            }
            s.lastSide = side;
        }
        s.stalled = s.stalled || (r.kts < 1.6 && r.abs < 34 * Math.PI / 180 && s.t > 3);
        if (s.B3) {
            if (!s.passedB3 && this.dist(r.p, s.B3) < 160) s.passedB3 = true;
            if (!s.roundedW && this.dist(r.p, s.W) < 220) s.roundedW = true;
            if (!s.crossedHome && hullCrossedLine(r.p, s.HL.x, s.HL.y, s.HR.x, s.HR.y)) s.crossedHome = true;
        }

        // Buoys go out as they are passed.
        for (const b of s.buoys) if (b.on && !b.done && this.dist(r.p, b.p) < 90) b.done = true;

        // The script.
        const seg = this.segments[s.segIdx];
        if (seg) {
            const lines = seg.lines || [];
            while (s.lineIdx + 1 < lines.length && lines[s.lineIdx + 1].t <= s.segT) {
                s.lineIdx++;
                s.exitLine = null;
                this.say(lines[s.lineIdx].text);
            }
            if (s.exitLine && s.exitT > 3.5 && s.lineIdx < 0 && !this._goalOn) { s.exitLine = null; this.hideCard(); }
            if (seg.tick) seg.tick(s, r);
            if (seg.done(s, r)) { if (seg.exit) seg.exit(s); this.nextSegment(); }
            else if (s.segT >= seg.timeout) { s.byTimer = true; s.timerAdvances++; this.nextSegment(); }
        }

        this.updateCompanions(dt, r);
        this.keepClassmatesSailing();
    },

    onFirstSailDone() {
        this.say("That's the boat. Let's take it to the pond.");
        this._handoff = 3.0;
    },

    // ── UNIT 2 · THE POND ─────────────────────────────────────────────────────
    // The pond proper, for the first time: land, marks, the launch at the line. Free sailing
    // for now — the lessons that live here are still being written.
    beginPond() {
        const player = state.boats[0];
        const C = state.course.marks;
        const cx = (C[0].x + C[1].x) / 2, cy = (C[0].y + C[1].y) / 2;
        const S = this.pt(cx, cy, -500, 300);                 // below the line, a little to one side
        this.placeBoat(player, S, normalizeAngle(this.wd() + Math.PI / 2), 4);
        state.race.status = 'racing';
        state.race.timer = 0;
        snapCameraToStart();
        this.s = { kind: 'pond', t: 0, ducks: [], launch: null, buoys: [], coneOn: false, highlight: null };
        this.setControls(true); this.setHud(true); this.setPanel(true); this.goal(null);
        this.windScale = null; this.highlight = null;
        this.say('Welcome to Duckling Pond. Have a sail around.');
    },
    updatePond(dt) {
        this.s.t += dt;
    },

    // ── UNIT 2 · THE START ────────────────────────────────────────────────────
    beginStart() {
        const player = state.boats[0];
        if (this.unit !== 3 || !this.s || this.s.kind !== 'start') {
            this.s = { kind: 'start', run: 0, launch: { x: player.x, y: player.y, h: player.heading },
                       ducks: this.makeDucks(player), duckMode: 'launch', t: 0, phase: 'setup', results: [] };
        }
        this.startRun();
    },

    startRun() {
        const s = this.s, player = state.boats[0];
        this.setControls(true); this.setHud(true); this.setPanel(true); this.goal(null);
        this.windScale = null; this.highlight = null;
        s.run++;
        s.phase = 'prestart';
        s.t = 0;
        s.said = {};
        // Reset the player's race state for a fresh crossing.
        const rs = player.raceState;
        rs.leg = 0; rs.ocs = false; rs.finished = false; rs.startTimeDisplayTimer = 0;
        rs.penaltyTurnsOwed = 0; rs.penalty = false;
        // Close to the line, reaching along it: the natural, unthinking thing is to be early.
        const [m0, m1] = startLinePts();
        const cross = startCrossNormal();
        const lx = m1.x - m0.x, ly = m1.y - m0.y;
        const P = { x: m0.x + lx * 0.12 - cross.x * 150, y: m0.y + ly * 0.12 - cross.y * 150 };
        this.placeBoat(player, P, this.headingOf(lx, ly), 5);
        state.race.status = 'prestart';
        state.race.timer = 20;
        state.race.startTimerDuration = 20;
        hideRaceMessage();
        snapCameraToStart();
        this.say(s.run === 1 ? 'Cross the line when the clock hits zero. Not before.'
                             : 'Again. Use the time — sail away, turn back, arrive at full speed.');
    },

    updateStart(dt) {
        const s = this.s, r = this.playerRead(), rs = r.p.raceState;
        s.t += dt;
        this.updateCompanions(dt, r);
        this.keepClassmatesSailing();

        if (s.phase === 'prestart' && state.race.status === 'racing') {
            s.phase = 'gun';
            s.gunT = 0;
        }
        if (s.phase === 'gun') {
            s.gunT += dt;
            if (rs.ocs && !s.said.ocs) { s.said.ocs = true; this.say('Over early. Drop back below the line and cross again.'); }
            if (rs.leg >= 1) {
                const late = rs.startTimeDisplay;
                const wasOcs = !!s.said.ocs;
                s.results.push({ run: s.run, late: +late.toFixed(1), ocs: wasOcs });
                s.phase = 'done'; s.doneT = 0;
                if (wasOcs) this.say('Back in the race. Now once more, on time.');
                else if (late > 4) this.say(`${Math.round(late)} seconds late. That's a boat length a second, gone.`);
                else { this.say("That's the start. Everything after it is easier."); s.clean = true; }
            } else if (s.gunT > 30) {
                s.results.push({ run: s.run, late: null, ocs: !!s.said.ocs });
                s.phase = 'done'; s.doneT = 0;
                this.say('Never mind. Let\'s go again.');
            }
        }
        if (s.phase === 'done') {
            s.doneT += dt;
            if (s.doneT > 3.5) {
                if (s.clean || s.run >= 2) { this.say('Now the real thing. Three classmates, one lap.'); this._handoff = 3.0; s.phase = 'handoff'; }
                else this.startRun();
            }
        }
    },

    // ── UNIT 3 · THE GRADUATION RACE ──────────────────────────────────────────
    beginRace() {
        this.setControls(true); this.setHud(true); this.setPanel(true); this.goal(null);
        this.windScale = null; this.highlight = null;
        settings.penaltiesEnabled = true;
        resetGame();
        this.liftArena();
        const player = state.boats[0];
        this.s = { kind: 'race', launch: { x: player.x, y: player.y, h: player.heading }, ducks: this.makeDucks(player),
                   duckMode: 'launch', t: 0, coneOn: true, said: {}, ocsAtGun: false,
                   pinchT: 0, beatT: 0, kiteUpwindT: 0, wrongWay: 0, finishRank: null };
        beginRace();                         // the shipped prestart: leaderboard, clock, music
        state.race.timer = state.race.startTimerDuration = 20;
        this.say('Real start, real gun. Cone comes off when it fires.');
    },

    updateRace(dt) {
        const s = this.s, r = this.playerRead(), rs = r.p.raceState;
        s.t += dt;
        this.updateCompanions(dt, r);

        if (state.race.status === 'racing' && !s.said.gun) {
            s.said.gun = true; s.coneOn = false;
            s.ocsAtGun = !!rs.ocs;
            this.say(s.ocsAtGun ? 'Over early. Back below the line, then go.' : "Cone's gone. You've got it.");
        }
        if (state.race.status !== 'racing' || rs.finished) return;

        // The rules, coached live off the same debounced verdict the overlay draws.
        const pairs = (typeof drawRulesOverlay === 'function' && drawRulesOverlay._pairs) || null;
        if (pairs && !s.said.rules) {
            for (let j = 1; j < state.boats.length; j++) {
                const ps = pairs.get(j);
                if (ps && ps.show && !ps.pend && ps.wi !== 0) {
                    s.said.rules = true;
                    this.say('Red triangle: you give way. Green: they do.');
                    s.ruleT = s.t; s.pendingRule = ps.rule;
                    break;
                }
            }
        }
        if (s.pendingRule && s.t - s.ruleT > 3.2) {
            if (/10/.test(s.pendingRule)) this.say("They're on starboard. Steer behind them.");
            s.pendingRule = null;
        }
        if (rs.penaltyTurnsOwed > 0 && !s.said.pen) { s.said.pen = true; this.say('You owe a 360. Spin one.'); }
        if (rs.penaltyTurnsOwed === 0 && s.said.pen && !s.said.penClear) { s.said.penClear = true; this.say('Clear. Carry on.'); }

        // What the debrief will say: measured, not guessed.
        const upwind = r.abs < 60 * Math.PI / 180;
        if (rs.leg === 1 && upwind) { s.beatT += dt; if (r.abs < 35 * Math.PI / 180) s.pinchT += dt; }
        if (r.kite && r.abs < 90 * Math.PI / 180) s.kiteUpwindT += dt;
        if (rs.leg >= 2 && s.duckMode !== 'follow') s.duckMode = 'follow';
    },

    onResults() {
        // The player's boat has faded: graduation. Ducklings fall in behind (already following).
        const s = this.s, player = state.boats[0];
        const sorted = [...state.boats].sort((a, b) => {
            const fa = a.raceState.finished && !a.raceState.resultStatus, fb = b.raceState.finished && !b.raceState.resultStatus;
            if (fa !== fb) return fa ? -1 : 1;
            if (fa) return a.raceState.finishTime - b.raceState.finishTime;
            return getBoatProgress(b) - getBoatProgress(a);
        });
        s.finishRank = sorted.indexOf(player) + 1;
        const graduated = player.raceState.finished && !player.raceState.resultStatus;
        if (graduated) this.saveProgress({ graduated: true, graduatedAt: new Date().toISOString(), rank: s.finishRank });
        console.log('[school] run', JSON.stringify({ log: this.log, race: { rank: s.finishRank, ocs: s.ocsAtGun, pinchT: +s.pinchT.toFixed(1), beatT: +s.beatT.toFixed(1), kiteUpwindT: +s.kiteUpwindT.toFixed(1), penalties: player.raceState.totalPenalties } }));
        this.hideCard();
        this.showDebrief(graduated, s.finishRank, player);
    },

    debriefLines(graduated, rank, player) {
        const s = this.s, rs = player.raceState;
        const lines = [];
        if (!graduated) lines.push("Didn't finish this one. Everyone's first race is a mess.");
        else lines.push(rank === 1 ? 'Won it. Good.' : `${['', 'First', 'Second', 'Third', 'Fourth'][rank] || rank + 'th'} of four. That counts.`);
        if (s.ocsAtGun) lines.push('Over early at the gun — you gave the fleet a head start.');
        else lines.push(rs.startLegDuration != null && rs.startLegDuration > 5 ? `Started ${Math.round(rs.startLegDuration)} seconds late. Arrive at speed next time.` : 'Good start.');
        const pinchFrac = s.beatT > 5 ? s.pinchT / s.beatT : 0;
        if (pinchFrac > 0.25) lines.push('You pinched on the beat. Err wide, never high.');
        else if (s.kiteUpwindT > 6) lines.push('Kite came down late. When it shakes, drop it.');
        else if (rs.totalPenalties > 0) lines.push(`${rs.totalPenalties} penalty turn${rs.totalPenalties > 1 ? 's' : ''}. Red triangle means you give way.`);
        else lines.push('Clean beat, kite down in time. Nothing to fix.');
        return lines;
    },

    // ── the companions: the launch and the ducklings ──────────────────────────
    makeDucks(at) {
        const d = [];
        for (let i = 0; i < 5; i++) d.push({ x: at.x - i * 24, y: at.y + (i % 2 ? 8 : -8), h: 0 });
        return d;
    },
    pathPoint(path, dist) {
        let acc = 0;
        for (let i = 0; i + 1 < path.length; i++) {
            const a = path[i], b = path[i + 1], L = this.dist(a, b);
            if (dist <= acc + L) { const t = (dist - acc) / L; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
            acc += L;
        }
        return path[path.length - 1];
    },
    pathProgress(path, p) {
        let best = 0, bestD = Infinity, acc = 0;
        for (let i = 0; i + 1 < path.length; i++) {
            const a = path[i], b = path[i + 1];
            const c = getClosestPointOnSegment(p.x, p.y, a.x, a.y, b.x, b.y);
            const d = this.dist(c, p);
            if (d < bestD) { bestD = d; best = acc + this.dist(a, c); }
            acc += this.dist(a, b);
        }
        return best;
    },
    updateCompanions(dt, r) {
        const s = this.s, p = r.p;
        const hx = Math.sin(p.heading), hy = -Math.cos(p.heading);
        const L = s.launch;
        if (L) {
            // The launch motors alongside — off the player's quarter, on whichever side is
            // away from the wind so it never sits in the lane the player is about to tack into.
            const side = r.twa > 0 ? -1 : 1;
            const px = -hy, py = hx;
            const target = { x: p.x - hx * 40 + px * side * 230, y: p.y - hy * 40 + py * side * 230 };
            const k = 1 - Math.pow(0.15, dt);
            const wasX = L.x, wasY = L.y;
            L.x += (target.x - L.x) * k; L.y += (target.y - L.y) * k;
            const mv = Math.hypot(L.x - wasX, L.y - wasY);
            if (mv > 0.2) L.h += normalizeAngle(this.headingOf(L.x - wasX, L.y - wasY) - L.h) * Math.min(1, dt * 4);
        }

        // The ducklings: a chain following a leader point.
        let lead;
        if (s.duckMode === 'beam') {
            // Heading at them (within ~14°) and they stay put, so the boat closes; anywhere
            // else and they slide to keep station at the screen's edge on the beam.
            // `duckHoldOff`: a beat that still has something to teach before the ducks may be
            // reached (hoist the kite, drop it) keeps them at the edge even when aimed at.
            const aligned = !s.duckHoldOff && Math.abs(normalizeAngle(p.heading - s.beamBearing)) < 14 * Math.PI / 180;
            if (!aligned) {
                const T = this.beamTarget(), k = 1 - Math.pow(0.02, dt);
                s.duckLead.x += (T.x - s.duckLead.x) * k; s.duckLead.y += (T.y - s.duckLead.y) * k;
            }
            lead = s.duckLead;
            // Facing away from the boat, whether or not they are moving.
            for (const d of s.ducks) d.h = s.beamBearing;
        } else if (s.duckMode === 'upwind') {
            const U = this.U(), R = this.R();
            const pu = (p.x - s.upBase.x) * U.x + (p.y - s.upBase.y) * U.y;    // player's ground to windward
            const pr = (p.x - s.upBase.x) * R.x + (p.y - s.upBase.y) * R.y;
            const T = this.edgeTarget(this.wd());
            const edgeAlong = (T.x - s.upBase.x) * U.x + (T.y - s.upBase.y) * U.y;
            // Until the first tack they hold the edge outright — a boat pinned on one tack can
            // only drift sideways of them; after it the gap closes with every yard to windward.
            const tacked = s.up && (s.tacks - s.up.tacks0) >= 1;
            s.upAlong = tacked ? Math.min(s.upAlong, edgeAlong) : edgeAlong;
            s.upGap = s.upAlong - pu;
            const k = 1 - Math.pow(0.02, dt);
            const goalX = s.upBase.x + U.x * s.upAlong + R.x * pr, goalY = s.upBase.y + U.y * s.upAlong + R.y * pr;
            s.duckLead.x += (goalX - s.duckLead.x) * k; s.duckLead.y += (goalY - s.duckLead.y) * k;
            lead = s.duckLead;
            for (const d of s.ducks) d.h = this.wd();
        } else if (s.duckMode === 'hold') {
            lead = s.duckLead || (s.ducks[0] ? { x: s.ducks[0].x, y: s.ducks[0].y } : { x: p.x, y: p.y });
        } else if (s.duckMode === 'lead' && s.path) {
            const prog = Math.min(this.pathProgress(s.path, p) + 170, this.pathLen(s.path));
            lead = this.pathPoint(s.path, prog);
        } else if (s.duckMode === 'follow') {
            lead = { x: p.x - hx * 70, y: p.y - hy * 70 };
        } else if (s.kind !== 'sail') {
            // Rafted up in the lee of the committee boat, watching the class.
            const cm = (state.course.marks || []).find(m => m.kind === 'committee') || state.course.marks[1];
            const R = this.R();
            lead = { x: cm.x + R.x * 70 + Math.sin(state.time * 1.3) * 12, y: cm.y + R.y * 70 + Math.cos(state.time * 1.1) * 12 };
        } else if (L) {
            lead = { x: L.x - Math.sin(L.h) * 60, y: L.y + Math.cos(L.h) * 60 };
        } else {
            lead = s.ducks[0] ? { x: s.ducks[0].x, y: s.ducks[0].y } : { x: p.x, y: p.y };
        }
        const dk = 1 - Math.pow(0.05, dt);
        const faceAway = s.duckMode === 'beam' || s.duckMode === 'upwind';
        let prev = lead;
        for (const d of s.ducks) {
            const tx = prev.x, ty = prev.y;
            const dx = tx - d.x, dy = ty - d.y, dd = Math.hypot(dx, dy);
            if (dd > 22) { d.x += dx * dk; d.y += dy * dk; if (!faceAway) d.h = this.headingOf(dx, dy); }
            prev = d;
        }
    },
    pathLen(path) { let L = 0; for (let i = 0; i + 1 < path.length; i++) L += this.dist(path[i], path[i + 1]); return L; },

    // In the lessons the classmates just sail the course, round and round.
    keepClassmatesSailing() {
        for (const b of state.boats) {
            if (b.isPlayer || !b.raceState.finished) continue;
            const rs = b.raceState;
            rs.finished = false; rs.resultStatus = undefined; rs.leg = 0; rs.ocs = false;
            b.opacity = 1; b.fadeTimer = FINISH_FADE_SECS;
        }
    },

    // ── per-frame ─────────────────────────────────────────────────────────────
    update(dt) {
        if (!this.active || !this.s) return;
        if (this._handoff != null) {
            this._handoff -= dt;
            if (this._handoff <= 0) {
                this._handoff = null;
                if (this.s.kind === 'sail') { this.unit = 2; this.start(2); }
                else if (this.s.kind === 'start') { this.unit = 4; this.beginRace(); }
                return;
            }
        }
        this.updateWind(dt);
        if (this.s.kind === 'sail') this.updateFirstSail(dt);
        else if (this.s.kind === 'pond') this.updatePond(dt);
        else if (this.s.kind === 'start') this.updateStart(dt);
        else if (this.s.kind === 'race') this.updateRace(dt);
        this.updateRing();

        // HUD furniture: no clock or leaderboard on a lesson; both back for the race.
        const lesson = this.s.kind !== 'race';
        // The clock is the whole lesson in unit 2; it means nothing on the First Sail.
        if (UI.timer) UI.timer.style.visibility = (this.s.kind === 'sail' || this.s.kind === 'pond') ? 'hidden' : '';
        if (lesson && UI.leaderboard) UI.leaderboard.classList.add('hidden');
        if (UI.legInfo) UI.legInfo.parentElement.classList.toggle('hidden', lesson);
        // The minimap is a picture of the course; the First Sail has none to show.
        const mm = document.getElementById('minimap');
        if (mm && mm.parentElement) mm.parentElement.style.visibility = this.s.kind === 'sail' ? 'hidden' : '';
    },

    skip() {
        if (!this.active || !this.s) return;
        if (this.s.kind === 'sail') { this.s.byTimer = true; this.nextSegment(); }
        else if (this.s.kind === 'pond') { this.unit = 3; this.start(3); }
        else if (this.s.kind === 'start') { this.unit = 4; this.beginRace(); }
    },
    skipToRace() { if (this.active) { this.unit = 4; this.beginRace(); } },

    // ── the overlays: buoys, launch, ducklings, ribbon, cone ──────────────────
    drawWorld(ctx) {
        if (!this.active || !this.s) return;
        const s = this.s, player = state.boats[0];
        if (s.windIndicator) this.drawWindIndicator(ctx, player);
        if (s.coneOn) this.drawCone(ctx, player);

        if (s.buoys) {
            const sp = markSprite('can');
            for (const b of s.buoys) {
                if (!b.on) continue;
                ctx.save();
                ctx.translate(b.p.x, b.p.y);
                ctx.globalAlpha = b.done ? 0.35 : 1;
                if (sp && sp.img && sp.img.naturalWidth) {
                    const W = sp.world, H = W * (sp.img.naturalHeight / sp.img.naturalWidth);
                    ctx.drawImage(sp.img, -W / 2, -H / 2, W, H);
                } else {
                    ctx.fillStyle = '#F5C518'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
                }
                if (!b.done) {
                    ctx.strokeStyle = 'rgba(245,197,24,0.55)'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(0, 0, 34 + Math.sin(state.time * 6) * 4, 0, Math.PI * 2); ctx.stroke();
                }
                ctx.restore();
            }
        }
        // On the First Sail the launch motors alongside. For the start and the race it IS the
        // committee boat at the line's boat end — the venue draws that mark — so the ducklings
        // raft up beside it and the launch is not drawn twice.
        if (s.kind === 'sail' && s.launch) this.drawLaunch(ctx, s.launch);
        for (const d of s.ducks) this.drawDuck(ctx, d);
    },

    // ── the teal ring: what Paddle is pointing at ─────────────────────────────
    drawAbove(ctx) {
        const h = this.highlight;
        if (!h || !h.world || !state.boats[0]) return;
        const c = h.world(state.boats[0]);
        const pulse = 1 + 0.08 * Math.sin(state.time * 9);
        ctx.save();
        ctx.strokeStyle = 'rgba(64, 245, 200, 0.95)';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(64, 245, 200, 0.8)'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    },
    // The ring round the disturbed air is fitted to the dots drawDisturbedAir actually paints
    // (boat.turbulence: distance `d` downwind, `crossRatio` across a cone that widens with d),
    // taking the near, visible part of the plume — alpha is gone by 450u.
    // A FIXED circle just to leeward of the sails: fitting it to the live particles made it
    // breathe with the plume every frame. Centred 85u downwind (the plume's dense part, per
    // drawDisturbedAir's 20u-wide cone start), radius 50 so it clears the hull.
    dirtyAirCircle(p) {
        const w = getWindAt(p.x, p.y).direction;
        const wx = -Math.sin(w), wy = Math.cos(w);
        return { x: p.x + wx * 85, y: p.y + wy * 85, r: 50 };
    },
    // Page rectangle of the canvas panel under the boat (drawBoatInstruments' geometry).
    panelRect() {
        const p = state.boats[0]; if (!p) return null;
        const rot = -state.camera.rotation;
        const dx = p.x - state.camera.x, dy = p.y - state.camera.y;
        const sx = canvas.width / 2 + dx * Math.cos(rot) - dy * Math.sin(rot);
        const sy = canvas.height / 2 + dx * Math.sin(rot) + dy * Math.cos(rot);
        const rect = canvas.getBoundingClientRect(), k = rect.width / canvas.width;
        const W = (typeof BI_W !== 'undefined') ? BI_W : 52, H = (typeof BI_H !== 'undefined') ? BI_H : 24, D = (typeof BI_DROP !== 'undefined') ? BI_DROP : 34;
        return { x: rect.left + (sx - W / 2) * k, y: rect.top + (sy + D) * k, w: W * k, h: H * k };
    },
    domRect(sels) {
        let r = null;
        for (const sel of sels) {
            let el = document.querySelector(sel); if (!el) continue;
            // A bare readout number rings its whole pill.
            if (el.tagName === 'SPAN' && el.parentElement && el.parentElement.classList.contains('rounded-full')) el = el.parentElement;
            const b = el.getBoundingClientRect(); if (!b.width) continue;
            r = r ? { x: Math.min(r.x, b.left), y: Math.min(r.y, b.top), x2: Math.max(r.x2, b.right), y2: Math.max(r.y2, b.bottom) }
                  : { x: b.left, y: b.top, x2: b.right, y2: b.bottom };
        }
        return r ? { x: r.x, y: r.y, w: r.x2 - r.x, h: r.y2 - r.y } : null;
    },
    updateRing() {
        this.ensureDom();
        const h = this.highlight;
        let rects = h && h.dom ? h.dom() : [];
        if (rects && !Array.isArray(rects)) rects = [rects];
        rects = rects || [];
        const rings = this._dom.rings;
        while (rings.length < rects.length) {
            const el = this._dom.ring.cloneNode(false); document.body.appendChild(el); rings.push(el);
        }
        rings.forEach((ring, i) => {
            const r = rects[i];
            if (!r) { ring.style.display = 'none'; return; }
            const pad = 8, size = Math.max(r.w, r.h) + pad * 2;
            ring.style.display = 'block';
            ring.style.left = (r.x + r.w / 2 - size / 2) + 'px';
            ring.style.top = (r.y + r.h / 2 - size / 2) + 'px';
            ring.style.width = size + 'px'; ring.style.height = size + 'px';
        });
    },

    // ONE big arrow, the direction the wind is moving, riding upwind of the boat so it
    // always points at the player. Replaces the ribbon on the First Sail: one unmissable
    // fact instead of a field of small ones.
    drawWindIndicator(ctx, player) {
        const w = state.wind.direction;
        const fx = -Math.sin(w), fy = Math.cos(w);            // where the wind goes TO
        // It drifts slowly the way the wind goes and back — motion says direction better
        // than a shape does — over ~2 s, ±25u along the flow.
        const drift = Math.sin(state.time * 9.45) * 25;
        const ax = player.x - fx * (330 - drift), ay = player.y - fy * (330 - drift);
        const pulse = 0.75 + 0.25 * Math.sin(state.time * 5);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(Math.atan2(fy, fx));                       // +x now points downwind
        ctx.globalAlpha = 0.55 * pulse + 0.25;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(8,16,28,0.55)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-90, -22); ctx.lineTo(30, -22); ctx.lineTo(30, -52); ctx.lineTo(110, 0);
        ctx.lineTo(30, 52); ctx.lineTo(30, 22); ctx.lineTo(-90, 22); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
        // The label, upright on screen whatever the camera is doing, sitting above the arrow.
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(state.camera.rotation);    // draw() rotated the world by -rotation; undo it
        ctx.globalAlpha = 0.9;
        ctx.font = "800 26px 'Archivo', sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,16,28,0.7)'; ctx.fillStyle = '#ffffff';
        ctx.strokeText('WIND', 0, -78); ctx.fillText('WIND', 0, -78);
        ctx.restore();
    },

    drawWindRibbon(ctx) {
        // Where the wind is coming from, unmissable: streaks flowing downwind over the water
        // around the camera. Not a particle system — a fixed grid in world space, phased by
        // time along the flow, so it is stateless and never reads as objects.
        const w = state.wind.direction, sp = Math.max(4, state.wind.speed);
        const fx = -Math.sin(w), fy = Math.cos(w);          // flow direction (where the wind goes TO)
        const gap = 300, len = 110;
        const phase = (state.time * 60 * sp * 0.6) % gap;
        const cx = state.camera.x, cy = state.camera.y, R = Math.max(canvas.width, canvas.height) * 0.75;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        // Grid axes aligned to the wind: i along the flow, j across.
        const ax = fx, ay = fy, bx = -fy, by = fx;
        const n = Math.ceil(R / gap) + 1;
        const i0 = Math.round((cx * ax + cy * ay) / gap), j0 = Math.round((cx * bx + cy * by) / gap);
        for (let i = i0 - n; i <= i0 + n; i++) {
            for (let j = j0 - n; j <= j0 + n; j++) {
                const stagger = (j % 2) ? gap * 0.5 : 0;
                const u = i * gap + phase + stagger, v = j * gap;
                const x = ax * u + bx * v, y = ay * u + by * v;
                if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
                const ex = x + fx * len, ey = y + fy * len;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
                // arrowhead
                ctx.moveTo(ex, ey); ctx.lineTo(ex - fx * 16 - fy * 9, ey - fy * 16 + fx * 9);
                ctx.moveTo(ex, ey); ctx.lineTo(ex - fx * 16 + fy * 9, ey - fy * 16 - fx * 9);
                ctx.stroke();
            }
        }
        ctx.restore();
    },

    drawCone(ctx, player) {
        // The no-go zone, on the water, from the bow. ~38° either side of the wind: that is
        // where J111_POLARS runs out (full speed at 38°, nothing at 30°), not the textbook 45°.
        const w = state.wind.direction, half = 38 * Math.PI / 180, L = 720;
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(w);
        const g = ctx.createRadialGradient(0, 0, 40, 0, 0, L);
        g.addColorStop(0, 'rgba(255,70,70,0.22)');
        g.addColorStop(1, 'rgba(255,70,70,0.0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, L, -Math.PI / 2 - half, -Math.PI / 2 + half);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,110,110,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-Math.PI / 2 - half) * L, Math.sin(-Math.PI / 2 - half) * L);
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-Math.PI / 2 + half) * L, Math.sin(-Math.PI / 2 + half) * L);
        ctx.stroke();
        ctx.restore();
    },

    // The launch sprite: art/masters/pond/coach-launch.png through ingest.py (manifest
    // `pond-coach-launch`, world 130 - sized by the drake aboard against the ducklings, see
    // the manifest note). The vector launch below only shows until the image arrives.
    LAUNCH_WORLD: 130,
    launchSprite() {
        if (!this._launchImg) { this._launchImg = new Image(); this._launchImg.src = 'assets/images/props/pond/coach-launch.png'; }
        return this._launchImg.complete && this._launchImg.naturalWidth ? this._launchImg : null;
    },
    drawLaunch(ctx, L) {
        const img = this.launchSprite();
        if (img) {
            const W = this.LAUNCH_WORLD;
            ctx.save();
            ctx.translate(L.x, L.y);
            ctx.rotate(L.h);
            ctx.drawImage(img, -W / 2, -W / 2, W, W);
            ctx.restore();
            return;
        }
        ctx.save();
        ctx.translate(L.x, L.y);
        ctx.rotate(L.h);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.ellipse(3, 4, 15, 30, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#F4F1E8'; ctx.strokeStyle = '#7A5A38'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -32); ctx.quadraticCurveTo(15, -18, 14, 10); ctx.quadraticCurveTo(13, 28, 0, 28);
        ctx.quadraticCurveTo(-13, 28, -14, 10); ctx.quadraticCurveTo(-15, -18, 0, -32); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#F58A00'; ctx.fillRect(-11, -6, 22, 5);            // the orange band
        ctx.fillStyle = '#6B4A2A'; ctx.fillRect(-9, 2, 18, 14);             // cockpit
        ctx.fillStyle = '#2FAE5C'; ctx.beginPath(); ctx.arc(0, 9, 5, 0, Math.PI * 2); ctx.fill();   // Paddle
        ctx.fillStyle = '#F5C518'; ctx.beginPath(); ctx.arc(0, 4, 2, 0, Math.PI * 2); ctx.fill();   // the bill
        ctx.restore();
    },

    // The duckling sprite: art/elements/pond/duckling.png through ingest.py, baked at 56px for a
    // 14px display (manifest `pond-duckling`, world 14). Loaded once, lazily; the vector bird
    // below only shows until the image arrives.
    // Larger than life (manifest world 14): a 14px bird is a dot at race scale, and these are
    // the thing the first card tells the player to follow.
    DUCK_WORLD: 22,
    duckSprite() {
        if (!this._duckImg) { this._duckImg = new Image(); this._duckImg.src = 'assets/images/props/pond/duckling.png'; }
        return this._duckImg.complete && this._duckImg.naturalWidth ? this._duckImg : null;
    },
    drawDuck(ctx, d) {
        const img = this.duckSprite();
        if (img) {
            const W = this.DUCK_WORLD;
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.h);
            ctx.drawImage(img, -W / 2, -W / 2, W, W);
            ctx.restore();
            return;
        }
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.h);
        ctx.fillStyle = '#F5C518';
        ctx.beginPath(); ctx.ellipse(0, 1, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#E36B1E';
        ctx.beginPath(); ctx.moveTo(-2, -9); ctx.lineTo(2, -9); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill();
        ctx.restore();
    },

    // ── the instructor card, the skip controls and the debrief ────────────────
    ensureDom() {
        if (this._dom) return;
        const card = document.createElement('div');
        card.id = 'school-card';
        // ONE BOX: Paddle's lines on top (every line of the current goal stays up until the
        // goal is met), the goal along the bottom.
        card.style.cssText = 'position:fixed; left:50%; transform:translateX(-50%); z-index:60; bottom:26px;'
            + 'display:none; flex-direction:column; width:min(92vw,640px);'
            + 'background:rgba(8,16,28,0.88); border:1px solid rgba(245,197,24,0.55); border-radius:18px;'
            + 'box-shadow:0 10px 30px rgba(0,0,0,0.45); pointer-events:none; opacity:0; transition:opacity .25s; overflow:hidden;';
        card.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:14px; padding:14px 20px 12px 14px;">
                <div style="width:48px; height:48px; border-radius:50%; background:#2FAE5C; border:3px solid #F58A00; flex:none; overflow:hidden;">
                    <img src="assets/images/competitors/paddle.png" alt="Paddle" style="width:100%; height:100%; object-fit:cover; display:block; transform-origin:50% 50%; transform:scale(2.1) translate(3%, 22%);">
                </div>
                <div style="display:flex; flex-direction:column; min-width:0; gap:4px;">
                    <span class="t-label" style="font-size:9px; letter-spacing:0.26em; color:#F5C518;">Coach Paddle</span>
                    <div id="school-card-text" class="t-display" style="font-size:21px; line-height:1.2; color:#fff; display:flex; flex-direction:column; gap:3px;"></div>
                </div>
            </div>
            <div id="school-goal" style="display:none; align-items:center; gap:10px; padding:9px 20px; background:rgba(143,216,208,0.10); border-top:1px solid rgba(255,255,255,0.12);">
                <span id="school-goal-text" class="t-display" style="font-size:16px; color:#fff;"></span>
            </div>`;
        document.body.appendChild(card);
        const goal = card.querySelector('#school-goal');
        // "Press Enter to continue".
        window.addEventListener('keydown', (e) => { if (this.active && (e.key === 'Enter' || e.code === 'Enter')) this._enter = true; });

        const ring = document.createElement('div');
        ring.id = 'school-ring';
        ring.style.cssText = 'position:fixed; z-index:59; display:none; border-radius:50%; pointer-events:none;'
            + 'border:3px solid rgb(64,245,200); box-shadow:0 0 14px rgba(64,245,200,0.8), inset 0 0 10px rgba(64,245,200,0.35);'
            + 'animation: school-pulse 1.1s ease-in-out infinite;';
        document.body.appendChild(ring);
        const st = document.createElement('style');
        st.textContent = '@keyframes school-pulse { 0%,100% { transform:scale(1); opacity:.95 } 50% { transform:scale(1.08); opacity:.7 } }';
        document.head.appendChild(st);

        const frame = document.createElement('div');
        frame.id = 'school-frame';
        frame.style.cssText = 'position:fixed; right:18px; bottom:18px; z-index:60; display:none; gap:8px;';
        frame.innerHTML = `
            <button id="school-skip" class="res-btn" style="padding:8px 14px; font-size:12px;">Skip ›</button>
            <button id="school-skip-race" class="res-btn" style="padding:8px 14px; font-size:12px;">Skip to the race ››</button>
            <button id="school-quit" class="res-btn" style="padding:8px 14px; font-size:12px;">Leave school</button>`;
        document.body.appendChild(frame);
        frame.querySelector('#school-skip').addEventListener('click', (e) => { e.preventDefault(); this.skip(); e.target.blur(); });
        frame.querySelector('#school-skip-race').addEventListener('click', (e) => { e.preventDefault(); this.skipToRace(); e.target.blur(); });
        frame.querySelector('#school-quit').addEventListener('click', (e) => { e.preventDefault(); this.exit(); });

        const deb = document.createElement('div');
        deb.id = 'school-debrief';
        deb.style.cssText = 'position:fixed; inset:0; z-index:200; display:none; align-items:center; justify-content:center;'
            + 'background:rgba(5,10,20,0.88);';
        document.body.appendChild(deb);
        this._lines = []; this._goalOn = false;
        this._dom = { card, text: card.querySelector('#school-card-text'), frame, deb, goal, goalText: goal.querySelector('#school-goal-text'), ring, rings: [ring] };
    },
    goal(text) {
        this.ensureDom();
        const g = this._dom.goal;
        this._goalOn = !!text;
        if (!text) { g.style.display = 'none'; if (!this._lines.length) this.hideCard(); return; }
        if (text.includes('<')) this._dom.goalText.innerHTML = text; else this._dom.goalText.textContent = text;
        g.style.display = 'flex';
        clearTimeout(this._cardTimer);       // a goal keeps the box up until it is met
        this.showCard();
    },
    // Lines ACCUMULATE while a goal is showing — the player can re-read everything that led
    // to it. With no goal (the Start, the race) each line replaces the last, as before.
    say(text) {
        this.ensureDom();
        if (!this._goalOn) this._lines = [];
        this._lines.push(text);
        this.renderLines();
        clearTimeout(this._cardTimer);
        if (!this._goalOn) this._cardTimer = setTimeout(() => this.hideCard(), 9000);
    },
    clearLines() { this._lines = []; if (this._dom) this.renderLines(); },
    renderLines() {
        const d = this._dom;
        d.text.innerHTML = this._lines.map(t => `<div>${t.includes('<') ? t : t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`).join('');
        if (this._lines.length || this._goalOn) this.showCard();
    },
    showCard() {
        const d = this._dom;
        if (d.card.style.display !== 'flex') { d.card.style.display = 'flex'; void d.card.offsetWidth; }
        d.card.style.opacity = '1';
    },
    hideCard() {
        if (!this._dom) return;
        this._lines = [];
        this._dom.card.style.opacity = '0';
        clearTimeout(this._cardTimer);
        setTimeout(() => { if (this._dom.card.style.opacity === '0') this._dom.card.style.display = 'none'; }, 260);
    },
    showFrame(on) {
        this.ensureDom();
        this._dom.frame.style.display = on ? 'flex' : 'none';
        const race = this.s && this.s.kind === 'race';
        this._dom.frame.querySelector('#school-skip').style.display = race ? 'none' : '';
        this._dom.frame.querySelector('#school-skip-race').style.display = race ? 'none' : '';
    },
    showDebrief(graduated, rank, player) {
        this.ensureDom();
        const lines = this.debriefLines(graduated, rank, player);
        const deb = this._dom.deb;
        deb.innerHTML = `
            <div style="width:min(92vw,560px); background:#0c1322; border:1px solid rgba(245,197,24,0.4); border-radius:18px; padding:28px 30px; color:#eef3fb; box-shadow:0 30px 80px rgba(0,0,0,0.6);">
                <div style="display:flex; align-items:center; gap:16px; margin-bottom:18px;">
                    <div style="width:72px; height:72px; border-radius:50%; background:#2FAE5C; border:3px solid #F58A00; flex:none; overflow:hidden;">
                        <img src="assets/images/competitors/paddle.png" alt="Paddle" style="width:100%; height:100%; object-fit:cover; display:block; transform-origin:50% 50%; transform:scale(2.1) translate(3%, 22%);">
                    </div>
                    <div>
                        <div class="t-label" style="color:#F5C518; letter-spacing:0.28em;">${graduated ? 'Graduated · Sailing School' : 'Sailing School'}</div>
                        <div class="t-display uppercase" style="font-size:34px; line-height:1; margin-top:8px;">${graduated ? 'Paddle says' : 'Not yet'}</div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:10px; font-size:17px; line-height:1.35;">
                    ${lines.map(l => `<div style="display:flex; gap:12px;"><span style="color:#F5C518;">—</span><span>${l}</span></div>`).join('')}
                </div>
                <div class="t-mono" style="font-size:11px; color:#7787a0; margin-top:18px;">There's more boat than this. TAB hands you the sheets.</div>
                <div style="display:flex; gap:10px; margin-top:22px; flex-wrap:wrap;">
                    <button id="school-go-cove" class="res-btn res-btn-primary" style="font-size:16px; padding:12px 26px;">Sail Lighthouse Cove &rarr;</button>
                    <button id="school-again" class="res-btn">Race again</button>
                    <button id="school-replay" class="res-btn">Replay the sail</button>
                    <button id="school-club" class="res-btn">Back to Clubhouse</button>
                </div>
            </div>`;
        deb.style.display = 'flex';
        deb.querySelector('#school-go-cove').addEventListener('click', () => this.exit('bay'));
        deb.querySelector('#school-again').addEventListener('click', () => this.start(4));
        deb.querySelector('#school-replay').addEventListener('click', () => this.start(1));
        deb.querySelector('#school-club').addEventListener('click', () => this.exit());
        this.showFrame(false);
        Sound.updateMusic();
    },
    hideDebrief() { if (this._dom) this._dom.deb.style.display = 'none'; },
};
// THE FIRST SAIL'S WATER is the pond document with its land and props stripped: same
// palette, same wind, nothing to hit, and school.js lifts its arena to the horizon. Derived
// at load so the pond can be shaped freely in the editor without touching the first lesson.
(function registerOpenWater() {
    const src = window.VENUE_DOC && window.VENUE_DOC.pond;
    if (!src) return;
    const d = JSON.parse(JSON.stringify(src));
    d.venue = 'pond-open';
    d.shapes = []; d.props = [];
    d.note = 'Derived by js/game/school.js from pond.venue.js: the open-water twin the First Sail runs on. Not a file; edit pond instead.';
    d.card = Object.assign({}, d.card || {}, { name: 'Open Water', tag: 'Sailing School' });
    window.VENUE_DOC['pond-open'] = d;
    if (typeof MUSIC_TRACKS !== 'undefined' && MUSIC_TRACKS['racing-pond']) MUSIC_TRACKS['racing-pond-open'] = MUSIC_TRACKS['racing-pond'];
})();
window.School = School;
