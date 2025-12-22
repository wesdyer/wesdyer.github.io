
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.grid');
    const timeElement = document.querySelector('.font-mono.text-3xl.text-white');
    const minesElement = document.querySelector('.font-mono.text-3xl.text-red-400');
    const smileyButton = document.getElementById('smiley-button');
    const cascadeButton = document.getElementById('cascade-button');
    const musicButton = document.getElementById('music-toggle');
    const soundButton = document.getElementById('sound-toggle');
    const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');

    let width = 9;
    let height = 9;
    let bombAmount = 10;
    let squares = [];
    let isGameOver = false;
    let flags = 0;
    let timer;
    let time = 0;

    const difficultySettings = {
        'Easy': { width: 9, height: 9, bombAmount: 10 },
        'Medium': { width: 16, height: 16, bombAmount: 40 },
        'Hard': { width: 30, height: 16, bombAmount: 99 }
    };

    const numberColors = {
        1: 'text-blue-400',
        2: 'text-green-400',
        3: 'text-red-400',
        4: 'text-purple-400',
        5: 'text-orange-400',
        6: 'text-pink-400',
        7: 'text-yellow-400',
        8: 'text-teal-400'
    };

    // Sound System
    let audioCtx;
    let musicGainNode;
    let musicEnabled = false;
    let soundEnabled = true;
    let musicInterval;
    let isPlaying = false;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            musicGainNode = audioCtx.createGain();
            musicGainNode.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function toggleMusic() {
        initAudio();
        musicEnabled = !musicEnabled;
        const icon = musicButton.querySelector('span');

        if (musicEnabled) {
            icon.textContent = 'music_note';
            musicButton.classList.add('bg-indigo-500/20', 'text-indigo-300');
            startMusic();
        } else {
            icon.textContent = 'music_off';
            musicButton.classList.remove('bg-indigo-500/20', 'text-indigo-300');
            stopMusic();
        }
    }

    function toggleSound() {
        initAudio();
        soundEnabled = !soundEnabled;
        const icon = soundButton.querySelector('span');

        if (soundEnabled) {
            icon.textContent = 'volume_up';
            soundButton.classList.add('bg-indigo-500/20', 'text-indigo-300');
        } else {
            icon.textContent = 'volume_off';
            soundButton.classList.remove('bg-indigo-500/20', 'text-indigo-300');
        }
    }

    musicButton.addEventListener('click', toggleMusic);
    soundButton.addEventListener('click', toggleSound);

    function startMusic() {
        if (isPlaying) return;

        // Restore volume
        if (musicGainNode) {
            musicGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
            musicGainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        }

        isPlaying = true;
        playMusicLoop();
        musicInterval = setInterval(playMusicLoop, 4000); // 4 bars * 2 beats/bar * 0.5s/beat = 4s
    }

    function stopMusic() {
        isPlaying = false;
        clearInterval(musicInterval);

        // Mute music immediately
        if (musicGainNode) {
            const now = audioCtx.currentTime;
            musicGainNode.gain.cancelScheduledValues(now);
            musicGainNode.gain.setValueAtTime(musicGainNode.gain.value, now);
            musicGainNode.gain.linearRampToValueAtTime(0, now + 0.1);
        }
    }

    function playMusicLoop() {
        if (!musicEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        const tempo = 120;
        const beatTime = 60 / tempo;

        // Bass Line (Triangle)
        // Simple C-G-A-F progression
        const bassNotes = [
            { freq: 130.81, time: 0, dur: 2 }, // C3
            { freq: 196.00, time: 2, dur: 2 }, // G3
            { freq: 220.00, time: 4, dur: 2 }, // A3
            { freq: 174.61, time: 6, dur: 2 }  // F3
        ];

        bassNotes.forEach(note => {
            playTone(note.freq, now + note.time * beatTime, note.dur * beatTime, 'triangle', 0.15);
        });

        // Melody (Square) - Arpeggios
        // C Major: C E G E
        // G Major: B D G D
        // A Minor: A C E C
        // F Major: F A C A
        const melodyNotes = [
            // Bar 1: C Major
            { freq: 523.25, time: 0 }, { freq: 659.25, time: 0.5 }, { freq: 783.99, time: 1 }, { freq: 659.25, time: 1.5 },
            // Bar 2: G Major (B3 D4 G4 D4)
            { freq: 493.88, time: 2 }, { freq: 587.33, time: 2.5 }, { freq: 783.99, time: 3 }, { freq: 587.33, time: 3.5 },
            // Bar 3: A Minor
            { freq: 440.00, time: 4 }, { freq: 523.25, time: 4.5 }, { freq: 659.25, time: 5 }, { freq: 523.25, time: 5.5 },
            // Bar 4: F Major
            { freq: 349.23, time: 6 }, { freq: 440.00, time: 6.5 }, { freq: 523.25, time: 7 }, { freq: 440.00, time: 7.5 },
        ];

        melodyNotes.forEach(note => {
            playTone(note.freq, now + note.time * beatTime, 0.25 * beatTime, 'square', 0.05);
        });
    }

    function playTone(freq, time, duration, type, vol) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // Connect to master music gain node instead of destination
        osc.connect(gainNode);
        gainNode.connect(musicGainNode);

        osc.type = type;
        osc.frequency.value = freq;

        gainNode.gain.setValueAtTime(vol, time);
        gainNode.gain.linearRampToValueAtTime(0, time + duration); // decay

        osc.start(time);
        osc.stop(time + duration);
    }

    function playSound(type) {
        if (!soundEnabled) return;
        initAudio();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'flag') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'bomb') {
             osc.type = 'sawtooth';
             osc.frequency.setValueAtTime(100, now);
             osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
             gainNode.gain.setValueAtTime(0.2, now);
             gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
             osc.start(now);
             osc.stop(now + 0.5);
        } else if (type === 'win') {
            playNote(523.25, now, 0.1); // C5
            playNote(659.25, now + 0.1, 0.1); // E5
            playNote(783.99, now + 0.2, 0.1); // G5
            playNote(1046.50, now + 0.3, 0.4); // C6
        }
    }

    function playNote(freq, time, duration) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.frequency.value = freq;
        gainNode.gain.setValueAtTime(0.1, time);
        gainNode.gain.linearRampToValueAtTime(0, time + duration);
        osc.start(time);
        osc.stop(time + duration);
    }

    function updateDifficultyUI() {
        difficultyRadios.forEach(radio => {
            const label = radio.parentElement;
            if (radio.checked) {
                label.classList.remove('hover:text-indigo-300', 'text-slate-400', 'font-medium');
                label.classList.add('text-white', 'font-bold', 'bg-gradient-to-r', 'from-indigo-500', 'to-purple-600', 'shadow-md', 'transform', 'hover:scale-105');
            } else {
                label.classList.add('hover:text-indigo-300', 'text-slate-400', 'font-medium');
                label.classList.remove('text-white', 'font-bold', 'bg-gradient-to-r', 'from-indigo-500', 'to-purple-600', 'shadow-md', 'transform', 'hover:scale-105');
            }
        });
    }

    function updateDifficulty(difficulty) {
        const settings = difficultySettings[difficulty];
        width = settings.width;
        height = settings.height;
        bombAmount = settings.bombAmount;
        grid.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
        createBoard();
    }

    function createBoard() {
        isGameOver = false;
        flags = 0;
        time = 0;
        clearInterval(timer);
        timeElement.textContent = '00:00';
        minesElement.textContent = bombAmount.toString().padStart(2, '0');
        smileyButton.querySelector('span').textContent = 'sentiment_satisfied';

        const bombsArray = Array(bombAmount).fill('bomb');
        const emptyArray = Array(width * height - bombAmount).fill('valid');
        const gameArray = emptyArray.concat(bombsArray).sort(() => Math.random() - 0.5);

        grid.innerHTML = '';
        squares = [];

        for (let i = 0; i < width * height; i++) {
            const square = document.createElement('div');
            square.setAttribute('id', i);
            square.classList.add('w-8', 'h-8', 'md:w-12', 'md:h-12', 'cell-covered-gradient', 'rounded-xl', 'cursor-pointer', 'transition-all', 'cell-shadow', 'select-none', 'flex', 'items-center', 'justify-center');
            grid.appendChild(square);
            squares.push(square);

            square.addEventListener('click', function(e) {
                click(square);
            });

            square.oncontextmenu = function(e) {
                e.preventDefault();
                // If this event was triggered by our long press simulation (or right after),
                // we want to avoid double-toggling.
                // However, distinguishing them can be tricky.
                // Simplified strategy: Rely on the timer for mobile long-press flag,
                // and normal right-click for desktop.
                // If 'isLongPress' is true, it means we just handled it via touch.
                if (isLongPress) return;
                addFlag(square);
            }

            // Touch events for mobile
            let touchTimer;
            let isLongPress = false;
            let startX, startY;

            square.addEventListener('touchstart', (e) => {
                isLongPress = false;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;

                touchTimer = setTimeout(() => {
                    isLongPress = true;
                    addFlag(square);
                    if (navigator.vibrate) navigator.vibrate(50);
                }, 500); // 500ms for long press
            }, { passive: false });

            square.addEventListener('touchend', (e) => {
                clearTimeout(touchTimer);
                if (!isLongPress) {
                    // It was a tap
                    click(square);
                }
                e.preventDefault(); // Prevent ghost click/mouse events

                // Reset isLongPress after a short delay to allow contextmenu to fire and be ignored
                setTimeout(() => { isLongPress = false; }, 100);
            });

            square.addEventListener('touchmove', (e) => {
                const currentX = e.touches[0].clientX;
                const currentY = e.touches[0].clientY;
                const diffX = Math.abs(currentX - startX);
                const diffY = Math.abs(currentY - startY);

                // If moved significantly (>10px), cancel long press
                if (diffX > 10 || diffY > 10) {
                    clearTimeout(touchTimer);
                    // We set isLongPress to true (or a new state 'cancelled') to prevent tap action
                    // reusing isLongPress = true effectively prevents the tap in touchend
                    isLongPress = true;
                }
            });
        }

        for (let i = 0; i < squares.length; i++) {
            let total = 0;
            const isLeftEdge = (i % width === 0);
            const isRightEdge = (i % width === width - 1);

            if (gameArray[i] === 'valid') {
                if (i > 0 && !isLeftEdge && gameArray[i - 1] === 'bomb') total++;
                if (i > width - 1 && !isRightEdge && gameArray[i + 1 - width] === 'bomb') total++;
                if (i >= width && gameArray[i - width] === 'bomb') total++;
                if (i >= width + 1 && !isLeftEdge && gameArray[i - 1 - width] === 'bomb') total++;
                if (i < width * height - 1 && !isRightEdge && gameArray[i + 1] === 'bomb') total++;
                if (i < width * height - width && !isLeftEdge && gameArray[i - 1 + width] === 'bomb') total++;
                if (i < width * height - width - 1 && !isRightEdge && gameArray[i + 1 + width] === 'bomb') total++;
                if (i < width * height - width && gameArray[i + width] === 'bomb') total++;
                squares[i].setAttribute('data', total);
            }
             squares[i].setAttribute('data-type', gameArray[i]);
        }
    }

    function startTimer() {
        clearInterval(timer);
        timer = setInterval(() => {
            time++;
            const minutes = Math.floor(time / 60).toString().padStart(2, '0');
            const seconds = (time % 60).toString().padStart(2, '0');
            timeElement.textContent = `${minutes}:${seconds}`;
        }, 1000);
    }

    function reveal(square) {
        if (square.classList.contains('checked')) return;

        square.classList.remove('cell-covered-gradient', 'cell-shadow', 'cursor-pointer');
        square.classList.add('bg-cell-revealed', 'cursor-default', 'checked', 'ring-1', 'ring-white/5');

        let total = square.getAttribute('data');
        if (total != 0) {
            square.textContent = total;
            square.classList.add('font-black', 'text-xl');
            if (numberColors[total]) {
                square.classList.add(numberColors[total]);
            }
        }
    }

    function click(square, isRecursion = false) {
        let currentId = square.getAttribute('id');
        if (isGameOver) return;
        if (square.classList.contains('checked') || square.classList.contains('flag')) return;

        if (time === 0) {
            startTimer();
        }

        if (square.getAttribute('data-type') === 'bomb') {
            if (!isRecursion) playSound('bomb');
            gameOver(square);
        } else {
            if (!isRecursion) playSound('click');
            let total = square.getAttribute('data');
            if (total != 0) {
                reveal(square);
                checkForWin();
                return;
            }
            reveal(square);
            checkSquare(square, currentId);
        }
        checkForWin();
    }

    function addFlag(square) {
        if (isGameOver) return;
        if (square.classList.contains('checked')) return;

        if (!square.classList.contains('flag')) {
            if (flags < bombAmount) {
                playSound('flag');
                square.classList.add('flag');
                square.innerHTML = '<span class="material-symbols-outlined text-yellow-300 text-2xl drop-shadow-md scale-90 group-hover:scale-110 transition-transform fill-current animate-pulse">flag</span>';
                flags++;
                minesElement.textContent = (bombAmount - flags).toString().padStart(2, '0');
                checkForWin();
            }
        } else {
            playSound('flag');
            square.classList.remove('flag');
            square.innerHTML = '';
            flags--;
            minesElement.textContent = (bombAmount - flags).toString().padStart(2, '0');
        }
    }

    function checkSquare(square, currentId) {
        const isLeftEdge = (currentId % width === 0);
        const isRightEdge = (currentId % width === width - 1);

        setTimeout(() => {
            if (currentId > 0 && !isLeftEdge) {
                const newId = squares[parseInt(currentId) - 1].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare, true);
            }
            if (currentId > width - 1 && !isRightEdge) {
                const newId = squares[parseInt(currentId) + 1 - width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare, true);
            }
            if (currentId >= width) {
                const newId = squares[parseInt(currentId - width)].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare, true);
            }
            if (currentId >= width + 1 && !isLeftEdge) {
                const newId = squares[parseInt(currentId) - 1 - width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare, true);
            }
            if (currentId < width * height - 1 && !isRightEdge) {
                const newId = squares[parseInt(currentId) + 1].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare, true);
            }
            if (currentId < width * height - width && !isLeftEdge) {
                const newId = squares[parseInt(currentId) - 1 + width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare, true);
            }
            if (currentId < width * height - width - 1 && !isRightEdge) {
                const newId = squares[parseInt(currentId) + 1 + width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare, true);
            }
            if (currentId < width * height - width) {
                const newId = squares[parseInt(currentId) + width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare, true);
            }
        }, 10);
    }

    function gameOver(square) {
        smileyButton.querySelector('span').textContent = 'sentiment_very_dissatisfied';
        isGameOver = true;
        clearInterval(timer);

        squares.forEach(square => {
            if (square.getAttribute('data-type') === 'bomb') {
                square.innerHTML = '<span class="material-symbols-outlined font-bold drop-shadow-sm" style="font-size: 24px;">bomb</span>';
                square.classList.remove('flag');
                square.classList.add('checked', 'bg-red-500/50');
            }
        });
    }

    function checkForWin() {
        let revealedCount = 0;
        squares.forEach(square => {
            if(square.classList.contains('checked')) {
                revealedCount++;
            }
        });

        if (flags === bombAmount && revealedCount === (width * height - bombAmount)) {
             if (!isGameOver) playSound('win'); // Ensure it plays only once when transitioning to win
             smileyButton.querySelector('span').textContent = 'sentiment_very_satisfied';
             isGameOver = true;
             clearInterval(timer);
        }
    }

    difficultyRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateDifficultyUI();
            updateDifficulty(e.target.nextElementSibling.textContent);
        });
    });

    smileyButton.addEventListener('click', () => {
        const checkedRadio = document.querySelector('input[name="difficulty"]:checked');
        updateDifficulty(checkedRadio.nextElementSibling.textContent);
    });

    cascadeButton.addEventListener('click', () => {
        if (isGameOver) return;

        let bestIndex = -1;
        let maxRevealed = -1;

        // Find all unrevealed 0-cells
        for (let i = 0; i < squares.length; i++) {
            const square = squares[i];
            // Must be valid 0-cell, unrevealed, unflagged
            if (square.getAttribute('data') === '0' &&
                square.getAttribute('data-type') === 'valid' &&
                !square.classList.contains('checked') &&
                !square.classList.contains('flag')) {

                const count = calculateCascadeSize(i);
                if (count > maxRevealed) {
                    maxRevealed = count;
                    bestIndex = i;
                }
            }
        }

        if (bestIndex !== -1) {
            click(squares[bestIndex]);
        } else {
             // Optional: visual feedback if no 0-cells available
             // For now, we do nothing as per request "cascade the largest remaining area"
             // If there is no such area, we might want to just click a random safe cell?
             // But the user said "as if... tapped on a cell with zero bomb neighbors".
             // So if no such cell exists, we do nothing.
        }
    });

    function getNeighbors(i) {
        const neighbors = [];
        const isLeftEdge = (i % width === 0);
        const isRightEdge = (i % width === width - 1);

        // Standard 8-way neighbors checks
        // North
        if (i >= width) neighbors.push(i - width);
        // South
        if (i < width * height - width) neighbors.push(i + width);
        // East
        if (!isRightEdge) neighbors.push(i + 1);
        // West
        if (!isLeftEdge) neighbors.push(i - 1);

        // NE
        if (i >= width && !isRightEdge) neighbors.push(i - width + 1);
        // NW
        if (i >= width && !isLeftEdge) neighbors.push(i - width - 1);
        // SE
        if (i < width * height - width && !isRightEdge) neighbors.push(i + width + 1);
        // SW
        if (i < width * height - width && !isLeftEdge) neighbors.push(i + width - 1);

        return neighbors;
    }

    function calculateCascadeSize(startIndex) {
        const visited = new Set();
        const queue = [startIndex];
        visited.add(startIndex);

        let count = 0;

        // Using BFS to simulate the flood fill
        // The real flood fill reveals 0s and their neighbors.
        // It recursively calls click on 0s.
        // It reveals non-0 neighbors but stops there.

        // So we need to count:
        // 1. All connected 0s in this component.
        // 2. All immediate neighbors of those 0s (which will be numbers).

        // We will process the queue of 0s.
        // For each 0, we count it.
        // We also check its neighbors.
        // If a neighbor is 0 and not visited, add to queue.
        // If a neighbor is not 0 (number), we just count it as revealed (if not already counted).

        // Wait, 'visited' tracks cells we have processed or queued as 0s?
        // Let's use two sets:
        // 'processedZeros': 0s that we have visited in the BFS.
        // 'revealedCells': all cells (0s or numbers) that would be revealed.

        const processedZeros = new Set();
        const revealedCells = new Set();

        const q = [startIndex];
        processedZeros.add(startIndex);
        revealedCells.add(startIndex);

        while(q.length > 0) {
            const curr = q.shift();
            const neighbors = getNeighbors(curr);

            for (const n of neighbors) {
                const neighborSquare = squares[n];
                // If it's flagged or already checked in the real game, we shouldn't count it?
                // The cascade "reveals" them. If they are already revealed, the gain is 0.
                // But the user wants "largest remaining area".
                // So we only count unrevealed, unflagged cells.

                if (neighborSquare.classList.contains('checked') || neighborSquare.classList.contains('flag')) {
                    continue;
                }

                if (!revealedCells.has(n)) {
                    revealedCells.add(n);

                    // If it is a 0-cell, we continue the flood fill
                    if (neighborSquare.getAttribute('data') === '0' && neighborSquare.getAttribute('data-type') === 'valid') {
                         if (!processedZeros.has(n)) {
                             processedZeros.add(n);
                             q.push(n);
                         }
                    }
                }
            }
        }

        return revealedCells.size;
    }

    const isMobile = window.innerWidth < 768;
    const initialDifficulty = isMobile ? 'Easy' : 'Medium';

    // Set initial radio checked state
    difficultyRadios.forEach(radio => {
        if (radio.nextElementSibling.textContent === initialDifficulty) {
            radio.checked = true;
        } else {
            radio.checked = false;
        }
    });

    updateDifficulty(initialDifficulty);
    updateDifficultyUI();
});
