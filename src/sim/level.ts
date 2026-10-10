// Level data model + loader for Tiled (.tmj) maps. See DESIGN.md "Tiled conventions".
import { ALIEN_KINDS, TILE, type AlienKind } from './config';

export const T = {
  Empty: 0,
  Floor: 1,
  Wall: 2,
  Hedge: 3,
  Gate: 4,       // opens with a key, stays open
  Carpet: 5,     // silent running
  Squeaky: 6,    // noisy even when walking
  ConvUp: 7,
  ConvRight: 8,
  ConvDown: 9,
  ConvLeft: 10,
  Plate: 11,     // pressure plate: held down by a Heavy
  Laser: 12,     // open while any plate is held
  Shield: 13,    // drops for good once every terminal is hacked
} as const;
export type TileCode = (typeof T)[keyof typeof T];
export const MAX_TILE = T.Shield;

export const isConveyor = (t: TileCode) => t >= T.ConvUp && t <= T.ConvLeft;
export const CONVEYOR_DIR: Record<number, [number, number]> = {
  [T.ConvUp]: [0, -1], [T.ConvRight]: [1, 0], [T.ConvDown]: [0, 1], [T.ConvLeft]: [-1, 0],
};

export type { AlienKind };

export interface Vec { x: number; y: number }

export interface AlienSpec {
  kind: AlienKind;
  x: number;
  y: number;
  route: Vec[];          // tile-center waypoints; empty = stays put
  loop: boolean;         // cycle the route instead of ping-pong
  speed?: number;        // patrol speed override
  facing?: number;       // radians, for lookouts / sleepers
  turnEvery?: number;    // seconds, for lookouts
  pause?: number;        // seconds to wait at each waypoint
  name?: string;         // named aliens get catchphrases
}

export interface LevelData {
  name: string;
  hint: string;
  width: number;         // tiles
  height: number;        // tiles
  tiles: TileCode[];     // row-major
  start: Vec;
  checkpoints: Vec[];
  keys: Vec[];
  items: Vec[];
  levers: Vec[];
  terminals: Vec[];
  aliens: AlienSpec[];
  parTime: number;       // seconds, for the speed star
  alarmAfter: number;    // pickups (keys + items) before the alarm goes off (0 = never)
}

/** Snap a pixel position to the center of the tile containing it. */
export function snapToTile(p: Vec): Vec {
  return { x: Math.floor(p.x / TILE) * TILE + TILE / 2, y: Math.floor(p.y / TILE) * TILE + TILE / 2 };
}

export function emptyLevel(width: number, height: number): LevelData {
  return {
    name: 'Untitled', hint: '', width, height, tiles: new Array(width * height).fill(T.Wall),
    start: { x: TILE * 1.5, y: TILE * 1.5 }, checkpoints: [], keys: [], items: [], levers: [], terminals: [],
    aliens: [], parTime: 60, alarmAfter: 0,
  };
}

// --- Tiled JSON (subset we use) ---
interface TiledProperty { name: string; type?: string; value: unknown }
interface TiledObject {
  id: number; name?: string; type?: string; class?: string;
  x: number; y: number; point?: boolean; width?: number; height?: number;
  polyline?: Vec[]; polygon?: Vec[]; properties?: TiledProperty[];
}
interface TiledLayer {
  type: 'tilelayer' | 'objectgroup' | string; name: string;
  data?: number[]; objects?: TiledObject[];
}
export interface TiledMap {
  width: number; height: number; tilewidth: number; tileheight: number;
  layers: TiledLayer[]; tilesets: { firstgid: number }[]; properties?: TiledProperty[];
}

const FLIP_MASK = 0x1fffffff; // strip Tiled flip/rotation flags

function props(list?: TiledProperty[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of list ?? []) out[p.name] = p.value;
  return out;
}

const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));

export function loadTiled(map: TiledMap, fallbackName = 'Untitled'): LevelData {
  if (map.tilewidth !== TILE || map.tileheight !== TILE) {
    throw new Error(`Level must use ${TILE}px tiles (got ${map.tilewidth}x${map.tileheight})`);
  }
  const ground = map.layers.find(l => l.type === 'tilelayer' && l.name === 'ground');
  if (!ground?.data) throw new Error('Level needs a tile layer named "ground"');
  const firstgid = map.tilesets[0]?.firstgid ?? 1;

  const mp = props(map.properties);
  const level = emptyLevel(map.width, map.height);
  level.name = String(mp.name ?? fallbackName);
  level.hint = String(mp.hint ?? '');
  level.parTime = num(mp.parTime) ?? 60;
  level.alarmAfter = num(mp.alarmAfter) ?? 0;
  level.tiles = ground.data.map(gid => {
    const g = gid & FLIP_MASK;
    if (g === 0) return T.Empty;
    const code = g - firstgid + 1;
    return (code >= T.Floor && code <= MAX_TILE ? code : T.Wall) as TileCode;
  });

  let sawStart = false;
  for (const layer of map.layers) {
    if (layer.type !== 'objectgroup') continue;
    for (const o of layer.objects ?? []) {
      const cls = o.type || o.class || o.name || '';
      const p = props(o.properties);
      const pos = snapToTile({ x: o.x, y: o.y });
      switch (cls) {
        case 'PlayerStart': level.start = pos; sawStart = true; break;
        case 'Checkpoint': level.checkpoints.push(pos); break;
        case 'Key': level.keys.push(pos); break;
        case 'Item': level.items.push(pos); break;
        case 'Lever': level.levers.push(pos); break;
        case 'Terminal': level.terminals.push(pos); break;
        case 'Alien': {
          const kind = String(p.kind ?? 'stroller') as AlienKind;
          if (!ALIEN_KINDS.includes(kind)) throw new Error(`Alien ${o.id}: unknown kind "${kind}"`);
          const pts = o.polyline ?? o.polygon;
          const route = pts ? pts.map(q => snapToTile({ x: o.x + q.x, y: o.y + q.y })) : [];
          const facing = num(p.facing);
          level.aliens.push({
            kind,
            x: route[0]?.x ?? pos.x,
            y: route[0]?.y ?? pos.y,
            route,
            loop: Boolean(p.loop ?? Boolean(o.polygon)),
            speed: num(p.speed),
            facing: facing !== undefined ? (facing * Math.PI) / 180 : undefined,
            turnEvery: num(p.turnEvery),
            pause: num(p.pause),
            name: o.name || undefined,
          });
          break;
        }
        default:
          throw new Error(`Unknown object class "${cls}" (object ${o.id})`);
      }
    }
  }
  if (!sawStart) throw new Error('Level needs a PlayerStart object');
  return level;
}
