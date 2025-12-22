
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.grid');
    const timeElement = document.querySelector('.font-mono.text-3xl.text-white');
    const minesElement = document.querySelector('.font-mono.text-3xl.text-red-400');
    const smileyButton = document.querySelector('.z-10.size-16.rounded-2xl');
    const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');

    let audioCtx;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('AudioContext not supported');
    }

    function playSound(type) {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }

        const now = audioCtx.currentTime;

        if (type === 'click') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'bomb') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

            osc.start(now);
            osc.stop(now + 0.8);
        } else if (type === 'flag') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);

            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);

            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'win') {
            const notes = [261.63, 329.63, 392.00, 523.25]; // C Major
            notes.forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.type = 'triangle';
                osc.frequency.value = freq;

                const startTime = now + (i * 0.1);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

                osc.start(startTime);
                osc.stop(startTime + 0.4);
            });
        }
    }

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
            square.classList.add('w-10', 'h-10', 'md:w-12', 'md:h-12', 'cell-covered-gradient', 'rounded-xl', 'cursor-pointer', 'transition-all', 'cell-shadow', 'select-none', 'flex', 'items-center', 'justify-center');
            grid.appendChild(square);
            squares.push(square);

            square.addEventListener('click', function(e) {
                click(square);
            });

            square.oncontextmenu = function(e) {
                e.preventDefault();
                addFlag(square);
            }
        }

        for (let i = 0; i < squares.length; i++) {
            let total = 0;
            const isLeftEdge = (i % width === 0);
            const isRightEdge = (i % width === width - 1);

            if (gameArray[i] === 'valid') {
                if (i > 0 && !isLeftEdge && gameArray[i - 1] === 'bomb') total++;
                if (i > width -1 && !isRightEdge && gameArray[i + 1 - width] === 'bomb') total++;
                if (i > width && gameArray[i - width] === 'bomb') total++;
                if (i > width + 1 && !isLeftEdge && gameArray[i - 1 - width] === 'bomb') total++;
                if (i < width * height - 2 && !isRightEdge && gameArray[i + 1] === 'bomb') total++;
                if (i < width * height - width && !isLeftEdge && gameArray[i - 1 + width] === 'bomb') total++;
                if (i < width * height - width - 2 && !isRightEdge && gameArray[i + 1 + width] === 'bomb') total++;
                if (i < width * height - width - 1 && gameArray[i + width] === 'bomb') total++;
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

    function click(square) {
        let currentId = square.getAttribute('id');
        if (isGameOver) return;
        if (square.classList.contains('checked') || square.classList.contains('flag')) return;

        if (time === 0) {
            startTimer();
        }

        if (square.getAttribute('data-type') === 'bomb') {
            gameOver(square);
        } else {
            let total = square.getAttribute('data');
            if (total != 0) {
                reveal(square);
                playSound('click');
                checkForWin();
                return;
            }
            reveal(square);
            playSound('click');
            checkSquare(square, currentId);
        }
        checkForWin();
    }

    function addFlag(square) {
        if (isGameOver) return;
        if (square.classList.contains('checked')) return;

        if (!square.classList.contains('flag')) {
            if (flags < bombAmount) {
                square.classList.add('flag');
                square.innerHTML = '<span class="material-symbols-outlined text-yellow-300 text-2xl drop-shadow-md scale-90 group-hover:scale-110 transition-transform fill-current animate-pulse">flag</span>';
                flags++;
                minesElement.textContent = (bombAmount - flags).toString().padStart(2, '0');
                checkForWin();
                playSound('flag');
            }
        } else {
            square.classList.remove('flag');
            square.innerHTML = '';
            flags--;
            minesElement.textContent = (bombAmount - flags).toString().padStart(2, '0');
            playSound('flag');
        }
    }

    function checkSquare(square, currentId) {
        const isLeftEdge = (currentId % width === 0);
        const isRightEdge = (currentId % width === width - 1);

        setTimeout(() => {
            if (currentId > 0 && !isLeftEdge) {
                const newId = squares[parseInt(currentId) - 1].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare);
            }
            if (currentId > width - 1 && !isRightEdge) {
                const newId = squares[parseInt(currentId) + 1 - width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare);
            }
            if (currentId > width) {
                const newId = squares[parseInt(currentId - width)].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare);
            }
            if (currentId > width + 1 && !isLeftEdge) {
                const newId = squares[parseInt(currentId) - 1 - width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare);
            }
            if (currentId < width * height - 2 && !isRightEdge) {
                const newId = squares[parseInt(currentId) + 1].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare);
            }
            if (currentId < width * height - width && !isLeftEdge) {
                const newId = squares[parseInt(currentId) - 1 + width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare);
            }
            if (currentId < width * height - width - 2 && !isRightEdge) {
                const newId = squares[parseInt(currentId) + 1 + width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare);
            }
            if (currentId < width * height - width - 1) {
                const newId = squares[parseInt(currentId) + width].getAttribute('id');
                const newSquare = document.getElementById(newId);
                click(newSquare);
            }
        }, 10);
    }

    function gameOver(square) {
        playSound('bomb');
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
        let matches = 0;

        for (let i = 0; i < squares.length; i++) {
            if (squares[i].classList.contains('flag') && squares[i].getAttribute('data-type') === 'bomb') {
                matches++;
            }
            if (matches === bombAmount) {
                smileyButton.querySelector('span').textContent = 'sentiment_very_satisfied';
                playSound('win');
                isGameOver = true;
                clearInterval(timer);
            }
        }

        let revealedCount = 0;
        squares.forEach(square => {
            if(square.classList.contains('checked')) {
                revealedCount++;
            }
        });

        if (revealedCount === (width * height - bombAmount)) {
             smileyButton.querySelector('span').textContent = 'sentiment_very_satisfied';
             playSound('win');
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

    updateDifficulty('Medium');
    updateDifficultyUI();
});
