// Simple verification script for skill rating logic
// This tests the core ELO calculations without needing the full test framework

// ELO calculation functions (extracted from DatabaseService)
function calculateExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function getKFactor(totalGames) {
  if (totalGames < 10) return 60;
  if (totalGames < 30) return 40;
  if (totalGames < 100) return 25;
  return 20;
}

function calculateSkillRatingChange(winnerRating, winnerGames, loserRating, loserGames) {
  const winnerExpected = calculateExpectedScore(winnerRating, loserRating);
  const loserExpected = calculateExpectedScore(loserRating, winnerRating);

  const winnerK = getKFactor(winnerGames);
  const loserK = getKFactor(loserGames);

  const winnerNewRating = Math.round(winnerRating + winnerK * (1 - winnerExpected));
  const loserNewRating = Math.round(loserRating + loserK * (0 - loserExpected));

  return { winnerNewRating, loserNewRating };
}

// Run tests
console.log('=== Skill Rating System Verification ===\n');

// Test 1: Equal ratings
console.log('Test 1: Equal ratings (1200 vs 1200)');
const expected1 = calculateExpectedScore(1200, 1200);
console.log(`  Expected score: ${expected1.toFixed(4)} (should be ~0.5)`);
console.log(`  ✓ PASS: ${Math.abs(expected1 - 0.5) < 0.0001 ? 'YES' : 'NO'}\n`);

// Test 2: Higher rated player
console.log('Test 2: Higher rated player (1600 vs 1200)');
const expected2 = calculateExpectedScore(1600, 1200);
console.log(`  Expected score: ${expected2.toFixed(4)} (should be > 0.5)`);
console.log(`  ✓ PASS: ${expected2 > 0.5 ? 'YES' : 'NO'}\n`);

// Test 3: Lower rated player
console.log('Test 3: Lower rated player (1200 vs 1600)');
const expected3 = calculateExpectedScore(1200, 1600);
console.log(`  Expected score: ${expected3.toFixed(4)} (should be < 0.5)`);
console.log(`  ✓ PASS: ${expected3 < 0.5 ? 'YES' : 'NO'}\n`);

// Test 4: K-factor calculation
console.log('Test 4: K-factor calculation');
console.log(`  New player (5 games): K = ${getKFactor(5)} (should be 60)`);
console.log(`  Learning player (15 games): K = ${getKFactor(15)} (should be 40)`);
console.log(`  Established player (50 games): K = ${getKFactor(50)} (should be 25)`);
console.log(`  Veteran player (150 games): K = ${getKFactor(150)} (should be 20)\n`);

// Test 5: Rating changes
console.log('Test 5: Rating changes (equal players)');
const change1 = calculateSkillRatingChange(1200, 50, 1200, 50);
console.log(`  Winner: 1200 → ${change1.winnerNewRating} (${change1.winnerNewRating - 1200 > 0 ? '+' : ''}${change1.winnerNewRating - 1200})`);
console.log(`  Loser: 1200 → ${change1.loserNewRating} (${change1.loserNewRating - 1200 > 0 ? '+' : ''}${change1.loserNewRating - 1200})`);
console.log(`  ✓ PASS: ${change1.winnerNewRating > 1200 && change1.loserNewRating < 1200 ? 'YES' : 'NO'}\n`);

// Test 6: Upset (underdog wins)
console.log('Test 6: Upset (1200 beats 1600)');
const change2 = calculateSkillRatingChange(1200, 50, 1600, 50);
const winnerGain = change2.winnerNewRating - 1200;
const loserLoss = 1600 - change2.loserNewRating;
console.log(`  Underdog gains: +${winnerGain}`);
console.log(`  Favorite loses: -${loserLoss}`);
console.log(`  ✓ PASS: ${winnerGain >= loserLoss ? 'YES (bigger/equal gain for upset)' : 'NO'}\n`);

// Test 7: Expected result (favorite wins)
console.log('Test 7: Expected result (1600 beats 1200)');
const change3 = calculateSkillRatingChange(1600, 50, 1200, 50);
const favGain = change3.winnerNewRating - 1600;
const underLoss = 1200 - change3.loserNewRating;
console.log(`  Favorite gains: +${favGain}`);
console.log(`  Underdog loses: -${underLoss}`);
console.log(`  ✓ PASS: ${favGain <= underLoss ? 'YES (smaller/equal gain for expected)' : 'NO'}\n`);

// Test 8: New player adjustment
console.log('Test 8: New player vs veteran (1200/5 games vs 1500/100 games)');
const change4 = calculateSkillRatingChange(1200, 5, 1500, 100);
const newPlayerGain = change4.winnerNewRating - 1200;
const vetLoss = 1500 - change4.loserNewRating;
console.log(`  New player gains: +${newPlayerGain}`);
console.log(`  Veteran loses: -${vetLoss}`);
console.log(`  ✓ PASS: ${newPlayerGain > vetLoss ? 'YES (faster adjustment)' : 'NO'}\n`);

console.log('=== All tests completed ===');
