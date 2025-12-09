const fs = require('fs');
const path = require('path');

// 1. Load Word Lists
const wordsFileContent = fs.readFileSync(path.join(__dirname, 'words.js'), 'utf8');

// Simple regex parse for the arrays in words.js
const solutionWordsMatch = wordsFileContent.match(/const solutionWords = (\[.*?\]);/s);
const wordsMatch = wordsFileContent.match(/const words = (\[.*?\]);/s);

if (!solutionWordsMatch || !wordsMatch) {
    console.error("Could not parse words.js");
    process.exit(1);
}

const solutionWords = JSON.parse(solutionWordsMatch[1]);
const words = JSON.parse(wordsMatch[1]); // This global 'words' is needed by calculateBestGuesses

// 2. Load Algorithm from script.js
const scriptFileContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

// Extract calculateBestGuesses function
const startSearch = 'function calculateBestGuesses(possibleWords) {';
const funcStart = scriptFileContent.indexOf(startSearch);
if (funcStart === -1) {
    console.error("Could not find calculateBestGuesses in script.js");
    process.exit(1);
}

let openBraces = 0;
let foundStartBrace = false;
let funcEnd = -1;
for (let i = funcStart; i < scriptFileContent.length; i++) {
    if (scriptFileContent[i] === '{') {
        openBraces++;
        foundStartBrace = true;
    }
    if (scriptFileContent[i] === '}') {
        openBraces--;
    }

    if (foundStartBrace && openBraces === 0) {
        funcEnd = i + 1;
        break;
    }
}

if (funcEnd === -1) {
    console.error("Could not extract calculateBestGuesses function block");
    process.exit(1);
}

const calculateBestGuessesSource = scriptFileContent.substring(funcStart, funcEnd);

// console.log("Extracted source length:", calculateBestGuessesSource.length);

// Evaluate the function source to define it in this scope
try {
    eval(calculateBestGuessesSource);
} catch (e) {
    console.error("Eval failed:", e);
    process.exit(1);
}


// 3. Helper Functions for Simulation
function getFeedback(target, guess) {
    const result = Array(5).fill('gray');
    const targetArr = target.split('');
    const guessArr = guess.split('');
    const targetCounts = {};

    // First pass: Green
    for (let i=0; i<5; i++) {
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
    for (let i=0; i<5; i++) {
        if (result[i] !== 'green') {
             const letter = guessArr[i];
             if (letter && targetCounts[letter]) {
                 result[i] = 'yellow';
                 targetCounts[letter]--;
             }
        }
    }
    return result;
}

function filterPossibleWords(possibleWords, guess, feedback) {
   return possibleWords.filter(word => {
       for (let i=0; i<5; i++) {
           if (feedback[i] === 'green' && word[i] !== guess[i]) return false;
           if (feedback[i] !== 'green' && word[i] === guess[i]) return false;
       }

       const guessCounts = {};
       for (let i=0; i<5; i++) {
           const letter = guess[i];
           if (!guessCounts[letter]) guessCounts[letter] = { green: 0, yellow: 0, gray: 0 };
           guessCounts[letter][feedback[i]]++;
       }

       for (const letter in guessCounts) {
           const counts = guessCounts[letter];
           const totalInWord = (word.match(new RegExp(letter, 'g')) || []).length;

           const minRequired = counts.green + counts.yellow;
           if (totalInWord < minRequired) return false;

           if (counts.gray > 0) {
               if (totalInWord !== minRequired) return false;
           }
       }
       return true;
   });
}

// 4. Run Simulation
function runSimulation() {
    console.log(`Starting Simulation with ${solutionWords.length} words...`);

    const guessCounts = {};
    let totalGuesses = 0;
    let maxGuesses = 0;

    const initialPossibleWords = [...solutionWords];

    console.log("Calculating first guess...");
    const firstGuess = calculateBestGuesses(initialPossibleWords)[0];
    console.log(`First guess: ${firstGuess}`);

    for (let i = 0; i < solutionWords.length; i++) {
        const target = solutionWords[i];
        let currentPossibleWords = [...solutionWords];
        let guesses = 0;
        let won = false;

        let guess = firstGuess;

        while (!won) {
            guesses++;
            if (guess === target) {
                won = true;
                break;
            }

            const feedback = getFeedback(target, guess);
            currentPossibleWords = filterPossibleWords(currentPossibleWords, guess, feedback);

            if (currentPossibleWords.length === 0) {
                console.error(`Error: No possible words left for target ${target}`);
                break;
            }

            const suggestions = calculateBestGuesses(currentPossibleWords);
            guess = suggestions[0];

            if (!guess) {
                 console.error(`Error: No suggestions for target ${target}`);
                 break;
            }
        }

        guessCounts[target] = guesses;
        totalGuesses += guesses;
        if (guesses > maxGuesses) maxGuesses = guesses;

        if (i % 100 === 0) {
             process.stdout.write(`\rProgress: ${i}/${solutionWords.length}`);
        }
    }

    const mean = totalGuesses / solutionWords.length;

    const counts = {};
    Object.values(guessCounts).forEach(c => counts[c] = (counts[c] || 0) + 1);
    let mode = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

    console.log('\nResults:');
    console.log(`Mean: ${mean.toFixed(4)}`);
    console.log(`Mode: ${mode}`);
    console.log(`Max: ${maxGuesses}`);
    console.log('Distribution:', JSON.stringify(counts));
}

runSimulation();
