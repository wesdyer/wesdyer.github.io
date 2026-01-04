
import { J111_POLARS } from '../core/config.js';

export function getTargetSpeed(twaRad, useSpin, windSpeed) {
    const twaDeg = Math.abs(twaRad) * (180 / Math.PI);
    const polars = J111_POLARS;

    // Find wind bracket
    const winds = Object.keys(polars.speeds).map(Number).sort((a,b)=>a-b);
    let lowerW = winds[0];
    let upperW = winds[winds.length-1];

    for(let i=0; i<winds.length-1; i++) {
        if(windSpeed >= winds[i] && windSpeed <= winds[i+1]) {
            lowerW = winds[i];
            upperW = winds[i+1];
            break;
        }
    }

    if (windSpeed < lowerW) { upperW = lowerW; lowerW = 0; } // Interpolate from 0
    if (windSpeed > upperW) { lowerW = upperW; } // Clamp max

    const getSpeedForWind = (w) => {
        if (w === 0) return 0;
        const data = polars.speeds[w];
        const arr = useSpin ? data.spinnaker : data.nonSpinnaker;

        // Interpolate Angle
        for(let i=0; i<polars.angles.length-1; i++) {
            if(twaDeg >= polars.angles[i] && twaDeg <= polars.angles[i+1]) {
                const t = (twaDeg - polars.angles[i]) / (polars.angles[i+1] - polars.angles[i]);
                return arr[i] + (arr[i+1] - arr[i]) * t;
            }
        }
        return arr[arr.length-1];
    };

    const s1 = getSpeedForWind(lowerW);
    const s2 = getSpeedForWind(upperW);

    if (upperW === lowerW) return s1;
    const t = (windSpeed - lowerW) / (upperW - lowerW);
    return s1 + (s2 - s1) * t;
}
