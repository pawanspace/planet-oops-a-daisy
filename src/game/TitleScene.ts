// =============================================================================
// 📘 LESSON: The living title screen
// =============================================================================
// Behind the menu, a scene keeps drawing: the planet turns, the ship shows which parts you've rebuilt, Leo shows
// off his outfit, and locals stroll around the planet. They walk along a CIRCLE: a point on a circle of radius r
// around (cx, cy) at angle a is   (cx + cos(a)·r, cy + sin(a)·r).  Increase `a` slowly and they walk round.
// =============================================================================
import Phaser from 'phaser';
import type { AlienKind } from '../sim/config';
import type { Alien } from '../sim/world';
import { DEFAULT_OUTFIT, drawAlien, drawLeo, type Outfit } from './art/characters';
import type { Player } from '../sim/world';
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
  private outfit: Outfit = DEFAULT_OUTFIT;
  constructor() { super('title'); }

  init(data: { parts?: boolean[]; outfit?: Outfit }): void {
    this.parts = data.parts ?? this.parts;
    this.outfit = data.outfit ?? this.outfit;
  }

  setOutfit(o: Outfit): void { this.outfit = o; }

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
    // Leo next to his ship, showing off the current outfit
    const leoA = -2.0, lx = px + Math.cos(leoA) * surface, ly = py + Math.sin(leoA) * surface;
    const leo: Player = {
      x: lx, y: ly, facing: 1, moving: false, running: false, hearts: 3, maxHearts: 3, invuln: 0, keys: 0, carried: [], moonwalkT: 0,
      cd: { honk: 0, moonwalk: 0, donut: 0 }, footT: 0, respawn: { x: lx, y: ly },
    };
    drawLeo(g, leo, 1, 0, 'smug', this.outfit, t);
    // locals strolling across the planet, eyes looking back the way they came
    WALKERS.forEach((kind, i) => {
      const a = -1.95 + ((t * 0.035 + i / WALKERS.length) % 1) * 1.15;
      const x = px + Math.cos(a) * surface, y = py + Math.sin(a) * surface;
      drawAlien(g, walker(kind, i, x, y), { face: -1, walk: t * 8 + i }, t + i, false);
    });
  }
}
