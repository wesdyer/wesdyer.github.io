
import { state } from '../state/state.js';
import { settings, updateSettings } from '../state/state.js';
import { Sound } from '../audio/sound.js'; // Will create audio module next

export class Boat {
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

        this.opacity = 1.0;
        this.fadeTimer = 10.0;

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

        // Stats
        this.stats = (config && config.stats) ? config.stats : { acceleration:0, momentum:0, handling:0, upwind:0, reach:0, downwind:0, boost:0 };

        // Race State
        this.raceState = {
            leg: 0,
            isRounding: false,
            isTacking: false, // Rule 13
            inZone: false,
            zoneEnterTime: 0,
            ocs: false,
            penalty: false,
            penaltyProgress: 0, // Deprecated but kept for compatibility if needed
            penaltyTimer: 0,
            totalPenalties: 0,
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

        this.badAirIntensity = 0;
        this.turbulence = [];
        this.turbulenceTimer = 0;

        this.playerProximity = { minD: Infinity, close: false };
        this.lbRank = 0;
        this.creature = config ? (config.creature || "Unknown") : "Unknown";
        this.prevRank = 0;
    }
}
