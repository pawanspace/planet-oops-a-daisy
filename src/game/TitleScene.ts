// Living title screen behind the menu: the daisy planet turning, the ship being rebuilt, locals strolling backwards.
import Phaser from 'phaser';
import type { AlienKind } from '../sim/config';
import type { Alien } from '../sim/world';
import { drawAlien } from './art/characters';
import { drawDaisyPlanet, drawShip, drawSpace } from './art/scenery';

const W = 960, H = 540;
const WALKERS: AlienKind[] = ['stroller', 'kid', 'heavy', 'lookout', 'hugger', 'kid', 'stroller'];

function walker(kind: AlienKind, i: number, x: number, y: number): Alien {
  return {
    id: i, kind, spec: { kind, x, y, route: [], loop: false }, x, y, heading: { x: 1, y: 0 }, speed: 60, look: Math.PI, state: 'patrol',
    resume: 'patrol', stateT: 0, sus: 0, routeIdx: 0, routeDir: 1, pauseT: 0, skidding: false, untangle: 0, lastSeen: { x, y },
    lostT: 0, goal: { x, y }, lookoutT: 0, baseLook: 0, alarmT: 0,
  };
}

export class TitleScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private t = 0;
  private parts: boolean[] = [false, false, false, false];
  constructor() { super('title'); }

  init(data: { parts?: boolean[] }): void {
    this.parts = data.parts ?? this.parts;
  }

  create(): void {
    this.g = this.add.graphics();
    const fit = () => {
      const cam = this.cameras.main;
      cam.setZoom(Math.max(this.scale.width / W, this.scale.height / H));
      cam.centerOn(W / 2, H / 2);
    };
    fit();
    this.scale.on('resize', fit);
    this.events.once('shutdown', () => this.scale.off('resize', fit));
  }

  update(_time: number, dms: number): void {
    this.t += dms / 1000;
    const g = this.g, t = this.t;
    g.clear();
    drawSpace(g, W, H, t, t * 15);
    // Planet peeking up from the bottom; the menu sits above it.
    const px = W / 2, py = H + 48, r = 300, surface = r * 0.86;
    drawDaisyPlanet(g, px, py, r, t * 0.3);
    const shipA = -2.25;
    drawShip(g, px + Math.cos(shipA) * (surface + 18), py + Math.sin(shipA) * (surface + 18), 1.4, t, this.parts, 0, shipA + Math.PI / 2);
    // locals strolling across the planet, eyes looking back the way they came
    WALKERS.forEach((kind, i) => {
      const a = -1.95 + ((t * 0.035 + i / WALKERS.length) % 1) * 1.15;
      const x = px + Math.cos(a) * surface, y = py + Math.sin(a) * surface;
      drawAlien(g, walker(kind, i, x, y), { face: -1, walk: t * 8 + i }, t + i, false);
    });
  }
}
