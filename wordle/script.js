const grid = document.getElementById('wordle-grid');
const suggestionsList = document.getElementById('suggestions-list');
const wordCount = document.getElementById('word-count');
const wordPlural = document.getElementById('word-plural');
const hiddenInput = document.getElementById('hidden-input');
const clearButton = document.getElementById('clear-button');

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

  const hasText = state.grid.some(row => row.some(cell => cell.letter));
    if (hasText) {
        clearButton.classList.remove('hidden');
    } else {
        clearButton.classList.add('hidden');
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
  wordPlural.textContent = possibleWords.length === 1 ? ' possible word' : ' possible words';

  if (hasUserInput && possibleWords.length === 0) {
    return;
  }

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
    const targetRow = state.grid.findIndex(row => !row.some(cell => cell.letter));

    if (targetRow === -1) return;

    const letters = word.toUpperCase().split('');
    for (let i = 0; i < 5; i++) {
        state.grid[targetRow][i] = { letter: letters[i], color: 'default' };
    }

    const nextEmptyRow = state.grid.findIndex(row => !row.some(cell => cell.letter));

    state.currentRow = nextEmptyRow !== -1 ? nextEmptyRow : 6;
    state.currentCol = 0;

    renderGrid();
    updateSuggestions();
}

function calculateBestGuesses(possibleWords) {
  if (possibleWords.length === 1) return possibleWords;
  if (possibleWords.length === 2) return possibleWords;

  // If the search space is small enough, we can afford a more expensive check.
  // However, checking ALL 12k words against ~500 targets is ~6M ops, which can freeze the UI.
  // Instead, we use a hybrid approach:
  // 1. Always check the top heuristic candidates (e.g. 100).
  // 2. Always check the possible words themselves (because winning is good).
  // This keeps the complexity to roughly O(N_possible * (N_possible + K_candidates)), which is fast.

  // Explicitly add known good openers to candidates so they are evaluated (and skipped if already used)
  const openers = ['salet', 'trace', 'crate', 'slate', 'reast'];

  const letterFreq = {};
  const total = possibleWords.length;
  possibleWords.forEach(w => {
    const unique = new Set(w.split(''));
    unique.forEach(l => {
      letterFreq[l] = (letterFreq[l] || 0) + 1;
    });
  });

  const candidateScores = words.map(word => {
    let score = 0;
    const unique = new Set(word.split(''));
    unique.forEach(l => {
      const count = letterFreq[l] || 0;
      const p = count / total;
      // Prioritize letters that are present in ~50% of words (maximize variance)
      if (p > 0 && p < 1) {
        score += p * (1 - p);
      }
    });
    return { word, score };
  });

  candidateScores.sort((a, b) => b.score - a.score);
  // Select top K candidates from the full dictionary based on heuristic
  // K can be higher when N is small, but 100 is generally sufficient for good "helper" words.
  const TOP_K = 100;
  let candidates = candidateScores.slice(0, TOP_K).map(c => c.word);

  // Always include ALL possible words if N is small, or top subset if N is large.
  // If N <= 500, we include all possible words as candidates.
  // If N > 500, we include top 20 possible words.
  let possibleCandidates = [];
  if (possibleWords.length <= 500) {
      possibleCandidates = possibleWords;
  } else {
      possibleCandidates = possibleWords.map(word => {
        let score = 0;
        const unique = new Set(word.split(''));
        unique.forEach(l => {
          const count = letterFreq[l] || 0;
          const p = count / total;
          if (p > 0 && p < 1) score += p * (1 - p);
        });
        return { word, score };
      }).sort((a, b) => b.score - a.score).slice(0, 20).map(c => c.word);
  }

  candidates = [...new Set([...openers, ...candidates, ...possibleCandidates])];

  const bestGuesses = candidates.map(guess => {
    const groups = {};
    let maxGroupSize = 0;

    for (const target of possibleWords) {
      const result = Array(5).fill('gray');
      const targetArr = target.split('');
      const guessArr = guess.split('');
      const targetCounts = {};

      // First pass: Green
      // First pass: Green
      // Note: targetCounts is populated here for non-green letters.
      for (let i = 0; i < 5; i++) {
        if (targetArr[i] === guessArr[i]) {
          result[i] = 'green';
          targetArr[i] = null;
          guessArr[i] = null;
        } else {
          const letter = targetArr[i];
          targetCounts[letter] = (targetCounts[letter] || 0) + 1;
        }
      }

      // Second pass: Yellow
      for (let i = 0; i < 5; i++) {
        if (result[i] !== 'green') {
          const letter = guessArr[i];
          if (letter && targetCounts[letter]) {
            result[i] = 'yellow';
            targetCounts[letter]--;
          }
        }
      }
      const fb = result.map(c => c === 'green' ? 'G' : (c === 'yellow' ? 'Y' : 'X')).join('');
      groups[fb] = (groups[fb] || 0) + 1;
      if (groups[fb] > maxGroupSize) maxGroupSize = groups[fb];
    }

    let sumSq = 0;
    for (const key in groups) {
      const size = groups[key];
      sumSq += size * size;
    }

    const isPossible = possibleWords.includes(guess);
    return { word: guess, sumSq, maxGroupSize, isPossible };
  });

  bestGuesses.sort((a, b) => {
    // Primary: Minimize Expected Group Size (SumSq) - equivalent to maximizing Entropy
    if (a.sumSq !== b.sumSq) return a.sumSq - b.sumSq;

    // Secondary: If SumSq is equal (or very close), prefer minimizing the Worst Case (Max Group Size)
    if (a.maxGroupSize !== b.maxGroupSize) return a.maxGroupSize - b.maxGroupSize;

    // Tertiary: Prefer words that are possible solutions
    if (a.isPossible !== b.isPossible) return a.isPossible ? -1 : 1;

    return 0;
  });

  // If no guesses have been made yet (possibleWords is still the full list),
  // force 'salet' to be the top suggestion.
  if (possibleWords.length === solutionWords.length) {
    const saletIndex = bestGuesses.findIndex(bg => bg.word === 'salet');
    if (saletIndex > -1) {
      const salet = bestGuesses.splice(saletIndex, 1)[0];
      bestGuesses.unshift(salet);
    }
  }

  return bestGuesses.map(bg => bg.word).slice(0, 10);
}

function clearGrid() {
    state.currentRow = 0;
    state.currentCol = 0;
    state.grid = Array(6).fill(null).map(() => Array(5).fill({ letter: '', color: 'default' }));
    renderGrid();
    updateSuggestions();
}

clearButton.addEventListener('click', clearGrid);

renderGrid();
updateSuggestions();
