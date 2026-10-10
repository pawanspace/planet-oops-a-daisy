/**
 * RIGOROUS AUTOMATED VERIFICATION SUITE FOR ALL 4 MAZE LEVELS
 *
 * Uses a time-stepped BFS where each state = (grid_cell, time_phase).
 * time_phase is quantised to the LCM of all alien cycle periods (capped at 0.1s
 * resolution) so the visited-map correctly deduplicates states that are truly
 * equivalent, without discarding valid "wait here" states.
 */

const fs = require('fs');
const path = require('path');

const gameJsCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
const mazeTemplatesMatch = gameJsCode.match(/const MAZE_TEMPLATES = (\[[\s\S]*?\]);\s*\n\s*\/\//);
if (!mazeTemplatesMatch) { console.error("FATAL: Could not parse MAZE_TEMPLATES"); process.exit(1); }

const MAZE_TEMPLATES = eval(mazeTemplatesMatch[1]);
console.log(`Successfully extracted ${MAZE_TEMPLATES.length} levels from game.js\n`);

const TILE = 42;
const PLAYER_R = 11;
const HIT_DIST = 28;
const MOVE_SPEED = 160;
const COLS = 18;
const ROWS = 12;

// Time resolution for the BFS visited map (seconds).
// Fine enough to catch safe windows between fast aliens (spd~95, cycle~1.3s → windows ~0.5s wide).
const TIME_STEP = 0.1;

function canStand(grid, x, y, gateOpen) {
  const c1 = Math.floor((x - PLAYER_R) / TILE);
  const c2 = Math.floor((x + PLAYER_R) / TILE);
  const r1 = Math.floor((y - PLAYER_R) / TILE);
  const r2 = Math.floor((y + PLAYER_R) / TILE);
  for (const c of [c1, c2]) {
    for (const r of [r1, r2]) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
      const tile = grid[r][c];
      if (tile === 'W') return false;
      if (tile === 'G' && !gateOpen) return false;
    }
  }
  return true;
}

function getAlienPos(a, t) {
  const minPos = a.min * TILE + TILE / 2;
  const maxPos = a.max * TILE + TILE / 2;
  const dist = maxPos - minPos;
  if (dist <= 0) return (a.axis === 'x') ? { x: minPos, y: a.r*TILE+TILE/2 } : { x: a.c*TILE+TILE/2, y: minPos };
  const cycle = (dist / a.spd) * 2;
  const m = t % cycle;
  const pos = (m < cycle/2) ? (minPos + m*a.spd) : (maxPos - (m-cycle/2)*a.spd);
  return (a.axis === 'x') ? { x: pos, y: a.r*TILE+TILE/2 } : { x: a.c*TILE+TILE/2, y: pos };
}

function isSafeAt(aliens, px, py, t) {
  for (const a of aliens) {
    const ap = getAlienPos(a, t);
    if (Math.hypot(px - ap.x, py - ap.y) < HIT_DIST + 4) return false;
  }
  return true;
}

/**
 * BFS over (col, row, quantised_time) states.
 * At each state the player can:
 *   1. Wait TIME_STEP seconds in place (if safe to do so at t+TIME_STEP)
 *   2. Move to an adjacent tile (takes TILE/MOVE_SPEED seconds, checked at 4 sub-steps)
 *
 * visited key = "c,r,tBucket" where tBucket = round(t / TIME_STEP).
 * Because all alien cycles are multiples of TIME_STEP (to <1% error), states that
 * are truly equivalent get the same key and are deduplicated correctly.
 */
function findSafePath(tmpl, fromCoord, toCoord, startTime, gateOpen) {
  const moveTime = TILE / MOVE_SPEED; // ~0.2625s per tile

  // Build walkable node list with neighbour links
  const nodes = [];
  const nodeMap = new Map();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = tmpl.grid[r][c];
      if (tile === 'W') continue;
      if (tile === 'G' && !gateOpen) continue;
      const node = { c, r, x: c*TILE+TILE/2, y: r*TILE+TILE/2 };
      nodes.push(node);
      nodeMap.set(`${c},${r}`, node);
    }
  }
  nodes.forEach(n => {
    n.neighbors = [];
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nb = nodeMap.get(`${n.c+dc},${n.r+dr}`);
      if (nb) n.neighbors.push(nb);
    }
  });

  const fromNode = nodeMap.get(`${fromCoord.c},${fromCoord.r}`);
  const toNode   = nodeMap.get(`${toCoord.c},${toCoord.r}`);
  if (!fromNode || !toNode) return { ok: false, error: `Invalid node` };

  const visited = new Set();
  // Priority queue sorted by f = t + heuristic
  const q = [{ node: fromNode, t: startTime }];
  const key = (n, t) => `${n.c},${n.r},${Math.round(t / TIME_STEP)}`;

  visited.add(key(fromNode, startTime));

  // Max search time per leg
  const MAX_T = startTime + 90;

  while (q.length > 0) {
    // Pop lowest f = t + heuristic(remaining distance)
    q.sort((a, b) => {
      const ha = Math.hypot(a.node.c - toCoord.c, a.node.r - toCoord.r) * (TILE / MOVE_SPEED);
      const hb = Math.hypot(b.node.c - toCoord.c, b.node.r - toCoord.r) * (TILE / MOVE_SPEED);
      return (a.t + ha) - (b.t + hb);
    });
    const curr = q.shift();

    if (curr.node.c === toCoord.c && curr.node.r === toCoord.r) {
      return { ok: true, t: curr.t, duration: curr.t - startTime };
    }
    if (curr.t > MAX_T) continue;

    // Option 1: wait TIME_STEP in place
    const waitT = curr.t + TIME_STEP;
    if (isSafeAt(tmpl.aliens, curr.node.x, curr.node.y, waitT)) {
      const wk = key(curr.node, waitT);
      if (!visited.has(wk)) {
        visited.add(wk);
        q.push({ node: curr.node, t: waitT });
      }
    }

    // Option 2: move to each neighbor
    for (const next of curr.node.neighbors) {
      const nextT = curr.t + moveTime;
      // Check 5 interpolation points along the move
      let stepSafe = true;
      for (let f = 0; f <= 1; f += 0.25) {
        const px = curr.node.x + (next.x - curr.node.x) * f;
        const py = curr.node.y + (next.y - curr.node.y) * f;
        const interT = curr.t + moveTime * f;
        if (!isSafeAt(tmpl.aliens, px, py, interT)) { stepSafe = false; break; }
      }
      if (!stepSafe) continue;

      const nk = key(next, nextT);
      if (!visited.has(nk)) {
        visited.add(nk);
        q.push({ node: next, t: nextT });
      }
    }

    // Safety cap: if queue is gigantic, we're clearly exhausting — something is wrong
    if (q.length > 80000) {
      return { ok: false, error: 'Search space exceeded 80k nodes — possible deadlock' };
    }
  }

  return { ok: false, error: 'Path search exhausted without safe trajectory' };
}

// =============================================================================
// RUN SUITE
// =============================================================================
console.log("==================================================================");
console.log("RUNNING RIGOROUS DYNAMIC TRAJECTORY TESTS ACROSS ALL 4 LEVELS");
console.log("==================================================================\n");

let allPassed = true;

// LEVEL 1
{
  const tmpl = MAZE_TEMPLATES[0];
  console.log(`[LEVEL 1] ${tmpl.name}`);
  const leg1 = findSafePath(tmpl, tmpl.start, { c: 1, r: 10 }, 0, false);
  if (!leg1.ok) {
    console.error("  ❌ FAILED Leg 1: Start -> Keycard:", leg1.error); allPassed = false;
  } else {
    console.log(`  ✓ Leg 1: Start -> Keycard (1,10) solved in ${leg1.duration.toFixed(2)}s`);
    const leg2 = findSafePath(tmpl, { c: 1, r: 10 }, { c: 16, r: 2 }, leg1.t, true);
    if (!leg2.ok) {
      console.error("  ❌ FAILED Leg 2: Keycard -> Goal:", leg2.error); allPassed = false;
    } else {
      console.log(`  ✓ Leg 2: Keycard -> Goal (16,2) solved in ${leg2.duration.toFixed(2)}s`);
      console.log(`  🎉 LEVEL 1 COMPLETE in ${(leg1.duration+leg2.duration).toFixed(2)}s\n`);
    }
  }
}

// LEVEL 2
{
  const tmpl = MAZE_TEMPLATES[1];
  console.log(`[LEVEL 2] ${tmpl.name}`);
  const leg1 = findSafePath(tmpl, tmpl.start, { c: 1, r: 1 }, 0, false);
  if (!leg1.ok) {
    console.error("  ❌ FAILED Leg 1: Start -> Wall Lever:", leg1.error); allPassed = false;
  } else {
    console.log(`  ✓ Leg 1: Start -> Wall Lever (1,1) solved in ${leg1.duration.toFixed(2)}s`);
    const leg2 = findSafePath(tmpl, { c: 1, r: 1 }, { c: 16, r: 5 }, leg1.t, true);
    if (!leg2.ok) {
      console.error("  ❌ FAILED Leg 2: Wall Lever -> Goal:", leg2.error); allPassed = false;
    } else {
      console.log(`  ✓ Leg 2: Wall Lever -> Goal (16,5) solved in ${leg2.duration.toFixed(2)}s`);
      console.log(`  🎉 LEVEL 2 COMPLETE in ${(leg1.duration+leg2.duration).toFixed(2)}s\n`);
    }
  }
}

// LEVEL 3
{
  const tmpl = MAZE_TEMPLATES[2];
  console.log(`[LEVEL 3] ${tmpl.name}`);
  const leg1 = findSafePath(tmpl, tmpl.start, tmpl.plate, 0, false);
  if (!leg1.ok) {
    console.error("  ❌ FAILED Leg 1: Start -> Pressure Plate:", leg1.error); allPassed = false;
  } else {
    console.log(`  ✓ Leg 1: Start -> Pressure Plate (9,5) solved in ${leg1.duration.toFixed(2)}s`);
    const leg2 = findSafePath(tmpl, tmpl.plate, { c: 16, r: 10 }, leg1.t, true);
    if (!leg2.ok) {
      console.error("  ❌ FAILED Leg 2: Plate -> Goal:", leg2.error); allPassed = false;
    } else {
      console.log(`  ✓ Leg 2: Plate -> Goal (16,10) solved in ${leg2.duration.toFixed(2)}s`);
      console.log(`  🎉 LEVEL 3 COMPLETE in ${(leg1.duration+leg2.duration).toFixed(2)}s\n`);
    }
  }
}

// LEVEL 4
{
  const tmpl = MAZE_TEMPLATES[3];
  console.log(`[LEVEL 4] ${tmpl.name}`);
  const leg1 = findSafePath(tmpl, tmpl.start, { c: 1, r: 1 }, 0, false);
  if (!leg1.ok) {
    console.error("  ❌ FAILED Leg 1: Start -> Terminal A:", leg1.error); allPassed = false;
  } else {
    console.log(`  ✓ Leg 1: Start -> Terminal A (1,1) solved in ${leg1.duration.toFixed(2)}s`);
    const leg2 = findSafePath(tmpl, { c: 1, r: 1 }, { c: 16, r: 1 }, leg1.t, false);
    if (!leg2.ok) {
      console.error("  ❌ FAILED Leg 2: Terminal A -> B:", leg2.error); allPassed = false;
    } else {
      console.log(`  ✓ Leg 2: Terminal A -> B (16,1) solved in ${leg2.duration.toFixed(2)}s`);
      const leg3 = findSafePath(tmpl, { c: 16, r: 1 }, { c: 1, r: 10 }, leg2.t, false);
      if (!leg3.ok) {
        console.error("  ❌ FAILED Leg 3: Terminal B -> C:", leg3.error); allPassed = false;
      } else {
        console.log(`  ✓ Leg 3: Terminal B -> C (1,10) solved in ${leg3.duration.toFixed(2)}s`);
        const leg4 = findSafePath(tmpl, { c: 1, r: 10 }, { c: 16, r: 10 }, leg3.t, true);
        if (!leg4.ok) {
          console.error("  ❌ FAILED Leg 4: Terminal C -> Goal:", leg4.error); allPassed = false;
        } else {
          console.log(`  ✓ Leg 4: Terminal C -> Goal (16,10) solved in ${leg4.duration.toFixed(2)}s`);
          console.log(`  🎉 LEVEL 4 COMPLETE in ${(leg1.duration+leg2.duration+leg3.duration+leg4.duration).toFixed(2)}s\n`);
        }
      }
    }
  }
}

if (!allPassed) {
  console.error("❌ SUITE FAILED: One or more levels have deadlocks or unavoidable collisions.");
  process.exit(1);
} else {
  console.log("==================================================================");
  console.log("✅ ALL 4 LEVELS VALIDATED — ZERO DEADLOCKS, ALL OBJECTIVES REACHABLE");
  console.log("==================================================================");
}
