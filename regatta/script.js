// Game Configuration
const CONFIG = {
    turnSpeed: 0.01, // Radians per frame (approx) -> adjusted for dt in update
    turnPenalty: 0.995,
    cameraPanSpeed: 1.25,
    cameraRotateSpeed: 0.01,
    windSpeed: 5,
    waterColor: '#3b82f6',
    boatColor: '#f8fafc',
    sailColor: '#ffffff',
    cockpitColor: '#cbd5e1',
};

// AI Configuration
const AI_CONFIG = [
    { name: 'Bixby', creature: 'Otter', hull: '#0046ff', spinnaker: '#FFD400', sail: '#FFFFFF', cockpit: '#C9CCD6' },
    { name: 'Skim', creature: 'Flying Fish', hull: '#8FD3FF', spinnaker: '#FF2D95', sail: '#FFFFFF', cockpit: '#AEB4BF' },
    { name: 'Wobble', creature: 'Platypus', hull: '#FF8C1A', spinnaker: '#00E5FF', sail: '#FFFFFF', cockpit: '#B0B0B0' },
    { name: 'Pinch', creature: 'Lobster', hull: '#E10600', spinnaker: '#FFFFFF', sail: '#FFFFFF', cockpit: '#5A5A5A' },
    { name: 'Bruce', creature: 'Great White', hull: '#121212', spinnaker: '#ff0606', sail: '#FFFFFF', cockpit: '#3A3A3A' },
    { name: 'Strut', creature: 'Flamingo', hull: '#FF4F9A', spinnaker: '#000000', sail: '#FFFFFF', cockpit: '#B0BEC5' },
    { name: 'Gasket', creature: 'Beaver', hull: '#FFE600', spinnaker: '#000000', sail: '#000000', cockpit: '#C4BEB2' },
    { name: 'Chomp', creature: 'Alligator', hull: '#2ECC71', spinnaker: '#F4C27A', sail: '#000000', cockpit: '#C1B58A' },
    { name: 'Vex', creature: 'Lizard', hull: '#0fe367', spinnaker: '#D9D9D9', sail: '#FFFFFF', cockpit: '#D0D0D0' },
    { name: 'Hug', creature: 'Starfish', hull: '#9900ff', spinnaker: '#e8a6ff', sail: '#FFFFFF', cockpit: '#C9CCD6' }
];


// Settings
const DEFAULT_SETTINGS = {
    navAids: true,
    manualTrim: false,
    soundEnabled: true,
    bgSoundEnabled: true,
    penaltiesEnabled: true,
    cameraMode: 'heading',
    hullColor: '#f1f5f9',
    sailColor: '#ffffff',
    cockpitColor: '#cbd5e1',
    spinnakerColor: '#ef4444'
};

let settings = { ...DEFAULT_SETTINGS };

// J/111 Polar Data
const J111_POLARS = {
    angles: [0, 30, 38, 45, 52, 60, 75, 90, 110, 120, 135, 150, 180],
    speeds: {
        6: {
            spinnaker: [0.0, 0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.46, 5.5, 5.48, 5.25, 4.72, 4.01],
            nonSpinnaker: [0.0, 0.0, 4.7, 4.93, 5.18, 5.29, 5.36, 5.46, 4.94, 4.65, 4.08, 3.51, 3.01]
        },
        8: {
            spinnaker: [0.0, 0.0, 0.6, 1.2, 1.8, 2.4, 3.5, 6.79, 6.87, 6.85, 6.58, 5.94, 5.06],
            nonSpinnaker: [0.0, 0.0, 5.8, 6.09, 6.41, 6.55, 6.65, 6.79, 6.17, 5.82, 5.12, 4.42, 3.8]
        },
        10: {
            spinnaker: [0.0, 0.0, 0.7, 1.4, 2.1, 2.8, 4.0, 7.89, 8.01, 8.01, 7.72, 6.99, 6.0],
            nonSpinnaker: [0.0, 0.0, 6.66, 7.0, 7.38, 7.56, 7.7, 7.89, 7.2, 6.8, 6.0, 5.2, 4.5]
        },
        12: {
            spinnaker: [0.0, 0.0, 0.8, 1.6, 2.4, 3.2, 4.5, 8.6, 8.74, 8.75, 8.44, 7.65, 6.58],
            nonSpinnaker: [0.0, 0.0, 7.23, 7.6, 8.02, 8.22, 8.38, 8.6, 7.85, 7.42, 6.56, 5.69, 4.93]
        },
        14: {
            spinnaker: [0.0, 0.0, 0.9, 1.8, 2.7, 3.6, 5.0, 9.01, 9.18, 9.2, 8.89, 8.08, 6.98],
            nonSpinnaker: [0.0, 0.0, 7.52, 7.91, 8.36, 8.57, 8.76, 9.01, 8.25, 7.81, 6.91, 6.01, 5.23]
        },
        16: {
            spinnaker: [0.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.5, 9.42, 9.66, 9.7, 9.42, 8.59, 7.47],
            nonSpinnaker: [0.0, 0.0, 7.76, 8.18, 8.66, 8.9, 9.13, 9.42, 8.68, 8.24, 7.32, 6.39, 5.61]
        },
        20: {
            spinnaker: [0.0, 0.0, 1.2, 2.4, 3.6, 4.8, 6.5, 10.43, 10.87, 11.01, 10.81, 9.98, 8.88],
            nonSpinnaker: [0.0, 0.0, 8.2, 8.7, 9.26, 9.6, 9.98, 10.43, 9.77, 9.35, 8.4, 7.42, 6.66]
        }
    }
};

// Physics Helper Functions
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

// Game State
const state = {
    boats: [], // Array of Boat instances. boats[0] is Player.
    camera: {
        x: 0,
        y: 0,
        rotation: 0,
        target: 'boat',
        mode: 'heading',
        message: '',
        messageTimer: 0
    },
    wind: {
        direction: 0,
        baseDirection: 0,
        speed: 10,
        baseSpeed: 10
    },
    showNavAids: true,
    particles: [],
    keys: {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false,
        Shift: false,
    },
    paused: false,
    time: 0,
    race: { // Global Race State
        status: 'prestart',
        timer: 30.0,
    },
    course: {}
};

const burgeeImg = new Image();
burgeeImg.src = 'salty-crew-yacht-club-burgee.png';

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
        this.luffing = false;
        this.luffIntensity = 0;
        this.spinnaker = false;
        this.spinnakerDeployProgress = 0;

        // Colors
        if (config) {
             this.colors = {
                 hull: config.hull,
                 sail: config.sail,
                 cockpit: config.cockpit,
                 spinnaker: config.spinnaker
             };
        } else if (!isPlayer) {
             this.colors = { hull: '#fff', sail: '#fff', cockpit: '#ccc', spinnaker: '#f00' };
        }

        // Race State
        this.raceState = {
            leg: 0,
            isRounding: false,
            isTacking: false, // Rule 13
            inZone: false,
            zoneEnterTime: 0,
            ocs: false,
            penalty: false,
            penaltyProgress: 0,
            finished: false,
            finishTime: 0,
            startTimeDisplay: 0,
            startTimeDisplayTimer: 0,
            legStartTime: 0,
            lastLegDuration: 0,
            startLegDuration: null,
            legSplitTimer: 0,
            lastPos: { x: startX, y: startY },
            nextWaypoint: { x: 0, y: 0, dist: 0, angle: 0 },
            trace: [],
            legTimes: [],
            legManeuvers: [0, 0, 0, 0, 0],
            legTopSpeeds: [0, 0, 0, 0, 0],
            legDistances: [0, 0, 0, 0, 0]
        };

        // AI State
        this.ai = {
            targetHeading: 0,
            state: 'start',
            tackCooldown: 0,
            stuckTimer: 0,
            recoveryMode: false,
            recoveryTarget: 0
        };

        this.badAirIntensity = 0;
        this.turbulence = [];
        this.turbulenceTimer = 0;
    }
}

function updateTurbulence(boat, dt) {
    if (boat.raceState.finished) return;

    // Spawn
    boat.turbulenceTimer -= dt;
    if (boat.turbulenceTimer <= 0) {
        // Increase spawn rate: 0.02 - 0.05s
        boat.turbulenceTimer = 0.02 + Math.random() * 0.03;
        // Init properties relative to cone (d=0)
        // Cross offset ratio: -0.5 to 0.5
        boat.turbulence.push({
            d: 0,
            crossRatio: (Math.random() - 0.5),
            speed: state.wind.speed * 4 + (Math.random()-0.5)*10, // px per sec
            phase: Math.random() * Math.PI * 2,
            life: 1.0
        });
    }

    // Update
    const maxDist = 350;
    for (let i = boat.turbulence.length - 1; i >= 0; i--) {
        const p = boat.turbulence[i];
        p.d += p.speed * dt;
        p.life -= dt * 0.3; // fade out

        if (p.d > maxDist || p.life <= 0) {
            boat.turbulence[i] = boat.turbulence[boat.turbulence.length - 1];
            boat.turbulence.pop();
        }
    }
}

function drawDisturbedAir(ctx) {
    const windDir = state.wind.direction;
    const wx = -Math.sin(windDir);
    const wy = Math.cos(windDir);
    // Right Vector
    const rx = -wy;
    const ry = wx;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

    for (const boat of state.boats) {
        if (boat.raceState.finished || !boat.turbulence) continue;

        for (const p of boat.turbulence) {
             const coneWidth = 20 + (p.d / 350) * 80;
             // Zigzag effect: Increased frequency (0.05 -> 0.08) and amplitude (5 -> 12)
             const zig = Math.sin(p.d * 0.08 + state.time * 8 + p.phase) * 12;
             const crossOffset = p.crossRatio * coneWidth + zig;

             const px = boat.x + wx * p.d + rx * crossOffset;
             const py = boat.y + wy * p.d + ry * crossOffset;

             // Slightly larger size
             const size = 2.0 + (p.d/350)*2.0;
             // More opaque: 0.4 -> 0.6 max alpha
             const alpha = Math.max(0, Math.min(1, (1.0 - p.d/350) * 0.6));

             ctx.globalAlpha = alpha;
             ctx.beginPath();
             ctx.arc(px, py, size, 0, Math.PI * 2);
             ctx.fill();
        }
    }
    ctx.restore();
}


// Sound System
const Sound = {
    ctx: null,

    init: function() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playTone: function(freq, duration, type='sine', startTime=0) {
        if (!settings.soundEnabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const now = this.ctx.currentTime + startTime;
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    },

    playStart: function() {
        if (!settings.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Noise
        const bufferSize = this.ctx.sampleRate * 2.0;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(50, now + 1.0);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 2.0);
        // Thump
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
        oscGain.gain.setValueAtTime(1.0, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.0);
    },

    playFinish: function() {
        if (!settings.soundEnabled) return;
        this.init();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => this.playTone(freq, 0.4, 'square', i * 0.15));
    },

    playPenalty: function() {
        if (!settings.soundEnabled) return;
        this.init();
        this.playTone(100, 0.5, 'sawtooth');
    },

    playGateClear: function() {
        if (!settings.soundEnabled) return;
        this.init();
        this.playTone(659.25, 0.1, 'sine', 0);
        this.playTone(880.00, 0.4, 'sine', 0.1);
    },

    initWindSound: function() {
        if (!this.ctx || this.windSource) return;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = buffer;
        this.windSource.loop = true;
        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        this.windSource.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.ctx.destination);
        this.windSource.start(0);
    },

    updateWindSound: function(speed) {
        if (!settings.soundEnabled || !settings.bgSoundEnabled) {
            if (this.windGain) this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            return;
        }
        if (this.ctx) {
            if (!this.windSource) this.initWindSound();
            if (this.windGain && this.windFilter) {
                 const clampedSpeed = Math.max(5, Math.min(25, speed));
                 const volume = 0.05 + ((clampedSpeed - 5) / 20) * 0.25;
                 const freq = 300 + ((clampedSpeed - 5) / 20) * 900;
                 const now = this.ctx.currentTime;
                 this.windGain.gain.setTargetAtTime(volume, now, 0.1);
                 this.windFilter.frequency.setTargetAtTime(freq, now, 0.1);
            }
        }
    }
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements Cache
const UI = {
    compassRose: document.getElementById('hud-compass-rose'),
    windArrow: document.getElementById('hud-wind-arrow'),
    headingArrow: document.getElementById('hud-heading-arrow'),
    speed: document.getElementById('hud-speed'),
    windSpeed: document.getElementById('hud-wind-speed'),
    windAngle: document.getElementById('hud-wind-angle'),
    trimMode: document.getElementById('hud-trim-mode'),
    vmg: document.getElementById('hud-vmg'),
    timer: document.getElementById('hud-timer'),
    startTime: document.getElementById('hud-start-time'),
    message: document.getElementById('hud-message'),
    legInfo: document.getElementById('hud-leg-info'),
    legTimes: document.getElementById('hud-leg-times'),
    waypointArrow: document.getElementById('hud-waypoint-arrow'),
    pauseScreen: document.getElementById('pause-screen'),
    helpScreen: document.getElementById('help-screen'),
    settingsScreen: document.getElementById('settings-screen'),
    helpButton: document.getElementById('help-button'),
    closeHelp: document.getElementById('close-help'),
    resumeHelp: document.getElementById('resume-help'),
    pauseButton: document.getElementById('pause-button'),
    resumeButton: document.getElementById('resume-button'),
    restartButton: document.getElementById('restart-button'),
    settingsButton: document.getElementById('settings-button'),
    closeSettings: document.getElementById('close-settings'),
    saveSettings: document.getElementById('save-settings'),
    settingSound: document.getElementById('setting-sound'),
    settingBgSound: document.getElementById('setting-bg-sound'),
    settingPenalties: document.getElementById('setting-penalties'),
    settingNavAids: document.getElementById('setting-navaids'),
    settingTrim: document.getElementById('setting-trim'),
    settingCameraMode: document.getElementById('setting-camera-mode'),
    settingHullColor: document.getElementById('setting-color-hull'),
    settingSailColor: document.getElementById('setting-color-sail'),
    settingCockpitColor: document.getElementById('setting-color-cockpit'),
    settingSpinnakerColor: document.getElementById('setting-color-spinnaker'),
    leaderboard: document.getElementById('leaderboard'),
    lbLeg: document.getElementById('lb-leg'),
    lbRows: document.getElementById('lb-rows'),
    rulesStatus: document.getElementById('hud-rules-status'),
    boatRows: {}
};

// Settings Functions
function loadSettings() {
    const stored = localStorage.getItem('regatta_settings');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            settings = { ...DEFAULT_SETTINGS, ...parsed };
        } catch (e) { console.error("Failed to parse settings", e); }
    }
    applySettings();
}

function saveSettings() {
    localStorage.setItem('regatta_settings', JSON.stringify(settings));
    applySettings();
}

function applySettings() {
    state.showNavAids = settings.navAids;
    if (state.boats.length > 0) {
        state.boats[0].manualTrim = settings.manualTrim;
    }
    state.camera.mode = settings.cameraMode;

    if (UI.settingSound) UI.settingSound.checked = settings.soundEnabled;
    if (UI.settingBgSound) UI.settingBgSound.checked = settings.bgSoundEnabled;
    if (UI.settingPenalties) UI.settingPenalties.checked = settings.penaltiesEnabled;
    if (UI.settingNavAids) UI.settingNavAids.checked = settings.navAids;
    if (UI.settingTrim) UI.settingTrim.checked = settings.manualTrim;
    if (UI.settingCameraMode) UI.settingCameraMode.value = settings.cameraMode;
    if (UI.settingHullColor) UI.settingHullColor.value = settings.hullColor;
    if (UI.settingSailColor) UI.settingSailColor.value = settings.sailColor;
    if (UI.settingCockpitColor) UI.settingCockpitColor.value = settings.cockpitColor;
    if (UI.settingSpinnakerColor) UI.settingSpinnakerColor.value = settings.spinnakerColor;

    if (UI.rulesStatus) {
        if (settings.penaltiesEnabled) {
            UI.rulesStatus.textContent = "RULES: ON";
            UI.rulesStatus.className = `mt-1 text-[10px] font-bold text-emerald-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/50 uppercase tracking-wider`;
        } else {
            UI.rulesStatus.textContent = "RULES: OFF";
            UI.rulesStatus.className = `mt-1 text-[10px] font-bold text-red-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-red-500/50 uppercase tracking-wider`;
        }
    }
}

function togglePause(show) {
    const isPaused = state.paused;
    const shouldPause = show !== undefined ? show : !isPaused;
    if (shouldPause) {
        state.paused = true;
        if (UI.pauseScreen) UI.pauseScreen.classList.remove('hidden');
        if (UI.helpScreen) UI.helpScreen.classList.add('hidden');
        if (UI.settingsScreen) UI.settingsScreen.classList.add('hidden');
    } else {
        state.paused = false;
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        lastTime = 0;
    }
}

function toggleHelp(show) {
    if (!UI.helpScreen) return;
    const isVisible = !UI.helpScreen.classList.contains('hidden');
    const shouldShow = show !== undefined ? show : !isVisible;
    if (shouldShow) {
        state.paused = true;
        UI.helpScreen.classList.remove('hidden');
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        if (UI.settingsScreen) UI.settingsScreen.classList.add('hidden');
    } else {
        UI.helpScreen.classList.add('hidden');
        state.paused = false;
        lastTime = 0;
    }
}

function toggleSettings(show) {
    if (!UI.settingsScreen) return;
    const isVisible = !UI.settingsScreen.classList.contains('hidden');
    const shouldShow = show !== undefined ? show : !isVisible;
    if (shouldShow) {
        state.paused = true;
        UI.settingsScreen.classList.remove('hidden');
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        if (UI.helpScreen) UI.helpScreen.classList.add('hidden');
    } else {
        UI.settingsScreen.classList.add('hidden');
        state.paused = false;
        lastTime = 0;
    }
}

// Event Listeners
if (UI.helpButton) UI.helpButton.addEventListener('click', (e) => { e.preventDefault(); toggleHelp(true); UI.helpButton.blur(); });
if (UI.closeHelp) UI.closeHelp.addEventListener('click', () => toggleHelp(false));
if (UI.resumeHelp) UI.resumeHelp.addEventListener('click', () => toggleHelp(false));
if (UI.pauseButton) UI.pauseButton.addEventListener('click', (e) => { e.preventDefault(); togglePause(true); UI.pauseButton.blur(); });
if (UI.resumeButton) UI.resumeButton.addEventListener('click', (e) => { e.preventDefault(); togglePause(false); });
if (UI.restartButton) UI.restartButton.addEventListener('click', (e) => { e.preventDefault(); restartRace(); });
if (UI.settingsButton) UI.settingsButton.addEventListener('click', (e) => { e.preventDefault(); toggleSettings(true); UI.settingsButton.blur(); });
if (UI.closeSettings) UI.closeSettings.addEventListener('click', () => toggleSettings(false));
if (UI.saveSettings) UI.saveSettings.addEventListener('click', () => toggleSettings(false));

if (UI.settingSound) UI.settingSound.addEventListener('change', (e) => { settings.soundEnabled = e.target.checked; saveSettings(); if (settings.soundEnabled) Sound.init(); Sound.updateWindSound(state.wind.speed); });
if (UI.settingBgSound) UI.settingBgSound.addEventListener('change', (e) => { settings.bgSoundEnabled = e.target.checked; saveSettings(); Sound.updateWindSound(state.wind.speed); });
if (UI.settingPenalties) UI.settingPenalties.addEventListener('change', (e) => { settings.penaltiesEnabled = e.target.checked; saveSettings(); });
if (UI.settingNavAids) UI.settingNavAids.addEventListener('change', (e) => { settings.navAids = e.target.checked; saveSettings(); });
if (UI.settingTrim) UI.settingTrim.addEventListener('change', (e) => { settings.manualTrim = e.target.checked; saveSettings(); });
if (UI.settingCameraMode) UI.settingCameraMode.addEventListener('change', (e) => { settings.cameraMode = e.target.value; saveSettings(); });
if (UI.settingHullColor) UI.settingHullColor.addEventListener('input', (e) => { settings.hullColor = e.target.value; saveSettings(); });
if (UI.settingSailColor) UI.settingSailColor.addEventListener('input', (e) => { settings.sailColor = e.target.value; saveSettings(); });
if (UI.settingCockpitColor) UI.settingCockpitColor.addEventListener('input', (e) => { settings.cockpitColor = e.target.value; saveSettings(); });
if (UI.settingSpinnakerColor) UI.settingSpinnakerColor.addEventListener('input', (e) => { settings.spinnakerColor = e.target.value; saveSettings(); });

let minimapCtx = null;
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

window.addEventListener('keydown', (e) => {
    if (settings.soundEnabled && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();
    let key = e.key;
    if (key === 'a' || key === 'A') key = 'ArrowLeft';
    if (key === 'd' || key === 'D') key = 'ArrowRight';
    if (key === 'w' || key === 'W') key = 'ArrowUp';
    if (key === 's' || key === 'S') key = 'ArrowDown';

    if (state.keys.hasOwnProperty(key)) state.keys[key] = true;
    if (e.key === 'Enter') {
        const modes = ['heading', 'north', 'wind', 'gate'];
        state.camera.mode = modes[(modes.indexOf(state.camera.mode) + 1) % modes.length];
        settings.cameraMode = state.camera.mode;
        state.camera.message = state.camera.mode.toUpperCase();
        state.camera.messageTimer = 1.5;
        saveSettings();
    }
    if (e.key === ' ' || e.code === 'Space') {
        if (state.boats.length > 0) state.boats[0].spinnaker = !state.boats[0].spinnaker;
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        if (state.boats.length > 0) {
            state.boats[0].manualTrim = !state.boats[0].manualTrim;
            settings.manualTrim = state.boats[0].manualTrim;
            saveSettings();
            if (state.boats[0].manualTrim) state.boats[0].manualSailAngle = Math.abs(state.boats[0].sailAngle);
        }
    }
    if (e.key === '?' || (e.shiftKey && e.key === '/')) toggleHelp();
    if (e.key === 'Escape') {
        if (UI.helpScreen && !UI.helpScreen.classList.contains('hidden')) toggleHelp(false);
        else if (UI.settingsScreen && !UI.settingsScreen.classList.contains('hidden')) toggleSettings(false);
        else togglePause();
    }
    if (e.key === 'F1') {
        e.preventDefault();
        if (window.html2canvas) {
            window.html2canvas(document.body).then(c => {
                const link = document.createElement('a');
                link.download = 'regatta-screenshot.png';
                link.href = c.toDataURL();
                link.click();
            });
        }
    }
    if (e.key === 'F2') { e.preventDefault(); toggleSettings(); }
    if (e.key === 'F3') {
        e.preventDefault();
        settings.soundEnabled = !settings.soundEnabled;
        saveSettings();
        if (settings.soundEnabled) Sound.init();
        Sound.updateWindSound(state.wind.speed);
    }
    if (e.key === 'F4') {
        e.preventDefault();
        settings.penaltiesEnabled = !settings.penaltiesEnabled;
        saveSettings();
        const msg = settings.penaltiesEnabled ? "RULES ENABLED" : "RULES DISABLED";
        const col = settings.penaltiesEnabled ? "text-green-400" : "text-red-400";
        showRaceMessage(msg, col, `border-${settings.penaltiesEnabled ? 'green' : 'red'}-400/50`);
        setTimeout(hideRaceMessage, 1500);
    }
    if (e.key === '`' || e.code === 'Backquote') {
        state.showNavAids = !state.showNavAids;
        settings.navAids = state.showNavAids;
        saveSettings();
    }
});

window.addEventListener('keyup', (e) => {
    let key = e.key;
    if (key === 'a' || key === 'A') key = 'ArrowLeft';
    if (key === 'd' || key === 'D') key = 'ArrowRight';
    if (key === 'w' || key === 'W') key = 'ArrowUp';
    if (key === 's' || key === 'S') key = 'ArrowDown';
    if (state.keys.hasOwnProperty(key)) state.keys[key] = false;
});

window.addEventListener('focus', () => { for (const k in state.keys) state.keys[k] = false; });

// Race Logic & Update Functions

function formatTime(s) {
    const m = Math.floor(Math.abs(s) / 60);
    const sec = Math.floor(Math.abs(s) % 60);
    return `${s < 0 ? "-" : ""}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function formatSplitTime(s) {
    const m = Math.floor(Math.abs(s) / 60);
    const sec = Math.floor(Math.abs(s) % 60);
    const ms = Math.floor((Math.abs(s) % 1) * 1000);
    return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

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

function showRaceMessage(text, textColorClass, borderColorClass) {
    if (UI.message) {
        UI.message.textContent = text;
        UI.message.className = `mt-2 text-lg font-bold bg-slate-900/80 px-4 py-1 rounded-full border shadow-lg ${textColorClass} ${borderColorClass}`;
        UI.message.classList.remove('hidden');
    }
}

function hideRaceMessage() { if (UI.message) UI.message.classList.add('hidden'); }

function getTargetSpeed(twaRadians, useSpinnaker, windSpeed) {
    const twaDeg = Math.abs(twaRadians) * (180 / Math.PI);
    const angles = J111_POLARS.angles;
    const speeds = [6, 8, 10, 12, 14, 16, 20];

    const getPolarSpeed = (ws) => {
        const data = J111_POLARS.speeds[ws];
        const sData = useSpinnaker ? data.spinnaker : data.nonSpinnaker;
        for (let i = 0; i < angles.length - 1; i++) {
            if (twaDeg >= angles[i] && twaDeg <= angles[i+1]) {
                const t = (twaDeg - angles[i]) / (angles[i+1] - angles[i]);
                return sData[i] + t * (sData[i+1] - sData[i]);
            }
        }
        return sData[sData.length - 1];
    };

    if (windSpeed <= 0) return 0;
    if (windSpeed < 6) {
         // Linearly interpolate from 0 to Speed@6
         return getPolarSpeed(6) * (windSpeed / 6.0);
    }

    let lower = 6, upper = 20;
    if (windSpeed >= 20) { lower = 20; upper = 20; }
    else {
        for (let i = 0; i < speeds.length - 1; i++) {
            if (windSpeed >= speeds[i] && windSpeed <= speeds[i+1]) { lower = speeds[i]; upper = speeds[i+1]; break; }
        }
    }

    const s1 = getPolarSpeed(lower), s2 = getPolarSpeed(upper);
    return lower === upper ? s1 : s1 + (windSpeed - lower) / (upper - lower) * (s2 - s1);
}

function checkBoundaryExiting(boat) {
    if (!state.course.boundary) return false;
    const b = state.course.boundary;
    const dx = boat.x - b.x, dy = boat.y - b.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > b.radius - 200) {
        // Check if heading away
        const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
        // Normal vector at boundary is (dx, dy) relative to center.
        // We want dot product of heading and normal.
        if (hx * dx + hy * dy > 0) return true;
    }
    return false;
}

function getRightOfWay(b1, b2) {
    // 0. Tacking (Rule 13) - Keep Clear while tacking
    if (b1.raceState.isTacking && !b2.raceState.isTacking) return b2;
    if (!b1.raceState.isTacking && b2.raceState.isTacking) return b1;
    // If both tacking, standard collision rules (or both keep clear of each other? Rule 13 only says keep clear of other boats)

    // 1. Mark Room (Rule 18) - First in zone has rights
    if (b1.raceState.inZone && !b2.raceState.inZone) return b1;
    if (!b1.raceState.inZone && b2.raceState.inZone) return b2;
    if (b1.raceState.inZone && b2.raceState.inZone) {
         if (b1.raceState.zoneEnterTime < b2.raceState.zoneEnterTime) return b1;
         if (b2.raceState.zoneEnterTime < b1.raceState.zoneEnterTime) return b2;
    }

    // 2. Opposite Tacks (Rule 10)
    // boomSide > 0 (Left Boom) => Starboard Tack
    const t1 = b1.boomSide > 0 ? 1 : -1;
    const t2 = b2.boomSide > 0 ? 1 : -1;

    if (t1 !== t2) {
        return (t1 === 1) ? b1 : b2; // Starboard (1) wins
    }

    // 3. Same Tack (Rule 11: Windward/Leeward & Rule 12: Clear Astern)
    // Check Clear Astern (Rule 12)
    // A boat is Clear Astern if its hull is behind a line abeam from the aftermost point of the other boat.
    // Overlap exists if neither is clear astern.
    // If NOT overlapped, Clear Astern keeps clear.

    const h1 = b1.heading, h2 = b2.heading;
    // We assume courses are roughly similar if same tack.

    // Helper: isClearAstern(behind, ahead)
    const isClearAstern = (behind, ahead) => {
        // Line abeam of ahead's stern.
        // Ahead stern pos:
        const sternOffset = 30;
        const ahX = Math.sin(ahead.heading), ahY = -Math.cos(ahead.heading);
        const sternX = ahead.x - ahX * sternOffset;
        const sternY = ahead.y - ahY * sternOffset;

        // Vector from stern to behind boat
        const dx = behind.x - sternX;
        const dy = behind.y - sternY;

        // Project onto Ahead's forward vector. If < 0, it is behind the stern line.
        // Forward vector (ahX, ahY).
        // Actually, "Behind the line abeam".
        // Abeam line is perpendicular to centerline.
        // So dot product with Forward vector < 0 means behind the abeam line.
        const dot = dx * ahX + dy * ahY;

        // Also check if "Clear" (not overlapping laterally?)
        // Rule definition: "hull is behind a line abeam from the aftermost point..."
        // If dot < 0, it IS clear astern. Even if laterally far.
        // (Assuming "abeam" line extends infinitely).
        return dot < -10; // Buffer
    };

    const b1Astern = isClearAstern(b1, b2);
    const b2Astern = isClearAstern(b2, b1);

    if (b1Astern && !b2Astern) return b2; // b1 Clear Astern -> Keeps Clear -> b2 ROW
    if (b2Astern && !b1Astern) return b1; // b2 Clear Astern -> Keeps Clear -> b1 ROW

    // If Overlapped (Rule 11): Windward gives way to Leeward.
    // Determine Windward side based on Tack.
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const wDir = state.wind.direction;

    // Wind Flow Vector (To Direction)
    // wDir 0 is From North (Flow South: 0, 1)
    const fx = -Math.sin(wDir);
    const fy = Math.cos(wDir);

    // Cross Product (Flow x RelPos) to determine Left/Right
    // cp > 0 => Right of Flow (Starboard Side)
    // cp < 0 => Left of Flow (Port Side)
    const cp = fx * dy - fy * dx;

    if (t1 === 1) { // Starboard Tack
        // Windward Side is Right (Starboard). Leeward Side is Left (Port).
        // If cp > 0 (b2 is Right of Flow -> West -> Leeward), b2 (Leeward) ROW.
        // If cp < 0 (b2 is Left of Flow -> East -> Windward), b1 (Leeward) ROW.
        return (cp > 0) ? b2 : b1;
    } else { // Port Tack
        // Windward Side is Left (Port). Leeward Side is Right (Starboard).
        // If cp > 0 (b2 is Right of Flow -> West -> Windward), b1 (Leeward) ROW.
        // If cp < 0 (b2 is Left of Flow -> East -> Leeward), b2 (Leeward) ROW.
        return (cp > 0) ? b1 : b2;
    }
}

function updateAI(boat, dt) {
    if (boat.isPlayer) return;

    const timeScale = dt * 60;
    const windDir = state.wind.direction;
    const waypoint = boat.raceState.nextWaypoint;

    // Default target: Center of Gate (Pass between marks)
    let targetX = waypoint.x;
    let targetY = waypoint.y;

    const marks = state.course.marks;
    if (marks && marks.length >= 4) {
        // Identify active gate based on leg
        let indices = (boat.raceState.leg === 0 || boat.raceState.leg === 2 || boat.raceState.leg === 4) ? [0, 1] : [2, 3];

        if (boat.raceState.isRounding) {
            const m1 = marks[indices[0]];
            const m2 = marks[indices[1]];
            const d1 = (boat.x - m1.x) ** 2 + (boat.y - m1.y) ** 2;
            const d2 = (boat.x - m2.x) ** 2 + (boat.y - m2.y) ** 2;
            const targetMark = (d1 < d2) ? m1 : m2;

            const cx = (m1.x + m2.x) / 2;
            const cy = (m1.y + m2.y) / 2;
            // Aim wide of the mark to ensure crossing the extension line
            const vx = targetMark.x - cx;
            const vy = targetMark.y - cy;

            targetX = targetMark.x + vx;
            targetY = targetMark.y + vy;
        } else {
            // Aim for the midpoint to ensure passing between marks
            targetX = (marks[indices[0]].x + marks[indices[1]].x) / 2;
            targetY = (marks[indices[0]].y + marks[indices[1]].y) / 2;
        }
    }

    const dx = targetX - boat.x;
    const dy = targetY - boat.y;
    let targetAngle = Math.atan2(dx, -dy);

    // Stuck Detection & Recovery
    if (state.race.status === 'racing') {
        if (boat.speed < 0.25) { // < ~1 kt
            boat.ai.stuckTimer += dt;
        } else {
            boat.ai.stuckTimer = Math.max(0, boat.ai.stuckTimer - dt);
        }

        if (boat.ai.stuckTimer > 2.0 && !boat.ai.recoveryMode) {
             boat.ai.recoveryMode = true;
             // Pick Beam Reach (90 deg to wind)
             // Use current wind side, or random if head to wind
             const currentWindAngle = normalizeAngle(boat.heading - windDir);
             let side = Math.sign(currentWindAngle);
             if (side === 0) side = (Math.random() > 0.5) ? 1 : -1;
             boat.ai.recoveryTarget = normalizeAngle(windDir + side * Math.PI * 0.5);
        }

        if (boat.ai.recoveryMode) {
             if (boat.speed > 1.0) { // Recovered (> 4 kts)
                 boat.ai.recoveryMode = false;
                 boat.ai.stuckTimer = 0;
             } else {
                 targetAngle = boat.ai.recoveryTarget;
             }
        }
    }

    // PRESTART Special Logic
    if (state.race.status === 'prestart') {
        // Zig Zag in start area
        if (state.race.timer > 10) {
             const holdingY = 400;
             const holdingX = (boat.id % 2 === 0) ? 300 : -300;
             const dx = holdingX - boat.x;
             const dy = holdingY - boat.y;
             targetAngle = Math.atan2(dx, -dy);
        } else {
             // Go for line center
             const dx = 0 - boat.x;
             const dy = 0 - boat.y;
             targetAngle = Math.atan2(dx, -dy);
        }
    }

    // Determine Sailing Mode
    const angleToTarget = targetAngle;
    const angleToWind = normalizeAngle(angleToTarget - windDir);
    const absAngleToWind = Math.abs(angleToWind);

    let mode = 'reach';
    const noGoLimit = Math.PI / 4.0;
    const downwindLimit = Math.PI * 0.75;

    if (absAngleToWind < noGoLimit) mode = 'upwind';
    else if (absAngleToWind > downwindLimit) mode = 'downwind';

    if (boat.ai.tackCooldown > 0) boat.ai.tackCooldown -= dt;

    let desiredHeading = boat.heading;

    if (mode === 'reach') {
        desiredHeading = angleToTarget;
    } else {
        const currentTack = (normalizeAngle(boat.heading - windDir) > 0) ? 1 : -1;
        const bestTWA = (mode === 'upwind') ? (Math.PI/4) : (Math.PI * 0.8);

        const headingOnTack = normalizeAngle(windDir + currentTack * bestTWA);
        const headingOnSwap = normalizeAngle(windDir - currentTack * bestTWA);

        const vmgCurrent = Math.cos(normalizeAngle(headingOnTack - angleToTarget));
        const vmgSwap = Math.cos(normalizeAngle(headingOnSwap - angleToTarget));

        let shouldSwap = false;
        if (checkBoundaryExiting(boat)) shouldSwap = true;
        else if (boat.ai.tackCooldown <= 0 && vmgSwap > vmgCurrent + 0.15) shouldSwap = true;

        if (shouldSwap && boat.ai.tackCooldown <= 0) {
            desiredHeading = headingOnSwap;
            boat.ai.tackCooldown = 15.0 + Math.random() * 5.0;
        } else {
            desiredHeading = headingOnTack;
        }
    }

    // Collision Avoidance
    let avoidX = 0, avoidY = 0;
    const detectRadius = 200;
    const collisionRadius = 60;

    for (const other of state.boats) {
        if (other === boat) continue;
        const dx = other.x - boat.x;
        const dy = other.y - boat.y;
        const distSq = dx*dx + dy*dy;

        if (distSq < detectRadius * detectRadius) {
             const dist = Math.sqrt(distSq);
             // Check if in front (or slightly abeam)
             const bx = Math.sin(boat.heading), by = -Math.cos(boat.heading);
             const dotFront = dx * bx + dy * by;

             // Don't avoid boats that are well behind us
             if (dotFront > -30) {
                  const rowBoat = getRightOfWay(boat, other);
                  const iHaveROW = (rowBoat === boat);

                  let shouldAvoid = false;
                  let strength = 0;

                  if (iHaveROW) {
                      // Rule 14: Avoid contact if collision is imminent, even if we have ROW
                      if (dist < collisionRadius) {
                          shouldAvoid = true;
                          strength = (1.0 - dist / collisionRadius) * 5.0; // Panic mode
                      }
                  } else {
                      // Give Way: Yield early
                      shouldAvoid = true;
                      strength = (1.0 - dist / detectRadius) * 3.0;
                      if (dist < collisionRadius) strength *= 2.0; // Urgency
                  }

                  if (shouldAvoid) {
                      avoidX -= (dx / dist) * strength;
                      avoidY -= (dy / dist) * strength;
                  }
             }
        }
    }

    // Mark Avoidance
    if (state.course && state.course.marks) {
        const markDetectRadius = 200; // Increased radius for marks
        for (const m of state.course.marks) {
             const dx = m.x - boat.x;
             const dy = m.y - boat.y;
             const distSq = dx*dx + dy*dy;
             if (distSq < markDetectRadius * markDetectRadius) {
                 const dist = Math.sqrt(distSq);
                 const bx = Math.sin(boat.heading), by = -Math.cos(boat.heading);

                 // Check if mark is generally ahead (allow wider angle)
                 if (dx * bx + dy * by > -50) {
                      // Calculate strong repulsion
                      // Strength increases dramatically as we get closer
                      const strength = Math.pow((1.0 - dist / markDetectRadius), 2) * 8.0;
                      avoidX -= (dx / dist) * strength;
                      avoidY -= (dy / dist) * strength;
                 }
             }
        }
    }

    if (Math.abs(avoidX) > 0.01 || Math.abs(avoidY) > 0.01) {
         const desiredX = Math.sin(desiredHeading);
         const desiredY = -Math.cos(desiredHeading);
         desiredHeading = Math.atan2(desiredX + avoidX, -(desiredY + avoidY));
    }

    // If recovering, ensure we don't get pushed back into irons
    if (boat.ai.recoveryMode) {
        const angleToWindFinal = normalizeAngle(desiredHeading - windDir);
        if (Math.abs(angleToWindFinal) < Math.PI / 4) {
             // Force it out of irons towards recovery target side
             const side = Math.sign(normalizeAngle(boat.ai.recoveryTarget - windDir)) || 1;
             desiredHeading = normalizeAngle(windDir + side * Math.PI * 0.4);
        }
    }

    boat.ai.targetHeading = normalizeAngle(desiredHeading);

    // Steering
    let diff = normalizeAngle(boat.ai.targetHeading - boat.heading);
    const aiTurnRate = CONFIG.turnSpeed * timeScale;
    if (Math.abs(diff) > aiTurnRate) boat.heading += Math.sign(diff) * aiTurnRate;
    else boat.heading = boat.ai.targetHeading;

    // Trim
    const windAngle = Math.abs(normalizeAngle(windDir - boat.heading));
    boat.spinnaker = (windAngle > Math.PI * 0.6);
    boat.manualTrim = false;
}

function triggerPenalty(boat) {
    if (boat.raceState.finished) return;
    if (!settings.penaltiesEnabled) return;

    if (!boat.raceState.penalty) {
        boat.raceState.penalty = true;
        boat.raceState.penaltyProgress = 0;
        if (boat.isPlayer) {
            Sound.playPenalty();
            showRaceMessage("PENALTY! DO 720° TURN", "text-red-500", "border-red-500/50");
        }
    }
}

// Update Boat Physics & Race Status
function updateBoat(boat, dt) {
    const timeScale = dt * 60;

    // AI Logic
    if (!boat.isPlayer) {
        updateAI(boat, dt);
    } else {
        // Player Input
        const turnRate = (state.keys.Shift ? CONFIG.turnSpeed * 0.25 : CONFIG.turnSpeed) * timeScale;
        if (state.keys.ArrowLeft) boat.heading -= turnRate;
        if (state.keys.ArrowRight) boat.heading += turnRate;
    }

    boat.heading = normalizeAngle(boat.heading);

    // Physics
    const angleToWind = Math.abs(normalizeAngle(boat.heading - state.wind.direction));

    // Update Turbulence Particles
    updateTurbulence(boat, dt);

    // Disturbed Air
    boat.badAirIntensity = 0;
    const windDir = state.wind.direction;
    const wx = -Math.sin(windDir); // Flow X
    const wy = Math.cos(windDir);  // Flow Y
    const crx = -wy; // Right X
    const cry = wx;  // Right Y
    const shadowLength = 350;
    const startW = 20;
    const endW = 100;

    for (const other of state.boats) {
        if (other === boat) continue;
        const dx = boat.x - other.x;
        const dy = boat.y - other.y;

        // Project onto flow (Downwind distance)
        const dDown = dx * wx + dy * wy;
        if (dDown <= 10 || dDown > shadowLength) continue;

        const widthAtDist = startW + (dDown / shadowLength) * (endW - startW);
        const dCross = Math.abs(dx * crx + dy * cry);

        if (dCross < widthAtDist * 0.6) {
             const centerFactor = 1.0 - (dCross / (widthAtDist * 0.6));
             const distFactor = 1.0 - (dDown / shadowLength);
             const intensity = 0.8 * centerFactor * distFactor;
             if (intensity > boat.badAirIntensity) boat.badAirIntensity = intensity;
        }
    }

    // Sail Logic
    let relWind = normalizeAngle(state.wind.direction - boat.heading);
    if (Math.abs(relWind) > 0.1) boat.targetBoomSide = relWind > 0 ? 1 : -1;

    // Check Tacking (Rule 13)
    // Tacking is defined as "from the moment she is beyond head to wind until she is on a close-hauled course".
    // "Head to wind" means pointing directly into wind (angleToWind ~ 0).
    // Close-hauled is ~45 deg.
    // Simplified: If angleToWind is small (in irons), we are tacking.
    if (angleToWind < Math.PI / 6) { // < 30 degrees
        boat.raceState.isTacking = true;
    } else {
        // If we were tacking, check if we are on a close-hauled course (e.g. > 40 deg).
        if (boat.raceState.isTacking && angleToWind > Math.PI / 4.5) {
             boat.raceState.isTacking = false;
        }
    }

    let swingSpeed = 0.025;
    boat.boomSide += (boat.targetBoomSide - boat.boomSide) * swingSpeed;
    if (Math.abs(boat.targetBoomSide - boat.boomSide) < 0.01) boat.boomSide = boat.targetBoomSide;

    let optimalSailAngle = Math.max(0, angleToWind - (Math.PI / 4));
    if (optimalSailAngle > Math.PI/2.2) optimalSailAngle = Math.PI/2.2;

    if (boat.manualTrim) {
        const trimRate = 0.8 * dt;
        if (state.keys.ArrowUp && boat.isPlayer) boat.manualSailAngle = Math.min(Math.PI / 1.5, boat.manualSailAngle + trimRate);
        if (state.keys.ArrowDown && boat.isPlayer) boat.manualSailAngle = Math.max(0, boat.manualSailAngle - trimRate);
        boat.sailAngle = boat.manualSailAngle * boat.boomSide;
    } else {
        boat.manualSailAngle = optimalSailAngle;
        boat.sailAngle = optimalSailAngle * boat.boomSide;
    }

    const switchSpeed = dt / 5.0;
    if (boat.spinnaker) boat.spinnakerDeployProgress = Math.min(1, boat.spinnakerDeployProgress + switchSpeed);
    else boat.spinnakerDeployProgress = Math.max(0, boat.spinnakerDeployProgress - switchSpeed);

    const progress = boat.spinnakerDeployProgress;
    const jibFactor = Math.max(0, 1 - progress * 2);
    const spinFactor = Math.max(0, (progress - 0.5) * 2);

    const effectiveWind = state.wind.speed * (1.0 - boat.badAirIntensity);
    let targetKnotsJib = getTargetSpeed(angleToWind, false, effectiveWind);
    let targetKnotsSpin = getTargetSpeed(angleToWind, true, effectiveWind);
    let targetKnots = targetKnotsJib * jibFactor + targetKnotsSpin * spinFactor;

    const actualMagnitude = Math.abs(boat.sailAngle);
    const angleDiff = Math.abs(actualMagnitude - optimalSailAngle);
    const trimEfficiency = Math.max(0, 1.0 - angleDiff * 2.0);
    targetKnots *= trimEfficiency;

    let targetGameSpeed = targetKnots * 0.25;

    const effectiveAoA = angleToWind - actualMagnitude;
    const luffStartThreshold = 0.5;
    if (effectiveAoA < luffStartThreshold) {
        boat.luffIntensity = Math.max(0, 1.0 - (effectiveAoA / luffStartThreshold));
        boat.luffing = true;
    } else {
        boat.luffIntensity = 0;
        boat.luffing = false;
    }

    const speedAlpha = 1 - Math.pow(0.995, timeScale);
    boat.speed = boat.speed * (1 - speedAlpha) + targetGameSpeed * speedAlpha;

    // Rudder drag
    if (boat.isPlayer && (state.keys.ArrowLeft || state.keys.ArrowRight)) {
         boat.speed *= Math.pow(CONFIG.turnPenalty, timeScale);
    }

    const boatDirX = Math.sin(boat.heading);
    const boatDirY = -Math.cos(boat.heading);
    boat.velocity.x = boatDirX * boat.speed;
    boat.velocity.y = boatDirY * boat.speed;

    boat.x += boat.velocity.x * timeScale;
    boat.y += boat.velocity.y * timeScale;

    // Boundary Check
    if (state.course.boundary) {
        const b = state.course.boundary;
        const dx = boat.x - b.x, dy = boat.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > b.radius) {
            const angle = Math.atan2(dy, dx);
            boat.x = b.x + Math.cos(angle) * b.radius;
            boat.y = b.y + Math.sin(angle) * b.radius;
        }
    }

    // Race Logic per Boat
    updateBoatRaceState(boat, dt);

    // Store history
    boat.raceState.lastPos.x = boat.x;
    boat.raceState.lastPos.y = boat.y;
    boat.prevHeading = boat.heading;
}

function updateBoatRaceState(boat, dt) {
    // Timers
    if (boat.raceState.startTimeDisplayTimer > 0) boat.raceState.startTimeDisplayTimer -= dt;
    if (boat.raceState.legSplitTimer > 0) boat.raceState.legSplitTimer -= dt;

    // Waypoint
    const marks = state.course.marks;
    if (marks && marks.length >= 4) {
        let indices = (boat.raceState.leg === 0 || boat.raceState.leg === 2 || boat.raceState.leg === 4) ? [0, 1] : [2, 3];
        const m1 = marks[indices[0]], m2 = marks[indices[1]];
        const closest = getClosestPointOnSegment(boat.x, boat.y, m1.x, m1.y, m2.x, m2.y);
        const dx = closest.x - boat.x, dy = closest.y - boat.y;
        boat.raceState.nextWaypoint = {
            x: closest.x, y: closest.y,
            dist: Math.sqrt(dx*dx + dy*dy) * 0.2,
            angle: Math.atan2(dx, -dy)
        };

        // Zone Check
        let inZone = false;
        let zoneMarks = [];
        if (boat.raceState.leg === 1 || boat.raceState.leg === 3) zoneMarks = [2, 3];
        else if (boat.raceState.leg === 2) zoneMarks = [0, 1];

        for (const idx of zoneMarks) {
             const m = marks[idx];
             const d2 = (boat.x - m.x)**2 + (boat.y - m.y)**2;
             if (d2 < 165*165) {
                 inZone = true;
                 break;
             }
        }

        if (inZone && !boat.raceState.inZone) {
            boat.raceState.inZone = true;
            boat.raceState.zoneEnterTime = state.time;
        } else if (!inZone) {
            boat.raceState.inZone = false;
        }
    }

    // Crossing Logic
    // Same logic as before, applied to boat.raceState
    if (marks && marks.length >= 4) {
        let gateIndices = [];
        let requiredDirection = 1;
        if (boat.raceState.leg === 0) { gateIndices = [0, 1]; requiredDirection = 1; }
        else if (boat.raceState.leg === 1) { gateIndices = [2, 3]; requiredDirection = 1; }
        else if (boat.raceState.leg === 2) { gateIndices = [0, 1]; requiredDirection = -1; }
        else if (boat.raceState.leg === 3) { gateIndices = [2, 3]; requiredDirection = 1; }
        else if (boat.raceState.leg === 4) { gateIndices = [0, 1]; requiredDirection = -1; }

        if (gateIndices.length > 0) {
            const m1 = marks[gateIndices[0]], m2 = marks[gateIndices[1]];
            const intersect = checkLineIntersection(boat.raceState.lastPos.x, boat.raceState.lastPos.y, boat.x, boat.y, m1.x, m1.y, m2.x, m2.y);

            if (intersect) {
                const gateDx = m2.x - m1.x, gateDy = m2.y - m1.y;
                const nx = gateDy, ny = -gateDx;
                const moveDx = boat.x - boat.raceState.lastPos.x, moveDy = boat.y - boat.raceState.lastPos.y;
                const dot = moveDx * nx + moveDy * ny;
                const crossingDir = dot > 0 ? 1 : -1;

                if (state.race.status === 'prestart') {
                    if (gateIndices[0] === 0) {
                        if (crossingDir === 1) {
                            boat.raceState.ocs = true;
                            if (boat.isPlayer) showRaceMessage("OCS - RETURN TO PRE-START!", "text-red-500", "border-red-500/50");
                        } else {
                            boat.raceState.ocs = false;
                            if (boat.isPlayer) hideRaceMessage();
                        }
                    }
                } else if (state.race.status === 'racing' && !boat.raceState.finished) {
                    if (boat.raceState.leg === 0) {
                        if (crossingDir === 1) {
                            if (!boat.raceState.ocs) {
                                boat.raceState.leg++;
                                if (boat.isPlayer) Sound.playGateClear();
                                boat.raceState.startTimeDisplay = state.race.timer;
                                boat.raceState.startTimeDisplayTimer = 5.0;
                                boat.raceState.startLegDuration = state.race.timer;
                                boat.raceState.legStartTime = state.race.timer;
                            }
                        } else {
                            boat.raceState.ocs = false;
                            if (boat.isPlayer) hideRaceMessage();
                        }
                    } else {
                        // Normal Legs
                         const completeLeg = () => {
                            boat.raceState.leg++;
                            boat.raceState.isRounding = false;
                            const split = state.race.timer - boat.raceState.legStartTime;
                            boat.raceState.lastLegDuration = split;
                            if (boat.raceState.leg > 1) boat.raceState.legTimes.push(split);
                            boat.raceState.legSplitTimer = 5.0;
                            boat.raceState.legStartTime = state.race.timer;

                            if (boat.raceState.leg > 4) {
                                boat.raceState.finished = true;
                                boat.raceState.finishTime = state.race.timer;
                                boat.raceState.trace.push({ x: boat.x, y: boat.y, leg: 4 });
                                if (boat.isPlayer) {
                                    showRaceMessage("FINISHED!", "text-green-400", "border-green-400/50");
                                    Sound.playFinish();
                                    if (window.confetti) window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                                }
                            } else {
                                if (boat.isPlayer) Sound.playGateClear();
                            }
                        };

                        if (boat.raceState.leg === 4) {
                            if (crossingDir === requiredDirection) completeLeg();
                            else if (boat.isPlayer) { showRaceMessage("WRONG WAY!", "text-orange-500", "border-orange-500/50"); setTimeout(hideRaceMessage, 2000); }
                        } else {
                            if (!boat.raceState.isRounding) {
                                if (crossingDir === requiredDirection) boat.raceState.isRounding = true;
                                else if (boat.isPlayer) { showRaceMessage("WRONG WAY!", "text-orange-500", "border-orange-500/50"); setTimeout(hideRaceMessage, 2000); }
                            } else {
                                if (crossingDir === -requiredDirection) {
                                    boat.raceState.isRounding = false;
                                    if (boat.isPlayer) { showRaceMessage("ROUNDING ABORTED", "text-orange-500", "border-orange-500/50"); setTimeout(hideRaceMessage, 2000); }
                                }
                            }
                        }
                    }
                }
            }

            // Extensions Logic
            if (boat.raceState.isRounding && state.race.status === 'racing') {
                 const completeLeg = () => {
                    boat.raceState.leg++;
                    boat.raceState.isRounding = false;
                    const split = state.race.timer - boat.raceState.legStartTime;
                    boat.raceState.lastLegDuration = split;
                    if (boat.raceState.leg > 1) boat.raceState.legTimes.push(split);
                    boat.raceState.legSplitTimer = 5.0;
                    boat.raceState.legStartTime = state.race.timer;
                    if (boat.raceState.leg > 4) {
                        boat.raceState.finished = true;
                        boat.raceState.finishTime = state.race.timer;
                        if (boat.isPlayer) {
                            showRaceMessage("FINISHED!", "text-green-400", "border-green-400/50");
                            Sound.playFinish();
                            if (window.confetti) window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                        }
                    } else {
                        if (boat.isPlayer) Sound.playGateClear();
                    }
                };

                const gDx = m2.x - m1.x, gDy = m2.y - m1.y;
                const len = Math.sqrt(gDx*gDx + gDy*gDy);
                const ux = gDx / len, uy = gDy / len;
                const nx = gDy, ny = -gDx; // Upwind normal
                const extLen = 10000;

                const checkExt = (ax, ay, bx, by) => {
                    if (checkLineIntersection(boat.raceState.lastPos.x, boat.raceState.lastPos.y, boat.x, boat.y, ax, ay, bx, by)) {
                        const moveDx = boat.x - boat.raceState.lastPos.x, moveDy = boat.y - boat.raceState.lastPos.y;
                        return (moveDx * nx + moveDy * ny > 0) ? 1 : -1;
                    }
                    return 0;
                };

                const dirL = checkExt(m1.x, m1.y, m1.x - ux * extLen, m1.y - uy * extLen);
                const dirR = checkExt(m2.x, m2.y, m2.x + ux * extLen, m2.y + uy * extLen);
                if (dirL === -requiredDirection || dirR === -requiredDirection) completeLeg();
            }
        }
    }

    // Trace
    if (boat.raceState.leg >= 1 && !boat.raceState.finished) {
        const trace = boat.raceState.trace;
        if (trace.length === 0) trace.push({ x: boat.x, y: boat.y, leg: boat.raceState.leg });
        else {
            const last = trace[trace.length - 1];
            if ((boat.x - last.x)**2 + (boat.y - last.y)**2 > 2500) trace.push({ x: boat.x, y: boat.y, leg: boat.raceState.leg });
        }
    }

    // Penalty
    if (boat.raceState.penalty) {
         const diff = normalizeAngle(boat.heading - boat.prevHeading);
         boat.raceState.penaltyProgress += diff;
         if (Math.abs(boat.raceState.penaltyProgress) >= 4 * Math.PI - 0.1) {
             boat.raceState.penalty = false;
             boat.raceState.penaltyProgress = 0;
             if (boat.isPlayer) hideRaceMessage();
         }
    }

    // Maneuvers Stats
    const relWindAngle = normalizeAngle(state.wind.direction - boat.heading);
    const currentWindSide = Math.sign(relWindAngle);
    if (boat.lastWindSide === undefined) boat.lastWindSide = currentWindSide;
    if (currentWindSide !== 0) {
        if (boat.lastWindSide !== 0 && currentWindSide !== boat.lastWindSide) {
             if (state.race.status === 'racing' && boat.raceState.leg >= 0 && boat.raceState.leg < 5) {
                 boat.raceState.legManeuvers[boat.raceState.leg]++;
             }
        }
        boat.lastWindSide = currentWindSide;
    }

    // Stats
    if (state.race.status === 'racing' && boat.raceState.leg < 5) {
        const distMoved = boat.speed * (dt * 60) * 0.2;
        const kn = boat.speed * 4;
        boat.raceState.legDistances[boat.raceState.leg] += distMoved;
        if (kn > boat.raceState.legTopSpeeds[boat.raceState.leg]) boat.raceState.legTopSpeeds[boat.raceState.leg] = kn;
    }
}

// Collision Helpers
function getHullPolygon(boat) {
    const locals = [
        {x: 0, y: -25}, {x: 15, y: -5}, {x: 15, y: 20},
        {x: 12, y: 30}, {x: -12, y: 30}, {x: -15, y: 20}, {x: -15, y: -5}
    ];
    const cos = Math.cos(boat.heading), sin = Math.sin(boat.heading);
    return locals.map(p => ({
        x: boat.x + (p.x * cos - p.y * sin),
        y: boat.y + (p.x * sin + p.y * cos)
    }));
}

function projectPolygon(axis, poly) {
    let min = Infinity, max = -Infinity;
    for (const p of poly) {
        const dot = p.x * axis.x + p.y * axis.y;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
    }
    return { min, max };
}

function projectCircle(axis, center, radius) {
    const dot = center.x * axis.x + center.y * axis.y;
    return { min: dot - radius, max: dot + radius };
}

function getAxes(poly) {
    const axes = [];
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
        const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
        axes.push({ x: -edge.y / len, y: edge.x / len });
    }
    return axes;
}

function satPolygonPolygon(polyA, polyB) {
    let overlap = Infinity;
    let smallestAxis = null;
    const axes = [...getAxes(polyA), ...getAxes(polyB)];

    for (const axis of axes) {
        const p1 = projectPolygon(axis, polyA);
        const p2 = projectPolygon(axis, polyB);
        if (p1.max < p2.min || p2.max < p1.min) return null;
        const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (o < overlap) {
            overlap = o;
            smallestAxis = axis;
        }
    }

    const centerA = polyA.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const centerB = polyB.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const dirX = (centerB.x/polyB.length) - (centerA.x/polyA.length);
    const dirY = (centerB.y/polyB.length) - (centerA.y/polyA.length);

    if (dirX * smallestAxis.x + dirY * smallestAxis.y < 0) {
        smallestAxis.x = -smallestAxis.x;
        smallestAxis.y = -smallestAxis.y;
    }
    return { overlap, axis: smallestAxis };
}

function satPolygonCircle(poly, circleCenter, radius) {
    let overlap = Infinity;
    let smallestAxis = null;
    let axes = getAxes(poly);

    let minDistSq = Infinity;
    let closestVertex = null;
    for(const p of poly) {
        const dSq = (p.x - circleCenter.x)**2 + (p.y - circleCenter.y)**2;
        if(dSq < minDistSq) { minDistSq = dSq; closestVertex = p; }
    }
    const axisToCenter = { x: circleCenter.x - closestVertex.x, y: circleCenter.y - closestVertex.y };
    const len = Math.sqrt(axisToCenter.x**2 + axisToCenter.y**2);
    if (len > 1e-5) axes.push({ x: axisToCenter.x / len, y: axisToCenter.y / len });

    for (const axis of axes) {
        const p1 = projectPolygon(axis, poly);
        const p2 = projectCircle(axis, circleCenter, radius);
        if (p1.max < p2.min || p2.max < p1.min) return null;
        const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (o < overlap) { overlap = o; smallestAxis = axis; }
    }

    const centerA = poly.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const dirX = circleCenter.x - (centerA.x/poly.length);
    const dirY = circleCenter.y - (centerA.y/poly.length);

    if (dirX * smallestAxis.x + dirY * smallestAxis.y < 0) {
        smallestAxis.x = -smallestAxis.x;
        smallestAxis.y = -smallestAxis.y;
    }
    return { overlap, axis: smallestAxis };
}

function checkBoatCollisions(dt) {
    const broadRadius = 40;
    for (let i = 0; i < state.boats.length; i++) {
        const b1 = state.boats[i];
        const poly1 = getHullPolygon(b1);
        for (let j = i + 1; j < state.boats.length; j++) {
            const b2 = state.boats[j];
            const dx = b2.x - b1.x, dy = b2.y - b1.y;
            if (dx*dx + dy*dy > (broadRadius*2)**2) continue;

            const poly2 = getHullPolygon(b2);
            const res = satPolygonPolygon(poly1, poly2);

            if (res) {
                const tx = res.axis.x * res.overlap * 0.5;
                const ty = res.axis.y * res.overlap * 0.5;
                b1.x -= tx; b1.y -= ty;
                b2.x += tx; b2.y += ty;

                // Physics Response: Angle dependent friction
                const nx = res.axis.x, ny = res.axis.y;

                // B1: Normal points AWAY from B1? No, B1->B2. So points AWAY from B1.
                // If B1 moves TOWARDS B2, dot(h1, n) > 0.
                const h1x = Math.sin(b1.heading), h1y = -Math.cos(b1.heading);
                const impact1 = Math.max(0, h1x * nx + h1y * ny);

                // B2: Normal points INTO B2. We want normal pointing AWAY from B2 for impact calc. So -n.
                const h2x = Math.sin(b2.heading), h2y = -Math.cos(b2.heading);
                const impact2 = Math.max(0, h2x * (-nx) + h2y * (-ny));

                const friction = 0.99;
                const impactFactor = 0.5; // Multiplier at max impact (0.5 means lose 50%)

                b1.speed *= (friction - (friction - impactFactor) * impact1);
                b2.speed *= (friction - (friction - impactFactor) * impact2);

                if (state.race.status === 'racing') {
                    const rowBoat = getRightOfWay(b1, b2);
                    if (rowBoat === b1) triggerPenalty(b2);
                    else if (rowBoat === b2) triggerPenalty(b1);
                    else {
                        triggerPenalty(b1);
                        triggerPenalty(b2);
                    }
                }
            }
        }
    }
}

function checkMarkCollisions(dt) {
    if (!state.course || !state.course.marks) return;
    const markRadius = 12;

    for (const boat of state.boats) {
        let close = false;
        for (const mark of state.course.marks) {
             if ((boat.x-mark.x)**2 + (boat.y-mark.y)**2 < (50)**2) { close = true; break; }
        }
        if (!close) continue;

        const poly = getHullPolygon(boat);
        for (const mark of state.course.marks) {
            const res = satPolygonCircle(poly, mark, markRadius);
            if (res) {
                // Direction: axis points from Poly to Circle
                // We want to move Poly away from Circle, so move opposite to axis
                boat.x -= res.axis.x * res.overlap;
                boat.y -= res.axis.y * res.overlap;

                // Physics
                const nx = res.axis.x, ny = res.axis.y;
                const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
                // Impact: Heading vs Normal (Boat -> Mark)
                const impact = Math.max(0, hx * nx + hy * ny);

                const friction = 0.99;
                const impactFactor = 0.5;

                boat.speed *= (friction - (friction - impactFactor) * impact);

                if (state.race.status === 'racing') triggerPenalty(boat);
            }
        }
    }
}

function update(dt) {
    state.time += 0.24 * dt;
    const timeScale = dt * 60;

    Sound.updateWindSound(state.wind.speed);

    // Wind Dynamics
    const dirDrift = Math.sin(state.time * 0.05) * 0.2;
    const dirGust = Math.sin(state.time * 0.3 + 123.4) * 0.05;
    state.wind.direction = state.wind.baseDirection + dirDrift + dirGust;
    const speedSurge = Math.sin(state.time * 0.1) * 2.0;
    const speedGust = Math.sin(state.time * 0.5 + 456.7) * 1.5;
    state.wind.speed = Math.max(5, Math.min(25, state.wind.baseSpeed + speedSurge + speedGust));

    // Global Race Timer
    if (state.race.status === 'prestart') {
        state.race.timer -= dt;
        if (state.race.timer <= 0) {
            state.race.status = 'racing';
            state.race.timer = 0;
            Sound.playStart();
        }
    } else if (state.race.status === 'racing') {
        state.race.timer += dt;
    }

    // Update Boats
    for (const boat of state.boats) {
        updateBoat(boat, dt);
    }

    // Collisions
    checkBoatCollisions(dt);
    checkMarkCollisions(dt);

    // Player Cam
    const player = state.boats[0];
    const camLerp = 1 - Math.pow(0.9, timeScale);
    if (state.camera.mode === 'heading') {
        let diff = normalizeAngle(player.heading - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'north') {
        let diff = normalizeAngle(0 - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'wind') {
        let diff = normalizeAngle(state.wind.direction - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'gate') {
        if (!player.raceState.finished) {
            let diff = normalizeAngle(player.raceState.nextWaypoint.angle - state.camera.rotation);
            state.camera.rotation += diff * camLerp;
        } else {
             let diff = normalizeAngle(player.heading - state.camera.rotation);
            state.camera.rotation += diff * camLerp;
        }
    }

    if (state.camera.messageTimer > 0) state.camera.messageTimer -= dt;
    if (state.camera.target === 'boat') {
        state.camera.x += (player.x - state.camera.x) * 0.1;
        state.camera.y += (player.y - state.camera.y) * 0.1;
    }

    // Particles
    const windDirX = Math.sin(state.wind.direction);
    const windDirY = -Math.cos(state.wind.direction);

    // Add Wake for all boats
    for (const boat of state.boats) {
        if (boat.speed > 0.25) {
             const boatDX = Math.sin(boat.heading);
             const boatDY = -Math.cos(boat.heading);
             const sternX = boat.x - boatDX * 30;
             const sternY = boat.y - boatDY * 30;
             if (Math.random() < 0.2) createParticle(sternX + (Math.random()-0.5)*4, sternY + (Math.random()-0.5)*4, 'wake');
             if (Math.random() < 0.25) {
                  const rightX = Math.cos(boat.heading), rightY = Math.sin(boat.heading);
                  const spread = 0.1;
                  createParticle(sternX - rightX*10, sternY - rightY*10, 'wake-wave', { vx: -rightX*spread, vy: -rightY*spread });
                  createParticle(sternX + rightX*10, sternY + rightY*10, 'wake-wave', { vx: rightX*spread, vy: rightY*spread });
             }
        }
    }

    // Wind Particles
    if (Math.random() < 0.2) {
        let range = Math.max(canvas.width, canvas.height) * 1.5;
        createParticle(state.camera.x + (Math.random()-0.5)*range, state.camera.y + (Math.random()-0.5)*range, 'wind', { life: Math.random() + 0.5 });
    }
    updateParticles(dt);
}

function createParticle(x, y, type, props = {}) { state.particles.push({ x, y, type, life: 1.0, ...props }); }

function updateParticles(dt) {
    const timeScale = dt * 60;
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        if (p.vx) p.x += p.vx * timeScale;
        if (p.vy) p.y += p.vy * timeScale;
        let decay = 0.0025;
        if (p.type === 'wake') { decay = 0.005; p.scale = 1 + (1-p.life)*1.5; p.alpha = p.life*0.4; }
        else if (p.type === 'wake-wave') { decay = 0.0015; p.scale = 0.5 + (1-p.life)*3; p.alpha = p.life*0.25; }
        else if (p.type === 'wind') { p.x -= Math.sin(state.wind.direction)*timeScale; p.y += Math.cos(state.wind.direction)*timeScale; }
        p.life -= decay * timeScale;
        if (p.life <= 0) { state.particles[i] = state.particles[state.particles.length-1]; state.particles.pop(); }
    }
}

function drawParticles(ctx, layer) {
    if (layer === 'surface') {
        ctx.fillStyle = '#ffffff';
        for (const p of state.particles) {
            if (p.type === 'wake' || p.type === 'wake-wave') {
                ctx.globalAlpha = p.alpha;
                ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.scale, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;
    } else if (layer === 'air') {
        const windFactor = state.wind.speed / 10;
        const tailLength = 30 + state.wind.speed * 4;
        const dx = -Math.sin(state.wind.direction) * tailLength;
        const dy = Math.cos(state.wind.direction) * tailLength;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 + windFactor;
        for (const p of state.particles) {
            if (p.type === 'wind') {
                const opacity = Math.min(p.life, 1.0) * (0.15 + windFactor * 0.2);
                ctx.globalAlpha = opacity;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dx, p.y + dy); ctx.stroke();
            }
        }
        ctx.globalAlpha = 1.0;
    }
}

// Drawing (Refactored for Boat object)
function drawBoat(ctx, boat) {
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(5, 5, 12, 28, 0, 0, Math.PI * 2); ctx.fill();

    // Hull
    const hullColor = boat.isPlayer ? settings.hullColor : boat.colors.hull;
    ctx.fillStyle = hullColor || '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.bezierCurveTo(18, -10, 18, 20, 12, 30);
    ctx.lineTo(-12, 30);
    ctx.bezierCurveTo(-18, 20, -18, -10, 0, -25);
    ctx.fill();
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5; ctx.stroke();

    // Cockpit
    const cockpitColor = boat.isPlayer ? settings.cockpitColor : boat.colors.cockpit;
    ctx.fillStyle = cockpitColor || '#cbd5e1';
    ctx.beginPath(); ctx.roundRect(-8, 10, 16, 15, 4); ctx.fill();

    // Mast
    ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI * 2); ctx.fill();

    // Sails
    const drawSailFunc = (isJib, scale = 1.0) => {
        ctx.save();
        if (isJib) { ctx.translate(0, -25); ctx.rotate(boat.sailAngle); }
        else { ctx.translate(0, -5); ctx.rotate(boat.sailAngle); }

        const sailColor = boat.isPlayer ? settings.sailColor : boat.colors.sail;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = sailColor || '#ffffff';
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;

        const luff = boat.luffIntensity || 0;
        const angleRatio = Math.min(1.0, Math.abs(boat.sailAngle) / (Math.PI / 4));
        const flattenFactor = 0.6 + 0.4 * angleRatio;
        const baseDepth = (isJib ? 11 : 15) * scale * flattenFactor;
        let controlX = -boat.boomSide * baseDepth;
        if (luff > 0) {
             const currentDepth = baseDepth * (1.0 - luff * 0.8);
             const time = state.time * 30;
             const flutterAmt = Math.sin(time) * baseDepth * 1.5 * luff;
             controlX = (-boat.boomSide * currentDepth) + flutterAmt;
        }
        ctx.beginPath();
        if (isJib) { ctx.moveTo(0, 0); ctx.lineTo(0, 28 * scale); ctx.quadraticCurveTo(controlX, 14 * scale, 0, 0); }
        else { ctx.moveTo(0, 0); ctx.lineTo(0, 45); ctx.quadraticCurveTo(controlX, 20, 0, 0); }
        ctx.fill(); ctx.stroke();

        if (!isJib) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath();
            ctx.moveTo(0, 15); ctx.lineTo(controlX * 0.33, 12);
            ctx.moveTo(0, 30); ctx.lineTo(controlX * 0.6, 24);
            ctx.stroke();
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 45); ctx.stroke();
        }
        ctx.restore();
    };

    const drawSpinnaker = (scale = 1.0) => {
        ctx.save();
        ctx.translate(0, -28); ctx.rotate(boat.sailAngle);
        const spinColor = boat.isPlayer ? settings.spinnakerColor : boat.colors.spinnaker;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = spinColor || '#ef4444';
        ctx.strokeStyle = spinColor || '#ef4444';
        ctx.lineWidth = 1;

        const luff = boat.luffIntensity || 0;
        const baseDepth = 40 * scale;
        let controlX = -boat.boomSide * baseDepth;
        if (luff > 0) {
             const currentDepth = baseDepth * (1.0 - luff * 0.9);
             const time = state.time * 25;
             const flutterAmt = Math.sin(time) * baseDepth * 1.2 * luff;
             controlX = (-boat.boomSide * currentDepth) + flutterAmt;
        }
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 50 * scale); ctx.quadraticCurveTo(controlX, 25 * scale, 0, 0);
        ctx.fill(); ctx.stroke(); ctx.restore();
    };

    drawSailFunc(false);
    const progress = boat.spinnakerDeployProgress;
    const jibScale = Math.max(0, 1 - progress * 2);
    const spinScale = Math.max(0, (progress - 0.5) * 2);
    if (jibScale > 0.01) drawSailFunc(true, jibScale);
    if (spinScale > 0.01) drawSpinnaker(spinScale);
    ctx.restore();
}

function isConflictSoon(b1, b2) {
    const distSq = (b1.x - b2.x)**2 + (b1.y - b2.y)**2;
    if (distSq < 80*80) return true; // Very close/overlapping

    // Relative velocity
    // velocity is units per frame (1/60s)
    const vx = b1.velocity.x - b2.velocity.x; // Velocity of B1 relative to B2
    const vy = b1.velocity.y - b2.velocity.y;

    // Relative position of B1 from B2
    const px = b1.x - b2.x;
    const py = b1.y - b2.y;

    // Check if moving closer
    // d/dt (P.P) = 2 P.V
    const dot = px * vx + py * vy;

    // If dot > 0, distance is increasing (moving apart)
    if (dot >= 0) return false;

    // Time to CPA
    const vSq = vx*vx + vy*vy;
    if (vSq < 0.0001) return false;

    // t_cpa = -(P.V) / (V.V)
    const t = -dot / vSq;

    // Thresholds
    // 10 seconds = 600 frames at 60fps
    if (t > 600) return false;

    // CPA Distance
    // P_cpa = P + V*t
    const cpaX = px + vx * t;
    const cpaY = py + vy * t;
    const cpaDistSq = cpaX*cpaX + cpaY*cpaY;

    // 120 units is approx 3-4 boat lengths (safety margin)
    if (cpaDistSq < 120*120) return true;

    return false;
}

function drawRulesOverlay(ctx) {
    if (!state.showNavAids || !settings.penaltiesEnabled || state.race.status === 'finished') return;

    const checkDist = 400; // Increased range for visibility

    // Helper to draw triangle
    const drawTriangle = (boat, target, color) => {
        const dx = target.x - boat.x;
        const dy = target.y - boat.y;
        const angle = Math.atan2(dy, dx);

        // Calculate distance based on hull shape (elliptical approx)
        // Hull is roughly width=15 (rx=25 w/ pad), length=30 (ry=40 w/ pad)
        const dAngle = angle - boat.heading;
        const rx = 25, ry = 40;
        const lx = Math.cos(dAngle), ly = Math.sin(dAngle);
        const dist = (rx * ry) / Math.sqrt((ry * lx) ** 2 + (rx * ly) ** 2);

        const tx = boat.x + Math.cos(angle) * dist;
        const ty = boat.y + Math.sin(angle) * dist;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(angle);

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        // Pointing right (towards target)
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, 7);
        ctx.lineTo(-6, -7);
        ctx.closePath();

        ctx.fill();
        ctx.restore();
    };

    for (let i = 0; i < state.boats.length; i++) {
        const b1 = state.boats[i];
        for (let j = i + 1; j < state.boats.length; j++) {
            const b2 = state.boats[j];
            const distSq = (b1.x - b2.x)**2 + (b1.y - b2.y)**2;

            if (distSq < checkDist * checkDist && isConflictSoon(b1, b2)) {
                const rowBoat = getRightOfWay(b1, b2);
                if (rowBoat) {
                    const winner = rowBoat;
                    const loser = (rowBoat === b1) ? b2 : b1;

                    // Winner (Green) - pointing at Loser
                    drawTriangle(winner, loser, '#4ade80');

                    // Loser (Red) - pointing at Winner
                    drawTriangle(loser, winner, '#ef4444');
                }
            }
        }
    }
}

function drawRoundingArrows(ctx) {
    if (!state.showNavAids || !state.course || !state.course.marks || state.race.status === 'finished') return;

    // Player Leg determines what to show
    const player = state.boats[0];
    let activeMarks = [];
    if (player.raceState.leg === 1 || player.raceState.leg === 3) activeMarks = [{ index: 2, ccw: true }, { index: 3, ccw: false }];
    else if (player.raceState.leg === 2) activeMarks = [{ index: 0, ccw: false }, { index: 1, ccw: true }];
    else return;

    ctx.save();
    ctx.lineWidth = 10; ctx.strokeStyle = '#22d3ee'; ctx.fillStyle = '#22d3ee'; ctx.lineCap = 'round';
    const windDir = state.wind.baseDirection;

    for (const item of activeMarks) {
        if (item.index >= state.course.marks.length) continue;
        const m = state.course.marks[item.index];
        ctx.save(); ctx.translate(m.x, m.y);
        let start, end, ccw = item.ccw;
        if (item.index === 0 || item.index === 2) { start = 0; end = Math.PI; } // Left
        else { start = Math.PI; end = 0; } // Right
        // Invert if Upwind Gate vs Leeward Gate direction?
        // Mark 2 (Left Upwind): Round CCW. 0->PI. Correct.
        // Mark 3 (Right Upwind): Round CW. PI->0. Correct.
        // Mark 0 (Left Leeward): Round CW. 0->PI.
        if (item.index === 0) ccw = false; // Override for Leeward Left
        if (item.index === 1) ccw = true; // Override for Leeward Right

        const anim = state.time * 8.0 * (ccw ? -1 : 1);
        ctx.rotate(windDir + anim);
        ctx.beginPath(); ctx.arc(0, 0, 80, start, end, ccw); ctx.stroke();
        const tipX = 80 * Math.cos(end), tipY = 80 * Math.sin(end);
        let tangent = end + (ccw ? -Math.PI/2 : Math.PI/2);
        ctx.translate(tipX, tipY); ctx.rotate(tangent);
        ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}

// ... Reused standard draw functions ...
function drawActiveGateLine(ctx) {
    const player = state.boats[0];
    let indices;
    if (state.race.status === 'finished' || player.raceState.finished) indices = [0, 1];
    else {
        if (player.raceState.leg !== 0 && player.raceState.leg !== 4) return;
        indices = (player.raceState.leg % 2 === 0) ? [0, 1] : [2, 3];
    }
    const m1 = state.course.marks[indices[0]], m2 = state.course.marks[indices[1]];
    ctx.save();
    const dashOffset = -state.time * 20;
    ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y);

    let color = '#ffffff';
    if (state.race.status === 'finished' || player.raceState.finished) color = '#4ade80';
    else if (player.raceState.leg === 0 && state.race.status === 'prestart') color = '#ef4444';

    ctx.shadowColor = color; ctx.shadowBlur = 15; ctx.strokeStyle = color; ctx.lineWidth = 5;
    ctx.lineDashOffset = dashOffset; ctx.stroke();

    ctx.save(); ctx.fillStyle = color; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const midX = (m1.x+m2.x)/2, midY = (m1.y+m2.y)/2;
    let label = (player.raceState.leg === 0) ? "START" : ((player.raceState.leg === 4 || state.race.status === 'finished' || player.raceState.finished) ? "FINISH" : "");
    if (label) {
        const angle = Math.atan2(m2.y - m1.y, m2.x - m1.x);
        ctx.translate(midX, midY);
        let rot = angle; if (Math.abs(normalizeAngle(rot)) > Math.PI/2) rot += Math.PI;
        ctx.rotate(rot); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeText(label, 0, 0); ctx.fillText(label, 0, 0);
    }
    ctx.restore(); ctx.restore();
}

function drawLadderLines(ctx) {
    const player = state.boats[0];
    if (!state.showNavAids || state.race.status === 'prestart' || state.race.status === 'finished' || player.raceState.finished) return;

    const m0 = state.course.marks[0], m1 = state.course.marks[1], m2 = state.course.marks[2], m3 = state.course.marks[3];
    const c1x = (m0.x+m1.x)/2, c1y = (m0.y+m1.y)/2, c2x = (m2.x+m3.x)/2, c2y = (m2.y+m3.y)/2;
    const dx = c2x-c1x, dy = c2y-c1y, len = Math.sqrt(dx*dx+dy*dy);
    const wx = dx/len, wy = dy/len, px = -wy, py = wx;
    const courseAngle = Math.atan2(wx, -wy);

    let prevIndex = (player.raceState.leg === 0 || player.raceState.leg % 2 !== 0) ? 0 : 2;
    let nextIndex = (prevIndex === 0) ? 2 : 0;

    const mPrev = state.course.marks[prevIndex], mNext = state.course.marks[nextIndex];
    const startProj = mPrev.x*wx + mPrev.y*wy, endProj = mNext.x*wx + mNext.y*wy;
    let minP = Math.min(startProj, endProj), maxP = Math.max(startProj, endProj);

    const interval = 500;
    const firstLine = Math.floor(minP/interval)*interval;

    // Boundary & Laylines Projection logic same as before...
    const uL = mNext.x*wx + mNext.y*wy, vL = mNext.x*px + mNext.y*py;
    const mNextR = state.course.marks[nextIndex+1];
    const uR = mNextR.x*wx + mNextR.y*wy, vR = mNextR.x*px + mNextR.y*py;
    const b = state.course.boundary;
    const uC = b.x*wx + b.y*wy, vC = b.x*px + b.y*py, R = b.radius;

    const isUpwindTarget = (nextIndex === 2);
    const delta = normalizeAngle(state.wind.direction - courseAngle);
    let slopeLeft = Math.tan(delta + Math.PI/4), slopeRight = Math.tan(delta - Math.PI/4);
    if (!isUpwindTarget) { slopeLeft = Math.tan(delta - Math.PI/4); slopeRight = Math.tan(delta + Math.PI/4); }

    ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 4;
    ctx.font = 'bold 24px monospace'; ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    for (let p = firstLine; p <= maxP; p+=interval) {
        if (p < minP) continue;
        if (Math.abs(p - endProj) < 1.0) continue;
        if (player.raceState.leg === 0 && Math.abs(p - startProj) < 1.0) continue;

        const dist = p - uL, distR = p - uR;
        const vMin = vL + dist * slopeLeft, vMax = vR + distR * slopeRight;
        const du = p - uC;
        if (Math.abs(du) >= R) continue;
        const dv = Math.sqrt(R*R - du*du);
        const finalMin = Math.max(vMin, vC - dv), finalMax = Math.min(vMax, vC + dv);

        if (finalMin < finalMax) {
            const cx = p*wx, cy = p*wy;
            const x1 = cx + finalMin*px, y1 = cy + finalMin*py;
            const x2 = cx + finalMax*px, y2 = cy + finalMax*py;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

            const distToGate = Math.abs(endProj - p) * 0.2;
            if (distToGate > 50) {
                 ctx.fillText(Math.round(distToGate) + 'm', (x1+x2)/2, (y1+y2)/2);
            }
        }
    }
    ctx.restore();
}

function drawLayLines(ctx) {
    if (!state.showNavAids || state.race.status === 'finished') return;
    const player = state.boats[0];
    let targets = (player.raceState.leg % 2 === 0) ? [0, 1] : [2, 3];
    const isUpwind = (player.raceState.leg % 2 !== 0) || (player.raceState.leg === 0);
    const zoneRadius = (player.raceState.leg === 0 || player.raceState.leg === 4) ? 0 : 165;

    ctx.save(); ctx.lineWidth = 5;
    for (const idx of targets) {
        const m = state.course.marks[idx];
        const ang1 = state.wind.direction + Math.PI/4, ang2 = state.wind.direction - Math.PI/4;
        const isLeft = (idx % 2 === 0);
        const drawRay = (angle) => {
            let da = angle + (isUpwind ? Math.PI : 0);
            const dx = Math.sin(da), dy = -Math.cos(da);
            const startX = m.x + dx*zoneRadius, startY = m.y + dy*zoneRadius;
            const t = rayCircleIntersection(startX, startY, dx, dy, state.course.boundary.x, state.course.boundary.y, state.course.boundary.radius);
            if (t !== null) {
                ctx.strokeStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(startX+dx*t, startY+dy*t); ctx.stroke();
            }
        };
        if (isUpwind) isLeft ? drawRay(ang1) : drawRay(ang2);
        else isLeft ? drawRay(ang2) : drawRay(ang1);
    }
    ctx.restore();
}

function drawMarkZones(ctx) {
    if (!state.showNavAids || state.race.status === 'finished') return;
    const player = state.boats[0];
    let active = [];
    if (player.raceState.leg === 1 || player.raceState.leg === 3) active = [2, 3];
    else if (player.raceState.leg === 2) active = [0, 1];
    else return;

    ctx.save(); ctx.lineWidth = 5;
    const h = player.heading, sinH = Math.sin(h), cosH = Math.cos(h);
    const bowX = player.x + 25*sinH, bowY = player.y - 25*cosH;
    const sternX = player.x - 30*sinH, sternY = player.y + 30*cosH;

    for (const idx of active) {
        const m = state.course.marks[idx];
        const closest = getClosestPointOnSegment(m.x, m.y, bowX, bowY, sternX, sternY);
        const distSq = (closest.x-m.x)**2 + (closest.y-m.y)**2;
        ctx.strokeStyle = (distSq < 165*165) ? '#facc15' : 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath(); ctx.arc(m.x, m.y, 165, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
}

// Draw Water (Waves) - Same as original
function drawWater(ctx) {
    const gridSize = 80;
    const dist = state.time * 20;
    const shiftX = -Math.sin(state.wind.direction)*dist, shiftY = Math.cos(state.wind.direction)*dist;
    const pad = gridSize*2;
    const left = state.camera.x - canvas.width/2 - pad, right = state.camera.x + canvas.width/2 + pad;
    const top = state.camera.y - canvas.height/2 - pad, bottom = state.camera.y + canvas.height/2 + pad;
    const startX = Math.floor((left-shiftX)/gridSize)*gridSize, endX = Math.ceil((right-shiftX)/gridSize)*gridSize;
    const startY = Math.floor((top-shiftY)/gridSize)*gridSize, endY = Math.ceil((bottom-shiftY)/gridSize)*gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2.5;
    const angle = state.wind.direction + Math.PI;
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    ctx.beginPath();
    for (let x = startX; x < endX; x+=gridSize) {
        for (let y = startY; y < endY; y+=gridSize) {
             const cx = x + shiftX + gridSize/2, cy = y + shiftY + gridSize/2;
             const noise = Math.sin(x*0.12+y*0.17);
             const bob = Math.sin(state.time*2+noise*10) * (0.3 + state.wind.speed/10);
             // ... Simplified wave glyph ...
             // Just reuse previous random logic
             const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
             const randX = (seed - Math.floor(seed)) * 40 - 20;
             const randY = (Math.cos(seed) * 0.5 + 0.5) * 40 - 20;
             let scale = (0.8 + ((seed*10)%1)*0.4) * Math.max(0.5, state.wind.speed/10);

             const rcx = cx + randX, rcy = cy + randY;
             const p1x = -8*scale, p1y = bob*scale, p2x = 8*scale, p2y = bob*scale;
             const cpx = 0, cpy = (bob-6)*scale;

             const t = (px, py) => ({ x: px*cosA - py*sinA + rcx, y: px*sinA + py*cosA + rcy });
             const tp1 = t(p1x, p1y), tp2 = t(p2x, p2y), tcp = t(cpx, cpy);
             ctx.moveTo(tp1.x, tp1.y); ctx.quadraticCurveTo(tcp.x, tcp.y, tp2.x, tp2.y);
        }
    }
    ctx.stroke();
}

function drawMarkShadows(ctx) {
    for (const m of state.course.marks) {
        ctx.save(); ctx.translate(m.x, m.y);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(3, 3, 12, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

function drawMarkBodies(ctx) {
    const player = state.boats[0];
    for (let i=0; i<state.course.marks.length; i++) {
        const m = state.course.marks[i];
        ctx.save(); ctx.translate(m.x, m.y);
        const bob = 1.0 + Math.sin(state.time*5 + m.x*0.01)*0.05; ctx.scale(bob, bob);

        let active = false;
        if (state.race.status !== 'finished') {
            if (player.raceState.leg % 2 === 0) { if (i===0 || i===1) active = true; }
            else { if (i===2 || i===3) active = true; }
        }

        const c1 = active ? '#fdba74' : '#e2e8f0';
        const c2 = active ? '#f97316' : '#94a3b8';
        const c3 = active ? '#c2410c' : '#64748b';
        const grad = ctx.createRadialGradient(-3, -3, 0, 0, 0, 12);
        grad.addColorStop(0, c1); grad.addColorStop(0.5, c2); grad.addColorStop(1, c3);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = c3; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
    }
}

function drawBoundary(ctx) {
    const b = state.course.boundary;
    if (!b) return;
    ctx.save(); ctx.translate(b.x, b.y);

    // Glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';

    // Solid thick white line
    ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 80; ctx.setLineDash([]); ctx.stroke();

    ctx.shadowBlur = 0; // Reset for text/images

    // Text & Burgee
    const text = "Salty Critter Yacht Club";
    ctx.font = 'bold 50px sans-serif';
    ctx.textBaseline = 'middle';

    // Measure char by char for curvature
    const charWidths = [];
    let textWidth = 0;
    for (const char of text) {
        const w = ctx.measureText(char).width;
        charWidths.push(w);
        textWidth += w;
    }

    // Image
    const imgH = 40;
    const imgW = imgH * (649 / 462);

    const gap = 60;
    const segmentLen = imgW + gap + textWidth + gap;

    const circumference = 2 * Math.PI * b.radius;
    const count = Math.ceil(circumference / segmentLen);
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
        const angle = i * angleStep;

        const contentWidth = imgW + gap + textWidth;
        const startX = -contentWidth / 2;

        // Draw Image (Curved)
        const imgCenterLinear = startX + imgW / 2;
        const imgAngleOffset = imgCenterLinear / b.radius;

        ctx.save();
        ctx.rotate(angle + imgAngleOffset);
        ctx.translate(b.radius, 0);
        ctx.rotate(Math.PI / 2);
        if (burgeeImg.complete && burgeeImg.naturalWidth > 0) {
            ctx.drawImage(burgeeImg, -imgW / 2, -imgH / 2, imgW, imgH);
        }
        ctx.restore();

        // Draw Text (Curved)
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';

        let currentLinear = startX + imgW + gap;
        for (let j = 0; j < text.length; j++) {
            const char = text[j];
            const w = charWidths[j];
            const charCenterLinear = currentLinear + w / 2;
            const charAngleOffset = charCenterLinear / b.radius;

            ctx.save();
            ctx.rotate(angle + charAngleOffset);
            ctx.translate(b.radius, 0);
            ctx.rotate(Math.PI / 2);
            ctx.fillText(char, 0, 0);
            ctx.restore();

            currentLinear += w;
        }
    }

    ctx.restore();
}

function drawMinimap() {
    if (!minimapCtx) { const c = document.getElementById('minimap'); if(c) minimapCtx = c.getContext('2d'); }
    const ctx = minimapCtx;
    if (!ctx || !state.boats.length) return;

    const width = ctx.canvas.width, height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    const player = state.boats[0];
    // Bounds centered on player but including marks?
    // Let's use logic from before: Bounds of marks + player
    let minX = player.x, maxX = player.x, minY = player.y, maxY = player.y;
    for (const m of state.course.marks) {
        minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x);
        minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y);
    }
    const pad = 200;
    minX-=pad; maxX+=pad; minY-=pad; maxY+=pad;
    const scale = (width-20)/Math.max(maxX-minX, maxY-minY);
    const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    const t = (x, y) => ({ x: (x-cx)*scale + width/2, y: (y-cy)*scale + height/2 });

    // Boundary
    const b = state.course.boundary;
    const bp = t(b.x, b.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(bp.x, bp.y, b.radius*scale, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);

    // Trace (Player Only)
    if (player.raceState.trace.length) {
         ctx.lineWidth = 1.5;
         // Draw whole trace
         // Simplify: Draw all points
         ctx.beginPath();
         const p0 = t(player.raceState.trace[0].x, player.raceState.trace[0].y);
         ctx.moveTo(p0.x, p0.y);
         for (const p of player.raceState.trace) {
             const tp = t(p.x, p.y);
             ctx.lineTo(tp.x, tp.y);
         }
         const curr = t(player.x, player.y);
         ctx.lineTo(curr.x, curr.y);
         ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
         ctx.stroke();
    }

    // Marks
    let active = (player.raceState.leg % 2 === 0) ? [0, 1] : [2, 3];
    if (state.race.status === 'finished') active = [];

    // Gates
    const drawG = (i1, i2, a) => {
        const p1 = t(state.course.marks[i1].x, state.course.marks[i1].y);
        const p2 = t(state.course.marks[i2].x, state.course.marks[i2].y);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = a ? '#facc15' : 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = a ? 2 : 1; ctx.stroke();
    };
    drawG(0, 1, active.includes(0));
    drawG(2, 3, active.includes(2));

    // Marks Points
    for (let i=0; i<state.course.marks.length; i++) {
        const p = t(state.course.marks[i].x, state.course.marks[i].y);
        ctx.beginPath(); ctx.arc(p.x, p.y, active.includes(i) ? 4 : 3, 0, Math.PI*2);
        ctx.fillStyle = active.includes(i) ? '#f97316' : '#94a3b8'; ctx.fill();
    }

    // Boats
    // Draw AI boats first
    for (const boat of state.boats) {
        if (boat.isPlayer) continue;
        const pos = t(boat.x, boat.y);
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(boat.heading);
        ctx.fillStyle = boat.colors.hull;
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.fill();
        ctx.restore();
    }

    // Draw Player last (larger and with stroke)
    if (player) {
        const pos = t(player.x, player.y);
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(player.heading);

        // Pulse Glow
        const glow = 10 + Math.sin(state.time * 8) * 5;
        ctx.shadowBlur = glow;
        ctx.shadowColor = '#facc15';

        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(-8, 9); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.restore();
    }
}

let frameCount = 0;

function getBoatProgress(boat) {
    const m0 = state.course.marks[0], m1 = state.course.marks[1], m2 = state.course.marks[2], m3 = state.course.marks[3];
    const c1x = (m0.x+m1.x)/2, c1y = (m0.y+m1.y)/2;
    const c2x = (m2.x+m3.x)/2, c2y = (m2.y+m3.y)/2;
    const dx = c2x-c1x, dy = c2y-c1y;
    const len = Math.sqrt(dx*dx+dy*dy);
    const wx = dx/len, wy = dy/len;

    if (boat.raceState.finished) {
        // Finished boats are ranked by finish time, but for progress calculation we can assume they are at the end.
        // Or better, handle them separately in sorting.
        return 4*len + (1000000 - boat.raceState.finishTime); // Higher is better (lower time = higher score)
    }

    // Project onto course axis (Start -> Upwind)
    const p = boat.x*wx + boat.y*wy;
    const startP = c1x*wx + c1y*wy;
    const relP = p - startP;

    // Leg Progress
    // Leg 0: relP (Starts neg, target 0).
    // Leg 1: relP (0 to L).
    // Leg 2: 2L - relP (L to 0).
    // Leg 3: 2L + relP (0 to L).
    // Leg 4: 4L - relP (L to 0).

    const L = len; // Approx 4000

    let progress = 0;
    switch(boat.raceState.leg) {
        case 0: progress = relP; break;
        case 1: progress = relP; break;
        case 2: progress = 2*L - relP; break;
        case 3: progress = 2*L + relP; break;
        case 4: progress = 4*L - relP; break;
        default: progress = 0; // Should be covered by finished check
    }

    return progress;
}

function updateLeaderboard() {
    if (!UI.leaderboard || !state.boats.length) return;
    // Calculate L for distance estimates
    const m0 = state.course.marks[0], m1 = state.course.marks[1], m2 = state.course.marks[2], m3 = state.course.marks[3];
    const c1x = (m0.x+m1.x)/2, c1y = (m0.y+m1.y)/2;
    const c2x = (m2.x+m3.x)/2, c2y = (m2.y+m3.y)/2;
    const dx = c2x-c1x, dy = c2y-c1y;
    const len = Math.sqrt(dx*dx+dy*dy);
    const totalRaceDist = 4 * len;


    if (state.race.status === 'prestart') {
         UI.leaderboard.classList.add('hidden');
         return;
    }
    UI.leaderboard.classList.remove('hidden');

    // Sort boats
    const sorted = [...state.boats].sort((a, b) => {
        // 1. Finished status
        if (a.raceState.finished && !b.raceState.finished) return -1;
        if (!a.raceState.finished && b.raceState.finished) return 1;
        if (a.raceState.finished && b.raceState.finished) return a.raceState.finishTime - b.raceState.finishTime;

        // 2. Leg
        if (a.raceState.leg !== b.raceState.leg) return b.raceState.leg - a.raceState.leg;

        // 3. Progress within leg
        const pA = getBoatProgress(a);
        const pB = getBoatProgress(b);
        return pB - pA;
    });

    const leader = sorted[0];
    const leaderProgress = getBoatProgress(leader);

    // Update Header
    if (UI.lbLeg) {
        if (leader.raceState.finished) UI.lbLeg.textContent = "FINISH";
        else UI.lbLeg.textContent = `${Math.max(1, leader.raceState.leg)}/4`;
    }

    // Render Rows
    if (UI.lbRows) {
        const ROW_HEIGHT = 36;
        UI.lbRows.style.height = (sorted.length * ROW_HEIGHT) + 'px';

        sorted.forEach((boat, index) => {
            let row = UI.boatRows[boat.id];

            // Create if missing
            if (!row) {
                row = document.createElement('div');
                row.className = "lb-row flex items-center px-3 border-b border-slate-700/50 bg-slate-800/40";

                // Construct inner HTML once
                // Rank
                const rank = document.createElement('div');
                rank.className = "lb-rank w-4 text-xs font-black italic text-slate-400 mr-2";

                // Portrait / Icon
                const iconContainer = document.createElement('div');
                iconContainer.className = "w-9 h-9 mr-2 flex items-center justify-center shrink-0";

                if (boat.isPlayer) {
                    // Star Icon
                    const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    star.setAttribute("viewBox", "0 0 24 24");
                    star.setAttribute("class", "w-7 h-7 drop-shadow-md");
                    star.setAttribute("fill", settings.hullColor);
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z");
                    star.appendChild(path);
                    iconContainer.appendChild(star);
                } else {
                    // Portrait
                    const img = document.createElement('img');
                    img.src = boat.name.toLowerCase() + ".png";
                    img.className = "w-8 h-8 rounded-full border-2 object-cover bg-slate-900";
                    img.style.borderColor = boat.colors.hull;
                    iconContainer.appendChild(img);
                }

                // Name
                const nameDiv = document.createElement('div');
                nameDiv.className = "text-xs font-bold text-white tracking-wide flex-1 truncate";
                nameDiv.textContent = boat.name;
                if (boat.isPlayer) nameDiv.className += " text-yellow-300";

                // Meters Back
                const distDiv = document.createElement('div');
                distDiv.className = "lb-dist text-[10px] font-mono text-slate-400 text-right min-w-[32px]";

                row.appendChild(rank);
                row.appendChild(iconContainer);
                row.appendChild(nameDiv);
                row.appendChild(distDiv);

                UI.lbRows.appendChild(row);
                UI.boatRows[boat.id] = row;

                // Init rank
                boat.lbRank = index;
            }

            // Update Content
            const rankDiv = row.querySelector('.lb-rank');
            const distDiv = row.querySelector('.lb-dist');

            // Apply finished styling
            if (boat.raceState.finished) {
                row.className = "lb-row flex items-center px-3 border-b border-slate-700/50 bg-emerald-900/60 transition-colors duration-500";
                rankDiv.className = "lb-rank w-4 text-xs font-black italic text-white mr-2";
                distDiv.className = "lb-dist text-[10px] font-mono text-white text-right min-w-[32px]";
            } else {
                row.className = "lb-row flex items-center px-3 border-b border-slate-700/50 bg-slate-800/40 transition-colors duration-500";
                rankDiv.className = "lb-rank w-4 text-xs font-black italic text-slate-400 mr-2";
                distDiv.className = "lb-dist text-[10px] font-mono text-slate-400 text-right min-w-[32px]";
            }

            rankDiv.textContent = index + 1;
            if (index === 0) {
                 distDiv.textContent = "";
            } else {
                 if (leader.raceState.finished) {
                     if (boat.raceState.finished) {
                         const tDiff = boat.raceState.finishTime - leader.raceState.finishTime;
                         distDiv.textContent = "+" + tDiff.toFixed(1) + "s";
                     } else {
                         // Distance to finish?
                         // Leader is at 16000.
                         const myP = getBoatProgress(boat);
                         const diff = Math.max(0, totalRaceDist - myP);
                         distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                     }
                 } else {
                     const myP = getBoatProgress(boat);
                     const diff = Math.max(0, leaderProgress - myP);
                     distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                 }
            }

            // Update Position
            row.style.transform = `translate3d(0, ${index * ROW_HEIGHT}px, 0)`;

            // Handle Rank Change Animation
            if (boat.lbRank !== index) {
                boat.lbRank = index;
            }
        });
    }
}



function drawBoatIndicator(ctx, boat) {
    if (boat.isPlayer) return;

    const rank = (boat.lbRank !== undefined) ? (boat.lbRank + 1) : "-";
    const speed = (boat.speed * 4).toFixed(1);
    const name = boat.name.toUpperCase();
    const line1 = `${rank} ${name}`;
    const line2 = `${speed}kn`;

    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(state.camera.rotation);
    ctx.translate(0, 50); // Below boat

    ctx.font = "bold 11px monospace";
    const paddingX = 8;
    const m1 = ctx.measureText(line1);
    const m2 = ctx.measureText(line2);
    const boxWidth = Math.max(m1.width, m2.width) + paddingX * 2 + 6;
    const boxHeight = 32;

    const x = -boxWidth / 2;
    const y = 0;

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    // Main Box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, 4);
    ctx.fill();

    // Colored Bar
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = boat.colors.hull;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, 4, boxHeight - 4, 2);
    ctx.fill();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(line1, x + 10, y + 5);

    if (boat.badAirIntensity > 0.05) ctx.fillStyle = '#ef4444';
    else ctx.fillStyle = '#ffffff';
    ctx.fillText(line2, x + 10, y + 17);

    ctx.restore();
}

function draw() {
    frameCount++;
    ctx.fillStyle = CONFIG.waterColor; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const player = state.boats[0];
    if (!player) return;

    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.rotate(-state.camera.rotation);
    ctx.translate(-state.camera.x, -state.camera.y);

    drawWater(ctx);
    drawBoundary(ctx);
    drawDisturbedAir(ctx);
    drawParticles(ctx, 'surface');
    drawActiveGateLine(ctx);
    drawLadderLines(ctx);
    drawLayLines(ctx);
    drawMarkZones(ctx);
    drawRoundingArrows(ctx);
    drawParticles(ctx, 'air');
    drawMarkShadows(ctx);
    drawMarkBodies(ctx);
    drawRulesOverlay(ctx);

    // Draw All Boats
    for (const boat of state.boats) {
        ctx.save();
        ctx.translate(boat.x, boat.y);
        ctx.rotate(boat.heading);
        drawBoat(ctx, boat);
        ctx.restore();
    }

    // Draw Indicators
    for (const boat of state.boats) {
        drawBoatIndicator(ctx, boat);
    }

    ctx.restore();

    // Camera Message
    if (state.camera.messageTimer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1.0, state.camera.messageTimer*2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const txt = "CAMERA: " + state.camera.message;
        ctx.fillText(txt, canvas.width/2, canvas.height/3);
        ctx.restore();
    }

    // Waypoint Arrow
    if (state.race.status !== 'finished' && state.showNavAids) {
        const wx = player.raceState.nextWaypoint.x, wy = player.raceState.nextWaypoint.y;
        const dx = wx - state.camera.x, dy = wy - state.camera.y;
        const rot = -state.camera.rotation;
        const rx = dx*Math.cos(rot) - dy*Math.sin(rot);
        const ry = dx*Math.sin(rot) + dy*Math.cos(rot);

        const m = 40, hw = Math.max(10, canvas.width/2-m), hh = Math.max(10, canvas.height/2-m);
        let t = 1.0;
        if (Math.abs(rx)>0.1 || Math.abs(ry)>0.1) t = Math.min(hw/Math.abs(rx), hh/Math.abs(ry));
        const f = Math.min(t, 1.0);

        ctx.save();
        ctx.translate(canvas.width/2 + rx*f, canvas.height/2 + ry*f);
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fillStyle = '#22c55e'; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
        ctx.fillText(Math.round(player.raceState.nextWaypoint.dist) + 'm', 0, -12);
        ctx.restore();
    }

    drawMinimap();

    // UI Updates (Player Data)
    if (UI.compassRose) UI.compassRose.style.transform = `rotate(${-state.camera.rotation}rad)`;
    if (UI.windArrow) UI.windArrow.style.transform = `rotate(${state.wind.direction}rad)`;
    if (UI.waypointArrow) UI.waypointArrow.style.transform = `rotate(${player.raceState.nextWaypoint.angle}rad)`;
    if (UI.headingArrow) UI.headingArrow.style.transform = `rotate(${player.heading - state.camera.rotation}rad)`;

    if (frameCount % 10 === 0) {
        updateLeaderboard();
        if (UI.speed) {
            UI.speed.textContent = (player.speed*4).toFixed(1);
            if (player.badAirIntensity > 0.05) UI.speed.classList.add('text-red-400');
            else UI.speed.classList.remove('text-red-400');
        }
        if (UI.windSpeed) {
             UI.windSpeed.textContent = state.wind.speed.toFixed(1);
             if (player.badAirIntensity > 0.05) {
                 UI.windSpeed.classList.add('text-red-400');
                 if (!UI.windSpeed.textContent.includes('↓')) UI.windSpeed.textContent += ' ↓';
             } else {
                 UI.windSpeed.classList.remove('text-red-400');
             }
        }
        if (UI.windAngle) UI.windAngle.textContent = Math.round(Math.abs(normalizeAngle(player.heading - state.wind.direction))*(180/Math.PI)) + '°';
        if (UI.vmg) UI.vmg.textContent = Math.abs((player.speed*4)*Math.cos(normalizeAngle(player.heading - state.wind.direction))).toFixed(1);

        if (UI.trimMode) {
             UI.trimMode.textContent = player.manualTrim ? "MANUAL TRIM" : "AUTO TRIM";
             UI.trimMode.className = `mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider bg-slate-900/80 ${player.manualTrim ? "text-yellow-300 border-yellow-500/50" : "text-emerald-300 border-emerald-500/50"}`;
        }

        if (UI.timer) {
            let displayTime = state.race.timer;
            let timerClass = 'text-white';

            if (state.race.status === 'prestart') {
                displayTime = -state.race.timer;
                if (state.race.timer < 10) timerClass = 'text-orange-400';
            } else if (player.raceState.finished) {
                displayTime = player.raceState.finishTime;
                timerClass = 'text-green-400';
            } else if (state.race.status === 'finished') {
                timerClass = 'text-green-400';
            }

            UI.timer.textContent = formatTime(displayTime);
            UI.timer.className = `font-mono text-4xl font-black tabular-nums tracking-widest drop-shadow-md ${timerClass}`;
        }

        if (UI.startTime) {
            if (player.raceState.legSplitTimer > 0) {
                UI.startTime.textContent = formatSplitTime(player.raceState.lastLegDuration);
                UI.startTime.classList.remove('hidden');
            } else if (player.raceState.startTimeDisplayTimer > 0) {
                UI.startTime.textContent = '+' + player.raceState.startTimeDisplay.toFixed(3) + 's';
                UI.startTime.classList.remove('hidden');
            } else {
                UI.startTime.classList.add('hidden');
            }
        }

        if (UI.legInfo) {
             let txt = "";
             if (state.race.status === 'prestart') txt = "PRESTART";
             else if (state.race.status === 'finished' || player.raceState.finished) txt = "FINISHED";
             else txt = (player.raceState.leg === 0) ? "START" : `LEG ${player.raceState.leg} OF 4: ${(player.raceState.leg%2!==0)?"UPWIND":"DOWNWIND"}`;
             UI.legInfo.textContent = txt;
        }

        if (UI.legTimes) {
            UI.legTimes.classList.toggle('hidden', state.race.status === 'prestart');
            if (state.race.status !== 'prestart') {
                 let html = "";
                 const getMoves = (i) => player.raceState.legManeuvers[i] || 0;
                 const getDist = (i) => Math.round(player.raceState.legDistances[i] || 0);
                 const getTop = (i) => (player.raceState.legTopSpeeds[i] || 0).toFixed(1);

                 if (player.raceState.startLegDuration !== null) {
                     html += `<div class="bg-slate-900/60 text-slate-300 font-mono text-xs font-bold px-2 py-0.5 rounded border-l-2 border-slate-500 shadow-md flex justify-between gap-4"><span>Start: ${formatSplitTime(player.raceState.startLegDuration)}</span> <span class="text-slate-500">Top:${getTop(0)}kn Dist:${getDist(0)}m Moves:${getMoves(0)}</span></div>`;
                 }
                 player.raceState.legTimes.forEach((t, i) => {
                     html += `<div class="bg-slate-900/60 text-slate-300 font-mono text-xs font-bold px-2 py-0.5 rounded border-l-2 border-slate-500 shadow-md flex justify-between gap-4"><span>Leg ${i+1}: ${formatSplitTime(t)}</span> <span class="text-slate-500">Top:${getTop(i+1)}kn Dist:${getDist(i+1)}m Moves:${getMoves(i+1)}</span></div>`;
                 });
                 if ((state.race.status==='racing' || state.race.status==='prestart') && player.raceState.leg < 5) {
                     const cur = player.raceState.leg;
                     const t = (cur===0) ? state.race.timer : (state.race.timer - player.raceState.legStartTime);
                     const lbl = (cur===0) ? "Start" : `Leg ${cur}`;
                     html += `<div class="bg-slate-900/80 text-white font-mono text-xs font-bold px-2 py-0.5 rounded border-l-2 border-green-500 shadow-md flex justify-between gap-4"><span>${lbl}: ${formatSplitTime(t)}</span> <span class="text-white/50">Top:${getTop(cur)}kn Dist:${getDist(cur)}m Moves:${getMoves(cur)}</span></div>`;
                 }
                 UI.legTimes.innerHTML = html;
            }
        }
    }
}

let lastTime = 0;
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (!state.paused) {
        update(Math.min(dt, 0.1));
        draw();
    }
    requestAnimationFrame(loop);
}

// Init
function initCourse() {
    const d = state.wind.baseDirection, ux = Math.sin(d), uy = -Math.cos(d), rx = -uy, ry = ux;
    const w = 550, dist = 4000;
    state.course = {
        marks: [
            { x: -rx*w/2, y: -ry*w/2, type: 'start' }, { x: rx*w/2, y: ry*w/2, type: 'start' },
            { x: ux*dist - rx*w/2, y: uy*dist - ry*w/2, type: 'mark' }, { x: ux*dist + rx*w/2, y: uy*dist + ry*w/2, type: 'mark' }
        ],
        boundary: { x: ux*dist/2, y: uy*dist/2, radius: 3500 }
    };
}

function resetGame() {
    loadSettings();
    state.camera.target = 'boat';
    state.wind.baseSpeed = 8 + Math.random()*10;
    state.wind.speed = state.wind.baseSpeed;
    state.wind.baseDirection = (Math.random()-0.5)*0.5;
    state.wind.direction = state.wind.baseDirection;
    state.time = 0;
    state.race.status = 'prestart';
    state.race.timer = 30.0;

    initCourse();

    state.boats = [];
    if (UI.lbRows) UI.lbRows.innerHTML = '';
    UI.boatRows = {};

    // Player
    // Start area: At least 50m from start line.
    // Start Line at (0,0). Wind from 0 (North).
    // Start area is "below" (downwind) of line. Positive Y.
    // 50m = 250 units.
    // Random spots in start area.

    const startYMin = 300;
    const startYMax = 800;
    const startXSpan = 800;

    // Helper for random pos
    const getPos = () => ({
        x: (Math.random() - 0.5) * startXSpan,
        y: startYMin + Math.random() * (startYMax - startYMin)
    });

    // Player
    const pPos = getPos();
    const player = new Boat(0, true, pPos.x, pPos.y, "Player");
    player.heading = state.wind.direction; // Head to wind
    player.prevHeading = player.heading;
    player.lastWindSide = 0;
    state.boats.push(player);

    // AI Boats
    for (let i = 0; i < AI_CONFIG.length; i++) {
        // Ensure no collision at start
        let pos, ok = false, tries = 0;
        while (!ok && tries < 100) {
            pos = getPos();
            ok = true;
            for (const b of state.boats) {
                if ((pos.x - b.x)**2 + (pos.y - b.y)**2 < 60*60) {
                    ok = false; break;
                }
            }
            tries++;
        }
        const config = AI_CONFIG[i];
        const ai = new Boat(i + 1, false, pos.x, pos.y, config.name, config);
        // Start head to wind
        ai.heading = state.wind.direction;
        ai.prevHeading = ai.heading;
        ai.lastWindSide = 0;
        ai.speed = 0; // Initial speed
        state.boats.push(ai);
    }

    state.particles = [];
    hideRaceMessage();
}

function restartRace() { resetGame(); togglePause(false); }

resetGame();
requestAnimationFrame(loop);
window.state = state; window.UI = UI; window.updateLeaderboard = updateLeaderboard;
