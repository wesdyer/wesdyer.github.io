const grid = document.getElementById('wordle-grid');
const suggestionsList = document.getElementById('suggestions-list');
const wordCount = document.getElementById('word-count');
const hiddenInput = document.getElementById('hidden-input');

const state = {
  currentRow: 0,
  currentCol: 0,
  grid: Array(6).fill(null).map(() => Array(5).fill({ letter: '', color: 'default' })),
};

const colorClasses = {
    default: 'bg-gray-200 border-gray-200 text-charcoal-text',
    yellow: 'bg-wordle-yellow border-wordle-yellow text-white',
    green: 'bg-wordle-green border-wordle-green text-white',
    white: 'bg-white border-border-subtle text-charcoal-text'
  };

function renderGrid() {
  grid.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'grid grid-cols-5 gap-2';
    rowEl.dataset.row = i;
    if (state.grid[i].some(cell => cell.letter)) {
        rowEl.classList.add('filled');
    }
    for (let j = 0; j < 5; j++) {
      const cellData = state.grid[i][j];
      const cell = document.createElement('div');
      const colorClass = cellData.letter ? colorClasses[cellData.color] : colorClasses.white;
      cell.className = `cell aspect-square w-full flex items-center justify-center text-3xl font-bold uppercase border-2 rounded-md transition-colors duration-100 ${colorClass}`;
      if (i === state.currentRow && j === state.currentCol) {
        cell.classList.add('is-active-cell');
      }
      cell.dataset.row = i;
      cell.dataset.col = j;
      cell.textContent = cellData.letter;
      cell.addEventListener('click', () => onCellClick(i, j));
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onCellRightClick(i, j);
      });
      rowEl.appendChild(cell);
    }
    grid.appendChild(rowEl);
  }
}

function onCellRightClick(row, col) {
  if (!state.grid[row][col].letter) return;

  const colors = ['default', 'yellow', 'green'];
  const currentColorIndex = colors.indexOf(state.grid[row][col].color);
  const nextColorIndex = (currentColorIndex + 1) % colors.length;
  state.grid[row][col].color = colors[nextColorIndex];
  renderGrid();
  updateSuggestions();
}

function onCellClick(row, col) {
  state.currentRow = row;
  state.currentCol = col;
  hiddenInput.focus();
  currentInput = state.grid[row].map(cell => cell.letter).join('');

  if (state.grid[row][col].letter) {
    const colors = ['default', 'yellow', 'green'];
    const currentColorIndex = colors.indexOf(state.grid[row][col].color);
    const nextColorIndex = (currentColorIndex + 1) % colors.length;
    state.grid[row][col].color = colors[nextColorIndex];
  }

  renderGrid();
  updateSuggestions();
}

document.addEventListener('keydown', (e) => {
    if (state.currentRow >= 6) return;
    const row = state.grid[state.currentRow];
    const col = state.currentCol;

    if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
        state.grid[state.currentRow][state.currentCol] = { letter: e.key.toUpperCase(), color: 'default' };
        state.currentCol = Math.min(4, state.currentCol + 1);
    } else if (e.key === 'Backspace') {
        if (state.currentCol > 0) {
            if (state.grid[state.currentRow][state.currentCol].letter === '') {
                // Empty cell, delete previous. Cursor moves to that cell.
                const newCol = state.currentCol - 1;
                state.grid[state.currentRow][newCol] = { letter: '', color: 'default' };
                state.currentCol = newCol;
            } else {
                // Letter in cell. Delete it. Move cursor left.
                state.grid[state.currentRow][state.currentCol] = { letter: '', color: 'default' };
                state.currentCol = state.currentCol - 1;
            }
        } else { // currentCol is 0
            // We are at the first cell. Just delete its content.
            state.grid[state.currentRow][state.currentCol] = { letter: '', color: 'default' };
        }
    } else if (e.key === 'Enter') {
        if (row.every(cell => cell.letter)) {
            state.currentRow++;
            state.currentCol = 0;
        }
    } else if (e.key === 'ArrowLeft') {
        state.currentCol = Math.max(0, state.currentCol - 1);
    } else if (e.key === 'ArrowRight') {
        state.currentCol = Math.min(4, state.currentCol + 1);
    } else if (e.key === 'ArrowUp') {
        state.currentRow = Math.max(0, state.currentRow - 1);
    } else if (e.key === 'ArrowDown') {
        state.currentRow = Math.min(5, state.currentRow + 1);
    }

    renderGrid();
    updateSuggestions();
});

function updateSuggestions() {
  const greenLetters = {};
  const yellowLetters = {};
  const grayLetters = new Set();

  let hasUserInput = false;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 5; j++) {
      const cell = state.grid[i][j];
      if (!cell.letter) continue;

      const letter = cell.letter.toLowerCase();
      if (cell.color === 'green') {
        greenLetters[j] = letter;
        hasUserInput = true;
      } else if (cell.color === 'yellow') {
        if (!yellowLetters[letter]) {
          yellowLetters[letter] = new Set();
        }
        yellowLetters[letter].add(j);
        hasUserInput = true;
      } else if (cell.color === 'default') {
        grayLetters.add(letter);
        hasUserInput = true;
      }
    }
  }

  suggestionsList.innerHTML = '';

  let possibleWords = [];
  if (hasUserInput) {
    possibleWords = solutionWords.filter(word => {
      for (const pos in greenLetters) {
        if (word[pos] !== greenLetters[pos]) {
          return false;
        }
      }

    for (const letter in yellowLetters) {
      if (!word.includes(letter)) {
        return false;
      }
      for (const pos of yellowLetters[letter]) {
        if (word[pos] === letter) {
          return false;
        }
      }
    }

    for (const letter of grayLetters) {
      if (word.includes(letter)) {
        let countInWord = 0;
        for(let i=0; i<word.length; i++) {
            if(word[i] === letter) countInWord++;
        }
        let countInGreen = 0;
        for(const pos in greenLetters) {
            if(greenLetters[pos] === letter) countInGreen++;
        }
        let countInYellow = 0;
        if(yellowLetters[letter]) {
            countInYellow = yellowLetters[letter].size;
        }
        if(countInWord > countInGreen + countInYellow) return false;
      }
    }
    return true;
    });
  } else {
    possibleWords = solutionWords;
  }

  wordCount.textContent = possibleWords.length;

  const bestGuesses = calculateBestGuesses(possibleWords);
  bestGuesses.forEach(word => {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between bg-white p-3 rounded-lg border border-border-subtle shadow-xs cursor-pointer hover:bg-gray-100';
      li.innerHTML = `<span class="text-lg font-bold tracking-wide uppercase text-charcoal-text">${word.toUpperCase()}</span>`;
      li.addEventListener('click', () => onSuggestionClick(word));
      suggestionsList.appendChild(li);
  });
}

function onSuggestionClick(word) {
    if (state.currentRow >= 6) return;

    const letters = word.toUpperCase().split('');
    for (let i = 0; i < 5; i++) {
        state.grid[state.currentRow][i] = { letter: letters[i], color: 'default' };
    }

    state.currentRow++;
    state.currentCol = 0;

    renderGrid();
}

function calculateBestGuesses(possibleWords) {
  const letterFrequency = {};
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(letter => {
    letterFrequency[letter] = 0;
  });

  possibleWords.forEach(word => {
    for (const letter of word) {
      letterFrequency[letter]++;
    }
  });

  const wordScores = {};
  const wordsToScore = possibleWords.length > 0 ? possibleWords : words;

  wordsToScore.forEach(word => {
    const uniqueLetters = new Set(word.split(''));
    let score = 0;
    uniqueLetters.forEach(letter => {
      score += letterFrequency[letter];
    });
    wordScores[word] = score;
  });

  const sortedWords = Object.keys(wordScores).sort((a, b) => wordScores[b] - wordScores[a]);
  return sortedWords.slice(0, 10);
}

renderGrid();
updateSuggestions();