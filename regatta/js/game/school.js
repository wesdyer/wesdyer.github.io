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
    unit: 0,                 // 1 open water · 2 pond manoeuvring · 3 start practice · 4 the race
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
               spinnaker: '#8FCBFF', spinnaker2: '#FFFFFF', cockpit: '#C9CCD6', spinPattern: 'fiverays',
               personality: 'A rented boat with a yellow sail.', beat: '', archetype: 'metronome', stats: {} },

    // The classmates (tutorial.md §8): all from the Starting Ten, none of the bullies. Each
    // carries ONE characteristic error drawn from the curriculum, so every lesson gets a
    // second showing from the outside.
    CLASSMATES: [
        { name: 'Sunshine', traits: { startBufAdj: 1.2 } },              // over early, has to dip back
        { name: 'Wobble',   traits: { pinch: 8 * Math.PI / 180 } },      // pinches up the beat
        { name: 'Cheer',    traits: { kiteHold: 22 * Math.PI / 180 } },  // carries the kite too long
    ],
    CLASSMATE_PACE: 0.9,   // classmates sail at 90% of the polar, everywhere, always

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
        this._fade = null; this._handoff = null;   // a Skip/Restart mid-fade must not fire the old section's callback
        // Collisions arrive as race events; chain onto whatever telemetry has installed.
        if (!this._evWrapped) {
            this._evWrapped = true;
            const prev = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (typeof prev === 'function') prev(ty, d);
                if (this.active && this.s && d && d.boat && d.boat.isPlayer && /^collision_(boat|mark|island|traffic)$/.test(ty)) this.s.collisionT = this.s.t;
            };
        }
        // The First Sail runs on the open-water twin of the pond (see registerOpenWater);
        // everything from unit 2 on is the pond itself, lawn and all.
        settings.venue = unit === 1 ? 'pond-open' : this.venueKey;
        settings.autoTrim = true;
        // The lesson points at BOTH faces of the instruments — the panel under the boat and
        // the rose — so the school runs with both, whatever the player has set.
        if (this._saved && this._saved.hudMode === undefined) this._saved.hudMode = settings.hudMode;
        settings.hudMode = 'both';
        // Heading camera throughout: the lessons put the boat low in frame and their goals
        // at the screen's edge, which only means something with the bow pointing up.
        if (this._saved && this._saved.cameraMode === undefined) this._saved.cameraMode = settings.cameraMode;
        settings.cameraMode = 'heading';
        state.camera.mode = 'heading';
        saveSettings();                      // resetGame() re-reads settings from storage first
        if (typeof applyHudMode === 'function') applyHudMode();

        state.showNavAids = true;
        this.s = null;                       // per-unit script state
        this._waterBounds = null;
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
            else this.beginStartPractice();
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
        this.s = null; this._fade = null; this._handoff = null;
        this.hideCard();
        this.hideDebrief();
        if (this._dom) this._dom.screen.style.display = 'none';
        if (this._simHeld) { this._simHeld = false; state.paused = false; }
        this.showFrame(false);
        this.setControls(true); this.setHud(true); this.setPanel(true); this.goal(null);
        this.windScale = null; this.highlight = null;
        settings.hudMode = sv.hudMode || 'boat';
        settings.cameraMode = sv.cameraMode || 'heading';
        state.camera.mode = settings.cameraMode;
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

    // The pond's WATER, as a box: sampled once per section from the document's arena and the
    // land mask, so the chart on the pond frames the whole pond and no more.
    minimapBounds() {
        if (!this.s || this.s.kind !== 'pond') return null;
        if (this._waterBounds) return this._waterBounds;
        try {
            const doc = window.VenueDoc.get(this.venueKey);
            const b = doc ? window.VenueDoc.compile(doc, { light: true }).boundary : state.course.boundary;
            if (!b) return null;
            const e = Arena.extent(b);
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            const N = 60;
            for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
                const x = e.minX + (e.maxX - e.minX) * i / N, y = e.minY + (e.maxY - e.minY) * j / N;
                if (!Arena.contains(b, x, y, 0)) continue;
                if (typeof inMaskWater === 'function' && !inMaskWater(x, y)) continue;
                minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
            if (!isFinite(minX)) return null;
            this._waterBounds = { minX, maxX, minY, maxY };
            return this._waterBounds;
        } catch (e) { return null; }
    },
    // The practice start shows the start line and nothing else of the course: not the
    // windward gate, not the ladder rungs to it.
    startPractice() { return this.active && !!this.s && this.s.kind === 'pond' && this.s.phase === 'start'; },
    hideMark(m) {
        if (!this.startPractice() || !state.course.marks) return false;
        const sl = (typeof startLineMarks === 'function') ? startLineMarks() : [0, 1];
        const i = state.course.marks.indexOf(m);
        return i >= 0 && sl.indexOf(i) === -1;
    },
    // The section's name, as its screen's kicker gives it.
    sectionName() { return ({ 1: 'Sailing School', 2: 'The Pond', 3: 'Start Practice', 4: 'The Race' })[this.unit] || 'Sailing School'; },
    // A lesson (units 1 and 2) as opposed to the graduation race: the HUD hides its race
    // furniture — clock, leaderboard, caption, course edge indicators — while this is true.
    lesson() { return this.active && !!this.s && this.s.kind !== 'race'; },
    // Sections 1 and 2 have no course: no line, no marks, no gate, no committee boat, no
    // laylines, no chart. The course exists (the race is built from it) but is not drawn.
    courseHidden() {
        if (this._previewHideCourse != null) return !!this._previewHideCourse;
        return this.active && !!this.s && (this.s.kind === 'sail' || (this.s.kind === 'pond' && !this.s.showCourse));
    },

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
        // five-minute-old sailor. Baseline stats (the AI bonus gone) and a flat 10% off the
        // pace at every angle — a slower boat, not a differently shaped one.
        for (const b of state.boats) {
            if (b.isPlayer) { b.manualTrim = false; continue; }
            for (const k of BONUS_STATS) b.stats[k] = 0;
            b.speedScale = this.CLASSMATE_PACE;
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
        if (!s.ducks || !s.ducks.length) {
            s.ducks = [];
            for (let i = 0; i < 5; i++) {
                const back = -Math.sin(s.beamBearing) * i * 24, backY = Math.cos(s.beamBearing) * i * 24;
                s.ducks.push({ x: T.x + back, y: T.y + backY, h: s.beamBearing });
            }
            s.duckLead = { x: T.x, y: T.y };
        } else {
            // The flock is already on the water: the lead swims to the new station (see
            // updateCompanions), and the line follows.
            s.duckLead = { x: s.ducks[0].x, y: s.ducks[0].y };
        }
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
        if (!s.ducks || !s.ducks.length) {
            s.ducks = [];
            for (let i = 0; i < 5; i++) s.ducks.push({ x: T.x - U.x * i * 24, y: T.y - U.y * i * 24, h: this.wd() });
            s.duckLead = { x: T.x, y: T.y };
        } else {
            s.duckLead = { x: s.ducks[0].x, y: s.ducks[0].y };   // swim there from wherever they are
        }
        s.upBase = { x: p.x, y: p.y };                           // the along-wind origin
    },
    // "Reached": the nearest duckling is within a boat length (56u) — and the beat moves on
    // before the hull can get to them, so they are never run over.
    ducksReached() {
        const s = this.s, p = state.boats[0];
        if (!s || !s.ducks || !s.ducks.length) return false;
        let best = Infinity;
        for (const d of s.ducks) best = Math.min(best, this.dist(p, d));
        return best < 56;
    },
    // Move a point toward a target at a capped speed (units/s): ducklings SWIM to a new
    // station, across the screen, rather than appearing there.
    swim(pt, target, speed, dt) {
        const dx = target.x - pt.x, dy = target.y - pt.y, d = Math.hypot(dx, dy);
        if (d < 1e-3) return false;
        const step = Math.min(d, speed * dt);
        pt.x += dx / d * step; pt.y += dy / d * step;
        return d > step;
    },
    DUCK_SWIM: 300,          // units/s, a duckling crossing the screen for a new station
    DUCK_APPROACH: 150,      // units/s, a duckling coming to meet a boat pointed at it

    // ── THE S: five ducklings to reach, laid out in an S off the beam. Each holds station
    // unless the boat points at it — then it swims toward the boat. Reached, it swims to the
    // front of the line (the next bend of the S), and the queue moves on.
    spawnSnakeDucks() {
        const s = this.s, p = state.boats[0], w = this.wd();
        const a = normalizeAngle(w + Math.PI / 2), b = normalizeAngle(w - Math.PI / 2);
        const bearing = Math.abs(normalizeAngle(p.heading - a)) <= Math.abs(normalizeAngle(p.heading - b)) ? a : b;
        const dir = { x: Math.sin(bearing), y: -Math.cos(bearing) };   // along the beam
        const U = this.U();
        s.duckMode = 'snake';
        s.snake = { anchor: { x: p.x, y: p.y }, frozen: false, dir, U, count: 0, nextK: 6 };
        s.ducks = [];
        for (let k = 1; k <= 5; k++) {
            const st = this.snakeStation(k);
            s.ducks.push({ x: st.x, y: st.y, h: bearing, k, station: st });
        }
    },
    // Stations are offsets from an ANCHOR along the beam bearing chosen at the start. While
    // the boat points elsewhere the anchor is RIGIDLY attached to the boat at whatever offset
    // it currently has — the S moves with the boat and never drifts away from it. The moment
    // the boat points at the next duckling (within 10°) the anchor freezes where it is, so the
    // S holds in the water and the boat sails up to it; a reached duckling swims to the far end
    // of the line while the rest stay put. The S: ±90u across for 200u along, ~24° off the
    // beam — still well clear of a beat.
    snakeStation(k) {
        const n = this.s.snake;
        const along = 200 + k * 200, across = (k % 2 ? 1 : -1) * 90;
        return { x: n.anchor.x + n.dir.x * along + n.U.x * across, y: n.anchor.y + n.dir.y * along + n.U.y * across };
    },
    tickSnake(s) {
        const p = state.boats[0], n = s.snake, head = s.ducks[0];
        if (!head) return;
        if (this.dist(p, head) < 56) {
            n.count++;
            head.k = n.nextK++; head.station = this.snakeStation(head.k);
            s.ducks.push(s.ducks.shift());                       // to the back of the queue, front of the line
            this.goal(`Follow the ducklings · ${Math.min(5, n.count)} of 5`);
        }
    },
    updateSnake(dt) {
        const s = this.s, p = state.boats[0], n = s.snake, head = s.ducks[0];
        if (!head) return;
        const bearing = Math.atan2(head.x - p.x, -(head.y - p.y));
        const aimed = Math.abs(normalizeAngle(p.heading - bearing)) < 10 * Math.PI / 180;
        if (aimed) {
            n.frozen = true;                                                     // hold where it is; sail up to it
        } else {
            if (n.frozen || !n.off) { n.frozen = false; n.off = { x: n.anchor.x - p.x, y: n.anchor.y - p.y }; }
            n.anchor.x = p.x + n.off.x; n.anchor.y = p.y + n.off.y;              // carried along, offset unchanged
        }
        for (const d of s.ducks) {
            d.station = this.snakeStation(d.k);
            const before = { x: d.x, y: d.y };
            const moving = this.swim(d, d.station, this.DUCK_SWIM, dt);
            if (moving) d.h = this.headingOf(d.x - before.x, d.y - before.y);
            else d.h = normalizeAngle(Math.atan2(d.x - p.x, -(d.y - p.y)));   // holding: facing away from the boat
        }
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
            { id: 'boat', timeout: Infinity,
              enter: (s) => { armEnter(s); S.highlight = { world: (p) => ({ x: p.x, y: p.y, r: 70 }) }; },
              lines: [{ t: 0, text: 'This is your boat.' }],
              goal: ENTER, done: enterAfter(0) },
            { id: 'wind', timeout: Infinity,
              enter: (s) => { armEnter(s); s.windIndicator = true; S.windRamp(7, 0.25); S.setPanel(true); S.highlight = { dom: () => [S.panelRect()].filter(Boolean) }; },
              lines: [{ t: 0, text: "Wind streaks show which way it's blowing and how hard. The wind is coming from our side at 90 degrees." }],
              goal: ENTER, done: enterAfter(0),
              exit: (s) => { s.windIndicator = false; } },
            { id: 'snake', timeout: Infinity,
              enter: (s) => { S.highlight = null; S.setControls(true); S.kiteLocked = true; S.setPanel(true); S.spawnSnakeDucks(); },
              lines: [{ t: 0, text: 'Steer with ' + S.K('&larr;') + ' / ' + S.K('&rarr;') + ' or ' + S.K('A') + ' / ' + S.K('D') + '.' },
                      { t: 0.1, text: 'Follow those ducklings!' }],
              goal: 'Follow the ducklings · 0 of 5',
              tick: (s) => S.tickSnake(s),
              done: (s) => s.snake && s.snake.count >= 5,
              exitLine: "That's a reach — wind on your side. Fastest, easiest point of sail." },
            { id: 'upwind', timeout: Infinity,
              enter: (s) => { S.spawnUpwindDucks(); s.up = { phase: 'sail', zoneT: 0, tacks0: s.tacks }; },
              lines: [{ t: 0, text: "Now let's try sailing upwind. Follow the ducklings." }],
              goal: 'Follow the ducklings',
              tick: (s, r) => S.tickUpwind(s, r),
              done: (s) => S.ducksReached() },
            { id: 'downwind', timeout: Infinity,
              enter: (s) => { s.coneOn = false; S.spawnDucksAt(normalizeAngle(S.wd() + Math.PI)); s.dw = { phase: 'sail' }; s.duckHoldOff = true; },
              lines: [{ t: 0, text: "Let's sail downwind." }],
              goal: 'Follow the ducklings',
              tick: (s, r) => S.tickDownwind(s, r),
              done: (s) => s.dw.phase === 'kite' && S.ducksReached() },
            { id: 'closereach', timeout: Infinity,
              enter: (s) => { const side = S.playerRead().twa >= 0 ? 1 : -1; S.spawnDucksAt(normalizeAngle(S.wd() + side * 60 * Math.PI / 180)); s.cr = { phase: 'sail' }; s.duckHoldOff = true; },
              lines: [{ t: 0, text: 'Sail upwind again.' }],
              goal: 'Follow the ducklings',
              tick: (s, r) => S.tickCloseReach(s, r),
              done: (s) => s.cr.phase === 'again' && S.ducksReached() },
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
        s.goalShown = seg.goalAfter == null;
        if (s.goalShown) this.goal(seg.goal || null);
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
            if (!s.goalShown && s.segT >= seg.goalAfter) { s.goalShown = true; this.goal(seg.goal || null); }
            if (seg.tick) seg.tick(s, r);
            if (seg.done(s, r)) { if (seg.exit) seg.exit(s); this.nextSegment(); }
            else if (s.segT >= seg.timeout) { s.byTimer = true; s.timerAdvances++; this.nextSegment(); }
        }

        this.updateCompanions(dt, r);
        this.keepClassmatesSailing();
    },

    onFirstSailDone() {
        this.start(2); this.screen('B');
    },

    // ── UNIT 2 · THE POND ─────────────────────────────────────────────────────
    // The pond proper, for the first time: land, marks, the launch at the line. Free sailing
    // for now — the lessons that live here are still being written.
    // Four beats: explore (200 m of sailing), round a windward mark to starboard, go through
    // a leeward gate and round it, then a practice start on the real line. The course stays
    // hidden until the start; the mark and gate are the school's own buoys.
    beginPond() {
        const player = state.boats[0];
        const b = state.course.boundary || { x: 0, y: 0 };
        const S = { x: b.x, y: b.y };                          // the middle of the pond
        this.placeBoat(player, S, this.wd(), 0);              // head to wind, stopped: the first tip writes itself
        state.race.status = 'racing';
        state.race.timer = 0;
        snapCameraToStart();
        this.s = { kind: 'pond', phase: 'explore', t: 0, dist: 0, lastPos: { x: S.x, y: S.y },
                   ducks: [], launch: null, buoys: [], coneOn: false, highlight: null, showCourse: false, said: {} };
        this.setControls(true); this.setHud(true); this.setPanel(true); this.goal(null);
        this.windScale = null; this.highlight = null;
        this.s.phase = 'tasks'; this.s.taskIdx = -1; this.s.prevTarget = { x: S.x, y: S.y };
        this.nextPondTask();
    },
    // THE COURSE LESSON: marks and gates in turn, each placed from the pond and the previous
    // target (the very first "previous target" is where the boat began, so the first rounding
    // reads the way a real leg would). A mark carries a rounding side; a gate is laid across
    // the approach from the previous target, and is either ROUNDED (through, then round an end
    // and come back) or THROUGH.
    pondTasks() {
        const S = this, C = () => state.course.boundary || state.boats[0], wd = () => S.wd();
        return [
            { kind: 'mark', side: 'port',
              place: () => S.edgeTarget(normalizeAngle(wd() + Math.PI / 2)),
              line: "Welcome to the Duckling Pond! Let's round a mark. Keep it on your LEFT side as you go around — that's a port rounding.",
              goal: 'Round the mark to port' },
            { kind: 'mark', side: 'starboard',
              place: () => S.waterPoint(C(), wd(), 2400, 600, 250),
              line: 'Now the mark at the top of the pond. This time keep it on your RIGHT side — a starboard rounding.',
              goal: 'Round the mark to starboard' },
            { kind: 'gate', mode: 'round', end: 'either', id: 'leeward',
              place: () => S.waterPoint(C(), normalizeAngle(wd() + Math.PI), 2400, 600, 430),
              line: 'Now the downwind gate. Go through it, round one of its marks, and head back upwind.',
              goal: 'Round the gate' },
            { kind: 'mark', side: 'starboard',
              place: () => S.waterPoint(C(), normalizeAngle(wd() - Math.PI / 2), 2400, 600, 250),
              line: 'Next, the mark on the left side of the pond. Keep it on your right.',
              goal: 'Round the mark to starboard' },
            { kind: 'mark', side: 'starboard',
              place: () => ({ x: C().x, y: C().y }),
              line: 'Now the mark in the middle of the pond. Keep it on your right.',
              goal: 'Round the mark to starboard' },
            { kind: 'gate', mode: 'through', id: 'leeward',
              place: () => S.s.leewardGate || S.waterPoint(C(), normalizeAngle(wd() + Math.PI), 2400, 600, 430),
              line: 'Last one: straight through the downwind gate.',
              goal: 'Go through the gate' },
        ];
    },
    nextPondTask() {
        const s = this.s;
        if (!s.tasks) s.tasks = this.pondTasks();
        s.taskIdx++;
        const T = s.tasks[s.taskIdx];
        s.buoys = []; s.GL = s.GR = null;
        if (!T) { this.fadeThen(() => { this.start(3); this.screen('C'); }); return; }
        s.task = T;
        if (T.kind === 'mark') {
            const M = T.place(), p = state.boats[0];
            s.W = M; s.buoys = [{ p: M, on: true, kind: 'inflatable', side: T.side }];
            // THE RACE'S OWN ROUNDING RULE (physics roundingStep), fed the last goal as where
            // the boat comes from and the next goal as where it goes: the required sweep is the
            // taut string from one to the other round the mark, exactly as a race leg's is.
            const N = s.tasks[s.taskIdx + 1];
            s.nextA = N ? N.place() : { x: M.x - (M.x - s.prevTarget.x), y: M.y - (M.y - s.prevTarget.y) };
            s.rm = { x: M.x, y: M.y, zone: 165, radius: 12, side: T.side };
            s.rm.reqSweep = (typeof CoursePath !== 'undefined' && CoursePath.requiredSweepPts) ? CoursePath.requiredSweepPts(s.rm, s.prevTarget, s.nextA) : null;
            s.track = { roundSweep: 0, roundArmed: false, roundBanked: false, roundRebased: false, roundEntryB: null,
                        roundFrom: { x: p.x, y: p.y }, roundWrong: 0, _wrongRound: false, lastPos: { x: p.x, y: p.y } };
            s.target = M;
        } else {
            const G = T.place();
            if (T.id === 'leeward') s.leewardGate = G;
            // Laid across the approach from the previous target: right-hand of travel.
            const ax = G.x - s.prevTarget.x, ay = G.y - s.prevTarget.y, al = Math.hypot(ax, ay) || 1;
            s.gateA = { x: ax / al, y: ay / al };
            const rx = -s.gateA.y, ry = s.gateA.x;
            s.gateRight = { x: rx, y: ry };
            s.GL = { x: G.x - rx * 250, y: G.y - ry * 250 }; s.GR = { x: G.x + rx * 250, y: G.y + ry * 250 };
            s.gateMid = G; s.gateCrossed = false;
            const round = T.mode === 'round';
            s.buoys = [{ p: s.GL, on: true, kind: 'can', side: round && T.end !== 'starboard' ? 'port' : null, noZone: !round },
                       { p: s.GR, on: true, kind: 'can', side: round ? 'starboard' : null, noZone: !round }];
            s.target = G;
        }
        this.instruct(T.line, T.goal);
    },
    // A point `want` units from `from` along a bearing, pulled back until it is on the water
    // and inside the arena with a margin — the pond is small and has a lawn in it.
    // `clear` is the water needed AROUND the point: a mark is rounded, so the whole turning
    // circle must be sailable, not just the buoy's own pixel. Falls back to the pond's
    // centre if nothing on that bearing from `from` has the room.
    waterPoint(from, bearing, want, min, clear) {
        const dx = Math.sin(bearing), dy = -Math.cos(bearing);
        const ok = (x, y) => {
            const b = state.course.boundary;
            const ring = [[0, 0]]; const cr = clear || 220;
            for (let k = 0; k < 8; k++) ring.push([Math.cos(k * Math.PI / 4) * cr, Math.sin(k * Math.PI / 4) * cr]);
            for (const [ox, oy] of ring) {
                if (b && !Arena.contains(b, x + ox, y + oy, 120)) return false;
                if (typeof inMaskWater === 'function' && !inMaskWater(x + ox, y + oy)) return false;
            }
            return true;
        };
        for (let d = want; d >= (min || 300); d -= 50) {
            const x = from.x + dx * d, y = from.y + dy * d;
            if (ok(x, y)) return { x, y };
        }
        const c = state.course.boundary || from;
        for (let d = want; d >= 0; d -= 50) {
            const x = c.x + dx * d, y = c.y + dy * d;
            if (ok(x, y)) return { x, y };
        }
        return { x: c.x, y: c.y };
    },
    updatePond(dt) {
        const s = this.s, r = this.playerRead(), p = r.p, rs = p.raceState;
        s.t += dt;
        if (s.phase !== 'start') {
            // The hidden course must not score anything: no legs, no finish, no OCS.
            rs.leg = 0; rs.finished = false; rs.ocs = false;
            this.updateReminders(dt, r, new Set(['zone', 'collide', 'hoist', 'douse']));
        } else {
            this.updateReminders(dt, r, new Set(['zone', 'collide', 'ocs', 'notstarted', 'douse']));
        }

        if (s.phase === 'tasks') {
            const T = s.task; if (!T) return;
            if (T.kind === 'mark') {
                const res = (typeof roundingStep === 'function') ? roundingStep(p, s.track, s.rm, s.nextA) : { done: false };
                s.track.lastPos = { x: p.x, y: p.y };
                if (res.wrong) this.instruct(`Wrong way round — keep the mark on your ${T.side === 'starboard' ? 'RIGHT' : 'LEFT'} side as you go around it.`, T.goal);
                if (res.done) { s.prevTarget = s.W; this.nextPondTask(); }
            } else {
                const A = s.gateA, mid = s.gateMid;
                const perp = (p.x - mid.x) * A.x + (p.y - mid.y) * A.y;       // + = past the gate, along the approach
                const along = (p.x - mid.x) * s.gateRight.x + (p.y - mid.y) * s.gateRight.y;
                const forward = (p.velocity.x * A.x + p.velocity.y * A.y) > 0;
                if (!s.gateCrossed && forward && hullCrossedLine(p, s.GL.x, s.GL.y, s.GR.x, s.GR.y)) {
                    s.gateCrossed = true;
                    if (T.mode === 'through') { s.prevTarget = mid; this.nextPondTask(); return; }
                    this.instruct(T.end === 'starboard' ? 'Through the gate. Now round its right-hand mark and come back.' : 'Through the gate. Now round one of its marks and come back.', T.goal);
                }
                // Rounded: back on the entry side, having gone round the right end.
                if (s.gateCrossed && perp < -40 && (T.end !== 'starboard' || along > 120)) {
                    s.prevTarget = mid;
                    this.nextPondTask();
                }
            }
        } else if (s.phase === 'start') {
            if (state.race.status === 'prestart') {
                // Over the line before the gun (physics flags OCS on the crossing; the position
                // test catches a boat that drifted over): say so until they are back behind it.
                const [m0, m1] = startLinePts(); const cr = startCrossNormal();
                const perp = (p.x - (m0.x + m1.x) / 2) * cr.x + (p.y - (m0.y + m1.y) / 2) * cr.y;
                const over = rs.ocs || perp > -12;
                if (over && s.startPhase !== 'over') { s.startPhase = 'over'; this.instruct("You haven't started yet.", 'Return to behind the start line'); }
                else if (!over && s.startPhase === 'over') { s.startPhase = 'wait'; this.instruct("Let's practice starting a race. Stay behind the line until after the timer runs out.", 'Stay behind the line'); }
            }
            if (state.race.status === 'racing' && !s.said.gun) {
                s.said.gun = true; s.ocsAtGun = !!rs.ocs; s.startPhase = 'go';
                this.highlight = null;
                this.instruct(s.ocsAtGun ? 'Over early! Get back behind the line, then cross it.' : "That's the gun. Cross the start line!", 'Cross the start line');
            }
            if (state.race.status === 'racing' && rs.leg >= 1 && !s.said.crossed) {
                s.said.crossed = true;
                const late = rs.startTimeDisplay || 0;
                this._startNote = s.ocsAtGun ? 'Over early at the gun — but you got back and crossed. Wait for the clock next time.'
                    : late > 5 ? `You crossed ${Math.round(late)} seconds after the gun. Closer next time.`
                    : 'Right on time. That is a start.';
                this.goal(null);
                this.fadeThen(() => { this.start(4); this.screen('D'); });
            }
        }
    },
    // Section 3: the pond with the course shown, one boat, the document's prestart.
    beginStartPractice() {
        const player = state.boats[0];
        this.s = { kind: 'pond', phase: 'start', t: 0, dist: 0, lastPos: { x: player.x, y: player.y },
                   ducks: [], launch: null, buoys: [], coneOn: false, highlight: null, showCourse: true, said: {} };
        this.setControls(true); this.setHud(true); this.setPanel(true); this.goal(null);
        this.windScale = null; this.highlight = null;
        this.beginPracticeStart();
    },
    beginPracticeStart() {
        const s = this.s, player = state.boats[0], rs = player.raceState;
        rs.leg = 0; rs.ocs = false; rs.finished = false; rs.startTimeDisplayTimer = 0;
        const [m0, m1] = startLinePts();
        const cross = startCrossNormal();
        const lx = m1.x - m0.x, ly = m1.y - m0.y;
        const P = { x: m0.x + lx * 0.25 - cross.x * 220, y: m0.y + ly * 0.25 - cross.y * 220 };
        this.placeBoat(player, P, this.wd(), 0);              // stopped, head to wind: they have to make the start happen
        state.race.status = 'prestart';
        state.race.timer = state.race.startTimerDuration;      // the document's prestart (30 s on the pond)
        hideRaceMessage();
        snapCameraToStart();
        const secs = Math.round(state.race.timer);
        s.startPhase = 'wait';
        this.highlight = { dom: () => [this.domRect(['#hud-timer'])].filter(Boolean) };
        this.instruct("Let's practice starting a race. Stay behind the line until after the timer runs out.", 'Stay behind the line');
    },

    // ── UNIT 2 · THE START ────────────────────────────────────────────────────
    beginStart() {
        const player = state.boats[0];
        if (this.unit !== 3 || !this.s || this.s.kind !== 'start') {
            this.s = { kind: 'start', run: 0, launch: null, ducks: [], duckMode: 'hold', t: 0, phase: 'setup', results: [] };
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
        // THE RACE IS ON THE POND, whichever water the school was on when it was asked for —
        // "skip to the race" from the open-water First Sail included.
        settings.venue = this.venueKey;
        settings.penaltiesEnabled = true;
        saveSettings();                      // resetGame() re-reads settings first
        resetGame();
        this.liftArena();
        const player = state.boats[0];
        this.s = { kind: 'race', launch: null, ducks: [],
                   duckMode: 'launch', t: 0, coneOn: false, said: {}, ocsAtGun: false,
                   pinchT: 0, beatT: 0, kiteUpwindT: 0, wrongWay: 0, finishRank: null };
        beginRace();                         // the shipped prestart: leaderboard, clock, music — and the
                                             // document's own start sequence (course.startTime)
        this.say('Real start, real gun.');
    },

    updateRace(dt) {
        const s = this.s, r = this.playerRead(), rs = r.p.raceState;
        s.t += dt;
        this.updateCompanions(dt, r);

        if (state.race.status === 'racing' && !s.said.gun) {
            s.said.gun = true;
            s.ocsAtGun = !!rs.ocs;
            s.gunT = s.t;
            this.say(s.ocsAtGun ? 'Over early. Back below the line, then go.' : "That's the gun. You've got it.");
        }
        if (rs.finished) return;
        // Before the gun only the silent zone cone and the collision line watch; the rest
        // are about the race itself.
        this.updateReminders(dt, r, state.race.status === 'racing' ? undefined : new Set(['zone', 'collide']));

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
        if (rs.penaltyTurnsOwed === 0 && s.said.pen && !s.said.penClear) { s.said.penClear = true; this.say('Clear. Carry on.'); }

        // What the debrief will say: measured, not guessed.
        const upwind = r.abs < 60 * Math.PI / 180;
        if (rs.leg === 1 && upwind) { s.beatT += dt; if (r.abs < 35 * Math.PI / 180) s.pinchT += dt; }
        if (r.kite && r.abs < 90 * Math.PI / 180) s.kiteUpwindT += dt;

    },

    // ── REMINDERS, section 3. Each watches one condition; after it has held for `dwell`
    // seconds the line is said (and repeated every `every` seconds while it still holds),
    // and the box clears the moment the condition ends. Only one reminder speaks at a time.
    // Listed in PRIORITY order: when several hold at once, the first ripe one speaks and the
    // rest wait. The zone cone is silent and independent: it shows only after the boat has
    // sat inside the no-sail zone (TWA < 38°) for `dwell` seconds, and drops when it leaves.
    RACE_REMINDERS: [
        { id: 'zone', dwell: 3, silent: true,
          cond: (c) => c.r.abs < 38 * Math.PI / 180 },
        { id: 'collide', dwell: 0, every: 8,
          cond: (c) => c.s.collisionT != null && c.s.t - c.s.collisionT < 0.3,
          text: () => 'Avoid hitting objects, it slows you down.' },
        { id: 'penalty', dwell: 3, every: 10,
          cond: (c) => c.rs.penaltyTurnsOwed > 0 && !c.penaltyProgress,
          text: () => 'You have a penalty. Do a full 360° turn to clear it.' },
        { id: 'ocs', dwell: 3, every: 10,
          cond: (c) => c.rs.ocs && !c.headingBack,
          text: () => 'You were over early. Turn around and go back behind the start line.' },
        { id: 'douse', dwell: 3, every: 12,
          cond: (c) => c.r.abs < 90 * Math.PI / 180 && c.p.spinnaker,
          text: (c) => 'The spinnaker is not for upwind. Press ' + c.S.K('Space') + ' to douse it.' },
        { id: 'notstarted', dwell: 5, every: 10,
          cond: (c) => state.race.status === 'racing' && c.rs.leg === 0 && !c.rs.ocs,   // only once the gun has gone
          text: () => 'The race has started. Cross the start line.' },
        { id: 'pastgate', dwell: 3, every: 10,
          cond: (c) => c.pastGate,
          text: (c) => `You've gone past the ${c.targetName}. Turn back and sail between its two marks.` },
        { id: 'hoist', dwell: 3, every: 12,
          // Only once racing and not returning from OCS — a boat dipping back below the line
          // is sailing downwind on purpose and does not want a kite.
          cond: (c) => (c.unit !== 3 || c.rs.leg >= 1) && !c.rs.ocs && c.r.abs > 110 * Math.PI / 180 && !c.p.spinnaker,
          text: (c) => 'Sailing downwind? Press ' + c.S.K('Space') + ' to raise your spinnaker.' },
        { id: 'noprogress', dwell: 3, every: 10,
          cond: (c) => c.rs.leg >= 1 && !c.rs.ocs && c.rs.penaltyTurnsOwed === 0 && !c.pastGate && c.wpDelta >= -0.02,
          text: (c) => `Turn ${c.turnSide} — the ${c.targetName} is that way.` },
    ],
    updateReminders(dt, r, allow) {
        const s = this.s, p = r.p, rs = p.raceState;
        if (!s.rem) { s.rem = {}; s.wpLast = null; s.penRotLast = rs.penaltyRot || 0; }

        // The facts every reminder reads, computed once.
        const c = { S: this, r, p, rs, s, unit: this.unit };
        const leg = rs.leg, entry = (typeof routeLeg === 'function') ? routeLeg(Math.min(leg, state.race.totalLegs)) : null;
        c.targetName = entry && entry.role === 'windward' ? 'windward gate' : (entry && (entry.finish || entry.role === 'leeward')) ? 'finish line' : 'next mark';
        // Progress toward the next waypoint: the distance's trend over the last second.
        const wp = rs.nextWaypoint && rs.nextWaypoint.dist;
        if (s.wpLast == null || wp == null) { c.wpDelta = -1; } else { c.wpDelta = (wp - s.wpLast) / Math.max(dt, 1e-3); }
        s.wpLast = wp;
        // Which way to turn for it.
        if (rs.nextWaypoint) {
            const rel = normalizeAngle(Math.atan2(rs.nextWaypoint.x - p.x, -(rs.nextWaypoint.y - p.y)) - p.heading);
            c.turnSide = rel > 0 ? 'right' : 'left';
        } else c.turnSide = 'around';
        // Past the gate: beyond its line, on the far side, while the leg still wants it.
        c.pastGate = false;
        if (entry && entry.marks && leg >= 1 && leg <= state.race.totalLegs && state.course.marks) {
            const m1 = state.course.marks[entry.marks[0]], m2 = state.course.marks[entry.marks[1]];
            if (m1 && m2) {
                const gdx = m2.x - m1.x, gdy = m2.y - m1.y, gl = Math.hypot(gdx, gdy) || 1;
                const nx = (entry.dir >= 0 ? 1 : -1) * gdy / gl, ny = -(entry.dir >= 0 ? 1 : -1) * gdx / gl;
                const d = (p.x - m1.x) * nx + (p.y - m1.y) * ny;
                c.pastGate = d > 40;
            }
        }
        // OCS: are they at least heading back toward the pre-start side?
        if (rs.ocs && typeof startCrossNormal === 'function') {
            const cr = startCrossNormal();
            c.headingBack = (p.velocity.x * cr.x + p.velocity.y * cr.y) < -0.05;
        } else c.headingBack = true;
        // Penalty: is the turn under way?
        const rot = rs.penaltyRot || 0;
        c.penaltyProgress = Math.abs(rot - s.penRotLast) > 0.02;
        s.penRotLast = rot;

        let spoken = false;
        for (const R of this.RACE_REMINDERS) {
            if (allow && !allow.has(R.id)) continue;
            const st = s.rem[R.id] || (s.rem[R.id] = { t: 0, said: -1e9, on: false });
            const active = !!R.cond(c);
            st.t = active ? st.t + dt : 0;
            if (!active && st.on) {
                st.on = false;
                if (R.silent) s.coneOn = false; else if (s.remSpeaking === R.id) { this.tip(null); s.remSpeaking = null; }
            }
            if (!active || st.t < R.dwell) continue;
            if (R.silent) { s.coneOn = true; st.on = true; continue; }
            if (spoken) continue;                                // a higher-priority reminder holds the box
            spoken = true;
            if (s.t - st.said >= (R.every || 1e9) || !st.on) {
                st.on = true; st.said = s.t;
                if (s.remSpeaking && s.remSpeaking !== R.id) { const o = s.rem[s.remSpeaking]; if (o) o.on = false; }
                s.remSpeaking = R.id;
                this.tip(R.text(c));
            }
        }
    },

    onResults() {
        // The player's boat has faded: graduation. Ducklings fall in behind (already following).
        const s = this.s, player = state.boats[0];
        const sorted = this.raceOrder();
        s.finishRank = sorted.indexOf(player) + 1;
        const graduated = player.raceState.finished && !player.raceState.resultStatus;
        if (graduated) this.saveProgress({ graduated: true, graduatedAt: new Date().toISOString(), rank: s.finishRank });
        console.log('[school] run', JSON.stringify({ log: this.log, race: { rank: s.finishRank, ocs: s.ocsAtGun, pinchT: +s.pinchT.toFixed(1), beatT: +s.beatT.toFixed(1), kiteUpwindT: +s.kiteUpwindT.toFixed(1), penalties: player.raceState.totalPenalties } }));
        this.hideCard();
        this._lastRace = { graduated, rank: s.finishRank, player, sorted, lines: this.debriefLines(graduated, s.finishRank, player) };
        this.fadeThen(() => this.screen('E'), 0);
    },

    raceOrder() {
        return [...state.boats].sort((a, b) => {
            const fa = a.raceState.finished && !a.raceState.resultStatus, fb = b.raceState.finished && !b.raceState.resultStatus;
            if (fa !== fb) return fa ? -1 : 1;
            if (fa) return a.raceState.finishTime - b.raceState.finishTime;
            return getBoatProgress(b) - getBoatProgress(a);
        });
    },
    debriefLines(graduated, rank, player) {
        const s = this.s, rs = player.raceState;
        const lines = [];
        if (!graduated) lines.push("Didn't finish this one. Everyone's first race is a mess.");
        else lines.push(rank === 1 ? 'Won it. Good.' : `${['', 'First', 'Second', 'Third', 'Fourth'][rank] || rank + 'th'} of four. That counts.`);
        if (rs.leg === 0) lines.push('Never crossed the start line. The race starts when the clock hits zero.');
        else if (s.ocsAtGun) lines.push('Over early at the gun — you gave the fleet a head start.');
        else lines.push(rs.startLegDuration != null && rs.startLegDuration > 5 ? `Started ${Math.round(rs.startLegDuration)} seconds late. Arrive at speed next time.` : 'Good start.');
        const pinchFrac = s.beatT > 5 ? s.pinchT / s.beatT : 0;
        if (rs.leg === 0) lines.push('Be near the line, at speed, when the clock runs out.');
        else if (pinchFrac > 0.25) lines.push('You pinched on the beat. Err wide, never high.');
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
        if (s.duckMode === 'snake') { this.updateSnake(dt); return; }
        if (s.duckMode === 'beam') {
            // Heading at them (within ~14°) and they stay put, so the boat closes; anywhere
            // else and they slide to keep station at the screen's edge on the beam.
            // `duckHoldOff`: a beat that still has something to teach before the ducks may be
            // reached (hoist the kite, drop it) keeps them at the edge even when aimed at.
            const aligned = !s.duckHoldOff && Math.abs(normalizeAngle(p.heading - s.beamBearing)) < 14 * Math.PI / 180;
            if (!aligned) this.swim(s.duckLead, this.beamTarget(), this.DUCK_SWIM, dt);
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
            const goalX = s.upBase.x + U.x * s.upAlong + R.x * pr, goalY = s.upBase.y + U.y * s.upAlong + R.y * pr;
            this.swim(s.duckLead, { x: goalX, y: goalY }, this.DUCK_SWIM, dt);
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
        const faceAway = s.duckMode === 'beam' || s.duckMode === 'upwind';
        let prev = lead;
        for (const d of s.ducks) {
            const dx = prev.x - d.x, dy = prev.y - d.y, dd = Math.hypot(dx, dy);
            if (dd > 22) {
                const before = { x: d.x, y: d.y };
                this.swim(d, { x: prev.x - dx / dd * 22, y: prev.y - dy / dd * 22 }, this.DUCK_SWIM * 1.15, dt);
                if (!faceAway) d.h = this.headingOf(d.x - before.x, d.y - before.y);
            }
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
    // A SECTION ENDS THE WAY A RACE DOES: the boat fades out, the water sits empty for a
    // beat, then the next screen comes up. `secs` is the fade (the race's own FINISH_FADE_SECS
    // by default; 0 when the race has already faded the boat itself), and the beat is fixed.
    // The helm is dropped and the card cleared so the boat just glides away.
    fadeThen(fn, secs) {
        const fade = secs == null ? FINISH_FADE_SECS : secs, beat = 0.7;
        this._fade = { t: fade + beat, fade, beat, fn };
        this.setControls(false); this.goal(null); this.tip(null); this.hideCard();
    },
    update(dt) {
        if (!this.active || !this.s) return;
        if (this._fade) {
            const F = this._fade, p = state.boats[0];
            F.t -= dt;
            if (!p.raceState.finished) {
                p.fadeTimer = Math.max(0, F.t - F.beat);
                p.opacity = F.fade > 0 ? Math.max(0, Math.min(1, p.fadeTimer / F.fade)) : 0;
            }
            if (F.t <= 0) { this._fade = null; F.fn(); }
            return;
        }
        if (this._handoff != null) {
            this._handoff -= dt;
            if (this._handoff <= 0) {
                this._handoff = null;
                if (this.s.kind === 'sail') { this.unit = 2; this.start(2); }
                else if (this.s.kind === 'pond') this.start(this.s.phase === 'start' ? 4 : 3);
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
        const clockOff = this.s.kind === 'sail' || (this.s.kind === 'pond' && this.s.phase !== 'start');
        if (UI.timer) UI.timer.style.visibility = clockOff ? 'hidden' : '';
        if (lesson && UI.leaderboard) UI.leaderboard.classList.add('hidden');
        if (UI.legInfo) UI.legInfo.parentElement.classList.toggle('hidden', lesson);
        // The minimap is a picture of the course; the First Sail has none to show.
        const mm = document.getElementById('minimap');
        if (mm && mm.parentElement) mm.parentElement.style.visibility = this.s.kind === 'sail' ? 'hidden' : '';
    },

    // Skip the SECTION, to the next section's screen. (The race has nothing to skip to.)
    skip() {
        if (!this.active || !this.s) return;
        if (this.s.kind === 'sail') { this.start(2); this.screen('B'); }
        else if (this.s.kind === 'pond' && this.s.phase !== 'start') { this.start(3); this.screen('C'); }
        else if (this.s.kind === 'pond') { this.start(4); this.screen('D'); }
        else if (this.s.kind === 'start') { this.unit = 4; this.beginRace(); }
    },


    // ── the overlays: buoys, launch, ducklings, ribbon, cone ──────────────────
    drawWorld(ctx) {
        if (!this.active || !this.s) return;
        const s = this.s, player = state.boats[0];
        if (s.windIndicator) this.drawWindIndicator(ctx, player);
        if (s.coneOn) this.drawCone(ctx, player);

        // The zone circle, exactly as the course draws its own (165u, amber with the hull inside).
        for (const b of (s.buoys || [])) {
            if (!b.on || b.done || b.noZone) continue;
            const inZone = this.dist(player, b.p) < 165 + 25;
            ctx.save();
            ctx.strokeStyle = inZone ? 'rgba(251, 191, 36, 0.95)' : `rgba(${typeof NAV_RGB !== 'undefined' ? NAV_RGB : '64, 245, 200'}, 0.68)`;
            ctx.lineWidth = inZone ? 5.5 : 4;
            ctx.beginPath(); ctx.arc(b.p.x, b.p.y, 165, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
        // The rounding arrow, the course's own glyph (drawRoundingArrows): a spinning half-arc
        // with a head, clockwise for a mark left to starboard, anticlockwise for port. The
        // windward mark is rounded to starboard; the gate's left can is rounded like a leeward
        // pin (clockwise) and its right can like the boat end (anticlockwise).
        if (s.buoys && s.buoys.length) {
            const rgb = (typeof NAV_RGB !== 'undefined') ? NAV_RGB : '64, 245, 200';
            s.buoys.forEach((b, i) => {
                if (!b.on || b.done || !b.side) return;
                const ccw = b.side === 'port';
                const start = ccw ? Math.PI : 0, end = ccw ? 0 : Math.PI;
                ctx.save();
                ctx.lineWidth = 7; ctx.lineCap = 'round';
                ctx.strokeStyle = `rgba(${rgb}, 0.85)`; ctx.fillStyle = `rgba(${rgb}, 0.85)`;
                ctx.translate(b.p.x, b.p.y);
                ctx.rotate(state.wind.baseDirection + state.time * 8.0 * (ccw ? -1 : 1));
                ctx.beginPath(); ctx.arc(0, 0, 80, start, end, ccw); ctx.stroke();
                ctx.translate(80 * Math.cos(end), 80 * Math.sin(end));
                ctx.rotate(end + (ccw ? -Math.PI / 2 : Math.PI / 2));
                ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.fill();
                ctx.restore();
            });
        }
        if (s.GL && s.GR) {
            ctx.save();
            ctx.strokeStyle = 'rgba(245,197,24,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([16, 12]);
            ctx.beginPath(); ctx.moveTo(s.GL.x, s.GL.y); ctx.lineTo(s.GR.x, s.GR.y); ctx.stroke();
            ctx.restore();
        }
        if (s.buoys) {
            for (const b of s.buoys) {
                if (!b.on || b.done) continue;
                const sp = markSprite(b.kind || 'can');
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

    // The school's own marks on the chart: the gate line, and each live buoy as the
    // course's beacon (drawMinimap hands over its transform and its beacon glyph).
    drawMinimapExtras(ctx, t, beacon) {
        const s = this.s; if (!s || !s.buoys) return;
        if (s.GL && s.GR) {
            const a = t(s.GL.x, s.GL.y), b = t(s.GR.x, s.GR.y);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.5; ctx.stroke();
        }
        for (const bq of s.buoys) {
            if (!bq.on || bq.done) continue;
            const p = t(bq.p.x, bq.p.y);
            beacon(p.x, p.y, 4.2);
        }
    },

    // Off-screen indicators for the school's own marks, drawn by the HUD's edge-indicator
    // block with the course's own glyph: distance, and the rounding arrow for a mark that
    // is rounded (the windward mark to starboard; the gate's ends port and starboard).
    drawEdgeIndicators(ctx, toScreen, rot) {
        const s = this.s; if (!s || !s.buoys || typeof drawMarkEdgeIndicator !== 'function') return;
        const player = state.boats[0];
        s.buoys.forEach((b, i) => {
            if (!b.on || b.done) return;
            const p = toScreen(b.p.x, b.p.y);
            if (p.onScreen) return;
            const d = Math.round(this.dist(player, b.p) * 0.2);
            drawMarkEdgeIndicator(ctx, p.x, p.y, d + 'm', b.side || null, rot);
        });
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
            <button id="school-restart" class="res-btn" style="padding:8px 14px; font-size:12px;">Restart</button>
            <button id="school-quit" class="res-btn" style="padding:8px 14px; font-size:12px;">Leave school</button>`;
        document.body.appendChild(frame);
        frame.querySelector('#school-restart').addEventListener('click', (e) => { e.preventDefault(); this.start(1); e.target.blur(); });
        frame.querySelector('#school-skip').addEventListener('click', (e) => { e.preventDefault(); this.skip(); e.target.blur(); });
        frame.querySelector('#school-quit').addEventListener('click', (e) => { e.preventDefault(); this.exit(); });

        const deb = document.createElement('div');
        deb.id = 'school-debrief';
        deb.style.cssText = 'position:fixed; inset:0; z-index:200; display:none; align-items:center; justify-content:center;'
            + 'background:rgba(5,10,20,0.88);';
        document.body.appendChild(deb);
        const screen = document.createElement('div');
        screen.id = 'school-screen';
        screen.style.cssText = 'position:fixed; inset:0; z-index:215; display:none; align-items:center; justify-content:center;'
            + 'background:radial-gradient(120% 90% at 20% 10%, #16233a 0%, #0c1322 55%, #080e19 100%); color:#eef3fb; overflow:auto;';
        document.body.appendChild(screen);
        const css = document.createElement('style');
        css.textContent = `
            .school-screen-inner { display:flex; gap:56px; align-items:center; width:min(1180px, 94vw); padding:40px 0; }
            .school-screen-coach { flex:none; display:flex; flex-direction:column; align-items:center; }
            .school-screen-face { width:300px; height:300px; border-radius:50%; overflow:hidden; background:#2FAE5C; border:6px solid #F58A00; box-shadow:0 0 0 10px rgba(64,245,200,0.18), 0 30px 60px rgba(0,0,0,0.55); }
            .school-screen-face img { width:100%; height:100%; object-fit:cover; display:block; transform-origin:50% 50%; transform:scale(1.15) translate(0, 6%); }
            .school-screen-body { flex:1; min-width:0; }
            .school-screen-media { display:flex; gap:22px; align-items:center; flex-wrap:wrap; margin:22px 0 6px; }
            .school-screen-buttons { display:flex; gap:12px; flex-wrap:wrap; margin-top:26px; }
            @media (max-width: 900px) { .school-screen-inner { flex-direction:column; gap:24px; } .school-screen-face { width:200px; height:200px; } }`;
        document.head.appendChild(css);

        this._lines = []; this._goalOn = false;
        this._dom = { card, text: card.querySelector('#school-card-text'), frame, deb, goal, goalText: goal.querySelector('#school-goal-text'), ring, rings: [ring], screen };
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
    // A TIP is a reminder: one row of its own under the instruction, replaced rather than
    // stacked, cleared when its condition ends — the instruction and goal stay put.
    tip(text) {
        this.ensureDom();
        this._tip = text || null;
        this.renderLines();
        if (!this._tip && !this._lines.length && !this._goalOn) this.hideCard();
    },
    renderLines() {
        const d = this._dom;
        const esc = t => t.includes('<') ? t : t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        let html = this._lines.map(t => `<div>${esc(t)}</div>`).join('');
        if (this._tip) html += `<div style="color:#8fd8d0; font-size:18px; margin-top:2px;">${esc(this._tip)}</div>`;
        d.text.innerHTML = html;
        if (this._lines.length || this._goalOn || this._tip) this.showCard();
    },
    showCard() {
        const d = this._dom;
        if (d.card.style.display !== 'flex') { d.card.style.display = 'flex'; void d.card.offsetWidth; }
        d.card.style.opacity = '1';
    },
    hideCard() {
        if (!this._dom) return;
        this._lines = []; this._tip = null;
        this._dom.card.style.opacity = '0';
        clearTimeout(this._cardTimer);
        setTimeout(() => { if (this._dom.card.style.opacity === '0') this._dom.card.style.display = 'none'; }, 260);
    },
    showFrame(on) {
        this.ensureDom();
        this._dom.frame.style.display = on ? 'flex' : 'none';
        const race = this.s && this.s.kind === 'race';
        this._dom.frame.querySelector('#school-skip').style.display = race ? 'none' : '';
    },
    showDebrief(graduated, rank, player) {
        this.ensureDom();
        const lines = this.debriefLines(graduated, rank, player);
        const deb = this._dom.deb;
        deb.innerHTML = `
            <div style="width:min(92vw,720px); background:#0c1322; border:1px solid rgba(245,197,24,0.4); border-radius:18px; padding:28px 30px; color:#eef3fb; box-shadow:0 30px 80px rgba(0,0,0,0.6);">
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
                <div style="display:flex; gap:10px; margin-top:22px; flex-wrap:nowrap; white-space:nowrap;">
                    <button id="school-club" class="res-btn res-btn-primary" style="font-size:16px; padding:12px 26px;">Go to Clubhouse</button>
                    <button id="school-again" class="res-btn">Race again</button>
                    <button id="school-replay" class="res-btn">Restart school</button>
                </div>
            </div>`;
        deb.style.display = 'flex';
        deb.querySelector('#school-again').addEventListener('click', () => this.start(4));
        deb.querySelector('#school-replay').addEventListener('click', () => this.start(1));
        deb.querySelector('#school-club').addEventListener('click', () => this.exit());
        this.showFrame(false);
        Sound.updateMusic();
    },
    hideDebrief() { if (this._dom) this._dom.deb.style.display = 'none'; },

    // ── THE SCREENS. One before and after every section: an opaque full page, Coach
    // Paddle large, what came before and what comes next, and the ways out. The next
    // section is already built underneath (start(n) ran) and the sim is held until Next.
    // Screen A shows the pond, but section 1 runs on the open-water twin — so the pond is
    // built first, its chart captured, and then section 1 is built underneath the screen.
    begin() { this.start(1); this.screen('A'); },
    screen(id) {
        this.ensureDom();
        const el = this._dom.screen;
        this._screenId = id;
        clearInterval(this._screenTick); this._screenTick = null;
        if (id === 'E') { this._simHeld = false; }               // the fleet is still racing behind it
        else { this._simHeld = true; state.paused = true; }
        // The card is NOT hidden: the section underneath has already said its first line,
        // and the screen is opaque and above it. Hiding it here lost section 3's opener.
        this.showFrame(false);
        const c = this.screenContent(id);
        el.innerHTML = `
            <div class="school-screen-inner">
                <div class="school-screen-coach">
                    <div class="school-screen-face"><img src="assets/images/competitors/paddle.png" alt="Coach Paddle"></div>
                    <div class="t-label" style="color:#F5C518; letter-spacing:0.3em; font-size:11px; margin-top:14px;">Coach Paddle</div>
                </div>
                <div class="school-screen-body">
                    <div class="t-label" style="color:#8fd8d0; letter-spacing:0.28em; font-size:11px;">${c.kicker}</div>
                    <h1 class="t-display uppercase" style="font-size:46px; line-height:1; margin:10px 0 14px; color:#fff;">${c.title}</h1>
                    <div style="font-size:19px; line-height:1.45; color:#dbe5f3; max-width:62ch;">${c.body}</div>
                    <div class="school-screen-media" id="school-screen-media"></div>
                    <div class="school-screen-buttons" id="school-screen-buttons"></div>
                </div>
            </div>`;
        el.style.display = 'flex';
        if (c.media) c.media(el.querySelector('#school-screen-media'));
        if (id === 'E') {
            // Re-read the finish order as the classmates come in.
            this._screenTick = setInterval(() => {
                if (this._screenId !== 'E' || !this._lastRace) { clearInterval(this._screenTick); return; }
                this._lastRace.sorted = this.raceOrder();
                const list = el.querySelector('#school-results-list'); if (!list) return;
                this.renderResultsList(list);                    // the chart stays; only the order refreshes
            }, 1000);
        }
        const bar = el.querySelector('#school-screen-buttons');
        for (const b of c.buttons) {
            const btn = document.createElement('button');
            btn.className = 'res-btn' + (b.primary ? ' res-btn-primary' : '');
            btn.style.cssText = 'font-size:17px; padding:14px 30px;';
            btn.innerHTML = b.label;
            btn.addEventListener('click', (e) => { e.preventDefault(); b.go(); });
            bar.appendChild(btn);
        }
        Sound.updateMusic();
    },
    hideScreen() {
        if (this._dom) this._dom.screen.style.display = 'none';
        this._screenId = null;
        clearInterval(this._screenTick); this._screenTick = null;
        if (this._simHeld) { this._simHeld = false; state.paused = false; }
        if (this.active) this.showFrame(true);
    },
    // Next runs the section that is already built; the others rebuild and show a screen.
    screenContent(id) {
        const S = this;
        const next = (label) => ({ label: label || 'Begin &rarr;', primary: true, go: () => S.hideScreen() });
        const restart = { label: 'Restart', go: () => { S.start(1); S.screen('A'); } };
        // Skip: to the next section's screen. A→B, B→C, C→D (which is also "skip to race").
        const skipTo = { A: ['B', 2], B: ['C', 3], C: ['D', 4] }[id];
        const skip = skipTo ? { label: 'Skip &rsaquo;', go: () => { S.start(skipTo[1]); S.screen(skipTo[0]); } } : null;
        const club = { label: 'Go to Clubhouse', go: () => S.exit() };
        const chart = (hideCourse, size) => (host) => S.chartPreview(host, hideCourse, size || 340);
        const btns = (...b) => b.filter(Boolean);
        switch (id) {
            case 'A': return {
                kicker: 'Sailing School · Section 1 of 4', title: 'Welcome to sailing school!',
                body: "Let's start by learning the basics of the boat: how it moves, where the wind is, and how to steer it.",
                media: null, buttons: btns(next(), skip, club) };
            case 'B': return {
                kicker: 'The Pond · Section 2 of 4', title: "You've learned to sail the boat.",
                body: "Now let's move to Duckling Pond and learn to sail a course around marks and through gates.",
                media: (host) => { S.venueArtPreview(host, 300); S.chartPreview(host, true, 300); }, buttons: btns(next(), skip, restart, club) };
            case 'C': return {
                kicker: 'Start Practice · Section 3 of 4', title: 'Nicely sailed around the pond.',
                body: `You rounded the mark and took the gate. Now we practice a start sequence: a ${Math.round(state.race.startTimerDuration || 30)}-second clock, and a line you may not cross until it reaches zero. Be near the line, at speed, when it does.`,
                media: (host) => S.startLinePreview(host), buttons: btns(next(), skip, restart, club) };
            case 'D': return {
                kicker: 'The Race · Section 4 of 4', title: "That's a start. Now you race.",
                body: (S._startNote ? S._startNote + ' ' : '') + 'One lap of Duckling Pond: up through the windward gate, back down through the finish. Three classmates are on the line with you. Start on time, keep the mark on the right side, and drop the kite before you head up — do that and you will beat them.',
                media: (host) => { S.courseChartPreview(host, 300, 300); S.fleetPreview(host); }, buttons: btns(next('Begin &rarr;'), restart, club) };
            case 'E': {
                const r = S._lastRace || {};
                return {
                    kicker: r.graduated ? 'Graduated · Sailing School' : 'Sailing School · the race',
                    title: r.graduated ? (r.rank === 1 ? 'You won it.' : `${['', 'First', 'Second', 'Third', 'Fourth'][r.rank] || r.rank + 'th'} of four. You graduate.`) : "Didn't finish this one.",
                    body: (r.lines || []).slice(1).map(l => `<div style="display:flex; gap:12px; margin:4px 0;"><span style="color:#F5C518;">&mdash;</span><span>${l}</span></div>`).join(''),
                    media: (host) => S.resultsPreview(host), buttons: [{ label: 'Go to Clubhouse', primary: true, go: () => S.exit() }, { label: 'Race again', go: () => { S.start(4); S.screen('D'); } }, { label: 'Restart school', go: () => { S.start(1); S.screen('A'); } }] };
            }
        }
        return { kicker: '', title: '', body: '', buttons: [club] };
    },
    // The chart, borrowed whole from the HUD's minimap (same code, bigger canvas), with the
    // course hidden or shown as the screen wants.
    chartCanvas(hideCourse, size) {
        const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
        cv.style.cssText = `width:${size}px; height:${size}px; border-radius:14px; border:2px solid rgba(148,163,184,0.25); box-shadow:0 12px 30px rgba(0,0,0,0.4); background:#0b1c2b;`;
        if (typeof drawMinimap !== 'function' || typeof minimapCtx === 'undefined') return cv;
        const saved = minimapCtx; const wasHidden = this._previewHideCourse;
        this._previewHideCourse = hideCourse; this._previewWhole = true;
        try {
            const doc = window.VenueDoc.get(this.venueKey);
            this._previewBounds = doc ? window.VenueDoc.compile(doc, { light: true }).boundary : null;
        } catch (e) { this._previewBounds = null; }
        try { minimapCtx = cv.getContext('2d'); drawMinimap(); } catch (e) {}
        minimapCtx = saved; this._previewHideCourse = wasHidden; this._previewWhole = false; this._previewBounds = null;
        return cv;
    },
    chartPreview(host, hideCourse, size) {
        host.appendChild(this.chartCanvas(hideCourse, size));
    },
    // The venue's card art (assets/images/venues/pond.png), as the clubhouse shows it. Until
    // that art is delivered the pond's chart stands in.
    venueArtPreview(host, size) {
        const img = new Image();
        img.style.cssText = `width:${size}px; height:${size}px; object-fit:cover; border-radius:14px; border:2px solid rgba(148,163,184,0.25); box-shadow:0 12px 30px rgba(0,0,0,0.4); display:block;`;
        img.alt = 'Duckling Pond';
        img.onerror = () => { img.remove(); this.chartPreview(host, true, size); };
        img.src = `assets/images/venues/${this.venueKey}.png`;
        host.appendChild(img);
    },
    // A start line, drawn plainly: the pin, the coach boat, the line, and you below it.
    startLinePreview(host) {
        const W = 360, H = 200;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        cv.style.cssText = `width:${W}px; height:${H}px; border-radius:14px; border:2px solid rgba(148,163,184,0.25); box-shadow:0 12px 30px rgba(0,0,0,0.4);`;
        host.appendChild(cv);
        const ctx = cv.getContext('2d');
        const pal = (window.VenueDoc.get('pond') || {}).palette || {};
        ctx.fillStyle = pal.baseColor || '#2a7f8c'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) { const x = (i * 53 + 20) % W, y = (i * 37 + 15) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y); ctx.stroke(); }
        const y = 78;
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(300, y); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = "900 italic 14px 'Saira', 'Archivo', sans-serif"; ctx.textAlign = 'center'; ctx.fillText('START', 180, y - 10);
        const draw = (kind, x, yy, w) => { const sp = (typeof markSprite === 'function') && markSprite(kind); if (sp && sp.img && sp.img.naturalWidth) { const h = w * sp.img.naturalHeight / sp.img.naturalWidth; ctx.drawImage(sp.img, x - w / 2, yy - h / 2, w, h); } else { ctx.fillStyle = kind === 'coach' ? '#f97316' : '#f97316'; ctx.beginPath(); ctx.arc(x, yy, 10, 0, Math.PI * 2); ctx.fill(); } };
        draw('inflatable', 60, y, 22);
        draw('coach', 300, y, 60);
        // the trainer below the line, bow up
        ctx.save(); ctx.translate(150, 150);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1e2836'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(12, -6, 10, 18); ctx.lineTo(-10, 18); ctx.quadraticCurveTo(-12, -6, 0, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#F5C518'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 14); ctx.quadraticCurveTo(22, 4, 0, -18); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = "700 12px 'Archivo', sans-serif"; ctx.textAlign = 'center';
        ctx.fillText('wait below the line, cross when the clock hits 0:00', 180, 190);
    },
    // The race-day board's course chart — the same renderer, in the screen's own box.
    courseChartPreview(host, w, h) {
        const box = document.createElement('div');
        box.style.cssText = `position:relative; width:${w}px; height:${h}px; border-radius:14px; overflow:hidden; background:rgba(11,28,43,0.75); border:2px solid rgba(148,163,184,0.25); box-shadow:0 12px 30px rgba(0,0,0,0.4); flex:none;`;
        const inner = document.createElement('div');
        inner.style.cssText = 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);';
        const cv = document.createElement('canvas');
        cv.style.cssText = 'display:block; width:100%; height:100%;';
        inner.appendChild(cv); box.appendChild(inner); host.appendChild(box);
        if (typeof drawCourseMiniMap === 'function') {
            try { drawCourseMiniMap({ box, inner, canvas: cv, noRecords: true, visible: () => this._screenId != null }); } catch (e) {}
        }
    },
    // A fleet band — the clubhouse's own card: face, name, species, archetype, the rig.
    fleetBand(config, opts) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'width:min(560px, 100%);';
        wrap.innerHTML = (typeof profileBandHTML === 'function') ? profileBandHTML(config, Object.assign({ compact: true, boat: true }, opts || {})) : `<div>${config.name}</div>`;
        const cv = wrap.querySelector('.profile-boat-canvas');
        if (cv && typeof renderProfileBoat === 'function') requestAnimationFrame(() => { try { renderProfileBoat(cv, config); } catch (e) {} });
        return wrap;
    },
    // The three classmates, as their clubhouse cards.
    fleetPreview(host) {
        const list = document.createElement('div');
        list.style.cssText = 'display:flex; flex-direction:column; gap:8px; flex:1; min-width:420px;';
        for (const c of this.classmateConfigs()) list.appendChild(this.fleetBand(c));
        host.appendChild(list);
    },
    // The race, abbreviated: rank, face, name, time.
    resultsPreview(host) {
        const r = this._lastRace; if (!r || !r.sorted) return;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex; gap:22px; align-items:flex-start; flex-wrap:wrap;';
        const list = document.createElement('div');
        list.id = 'school-results-list';
        list.style.cssText = 'display:flex; flex-direction:column; gap:8px; flex:1; min-width:420px;';
        this.renderResultsList(list);
        wrap.appendChild(list);
        host.appendChild(wrap);
    },
    renderResultsList(list) {
        const r = this._lastRace; if (!r || !r.sorted) return;
        list.innerHTML = '';
        r.sorted.forEach((b, i) => {
            const rs = b.raceState;
            const time = rs.finished && !rs.resultStatus ? formatTime(rs.finishTime) : (rs.resultStatus || 'racing');
            const config = b.isPlayer ? this.TRAINER : (AI_CONFIG.find(c => c.name === b.name) || { name: b.name, creature: '', hull: b.colors.hull, spinnaker: b.colors.spinnaker, sail: b.colors.sail, cockpit: b.colors.cockpit });
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; gap:12px;';
            row.innerHTML = `<div class="t-display" style="font-size:30px; width:34px; text-align:right; color:${i === 0 ? '#F5C518' : '#7787a0'};">${i + 1}</div>`;
            const band = this.fleetBand(config, { label: (b.isPlayer ? 'YOU · ' : '') + `<span class="t-mono" style="letter-spacing:0; color:${rs.resultStatus ? '#f87171' : '#fff'};">${time}</span>` });
            band.style.flex = '1';
            row.appendChild(band);
            list.appendChild(row);
        });
    },
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
