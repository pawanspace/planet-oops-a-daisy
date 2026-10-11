// =============================================================================
// 📘 LESSON: The level editor
// =============================================================================
// The editor owns ONE thing: a LevelData object (the same shape the game plays, see src/sim/level.ts).
// Every tool just changes that object:
//   • tile tools set level.tiles[r * width + c]
//   • thing tools push a position into level.keys / level.items / ...
//   • alien tools add an AlienSpec to level.aliens and edit its route
// Undo works by saving a COPY of the level (as JSON text) before every change, in a list ("stack"). Undo pops the
// last copy back. Saving stores the level as a Tiled map in localStorage; Export downloads it as a .tmj file that
// can go straight into the /levels folder.
// =============================================================================
import { ALIEN_KINDS, KINDS, type AlienKind } from '../sim/config';
import { carefulBot } from '../sim/bot';
import { center, tileOf } from '../sim/grid';
import { T, emptyLevel, loadTiled, toTiled, type AlienSpec, type LevelData, type TileCode, type TiledMap, type Vec } from '../sim/level';
import { validateLevel } from '../sim/validate';
import type { EditorScene, EditorView } from '../game/EditorScene';
import { ZONE_THEMES } from '../game/art/themes';

// ---------------------------------------------------------------------------
// "My levels" storage
// ---------------------------------------------------------------------------
export interface SavedLevel { id: string; name: string; updated: number; tmj: TiledMap }
const STORE = 'oops.myLevels';
export function myLevels(): SavedLevel[] {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '[]') as SavedLevel[]; } catch { return []; }
}
function storeLevels(list: SavedLevel[]): void { localStorage.setItem(STORE, JSON.stringify(list)); }
export function loadMyLevel(id: string): LevelData | null {
  const s = myLevels().find(l => l.id === id);
  return s ? loadTiled(s.tmj, s.name) : null;
}
export function deleteMyLevel(id: string): void { storeLevels(myLevels().filter(l => l.id !== id)); }

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
type ThingKind = 'start' | 'key' | 'item' | 'checkpoint' | 'lever' | 'terminal' | 'sock';
type Tool =
  | { kind: 'tile'; tile: TileCode }
  | { kind: 'thing'; thing: ThingKind }
  | { kind: 'alien'; alien: AlienKind }
  | { kind: 'select' } | { kind: 'route' } | { kind: 'erase' } | { kind: 'pan' };

const TILE_TOOLS: [TileCode, string, string][] = [
  [T.Floor, '⬜', 'Floor'], [T.Wall, '🧱', 'Wall'], [T.Hedge, '🌳', 'Hedge / obstacle'], [T.Gate, '🚪', 'Gate (needs a key)'],
  [T.Carpet, '🟥', 'Carpet (silent)'], [T.Squeaky, '🟨', 'Squeaky floor'], [T.ConvUp, '⬆️', 'Belt up'], [T.ConvRight, '➡️', 'Belt right'],
  [T.ConvDown, '⬇️', 'Belt down'], [T.ConvLeft, '⬅️', 'Belt left'], [T.Plate, '🔵', 'Pressure plate'], [T.Laser, '🟥⚡', 'Laser'], [T.Shield, '🛡️', 'Shield'],
];
const THING_TOOLS: [ThingKind, string, string][] = [
  ['start', '🧑‍🚀', 'Leo starts here'], ['item', '⚡', 'Ship part (collect all to win)'], ['key', '🗝️', 'Key'], ['checkpoint', '🚩', 'Checkpoint flag'],
  ['lever', '🕹️', 'Lever (flips belts)'], ['terminal', '🖥️', 'Terminal (hack them all to drop shields)'], ['sock', '🧦', 'Hidden sock'],
];
const ALIEN_ICON: Record<AlienKind, string> = { stroller: '🟢', lookout: '🟠', hugger: '💗', kid: '🟡', heavy: '🟣', scooter: '🛴', drone: '🤖' };
const THING_LIST: Record<Exclude<ThingKind, 'start'>, keyof LevelData> = {
  key: 'keys', item: 'items', checkpoint: 'checkpoints', lever: 'levers', terminal: 'terminals', sock: 'socks',
};

export function newLevel(w = 20, h = 13): LevelData {
  const lvl = emptyLevel(w, h);
  for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) lvl.tiles[r * w + c] = T.Floor;
  lvl.name = 'My Level';
  lvl.hint = 'Made in the level editor!';
  lvl.start = { x: center(1), y: center(1) };
  lvl.items = [{ x: center(w - 2), y: center(h - 2) }];
  lvl.theme = 'suburbia';
  lvl.parTime = 60;
  return lvl;
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------
export interface EditorHost {
  root: HTMLElement;                     // where the editor builds its panels
  startScene: (view: EditorView) => EditorScene;
  stopScene: () => void;
  testPlay: (level: LevelData, back: () => void) => void;
  exit: () => void;
  remixable: { id: string; name: string; data: LevelData }[];
}

export class Editor {
  private level: LevelData;
  private version = 1;
  private undo: string[] = [];
  private redo: string[] = [];
  private tool: Tool = { kind: 'tile', tile: T.Wall };
  private rectMode = false;
  private rectStart: { c: number; r: number } | null = null;
  private rectEnd: { c: number; r: number } | null = null;
  private selected = -1;
  private cones = false;
  private slot: string | null = null;
  private dirty = false;
  private scene: EditorScene | null = null;
  private panStart: { c: number; r: number; x: number; y: number } | null = null;
  private els: Record<string, HTMLElement> = {};

  constructor(private host: EditorHost, level?: LevelData, slot?: string) {
    this.level = level ? structuredClone(level) : newLevel();
    this.slot = slot ?? null;
  }

  // -- lifecycle ------------------------------------------------------------
  open(): void {
    this.buildUi();
    this.scene = this.host.startScene(this.view());
    this.refresh();
    window.addEventListener('keydown', this.onKey);
  }

  close(): void {
    window.removeEventListener('keydown', this.onKey);
    this.host.stopScene();
    this.host.root.innerHTML = '';
    this.host.root.classList.add('hidden');
  }

  private view(): EditorView {
    return {
      level: () => this.level,
      version: () => this.version,
      selected: () => this.selected,
      showCones: () => this.cones,
      rect: () => (this.rectStart && this.rectEnd ? { c1: this.rectStart.c, r1: this.rectStart.r, c2: this.rectEnd.c, r2: this.rectEnd.r } : null),
      area: () => {
        const l = this.els.left.getBoundingClientRect(), rt = this.els.right.getBoundingClientRect(), top = this.els.top.getBoundingClientRect();
        return { x: l.right, y: top.bottom, w: Math.max(100, rt.left - l.right), h: Math.max(100, innerHeight - top.bottom) };
      },
      pointer: (c, r, phase, button) => this.pointer(c, r, phase, button),
      hover: (c, r) => { this.els.hover.textContent = c >= 0 && r >= 0 && c < this.level.width && r < this.level.height ? `Tile (${c}, ${r})` : ''; if (this.rectStart) { this.rectEnd = { c, r }; } },
    };
  }

  // -- history --------------------------------------------------------------
  private snapshot(): void {
    this.undo.push(JSON.stringify(this.level));
    if (this.undo.length > 80) this.undo.shift();
    this.redo = [];
  }
  private changed(): void {
    this.version++;
    this.dirty = true;
    this.refresh();
  }
  private doUndo(): void {
    const s = this.undo.pop();
    if (!s) return;
    this.redo.push(JSON.stringify(this.level));
    this.level = JSON.parse(s) as LevelData;
    this.selected = Math.min(this.selected, this.level.aliens.length - 1);
    this.changed();
  }
  private doRedo(): void {
    const s = this.redo.pop();
    if (!s) return;
    this.undo.push(JSON.stringify(this.level));
    this.level = JSON.parse(s) as LevelData;
    this.changed();
  }
  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) this.doRedo(); else this.doUndo(); }
    else if (mod && e.code === 'KeyY') { e.preventDefault(); this.doRedo(); }
    else if ((e.code === 'Delete' || e.code === 'Backspace') && this.selected >= 0) { e.preventDefault(); this.deleteAlien(); }
  };

  // -- editing helpers ------------------------------------------------------
  private inside(c: number, r: number): boolean { return c >= 0 && r >= 0 && c < this.level.width && r < this.level.height; }
  private idx(c: number, r: number): number { return r * this.level.width + c; }
  private onTile(v: Vec, c: number, r: number): boolean { return tileOf(v.x) === c && tileOf(v.y) === r; }
  private alienAt(c: number, r: number): number { return this.level.aliens.findIndex(a => this.onTile(a, c, r)); }

  /** Remove every thing (not Leo) and alien on a tile. */
  private clearTile(c: number, r: number): void {
    const L = this.level;
    for (const key of Object.values(THING_LIST)) (L[key] as unknown as Vec[]).splice(0, Infinity, ...(L[key] as unknown as Vec[]).filter(v => !this.onTile(v, c, r)));
    const before = L.aliens.length;
    L.aliens = L.aliens.filter(a => !this.onTile(a, c, r));
    if (L.aliens.length !== before) this.selected = -1;
  }

  private setTile(c: number, r: number, t: TileCode): void {
    if (!this.inside(c, r)) return;
    this.level.tiles[this.idx(c, r)] = t;
    if (t === T.Wall || t === T.Hedge) this.clearTile(c, r);
  }

  private ensureFloor(c: number, r: number): void {
    const i = this.idx(c, r), t = this.level.tiles[i];
    if (t === T.Wall || t === T.Hedge || t === T.Empty || t === T.Gate || t === T.Laser || t === T.Shield) this.level.tiles[i] = T.Floor;
  }

  private placeThing(thing: ThingKind, c: number, r: number): void {
    const pos = { x: center(c), y: center(r) };
    this.ensureFloor(c, r);
    if (thing === 'start') { this.level.start = pos; return; }
    this.clearTile(c, r);
    (this.level[THING_LIST[thing]] as unknown as Vec[]).push(pos);
  }

  private placeAlien(kind: AlienKind, c: number, r: number): void {
    this.ensureFloor(c, r);
    const i = this.alienAt(c, r);
    if (i >= 0) this.level.aliens.splice(i, 1);
    const spec: AlienSpec = { kind, x: center(c), y: center(r), route: [], loop: false, name: undefined };
    if (kind === 'lookout') { spec.facing = 0; spec.turnEvery = 3; }
    if (kind === 'hugger') spec.facing = Math.PI;
    this.level.aliens.push(spec);
    this.selected = this.level.aliens.length - 1;
  }

  private moveAlien(i: number, c: number, r: number): void {
    const a = this.level.aliens[i], p = { x: center(c), y: center(r) };
    a.x = p.x; a.y = p.y;
    if (a.route.length > 1) a.route[0] = { ...p };
  }

  private addWaypoint(c: number, r: number): void {
    const a = this.level.aliens[this.selected];
    if (!a) return;
    const p = { x: center(c), y: center(r) };
    if (a.route.length === 0) a.route = [{ x: a.x, y: a.y }];
    const last = a.route[a.route.length - 1];
    if (a.route.length > 1 && last.x === p.x && last.y === p.y) { a.route.pop(); if (a.route.length < 2) a.route = []; return; }
    if (last.x === p.x && last.y === p.y) return;
    a.route.push(p);
  }

  private deleteAlien(): void {
    if (this.selected < 0) return;
    this.snapshot();
    this.level.aliens.splice(this.selected, 1);
    this.selected = -1;
    this.changed();
  }

  private fillRect(a: { c: number; r: number }, b: { c: number; r: number }, t: TileCode): void {
    for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) this.setTile(c, r, t);
  }

  // -- pointer --------------------------------------------------------------
  private pointer(c: number, r: number, phase: 'down' | 'move' | 'up', button: number): void {
    const t = this.tool;
    if (t.kind === 'pan' || button === 1 || button === 2) {
      const sc = this.scene!;
      if (phase === 'down') this.panStart = { c, r, x: sc.pan.x, y: sc.pan.y };
      else if (phase === 'move' && this.panStart) { sc.pan.x = this.panStart.x - (c - this.panStart.c) * 48; sc.pan.y = this.panStart.y - (r - this.panStart.r) * 48; this.panStart = { c, r, x: sc.pan.x, y: sc.pan.y }; }
      else this.panStart = null;
      return;
    }
    if (!this.inside(c, r)) return;
    if (t.kind === 'tile' && this.rectMode) {
      if (phase === 'down') { this.rectStart = { c, r }; this.rectEnd = { c, r }; }
      else if (phase === 'move') this.rectEnd = { c, r };
      else if (this.rectStart) { this.snapshot(); this.fillRect(this.rectStart, { c, r }, t.tile); this.rectStart = this.rectEnd = null; this.changed(); }
      return;
    }
    if (phase === 'up') return;
    if (phase === 'down') this.snapshot();
    switch (t.kind) {
      case 'tile': this.setTile(c, r, t.tile); break;
      case 'erase': this.clearTile(c, r); break;
      case 'thing': if (phase === 'down') this.placeThing(t.thing, c, r); break;
      case 'alien': if (phase === 'down') this.placeAlien(t.alien, c, r); break;
      case 'select': {
        if (phase === 'down') { this.selected = this.alienAt(c, r); this.refresh(); return; }
        if (this.selected >= 0) this.moveAlien(this.selected, c, r);
        break;
      }
      case 'route': if (phase === 'down') this.addWaypoint(c, r); break;
    }
    this.changed();
  }

  // -- UI -------------------------------------------------------------------
  private buildUi(): void {
    const root = this.host.root;
    root.classList.remove('hidden');
    root.innerHTML = `
      <div class="ed-top">
        <b>🛠️ Level Editor</b>
        <button data-a="new">➕ New</button><button data-a="open">📂 Open</button><button data-a="save">💾 Save</button>
        <button data-a="export">📤 Export .tmj</button><label class="filebtn">📥 Import<input type="file" accept=".tmj,.json" hidden></label>
        <span class="sep"></span>
        <button data-a="undo" title="Undo (Ctrl/Cmd+Z)">↩️</button><button data-a="redo" title="Redo">↪️</button>
        <button data-a="zoomout">➖</button><button data-a="fit">🔍 Fit</button><button data-a="zoomin">➕</button>
        <span class="sep"></span>
        <button data-a="play" class="primary">▶ Test play</button><button data-a="robot">🤖 Robot check</button>
        <span class="grow"></span><span class="hover"></span><button data-a="exit">🚪 Exit</button>
      </div>
      <div class="ed-left">
        <h4>Tiles</h4><div class="pal tiles"></div>
        <label class="chk"><input type="checkbox" class="rectmode"> ▭ Fill a rectangle</label>
        <h4>Things</h4><div class="pal things"></div>
        <h4>Aliens</h4><div class="pal aliens"></div>
        <h4>Tools</h4><div class="pal tools"></div>
        <label class="chk"><input type="checkbox" class="cones"> 👀 Show vision cones</label>
      </div>
      <div class="ed-right">
        <section class="ed-alien"></section>
        <section class="ed-level"></section>
        <section class="ed-checks"></section>
        <section class="ed-msg"></section>
      </div>
      <div class="ed-modal hidden"></div>`;
    const q = <E extends HTMLElement>(s: string) => root.querySelector(s) as E;
    this.els = {
      top: q('.ed-top'), left: q('.ed-left'), right: q('.ed-right'), alien: q('.ed-alien'), levelBox: q('.ed-level'),
      checks: q('.ed-checks'), msg: q('.ed-msg'), hover: q('.hover'), modal: q('.ed-modal'),
    };
    const pal = (sel: string, items: { label: string; title: string; tool: Tool }[]) => {
      const box = q(sel);
      for (const it of items) {
        const b = document.createElement('button');
        b.innerHTML = it.label; b.title = it.title;
        b.onclick = () => { this.tool = it.tool; this.refreshPalette(); };
        (b as HTMLButtonElement & { tool?: Tool }).tool = it.tool;
        box.appendChild(b);
      }
    };
    pal('.tiles', TILE_TOOLS.map(([tile, label, title]) => ({ label, title, tool: { kind: 'tile', tile } })));
    pal('.things', THING_TOOLS.map(([thing, label, title]) => ({ label, title, tool: { kind: 'thing', thing } })));
    pal('.aliens', ALIEN_KINDS.map(k => ({ label: `${ALIEN_ICON[k]}<small>${k}</small>`, title: `Place a ${k}`, tool: { kind: 'alien', alien: k } })));
    pal('.tools', [
      { label: '👆<small>select / move</small>', title: 'Click an alien to edit it, drag to move it', tool: { kind: 'select' } },
      { label: '📍<small>route</small>', title: 'Click tiles to add patrol points to the selected alien (click the last one again to remove it)', tool: { kind: 'route' } },
      { label: '🧽<small>erase</small>', title: 'Remove things and aliens', tool: { kind: 'erase' } },
      { label: '✋<small>pan</small>', title: 'Drag to move the view', tool: { kind: 'pan' } },
    ]);
    q<HTMLInputElement>('.rectmode').onchange = e => { this.rectMode = (e.target as HTMLInputElement).checked; };
    q<HTMLInputElement>('.cones').onchange = e => { this.cones = (e.target as HTMLInputElement).checked; };
    q<HTMLInputElement>('.filebtn input').onchange = e => this.importFile(e.target as HTMLInputElement);
    root.querySelector('.ed-top')!.addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      if (a) this.action(a);
    });
    this.refreshPalette();
  }

  private refreshPalette(): void {
    this.host.root.querySelectorAll('.pal button').forEach(b => {
      const t = (b as HTMLButtonElement & { tool?: Tool }).tool!;
      b.classList.toggle('on', JSON.stringify(t) === JSON.stringify(this.tool));
    });
  }

  private say(html: string): void { this.els.msg.innerHTML = html; }

  /** Rebuild the right-hand panels: selected alien, level settings, live checks. */
  private refresh(): void {
    if (!this.els.right) return;
    const L = this.level;
    // selected alien
    const a = L.aliens[this.selected];
    this.els.alien.innerHTML = a ? `
      <h4>${ALIEN_ICON[a.kind]} Alien ${this.selected + 1}</h4>
      <label>Kind <select data-f="kind">${ALIEN_KINDS.map(k => `<option ${k === a.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Name <input data-f="name" value="${a.name ?? ''}" placeholder="(optional, e.g. Blorp)"></label>
      <label>Speed <input data-f="speed" type="number" value="${a.speed ?? ''}" placeholder="${KINDS[a.kind].speed}"></label>
      <label>Facing° <input data-f="facing" type="number" value="${a.facing !== undefined ? Math.round(a.facing * 180 / Math.PI) : ''}" placeholder="auto"></label>
      ${a.kind === 'lookout' ? `<label>Turn every (s) <input data-f="turnEvery" type="number" step="0.5" value="${a.turnEvery ?? ''}" placeholder="3"></label>` : ''}
      <label>Pause at stops (s) <input data-f="pause" type="number" step="0.1" value="${a.pause ?? ''}" placeholder="0.35"></label>
      <label class="chk"><input data-f="loop" type="checkbox" ${a.loop ? 'checked' : ''}> Loop the route (instead of back and forth)</label>
      <p class="small">Route: ${a.route.length > 1 ? `${a.route.length} points` : 'stays put'} · use 📍 to draw it.</p>
      <div class="row"><button data-x="clearRoute">Clear route</button><button data-x="delete">🗑️ Delete</button></div>`
      : '<h4>Alien</h4><p class="small">Pick 👆 select and click an alien to edit it.</p>';
    this.els.alien.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('change', () => this.alienField(inp as HTMLInputElement)));
    this.els.alien.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => {
      if ((b as HTMLElement).dataset.x === 'delete') this.deleteAlien();
      else { this.snapshot(); a.route = []; this.changed(); }
    }));
    // level settings
    this.els.levelBox.innerHTML = `
      <h4>📜 Level</h4>
      <label>Name <input data-l="name" value="${L.name.replace(/"/g, '&quot;')}"></label>
      <label>Hint <textarea data-l="hint" rows="2">${L.hint}</textarea></label>
      <label>Zone look <select data-l="theme">${ZONE_THEMES.map(t => `<option ${t === (L.theme ?? 'suburbia') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>Par time (s) <input data-l="parTime" type="number" value="${L.parTime}"></label>
      <label>Alarm after pickups <input data-l="alarmAfter" type="number" min="0" value="${L.alarmAfter}"></label>
      <label>Size <input data-l="width" type="number" min="5" max="60" value="${L.width}"> × <input data-l="height" type="number" min="5" max="40" value="${L.height}"></label>`;
    this.els.levelBox.querySelectorAll('[data-l]').forEach(inp => inp.addEventListener('change', () => this.levelField(inp as HTMLInputElement)));
    // live checks
    const rep = validateLevel(L);
    this.els.checks.innerHTML = `<h4>✅ Checks</h4>${rep.errors.length + rep.warnings.length === 0 ? '<p class="good">Looks playable! Try 🤖 Robot check.</p>' : ''}
      ${rep.errors.map(e => `<p class="bad">⛔ ${e}</p>`).join('')}${rep.warnings.map(w => `<p class="warn">⚠️ ${w}</p>`).join('')}`;
  }

  private alienField(inp: HTMLInputElement): void {
    const a = this.level.aliens[this.selected];
    if (!a) return;
    this.snapshot();
    const v = inp.value.trim(), f = inp.dataset.f!;
    if (f === 'kind') a.kind = v as AlienKind;
    else if (f === 'name') a.name = v || undefined;
    else if (f === 'loop') a.loop = inp.checked;
    else if (f === 'facing') a.facing = v === '' ? undefined : (Number(v) * Math.PI) / 180;
    else (a as unknown as Record<string, number | undefined>)[f] = v === '' ? undefined : Number(v);
    this.changed();
  }

  private levelField(inp: HTMLInputElement): void {
    const L = this.level, f = inp.dataset.l!, v = inp.value;
    this.snapshot();
    if (f === 'width' || f === 'height') {
      const w = f === 'width' ? Math.max(5, Math.min(60, Number(v))) : L.width;
      const h = f === 'height' ? Math.max(5, Math.min(40, Number(v))) : L.height;
      this.resize(w, h);
    } else if (f === 'parTime' || f === 'alarmAfter') (L as unknown as Record<string, number>)[f] = Math.max(0, Number(v));
    else (L as unknown as Record<string, string>)[f] = v;
    this.changed();
  }

  /** Change the map size, keeping what fits (new space is wall) and dropping things that fall off the edge. */
  private resize(w: number, h: number): void {
    const L = this.level, tiles: TileCode[] = [];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) tiles.push(c < L.width && r < L.height ? L.tiles[r * L.width + c] : T.Wall);
    const keep = (v: Vec) => tileOf(v.x) < w && tileOf(v.y) < h;
    L.width = w; L.height = h; L.tiles = tiles;
    for (const key of Object.values(THING_LIST)) (L[key] as unknown as Vec[]).splice(0, Infinity, ...(L[key] as unknown as Vec[]).filter(keep));
    L.aliens = L.aliens.filter(keep).map(a => ({ ...a, route: a.route.every(keep) ? a.route : [] }));
    if (!keep(L.start)) L.start = { x: center(1), y: center(1) };
    this.selected = -1;
  }

  // -- top bar actions ------------------------------------------------------
  private action(a: string): void {
    const sc = this.scene!;
    switch (a) {
      case 'undo': this.doUndo(); break;
      case 'redo': this.doRedo(); break;
      case 'zoomin': sc.zoom = Math.min(4, sc.zoom * 1.25); break;
      case 'zoomout': sc.zoom = Math.max(0.5, sc.zoom / 1.25); break;
      case 'fit': sc.zoom = 1; sc.pan = { x: 0, y: 0 }; break;
      case 'new': if (this.confirmLose()) { this.level = newLevel(); this.slot = null; this.undo = []; this.redo = []; this.selected = -1; this.changed(); this.dirty = false; } break;
      case 'save': this.save(); break;
      case 'export': this.exportFile(); break;
      case 'open': this.openDialog(); break;
      case 'play': this.testPlay(); break;
      case 'robot': this.robot(); break;
      case 'exit': if (this.confirmLose()) { this.close(); this.host.exit(); } break;
    }
  }

  private confirmLose(): boolean {
    return !this.dirty || confirm('You have unsaved changes. Continue without saving?');
  }

  private save(): void {
    const list = myLevels();
    const id = this.slot ?? `my-${Date.now().toString(36)}`;
    const entry: SavedLevel = { id, name: this.level.name || 'My Level', updated: Date.now(), tmj: toTiled(this.level) as unknown as TiledMap };
    const i = list.findIndex(l => l.id === id);
    if (i >= 0) list[i] = entry; else list.push(entry);
    storeLevels(list);
    this.slot = id;
    this.dirty = false;
    this.say(`💾 Saved "${entry.name}" to My levels. Play it from the level select screen!`);
  }

  private exportFile(): void {
    const blob = new Blob([JSON.stringify(toTiled(this.level), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(this.level.name || 'my-level').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.tmj`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    this.say('📤 Exported! Put the .tmj file in the <code>levels/</code> folder to open it in Tiled or add it to the campaign.');
  }

  private importFile(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const lvl = loadTiled(JSON.parse(text) as TiledMap, file.name.replace(/\.\w+$/, ''));
        this.snapshot();
        this.level = lvl; this.slot = null; this.selected = -1;
        this.changed();
        this.say(`📥 Imported ${file.name}.`);
      } catch (e) { this.say(`<span class="bad">⚠️ Couldn't read that file: ${(e as Error).message}</span>`); }
      input.value = '';
    });
  }

  private openDialog(): void {
    const mine = myLevels().sort((a, b) => b.updated - a.updated);
    const m = this.els.modal;
    m.classList.remove('hidden');
    m.innerHTML = `<div class="box"><h3>📂 Open a level</h3>
      <h4>My levels</h4>${mine.length ? mine.map(l => `<div class="row"><button data-open="${l.id}">✏️ ${l.name}</button><button data-del="${l.id}" title="Delete">🗑️</button></div>`).join('') : '<p class="small">Nothing saved yet.</p>'}
      <h4>Remix a campaign level (makes a copy)</h4><div class="grid">${this.host.remixable.map(l => `<button data-remix="${l.id}">${l.name}</button>`).join('')}</div>
      <div class="row"><button data-close>Close</button></div></div>`;
    m.onclick = e => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.dataset.open && this.confirmLose()) {
        const lvl = loadMyLevel(b.dataset.open);
        if (lvl) { this.level = lvl; this.slot = b.dataset.open; this.undo = []; this.redo = []; this.selected = -1; this.changed(); this.dirty = false; }
      } else if (b.dataset.del) {
        if (confirm('Delete this level for good?')) { deleteMyLevel(b.dataset.del); this.openDialog(); return; }
        return;
      } else if (b.dataset.remix && this.confirmLose()) {
        const src = this.host.remixable.find(l => l.id === b.dataset.remix)!;
        this.level = structuredClone(src.data);
        this.level.name = `${src.name} (remix)`;
        this.level.theme ??= ZONE_THEMES[Math.max(0, Number(src.id[0]) - 1)] ?? 'suburbia';
        this.slot = null; this.undo = []; this.redo = []; this.selected = -1; this.changed();
      } else if (!('close' in b.dataset)) return;
      m.classList.add('hidden');
    };
  }

  private testPlay(): void {
    const rep = validateLevel(this.level);
    if (rep.errors.length) { this.say(`<span class="bad">⛔ Fix the errors first (see ✅ Checks).</span>`); return; }
    const copy = structuredClone(this.level);
    this.host.root.classList.add('hidden');
    window.removeEventListener('keydown', this.onKey);
    this.host.stopScene();
    this.host.testPlay(copy, () => {
      this.host.root.classList.remove('hidden');
      window.addEventListener('keydown', this.onKey);
      this.scene = this.host.startScene(this.view());
      this.version++;
    });
  }

  private robot(): void {
    const rep = validateLevel(this.level);
    if (rep.errors.length) { this.say(`<span class="bad">⛔ Fix the errors first.</span>`); return; }
    this.say('🤖 The careful robot is playing your level (no gadgets)...');
    const copy = structuredClone(this.level);
    setTimeout(() => {
      const r = carefulBot(copy, { difficulty: 'normal', maxTime: 150 });
      this.say(r.won
        ? `🤖 <b>Beaten!</b> in ${r.time} s on Normal, chased ${r.chased}×, lost ${r.heartsLost} ❤️. Par time is ${this.level.parTime} s${r.time > this.level.parTime ? ' (maybe raise it?)' : ''}.`
        : `🤖 <b>Couldn't finish</b> in 150 s (got stuck around tile ${r.where}). It might be too hard without gadgets, or impossible.`);
    }, 40);
  }
}
