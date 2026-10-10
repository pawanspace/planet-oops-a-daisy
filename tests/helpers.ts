import { TILE } from '../src/sim/config';
import { center } from '../src/sim/grid';
import { T, emptyLevel, type AlienKind, type AlienSpec, type LevelData, type TileCode } from '../src/sim/level';
import { NO_INPUT, type Input, type World } from '../src/sim/world';

// Same legend as tools/draft-level.mjs
export const CHARS: Record<string, TileCode> = {
  '#': T.Wall, '.': T.Floor, 'H': T.Hedge, 'G': T.Gate, '~': T.Carpet, '!': T.Squeaky,
  '^': T.ConvUp, '>': T.ConvRight, 'v': T.ConvDown, '<': T.ConvLeft, 'o': T.Plate, '|': T.Laser, '=': T.Shield,
  'P': T.Floor, 'K': T.Floor, 'I': T.Floor, 'C': T.Floor, 'L': T.Floor, 'T': T.Floor,
};

/** Build a level from ASCII (legend above). */
export function ascii(rows: string[], aliens: AlienSpec[] = [], extra: Partial<LevelData> = {}): LevelData {
  const h = rows.length, w = rows[0].length;
  const lvl = { ...emptyLevel(w, h), name: 'test', aliens, ...extra };
  const tiles: TileCode[] = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    tiles.push(CHARS[ch] ?? T.Wall);
    const pos = { x: center(c), y: center(r) };
    if (ch === 'P') lvl.start = pos;
    if (ch === 'K') lvl.keys.push(pos);
    if (ch === 'I') lvl.items.push(pos);
    if (ch === 'C') lvl.checkpoints.push(pos);
    if (ch === 'L') lvl.levers.push(pos);
    if (ch === 'T') lvl.terminals.push(pos);
  }));
  lvl.tiles = tiles;
  return lvl;
}

export function alien(kind: AlienKind, route: [number, number][], opts: Partial<AlienSpec> = {}): AlienSpec {
  const pts = route.map(([c, r]) => ({ x: center(c), y: center(r) }));
  return { kind, x: pts[0].x, y: pts[0].y, route: pts.length > 1 ? pts : [], loop: false, ...opts };
}

export function run(w: World, seconds: number, input: Partial<Input> = {}): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) w.step({ ...NO_INPUT, ...input });
}

/** Press a gadget button for exactly one step. */
export function press(w: World, button: 'honk' | 'moonwalk' | 'donut'): void {
  w.step({ ...NO_INPUT, [button]: true });
}

export function place(w: World, c: number, r: number): void {
  w.player.x = center(c);
  w.player.y = center(r);
}

export const tiles = (px: number) => px / TILE;
