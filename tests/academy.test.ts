// Oops Academy safety net: every code snippet it shows must exist, and every challenge's solution must pass.
import { describe, expect, it } from 'vitest';
import { CHALLENGES, runChallenge } from '../src/learn/challenges';
import { CHAPTERS } from '../src/learn/chapters';
import { region } from '../src/learn/code';

describe('Oops Academy', () => {
  for (const ch of CHAPTERS) {
    for (const b of ch.blocks) {
      if (b.t === 'code') it(`${ch.id}: snippet ${b.file}#${b.region} exists`, () => {
        expect(region(b.file, b.region).code.length).toBeGreaterThan(20);
      });
      if (b.t === 'challenge') it(`${ch.id}: challenge ${b.id} exists`, () => expect(CHALLENGES[b.id]).toBeDefined());
      if (b.t === 'quiz') it(`${ch.id}: quiz answer is a real option`, () => expect(b.options[b.answer]).toBeDefined());
    }
  }
  for (const c of Object.values(CHALLENGES)) {
    it(`challenge ${c.id}: the solution passes and the starter does not`, () => {
      const good = runChallenge(c, c.solution);
      expect(good.error).toBeUndefined();
      expect(good.results.every(r => r.ok), JSON.stringify(good.results)).toBe(true);
      expect(runChallenge(c, c.starter).results.every(r => r.ok)).toBe(false);
    });
  }
});
