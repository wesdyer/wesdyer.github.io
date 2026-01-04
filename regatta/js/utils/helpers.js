
export function isVeryDark(color) {
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

export function formatTime(seconds) {
    if (seconds < 0) {
        // Countdown
        const abs = Math.abs(seconds);
        const m = Math.floor(abs / 60);
        const s = Math.floor(abs % 60);
        return `-${m}:${s.toString().padStart(2, '0')}`;
    } else {
        // Race Time
        const m = Math.floor(seconds / 60);
        const s = (seconds % 60).toFixed(1);
        const sInt = Math.floor(seconds % 60);
        const sDec = Math.round((seconds % 1) * 10);
        return `${m}:${sInt.toString().padStart(2, '0')}.${sDec}`;
    }
}

export function formatSplitTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(3);
    const sInt = Math.floor(seconds % 60);
    const sFrac = Math.floor((seconds % 1) * 1000);
    return `${m}:${sInt.toString().padStart(2, '0')}.${sFrac.toString().padStart(3, '0')}`;
}
