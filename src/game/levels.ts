// =============================================================================
// Level registry + saved stars.
// Maps are Tiled .tmj files in /levels. `import.meta.glob` is a Vite feature that finds every matching file when
// the game is BUILT and bundles them in, so adding a new level file is enough for the game to see it.
// Stars are saved in the browser's localStorage: a small notebook each website can write to, which survives
// closing the browser. 💡 localStorage only stores text, so we turn objects into JSON text and back.
// =============================================================================
import { CAMPAIGN } from '../sim/campaign';
import { loadTiled, type LevelData, type TiledMap } from '../sim/level';

export interface LevelEntry { id: string; zone: number; data: LevelData }

const RAW = import.meta.glob('../../levels/*.tmj', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const byId = new Map<string, string>();
for (const [path, raw] of Object.entries(RAW)) byId.set(path.split('/').pop()!.replace('.tmj', ''), raw);

const parse = (id: string, zone: number): LevelEntry => {
  const raw = byId.get(id);
  if (!raw) throw new Error(`Missing level file levels/${id}.tmj`);
  return { id, zone, data: loadTiled(JSON.parse(raw) as TiledMap, id) };
};

/** Campaign levels in play order, then the sandbox. */
export const LEVELS: LevelEntry[] = [
  ...CAMPAIGN.flatMap((z, zi) => z.levels.map(id => parse(id, zi))),
  parse('sandbox', -1),
];

const STARS_KEY = 'oops.stars';
export function loadStars(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STARS_KEY) ?? '{}') as Record<string, number>; } catch { return {}; }
}
export function saveStars(id: string, stars: number): void {
  const all = loadStars();
  if ((all[id] ?? 0) >= stars) return;
  all[id] = stars;
  localStorage.setItem(STARS_KEY, JSON.stringify(all));
}
