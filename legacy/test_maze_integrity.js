/**
 * Static maze-contract tests.
 *
 * Dynamic tests are useful for timing patrols, but these checks catch the
 * authoring errors that make a puzzle fundamentally unwinnable: malformed
 * maps, objectives behind their own locks, and patrol routes through walls.
 */
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
const match = source.match(/const MAZE_TEMPLATES = (\[[\s\S]*?\]);\s*\n\s*\/\//);
if (!match) throw new Error('Could not load MAZE_TEMPLATES from game.js');
const levels = eval(match[1]); // Same source-of-truth extraction as the route suite.

const COLS = 18;
const ROWS = 12;
let failures = 0;

function fail(message) {
  failures++;
  console.error(`✗ ${message}`);
}

function reachable(level, from, to, gateOpen) {
  const seen = new Set([`${from.c},${from.r}`]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift();
    if (current.c === to.c && current.r === to.r) return true;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = current.c + dc;
      const r = current.r + dr;
      const key = `${c},${r}`;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS || seen.has(key)) continue;
      const tile = level.grid[r][c];
      if (tile === 'W' || (tile === 'G' && !gateOpen)) continue;
      seen.add(key);
      queue.push({ c, r });
    }
  }
  return false;
}

function assertRoute(level, from, to, gateOpen, label) {
  if (!reachable(level, from, to, gateOpen)) {
    fail(`Level ${level.level}: ${label} is unreachable with gate ${gateOpen ? 'open' : 'closed'}.`);
  }
}

for (const level of levels) {
  if (level.grid.length !== ROWS || level.grid.some(row => row.length !== COLS)) {
    fail(`Level ${level.level}: grid must be exactly ${COLS} × ${ROWS}.`);
    continue;
  }
  if (level.grid[0].includes('.') || level.grid[ROWS - 1].includes('.')) {
    fail(`Level ${level.level}: top and bottom borders must be sealed.`);
  }
  for (let r = 0; r < ROWS; r++) {
    if (level.grid[r][0] !== 'W' || level.grid[r][COLS - 1] !== 'W') {
      fail(`Level ${level.level}: side borders must be sealed.`);
    }
  }

  level.aliens.forEach((alien, index) => {
    for (let point = alien.min; point <= alien.max; point++) {
      const c = alien.axis === 'x' ? point : alien.c;
      const r = alien.axis === 'y' ? point : alien.r;
      if (level.grid[r]?.[c] === 'W') {
        fail(`Level ${level.level}: alien ${index}'s patrol enters wall (${c}, ${r}).`);
      }
    }
  });
}

// Each required interaction must be reachable before it is needed.  The final
// leg of each puzzle is checked with the gate state it actually unlocks.
assertRoute(levels[0], levels[0].start, { c: 1, r: 10 }, false, 'keycard');
assertRoute(levels[0], { c: 1, r: 10 }, { c: 16, r: 2 }, true, 'exit after keycard');
assertRoute(levels[1], levels[1].start, { c: 1, r: 1 }, false, 'lever');
assertRoute(levels[1], { c: 1, r: 1 }, { c: 16, r: 5 }, true, 'exit after lever');
assertRoute(levels[2], levels[2].start, levels[2].plate, false, 'pressure plate');
assertRoute(levels[2], levels[2].plate, { c: 16, r: 10 }, true, 'exit while plate is active');
assertRoute(levels[3], levels[3].start, { c: 1, r: 1 }, false, 'terminal A');
assertRoute(levels[3], { c: 1, r: 1 }, { c: 16, r: 1 }, false, 'terminal B');
assertRoute(levels[3], { c: 16, r: 1 }, { c: 1, r: 10 }, false, 'terminal C');
assertRoute(levels[3], { c: 1, r: 10 }, { c: 16, r: 10 }, true, 'launchpad after terminals');

if (failures) process.exit(1);
console.log(`✓ Maze integrity checks passed for ${levels.length} levels.`);
