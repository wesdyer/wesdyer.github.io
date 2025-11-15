const grid = document.getElementById('wordle-grid');
const suggestionsList = document.getElementById('suggestions-list');
const wordCount = document.getElementById('word-count');

const state = {
  currentRow: 0,
  grid: Array(6).fill(null).map(() => Array(5).fill({ letter: '', color: 'default' })),
};

const colorClasses = {
    default: 'bg-white border-border-subtle text-charcoal-text',
    yellow: 'bg-wordle-yellow border-wordle-yellow text-white',
    green: 'bg-wordle-green border-wordle-green text-white',
    gray: 'bg-wordle-gray border-wordle-gray text-white'
  };

function renderGrid() {
  grid.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'grid grid-cols-5 gap-2';
    rowEl.dataset.row = i;
    for (let j = 0; j < 5; j++) {
      const cellData = state.grid[i][j];
      const cell = document.createElement('div');
      cell.className = `cell aspect-square w-full flex items-center justify-center text-3xl font-bold uppercase border-2 rounded-md transition-colors duration-100 ${colorClasses[cellData.color]}`;
      cell.dataset.row = i;
      cell.dataset.col = j;
      cell.textContent = cellData.letter;
      cell.addEventListener('click', () => onCellClick(i, j));
      rowEl.appendChild(cell);
    }
    grid.appendChild(rowEl);
  }
}

function onCellClick(row, col) {
  state.currentRow = row;
  currentInput = state.grid[row].map(c => c.letter).join('');

  if (!state.grid[row][col].letter) {
    renderGrid();
    return;
  }

  const colors = ['gray', 'yellow', 'green'];
  const currentColor = state.grid[row][col].color;
  const currentColorIndex = colors.indexOf(currentColor);
  const nextColorIndex = (currentColorIndex + 1) % colors.length;
  state.grid[row][col].color = colors[nextColorIndex];

  renderGrid();
  updateSuggestions();
}

let currentInput = '';
document.addEventListener('keydown', (e) => {
    if (state.currentRow >= 6) return;

    if (e.key === 'Enter') {
        if (currentInput.length === 5) {
            if (state.currentRow < 5) {
                state.currentRow++;
            }
            currentInput = '';
            renderGrid();
            updateSuggestions();
        }
    } else if (e.key === 'Backspace') {
        currentInput = currentInput.slice(0, -1);
    } else if (currentInput.length < 5 && e.key.match(/^[a-zA-Z]$/)) {
        currentInput += e.key.toUpperCase();
    }

    for (let i = 0; i < 5; i++) {
        const letter = currentInput[i] || '';
        const color = letter ? 'gray' : 'default';
        state.grid[state.currentRow][i] = { letter, color };
    }
    renderGrid();
});

function getBestGuesses(possibleWords) {
    if (possibleWords.length <= 2) {
      return possibleWords;
    }

    const letterFrequencies = {};
    for (const word of possibleWords) {
      for (const letter of new Set(word)) {
        letterFrequencies[letter] = (letterFrequencies[letter] || 0) + 1;
      }
    }

    let bestGuesses = [];
    let maxScore = -1;

    for (const word of words) {
      let score = 0;
      for (const letter of new Set(word)) {
        score += letterFrequencies[letter] || 0;
      }
      if (score > maxScore) {
        maxScore = score;
        bestGuesses = [word];
      } else if (score === maxScore) {
        bestGuesses.push(word);
      }
    }

    return bestGuesses;
  }


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
      } else if (cell.color === 'gray') {
        grayLetters.add(letter);
        hasUserInput = true;
      }
    }
  }

  suggestionsList.innerHTML = '';

  const filteredWords = solutionWords.filter(word => {
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

  wordCount.textContent = filteredWords.length;

  const bestGuesses = getBestGuesses(filteredWords);

  bestGuesses.slice(0,10).forEach(word => {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between bg-white p-3 rounded-lg border border-border-subtle shadow-xs';
      li.innerHTML = `<span class="text-lg font-bold tracking-wide uppercase text-charcoal-text">${word.toUpperCase()}</span>`;
      suggestionsList.appendChild(li);
  });
}

renderGrid();
updateSuggestions();