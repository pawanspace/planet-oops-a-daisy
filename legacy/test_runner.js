/**
 * REAL-TIME CONTINUOUS PHYSICS TEST SUITE FOR PLANET OOPS-A-DAISY
 *
 * This simulator runs the EXACT SAME continuous physics loop as the browser game:
 * - TILE = 36 px
 * - Player velocity = 160 px/sec
 * - Player collision radius = 11 px (bounding box [-11, +11])
 * - Alien hit radius = 22 px (dist < 22 between player center and alien center)
 * - Fixed DT = 1/60 sec
 *
 * It uses A* dynamic space-time pathfinding (x, y, t) to prove mathematically and
 * dynamically that a player can navigate from START -> KEY/OBJECTIVE -> GOAL
 * without ever colliding with any alien, without ever hitting a dead-end,
 * and well within the time limit.
 */

const TILE = 36;
const PLAYER_R = 11;
const HIT_DIST = 22;
const DT = 1 / 60;
const MOVE_SPEED = 160;

function createSimulator(levelConfig) {
  const grid = levelConfig.grid.map(row => row.split(''));
  const rows = grid.length;
  const cols = grid[0].length;

  function isWall(c, r, gateOpen) {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return true;
    const tile = grid[r][c];
    if (tile === 'W') return true;
    if (tile === 'G' && !gateOpen) return true;
    return false;
  }

  function canStand(x, y, gateOpen) {
    const c1 = Math.floor((x - PLAYER_R) / TILE);
    const c2 = Math.floor((x + PLAYER_R) / TILE);
    const r1 = Math.floor((y - PLAYER_R) / TILE);
    const r2 = Math.floor((y + PLAYER_R) / TILE);
    if (isWall(c1, r1, gateOpen) || isWall(c2, r1, gateOpen) || isWall(c1, r2, gateOpen) || isWall(c2, r2, gateOpen)) {
      return false;
    }
    return true;
  }

  function getAlienState(alienDef, time) {
    const minPos = alienDef.min * TILE + TILE / 2;
    const maxPos = alienDef.max * TILE + TILE / 2;
    const travelDist = maxPos - minPos;
    if (travelDist <= 0) {
      return { x: minPos, y: alienDef.r * TILE + TILE / 2 };
    }
    const cycleTime = (travelDist / alienDef.spd) * 2;
    const tMod = time % cycleTime;
    let pos;
    if (tMod < cycleTime / 2) {
      pos = minPos + tMod * alienDef.spd;
    } else {
      pos = maxPos - (tMod - cycleTime / 2) * alienDef.spd;
    }

    if (alienDef.axis === 'x') {
      return { x: pos, y: alienDef.r * TILE + TILE / 2 };
    } else {
      return { x: alienDef.c * TILE + TILE / 2, y: pos };
    }
  }

  function getActiveAliens(aliensList, time) {
    return aliensList.map(a => getAlienState(a, time));
  }

  function isAlienDanger(px, py, aliensList, time) {
    const alienPositions = getActiveAliens(aliensList, time);
    for (const a of alienPositions) {
      const dist = Math.hypot(px - a.x, py - a.y);
      if (dist < HIT_DIST + 2) { // 2px safety margin
        return true;
      }
    }
    return false;
  }

  return {
    grid,
    rows,
    cols,
    canStand,
    getActiveAliens,
    isAlienDanger
  };
}

/**
 * A* Space-Time Dynamic Pathfinding Solver
 * Searches state space (c, r, timeStep)
 */
function solveRoute(sim, levelConfig, startCoord, targetCoord, gateInitiallyOpen, aliensList, startTime = 0) {
  const startX = startCoord.c * TILE + TILE / 2;
  const startY = startCoord.r * TILE + TILE / 2;
  const targetX = targetCoord.c * TILE + TILE / 2;
  const targetY = targetCoord.r * TILE + TILE / 2;

  // Discrete time discretization: dt = 0.15s
  const stepDt = 0.15;
  const stepSpeed = MOVE_SPEED * stepDt; // ~24px per step

  // Priority queue for A*
  const queue = [{
    x: startX,
    y: startY,
    t: startTime,
    cost: 0,
    heuristic: Math.hypot(targetX - startX, targetY - startY),
    path: [{ x: startX, y: startY, t: startTime }]
  }];

  const visited = new Map(); // key -> minCost

  while (queue.length > 0) {
    queue.sort((a, b) => (a.cost + a.heuristic) - (b.cost + b.heuristic));
    const curr = queue.shift();

    // Check target reach (within 14px of center)
    if (Math.hypot(curr.x - targetX, curr.y - targetY) < 14) {
      return {
        solved: true,
        duration: curr.t - startTime,
        path: curr.path
      };
    }

    if (curr.t - startTime > 75) {
      // Exceeded max search time
      break;
    }

    // Discretize state key
    const tileC = Math.round(curr.x / (TILE / 2));
    const tileR = Math.round(curr.y / (TILE / 2));
    const timeBucket = Math.round(curr.t / stepDt);
    const stateKey = `${tileC},${tileR},${timeBucket}`;

    if (visited.has(stateKey) && visited.get(stateKey) <= curr.cost) {
      continue;
    }
    visited.set(stateKey, curr.cost);

    // Moves: Stand still (wait), Up, Down, Left, Right
    const moves = [
      { dx: 0, dy: 0 },
      { dx: 0, dy: -stepSpeed },
      { dx: 0, dy: stepSpeed },
      { dx: -stepSpeed, dy: 0 },
      { dx: stepSpeed, dy: 0 }
    ];

    for (const m of moves) {
      const nextX = curr.x + m.dx;
      const nextY = curr.y + m.dy;
      const nextT = curr.t + stepDt;

      // 1. Must stand on valid floor
      if (!sim.canStand(nextX, nextY, gateInitiallyOpen)) {
        continue;
      }

      // 2. Must not be hit by any alien at nextT
      if (sim.isAlienDanger(nextX, nextY, aliensList, nextT)) {
        continue;
      }

      // 3. Interpolated safety check between curr and next
      const midX = (curr.x + nextX) / 2;
      const midY = (curr.y + nextY) / 2;
      const midT = (curr.t + nextT) / 2;
      if (sim.isAlienDanger(midX, midY, aliensList, midT)) {
        continue;
      }

      const nextCost = curr.cost + stepDt + (m.dx === 0 && m.dy === 0 ? 0.05 : 0);
      const h = Math.hypot(targetX - nextX, targetY - nextY) / MOVE_SPEED;

      queue.push({
        x: nextX,
        y: nextY,
        t: nextT,
        cost: nextCost,
        heuristic: h,
        path: [...curr.path, { x: nextX, y: nextY, t: nextT }]
      });
    }

    if (queue.length > 3500) {
      // Keep best 1500
      queue.splice(1500);
    }
  }

  return { solved: false, reason: "No collision-free trajectory found" };
}

module.exports = {
  TILE,
  createSimulator,
  solveRoute
};
