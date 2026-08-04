
const assert = require('assert');
const { modeContinuous, modeDiscrete, calculateStats } = require('./run_eval.js');

console.log("Running Unit Tests...");

// Test modeContinuous
console.log("Testing modeContinuous...");
// Case 1: Simple values
const timeData = [1, 2, 3, 6, 7, 7.5, 12, 14, 25];
// Bins (size 5):
// 0-5: 1, 2, 3 (3)
// 5-10: 6, 7, 7.5 (3)
// 10-15: 12, 14 (2)
// 20-25: -
// 25-30: 25 (1)
// Expect bin 0-5 or 5-10. Implementation picks first match > max.
// Let's test precise binning.
const res1 = modeContinuous([2, 2, 2, 12], 5);
assert.strictEqual(res1.count, 3);
assert.strictEqual(res1.range[0], 0);
assert.strictEqual(res1.range[1], 5);
assert.strictEqual(res1.value, 2.5);

// Test modeDiscrete
console.log("Testing modeDiscrete...");
const countData = [0, 0, 1, 1, 2];
// 0: 2, 1: 2, 2: 1. Max freq 2.
// Tie breaker: smallest value. Should return 0.
const res2 = modeDiscrete(countData);
assert.strictEqual(res2.value, 0);
assert.strictEqual(res2.count, 2);

const countData2 = [5, 5, 2, 2, 2, 1];
// 2 wins
const res3 = modeDiscrete(countData2);
assert.strictEqual(res3.value, 2);

// Test calculateStats
console.log("Testing calculateStats...");
const stats = calculateStats([10, 20, 30], 'continuous');
assert.strictEqual(stats.n, 3);
assert.strictEqual(stats.mean, 20);
assert.strictEqual(stats.max, 30);
assert.strictEqual(stats.mode.value, 22.5); // Bin 20-25 (20) vs 10-15 vs 30-35. All count 1. First one? Object keys iteration order is usually insertion order for integers?
// Bins: {10:1, 20:1, 30:1}.
// Iteration usually 10, 20, 30.
// If 10 > 0 -> best=10.
// If 20 > 1 (False).
// So expect 10-15 bin center: 12.5.
// Let's verify assumption.
const stats2 = calculateStats([10, 10, 30], 'continuous');
assert.strictEqual(stats2.mode.value, 12.5);

console.log("All Tests Passed.");
