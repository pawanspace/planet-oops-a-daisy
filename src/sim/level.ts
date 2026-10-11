// =============================================================================
// 📘 LESSON: What is a level, to a computer?
// =============================================================================
// A level is just DATA: a list of numbers for the floor plan, plus a list of "objects" (where Leo starts,
// where the key is, which aliens walk where). This file has two jobs:
//   1. Describe that data (the `LevelData` shape below).
//   2. Read a map made in the free "Tiled" map editor (a .tmj file, which is JSON text) and turn it into LevelData.
//
// THE GRID: the map is a grid of tiles, counted in COLUMNS (c, left → right) and ROWS (r, top → bottom).
// Tile (0, 0) is the top-left corner. In pixels, tile (c, r) covers x = c*48 … c*48+47 and y = r*48 … r*48+47.
//
// 💡 EXAMPLE: a tiny 5 × 3 level, written as text (this is how tools/gen-campaign.py drafts levels):
//
//        #####        # = wall
//        #P.K#        . = floor,  P = Leo starts here,  K = key
//        #####
//
//    The computer stores the floor plan as ONE long list, row after row ("row-major"):
//        [2,2,2,2,2,  2,1,1,1,2,  2,2,2,2,2]      (2 = wall, 1 = floor)
//    To find tile (c, r) in that list we use index = r * width + c.  So tile (3, 1) is index 1*5 + 3 = 8.
//
// 🧠 QUIZ Q7: In a level 20 tiles wide, what list index is tile (c=4, r=2)?
// =============================================================================
import { ALIEN_KINDS, TILE, type AlienKind } from './config';

/**
 * Tile codes: the number stored for each square of the map.
 * `as const` tells TypeScript these exact numbers never change, so T.Wall is always 2.
 */
export const T = {
  Empty: 0,      // outside the map (treated like a wall)
  Floor: 1,
  Wall: 2,
  Hedge: 3,      // a "soft" wall: bush, desk, crate or container depending on the zone (same rules as a wall)
  Gate: 4,       // opens with a key, stays open
  Carpet: 5,     // running on it is silent
  Squeaky: 6,    // noisy even when walking
  ConvUp: 7,     // conveyor belts push Leo in their direction
  ConvRight: 8,
  ConvDown: 9,
  ConvLeft: 10,
  Plate: 11,     // pressure plate: held down by a Heavy
  Laser: 12,     // open while any plate is held
  Shield: 13,    // drops for good once every terminal is hacked
} as const;

/** "Any one of the values in T": 0, 1, 2 ... 13. */
export type TileCode = (typeof T)[keyof typeof T];
export const MAX_TILE = T.Shield;

/** Is this tile one of the four conveyor belts? (They are numbered 7 to 10, so a range check works.) */
export const isConveyor = (t: TileCode) => t >= T.ConvUp && t <= T.ConvLeft;

/**
 * Which way each belt pushes, as [dx, dy]. Screen y grows DOWNWARDS, so "up" is y = -1.
 * 💡 EXAMPLE: CONVEYOR_DIR[T.ConvLeft] is [-1, 0]: push left, don't move up or down.
 */
export const CONVEYOR_DIR: Record<number, [number, number]> = {
  [T.ConvUp]: [0, -1], [T.ConvRight]: [1, 0], [T.ConvDown]: [0, 1], [T.ConvLeft]: [-1, 0],
};

export type { AlienKind };

/** A point or a direction: { x, y } in pixels. ("Vec" is short for vector.) */
export interface Vec { x: number; y: number }

/** Everything the level file says about one alien. */
export interface AlienSpec {
  kind: AlienKind;
  x: number;             // starting position (pixel centre of a tile)
  y: number;
  route: Vec[];          // tile-centre waypoints to patrol between; empty = stays put
  loop: boolean;         // true: A→B→C→A→B… ; false ("ping-pong"): A→B→C→B→A…
  speed?: number;        // patrol speed override (otherwise the kind's speed from config.ts)
  facing?: number;       // starting look direction in radians (lookouts, sleepers, door guards)
  turnEvery?: number;    // seconds between a lookout's turns
  pause?: number;        // seconds to wait at each waypoint
  name?: string;         // named aliens (Blorp!) get name tags and catchphrases
}

/** A whole level, ready for the simulation. Positions are in pixels, sizes in tiles. */
export interface LevelData {
  name: string;
  hint: string;          // the tip shown at the start
  width: number;         // tiles
  height: number;        // tiles
  tiles: TileCode[];     // the floor plan, row-major (see the LESSON above)
  start: Vec;
  checkpoints: Vec[];
  keys: Vec[];
  items: Vec[];          // ship parts: collect them all to win
  levers: Vec[];
  terminals: Vec[];
  socks: Vec[];          // hidden collectible (optional, not needed to win)
  aliens: AlienSpec[];
  parTime: number;       // seconds, for the speed star
  alarmAfter: number;    // pickups (keys + items) before the alarm goes off (0 = never)
  theme?: string;        // zone look for custom levels: 'suburbia' | 'school' | 'market' | 'spaceport'
}

/**
 * Snap a pixel position to the centre of the tile it is in.
 * 💡 EXAMPLE: (100, 30) is in tile (2, 0) because 100 / 48 = 2.08 → 2 and 30 / 48 = 0.6 → 0.
 *    The centre of tile (2, 0) is x = 2*48 + 24 = 120, y = 0*48 + 24 = 24. So we return (120, 24).
 * 🧠 QUIZ Q8: Where does (47, 49) snap to?
 */
export function snapToTile(p: Vec): Vec {
  return { x: Math.floor(p.x / TILE) * TILE + TILE / 2, y: Math.floor(p.y / TILE) * TILE + TILE / 2 };
}

/** A blank level (all walls) to fill in. Used by the loader below and by tests. */
export function emptyLevel(width: number, height: number): LevelData {
  return {
    name: 'Untitled', hint: '', width, height, tiles: new Array(width * height).fill(T.Wall),
    start: { x: TILE * 1.5, y: TILE * 1.5 }, checkpoints: [], keys: [], items: [], levers: [], terminals: [], socks: [],
    aliens: [], parTime: 60, alarmAfter: 0,
  };
}

// -----------------------------------------------------------------------------
// Reading Tiled maps
// -----------------------------------------------------------------------------
// A .tmj file looks roughly like this (trimmed):
//   { "width": 24, "height": 12, "tilewidth": 48,
//     "layers": [ { "name": "ground", "data": [3, 3, 3, 2, 2, ...] },
//                 { "name": "objects", "objects": [ { "type": "PlayerStart", "x": 72, "y": 72 }, ... ] } ] }
// The interfaces below describe only the parts we use, so TypeScript can check we read them correctly.

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

/**
 * Tiled stores "this tile is flipped / rotated" in the top 3 bits of each tile number.
 * `gid & FLIP_MASK` keeps only the low bits, which is the real tile number. (The & is "bitwise AND".)
 */
const FLIP_MASK = 0x1fffffff;

/** Tiled stores custom properties as a list [{name, value}]. Turn that into a simple { name: value } object. */
function props(list?: TiledProperty[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of list ?? []) out[p.name] = p.value;
  return out;
}

/** A number, or undefined if the property is missing/blank. */
const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));

/**
 * Turn a Tiled map into LevelData. Throws a readable error if the map breaks our rules, so a typo in a level
 * shows up straight away instead of as a weird bug later.
 */
export function loadTiled(map: TiledMap, fallbackName = 'Untitled'): LevelData {
  if (map.tilewidth !== TILE || map.tileheight !== TILE) {
    throw new Error(`Level must use ${TILE}px tiles (got ${map.tilewidth}x${map.tileheight})`);
  }
  const ground = map.layers.find(l => l.type === 'tilelayer' && l.name === 'ground');
  if (!ground?.data) throw new Error('Level needs a tile layer named "ground"');
  // Tiled numbers tiles starting at "firstgid" (usually 1). Our tileset's first tile is Floor (code 1).
  const firstgid = map.tilesets[0]?.firstgid ?? 1;

  const mp = props(map.properties);
  const level = emptyLevel(map.width, map.height);
  level.name = String(mp.name ?? fallbackName);
  level.hint = String(mp.hint ?? '');
  level.parTime = num(mp.parTime) ?? 60;
  level.alarmAfter = num(mp.alarmAfter) ?? 0;
  if (mp.theme) level.theme = String(mp.theme);
  // Convert every Tiled tile number into one of our tile codes. Anything unknown becomes a wall (safe default).
  level.tiles = ground.data.map(gid => {
    const g = gid & FLIP_MASK;
    if (g === 0) return T.Empty;       // 0 means "no tile painted here"
    const code = g - firstgid + 1;
    return (code >= T.Floor && code <= MAX_TILE ? code : T.Wall) as TileCode;
  });

  // Now the objects: each one has a "type" (Tiled calls it Class) that tells us what it is.
  let sawStart = false;
  for (const layer of map.layers) {
    if (layer.type !== 'objectgroup') continue;
    for (const o of layer.objects ?? []) {
      const cls = o.type || o.class || o.name || '';
      const p = props(o.properties);
      const pos = snapToTile({ x: o.x, y: o.y }); // objects always sit in the middle of a tile
      switch (cls) {
        case 'PlayerStart': level.start = pos; sawStart = true; break;
        case 'Checkpoint': level.checkpoints.push(pos); break;
        case 'Key': level.keys.push(pos); break;
        case 'Item': level.items.push(pos); break;
        case 'Lever': level.levers.push(pos); break;
        case 'Terminal': level.terminals.push(pos); break;
        case 'Sock': level.socks.push(pos); break;
        case 'Alien': {
          const kind = String(p.kind ?? 'stroller') as AlienKind;
          if (!ALIEN_KINDS.includes(kind)) throw new Error(`Alien ${o.id}: unknown kind "${kind}"`);
          // A polyline is drawn in Tiled as a line with corners: those corners are the patrol route.
          // Its points are stored RELATIVE to the object's position, so we add o.x / o.y back on.
          const pts = o.polyline ?? o.polygon;
          const route = pts ? pts.map(q => snapToTile({ x: o.x + q.x, y: o.y + q.y })) : [];
          const facing = num(p.facing);
          level.aliens.push({
            kind,
            x: route[0]?.x ?? pos.x,
            y: route[0]?.y ?? pos.y,
            route,
            loop: Boolean(p.loop ?? Boolean(o.polygon)), // a closed polygon loops by default
            speed: num(p.speed),
            // Level files use degrees (easier for people); the code uses radians (easier for maths).
            // 180° = π radians, so degrees × π / 180 = radians.
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
// 🧠 QUIZ Q9: A lookout has facing = 90 in the level file. How many radians is that, and which way is it looking
//            on screen? (Hint: y grows downwards.)

// -----------------------------------------------------------------------------
// Writing Tiled maps (used by the level editor's Export button and "My levels")
// -----------------------------------------------------------------------------
/**
 * The opposite of loadTiled: turn LevelData back into a Tiled map, so a level made in the in-game editor can be
 * opened in Tiled or copied into /levels. loadTiled(toTiled(level)) gives the same level back.
 */
export function toTiled(level: LevelData): TiledMap & Record<string, unknown> {
  let id = 1;
  const prop = (name: string, value: unknown) => ({ name, type: typeof value === 'number' ? 'float' : typeof value === 'boolean' ? 'bool' : 'string', value });
  const point = (type: string, v: Vec): TiledObject & Record<string, unknown> =>
    ({ id: id++, name: '', type, x: v.x, y: v.y, width: 0, height: 0, rotation: 0, visible: true, point: true });
  const objects: (TiledObject & Record<string, unknown>)[] = [point('PlayerStart', level.start)];
  for (const v of level.checkpoints) objects.push(point('Checkpoint', v));
  for (const v of level.keys) objects.push(point('Key', v));
  for (const v of level.items) objects.push(point('Item', v));
  for (const v of level.levers) objects.push(point('Lever', v));
  for (const v of level.terminals) objects.push(point('Terminal', v));
  for (const v of level.socks) objects.push(point('Sock', v));
  for (const a of level.aliens) {
    const properties = [prop('kind', a.kind)];
    if (a.speed !== undefined) properties.push(prop('speed', a.speed));
    if (a.facing !== undefined) properties.push(prop('facing', Math.round((a.facing * 180) / Math.PI)));
    if (a.turnEvery !== undefined) properties.push(prop('turnEvery', a.turnEvery));
    if (a.pause !== undefined) properties.push(prop('pause', a.pause));
    if (a.loop) properties.push(prop('loop', true));
    const o: TiledObject & Record<string, unknown> = {
      id: id++, name: a.name ?? '', type: 'Alien', x: a.x, y: a.y, width: 0, height: 0, rotation: 0, visible: true, properties,
    };
    if (a.route.length > 1) o.polyline = a.route.map(p => ({ x: p.x - a.x, y: p.y - a.y }));
    else o.point = true;
    objects.push(o);
  }
  const mapProps = [prop('name', level.name), prop('hint', level.hint), prop('parTime', level.parTime), prop('alarmAfter', level.alarmAfter)];
  if (level.theme) mapProps.push(prop('theme', level.theme));
  return {
    compressionlevel: -1, width: level.width, height: level.height, infinite: false, orientation: 'orthogonal',
    renderorder: 'right-down', tiledversion: '1.10.2', version: '1.10', type: 'map', tilewidth: TILE, tileheight: TILE,
    nextlayerid: 3, nextobjectid: id, properties: mapProps,
    tilesets: [{ firstgid: 1, source: 'tiles.tsx' }],
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', width: level.width, height: level.height, x: 0, y: 0, opacity: 1, visible: true, data: [...level.tiles] },
      { id: 2, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
    ],
  } as unknown as TiledMap & Record<string, unknown>;
}
