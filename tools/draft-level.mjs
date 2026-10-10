// Drafts a Tiled map (.tmj) from an ASCII spec, so a level can be blocked out quickly and then polished in Tiled.
// Usage: node tools/draft-level.mjs levels/drafts/sandbox.mjs   -> writes levels/<id>.tmj
// Legend: # wall  . floor  H hedge  G gate  ~ carpet  ! squeaky  ^ > v < conveyors
//         o pressure plate  | laser  = shield
//         P PlayerStart  K Key  I Item  C Checkpoint  L Lever  T Terminal   (all on floor)
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const S = 48;
const CODE = {
  '#': 2, '.': 1, H: 3, G: 4, '~': 5, '!': 6, '^': 7, '>': 8, v: 9, '<': 10, o: 11, '|': 12, '=': 13,
  P: 1, K: 1, I: 1, C: 1, L: 1, T: 1,
};
const MARK = { P: 'PlayerStart', K: 'Key', I: 'Item', C: 'Checkpoint', L: 'Lever', T: 'Terminal' };

const specPath = process.argv[2];
if (!specPath) { console.error('usage: node tools/draft-level.mjs <spec.mjs>'); process.exit(1); }
const spec = (await import(pathToFileURL(resolve(specPath)).href)).default;

const h = spec.grid.length, w = spec.grid[0].length;
spec.grid.forEach((row, r) => { if (row.length !== w) throw new Error(`row ${r} is ${row.length} wide, expected ${w}`); });

const data = [], objects = [];
let nextId = 1;
const ctr = n => n * S + S / 2;
const prop = (name, value) => ({ name, type: typeof value === 'number' ? 'float' : typeof value === 'boolean' ? 'bool' : 'string', value });

spec.grid.forEach((row, r) => [...row].forEach((ch, c) => {
  if (!(ch in CODE)) throw new Error(`unknown char "${ch}" at (${c},${r})`);
  data.push(CODE[ch]);
  if (MARK[ch]) objects.push({ id: nextId++, name: '', type: MARK[ch], x: ctr(c), y: ctr(r), width: 0, height: 0, rotation: 0, visible: true, point: true });
}));

for (const a of spec.aliens ?? []) {
  const { route, name: _name, ...rest } = a;
  const props = Object.entries(rest).map(([k, v]) => prop(k, v));
  const [c0, r0] = route[0];
  const o = { id: nextId++, name: a.name ?? '', type: 'Alien', x: ctr(c0), y: ctr(r0), width: 0, height: 0, rotation: 0, visible: true, properties: props };
  if (route.length > 1) o.polyline = route.map(([c, r]) => ({ x: (c - c0) * S, y: (r - r0) * S }));
  else o.point = true;
  objects.push(o);
}

const map = {
  compressionlevel: -1, height: h, width: w, infinite: false, orientation: 'orthogonal', renderorder: 'right-down',
  tiledversion: '1.10.2', version: '1.10', type: 'map', tilewidth: S, tileheight: S,
  nextlayerid: 3, nextobjectid: nextId,
  properties: [
    prop('name', spec.name), prop('hint', spec.hint ?? ''), prop('parTime', spec.parTime ?? 60),
    prop('alarmAfter', spec.alarmAfter ?? 0),
  ],
  tilesets: [{ firstgid: 1, source: 'tiles.tsx' }],
  layers: [
    { id: 1, name: 'ground', type: 'tilelayer', width: w, height: h, x: 0, y: 0, opacity: 1, visible: true, data },
    { id: 2, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
  ],
};
const out = `levels/${spec.id}.tmj`;
writeFileSync(out, JSON.stringify(map, null, 1) + '\n');
console.log(`wrote ${out} (${w}x${h}, ${objects.length} objects)`);
