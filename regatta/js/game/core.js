// regatta/js/game/core.js — engine-wide constants and pure helpers: CONFIG,
// canvas fonts, the seeded RNG streams (mulberry32; fxRand/snowRand are the
// VISUALS-ONLY streams — sim code must never draw from them, and visual code
// in update() must never draw from Math.random), water-mask geometry, angle and
// segment math, time formatting. Loads first among the game files. Classic
// script; global scope. Extracted verbatim from script.js (refactor 2026-08-24).
// Game Configuration
const CONFIG = {
    turnSpeed: 0.015, // Radians per frame (~51°/s at full authority). Deliberately
                      // ~50% above realistic keelboat rates: on a 3-4 min compressed
                      // course, responsiveness (crash tacks, duck-or-die calls) beats
                      // realism — and it measured faster AND cleaner for the AI fleet
                      // (race -7s, mark hits -55%). Fine trim stays on Shift (0.25x).
    turnPenalty: 0.9999,
    cameraPanSpeed: 1.25,
    cameraRotateSpeed: 0.01,
    windSpeed: 5,
    waterColor: '#3b82f6',
    boatColor: '#f8fafc',
    sailColor: '#ffffff',
    cockpitColor: '#cbd5e1',
};

// ── Canvas type ────────────────────────────────────────────────────────────
// Mirrors the .t-* system in index.html so text painted on the water belongs to
// the same product as the DOM chrome. Canvas has no CSS fallback chain worth
// trusting: if the webfont hasn't loaded when ctx.font is set, it silently
// resolves to the OS default and stays there for that paint. FONTS_READY flips
// once document.fonts settles; until then these strings still name the family,
// so the only cost of an early frame is a fallback glyph set.
const FONT = {
    // Label voice — Archivo 800 caps. Names, chips, anything titling a thing.
    label:   (px) => `800 ${px}px Archivo, sans-serif`,
    // Data voice — IBM Plex Mono 600, tabular. Every number.
    mono:    (px) => `600 ${px}px "IBM Plex Mono", ui-monospace, monospace`,
    // Display voice — Saira 900 italic. Course geometry callouts.
    display: (px) => `italic 900 ${px}px Saira, Archivo, sans-serif`,
    // Brand voice — the club name curved on the course boundary.
    brand:   (px) => `900 ${px}px Archivo, sans-serif`,
};
let FONTS_READY = false;
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { FONTS_READY = true; });
}

// Seeded RNG Helper
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

const MASK_WORLD = 8750;

// Ray-cast point-in-polygon. Mask landmasses are large and CONCAVE — the main
// one has a bounding radius of ~9400 units, more than half the world — so the
// bounding-circle test used for floes is meaningless against them and rejects
// every candidate position on the map. Anything asking "is this on land?" for a
// mask shape has to test the actual polygon.
function pointInPoly(x, y, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x, yi = verts[i].y, xj = verts[j].x, yj = verts[j].y;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
    }
    return inside;
}

// Is this position open water on a mask venue? Margin pushes it clear of the shore.
function inMaskWater(x, y, margin = 0) {
    const land = state.course.landShapes;
    if (!land) return true;
    for (const isl of land) {
        if (pointInPoly(x, y, isl.vertices)) return false;
        if (margin > 0) {
            // near-shore rejection: distance to the polygon edge
            for (let i = 0, j = isl.vertices.length - 1; i < isl.vertices.length; j = i++) {
                if (Geom.distToSegment({ x, y }, isl.vertices[j], isl.vertices[i]) < margin) return false;
            }
        }
    }
    return true;
}

// buildMaskGeography() lived here. It traced the painted mask into collider
// polygons at load time. Venue documents ARE those polygons now, so the
// conversion step is gone; art/bake_mask.py imports a mask into a document
// once, and nothing re-derives geometry at runtime.



// Ice-density gradient. 0 at the start end of the course, 1 at the glacier end;
// returns the probability that a candidate ice position survives sampling. The

// Polar ice floes: drifting islands. Slow enough for the AI's reactive
// avoidance; fast enough that the course never looks the same twice.
const snowRand = mulberry32(40713);

// Visual-effect PRNG. Particle spawning (spray, wake foam, wind streaks, current
// swirls) lives inside update() rather than draw(), so it was drawing from
// Math.random — the SIMULATION stream.
//
// That made the sim depend on the camera: the spawn point is sampled near
// state.camera, and the follow-up draws are CONDITIONAL on what is at that point
// (`if (local.speed > 0.15)`, `if (rel > 0.85)`). Look somewhere else and a
// different NUMBER of draws is consumed, so every subsequent boat, gust and
// shift changes. The camera is never reset between races, so race 2 in a session
// raced differently from race 1 — and the AI eval, which runs 100 trials in one
// page, carried each trial's final camera position into the next.
//
// Particles are strictly visual (state.particles is read only by updateParticles
// and the draw loops), so they get their own stream and the sim stops noticing
// them. Deliberately NOT reseeded per race: visual variety across races is fine,
// and it can no longer reach the simulation.
const fxRand = mulberry32(0x5EED17);
// Physics Helper Functions
function getTurnSpeed() {
    const PH = (typeof window !== 'undefined' && window.__PHYS) ? window.__PHYS : {};
    return PH.turnSpeed != null ? PH.turnSpeed : CONFIG.turnSpeed;
}

function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}


function isVeryDark(color) {
    if (!color) return false;
    let r = 0, g = 0, b = 0;
    if (color.startsWith('#')) {
        const hex = color.substring(1);
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        }
    } else if (color.startsWith('rgb')) {
        const parts = color.match(/\d+/g);
        if (parts && parts.length >= 3) {
            r = parseInt(parts[0]);
            g = parseInt(parts[1]);
            b = parseInt(parts[2]);
        }
    }
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return luma < 60;
}

function formatTime(s) {
    const m = Math.floor(Math.abs(s) / 60);
    const sec = Math.floor(Math.abs(s) % 60);
    return `${s < 0 ? "-" : ""}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// ⚠️ ROUNDED TO THE MILLISECOND, AND DERIVED FROM IT. Truncating `(s % 1) * 1000` printed a
// 271.743s record as 4:31.742, because 271.743 is really 271.74299999… in binary — the
// display was showing float noise as a lost thousandth. Taking whole milliseconds first and
// splitting minutes and seconds back out of them also makes the carry at .9996 free.
function formatSplitTime(s) {
    const total = Math.round(Math.abs(s) * 1000);
    const m = Math.floor(total / 60000);
    const sec = Math.floor((total % 60000) / 1000);
    return `${m}:${sec.toString().padStart(2, '0')}.${(total % 1000).toString().padStart(3, '0')}`;
}

// A RECORD IS A STOPWATCH READING, not a clock time. `formatTime` rounds to the second,
// which is fine for a finish order and useless for the one number you are trying to beat:
// two runs a third of a second apart both printed 04:03. Thousandths, minutes unpadded —
// 4:31.743 — the same face the mid-race split banner already uses.
const formatBestTime = formatSplitTime;

function getClosestPointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return { x: ax + dx * t, y: ay + dy * t };
}

function checkLineIntersection(Ax, Ay, Bx, By, Cx, Cy, Dx, Dy) {
    const rX = Bx - Ax, rY = By - Ay, sX = Dx - Cx, sY = Dy - Cy;
    const rxs = rX * sY - rY * sX, qpx = Cx - Ax, qpy = Cy - Ay;
    if (Math.abs(rxs) < 1e-5) return null;
    const t = (qpx * sY - qpy * sX) / rxs, u = (qpx * rY - qpy * rX) / rxs;
    return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? { t, u } : null;
}

function rayCircleIntersection(ox, oy, dx, dy, cx, cy, r) {
    const lx = ox - cx, ly = oy - cy;
    const b = 2 * (lx * dx + ly * dy), c = (lx * lx + ly * ly) - (r * r);
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const t1 = (-b - Math.sqrt(disc)) / 2, t2 = (-b + Math.sqrt(disc)) / 2;
    return (t1 >= 0) ? t1 : (t2 >= 0 ? t2 : null);
}

