// Shared bot playthrough checks for campaign levels (one test file per zone so they run in parallel).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../src/sim/config';
import { CAMPAIGN } from '../src/sim/campaign';
import { loadTiled, type TiledMap } from '../src/sim/level';
import { carefulBot, rushBot } from './bot';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

export function zonePlaythroughs(zoneIndex: number): void {
  const zone = CAMPAIGN[zoneIndex];
  describe(`zone ${zoneIndex + 1}: ${zone.name}`, () => {
    for (const id of zone.levels) {
      const lvl = loadTiled(JSON.parse(readFileSync(`levels/${id}.tmj`, 'utf8')) as TiledMap, id);
      for (const d of DIFFS) {
        it(`${id} (${d}): a careful player can finish without gadgets`, () => {
          const r = carefulBot(lvl, { difficulty: d, maxTime: 200 });
          expect(r.won, JSON.stringify(r)).toBe(true);
        }, 120_000);
      }
      if (id === '1-1') continue; // the tutorial is allowed to be gentle
      it(`${id}: rushing and spamming gadgets never gives a clean run`, () => {
        const r = rushBot(lvl, 'normal');
        expect(!r.won || r.chased > 0 || r.heartsLost > 0, JSON.stringify(r)).toBe(true);
      }, 60_000);
    }
  });
}
