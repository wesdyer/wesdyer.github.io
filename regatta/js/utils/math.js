
// Seeded RNG Helper
export function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// Math Helpers
export function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

export function fractalNoise(t, octaves=3) {
    let val = 0;
    let amp = 1;
    let freq = 1;
    let totalAmp = 0;
    for(let i=0; i<octaves; i++) {
        val += Math.sin(t * freq + (i*13.2)) * amp;
        totalAmp += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return val / totalAmp;
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}
