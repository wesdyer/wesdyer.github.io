
// State Management
export const state = {
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
        currentShift: 0,
        speed: 10,
        baseSpeed: 10,
        history: [],
        debugTimer: 0
    },
    gusts: [],
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
        startTimerDuration: 30.0,
        conditions: {}
    },
    course: {},
    audioContext: null
};

// Global Settings (Mutable)
import { DEFAULT_SETTINGS } from '../core/config.js';
export let settings = { ...DEFAULT_SETTINGS };

export function updateSettings(newSettings) {
    Object.assign(settings, newSettings);
}
