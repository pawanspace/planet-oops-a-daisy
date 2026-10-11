// =============================================================================
// 📘 LESSON: The level editor's canvas
// =============================================================================
// This scene DRAWS the level being edited, using exactly the same art as the real game (so what you build is what
// you get), and turns taps/clicks into tile positions for the editor (src/editor/editor.ts), which owns the level
// data and decides what each tool does.
//
// Split of jobs:   editor.ts  = buttons, tools, undo, saving        EditorScene.ts = drawing + pointer → tile
// =============================================================================
import Phaser from 'phaser';
import { TILE } from '../sim/config';
import { Grid, tileOf } from '../sim/grid';
import type { LevelData } from '../sim/level';
import { World } from '../sim/world';
import { DEFAULT_OUTFIT, drawAlien, drawLeo } from './art/characters';
import { themeBg, type ZoneTheme } from './art/themes';
import { drawCheckpoint, drawCone, drawDynamicTiles, drawGround, drawItem, drawKey, drawLever, drawSock, drawTerminal, dynamicTiles } from './draw';

export interface EditorView {
  level: () => LevelData;
  /** Bumped by the editor whenever the level changes, so we know to redraw the ground. */
  version: () => number;
  selected: () => number;          // selected alien index, or -1
  showCones: () => boolean;
  rect: () => { c1: number; r1: number; c2: number; r2: number } | null; // rectangle-tool preview
  /** Screen area (CSS px) not covered by the editor's panels: the map is fitted inside it. */
  area: () => { x: number; y: number; w: number; h: number };
  pointer: (c: number, r: number, phase: 'down' | 'move' | 'up', button: number) => void;
  hover: (c: number, r: number) => void;
}

export class EditorScene extends Phaser.Scene {
  private view!: EditorView;
  private ground!: Phaser.GameObjects.Graphics;
  private g!: Phaser.GameObjects.Graphics;
  private over!: Phaser.GameObjects.Graphics;
  private seen = -1;
  private world!: World;
  private dyn: number[] = [];
  private t = 0;
  private hoverTile = { c: -1, r: -1 };
  private down = false;
  zoom = 1;          // extra zoom on top of "fit" (the editor's +/- buttons)
  pan = { x: 0, y: 0 };

  constructor() { super('editor'); }

  init(view: EditorView): void {
    this.view = view;
    this.seen = -1;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
  }

  create(): void {
    this.ground = this.add.graphics();
    this.g = this.add.graphics();
    this.over = this.add.graphics().setDepth(10);
    const toTile = (p: Phaser.Input.Pointer) => ({ c: tileOf(p.worldX), r: tileOf(p.worldY) });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.inArea(p)) return;
      this.down = true;
      const { c, r } = toTile(p);
      this.view.pointer(c, r, 'down', p.button);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const { c, r } = toTile(p);
      if (c !== this.hoverTile.c || r !== this.hoverTile.r) {
        this.hoverTile = { c, r };
        this.view.hover(c, r);
        if (this.down) this.view.pointer(c, r, 'move', p.button);
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.down) return;
      this.down = false;
      const { c, r } = toTile(p);
      this.view.pointer(c, r, 'up', p.button);
    });
  }

  private inArea(p: Phaser.Input.Pointer): boolean {
    const a = this.view.area(), dpr = this.dpr();
    return p.x >= a.x * dpr && p.y >= a.y * dpr && p.x <= (a.x + a.w) * dpr && p.y <= (a.y + a.h) * dpr;
  }

  private dpr(): number { return Math.min(window.devicePixelRatio || 1, 2); }

  /** Fit the whole map into the free screen area (plus the editor's zoom and pan). */
  private fit(lvl: LevelData): void {
    const a = this.view.area(), dpr = this.dpr(), cam = this.cameras.main;
    const mw = lvl.width * TILE, mh = lvl.height * TILE;
    const z = Math.min((a.w * dpr) / mw, (a.h * dpr) / mh) * 0.96 * this.zoom;
    cam.setZoom(z);
    cam.centerOn(mw / 2 + this.pan.x, mh / 2 + this.pan.y);
    // shift so the map is centred in the free area rather than the whole screen
    const sx = ((a.x + a.w / 2) * dpr - this.scale.width / 2) / z, sy = ((a.y + a.h / 2) * dpr - this.scale.height / 2) / z;
    cam.scrollX -= sx;
    cam.scrollY -= sy;
  }

  update(_time: number, dms: number): void {
    this.t += dms / 1000;
    const lvl = this.view.level(), theme = (lvl.theme ?? 'suburbia') as ZoneTheme;
    if (this.seen !== this.view.version()) {
      this.seen = this.view.version();
      this.world = new World(lvl);
      this.cameras.main.setBackgroundColor(themeBg(theme));
      drawGround(this.ground, new Grid(lvl.width, lvl.height, lvl.tiles), theme);
      this.dyn = dynamicTiles(this.world.grid);
    }
    this.fit(lvl);
    const w = this.world, g = this.g, t = this.t;
    g.clear();
    drawDynamicTiles(g, w, this.dyn, t);
    if (this.view.showCones()) for (const a of w.aliens) drawCone(g, w, a);
    w.checkpoints.forEach(cp => drawCheckpoint(g, cp.x, cp.y, false, t));
    for (const lv of w.levers) drawLever(g, lv);
    for (const term of w.terminals) drawTerminal(g, term, t);
    for (const k of w.keys) drawKey(g, k.x, k.y, t);
    for (const it of w.items) drawItem(g, it.x, it.y, t);
    for (const sk of w.socks) drawSock(g, sk.x, sk.y, t);

    // patrol routes
    const sel = this.view.selected();
    lvl.aliens.forEach((a, i) => {
      if (a.route.length < 2) return;
      const on = i === sel;
      g.lineStyle(on ? 5 : 3, on ? 0xff6eb4 : 0xffffff, on ? 0.95 : 0.55);
      g.beginPath();
      a.route.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      if (a.loop) g.lineTo(a.route[0].x, a.route[0].y);
      g.strokePath();
      a.route.forEach(p => g.fillStyle(on ? 0xff6eb4 : 0xffffff, on ? 1 : 0.7).fillCircle(p.x, p.y, on ? 7 : 5));
    });

    // characters
    const order = w.aliens.map((a, i) => ({ a, i })).sort((u, v) => u.a.y - v.a.y);
    for (const { a, i } of order) {
      drawAlien(g, a, { face: Math.cos(a.look) >= 0 ? 1 : -1, walk: 0 }, t, false);
      if (i === sel) g.lineStyle(3, 0xff6eb4).strokeCircle(a.x, a.y - 18, 30);
    }
    drawLeo(g, w.player, 1, 0, 'calm', DEFAULT_OUTFIT, t);

    // overlay: grid lines, hover, rectangle preview
    const o = this.over;
    o.clear();
    o.lineStyle(1, 0xffffff, 0.18);
    for (let c = 0; c <= lvl.width; c++) o.lineBetween(c * TILE, 0, c * TILE, lvl.height * TILE);
    for (let r = 0; r <= lvl.height; r++) o.lineBetween(0, r * TILE, lvl.width * TILE, r * TILE);
    const h = this.hoverTile;
    if (h.c >= 0 && h.r >= 0 && h.c < lvl.width && h.r < lvl.height) o.lineStyle(3, 0xffd23c, 0.9).strokeRect(h.c * TILE + 1, h.r * TILE + 1, TILE - 2, TILE - 2);
    const rc = this.view.rect();
    if (rc) {
      const c1 = Math.min(rc.c1, rc.c2), c2 = Math.max(rc.c1, rc.c2), r1 = Math.min(rc.r1, rc.r2), r2 = Math.max(rc.r1, rc.r2);
      o.fillStyle(0xffd23c, 0.25).fillRect(c1 * TILE, r1 * TILE, (c2 - c1 + 1) * TILE, (r2 - r1 + 1) * TILE);
      o.lineStyle(3, 0xffd23c).strokeRect(c1 * TILE, r1 * TILE, (c2 - c1 + 1) * TILE, (r2 - r1 + 1) * TILE);
    }
  }
}
