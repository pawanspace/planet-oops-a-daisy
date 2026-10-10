// Tile grid queries: collision, line of sight, walking distance.
import { TILE } from './config';
import { T, type TileCode, type Vec } from './level';

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly tiles: TileCode[];
  lasersOpen = false;

  constructor(w: number, h: number, tiles: TileCode[]) {
    this.w = w;
    this.h = h;
    this.tiles = tiles.slice();
  }

  get(c: number, r: number): TileCode {
    if (c < 0 || r < 0 || c >= this.w || r >= this.h) return T.Wall;
    return this.tiles[r * this.w + c];
  }

  set(c: number, r: number, t: TileCode): void {
    if (c >= 0 && r >= 0 && c < this.w && r < this.h) this.tiles[r * this.w + c] = t;
  }

  solid(c: number, r: number): boolean {
    const t = this.get(c, r);
    return t === T.Empty || t === T.Wall || t === T.Hedge || t === T.Gate || t === T.Shield
      || (t === T.Laser && !this.lasersOpen);
  }

  /** Can a box of half-size `rad` centered at (x, y) stand here? */
  canStand(x: number, y: number, rad: number): boolean {
    const c1 = Math.floor((x - rad) / TILE), c2 = Math.floor((x + rad - 0.001) / TILE);
    const r1 = Math.floor((y - rad) / TILE), r2 = Math.floor((y + rad - 0.001) / TILE);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (this.solid(c, r)) return false;
    return true;
  }

  /** Grid-traversal line of sight between two points. */
  lineOfSight(a: Vec, b: Vec): boolean {
    let c = Math.floor(a.x / TILE), r = Math.floor(a.y / TILE);
    const ec = Math.floor(b.x / TILE), er = Math.floor(b.y / TILE);
    const dx = b.x - a.x, dy = b.y - a.y;
    const sc = Math.sign(dx), sr = Math.sign(dy);
    const tdx = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tdy = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tmx = dx > 0 ? ((c + 1) * TILE - a.x) / dx : dx < 0 ? (c * TILE - a.x) / dx : Infinity;
    let tmy = dy > 0 ? ((r + 1) * TILE - a.y) / dy : dy < 0 ? (r * TILE - a.y) / dy : Infinity;
    for (let i = 0; i < 256; i++) {
      if (c === ec && r === er) return true;
      if (tmx < tmy) { tmx += tdx; c += sc; } else { tmy += tdy; r += sr; }
      if (this.solid(c, r)) return false;
    }
    return false;
  }

  /** Walking-distance field (tiles) from (c, r). Unreachable = Infinity. */
  distField(c: number, r: number): Float64Array {
    const d = new Float64Array(this.w * this.h).fill(Infinity);
    if (this.solid(c, r)) return d;
    const q = new Int32Array(this.w * this.h);
    let head = 0, tail = 0;
    d[r * this.w + c] = 0;
    q[tail++] = r * this.w + c;
    while (head < tail) {
      const i = q[head++];
      const cc = i % this.w, rr = (i - cc) / this.w;
      const nd = d[i] + 1;
      for (let k = 0; k < 4; k++) {
        const nc = cc + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const nr = rr + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (this.solid(nc, nr)) continue;
        const j = nr * this.w + nc;
        if (d[j] <= nd) continue;
        d[j] = nd;
        q[tail++] = j;
      }
    }
    return d;
  }

  dist(field: Float64Array, c: number, r: number): number {
    if (c < 0 || r < 0 || c >= this.w || r >= this.h) return Infinity;
    return field[r * this.w + c];
  }

  /** Neighbor tile of (c, r) that is one step closer to the field's origin, or null. */
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
}

export const tileOf = (v: number) => Math.floor(v / TILE);
export const center = (c: number) => c * TILE + TILE / 2;
