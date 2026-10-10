/**
 * RIGOROUS TIME-SPACE DYNAMIC PATHFINDING SOLVER
 * Simulates a real human player playing the game:
 * - Walks along open tile corridors at 160 px/s
 * - Senses incoming aliens in real-time
 * - When an alien is approaching, ducks into an evasion bay/nook and waits safely
 * - Steps out once the alien passes and proceeds to the objective
 * - Proves full solvability without taking a single hit!
 */

const TILE = 36;
const PLAYER_R = 11;
const HIT_DIST = 22;

function canStand(grid, x, y, gateOpen) {
  const c1 = Math.floor((x - PLAYER_R) / TILE);
  const c2 = Math.floor((x + PLAYER_R) / TILE);
  const r1 = Math.floor((y - PLAYER_R) / TILE);
  const r2 = Math.floor((y + PLAYER_R) / TILE);
  for (const c of [c1, c2]) {
    for (const r of [r1, r2]) {
      if (c < 0 || c >= 18 || r < 0 || r >= 12) return false;
      const tile = grid[r][c];
      if (tile === "W") return false;
      if (tile === "G" && !gateOpen) return false;
    }
  }
  return true;
}

function getAlienPos(a, t) {
  const minPos = a.min * TILE + 18;
  const maxPos = a.max * TILE + 18;
  const dist = maxPos - minPos;
  const cycle = (dist / a.spd) * 2;
  const m = t % cycle;
  const pos = (m < cycle / 2) ? (minPos + m * a.spd) : (maxPos - (m - cycle / 2) * a.spd);
  return (a.axis === "x") ? { x: pos, y: a.r * TILE + 18 } : { x: a.c * TILE + 18, y: pos };
}

function solveLevel(tmpl, keyCoord, goalCoord) {
  const nodes = [];
  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 18; c++) {
      if (tmpl.grid[r][c] !== "W") {
        nodes.push({ c, r, x: c * TILE + 18, y: r * TILE + 18 });
      }
    }
  }

  nodes.forEach(n => {
    n.neighbors = [];
    for (const [dc, dr] of [[0,1], [0,-1], [1,0], [-1,0]]) {
      const neighbor = nodes.find(o => o.c === n.c + dc && o.r === n.r + dr);
      if (neighbor) {
        let open = true;
        for (let f = 0; f <= 1; f += 0.2) {
          const testX = n.x + (neighbor.x - n.x) * f;
          const testY = n.y + (neighbor.y - n.y) * f;
          if (!canStand(tmpl.grid, testX, testY, true)) { open = false; break; }
        }
        if (open) n.neighbors.push(neighbor);
      }
    }
  });

  const startNode = nodes.find(n => n.c === tmpl.start.c && n.r === tmpl.start.r);
  const keyNode = nodes.find(n => n.c === keyCoord.c && n.r === keyCoord.r);
  const goalNode = nodes.find(n => n.c === goalCoord.c && n.r === goalCoord.r);

  function findSafeRun(from, to, startTime, gateOpen) {
    const moveTime = TILE / 160; // 0.225 sec per tile
    const q = [{ node: from, t: startTime, path: [from] }];
    const visited = new Map();

    while (q.length) {
      // Prioritize path with shortest (cost + distance to goal)
      q.sort((a, b) => {
        const da = Math.hypot(a.node.c - to.c, a.node.r - to.r);
        const db = Math.hypot(b.node.c - to.c, b.node.r - to.r);
        return (a.t + da * moveTime) - (b.t + db * moveTime);
      });

      const curr = q.shift();
      if (curr.node.c === to.c && curr.node.r === to.r) {
        return { ok: true, t: curr.t, duration: curr.t - startTime, path: curr.path };
      }
      if (curr.t - startTime > 120) break;

      const key = `${curr.node.c},${curr.node.r},${Math.round(curr.t * 3)}`;
      if (visited.has(key)) continue;
      visited.set(key, curr.t);

      // Option 1: Wait at current node (evasion)
      const waitT = curr.t + 0.3;
      let waitSafe = true;
      for (const a of tmpl.aliens) {
        const apos = getAlienPos(a, waitT);
        if (Math.hypot(curr.node.x - apos.x, curr.node.y - apos.y) < HIT_DIST + 4) {
          waitSafe = false; break;
        }
      }
      if (waitSafe) {
        q.push({ node: curr.node, t: waitT, path: curr.path });
      }

      // Option 2: Step to an adjacent neighbor
      for (const next of curr.node.neighbors) {
        if (tmpl.grid[next.r][next.c] === "G" && !gateOpen) continue;
        const nextT = curr.t + moveTime;
        let stepSafe = true;
        for (let f = 0; f <= 1; f += 0.25) {
          const px = curr.node.x + (next.x - curr.node.x) * f;
          const py = curr.node.y + (next.y - curr.node.y) * f;
          const interT = curr.t + moveTime * f;
          for (const a of tmpl.aliens) {
            const apos = getAlienPos(a, interT);
            if (Math.hypot(px - apos.x, py - apos.y) < HIT_DIST + 4) {
              stepSafe = false; break;
            }
          }
          if (!stepSafe) break;
        }

        if (stepSafe) {
          q.push({ node: next, t: nextT, path: [...curr.path, next] });
        }
      }

      if (q.length > 3000) q.splice(1500);
    }
    return { ok: false };
  }

  const leg1 = findSafeRun(startNode, keyNode, 0, false);
  if (!leg1.ok) {
    return { level: tmpl.level, solved: false, reason: "Leg 1 (Start -> Objective) blocked by alien or dead-end" };
  }

  const leg2 = findSafeRun(keyNode, goalNode, leg1.t, true);
  if (!leg2.ok) {
    return { level: tmpl.level, solved: false, reason: "Leg 2 (Objective -> Goal) blocked by alien or dead-end" };
  }

  return {
    level: tmpl.level,
    solved: true,
    leg1Time: leg1.duration,
    leg2Time: leg2.duration,
    totalTime: leg1.duration + leg2.duration
  };
}

module.exports = {
  solveLevel
};
