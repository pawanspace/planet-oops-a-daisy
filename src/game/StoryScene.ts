// Comic-style story scenes: the opening, zone cutscenes and the ending. Tap / click / any key to advance.
import Phaser from 'phaser';
import type { AlienKind } from '../sim/config';
import type { Alien, AlienState, Player } from '../sim/world';
import { DEFAULT_OUTFIT, drawAlien, drawLeo, type Outfit } from './art/characters';
import { drawBush, drawDaisyPlanet, drawEyes, drawLawn, drawMailbox, drawShip, drawSpace } from './art/scenery';
import { sound } from './sound';

type G = Phaser.GameObjects.Graphics;
export type StoryId = 'intro' | 'zone1' | 'zone2' | 'zone3' | 'ending';

const W = 960, H = 540;
type Who = 'nav' | 'leo' | 'alien' | 'title';
interface Line { at: number; who: Who; text: string; x: number; y: number }
interface Panel {
  dur: number;
  draw: (g: G, t: number, s: StoryScene) => void;
  lines?: Line[];
  beats?: { at: number; fn: (s: StoryScene) => void }[];
}

// --- tiny puppets -------------------------------------------------------------
function puppet(kind: AlienKind, x: number, y: number, state: AlienState = 'patrol', speed = 0, look = Math.PI): Alien {
  return {
    id: kind.length, kind, spec: { kind, x, y, route: [], loop: false }, x, y, heading: { x: speed ? 1 : 0, y: 0 }, speed, look, state,
    resume: 'patrol', stateT: 0, sus: 0, routeIdx: 0, routeDir: 1, pauseT: 0, skidding: false, untangle: 0, lastSeen: { x, y },
    lostT: 0, goal: { x, y }, lookoutT: 0, baseLook: 0, alarmT: 0,
  };
}
function leo(x: number, y: number, moving = false): Player {
  return {
    x, y, facing: 1, moving, running: false, hearts: 3, maxHearts: 3, invuln: 0, keys: 0, carried: [], moonwalkT: 0,
    cd: { honk: 0, moonwalk: 0, donut: 0 }, footT: 0, respawn: { x, y },
  };
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k));

function stars(g: G, x: number, y: number, t: number): void {
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i * Math.PI * 2) / 3;
    g.fillStyle(0xffe14a).fillCircle(x + Math.cos(a) * 16, y + Math.sin(a) * 5, 3.5);
  }
}
function smoke(g: G, x: number, y: number, t: number): void {
  for (let i = 0; i < 5; i++) {
    const k = ((t * 0.6 + i / 5) % 1);
    g.fillStyle(0x888899, 0.5 * (1 - k)).fillCircle(x + Math.sin(i * 2 + t) * 10, y - k * 90, 8 + k * 16);
  }
}

// --- scripts -----------------------------------------------------------------
const PARTS_FOR: Record<StoryId, boolean[]> = {
  intro: [true, true, true, true], zone1: [true, false, false, false], zone2: [true, true, false, false],
  zone3: [true, true, true, false], ending: [true, true, true, true],
};

function groundScene(parts: boolean[], visitor: (g: G, t: number, sc: StoryScene) => void, nextStop: string): Panel[] {
  return [{
    dur: 7,
    draw: (g, t, sc) => {
      drawLawn(g, W, H, 300);
      drawBush(g, 120, 420, 1.2);
      drawShip(g, 560, 360, 2.2, t, parts, 0, -0.08);
      drawLeo(sc.big, leo(330 / 2, 450 / 2), 1, 0, 'smug', outfit(), t);
      visitor(g, t, sc);
    },
    lines: [],
  }, {
    dur: 3,
    draw: (g, t) => { drawSpace(g, W, H, t, t * 40); drawDaisyPlanet(g, 480, 300, 130, t); },
    lines: [{ at: 0.2, who: 'title', text: nextStop, x: 480, y: 120 }],
  }];
}

let OUTFIT: Outfit = DEFAULT_OUTFIT;
const outfit = () => OUTFIT;

const SCRIPTS: Record<StoryId, Panel[]> = {
  intro: [
    {
      dur: 6,
      draw: (g, t) => { drawSpace(g, W, H, t, t * 60); drawShip(g, 420, 270 + Math.sin(t * 2) * 8, 2.4, t, [true, true, true, true], 0.6); },
      lines: [
        { at: 0.4, who: 'nav', text: 'NAV-9000: Estimated arrival at BEACH PLANET: 2 hours. Relax, tourist.', x: 480, y: 90 },
        { at: 3.2, who: 'leo', text: 'Ahh... holiday! 🍹', x: 560, y: 400 },
      ],
    },
    {
      dur: 6.5,
      draw: (g, t) => {
        drawSpace(g, W, H, t, t * 60);
        drawDaisyPlanet(g, lerp(1150, 780, t / 3), 300, lerp(30, 120, t / 3), t);
        drawShip(g, 330, 270 + Math.sin(t * 2) * 8, 2.2, t, [true, true, true, true], 0.6);
      },
      lines: [
        { at: 0.5, who: 'nav', text: 'NAV-9000: I have found a SCENIC SHORTCUT.', x: 430, y: 90 },
        { at: 2.5, who: 'leo', text: 'Is that... safe?', x: 330, y: 400 },
        { at: 4.3, who: 'nav', text: 'NAV-9000: ...Probably.', x: 430, y: 150 },
      ],
    },
    {
      dur: 4.2,
      draw: (g, t, sc) => {
        drawSpace(g, W, H, t, 0);
        drawDaisyPlanet(g, 720, 470, 300, t);
        const k = Math.min(1, t / 2.6);
        if (t < 2.7) drawShip(g, lerp(200, 640, k), lerp(140, 330, k * k), 2 - k * 0.6, t, [k < 0.3, k < 0.45, k < 0.6, k < 0.75], 0.5, t * 6);
        if (Math.floor(t * 8) % 2 === 0 && t < 2.7) g.fillStyle(0xff2040, 0.18).fillRect(0, 0, W, H);
        sc.flyParts(t, lerp(200, 640, k), lerp(140, 330, k * k));
        if (t > 2.7) g.fillStyle(0xffffff, Math.max(0, 1 - (t - 2.7) * 2)).fillRect(0, 0, W, H);
      },
      lines: [{ at: 2.75, who: 'title', text: '💥 CRASH! 💥', x: 480, y: 220 }],
      beats: [
        { at: 0.2, fn: () => sound.alarm() },
        { at: 2.7, fn: s => { sound.bonk(); s.cameras.main.shake(500, 0.02); } },
      ],
    },
    {
      dur: 6.5,
      draw: (g, t, sc) => {
        drawLawn(g, W, H, 280);
        drawShip(g, 160, 400, 1.6, t, [false, false, false, false], 0, 0.5);
        smoke(g, 150, 380, t);
        drawMailbox(g, 860, 470, 1.8, t > 4.6 ? 1 : 0);
        drawBush(g, 640, 470, 1.4, t > 1 && t < 2 ? t : 0);
        drawLeo(sc.big, leo(330 / 2, 470 / 2), 1, 0, t < 4 ? 'calm' : 'nervous', outfit(), t);
        if (t < 1.8) stars(g, 330, 405, t);
        if (t > 2) {
          // Blorp runs "towards" Leo... but his legs go backwards, straight into the mailbox.
          const run = Math.max(0, Math.min(1, (t - 3.4) / 1.2));
          const x = lerp(620, 820, run * run);
          const state: AlienState = t > 4.6 ? 'stunned' : run > 0 ? 'chase' : 'patrol';
          drawAlien(sc.big, puppet('hugger', x / 2, 470 / 2, state, run > 0 && run < 1 ? 200 : 0, Math.PI), { face: -1, walk: t * 16 }, t, false);
        }
      },
      lines: [
        { at: 0.3, who: 'leo', text: 'Ow. Where am I?', x: 330, y: 330 },
        { at: 2.3, who: 'alien', text: 'Blorp: WELCOME, TRAVELER!!', x: 620, y: 320 },
        { at: 3.4, who: 'alien', text: 'HUG INCOMIIIING!', x: 700, y: 360 },
        { at: 4.7, who: 'title', text: 'BONK!', x: 820, y: 330 },
      ],
      beats: [{ at: 4.6, fn: s => { sound.bonk(); s.cameras.main.shake(250, 0.01); } }],
    },
    {
      dur: 7.5,
      draw: (g, t, sc) => {
        drawLawn(g, W, H, 280);
        drawShip(g, 160, 400, 1.6, t, [false, false, false, false], 0, 0.5);
        drawBush(g, 760, 470, 1.4);
        drawBush(g, 60, 500, 1.1);
        drawLeo(sc.big, leo(360 / 2, 470 / 2), 1, 0, t > 3 ? 'panic' : 'nervous', outfit(), t);
        drawAlien(sc.big, puppet('hugger', 480 / 2, 470 / 2, t > 3 ? 'chase' : 'suspicious', 0, Math.PI * 0.75), { face: -1, walk: 0 }, t, false);
        if (t > 4.5) {
          g.fillStyle(0x0d0820, Math.min(0.7, (t - 4.5) * 0.5)).fillRect(0, 0, W, H);
          [[740, 430], [790, 440], [70, 470], [880, 300], [600, 250], [240, 270], [930, 480]].forEach(([x, y], i) => {
            if (t > 4.7 + i * 0.25) drawEyes(g, x, y, 1.4, t, i);
          });
        }
      },
      lines: [
        { at: 0.4, who: 'alien', text: 'Blorp: Wait... your NOSE and your TOES point the SAME WAY?!', x: 520, y: 300 },
        { at: 3.0, who: 'alien', text: 'You\'re SO WEIRD! EVERYONE needs to HUG you!!', x: 520, y: 360 },
        { at: 5.6, who: 'leo', text: 'Uh oh.', x: 360, y: 380 },
      ],
    },
    {
      dur: 4.5,
      draw: (g, t, sc) => {
        drawSpace(g, W, H, t, t * 20);
        drawDaisyPlanet(g, 480, 640, 300, t);
        const x = ((t * 60) % (W + 100)) - 50;
        drawAlien(sc.big, puppet('stroller', (W - x) / 2, 360 / 2, 'patrol', 70, 0), { face: 1, walk: t * 8 }, t, false);
      },
      lines: [
        { at: 0.2, who: 'title', text: 'PLANET OOPS-A-DAISY', x: 480, y: 150 },
        { at: 1.4, who: 'nav', text: 'NAV-9000: Find the 4 ship parts. And try not to get hugged.', x: 480, y: 250 },
      ],
    },
  ],
  zone1: groundScene(PARTS_FOR.zone1, (_g, t, sc) => {
    drawAlien(sc.big, puppet('hugger', lerp(900, 760, t / 3) / 2, 440 / 2, 'patrol', t < 3 ? 70 : 0, Math.PI), { face: -1, walk: t * 8 }, t, false);
  }, 'Next stop: Oops-a-Daisy Elementary!'),
  zone2: groundScene(PARTS_FOR.zone2, (_g, t, sc) => {
    for (let i = 0; i < 3; i++) drawAlien(sc.big, puppet('kid', (760 + i * 60) / 2, 450 / 2, 'patrol', 0, Math.PI), { face: -1, walk: 0 }, t + i, false);
  }, 'Next stop: the Downtown Market!'),
  zone3: groundScene(PARTS_FOR.zone3, (_g, t, sc) => {
    drawAlien(sc.big, puppet('heavy', 820 / 2, 450 / 2, 'eating', 0, Math.PI), { face: -1, walk: 0 }, t, false);
  }, 'Next stop: the Grand Spaceport!'),
  ending: [
    {
      dur: 5,
      draw: (g, t, sc) => {
        drawLawn(g, W, H, 300);
        drawShip(g, 480, 360 + (t > 3 ? Math.sin(t * 60) * 2 : 0), 2.4, t, [true, true, true, true], t > 3 ? (t - 3) : 0);
        for (let i = 0; i < 5; i++) drawAlien(sc.big, puppet((['stroller', 'kid', 'heavy', 'lookout', 'kid'] as AlienKind[])[i], (120 + i * 60 + (i > 2 ? 520 : 0)) / 2, 480 / 2, 'patrol', 0, Math.PI), { face: i > 2 ? -1 : 1, walk: 0 }, t + i, false);
      },
      lines: [
        { at: 0.3, who: 'nav', text: 'NAV-9000: All 4 parts installed. Launching in 3... 2... 1...', x: 480, y: 90 },
      ],
      beats: [{ at: 3, fn: () => sound.alarm() }],
    },
    {
      dur: 6,
      draw: (g, t, sc) => {
        drawLawn(g, W, H, 300);
        const y = lerp(360, -200, (t / 4) ** 2);
        drawShip(g, 480, y, 2.4, t, [true, true, true, true], 1.4, -Math.PI / 2 * Math.min(1, t));
        drawAlien(sc.big, puppet('hugger', 500 / 2, (y + 40) / 2, 'hugging', 0, 0), { face: 1, walk: 0 }, t, true);
        for (let i = 0; i < 6; i++) {
          const x = 80 + i * 150 + Math.sin(t * 2 + i) * 20;
          drawAlien(sc.big, puppet((['stroller', 'kid', 'heavy', 'lookout', 'scooter', 'kid'] as AlienKind[])[i], x / 2, 480 / 2, 'patrol', 60, i % 2 ? 0 : Math.PI), { face: i % 2 ? 1 : -1, walk: t * 8 }, t + i, false);
        }
      },
      lines: [
        { at: 0.5, who: 'alien', text: 'Blorp: BYE FRIEND! ONE LAST HUG!!!', x: 480, y: 120 },
        { at: 2.5, who: 'alien', text: 'Everyone: BYE, WEIRDO! 👋', x: 480, y: 420 },
      ],
    },
    {
      dur: 6,
      draw: (g, t, sc) => {
        drawSpace(g, W, H, t, t * 80);
        drawDaisyPlanet(g, lerp(700, 1100, t / 6), 380, lerp(120, 40, t / 6), t);
        drawShip(g, 400, 270 + Math.sin(t * 2) * 8, 2.4, t, [true, true, true, true], 0.8);
        drawAlien(sc.big, puppet('hugger', 420 / 2, 250 / 2, 'hugging', 0, 0), { face: 1, walk: 0 }, t, true);
      },
      lines: [
        { at: 0.4, who: 'nav', text: 'NAV-9000: Estimated arrival at BEACH PLANET: 2 hours.', x: 480, y: 90 },
        { at: 2.6, who: 'leo', text: 'No. More. SHORTCUTS.', x: 420, y: 400 },
        { at: 4.2, who: 'alien', text: 'Blorp: Are we there yet?', x: 560, y: 180 },
      ],
    },
    {
      dur: 14,
      draw: (g, t, sc) => { drawSpace(g, W, H, t, t * 20); sc.rollCredits(t); },
      lines: [],
    },
  ],
};

export const CREDITS: string[] = [
  'PLANET OOPS-A-DAISY',
  '',
  'Story by a parent and their kid',
  '',
  'Starring',
  'Leo the Tourist',
  'Blorp',
  'Big Bertha',
  'NAV-9000',
  'and everyone with backwards knees',
  '',
  'Code & art: built with Claude',
  '',
  'Thanks for playing!',
  '',
  'THE END',
  '...or is it?',
];

export interface StoryData { id: StoryId; onDone: () => void; outfit?: Outfit }

export class StoryScene extends Phaser.Scene {
  private g!: G;
  /** Characters are drawn 2x on this layer (coordinates halved). */
  big!: G;
  private panels: Panel[] = [];
  private idx = 0;
  private t = 0;
  private shown = 0;
  private beatsDone = 0;
  private texts: Phaser.GameObjects.Text[] = [];
  private partIcons: Phaser.GameObjects.Text[] = [];
  private credits: Phaser.GameObjects.Text[] = [];
  private data_!: StoryData;
  private done = false;

  constructor() { super('story'); }

  init(data: StoryData): void {
    this.data_ = data;
    OUTFIT = data.outfit ?? DEFAULT_OUTFIT;
    this.panels = SCRIPTS[data.id];
    this.idx = 0;
    this.done = false;
  }

  create(): void {
    this.g = this.add.graphics();
    this.big = this.add.graphics().setScale(2);
    this.fit();
    this.scale.on('resize', this.fit, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fit, this));
    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => { if (e.code !== 'Escape') this.advance(); else this.finish(); });
    this.startPanel();
  }

  private fit(): void {
    const cam = this.cameras.main;
    cam.setZoom(Math.min(this.scale.width / W, this.scale.height / H));
    cam.centerOn(W / 2, H / 2);
    cam.setBackgroundColor(0x0d0820);
  }

  private clearTexts(): void {
    for (const t of [...this.texts, ...this.partIcons, ...this.credits]) t.destroy();
    this.texts = [];
    this.partIcons = [];
    this.credits = [];
  }

  private startPanel(): void {
    this.clearTexts();
    this.t = 0;
    this.shown = 0;
    this.beatsDone = 0;
  }

  /** Tap: show all lines of this panel, or go to the next panel. */
  private advance(): void {
    const p = this.panels[this.idx];
    const lines = p.lines ?? [];
    if (this.shown < lines.length) {
      while (this.shown < lines.length) this.showLine(lines[this.shown++]);
      this.t = Math.max(this.t, (lines[lines.length - 1]?.at ?? 0) + 0.01);
    } else this.next();
  }

  private next(): void {
    this.idx++;
    if (this.idx >= this.panels.length) this.finish();
    else this.startPanel();
  }

  finish(): void {
    if (this.done) return;
    this.done = true;
    this.clearTexts();
    this.data_.onDone();
  }

  private showLine(l: Line): void {
    const styles: Record<Who, Phaser.Types.GameObjects.Text.TextStyle> = {
      nav: { fontFamily: 'Menlo, monospace', fontSize: '20px', color: '#bdf0ff', backgroundColor: '#13254acc', padding: { x: 12, y: 8 }, wordWrap: { width: 620 } },
      leo: { fontFamily: 'Chalkboard SE, Comic Sans MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#2a1f45', backgroundColor: '#ffffff', padding: { x: 12, y: 8 }, wordWrap: { width: 420 } },
      alien: { fontFamily: 'Chalkboard SE, Comic Sans MS, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#ff6eb4', padding: { x: 12, y: 8 }, wordWrap: { width: 520 } },
      title: { fontFamily: 'Chalkboard SE, Comic Sans MS, sans-serif', fontSize: '56px', fontStyle: 'bold', color: '#ffd23c', stroke: '#2a1f45', strokeThickness: 10, align: 'center', wordWrap: { width: 900 } },
    };
    // One bubble per speaker; older bubbles from others fade back.
    for (const old of this.texts) {
      if (old.getData('who') === l.who && l.who !== 'title') old.destroy();
      else this.tweens.add({ targets: old, alpha: 0.35, duration: 200 });
    }
    this.texts = this.texts.filter(t => t.active);
    const txt = this.add.text(l.x, l.y, l.text, styles[l.who]).setOrigin(0.5).setScale(0.3).setDepth(10).setData('who', l.who);
    this.tweens.add({ targets: txt, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.texts.push(txt);
    if (l.who === 'alien') sound.voice(0.9 + (l.text.length % 5) * 0.08);
    else if (l.who === 'nav') sound.beep();
    else if (l.who === 'leo') sound.voice(1.6);
  }

  /** Ship parts flying off in four directions during the crash. */
  flyParts(t: number, sx: number, sy: number): void {
    if (!this.partIcons.length) {
      this.partIcons = ['⚡', '🔋', '🛞', '🔑'].map(icon => this.add.text(sx, sy, icon, { fontSize: '40px' }).setOrigin(0.5).setDepth(5).setAlpha(0));
    }
    this.partIcons.forEach((p, i) => {
      const start = 0.6 + i * 0.4;
      if (t < start) return;
      const k = Math.min(1, (t - start) / 1.4);
      const dir = [[-1, -0.6], [1, -0.8], [-0.8, 0.7], [0.9, 0.5]][i];
      p.setAlpha(1).setPosition(sx + dir[0] * 520 * k, sy + dir[1] * 300 * k - Math.sin(k * Math.PI) * 80).setAngle(t * 400);
    });
  }

  rollCredits(t: number): void {
    if (!this.credits.length) {
      this.credits = CREDITS.map((line, i) => this.add.text(W / 2, H + 40 + i * 44, line, {
        fontFamily: 'Chalkboard SE, Comic Sans MS, sans-serif', fontSize: i === 0 ? '44px' : '26px', fontStyle: 'bold',
        color: i === 0 || line === 'THE END' ? '#ffd23c' : '#ffffff', stroke: '#2a1f45', strokeThickness: 6,
      }).setOrigin(0.5));
    }
    const y0 = H + 40 - t * 70;
    this.credits.forEach((c, i) => c.setY(Math.max(y0 + i * 44, i === this.credits.length - 2 ? H / 2 - 10 : i === this.credits.length - 1 ? H / 2 + 40 : -999)));
  }

  update(_time: number, dms: number): void {
    if (this.done) return;
    const dt = Math.min(dms, 100) / 1000;
    this.t += dt;
    const p = this.panels[this.idx];
    const lines = p.lines ?? [];
    while (this.shown < lines.length && lines[this.shown].at <= this.t) this.showLine(lines[this.shown++]);
    const beats = p.beats ?? [];
    while (this.beatsDone < beats.length && beats[this.beatsDone].at <= this.t) beats[this.beatsDone++].fn(this);
    this.g.clear();
    this.big.clear();
    p.draw(this.g, this.t, this);
    if (this.t >= p.dur) this.next();
  }
}

