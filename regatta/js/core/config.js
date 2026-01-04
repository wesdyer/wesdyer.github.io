
// Game Configuration
export const CONFIG = {
    turnSpeed: 0.01, // Radians per frame (approx) -> adjusted for dt in update
    turnPenalty: 0.9999,
    cameraPanSpeed: 1.25,
    cameraRotateSpeed: 0.01,
    windSpeed: 5,
    waterColor: '#3b82f6',
    boatColor: '#f8fafc',
    sailColor: '#ffffff',
    cockpitColor: '#cbd5e1',
};

// Wind Configuration
export const WIND_CONFIG = {
    presets: {
        STEADY: { amp: 4, period: 90, slew: 0.2 },
        NORMAL: { amp: 10, period: 60, slew: 0.4 },
        SHIFTY: { amp: 18, period: 45, slew: 0.6 }
    }
};

// Settings
export const DEFAULT_SETTINGS = {
    playerName: "Player",
    navAids: true,
    manualTrim: false,
    soundEnabled: true,
    bgSoundEnabled: true,
    musicEnabled: false,
    penaltiesEnabled: true,
    cameraMode: 'heading',
    hullColor: '#f1f5f9',
    sailColor: '#ffffff',
    cockpitColor: '#cbd5e1',
    spinnakerColor: '#ef4444'
};

// J/111 Polar Data
export const J111_POLARS = {
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

// Planing Configuration
export const J111_PLANING = {
    // Conditions
    minTWA: 100 * Math.PI / 180,
    maxTWA: 170 * Math.PI / 180, // Drop off if dead downwind (unstable)
    minTWS: 12.0, // Needs decent breeze
    entrySpeed: 8.5, // Knots
    exitSpeed: 7.5, // Hysteresis
    entryTime: 1.5, // Seconds to trigger (prevent blips)
    exitTime: 1.0,  // Seconds to lose it

    // Physics Modifiers
    speedMultiplier: 1.20, // 20% boost when planing (so 11kn -> 13.2kn)
    accelBoost: 1.5, // Surging acceleration
    turnDrag: 0.990, // Higher drag in turns while planing (loss of plane)
    turnRateScale: 0.7, // Stiffer steering at high speed

    // Visuals
    wakeLengthScale: 2.0,
    wakeWidthScale: 1.5
};

// AI Configuration
export const AI_CONFIG = [
    { name: 'Cheer', creature: 'Pom Pom Crab', hull: '#FF9ECF', spinnaker: '#00E5FF', sail: '#FFFFFF', cockpit: '#FFFFFF', personality: "Cheerful and fun loving, always positive and enthuiastic.", stats: { acceleration: 2, momentum: -2, handling: 4, upwind: 1, reach: -2, downwind: -1, boost: 5 } },
    { name: 'Bixby', creature: 'Otter', hull: '#0046ff', spinnaker: '#FFD400', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Relaxed veteran who instinctively finds perfect wind." , stats: { acceleration: -2, momentum: -3, handling: -1, upwind: 0, reach: 1, downwind: 5, boost: -1 } },
    { name: 'Skim', creature: 'Flying Fish', hull: '#8FD3FF', spinnaker: '#FF2D95', sail: '#FFFFFF', cockpit: '#AEB4BF', personality: "Flashy opportunist thriving on speed bursts." , stats: { acceleration: 5, momentum: 0, handling: -4, upwind: 3, reach: -4, downwind: 3, boost: 2 } },
    { name: 'Wobble', creature: 'Platypus', hull: '#FF8C1A', spinnaker: '#00E5FF', sail: '#FFFFFF', cockpit: '#B0B0B0', personality: "Awkward, unpredictable, deadly effective in chaos." , stats: { acceleration: 5, momentum: -1, handling: -2, upwind: -3, reach: 3, downwind: 0, boost: 4 } },
    { name: 'Pinch', creature: 'Lobster', hull: '#E10600', spinnaker: '#FFFFFF', sail: '#FFFFFF', cockpit: '#5A5A5A', personality: "Aggressive bully dominating the starting line." , stats: { acceleration: 1, momentum: -2, handling: 0, upwind: 2, reach: -1, downwind: -5, boost: 2 } },
    { name: 'Bruce', creature: 'Great White', hull: '#121212', spinnaker: '#ff0606', sail: '#FFFFFF', cockpit: '#3A3A3A', personality: "Cold, relentless presence forcing others to react." , stats: { acceleration: -5, momentum: -2, handling: -5, upwind: -3, reach: -3, downwind: 4, boost: 1 } },
    { name: 'Strut', creature: 'Flamingo', hull: '#FF4F9A', spinnaker: '#000000', sail: '#FFFFFF', cockpit: '#B0BEC5', personality: "Stylish confidence with daring, showy sailing." , stats: { acceleration: -3, momentum: -3, handling: -5, upwind: 5, reach: -2, downwind: 1, boost: 2 } },
    { name: 'Gasket', creature: 'Beaver', hull: '#FFE600', spinnaker: '#000000', sail: '#000000', cockpit: '#C4BEB2', personality: "Methodical and stubborn, grinding out advantages." , stats: { acceleration: 3, momentum: -3, handling: 3, upwind: 0, reach: 0, downwind: -4, boost: -3 } },
    { name: 'Chomp', creature: 'Saltwater Crocodile', hull: '#2ECC71', spinnaker: '#FFFFFF', sail: '#000000', cockpit: '#C1B58A', personality: "Patient hunter striking without warning." , stats: { acceleration: 4, momentum: 1, handling: -5, upwind: 5, reach: -3, downwind: 0, boost: 3 } },
    { name: 'Whiskers', creature: 'Walrus', hull: '#C49A6C', spinnaker: '#8E0038', sail: '#FFFFFF', cockpit: '#ddd3c9', personality: "Massive, steady, unbeatable in heavy conditions." , stats: { acceleration: -2, momentum: 4, handling: 2, upwind: 0, reach: -5, downwind: 4, boost: -3 } },
    { name: 'Vex', creature: 'Water Dragon', hull: '#0fe367', spinnaker: '#D9D9D9', sail: '#FFFFFF', cockpit: '#D0D0D0', personality: "Slippery tactician exploiting tiny mistakes." , stats: { acceleration: -3, momentum: -5, handling: 4, upwind: -4, reach: -5, downwind: 1, boost: 4 } },
    { name: 'Hug', creature: 'Starfish', hull: '#9900ff', spinnaker: '#e8a6ff', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Chill vibes, relentless endurance." , stats: { acceleration: -3, momentum: 1, handling: 0, upwind: 5, reach: 2, downwind: 2, boost: 5 } },
    { name: 'Ripple', creature: 'Dolphin', hull: '#00B3FF', spinnaker: '#FF6F00', sail: '#FFFFFF', cockpit: '#B8C6D1', personality: "Cheerful speedster seeking clean lanes." , stats: { acceleration: -2, momentum: -1, handling: -3, upwind: 4, reach: -4, downwind: 5, boost: 5 } },
    { name: 'Clutch', creature: 'Crab', hull: '#B00020', spinnaker: '#FFD166', sail: '#FFFFFF', cockpit: '#6B6B6B', personality: "Defensive and stubborn off the line." , stats: { acceleration: -5, momentum: 2, handling: -4, upwind: 4, reach: -5, downwind: -2, boost: 0 } },
    { name: 'Glide', creature: 'Albatross', hull: '#E8F1F8', spinnaker: '#1F4FFF', sail: '#000000', cockpit: '#C5CED6', personality: "Patient perfectionist who never blunders." , stats: { acceleration: -4, momentum: 3, handling: 2, upwind: 4, reach: 3, downwind: -5, boost: 2 } },
    { name: 'Fathom', creature: 'Orca', hull: '#1C1C3C', spinnaker: '#00F0FF', sail: '#FFFFFF', cockpit: '#3C3F55', personality: "Silent dominance unleashed at full power." , stats: { acceleration: 0, momentum: 5, handling: -5, upwind: 3, reach: 2, downwind: -2, boost: -3 } },
    { name: 'Scuttle', creature: 'Hermit Crab', hull: '#FFB703', spinnaker: '#3A86FF', sail: '#000000', cockpit: '#BFAF92', personality: "Erratic survivor thriving in congestion." , stats: { acceleration: -4, momentum: -3, handling: -3, upwind: -3, reach: 1, downwind: -2, boost: 5 } },
    { name: 'Finley', creature: 'Tuna', hull: '#0077B6', spinnaker: '#ffd900', sail: '#FFFFFF', cockpit: '#A7B8C8', personality: "Pure speed and relentless pressure." , stats: { acceleration: -2, momentum: -3, handling: -3, upwind: 5, reach: -5, downwind: 1, boost: -1 } },
    { name: 'Torch', creature: 'Fire Salamander', hull: '#FF3B30', spinnaker: '#FFD60A', sail: '#000000', cockpit: '#5E5E5E', personality: "Explosive starts, reckless aggression." , stats: { acceleration: 1, momentum: -5, handling: -3, upwind: -1, reach: 4, downwind: -1, boost: 4 } },
    { name: 'Nimbus', creature: 'Cloud Ray', hull: '#6A7FDB', spinnaker: '#F1F7FF', sail: '#FFFFFF', cockpit: '#C9D0E0', personality: "Effortlessly surfing invisible shifts." , stats: { acceleration: 5, momentum: -5, handling: -4, upwind: 1, reach: 4, downwind: -5, boost: 0 } },
    { name: 'Tangle', creature: 'Octopus', hull: '#7A1FA2', spinnaker: '#00E676', sail: '#FFFFFF', cockpit: '#B8ACC9', personality: "Trap-setting master of dirty air." , stats: { acceleration: -1, momentum: 1, handling: -3, upwind: -2, reach: -1, downwind: -5, boost: 5 } },
    { name: 'Brine', creature: 'Manatee', hull: '#5E7C8A', spinnaker: '#FFB4A2', sail: '#FFFFFF', cockpit: '#C3CCD2', personality: "Looks slow, impossible to pass." , stats: { acceleration: -5, momentum: 3, handling: 3, upwind: 3, reach: -2, downwind: 4, boost: -4 } },
    { name: 'Razor', creature: 'Barracuda', hull: '#2D3142', spinnaker: '#EF233C', sail: '#FFFFFF', cockpit: '#5C5F6A', personality: "Surgical aggression at the worst moments." , stats: { acceleration: 0, momentum: 4, handling: 5, upwind: -1, reach: 0, downwind: -1, boost: -1 } },
    { name: 'Pebble', creature: 'Penguin', hull: '#1F1F1F', spinnaker: '#00B4D8', sail: '#FFFFFF', cockpit: '#C7CCD1', personality: "Precise and unshakable in traffic." , stats: { acceleration: -2, momentum: 5, handling: 3, upwind: 5, reach: -4, downwind: 4, boost: -2 } },
    { name: 'Saffron', creature: 'Seahorse', hull: '#FFB000', spinnaker: '#7B2CBF', sail: '#FFFFFF', cockpit: '#CBBFA6', personality: "Graceful wildcard favoring wide tactics." , stats: { acceleration: -4, momentum: -2, handling: 3, upwind: -5, reach: 5, downwind: 0, boost: 5 } },
    { name: 'Bramble', creature: 'Sea Urchin', hull: '#2B2E4A', spinnaker: '#FF9F1C', sail: '#FFFFFF', cockpit: '#7A7F9A', personality: "Spiky defender denying easy lanes." , stats: { acceleration: -5, momentum: 3, handling: -4, upwind: 3, reach: -1, downwind: 1, boost: -4 } },
    { name: 'Mistral', creature: 'Swift', hull: '#A8DADC', spinnaker: '#E63946', sail: '#FFFFFF', cockpit: '#C4CFD4', personality: "Constantly sniffing out pressure." , stats: { acceleration: 5, momentum: 5, handling: 2, upwind: 0, reach: -1, downwind: 0, boost: -1 } },
    { name: 'Drift', creature: 'Jellyfish', hull: '#FF70A6', spinnaker: '#70D6FF', sail: '#FFFFFF', cockpit: '#D6C9D9', personality: "Harmless-looking, slips through gaps." , stats: { acceleration: -4, momentum: -5, handling: -5, upwind: -2, reach: -1, downwind: 4, boost: 4 } },
    { name: 'Anchor', creature: 'Sea Turtle', hull: '#96C47A', spinnaker: '#ffd016', sail: '#FFFFFF', cockpit: '#B7C4B4', personality: "Conservative, resilient, brutally consistent." , stats: { acceleration: 3, momentum: 5, handling: -2, upwind: -5, reach: 0, downwind: -2, boost: -1 } },
    { name: 'Zing', creature: 'Flying Squirrel', hull: '#9B5DE5', spinnaker: '#FEE440', sail: '#FFFFFF', cockpit: '#CFC7DC', personality: "Hyperactive chaos opportunist." , stats: { acceleration: 4, momentum: 5, handling: 4, upwind: -3, reach: -4, downwind: -2, boost: 1 } },
    { name: 'Knot', creature: 'Nautilus', hull: '#C8553D', spinnaker: '#588157', sail: '#FFFFFF', cockpit: '#C8B5A6', personality: "Cerebral planner playing long games." , stats: { acceleration: -2, momentum: -3, handling: 0, upwind: -3, reach: 0, downwind: 1, boost: -4 } },
    { name: 'Flash', creature: 'Mackerel', hull: '#3A86FF', spinnaker: '#FFBE0B', sail: '#000000', cockpit: '#B4C2D6', personality: "Speed-first, consequences later." , stats: { acceleration: 2, momentum: -1, handling: 5, upwind: -5, reach: -1, downwind: 2, boost: -4 } },
    { name: 'Pearl', creature: 'Oyster', hull: '#C7A6FF', spinnaker: '#2E2E2E', sail: '#FFFFFF', cockpit: '#CFCFD4', personality: "Quiet patience, strikes at perfect moments." , stats: { acceleration: 4, momentum: -5, handling: -1, upwind: -5, reach: 4, downwind: 5, boost: 4 } },
    { name: 'Bluff', creature: 'Polar Bear', hull: '#FFFFFF', spinnaker: '#00AEEF', sail: '#FFFFFF', cockpit: '#BFC6CC', personality: "Imposing calm daring mistakes." , stats: { acceleration: 2, momentum: 4, handling: -3, upwind: -5, reach: -5, downwind: -2, boost: -1 } },
    { name: 'Regal', creature: 'Swan', hull: '#FFFFFF', spinnaker: '#E10600', sail: '#000000', cockpit: '#C9CCD6', personality: "Elegant lane thief with ruthless timing." , stats: { acceleration: -1, momentum: 3, handling: 5, upwind: 0, reach: 4, downwind: -4, boost: -2 } },
    { name: 'Sunshine', creature: 'Mahi-Mahi', hull: '#FFEB3B', spinnaker: '#00E676', sail: '#FFFFFF', cockpit: '#BDB76B', personality: "Flashy speed attacking on reaches." , stats: { acceleration: 1, momentum: -4, handling: 1, upwind: 4, reach: 0, downwind: -4, boost: -4 } },
    { name: 'Pulse', creature: 'Tree Frog', hull: '#00FF6A', spinnaker: '#7A00FF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Lightning reactions and explosive starts." , stats: { acceleration: -3, momentum: 2, handling: -1, upwind: -3, reach: -5, downwind: -5, boost: 2 } },
    { name: 'Splat', creature: 'Blobfish', hull: '#E7A6B4', spinnaker: '#6a1051', sail: '#FFFFFF', cockpit: '#CFC6CC', personality: "Looks doomed, but somehow always survives." , stats: { acceleration: -5, momentum: 0, handling: -3, upwind: 0, reach: -2, downwind: 0, boost: 1 } },
    { name: 'Dart', creature: 'Kingfisher', hull: '#00C2FF', spinnaker: '#E5A051', sail: '#FFFFFF', cockpit: '#AEBFCC', personality: "pure speed, energetic, very competitive" , stats: { acceleration: 1, momentum: 4, handling: -3, upwind: -4, reach: 4, downwind: -2, boost: 5 } },
    { name: 'Roll', creature: 'Harbor Seal', hull: '#7D8597', spinnaker: '#FFD166', sail: '#FFFFFF', cockpit: '#C3CAD3', personality: "Playful feints hiding brutal positioning skills." , stats: { acceleration: -5, momentum: 4, handling: 5, upwind: -3, reach: 2, downwind: -1, boost: 4 } },
    { name: 'Spike', creature: 'Narwhal', hull: '#6B7FD7', spinnaker: '#FFFFFF', sail: '#000000', cockpit: '#C5CED6', personality: "Majestic closer unleashing terrifying late-race surges." , stats: { acceleration: 1, momentum: -2, handling: 1, upwind: -5, reach: 2, downwind: 1, boost: 3 } },
    { name: 'Flicker', creature: 'Tern', hull: '#EE6C4D', spinnaker: '#E0FBFC', sail: '#000000', cockpit: '#C7CCD1', personality: "Constant repositioning, never predictable." , stats: { acceleration: 4, momentum: 3, handling: -2, upwind: -2, reach: 3, downwind: 0, boost: -1 } },
    { name: 'Croak', creature: 'Bullfrog', hull: '#386641', spinnaker: '#A7C957', sail: '#FFFFFF', cockpit: '#BFC9B8', personality: "Patient swamp tactician lethal in shifts." , stats: { acceleration: 3, momentum: -2, handling: -1, upwind: 4, reach: 1, downwind: 5, boost: 2 } },
    { name: 'Snap', creature: 'Snapping Turtle', hull: '#4B5D23', spinnaker: '#ef3629', sail: '#000000', cockpit: '#B8B8A8', personality: "Grouchy, old salty sailor who likes to beat the young whippersnappers." , stats: { acceleration: -2, momentum: -4, handling: -4, upwind: 2, reach: 5, downwind: 2, boost: 5 } },
    { name: 'Rift', creature: 'Moray Eel', hull: '#d4ff07', spinnaker: '#ff61df', sail: '#FFFFFF', cockpit: '#B7C4B4', personality: "Lurks quietly, strikes savagely at marks." , stats: { acceleration: -1, momentum: -3, handling: 2, upwind: 2, reach: 3, downwind: -4, boost: 2 } },
    { name: 'Skerry', creature: 'Puffin', hull: '#FF5400', spinnaker: '#1D3557', sail: '#FFFFFF', cockpit: '#C7CCD1', personality: "Fearless gap-threader thriving in traffic." , stats: { acceleration: -2, momentum: 1, handling: -1, upwind: -3, reach: 3, downwind: 2, boost: -2 } },
    { name: 'Crush', creature: 'Mantis Shrimp', hull: '#00F5D4', spinnaker: '#F15BB5', sail: '#000000', cockpit: '#CFC7DC', personality: "Explosive reactions with devastating timing." , stats: { acceleration: -4, momentum: -5, handling: 1, upwind: 1, reach: -3, downwind: -5, boost: 0 } },
    { name: 'Torrent', creature: 'Swordfish', hull: '#083fa6', spinnaker: '#D62828', sail: '#FFFFFF', cockpit: '#8D99AE', personality: "Straight-line dominance with brutal acceleration." , stats: { acceleration: 5, momentum: -2, handling: 1, upwind: 1, reach: -1, downwind: -2, boost: 2 } },
    { name: 'Jester', creature: 'Clownfish', hull: '#ffa000', spinnaker: '#FFFFFF', sail: '#000000', cockpit: '#f4f4f4', personality: "Cheerful chaos masking shrewd cunning." , stats: { acceleration: 1, momentum: 3, handling: 2, upwind: -3, reach: 0, downwind: 5, boost: -1 } },
    { name: 'Breeze', creature: 'Nudibranch', hull: '#000080', spinnaker: '#ff3fa7', sail: '#FFFFFF', cockpit: '#D6D6DC', personality: "Chill, stylish, always finds unexpected pressure." , stats: { acceleration: -4, momentum: 4, handling: -2, upwind: -3, reach: 4, downwind: 1, boost: 5 } },
    { name: 'Petal', creature: 'Roseate Spoonbill', hull: '#FF6FAE', spinnaker: '#1a3685', sail: '#FFFFFF', cockpit: '#e6e6e6', personality: "Elegant lane snatcher with impeccable timing." , stats: { acceleration: -3, momentum: 3, handling: 1, upwind: -5, reach: -1, downwind: 3, boost: 4 } },
    { name: 'Stomp', creature: 'Blue-Footed Booby', hull: '#00B4D8', spinnaker: '#E10600', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Clumsy confidence hiding fearless lane attacks." , stats: { acceleration: 5, momentum: -3, handling: 4, upwind: 3, reach: 2, downwind: 0, boost: 1 } },
    { name: 'Crimson', creature: 'Red Snapper', hull: '#ed1515', spinnaker: '#2643E9', sail: '#FFFFFF', cockpit: '#CFCFD4', personality: "Calm, surgical tactician striking at perfect moments." , stats: { acceleration: -1, momentum: -3, handling: 4, upwind: 1, reach: -2, downwind: -2, boost: 5 } },
    { name: 'Viper', creature: 'Green Tree Snake', hull: '#49c100', spinnaker: '#FF1E1E', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Hyper-alert ambusher striking instantly from perfect angles." , stats: { acceleration: -3, momentum: -2, handling: -2, upwind: -5, reach: -1, downwind: -5, boost: 3 } },
    { name: 'Skitter', creature: 'Mudskipper', hull: '#e33d28', spinnaker: '#15f121', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Erratic bursts, impossible angles, constant pressure." , stats: { acceleration: 1, momentum: -4, handling: -2, upwind: 1, reach: -1, downwind: 5, boost: -2 } },
    { name: 'Veil', creature: 'Vampire Squid', hull: '#7A1FA2', spinnaker: '#E10600', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Calm, shadowy predator striking without warning." , stats: { acceleration: -1, momentum: -4, handling: -5, upwind: -1, reach: 3, downwind: -1, boost: -4 } },
    { name: 'Puff', creature: 'Mandarin Dragonet', hull: '#0032ff', spinnaker: '#E17638', sail: '#62e517', cockpit: '#17b3f2', personality: "Super chill vibes, effortless flow, always smiling." , stats: { acceleration: 2, momentum: 4, handling: 0, upwind: 1, reach: 0, downwind: -3, boost: 4 } },
    { name: 'Lure', creature: 'Anglerfish', hull: '#0B0F1A', spinnaker: '#6AFF3D', sail: '#F5F7FA', cockpit: '#2E3440', personality: "Patient darkness, sudden lethal strikes." , stats: { acceleration: -4, momentum: 5, handling: 0, upwind: -2, reach: 4, downwind: -5, boost: 2 } },
    { name: 'Wiggle', creature: 'Axolotl', hull: '#FFFFFF', spinnaker: '#FF4FA3', sail: '#BDEFFF', cockpit: '#D1D7DB', personality: "Cute chaos, surprisingly competitive." , stats: { acceleration: 2, momentum: 1, handling: -5, upwind: -3, reach: 3, downwind: 3, boost: -3 } },
    { name: 'Zeffir', creature: 'Seagull', hull: '#FFFFFF', spinnaker: '#FF7A00', sail: '#FFFFFF', cockpit: '#D1D7DB', personality: "Always lifted, always smiling." , stats: { acceleration: 4, momentum: 1, handling: -1, upwind: 1, reach: 2, downwind: -4, boost: 2 } },
    { name: 'Scoop', creature: 'Pelican', hull: '#D8C6A3', spinnaker: '#5499dc', sail: '#FFFFFF', cockpit: '#e6e6e6', personality: "Big moves, surprisingly precise." , stats: { acceleration: -4, momentum: -1, handling: 1, upwind: 4, reach: -4, downwind: -1, boost: 2 } },
    { name: 'Popper', creature: 'Pufferfish', hull: '#FFD84D', spinnaker: '#E10600', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Defensive chaos, punishes reckless pressure." , stats: { acceleration: -3, momentum: 2, handling: -2, upwind: -4, reach: -3, downwind: 0, boost: 0 } },
    { name: 'Frond', creature: 'Leafy Seadragon', hull: '#5FAF6E', spinnaker: '#FF8C42', sail: '#F3FFF9', cockpit: '#BFCFC4', personality: "Graceful drifter, impossible to read." , stats: { acceleration: -4, momentum: -2, handling: -3, upwind: 2, reach: 2, downwind: 5, boost: 5 } },
    { name: 'Bulkhead', creature: 'Elephant Seal', hull: '#6B7280', spinnaker: '#FF7A00', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Massive momentum, awkward turns, impossible to stop." , stats: { acceleration: -3, momentum: -2, handling: 2, upwind: 3, reach: -1, downwind: -5, boost: 5 } },
    { name: 'Slipstream', creature: 'Salmon', hull: '#B6BCC6', spinnaker: '#E94B4B', sail: '#FFFFFF', cockpit: '#41c617', personality: "Relentless endurance, explosive late surges." , stats: { acceleration: 5, momentum: 3, handling: 1, upwind: 1, reach: -3, downwind: -5, boost: -1 } },
    { name: 'Blaze', creature: 'Mako Shark', hull: '#1F3C5B', spinnaker: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Blisteringly fast attacker forcing races into constant reaction mode." , stats: { acceleration: -3, momentum: -2, handling: 2, upwind: 0, reach: 3, downwind: -4, boost: -1 } },
];
