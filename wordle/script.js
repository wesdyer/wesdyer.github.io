
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('grid');
    const keyboardContainer = document.getElementById('keyboard');

    let state = {
        secretWord: '',
        grid: Array(6).fill().map(() => Array(5).fill({ letter: '', color: '' })),
        currentRow: 0,
        currentCol: 0,
        gameStatus: 'playing', // 'playing', 'won', 'lost'
        keyboardState: {},
        difficulty: 'Medium' // Easy, Medium, Hard
    };

    function init(newGame = false) {
        if (medianFrequency === 0) {
            calculateMedianFrequency();
        }
        const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
        difficultyRadios.forEach(radio => {
            if (radio.checked) {
                state.difficulty = radio.value;
            }
        });

        if (newGame || !state.secretWord) {
            state.secretWord = solutionWords[Math.floor(Math.random() * solutionWords.length)];
            state.grid = Array(6).fill().map(() => Array(5).fill({ letter: '', color: '' }));
            state.currentRow = 0;
            state.currentCol = 0;
            state.gameStatus = 'playing';
            state.keyboardState = {};
            document.getElementById('new-game-btn')?.remove();
        }

        updateGrid();
        updateKeyboard();
        console.log("Secret word:", state.secretWord); // For debugging
    }

    function updateGrid() {
        for (let i = 0; i < 6; i++) {
            const row = grid.children[i];
            for (let j = 0; j < 5; j++) {
                const cell = row.children[j];
                const tile = state.grid[i][j];
                cell.textContent = tile.letter;

                // Reset classes
                cell.className = 'flex items-center justify-center border-2 text-3xl font-bold uppercase select-none rounded-sm';

                if (tile.color) {
                    if (i === state.currentRow && state.gameStatus === 'playing') {
                        cell.classList.add('border-border-active');
                        setTimeout(() => {
                            cell.classList.add('animate-flip');
                            setTimeout(() => {
                                cell.classList.remove('border-border-active');
                                cell.classList.add(`bg-${tile.color}`, 'text-white', 'border-transparent');
                            }, 300);
                        }, j * 200);
                    } else {
                        cell.classList.add(`bg-${tile.color}`, 'text-white', 'border-transparent');
                    }
                } else if (tile.letter) {
                    cell.classList.add('border-border-active');
                } else {
                    cell.classList.add('border-border-default');
                }
            }
        }
    }

    function updateKeyboard() {
        for (const keyBtn of keyboardContainer.querySelectorAll('button')) {
            const key = keyBtn.dataset.key.toLowerCase();
            if (state.keyboardState[key]) {
                keyBtn.classList.remove('bg-key-bg', 'hover:bg-neutral-300', 'active:bg-neutral-400', 'text-key-text');
                keyBtn.classList.add('text-white', `bg-${state.keyboardState[key]}`);
            } else {
                keyBtn.classList.remove('text-white', 'bg-correct', 'bg-present', 'bg-absent');
                keyBtn.classList.add('bg-key-bg', 'hover:bg-neutral-300', 'active:bg-neutral-400', 'text-key-text');
            }
        }
    }

    function handleKeyPress(key) {
        if (state.gameStatus !== 'playing') return;

        if (key.toLowerCase() === 'backspace') {
            if (state.currentCol > 0) {
                state.currentCol--;
                state.grid[state.currentRow][state.currentCol] = { letter: '', color: '' };
            }
        } else if (key.toLowerCase() === 'enter') {
            if (state.currentCol === 5) {
                submitGuess();
                return;
            }
        } else if (state.currentCol < 5 && /^[a-zA-Z]$/.test(key)) {
            state.grid[state.currentRow][state.currentCol] = { letter: key.toUpperCase(), color: '' };
            state.currentCol++;
        }
        updateGrid();
    }

    function submitGuess() {
        const guess = state.grid[state.currentRow].map(tile => tile.letter).join('').toLowerCase();

        if (!words.includes(guess)) {
            // Add a shake animation for invalid words
            const row = grid.children[state.currentRow];
            row.classList.add('animate-shake');
            setTimeout(() => {
                row.classList.remove('animate-shake');
            }, 500);
            return;
        }

        const secretWordLetters = state.secretWord.split('');
        const guessLetters = guess.split('');
        const feedback = Array(5).fill('');

        // First pass for correct letters
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === secretWordLetters[i]) {
                feedback[i] = 'correct';
                secretWordLetters[i] = null; // Mark as used
            }
        }

        // Second pass for present letters
        for (let i = 0; i < 5; i++) {
            if (feedback[i] === '') {
                const letterIndex = secretWordLetters.indexOf(guessLetters[i]);
                if (letterIndex !== -1) {
                    feedback[i] = 'present';
                    secretWordLetters[letterIndex] = null; // Mark as used
                } else {
                    feedback[i] = 'absent';
                }
            }
        }

        // Update grid and keyboard state
        for (let i = 0; i < 5; i++) {
            state.grid[state.currentRow][i].color = feedback[i];
            const letter = guessLetters[i];
            const currentStatus = state.keyboardState[letter];
            const newStatus = feedback[i];

            if (!currentStatus ||
                (currentStatus === 'absent' && (newStatus === 'present' || newStatus === 'correct')) ||
                (currentStatus === 'present' && newStatus === 'correct')) {
                state.keyboardState[letter] = newStatus;
            }
        }

        updateGrid();
        updateKeyboard();

        if (guess === state.secretWord) {
            state.gameStatus = 'won';
            updateStats(true);
            showNewGameButton();
        } else if (state.currentRow === 5) {
            state.gameStatus = 'lost';
            updateStats(false);
            showNewGameButton();
        } else {
            state.currentRow++;
            state.currentCol = 0;
            if (state.difficulty !== 'Medium') {
                updateSecretWord();
            }
        }
    }

    function updateStats(won) {
        const stats = JSON.parse(localStorage.getItem('wordleStats')) || {};
        const difficultyStats = stats[state.difficulty] || { gamesPlayed: 0, wins: 0, guessDistribution: Array(6).fill(0) };

        difficultyStats.gamesPlayed++;
        if (won) {
            difficultyStats.wins++;
            difficultyStats.guessDistribution[state.currentRow]++;
        }

        stats[state.difficulty] = difficultyStats;
        localStorage.setItem('wordleStats', JSON.stringify(stats));
    }

    function showNewGameButton() {
        const keyboard = document.getElementById('keyboard');
        const newGameBtn = document.createElement('button');
        newGameBtn.id = 'new-game-btn';
        newGameBtn.textContent = 'New Game';
        newGameBtn.className = 'h-14 w-full rounded bg-correct text-white text-lg font-bold flex items-center justify-center transition-colors uppercase';
        newGameBtn.addEventListener('click', () => init(true));
        keyboard.appendChild(newGameBtn);
    }

    let medianFrequency = 0;
    function calculateMedianFrequency() {
        const frequencies = Object.values(wordFrequencies).filter(f => f > 0);
        frequencies.sort((a, b) => a - b);
        const mid = Math.floor(frequencies.length / 2);
        medianFrequency = frequencies.length % 2 !== 0 ? frequencies[mid] : (frequencies[mid - 1] + frequencies[mid]) / 2;
    }

    function updateSecretWord() {
        const consistentWords = solutionWords.filter(word => {
            for (let i = 0; i < state.currentRow; i++) {
                const guess = state.grid[i].map(t => t.letter).join('').toLowerCase();
                const feedback = state.grid[i].map(t => t.color);

                // Check consistency
                for (let j = 0; j < 5; j++) {
                    const letter = guess[j];
                    if (feedback[j] === 'correct' && word[j] !== letter) return false;
                    if (feedback[j] === 'present' && (!word.includes(letter) || word[j] === letter)) return false;
                    if (feedback[j] === 'absent' && word.includes(letter) && ![...guess].some((l, idx) => l === letter && (state.grid[i][idx].color === 'correct' || state.grid[i][idx].color === 'present'))) return false;
                }
            }
            return true;
        });

        if (consistentWords.length > 0) {
            if (state.difficulty === 'Easy') {
                state.secretWord = consistentWords.reduce((a, b) => (wordFrequencies[a] || medianFrequency) > (wordFrequencies[b] || medianFrequency) ? a : b);
            } else { // Hard
                state.secretWord = consistentWords.reduce((a, b) => (wordFrequencies[a] || medianFrequency) < (wordFrequencies[b] || medianFrequency) ? a : b);
            }
            console.log("New secret word:", state.secretWord); // For debugging
        }
    }


    function drawGrid(container) {
        container.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-5 gap-1.5';
            for (let j = 0; j < 5; j++) {
                const cell = document.createElement('div');
                cell.className = 'flex items-center justify-center border-2 border-border-default bg-transparent rounded-sm text-3xl font-bold uppercase select-none';
                row.appendChild(cell);
            }
            container.appendChild(row);
        }
    }

    function drawKeyboard(container) {
        container.innerHTML = '';
        const keys = [
            'QWERTYUIOP',
            'ASDFGHJKL',
            'ENTER-ZXCVBNM-BACKSPACE',
        ];

        keys.forEach((row, i) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'flex gap-1.5 justify-center';
            if (i === 1) {
                rowDiv.classList.add('px-4');
            }

            row.split('-').forEach(keyGroup => {
                if (keyGroup === 'ENTER') {
                    const enterBtn = document.createElement('button');
                    enterBtn.className = 'h-14 w-[15%] rounded bg-key-bg hover:bg-neutral-300 active:bg-neutral-400 text-key-text text-[12px] font-bold flex items-center justify-center transition-colors uppercase';
                    enterBtn.textContent = 'Enter';
                    enterBtn.dataset.key = 'Enter';
                    rowDiv.appendChild(enterBtn);
                } else if (keyGroup === 'BACKSPACE') {
                    const backspaceBtn = document.createElement('button');
                    backspaceBtn.className = 'h-14 w-[15%] rounded bg-key-bg hover:bg-neutral-300 active:bg-neutral-400 text-key-text text-sm font-bold flex items-center justify-center transition-colors';
                    const span = document.createElement('span');
                    span.className = 'material-symbols-outlined text-[20px]';
                    span.textContent = 'backspace';
                    backspaceBtn.dataset.key = 'Backspace';
                    backspaceBtn.setAttribute('aria-label', 'Backspace');
                    backspaceBtn.appendChild(span);
                    rowDiv.appendChild(backspaceBtn);
                } else {
                    keyGroup.split('').forEach(key => {
                        const keyBtn = document.createElement('button');
                        keyBtn.className = 'h-14 flex-1 rounded bg-key-bg hover:bg-neutral-300 active:bg-neutral-400 text-key-text text-[13px] font-bold flex items-center justify-center transition-colors';
                        keyBtn.textContent = key;
                        keyBtn.dataset.key = key;
                        rowDiv.appendChild(keyBtn);
                    });
                }
            });
            container.appendChild(rowDiv);
        });
    }

    drawGrid(grid);
    drawKeyboard(keyboardContainer);

    keyboardContainer.addEventListener('click', (e) => {
        const key = e.target.closest('button')?.dataset.key;
        if (key) {
            handleKeyPress(key);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        handleKeyPress(e.key);
    });

    const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
    difficultyRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            init(true);
        });
    });

    const statsBtn = document.querySelector('button .material-symbols-outlined');
    const statsModal = document.getElementById('stats-modal');
    const closeStatsBtn = document.getElementById('close-stats');
    const statsContent = document.getElementById('stats-content');

    statsBtn.parentElement.addEventListener('click', () => {
        statsModal.classList.remove('hidden');
        displayStats();
    });

    closeStatsBtn.addEventListener('click', () => {
        statsModal.classList.add('hidden');
    });

    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) {
            statsModal.classList.add('hidden');
        }
    });

    function displayStats() {
        const stats = JSON.parse(localStorage.getItem('wordleStats')) || {};
        statsContent.innerHTML = '';

        for (const difficulty of ['Easy', 'Medium', 'Hard']) {
            const difficultyStats = stats[difficulty] || { gamesPlayed: 0, wins: 0, guessDistribution: Array(6).fill(0) };
            const winPercentage = difficultyStats.gamesPlayed > 0 ? Math.round((difficultyStats.wins / difficultyStats.gamesPlayed) * 100) : 0;

            const statsHTML = `
                <div class="mb-4">
                    <h3 class="text-xl font-bold mb-2">${difficulty}</h3>
                    <div class="flex justify-around text-center">
                        <div>
                            <div class="text-3xl font-bold">${difficultyStats.gamesPlayed}</div>
                            <div class="text-sm text-gray-500">Played</div>
                        </div>
                        <div>
                            <div class="text-3xl font-bold">${winPercentage}</div>
                            <div class="text-sm text-gray-500">Win %</div>
                        </div>
                    </div>
                    <div class="mt-4">
                        <h4 class="font-bold mb-2">Guess Distribution</h4>
                        <div class="flex flex-col gap-1">
                            ${difficultyStats.guessDistribution.map((count, i) => {
                                const maxCount = Math.max(...difficultyStats.guessDistribution);
                                const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                                return `
                                <div class="flex items-center">
                                    <div class="w-4">${i + 1}</div>
                                    <div class="bg-gray-200 h-5" style="width: ${width}%">
                                        <span class="ml-2 text-sm font-bold">${count}</span>
                                    </div>
                                </div>
                            `}).join('')}
                        </div>
                    </div>
                </div>
            `;
            statsContent.innerHTML += statsHTML;
        }
    }

    function saveState() {
        localStorage.setItem('wordleState', JSON.stringify(state));
    }

    function loadState() {
        const savedState = localStorage.getItem('wordleState');
        if (savedState) {
            const loadedState = JSON.parse(savedState);
            // Don't load a finished game
            if (loadedState.gameStatus === 'playing') {
                state = loadedState;
            }
        }
    }

    window.addEventListener('beforeunload', saveState);

    loadState();
    init(state.gameStatus !== 'playing');
});
