// Generates levels/tiles.png + levels/tiles.tsx so the maps open nicely in Tiled.
// Tile order must match src/sim/level.ts (T): Floor .. Shield.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const S = 48;
const TILES = [
  { name: 'floor',   base: [214, 200, 245], dot: [196, 178, 236] },
  { name: 'wall',    base: [74, 52, 110],   dot: [96, 72, 138] },
  { name: 'hedge',   base: [58, 150, 84],   dot: [38, 118, 62] },
  { name: 'gate',    base: [255, 160, 40],  dot: [140, 70, 10], bars: true },
  { name: 'carpet',  base: [196, 60, 84],   dot: [224, 96, 116] },
  { name: 'squeaky', base: [255, 230, 90],  dot: [230, 190, 40], checker: true },
  { name: 'conv-up',    base: [120, 130, 150], dot: [250, 250, 120], arrow: [0, -1] },
  { name: 'conv-right', base: [120, 130, 150], dot: [250, 250, 120], arrow: [1, 0] },
  { name: 'conv-down',  base: [120, 130, 150], dot: [250, 250, 120], arrow: [0, 1] },
  { name: 'conv-left',  base: [120, 130, 150], dot: [250, 250, 120], arrow: [-1, 0] },
  { name: 'plate',   base: [214, 200, 245], dot: [90, 200, 255], ring: true },
  { name: 'laser',   base: [214, 200, 245], dot: [255, 40, 80], bars: true },
  { name: 'shield',  base: [80, 160, 255],  dot: [190, 230, 255], checker: true },
];

const W = S * TILES.length, H = S;
const px = Buffer.alloc(W * H * 4);
TILES.forEach((t, i) => {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = t.base;
    if (t.arrow) {
      const [ax, ay] = t.arrow, u = (x - 24) * ax + (y - 24) * ay, v = Math.abs((x - 24) * ay - (y - 24) * ax);
      if (v < 12 - Math.abs(((u + 48) % 16) - 8)) c = t.dot;
    }
    else if (t.ring && Math.abs(Math.hypot(x - 24, y - 24) - 14) < 4) c = t.dot;
    else if (t.checker && ((x >> 3) + (y >> 3)) % 2) c = t.dot;
    else if (t.bars && x % 12 < 4) c = t.dot;
    else if (!t.checker && !t.bars && (x * 7 + y * 13) % 29 === 0) c = t.dot;
    if (x === 0 || y === 0) c = c.map(v => Math.max(0, v - 18));
    const o = (y * W + i * S + x) * 4;
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
  }
});

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
writeFileSync('levels/tiles.png', Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));

const tiles = TILES.map((t, i) => `  <tile id="${i}" type="${t.name}"/>`).join('\n');
writeFileSync('levels/tiles.tsx', `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" name="tiles" tilewidth="${S}" tileheight="${S}" tilecount="${TILES.length}" columns="${TILES.length}">
  <image source="tiles.png" width="${W}" height="${H}"/>
${tiles}
</tileset>
`);
console.log('wrote levels/tiles.png, levels/tiles.tsx');
