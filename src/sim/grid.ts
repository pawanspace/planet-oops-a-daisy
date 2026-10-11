// =============================================================================
// 📘 LESSON: Asking questions about the map
// =============================================================================
// The Grid is the map's floor plan plus some useful questions you can ask it:
//   • solid(c, r)        "Is this tile a wall?"
//   • canStand(x, y, r)  "Could a body this big stand here without overlapping a wall?"   (collision)
//   • lineOfSight(a, b)  "Is there a clear straight line from a to b?"                    (can the alien SEE Leo?)
//   • distField(c, r)    "How many steps is every tile from here, walking around walls?"  (pathfinding)
//
// Almost every rule in the game is built from these four questions.
//
// Two tiny helpers at the bottom convert between pixels and tiles:
//   tileOf(130)  → 2      (pixel 130 is inside tile 2, because 130 / 48 = 2.7 and we round DOWN)
//   center(2)    → 120    (the middle of tile 2 is at 2*48 + 24)
// =============================================================================
import { TILE } from './config';
import { T, type TileCode, type Vec } from './level';

export class Grid {
  readonly w: number;        // width in tiles
  readonly h: number;        // height in tiles
  readonly tiles: TileCode[];
  /** Lasers are walls, except while a Heavy stands on a pressure plate (world.ts flips this on and off). */
  lasersOpen = false;

  constructor(w: number, h: number, tiles: TileCode[]) {
    this.w = w;
    this.h = h;
    // .slice() makes our own COPY of the list, so opening a gate in one game doesn't change the level for the next.
    this.tiles = tiles.slice();
  }

  /** The tile at column c, row r. Anything outside the map counts as a wall, so nobody can walk off the edge. */
  get(c: number, r: number): TileCode {
    if (c < 0 || r < 0 || c >= this.w || r >= this.h) return T.Wall;
    return this.tiles[r * this.w + c];
  }

  set(c: number, r: number, t: TileCode): void {
    if (c >= 0 && r >= 0 && c < this.w && r < this.h) this.tiles[r * this.w + c] = t;
  }

  /** Does this tile block movement and sight? */
  solid(c: number, r: number): boolean {
    const t = this.get(c, r);
    return t === T.Empty || t === T.Wall || t === T.Hedge || t === T.Gate || t === T.Shield
      || (t === T.Laser && !this.lasersOpen);
  }

  // #region canStand
  /**
   * Can a square body of half-size `rad`, centred at pixel (x, y), stand here without touching a wall?
   *
   * We work out which tiles the body's four edges fall into, then check every one of those tiles.
   * 💡 EXAMPLE: Leo (rad 14) at x = 60 spans x from 46 to 74. tileOf(46) = 0 and tileOf(74) = 1,
   *    so he overlaps columns 0 AND 1. If either of those tiles is a wall, he can't stand there.
   * (The "- 0.001" stops a body exactly touching the next tile from counting as inside it.)
   */
  canStand(x: number, y: number, rad: number): boolean {
    const c1 = Math.floor((x - rad) / TILE), c2 = Math.floor((x + rad - 0.001) / TILE);
    const r1 = Math.floor((y - rad) / TILE), r2 = Math.floor((y + rad - 0.001) / TILE);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (this.solid(c, r)) return false;
    return true;
  }
  // #endregion canStand

  // #region lineOfSight
  /**
   * Is there a clear straight line from a to b? (Used for "can this alien see Leo?")
   *
   * The idea: walk along the line from a to b ONE TILE AT A TIME, in the exact order the line crosses tiles.
   * If any tile on the way is solid, the view is blocked. This is a classic trick called a "DDA grid walk"
   * (or "Amanatides & Woo" after the people who wrote it up).
   *
   *   tmx / tmy = how far along the line (from 0 = at a, to 1 = at b) we reach the next vertical / horizontal
   *               tile border. Whichever comes first is the next tile we enter.
   *   tdx / tdy = how much further along the line each extra tile column / row adds.
   *
   * 💡 EXAMPLE: from the middle of tile (1,1) looking right to tile (4,1), we step through (2,1), (3,1), (4,1).
   *    If (3,1) is a hedge, we return false: the alien can't see through the bush.
   * 🧠 QUIZ Q10: Why do we stop and return true as soon as we reach b's tile, without checking if it's solid?
   */
  lineOfSight(a: Vec, b: Vec): boolean {
    let c = Math.floor(a.x / TILE), r = Math.floor(a.y / TILE);
    const ec = Math.floor(b.x / TILE), er = Math.floor(b.y / TILE);
    const dx = b.x - a.x, dy = b.y - a.y;
    const sc = Math.sign(dx), sr = Math.sign(dy);           // which way we step: +1, -1 or 0
    const tdx = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tdy = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tmx = dx > 0 ? ((c + 1) * TILE - a.x) / dx : dx < 0 ? (c * TILE - a.x) / dx : Infinity;
    let tmy = dy > 0 ? ((r + 1) * TILE - a.y) / dy : dy < 0 ? (r * TILE - a.y) / dy : Infinity;
    for (let i = 0; i < 256; i++) { // 256 is a safety limit; real lines are much shorter
      if (c === ec && r === er) return true;
      if (tmx < tmy) { tmx += tdx; c += sc; } else { tmy += tdy; r += sr; }
      if (this.solid(c, r)) return false;
    }
    return false;
  }
  // #endregion lineOfSight

  // #region distField
  /**
   * PATHFINDING. Returns, for EVERY tile, how many steps it is from tile (c, r), walking around walls.
   * Walls and unreachable tiles get Infinity.
   *
   * This is "Breadth-First Search" (BFS). Picture dropping a stone in a pond:
   *   • The start tile gets 0.
   *   • Its open neighbours (up/down/left/right) get 1.
   *   • THEIR open neighbours that don't have a number yet get 2... and so on, like a ripple spreading out.
   * The queue `q` holds the tiles at the edge of the ripple, in the order they were reached.
   *
   * 💡 EXAMPLE (the distances from S):
   *        # # # # #
   *        # S 1 2 #
   *        # # # 3 #
   *        # 6 5 4 #
   *        # # # # #
   *
   * Why is this so useful? To walk TOWARDS S from any tile, just step onto whichever neighbour has a smaller
   * number (see stepDown below). Every alien chasing the same target can share one field.
   * 🧠 QUIZ Q11: In the example, which tile would an alien standing on "6" step to next?
   */
  distField(c: number, r: number): Float64Array {
    const d = new Float64Array(this.w * this.h).fill(Infinity);
    if (this.solid(c, r)) return d;
    const q = new Int32Array(this.w * this.h); // a simple queue: we read from `head` and add at `tail`
    let head = 0, tail = 0;
    d[r * this.w + c] = 0;
    q[tail++] = r * this.w + c;
    while (head < tail) {
      const i = q[head++];
      const cc = i % this.w, rr = (i - cc) / this.w; // turn the list index back into (column, row)
      const nd = d[i] + 1;
      for (let k = 0; k < 4; k++) {                  // the four neighbours: right, left, down, up
        const nc = cc + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const nr = rr + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (this.solid(nc, nr)) continue;
        const j = nr * this.w + nc;
        if (d[j] <= nd) continue;                    // already reached it by a path at least as short
        d[j] = nd;
        q[tail++] = j;
      }
    }
    return d;
  }
  // #endregion distField

  /** Look up one tile's distance in a field (Infinity if off the map). */
  dist(field: Float64Array, c: number, r: number): number {
    if (c < 0 || r < 0 || c >= this.w || r >= this.h) return Infinity;
    return field[r * this.w + c];
  }

  // #region stepDown
  /**
   * Which neighbour of (c, r) is one step closer to the field's starting tile? (null = we're there, or stuck.)
   * Walking downhill on the numbers always leads home by a shortest path.
   */
  stepDown(field: Float64Array, c: number, r: number): { c: number; r: number } | null {
    const here = this.dist(field, c, r);
    let best: { c: number; r: number } | null = null, bestD = here;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dc, dr] of dirs) {
      const d = this.dist(field, c + dc, r + dr);
      if (d < bestD) { bestD = d; best = { c: c + dc, r: r + dr }; }
    }
    return best;
  }
  // #endregion stepDown
}

// #region tileOf
/** Which tile column/row is this pixel in?  tileOf(0..47) = 0, tileOf(48..95) = 1, ... */
export const tileOf = (v: number) => Math.floor(v / TILE);
/** The pixel at the middle of tile c.  center(0) = 24, center(1) = 72, ... */
export const center = (c: number) => c * TILE + TILE / 2;
// #endregion tileOf
// 🧠 QUIZ Q12: What is tileOf(center(5))? Why is that always true?
