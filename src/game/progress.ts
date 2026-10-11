// =============================================================================
// 📘 LESSON: Rewards — outfits, socks, stickers
// =============================================================================
// Everything here is saved in localStorage (see levels.ts). After every level, recordRun() adds that run's
// numbers (hugs, donuts eaten, skids...) to lifetime STATS, then checks every sticker's `done` rule.
// 💡 EXAMPLE: the 'Hug Magnet' sticker's rule is  s => s.hugs >= 10.  That's an "arrow function": give it the
//    stats `s`, it answers true or false. Adding a sticker = adding one line to STICKERS.
// 🧪 TRY IT: add a sticker { id: 'early', icon: '🐣', name: 'Early Bird', desc: 'Finish 1 level.', done: s => s.sneaky + s.fast >= 1 }
// 🧠 QUIZ Q29: How many stars do you need to unlock the Pineapple Helmet?
// =============================================================================
import { CAMPAIGN } from '../sim/campaign';
import type { Difficulty } from '../sim/config';
import type { World } from '../sim/world';
import { DEFAULT_OUTFIT, type Outfit } from './art/characters';
import { loadStars } from './levels';

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(key: string, v: unknown): void { localStorage.setItem(key, JSON.stringify(v)); }

export const totalStars = () => Object.values(loadStars()).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Outfits
// ---------------------------------------------------------------------------
export interface OutfitDef { id: string; name: string; stars: number; icon: string; outfit: Outfit }

export const OUTFITS: OutfitDef[] = [
  { id: 'classic', name: 'Holiday Classic', stars: 0, icon: '🌺', outfit: DEFAULT_OUTFIT },
  { id: 'cap', name: 'Backwards Cap', stars: 3, icon: '🧢', outfit: { ...DEFAULT_OUTFIT, hat: 'cap' } },
  { id: 'banana', name: 'Banana Shirt', stars: 6, icon: '🍌', outfit: { shirt: 0xffd23c, flower: 0x8a5a36, shorts: 0x4ae07a, hat: 'none' } },
  { id: 'propeller', name: 'Propeller Hat', stars: 10, icon: '🚁', outfit: { shirt: 0x4ad6ff, flower: 0xffffff, shorts: 0x3a6ad6, hat: 'propeller' } },
  { id: 'pineapple', name: 'Pineapple Helmet', stars: 15, icon: '🍍', outfit: { shirt: 0x3ab054, flower: 0xffd23c, shorts: 0xffa028, hat: 'pineapple' } },
  { id: 'berry', name: 'Berry Blast', stars: 20, icon: '🫐', outfit: { shirt: 0xb98cff, flower: 0xff6eb4, shorts: 0x2a1f45, hat: 'cap' } },
  { id: 'royal', name: 'Royal Tourist', stars: 28, icon: '👑', outfit: { shirt: 0xff4d6d, flower: 0xffd23c, shorts: 0x9b6bd6, hat: 'crown' } },
  { id: 'local', name: 'Honorary Local', stars: 36, icon: '👽', outfit: { shirt: 0x37c8b4, flower: 0xffffff, shorts: 0x2a8a7a, hat: 'propeller' } },
];

export const unlockedOutfits = () => OUTFITS.filter(o => totalStars() >= o.stars);
export function currentOutfit(): OutfitDef {
  const id = localStorage.getItem('oops.outfit') ?? 'classic';
  return unlockedOutfits().find(o => o.id === id) ?? OUTFITS[0];
}
export function wearOutfit(id: string): void { localStorage.setItem('oops.outfit', id); }

// ---------------------------------------------------------------------------
// Socks
// ---------------------------------------------------------------------------
export const socksFound = () => new Set(load<string[]>('oops.socks', []));
function addSock(id: string): boolean {
  const s = socksFound();
  if (s.has(id)) return false;
  s.add(id);
  save('oops.socks', [...s]);
  return true;
}

// ---------------------------------------------------------------------------
// Stats & stickers
// ---------------------------------------------------------------------------
export interface RunStats { hugs: number; donutsEaten: number; heavyDonuts: number; honks: number; moonwalks: number; skids: number; escapes: number; ran: boolean }
export const emptyRun = (): RunStats => ({ hugs: 0, donutsEaten: 0, heavyDonuts: 0, honks: 0, moonwalks: 0, skids: 0, escapes: 0, ran: false });

interface Stats {
  hugs: number; donutsEaten: number; heavyDonuts: number; honks: number; moonwalks: number; skids: number; escapes: number;
  sneaky: number; fast: number; quietSchool: number; finishedGame: boolean; hardFinale: boolean;
}
const EMPTY_STATS: Stats = {
  hugs: 0, donutsEaten: 0, heavyDonuts: 0, honks: 0, moonwalks: 0, skids: 0, escapes: 0,
  sneaky: 0, fast: 0, quietSchool: 0, finishedGame: false, hardFinale: false,
};
const loadStats = (): Stats => ({ ...EMPTY_STATS, ...load<Partial<Stats>>('oops.stats', {}) });

export interface Sticker { id: string; icon: string; name: string; desc: string; done: (s: Stats) => boolean }

const zonePerfect = (zi: number) => CAMPAIGN[zi].levels.every(id => (loadStars()[id] ?? 0) >= 3);

export const STICKERS: Sticker[] = [
  { id: 'first-hug', icon: '🤗', name: 'First Hug', desc: 'Get hugged by an alien.', done: s => s.hugs >= 1 },
  { id: 'hug-magnet', icon: '🧲', name: 'Hug Magnet', desc: 'Get hugged 10 times. They really like you.', done: s => s.hugs >= 10 },
  { id: 'sneaky', icon: '🥷', name: 'Sneaky Tourist', desc: 'Finish a level without ever being chased.', done: s => s.sneaky >= 1 },
  { id: 'ghost', icon: '👻', name: 'Total Ghost', desc: 'Finish 6 levels without being chased.', done: s => s.sneaky >= 6 },
  { id: 'speedy', icon: '⏱️', name: 'Speedy Tourist', desc: 'Beat a par time.', done: s => s.fast >= 1 },
  { id: 'donut', icon: '🍩', name: 'Donut Diplomat', desc: 'Feed 10 donuts to aliens.', done: s => s.donutsEaten >= 10 },
  { id: 'bertha', icon: '🥪', name: "Bertha's Best Friend", desc: 'Feed a donut to a Heavy.', done: s => s.heavyDonuts >= 1 },
  { id: 'honk', icon: '🎺', name: 'Honk Honk', desc: 'Honk 25 times.', done: s => s.honks >= 25 },
  { id: 'moon', icon: '👟', name: 'Moonwalker', desc: 'Moonwalk 10 times.', done: s => s.moonwalks >= 10 },
  { id: 'skid', icon: '💨', name: 'Skid Master', desc: 'Make chasing aliens skid 20 times.', done: s => s.skids >= 20 },
  { id: 'escape', icon: '🏃', name: 'Escape Artist', desc: 'Lose a chaser 5 times.', done: s => s.escapes >= 5 },
  { id: 'tiptoe', icon: '🤫', name: 'Tiptoe', desc: 'Finish a School level without running once.', done: s => s.quietSchool >= 1 },
  { id: 'socks6', icon: '🧦', name: 'Sock Hunter', desc: 'Find 6 hidden socks.', done: () => socksFound().size >= 6 },
  { id: 'socks12', icon: '🧺', name: 'Laundry Day', desc: 'Find all 12 hidden socks.', done: () => socksFound().size >= 12 },
  { id: 'perfect', icon: '🌟', name: 'Perfect Zone', desc: 'Get 3 stars on every level of a zone.', done: () => CAMPAIGN.some((_, zi) => zonePerfect(zi)) },
  { id: 'blastoff', icon: '🚀', name: 'Blast Off!', desc: 'Finish the game.', done: s => s.finishedGame },
  { id: 'hard', icon: '🏆', name: 'Hard Mode Hero', desc: 'Finish 4-3 on Hard.', done: s => s.hardFinale },
];

export const stickersEarned = () => new Set(load<string[]>('oops.stickers', []));

export interface RecordResult { newStickers: Sticker[]; newOutfits: OutfitDef[]; newSock: boolean }

/** Fold one finished run into lifetime progress. Call after stars are saved. */
export function recordRun(levelId: string, zone: number, difficulty: Difficulty, w: World, run: RunStats, starsBefore: number): RecordResult {
  const s = loadStats();
  s.hugs += run.hugs; s.donutsEaten += run.donutsEaten; s.heavyDonuts += run.heavyDonuts; s.honks += run.honks;
  s.moonwalks += run.moonwalks; s.skids += run.skids; s.escapes += run.escapes;
  let newSock = false;
  if (w.status === 'won') {
    if (w.timesChased === 0) s.sneaky++;
    if (w.time <= w.level.parTime) s.fast++;
    if (zone === 1 && !run.ran) s.quietSchool++;
    if (levelId === '4-3') { s.finishedGame = true; if (difficulty === 'hard') s.hardFinale = true; }
    if (w.socks.some(k => k.taken)) newSock = addSock(levelId);
  }
  save('oops.stats', s);
  const earned = stickersEarned();
  const newStickers = STICKERS.filter(st => !earned.has(st.id) && st.done(s));
  for (const st of newStickers) earned.add(st.id);
  save('oops.stickers', [...earned]);
  const newOutfits = OUTFITS.filter(o => o.stars > starsBefore && o.stars <= totalStars());
  return { newStickers, newOutfits, newSock };
}
