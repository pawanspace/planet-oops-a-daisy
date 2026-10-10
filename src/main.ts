import Phaser from 'phaser';
import { CAMPAIGN } from './sim/campaign';
import { DIFFICULTY, type Difficulty } from './sim/config';
import { starsFor, type World } from './sim/world';
import { Controls } from './game/controls';
import { GameScene, type SceneData } from './game/GameScene';
import { GalleryScene } from './game/GalleryScene';
import { LEVELS, loadStars, saveStars } from './game/levels';
import { sound } from './game/sound';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const controls = new Controls();
controls.bindStick($('stick'), $('stick-knob'));
controls.bindButton($('btn-run'), 'run');
controls.bindButton($('btn-honk'), 'honk');
controls.bindButton($('btn-moon'), 'moonwalk');
controls.bindButton($('btn-donut'), 'donut');
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

let difficulty: Difficulty = (localStorage.getItem('oops.difficulty') as Difficulty) || 'normal';
let levelIdx = 0;

// Render at the screen's real pixel density (sharp on iPad/Retina), displayed at CSS size.
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#2a1f45',
  scale: { mode: Phaser.Scale.NONE, width: innerWidth * DPR, height: innerHeight * DPR, zoom: 1 / DPR },
  render: { antialias: true },
  scene: [],
});
window.addEventListener('resize', () => game.scale.resize(innerWidth * DPR, innerHeight * DPR));
game.scene.add('game', GameScene, false);
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

const partFor = (idx: number) => {
  const z = LEVELS[idx].zone;
  return z >= 0 ? CAMPAIGN[z].part.split(' ')[0] : '⚡';
};

function startLevel(idx: number): void {
  levelIdx = idx;
  const entry = LEVELS[idx];
  hideOverlay();
  controls.reset();
  document.body.classList.add('playing');
  $('hint').textContent = entry.data.hint;
  $('hint').classList.remove('faded');
  setTimeout(() => $('hint').classList.add('faded'), 9000);
  $('hud-level').textContent = entry.data.name;
  const data: SceneData = { level: entry.data, difficulty, controls, onEnd, onFrame };
  if (game.scene.getScene('game')?.sys.isActive() || game.scene.isPaused('game')) game.scene.getScene('game').scene.restart(data);
  else game.scene.start('game', data);
}

function onFrame(w: World): void {
  const p = w.player;
  $('hud-hearts').textContent = '❤️'.repeat(Math.max(0, p.hearts)) + '🤍'.repeat(Math.max(0, p.maxHearts - p.hearts));
  $('hud-time').textContent = formatTime(w.time);
  const got = w.items.filter(i => i.taken).length;
  const terms = w.terminals.length ? `  🖥️ ${w.terminals.filter(t => t.done).length}/${w.terminals.length}` : '';
  $('hud-items').textContent = `${partFor(levelIdx)} ${got}/${w.items.length}${p.keys ? '  🗝️' : ''}${terms}${w.alarm ? '  🚨' : ''}`;
  setCooldown('btn-honk', p.cd.honk);
  setCooldown('btn-moon', p.moonwalkT > 0 ? 0 : p.cd.moonwalk);
  setCooldown('btn-donut', p.cd.donut);
  $('btn-moon').classList.toggle('active', p.moonwalkT > 0);
}

function setCooldown(id: string, cd: number): void {
  const el = $(id);
  el.classList.toggle('cooling', cd > 0);
  el.dataset.cd = cd > 0 ? String(Math.ceil(cd)) : '';
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const starText = (n: number) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

function onEnd(w: World): void {
  document.body.classList.remove('playing');
  const entry = LEVELS[levelIdx];
  const isLast = levelIdx + 1 >= LEVELS.length || LEVELS[levelIdx + 1].zone < 0;
  if (w.status === 'won') {
    const stars = starsFor(w);
    saveStars(entry.id, stars);
    const zone = entry.zone >= 0 ? CAMPAIGN[entry.zone] : null;
    const zoneDone = zone && zone.levels[zone.levels.length - 1] === entry.id;
    const title = isLast && entry.zone >= 0 ? '🚀 BLAST OFF! You escaped Planet Oops-a-Daisy!'
      : zoneDone ? `🎉 Zone complete! Got the ${zone!.part}!` : '🎉 Got it!';
    showOverlay(`
      <h1>${title}</h1>
      <div class="stars">${starText(stars)}</div>
      <ul class="star-list">
        <li>⭐ Finished</li>
        <li>${w.time <= w.level.parTime ? '⭐' : '☆'} Under ${formatTime(w.level.parTime)} (you: ${formatTime(w.time)})</li>
        <li>${w.timesChased === 0 ? '⭐' : '☆'} Never chased (chased ${w.timesChased}×)</li>
      </ul>
      <div class="row">
        <button data-act="retry">Play again</button>
        <button data-act="title">Levels</button>
        ${!isLast ? '<button data-act="next" class="primary">Next level ▶</button>' : ''}
      </div>`);
  } else {
    showOverlay(`
      <h1>💕 Hugged too many times!</h1>
      <p>NAV-9000: "Recalculating... their eyes look BACKWARDS. Sneak up from the FRONT!"</p>
      <div class="row"><button data-act="retry" class="primary">Try again</button><button data-act="title">Levels</button></div>`);
  }
}

function showTitle(): void {
  document.body.classList.remove('playing');
  const stars = loadStars();
  const total = Object.values(stars).reduce((a, b) => a + b, 0);
  const diffs = (Object.keys(DIFFICULTY) as Difficulty[])
    .map(d => `<button data-diff="${d}" class="${d === difficulty ? 'selected' : ''}">${DIFFICULTY[d].label}</button>`).join('');
  const zones = CAMPAIGN.map((z, zi) => {
    const levels = LEVELS.map((l, i) => ({ l, i })).filter(({ l }) => l.zone === zi).map(({ l, i }) => {
      const s = stars[l.id] ?? 0;
      return `<button class="level" data-level="${i}"><b>${l.id}</b><span>${l.data.name.replace(/^\d-\d\s*/, '')}</span><i>${starText(s)}</i></button>`;
    }).join('');
    return `<div class="zone"><h2>${z.part} ${z.name}</h2><div class="zone-levels">${levels}</div></div>`;
  }).join('');
  const sandbox = LEVELS.findIndex(l => l.zone < 0);
  showOverlay(`
    <h1>🚀 Planet Oops-a-Daisy</h1>
    <p class="sub">Everyone's legs face backwards. <b>Their eyes look where they've been</b>, not where they're going.</p>
    <div class="row diffs">${diffs}<span class="total">⭐ ${total} / ${CAMPAIGN.length * 9}</span></div>
    <div class="zones">${zones}</div>
    <div class="row"><button data-level="${sandbox}" class="small">🧪 Sandbox</button></div>
    <p class="keys">Move: arrows / WASD · Run: Shift (noisy!) · 1 Honk · 2 Moonwalk · 3 Donut · P pause</p>`, true);
}

function showOverlay(html: string, wide = false): void {
  $('panel').innerHTML = html;
  $('panel').classList.toggle('wide', wide);
  $('overlay').classList.remove('hidden');
}
function hideOverlay(): void { $('overlay').classList.add('hidden'); }

$('panel').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  sound.unlock();
  if (b.dataset.diff) {
    difficulty = b.dataset.diff as Difficulty;
    localStorage.setItem('oops.difficulty', difficulty);
    if (location.search.includes('gallery')) {
  game.scene.add('gallery', GalleryScene, true);
  hideOverlay();
  $('hud').style.display = 'none';
} else {
  showTitle();
}
  } else if (b.dataset.level) startLevel(Number(b.dataset.level));
  else if (b.dataset.act === 'retry') startLevel(levelIdx);
  else if (b.dataset.act === 'next') startLevel(levelIdx + 1);
  else if (b.dataset.act === 'title') { game.scene.stop('game'); showTitle(); }
  else if (b.dataset.act === 'resume') { hideOverlay(); document.body.classList.add('playing'); game.scene.resume('game'); }
});

function pause(): void {
  if (!game.scene.isActive('game')) return;
  game.scene.pause('game');
  controls.reset();
  document.body.classList.remove('playing');
  showOverlay(`<h1>⏸ Paused</h1><p>${LEVELS[levelIdx].data.hint}</p><div class="row"><button data-act="resume" class="primary">Resume</button><button data-act="retry">Restart</button><button data-act="title">Levels</button></div>`);
}
window.addEventListener('keydown', e => { if (e.code === 'KeyP' || e.code === 'Escape') pause(); });
$('btn-pause').addEventListener('click', pause);
$('btn-music').addEventListener('click', () => { sound.unlock(); $('btn-music').textContent = sound.toggleMusic() ? '🎵' : '🔇'; });
controls.onAnyInput = () => sound.unlock();

if (location.search.includes('gallery')) {
  game.scene.add('gallery', GalleryScene, true);
  hideOverlay();
  $('hud').style.display = 'none';
} else {
  showTitle();
}
