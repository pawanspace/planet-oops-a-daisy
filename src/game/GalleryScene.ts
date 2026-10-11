// =============================================================================
// Character gallery (a developer tool): open the game with ?gallery to see every character in every pose, big.
// Great for checking art changes quickly. It builds "fake" aliens that are never part of a real World.
// =============================================================================
import Phaser from 'phaser';
import type { AlienKind } from '../sim/config';
import type { Alien, AlienState, Player } from '../sim/world';
import { DEFAULT_OUTFIT, drawAlien, drawLeo, type Mood } from './art/characters';

const KINDS: AlienKind[] = ['stroller', 'lookout', 'hugger', 'kid', 'heavy', 'scooter', 'drone'];
const STATES: AlienState[] = ['patrol', 'suspicious', 'chase', 'stunned', 'eating', 'sleep', 'hugging', 'investigate'];
const MOODS: Mood[] = ['calm', 'nervous', 'panic', 'hugged', 'smug'];

function fakeAlien(kind: AlienKind, state: AlienState, id: number, x: number, y: number): Alien {
  const moving = state === 'patrol' || state === 'chase' || state === 'investigate';
  return {
    id, kind, spec: { kind, x, y, route: [], loop: false }, x, y, heading: { x: moving ? 1 : 0, y: 0 }, speed: moving ? (state === 'chase' ? 200 : 70) : 0,
    look: state === 'chase' ? 0 : Math.PI, state, resume: 'patrol', stateT: 0, sus: state === 'suspicious' ? 0.6 : 0,
    routeIdx: 0, routeDir: 1, pauseT: 0, skidding: false, untangle: 0, lastSeen: { x, y }, lostT: 0, goal: { x, y },
    lookoutT: 0, baseLook: 0, alarmT: 0,
  };
}

export class GalleryScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private t = 0;
  constructor() { super('gallery'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0xd6c8f5).setZoom(1.6 * (window.devicePixelRatio || 1)).centerOn(300, 290);
    this.g = this.add.graphics();
    const style = { fontFamily: 'sans-serif', fontSize: '7px', color: '#2a1f45' };
    STATES.forEach((s, i) => this.add.text(60 + i * 70, 10, s, style).setOrigin(0.5));
    KINDS.forEach((k, j) => this.add.text(2, 60 + j * 62, k, style).setOrigin(0, 0.5));
    this.add.text(2, 60 + KINDS.length * 62, 'leo', style).setOrigin(0, 0.5);
  }

  update(_t: number, dms: number): void {
    this.t += dms / 1000;
    const g = this.g;
    g.clear();
    KINDS.forEach((k, j) => STATES.forEach((s, i) => {
      const a = fakeAlien(k, s, j, 60 + i * 70, 80 + j * 62);
      drawAlien(g, a, { face: i % 2 ? 1 : -1, walk: this.t * (s === 'chase' ? 14 : 8) }, this.t, s === 'hugging');
    }));
    MOODS.forEach((m, i) => {
      const p: Player = {
        x: 60 + i * 70, y: 80 + KINDS.length * 62, facing: 1, moving: i % 2 === 0, running: i === 2, hearts: 3, maxHearts: 3,
        invuln: 0, keys: 0, carried: [], moonwalkT: m === 'smug' ? 1 : 0, cd: { honk: 0, moonwalk: 0, donut: 0 }, footT: 0, respawn: { x: 0, y: 0 },
      };
      drawLeo(g, p, i % 2 ? -1 : 1, this.t * 12, m, i === 3 ? { ...DEFAULT_OUTFIT, hat: 'pineapple' } : i === 4 ? { ...DEFAULT_OUTFIT, hat: 'cap' } : DEFAULT_OUTFIT, this.t);
    });
  }
}
