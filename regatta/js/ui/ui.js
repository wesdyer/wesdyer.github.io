
import { state, settings } from '../state/state.js';
import { isVeryDark, formatTime, formatSplitTime } from '../utils/helpers.js';
import { Sound } from '../audio/sound.js';
import { Sayings } from '../ai/sayings.js';
import { AI_CONFIG } from '../core/config.js';

// UI Elements Cache
export const UI = {
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
    settingPlayerName: document.getElementById('setting-player-name'),
    settingMusic: document.getElementById('setting-music'),
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
    resultsOverlay: document.getElementById('results-overlay'),
    resultsList: document.getElementById('results-list'),
    resultsRestartButton: document.getElementById('results-restart-button'),
    preRaceOverlay: document.getElementById('pre-race-overlay'),
    // Config Sliders
    confWindStrength: document.getElementById('conf-wind-strength'),
    confWindVar: document.getElementById('conf-wind-variability'),
    confWindShift: document.getElementById('conf-wind-shiftiness'),
    confPuffFreq: document.getElementById('conf-puff-frequency'),
    confPuffInt: document.getElementById('conf-puff-intensity'),
    confPuffShift: document.getElementById('conf-puff-shift'),
    confWindDir: document.getElementById('conf-wind-direction'),
    valWindDir: document.getElementById('val-wind-direction'),
    confDesc: document.getElementById('conf-description'),
    confCourseDist: document.getElementById('conf-course-dist'),
    confCourseLegs: document.getElementById('conf-course-legs'),
    confCourseTimer: document.getElementById('conf-course-timer'),
    valCourseDist: document.getElementById('val-course-dist'),
    valCourseLegs: document.getElementById('val-course-legs'),
    valCourseTimer: document.getElementById('val-course-timer'),

    // Obstacles UI
    confIslandCount: document.getElementById('conf-island-count'),
    valIslandCount: document.getElementById('val-island-count'),
    confIslandMaxSize: document.getElementById('conf-island-max-size'),
    confIslandClustering: document.getElementById('conf-island-clustering'),

    // Current UI
    valCurrentDir: document.getElementById('val-current-direction'),
    valCurrentSpeed: document.getElementById('val-current-speed'),
    uiCurrentArrow: document.getElementById('ui-current-arrow'),
    uiCurrentDirText: document.getElementById('ui-current-dir-text'),
    confCurrentEnable: document.getElementById('conf-current-enable'),
    confCurrentDir: document.getElementById('conf-current-direction'),
    confCurrentSpeed: document.getElementById('conf-current-speed'),
    currentControls: document.getElementById('current-controls'),

    prCompetitorsGrid: document.getElementById('pr-competitors-grid'),
    // Toast
    toast: document.getElementById('toast-notification'),
    toastMsg: document.getElementById('toast-message'),

    startRaceBtn: document.getElementById('start-race-btn'),
    boatRows: {},
    resultRows: {},

    // Water Debug
    waterDebug: document.getElementById('water-debug'),
    waterDebugControls: document.getElementById('water-debug-controls'),
    waterReset: document.getElementById('water-reset'),
    waterClose: document.getElementById('water-close')
};

export function showRaceMessage(text, colorClass="text-yellow-300", borderClass="border-yellow-500/50") {
    if (UI.message) {
        UI.message.textContent = text;
        UI.message.className = `mt-2 text-lg font-bold bg-slate-900/80 px-4 py-1 rounded-full border shadow-lg ${colorClass} ${borderClass}`;
        UI.message.classList.remove('hidden');
    }
}

export function hideRaceMessage() {
    if (UI.message) UI.message.classList.add('hidden');
}

export function showToast(msg) {
    if (!UI.toast || !UI.toastMsg) return;
    UI.toastMsg.textContent = msg;
    UI.toast.classList.remove('opacity-0', 'translate-y-4');
    setTimeout(() => {
        UI.toast.classList.add('opacity-0', 'translate-y-4');
    }, 3000);
}

// Progress Logic Needed for Sorting
function getBoatProgress(boat) {
    const m0 = state.course.marks[0], m1 = state.course.marks[1], m2 = state.course.marks[2], m3 = state.course.marks[3];
    const c1x = (m0.x+m1.x)/2, c1y = (m0.y+m1.y)/2;
    const c2x = (m2.x+m3.x)/2, c2y = (m2.y+m3.y)/2;
    const dx = c2x-c1x, dy = c2y-c1y;
    const len = Math.sqrt(dx*dx+dy*dy);
    const wx = dx/len, wy = dy/len;

    const totalLegs = state.race.totalLegs;
    if (boat.raceState.finished) {
        return totalLegs*len + (1000000 - boat.raceState.finishTime);
    }

    const p = boat.x*wx + boat.y*wy;
    const startP = c1x*wx + c1y*wy;
    const relP = p - startP;

    const L = len;
    let progress = 0;
    const leg = boat.raceState.leg;

    if (leg === 0) {
        progress = relP;
    } else {
        if (leg % 2 !== 0) { // Odd (Upwind)
            progress = (leg - 1) * L + relP;
        } else { // Even (Downwind)
            progress = leg * L - relP;
        }
    }

    return progress;
}

export function updateLeaderboard() {
    if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) {
        showResults();
        return;
    }
    if (!UI.leaderboard || !state.boats.length) return;

    // Store previous ranks
    state.boats.forEach(b => b.prevRank = b.lbRank);

    // Calculate L for distance estimates
    const m0 = state.course.marks[0], m1 = state.course.marks[1], m2 = state.course.marks[2], m3 = state.course.marks[3];
    const c1x = (m0.x+m1.x)/2, c1y = (m0.y+m1.y)/2;
    const c2x = (m2.x+m3.x)/2, c2y = (m2.y+m3.y)/2;
    const dx = c2x-c1x, dy = c2y-c1y;
    const len = Math.sqrt(dx*dx+dy*dy);
    const totalRaceDist = state.race.totalLegs * len;


    if (state.race.status === 'prestart') {
         UI.leaderboard.classList.add('hidden');
         return;
    }
    UI.leaderboard.classList.remove('hidden');

    // Sort boats
    const sorted = [...state.boats].sort((a, b) => {
        // Scoring helper: 0=Finished, 1=DNF, 2=DNS, 3=Racing
        const getScore = (boat) => {
            if (!boat.raceState.finished) return 3;
            if (boat.raceState.resultStatus === 'DNS') return 2;
            if (boat.raceState.resultStatus === 'DNF') return 1;
            return 0;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        if (scoreA !== scoreB) return scoreA - scoreB;

        if (scoreA === 0) return a.raceState.finishTime - b.raceState.finishTime;

        // 2. Leg (For Racing)
        if (a.raceState.leg !== b.raceState.leg) return b.raceState.leg - a.raceState.leg;

        // 3. Progress within leg (For Racing or DNF/DNS tiebreak)
        const pA = getBoatProgress(a);
        const pB = getBoatProgress(b);
        return pB - pA;
    });

    const leader = sorted[0];
    const leaderProgress = getBoatProgress(leader);

    // Update Header
    if (UI.lbLeg) {
        if (leader.raceState.finished) UI.lbLeg.textContent = "FINISH";
        else UI.lbLeg.textContent = `${Math.max(1, leader.raceState.leg)}/${state.race.totalLegs}`;
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
                    const color = isVeryDark(settings.hullColor) ? settings.spinnakerColor : settings.hullColor;
                    star.setAttribute("fill", color);
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z");
                    star.appendChild(path);
                    iconContainer.appendChild(star);
                } else {
                    // Portrait
                    const img = document.createElement('img');
                    img.src = "assets/images/" + boat.name.toLowerCase() + ".png";
                    img.className = "w-8 h-8 rounded-full border-2 object-cover bg-slate-900";
                    const color = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
                    img.style.borderColor = color;
                    iconContainer.appendChild(img);
                }

                // Name
                const nameDiv = document.createElement('div');
                nameDiv.className = "lb-name text-xs font-bold text-white tracking-wide flex-1 truncate";
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
            const nameDiv = row.querySelector('.lb-name');

            // Apply finished/penalty styling
            let rowClass = "lb-row flex items-center px-3 border-b border-slate-700/50 transition-colors duration-500 ";
            if (boat.raceState.finished) {
                rowClass += "bg-emerald-900/60";
                rankDiv.className = "lb-rank w-4 text-xs font-black italic text-white mr-2";
                distDiv.className = "lb-dist text-[10px] font-mono text-white text-right min-w-[32px]";
            } else if (boat.raceState.leg === 0) {
                rowClass += "bg-gray-900/40 grayscale";
                rankDiv.className = "lb-rank w-4 text-xs font-black italic text-gray-500 mr-2";
                distDiv.className = "lb-dist text-[10px] font-mono text-gray-500 text-right min-w-[32px]";
            } else {
                rowClass += "bg-slate-800/40";
                rankDiv.className = "lb-rank w-4 text-xs font-black italic text-slate-400 mr-2";
                distDiv.className = "lb-dist text-[10px] font-mono text-slate-400 text-right min-w-[32px]";
            }
            row.className = rowClass;

            // Name update for penalty
            let nameText = boat.name;
            if (boat.raceState.penalty) {
                 nameDiv.classList.add("text-red-400");
                 if (boat.isPlayer) nameDiv.classList.remove("text-yellow-300");
            } else {
                 nameDiv.classList.remove("text-red-400");
                 if (boat.isPlayer) nameDiv.classList.add("text-yellow-300");
            }
            nameDiv.textContent = nameText;

            rankDiv.textContent = index + 1;
            if (index === 0) {
                 if (boat.raceState.finished) {
                     if (boat.raceState.resultStatus) distDiv.textContent = boat.raceState.resultStatus;
                     else distDiv.textContent = formatTime(boat.raceState.finishTime);
                 } else {
                     distDiv.textContent = "";
                 }
            } else {
                 if (boat.raceState.resultStatus) {
                     distDiv.textContent = boat.raceState.resultStatus;
                 } else if (leader.raceState.finished) {
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

    // Sayings Checks
    const player = state.boats[0];
    const playerRank = player.lbRank;
    const playerPrevRank = player.prevRank;

    for (const boat of state.boats) {
        if (boat.isPlayer) continue;

        // Moved into First
        if (boat.lbRank === 0 && boat.prevRank !== 0) {
            Sayings.queueQuote(boat, "moved_into_first");
        }

        // Moved into Last
        if (boat.lbRank === state.boats.length - 1 && boat.prevRank !== state.boats.length - 1) {
            Sayings.queueQuote(boat, "moved_into_last");
        }

        // Passing Player (AI was behind, now ahead)
        // Lower rank is better. Behind means rank > playerRank. Ahead means rank < playerRank.
        if (boat.prevRank > playerPrevRank && boat.lbRank < playerRank) {
            Sayings.queueQuote(boat, "they_pass_player");
        }

        // Player Passed AI (AI was ahead, now behind)
        if (boat.prevRank < playerPrevRank && boat.lbRank > playerRank) {
            Sayings.queueQuote(boat, "player_passes_them");
        }
    }
}

export function showResults() {
    if (!UI.resultsOverlay || !UI.resultsList) return;

    const wasHidden = UI.resultsOverlay.classList.contains('hidden');
    UI.resultsOverlay.classList.remove('hidden');
    if (wasHidden) UI.resultsOverlay.scrollTop = 0;
    UI.leaderboard.classList.add('hidden');
    Sound.updateMusic();

    // Sort by finish order (or progress)
    const sorted = [...state.boats].sort((a, b) => {
        // Scoring helper: 0=Finished, 1=DNF, 2=DNS, 3=Racing
        const getScore = (boat) => {
            if (!boat.raceState.finished) return 3;
            if (boat.raceState.resultStatus === 'DNS') return 2;
            if (boat.raceState.resultStatus === 'DNF') return 1;
            return 0;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        if (scoreA !== scoreB) return scoreA - scoreB;

        // Tie-breaking within same category
        if (scoreA === 0) return a.raceState.finishTime - b.raceState.finishTime; // Time asc
        // For DNF/DNS, sort by progress (descending)
        return getBoatProgress(b) - getBoatProgress(a);
    });

    const leader = sorted[0];

    // CSS Grid Layout Class
    const gridClass = "grid grid-cols-[4rem_4rem_1fr_4.5rem_4.5rem_5rem_5rem_5rem_5rem_5rem] gap-4 items-center px-4";

    // Header
    let header = UI.resultsList.querySelector('.res-header');
    if (!header) {
        // Only clear if we are initializing clean
        if (UI.resultsList.children.length === 0 || !UI.resultsList.querySelector('.res-header')) {
             UI.resultsList.innerHTML = '';
        }
        header = document.createElement('div');
        header.className = `${gridClass} py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 res-header`;
        header.innerHTML = `
            <div class="text-center">Position</div>
            <div></div>
            <div>Sailor</div>
            <div class="text-right">Time</div>
            <div class="text-right">Delta</div>
            <div class="text-right">Top Spd</div>
            <div class="text-right">Average</div>
            <div class="text-right">Distance</div>
            <div class="text-center">Penalties</div>
            <div class="text-center text-white">Points</div>
        `;
        UI.resultsList.appendChild(header);
    }

    if (!UI.resultRows) UI.resultRows = {};
    const totalBoats = state.boats.length;

    sorted.forEach((boat, index) => {
        let points = totalBoats - index;
        if (boat.raceState.resultStatus === 'DNS' || boat.raceState.resultStatus === 'DNF') {
            points = 0;
        }

        let row = UI.resultRows[boat.id];
        let isNew = false;

        const hullColor = boat.isPlayer ? settings.hullColor : boat.colors.hull;
        const spinColor = boat.isPlayer ? settings.spinnakerColor : boat.colors.spinnaker;
        const hullLuma = isVeryDark(hullColor) ? 0 : 255; // Placeholder
        const useSpin = hullLuma < 50 || hullLuma > 200; // Actually need proper luma check
        const bgColor = isVeryDark(hullColor) ? spinColor : hullColor; // Helper handles it?

        if (!row) {
            isNew = true;
            row = document.createElement('div');
            row.className = "relative mb-3 h-16 w-full res-row";

            // Background Bar
            const bar = document.createElement('div');
            bar.className = "res-bar absolute inset-0 right-12 overflow-hidden drop-shadow-lg transition-transform hover:scale-[1.01] origin-left";
            bar.style.background = `linear-gradient(to right, transparent 0%, ${bgColor} 50%)`;

            // Gloss & Fade
            const gloss = document.createElement('div');
            gloss.className = "absolute inset-0 bg-gradient-to-b from-white/20 to-black/10 pointer-events-none";
            bar.appendChild(gloss);
            const fade = document.createElement('div');
            fade.className = "absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-r from-transparent to-white/10 mix-blend-overlay";
            bar.appendChild(fade);

            row.appendChild(bar);

            // Line
            const line = document.createElement('div');
            line.className = "absolute bottom-0 left-0 right-[25px] h-[1px] bg-white";
            row.appendChild(line);

            // Content
            const content = document.createElement('div');
            content.className = `relative z-10 ${gridClass} w-full h-full`;

            // Rank Container
            const rankDiv = document.createElement('div');
            rankDiv.className = `res-rank flex justify-center items-center`;
            content.appendChild(rankDiv);

            // Image Container
            const imgDiv = document.createElement('div');
            imgDiv.className = `flex items-center justify-center`;
            const imgBox = document.createElement('div');
            imgBox.className = "w-12 h-12";
            if (boat.isPlayer) {
                const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                star.setAttribute("viewBox", "0 0 24 24");
                star.setAttribute("class", "w-full h-full drop-shadow-md");
                star.setAttribute("fill", "#ffffff");
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z");
                star.appendChild(path);
                imgBox.appendChild(star);
            } else {
                const img = document.createElement('img');
                img.src = "assets/images/" + boat.name.toLowerCase() + ".png";
                img.className = "w-full h-full rounded-md object-cover";
                imgDiv.appendChild(img);
            }
            imgDiv.appendChild(imgBox);
            content.appendChild(imgDiv);

            // Name
            const nameDiv = document.createElement('div');
            nameDiv.className = `res-name font-black text-2xl italic uppercase tracking-tighter truncate text-white drop-shadow-md`;
            nameDiv.textContent = boat.name;
            content.appendChild(nameDiv);

            // Helper for stats
            const createStat = (cls) => {
                const d = document.createElement('div');
                d.className = `${cls} font-sans font-bold text-sm text-white drop-shadow-sm text-right`;
                return d;
            };

            content.appendChild(createStat('res-time'));
            content.appendChild(createStat('res-delta'));
            content.appendChild(createStat('res-top'));
            content.appendChild(createStat('res-avg'));
            content.appendChild(createStat('res-dist'));

            const penDiv = document.createElement('div');
            penDiv.className = `res-pen text-center font-sans font-bold text-sm text-white/30`;
            content.appendChild(penDiv);

            row.appendChild(content);

            // Points Box
            const ptsBox = document.createElement('div');
            ptsBox.className = "absolute right-0 top-0 bottom-0 w-24 bg-white transform -skew-x-12 origin-bottom-right flex items-center justify-center shadow-md z-20 border-l-4 border-white/50 rounded-br-2xl";
            const ptsText = document.createElement('div');
            ptsText.className = "res-points transform skew-x-12 text-slate-900 font-black text-3xl";
            ptsBox.appendChild(ptsText);
            row.appendChild(ptsBox);

            UI.resultRows[boat.id] = row;
        }

        // Update Content
        const bar = row.querySelector('.res-bar');
        if (bar) bar.style.background = `linear-gradient(to right, transparent 0%, ${bgColor} 50%)`;

        // Update Rank
        const rankDiv = row.querySelector('.res-rank');
        if (rankDiv) {
            rankDiv.innerHTML = '';
            if (index <= 2) {
                 const colors = [
                     "text-yellow-900 bg-yellow-400 border-yellow-200",
                     "text-slate-900 bg-slate-300 border-slate-200",
                     "text-amber-900 bg-amber-600 border-amber-400"
                 ];
                 const medal = document.createElement('div');
                 medal.className = `w-10 h-10 rounded-full flex items-center justify-center text-lg font-black border-2 shadow-md ${colors[index]}`;
                 medal.textContent = index + 1;
                 rankDiv.appendChild(medal);
            } else {
                 const txt = document.createElement('div');
                 txt.className = `text-2xl font-black italic text-white/80`;
                 txt.textContent = index + 1;
                 rankDiv.appendChild(txt);
            }
        }

        // Stats
        let finishTime = formatTime(boat.raceState.finishTime);
        if (boat.raceState.resultStatus) {
            finishTime = boat.raceState.resultStatus;
        }

        const delta = (index > 0 && leader.raceState.finished && boat.raceState.finished)
            ? "+" + (boat.raceState.finishTime - leader.raceState.finishTime).toFixed(2)
            : "-";
        const topSpeed = Math.max(...boat.raceState.legTopSpeeds).toFixed(1);

        const duration = boat.raceState.finished ? boat.raceState.finishTime : state.race.timer;
        const totalSpeedSum = boat.raceState.legSpeedSums ? boat.raceState.legSpeedSums.reduce((a, b) => a + b, 0) : 0;
        const avgSpeed = (duration > 0.1 ? (totalSpeedSum / duration) : 0).toFixed(1);

        const totalDist = Math.round(boat.raceState.legDistances.reduce((a, b) => a + b, 0));
        const penalties = boat.raceState.totalPenalties;

        const updateText = (cls, val) => { const el = row.querySelector('.'+cls); if(el) el.textContent = val; return el; };

        const tEl = updateText('res-time', finishTime);
        if (tEl) {
             tEl.classList.remove('text-red-400');
             tEl.classList.add('text-white');
        }

        const dEl = updateText('res-delta', delta);
        if (dEl) dEl.className = `res-delta font-sans font-bold text-sm text-right ${delta==='-' ? 'text-white/30' : 'text-white/70'}`;

        updateText('res-top', topSpeed);
        updateText('res-avg', avgSpeed);
        updateText('res-dist', totalDist);

        const pEl = updateText('res-pen', penalties > 0 ? penalties : "-");
        if (pEl) pEl.className = `res-pen text-center font-sans font-bold text-sm ${penalties > 0 ? 'text-white' : 'text-white/30'}`;

        updateText('res-points', points);

        UI.resultsList.appendChild(row);
    });
}
