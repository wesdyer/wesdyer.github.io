// regatta/js/game/state.js — the shared mutable world: `state` (the master
// object), settings + defaults, the venue table/palette derivation, and the
// Boat class. Nearly every subsystem reads state; write access is described in
// guidelines/architecture.md. Classic script; global scope. Extracted verbatim
// from script.js (refactor 2026-08-24).


// Settings
const DEFAULT_SETTINGS = {
    navAids: true,
    // Stored in the polarity the Settings toggle shows. The boat carries the
    // inverse (boat.manualTrim) because the physics reads more naturally that way.
    autoTrim: true,
    soundEnabled: true,
    bgSoundEnabled: true,
    musicEnabled: false,
    penaltiesEnabled: true,
    surf: true,               // breaking seas on the windward shore — see drawSurf
    cameraMode: 'heading',
    // WHICH FACE THE INSTRUMENTS WEAR: 'boat' | 'rose' | 'both' | 'off'.
    // Defaults to the boat panel — TWA alone, unlabelled, next to the thing it describes
    // rather than 900 px away in a corner. 'rose' is the original dial and carries the full set (TWS,
    // VMG, the heading pip, the waypoint arrow, PLANING/SURFING). 'both' runs them together,
    // which is not redundant: the panel is what you sail by and the rose is what you consult,
    // and the two answer at different rates. 'off' shows neither.
    hudMode: 'boat',
    // WHO YOU SAIL AS. The custom hull/sail/cockpit/spinnaker/pattern settings are gone:
    // you pick a character from the fleet and get their boat, their name and their face.
    // One way to say it instead of two — a recoloured Finley was not Finley, and the
    // player's appearance living in `settings` while everyone else's lived on the boat is
    // what put six `isPlayer ? settings.x : boat.colors.x` branches inside drawBoat.
    character: 'Finley',
    // Not part of the character: the telltales are an INSTRUMENT, not a livery, and no
    // character defines one.
    telltaleColor: '#fbbf24',
    venue: 'bay',
};

let settings = { ...DEFAULT_SETTINGS };

// --- Venues -------------------------------------------------------------------
// A venue is a KEY and a DOCUMENT — including its card copy now (`doc.card`: name,
// tag, blurb, conditions, hazards), edited in editor.html with everything else. What
// remains here is only the SET AND ORDER of the clubhouse picker: journey order,
// matching the script tags in index.html. A doc the list does not name (an editor
// scratch file) still opens under its own key; it just gets no tile.
//
// ⚠️ `seatrials` is the eval anchor: the harness pins it via localStorage
// (`eval/eval_harness.js`), and the document, card art and golden traces are all
// filed under it. `river` is Sockeye Run — the key stays `river` for the same
// reason. KEYS ARE IDENTITY; the card copy is what is free to change.
const VENUE_ORDER = ['duckling', 'bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'seatrials'];

// The card copy for a key, straight from the document. Always an object, so callers
// read fields without guarding — a missing card just briefs blank.
function venueCard(key) {
    const d = window.VenueDoc && window.VenueDoc.get(key);
    return (d && d.card) || {};
}

// Bay palette = whatever water.js shipped with; captured at load so venue
// switches can restore it.
let DEFAULT_WATER_PALETTE = null;

// Puff/lull tints follow the venue's water so cat's-paws read as pressure on
// THIS water, not blue patches pasted on top. Authored `palette.gusts` wins; a
// document that authors its water without authoring puffs gets them DERIVED from
// that water (gustTintFrom below); only a venue with no palette at all falls back
// here — and these ARE that venue's water, so bay keeps the original blues.
const DEFAULT_GUST_COLORS = { gustDark: [9, 46, 130], gustMid: [11, 63, 176], lullBright: [150, 222, 255], lullMid: [120, 210, 255] };
let activeGustColors = DEFAULT_GUST_COLORS;

// ── WHAT COLOUR THE STREAM IS ───────────────────────────────────────────────
//
// THE DARKEST VERSION OF THIS VENUE'S OWN WATER. Not a colour of its own: a current is not
// a substance sitting on the sea, it is the sea moving, so the one thing it must never do
// is look like it came from somewhere else.
//
// This was `#0640bf` — a flat, saturated blue, with a comment above it claiming the streaks
// were "tinted to the venue's water (river = deep green)". They never were. Sockeye Run's
// water is #3f6f5f, a green, so the stream through it drew in cobalt: the one element on
// screen that belonged to no palette, on the venue whose whole identity is its current.
//
// Taking the water's own hue to its darkest gives contrast and belonging from the same
// move. Every venue's water is painted as a gradient from base to deep, so a value BELOW
// the deep end cannot be confused with water anywhere on the map, while the hue keeps it
// unmistakably this water rather than a blue decal on a green river.
//
// Saturation is nudged UP as lightness comes down. Scaling RGB toward black desaturates in
// perception — the darkest green and the darkest blue converge on the same near-black — and
// a stream that reads charcoal everywhere would be the flat constant this replaces, only
// duller. The floor stops an already-dark venue (Glowtide's #0a0f30) going to pure black,
// where the streak would be a hole rather than water.
const CURRENT_L = 0.42;      // fraction of the deep water's own lightness
const CURRENT_L_FLOOR = 0.07; // never blacker than this, whatever the venue authored
const CURRENT_S_GAIN = 1.35;  // saturation added back as value comes off
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn;
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h;
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h, s, l];
}
function hslToRgb(h, s, l) {
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const hue = (t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
}
const DEFAULT_CURRENT_COLOR = [3, 40, 66];
let activeCurrentColor = DEFAULT_CURRENT_COLOR;
function currentTintFrom(pal) {
    const hex = String((pal && pal.deepColor) || '').replace('#', '');
    if (hex.length !== 6) return DEFAULT_CURRENT_COLOR;
    const [h, s, l] = rgbToHsl(parseInt(hex.substring(0, 2), 16),
                               parseInt(hex.substring(2, 4), 16),
                               parseInt(hex.substring(4, 6), 16));
    return hslToRgb(h, Math.min(1, s * CURRENT_S_GAIN), Math.max(CURRENT_L_FLOOR, l * CURRENT_L));
}

// Puff and lull tints for a venue that authored its WATER but not its puffs —
// the same move as the current tint above, so the water and everything drawn as
// "this water, differently" come from one authored pair. A gust is the deep water
// pressed darker and a touch more saturated (a cat's-paw is dark rough water); a
// lull is the base water lifted toward white (a hole is pale glassy water).
//
// The ratios are the medians of the seven venues that hand-authored both water and
// puffs, so a derived venue sits in the same family as the tuned ones. The
// lightness floors do for puffs what CURRENT_L_FLOOR does for the stream: on water
// authored near black (Glowtide), pressing darker still has to leave something
// visible, which is why that venue's hand-authored puffs are LIGHTER than its deep.
const GUST_DARK_L = 0.62, GUST_MID_L = 0.85;         // x the deep water's lightness
const GUST_DARK_L_FLOOR = 0.11, GUST_MID_L_FLOOR = 0.16;
const GUST_S_GAIN = 1.2, GUST_MID_S_GAIN = 1.1;      // saturation pressed up with depth
const LULL_BRIGHT_LIFT = 0.62, LULL_MID_LIFT = 0.52; // how far toward white the base lifts
function gustTintFrom(pal) {
    const rgb = (v) => {
        const hex = String(v || '').replace('#', '');
        if (hex.length !== 6) return null;
        return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16),
                parseInt(hex.substring(4, 6), 16)];
    };
    const base = rgb(pal && pal.baseColor), deep = rgb(pal && pal.deepColor);
    if (!base || !deep) return DEFAULT_GUST_COLORS;
    const [hB, sB, lB] = rgbToHsl(base[0], base[1], base[2]);
    const [hD, sD, lD] = rgbToHsl(deep[0], deep[1], deep[2]);
    return {
        gustDark:   hslToRgb(hD, Math.min(1, sD * GUST_S_GAIN), Math.max(GUST_DARK_L_FLOOR, lD * GUST_DARK_L)),
        gustMid:    hslToRgb(hD, Math.min(1, sD * GUST_MID_S_GAIN), Math.max(GUST_MID_L_FLOOR, lD * GUST_MID_L)),
        lullBright: hslToRgb(hB, Math.min(1, sB * 0.9), lB + (1 - lB) * LULL_BRIGHT_LIFT),
        lullMid:    hslToRgb(hB, Math.min(1, sB * 0.8), lB + (1 - lB) * LULL_MID_LIFT)
    };
}

function applyVenuePalette(venueKey) {
    if (!window.WATER_CONFIG) return;
    if (!DEFAULT_WATER_PALETTE) {
        DEFAULT_WATER_PALETTE = {
            baseColor: window.WATER_CONFIG.baseColor,
            deepColor: window.WATER_CONFIG.deepColor,
            shallowColor: window.WATER_CONFIG.shallowColor,
            shorelineColor: window.WATER_CONFIG.shorelineColor,
            // Defaulted here, not just read where used: applyVenuePalette Object.assigns the
            // merged palette onto WATER_CONFIG, so a key the NEXT venue omits would keep the
            // last one's value and Lighthouse Cove would inherit Glowtide's midnight.
            night: window.WATER_CONFIG.night || 0,
            moonDir: window.WATER_CONFIG.moonDir != null ? window.WATER_CONFIG.moonDir : 25,
            // ⚠️ heroColor BELONGS ON THIS LIST AND WAS MISSING, which is the same bug the
            // three lines above were written to fix, one key later. It is authored by only
            // some documents (the lagoon's bright water inside the reef), it is never in the
            // base WATER_CONFIG, and Object.assign below only overwrites keys the NEXT
            // document actually names — so once you sailed Pearl Lagoon, its hero water rode
            // along into every venue you visited afterwards for the rest of the session.
            //
            // THE SYMPTOM WAS NOT SUBTLE AND WAS EASY TO MISREAD AS AN ART PROBLEM.
            // submergedTint derives every bar and meadow from this colour, so Bluewater
            // Bonanza's coral bars painted #bff9ef (bright mint) if you had been to the
            // lagoon and #5e7378 (dark grey-teal) if you had not — the same venue, two
            // completely different sea beds, decided by where you sailed previously. Any
            // venue without its own heroColor was affected: lake, bay and ocean.
            heroColor: window.WATER_CONFIG.heroColor || null
        };
    }
    // A venue DOCUMENT may override the water colours. Water is not an editable object —
    // it is wherever land and the arena are not — so what there is to author about it is
    // how it looks, and that belongs with the rest of the venue's design.
    // The DOCUMENT owns the water's look. It used to be a venue table with the document
    // allowed to override; the table is gone, so there is one place to change a colour.
    const docPal = (window.VenueDoc && window.VenueDoc.get(venueKey) || {}).palette;
    const pal = Object.assign({}, DEFAULT_WATER_PALETTE, docPal || {});
    const { gusts, ...waterPal } = pal;
    // Underscore keys are designer annotations (e.g. lagoon's `_note` on how its water
    // pair was picked) — they ride in the document, not in the live config.
    for (const k in waterPal) if (k[0] === '_') delete waterPal[k];
    Object.assign(window.WATER_CONFIG, waterPal);
    // From the MERGED palette, so a document can author its puff colours. It used to read
    // `venuePal.gusts` alone, which meant `doc.palette.gusts` was silently ignored — the
    // one part of the water's look the editor could write and the game would not read.
    // A document that authors WATER without authoring puffs gets them derived from that
    // water: the editor writes only baseColor/deepColor, so before this, recolouring a
    // venue's water left bay-blue puffs pasted on it — the exact mismatch the tints exist
    // to prevent. No palette at all keeps the original blues: bay IS the default water.
    activeGustColors = gusts
        || ((docPal && (docPal.baseColor || docPal.deepColor)) ? gustTintFrom(pal) : DEFAULT_GUST_COLORS);
    // Derived from the MERGED palette, like the puffs — so a document that authors its own
    // water gets a stream in it without authoring a second colour that could disagree.
    activeCurrentColor = currentTintFrom(pal);
    _puffCal = null;     // re-solve the puff tone alphas against the new water
}

// Apply a venue's condition ranges on top of resetGame's randomized defaults.
// Bay is a no-op (beyond clearing fx + restoring the palette) by design.


// A venue is now its NAME and its document. There is no weather table left to apply — wind,
// gusts and current are all stated by regions in the document, and the palette moved there
// too — so this only records which venue is being sailed.
//
// A key counts if it has a DOCUMENT — the editor opens venue files under their own
// keys, and falling back to 'bay' here read the wrong document's palette for any of them.
function applyVenueConditions() {
    const known = settings.venue && window.VenueDoc && window.VenueDoc.get(settings.venue);
    const key = known ? settings.venue : 'bay';
    state.race.venue = key;
    // Purely visual atmosphere the document opts into (fx.snowfall on Glacier
    // Sound). Nothing in the sim reads this — it gates screen-space paint only.
    state.race.venueFx = (known && known.fx) || {};
    applyVenuePalette(key);
}

// What a venue is CALLED, wherever a person reads it: the document's card, then the key.
function venueDisplayName(key) {
    const c = venueCard(key);
    return c.name || c.tag || key || null;
}

// --- Venue mechanics -------------------------------------------------------


// Polar: above this effective wind, boats become overpowered and more wind stops being
// strictly faster. The heavyAir stat decides how much pace they bleed — it owns the whole
// wind-strength axis, and handling is pure turn rate. Coping used to be split with handling
// as well, which made a high-handling, high-heavyAir boat untouchable above the threshold.
// guidelines/skills.md 3.2.
// ── OVERPOWERED ─────────────────────────────────────────────────────────────
// Too much breeze costs you speed. This is NOT a property of a place — it is a boat's
// reaction to the wind it is actually in, so it is derived where that wind is measured and
// applies on every venue. It used to be `fx.overpowered`, set on Glacier Sound alone, which
// said that only in the Arctic does a squall cost you anything.
//
// THE THRESHOLD IS THE GATE, and it gates better than a hand-kept list of venues ever did:
// Gatorgrass tops out at 8 knots and will never pay this, Stillwater at 12 essentially never,
// while anywhere that genuinely reaches 18 pays it — which is the right answer arrived at by
// wind speed instead of by geography.
//
// `handlingRelief` is gone; it had been 0 since the relief moved to the heavyAir stat, and a
// dead constant in a tuning struct is a trap for whoever tunes it next.
// Apparent wind angle close-hauled: where the sheet comes fully in. True wind angle
// Game State
const state = {
    boats: [], // Array of Boat instances. boats[0] is Player.
    camera: {
        // The VIEW CENTRE. Derived each frame from the follow point below plus the
        // look-ahead offset — not lerped directly, see the camera block in update().
        x: 0,
        y: 0,
        // The smoothed FOLLOW point: where the boat is, with the lag. Kept apart from the
        // view centre so the look-ahead can be rigid while the follow stays soft.
        fx: undefined,
        fy: undefined,
        rotation: 0,
        target: 'boat',
        mode: 'heading',
        message: '',
        messageTimer: 0
    },
    wind: {
        direction: 0,
        baseDirection: 0,
        currentShift: 0,
        speed: 10,
        baseSpeed: 10
    },
    showNavAids: true,
    particles: [],
    waveStates: new Map(),
    keys: {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false,
        Shift: false,
    },
    paused: false,
    gameSpeed: 1.0,
    time: 0,
    race: { // Global Race State
        status: 'prestart',
        timer: 30.0,
        legLength: 4000,
        totalLegs: 4,
        startTimerDuration: 30.0
    },
    course: {}
};

// player's boat has faded, so shortening this shortens the wait after your own finish.
const FINISH_FADE_SECS = 2.5;

// ── PLAYER CONTROLS ─────────────────────────────────────────────────────────
// The one seam between input devices and the physics. updateBoat reads a
// controls struct, never state.keys directly: the player's is sampled from the
// keyboard here, bots get NO_CONTROLS (their commands arrive via updateAI).
// A replay driver, RL crew, or gamepad plugs in at this seam.
const NO_CONTROLS = Object.freeze({ left: false, right: false, slow: false, trimUp: false, trimDown: false });
function sampleKeyControls() {
    const k = state.keys;
    return { left: !!k.ArrowLeft, right: !!k.ArrowRight, slow: !!k.Shift,
             trimUp: !!k.ArrowUp, trimDown: !!k.ArrowDown };
}

class Boat {
    constructor(id, isPlayer, startX, startY, name="USA", config=null) {
        this.id = id;
        this.isPlayer = isPlayer;
        this.name = name;
        this.x = startX;
        this.y = startY;
        this.heading = 0; // Will be set during reset
        this.velocity = { x: 0, y: 0 };
        this.speed = 0;
        this.prevHeading = 0;
        this.lastWindSide = undefined;

        this.sailAngle = 0;
        this.manualTrim = false;
        this.manualSailAngle = 0;
        this.boomSide = 1;
        this.targetBoomSide = 1;
        this.heel = 0;          // lagged heeling pressure, 1.0 == a beam reach in OVERPOWERED.threshold kt
        this.luffing = false;
        this.luffIntensity = 0;
        this.spinnaker = false;
        this.spinnakerDeployProgress = 0;

        this.opacity = 1.0;
        this.fadeTimer = FINISH_FADE_SECS;

        // APPEARANCE IS THE SAME PATH FOR EVERYONE. It used to branch on `isPlayer` here and
        // in six places inside drawBoat, because the player's colours lived in `settings`
        // and everyone else's lived on the boat. The player is a character now, so there is
        // one source and no branch.
        applyBoatIdentity(this, config, isPlayer);

        // Race State
        this.raceState = {
            leg: 0,
            isRounding: false,
            // Swept-angle rounding progress. Declared here rather than created on
            // first use so it always EXISTS — the golden traces hash the fields a
            // boat has at race start, so a field created mid-race is never observed.
            roundSweep: 0,
            roundWrong: 0,
            roundArmed: false,
            roundBanked: false,
            roundFrom: null,
            roundRebased: false,
            roundEntryB: null,
            roundWrapped: true,
            isTacking: false, // Rule 13
            inZone: false,
            zoneEnterTime: 0,
            ocs: false,
            penalty: false,
            penaltyProgress: 0, // Deprecated but kept for compatibility if needed
            penaltyTimer: 0,        // kept for save/eval compat; no longer drives a slowdown
            penaltyTurnsOwed: 0,    // 360° turns queued by fouls
            penaltyRot: 0,          // net signed rotation (rad) accumulated while flagged
            penaltyLastHeading: null,
            penaltyFlagTime: 0,     // seconds since first un-cleared foul (drives AI deadline)
            totalPenalties: 0,
            finished: false,
            finishTime: 0,
            startTimeDisplay: 0,
            startTimeDisplayTimer: 0,
            // Did AUTO TRIM touch this run? Sampled every frame; decides which record
            // board the run competes on (see runTrimBoard).
            usedAutoTrim: false,
            legStartTime: 0,
            lastLegDuration: 0,
            startLegDuration: null,
            legSplitTimer: 0,
            lastPos: { x: startX, y: startY },
            nextWaypoint: { x: 0, y: 0, dist: 0, angle: 0 },
            trace: [],
            legTimes: [],
            // Where the player stood at the start and at each mark. UI only — the results
            // screen's splits are the one place a race says WHERE it was won, and a place
            // cannot be reconstructed after the fact. Recorded for the player alone (see
            // advanceLeg), so the cost is one O(n) scan per rounding.
            startRank: 0,
            legRanks: [],
            // THE WIND THAT ACTUALLY BLEW, off the player's own masthead — see updateBoat.
            // The pre-race board quotes a forecast over the whole course; a result should be
            // able to say what the race itself felt, which no field average can reconstruct
            // afterwards because it depends on where you sailed.
            windObsMin: Infinity,
            windObsMax: 0,
            windObsSum: 0,
            windObsN: 0,
            legManeuvers: new Array(32).fill(0),
            legTopSpeeds: new Array(32).fill(0),
            legDistances: new Array(32).fill(0),
            legSpeedSums: new Array(32).fill(0),
            isPlaning: false,
            planingTimer: 0,
            planingFactor: 0
        };

        // AI State
        this.ai = {
            targetHeading: 0,
            state: 'start',
            tackCooldown: 0,
            stuckTimer: 0,
            recoveryMode: false,
            recoveryTarget: 0,
            prestartSide: (Math.random() > 0.5) ? 1 : -1,
            trimTimer: 0,
            currentTrimTarget: 0,
            congestionTimer: Math.random() * 2.0
        };

        // Personality Stats Removed for Basic AI

        this.badAirIntensity = 0;
        this.turbulence = [];
        this.turbulenceTimer = 0;

        this.playerProximity = { minD: Infinity, close: false };
        this.lbRank = 0;
        this.creature = config ? (config.creature || "Unknown") : "Unknown";
        // Racing archetype persona (see ARCHETYPES). Player and unknown configs
        // get pure defaults = the baseline fleet behavior.
        this.archetype = (config && config.archetype) || null;
        // `neutral` implies traitsOff — see the stat site for the full switch set.
        const traitsOff = typeof window !== 'undefined' && window.__CHAR
            && (window.__CHAR.traitsOff || window.__CHAR.neutral);
        const archDef = !traitsOff && this.archetype && typeof ARCHETYPES !== 'undefined' ? ARCHETYPES[this.archetype] : null;
        // Per-character trait overrides layer on top of the archetype, so a character
        // can be a better reader than another of the same archetype — impossible
        // before, since all eight shift boats shared one shiftSense. Optional and
        // additive: absent means the archetype value. Discipline is one or two fields
        // within ~30% of the archetype's, or archetypes stop meaning anything
        // (guidelines/skills.md 6).
        this.traits = Object.assign({}, DEFAULT_TRAITS,
                                    archDef ? archDef.traits : {},
                                    (!traitsOff && config && config.traits) || {});
        this.prevRank = 0;
    }
}

// THE WIND OVER TIME. There is nothing global left to wander.
//
// This used to roll a whole day's weather from venue variables: `shiftiness` picked an
// oscillation amplitude, period and slew from a table of presets, `variability` added
// speed noise, and a per-race persistent shift veered the breeze one way over the race. All
// of it rode on top of whatever the wind regions said, which meant a course could state its
// wind and still be overruled by a number in a table it could not see.
//
// A REGION STATES ITS OWN WANDER. `dirVar`, `speedVar` and `period` are region fields and
// always were; getWindAt oscillates each region against them. So a steady course is one
// whose regions state no variation, and a shifty one is authored — the same rule as the
// gusts, and as the wind's own direction and speed before them.
//
// Stillwater Lake authors it (offset side regions on distinct periods plus a slow
// full-cover swinger); the other venues still race in a steady breeze. The oscillating
// shift and the pick-a-side persistent veer are authored region variation, not a global.
