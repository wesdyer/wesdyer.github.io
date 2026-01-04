
import { state } from '../state/state.js';

export function setupInputs() {
    window.addEventListener('keydown', (e) => {
        if (state.race.status === 'waiting') return; // Ignore input when waiting

        // WASD Support
        let key = e.key;
        if (key === 'w' || key === 'W') key = 'ArrowUp';
        if (key === 'a' || key === 'A') key = 'ArrowLeft';
        if (key === 's' || key === 'S') key = 'ArrowDown';
        if (key === 'd' || key === 'D') key = 'ArrowRight';

        if (state.keys.hasOwnProperty(key)) {
            state.keys[key] = true;
        }
        if (e.key === 'Shift') state.keys.Shift = true;
    });

    window.addEventListener('keyup', (e) => {
        let key = e.key;
        if (key === 'w' || key === 'W') key = 'ArrowUp';
        if (key === 'a' || key === 'A') key = 'ArrowLeft';
        if (key === 's' || key === 'S') key = 'ArrowDown';
        if (key === 'd' || key === 'D') key = 'ArrowRight';

        if (state.keys.hasOwnProperty(key)) {
            state.keys[key] = false;
        }
        if (e.key === 'Shift') state.keys.Shift = false;
    });

    // Reset keys on window focus loss to prevent stuck keys
    window.addEventListener('blur', () => {
        for (const k in state.keys) {
            state.keys[k] = false;
        }
    });
}
