// Oops Academy: builds the page from CHAPTERS, tracks progress (saved in localStorage) and hands out badges.
import { CHALLENGES, runChallenge } from './challenges';
import { CHAPTERS, type Block, type Chapter } from './chapters';
import { codeBlock, region } from './code';
import { DEMOS } from './demos';
import './learn.css';

const $ = (id: string) => document.getElementById(id)!;

// ---------------------------------------------------------------------------
// Progress: which quizzes/challenges are done, saved in the browser
// ---------------------------------------------------------------------------
interface Progress { quizzes: Record<string, boolean>; challenges: Record<string, boolean>; visited: Record<string, boolean>; code: Record<string, string> }
const KEY = 'oops.academy';
const load = (): Progress => {
  try { return { quizzes: {}, challenges: {}, visited: {}, code: {}, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { quizzes: {}, challenges: {}, visited: {}, code: {} }; }
};
let progress = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(progress));

const quizKey = (ch: Chapter, i: number) => `${ch.id}:${i}`;
function chapterState(ch: Chapter): { done: number; total: number } {
  let done = 0, total = 0;
  ch.blocks.forEach((b, i) => {
    if (b.t === 'quiz') { total++; if (progress.quizzes[quizKey(ch, i)]) done++; }
    if (b.t === 'challenge') { total++; if (progress.challenges[b.id]) done++; }
  });
  if (total === 0) { total = 1; if (progress.visited[ch.id]) done = 1; }
  return { done, total };
}
const complete = (ch: Chapter) => { const s = chapterState(ch); return s.done >= s.total; };

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function renderSide(current: string): void {
  $('toc').innerHTML = CHAPTERS.map((ch, i) => {
    const s = chapterState(ch);
    return `<li class="${ch.id === current ? 'on' : ''} ${complete(ch) ? 'done' : ''}"><a href="#${ch.id}">
      <span class="em">${complete(ch) ? '✅' : ch.emoji}</span><span>${i}. ${ch.title}</span><small>${s.done}/${s.total}</small></a></li>`;
  }).join('');
  const doneCount = CHAPTERS.filter(complete).length;
  $('progress').innerHTML = `<div class="bar"><i style="width:${(doneCount / CHAPTERS.length) * 100}%"></i></div>
    <small>${doneCount} / ${CHAPTERS.length} chapters complete</small>`;
  const badges = CHAPTERS.filter(complete).map(ch => `<span title="${ch.title}">${ch.emoji}</span>`).join('');
  $('badges').innerHTML = doneCount === CHAPTERS.length
    ? `<div class="grad">🎓 Game Dev Graduate!</div>${badges}`
    : badges ? `<small>Badges</small><div>${badges}</div>` : '';
}

// ---------------------------------------------------------------------------
// Chapter page
// ---------------------------------------------------------------------------
let cleanups: (() => void)[] = [];

function renderChapter(id: string): void {
  for (const c of cleanups) c();
  cleanups = [];
  const idx = Math.max(0, CHAPTERS.findIndex(c => c.id === id));
  const ch = CHAPTERS[idx];
  progress.visited[ch.id] = true;
  save();
  const main = $('content');
  main.innerHTML = `<header><span class="big">${ch.emoji}</span><div><small>Chapter ${idx}</small><h1>${ch.title}</h1><p>${ch.blurb}</p></div></header>`;
  ch.blocks.forEach((b, i) => main.appendChild(renderBlock(ch, b, i)));
  const nav = document.createElement('div');
  nav.className = 'pager';
  nav.innerHTML = `${idx > 0 ? `<a href="#${CHAPTERS[idx - 1].id}">◀ ${CHAPTERS[idx - 1].title}</a>` : '<span></span>'}
    ${idx < CHAPTERS.length - 1 ? `<a class="next" href="#${CHAPTERS[idx + 1].id}">Next: ${CHAPTERS[idx + 1].title} ▶</a>` : '<a class="next" href="./">🎮 Play the game!</a>'}`;
  main.appendChild(nav);
  window.scrollTo(0, 0);
  renderSide(ch.id);
}

function renderBlock(ch: Chapter, b: Block, i: number): HTMLElement {
  const box = document.createElement('section');
  switch (b.t) {
    case 'p': box.className = 'text'; box.innerHTML = b.html; break;
    case 'nav': box.className = 'nav-says'; box.innerHTML = `<b>🤖 NAV-9000:</b> "${b.html}"`; break;
    case 'try': box.className = 'try'; box.innerHTML = `<b>🧪 Try it:</b> ${b.html}`; break;
    case 'grown': box.className = 'grown'; box.innerHTML = `<details><summary>🧑‍🔬 For grown-ups: the deeper details</summary><div>${b.html}</div></details>`; break;
    case 'code': {
      const { code, line } = region(b.file, b.region);
      box.className = 'codebox';
      box.innerHTML = `${b.note ? `<p class="note">${b.note}</p>` : ''}${codeBlock(code, `src/${b.file}`, line)}`;
      break;
    }
    case 'demo': {
      box.className = 'demo';
      box.innerHTML = `<h3>🕹️ ${b.title}</h3>`;
      const stage = document.createElement('div');
      box.appendChild(stage);
      // Mount when visible (so off-screen demos don't burn battery), unmount on page change.
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting) && !stage.childElementCount) cleanups.push(DEMOS[b.id](stage));
      });
      io.observe(box);
      cleanups.push(() => io.disconnect());
      break;
    }
    case 'quiz': box.className = 'quiz'; renderQuiz(box, ch, b, i); break;
    case 'challenge': box.className = 'challenge'; renderChallenge(box, b.id); break;
  }
  return box;
}

const CHEERS = ['Correct! I knew that. Obviously.', 'Excellent! Your brain is almost as big as mine.', 'Yes! Have a virtual donut. 🍩', 'Spot on!'];
const OOPS = ['Not quite. Even I make mistakes. Never. But you can!', 'Oops-a-daisy! Try again.', 'Hmm, recalculating... try another one.'];

function renderQuiz(box: HTMLElement, ch: Chapter, b: Extract<Block, { t: 'quiz' }>, i: number): void {
  const key = quizKey(ch, i);
  box.innerHTML = `<p class="q">🧠 ${b.q}</p><div class="opts"></div><p class="feedback"></p>`;
  const opts = box.querySelector('.opts')!, fb = box.querySelector('.feedback')!;
  b.options.forEach((o, k) => {
    const btn = document.createElement('button');
    btn.textContent = o;
    btn.onclick = () => {
      if (k === b.answer) {
        btn.classList.add('right');
        fb.innerHTML = `✅ ${CHEERS[(i + k) % CHEERS.length]} <i>${b.why}</i>`;
        progress.quizzes[key] = true;
        save();
        renderSide(ch.id);
      } else {
        btn.classList.add('wrong');
        fb.innerHTML = `❌ ${OOPS[(i + k) % OOPS.length]}`;
      }
    };
    opts.appendChild(btn);
  });
  if (progress.quizzes[key]) {
    (opts.children[b.answer] as HTMLElement).classList.add('right');
    fb.innerHTML = `✅ <i>${b.why}</i>`;
  }
}

function renderChallenge(box: HTMLElement, id: string): void {
  const ch = CHALLENGES[id];
  box.innerHTML = `<h3>💻 Challenge: ${ch.title} ${progress.challenges[id] ? '✅' : ''}</h3><p>${ch.prompt}</p>
    <textarea spellcheck="false" rows="${Math.max(6, ch.starter.split('\n').length + 2)}"></textarea>
    <div class="controls"><button class="run">▶ Run my code</button><button class="hint">💡 Hint</button><button class="sol">👀 Show a solution</button><button class="reset">↺ Start over</button></div>
    <div class="results"></div>`;
  const ta = box.querySelector('textarea')!;
  ta.value = progress.code[id] ?? ch.starter;
  ta.addEventListener('keydown', e => { // Tab inserts two spaces instead of leaving the box
    if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); }
  });
  const out = box.querySelector('.results')!;
  (box.querySelector('.run') as HTMLButtonElement).onclick = () => {
    progress.code[id] = ta.value;
    const { results, error } = runChallenge(ch, ta.value);
    if (error) { out.innerHTML = `<p class="bad">💥 Your code has an error: <code>${error}</code></p>`; save(); return; }
    const all = results.every(r => r.ok);
    out.innerHTML = results.map(r => `<div class="${r.ok ? 'good' : 'bad'}">${r.ok ? '✅' : '❌'} ${r.label}: got <code>${r.got}</code>${r.ok ? '' : `, wanted <code>${r.want}</code>`}</div>`).join('')
      + (all ? '<p class="good"><b>🎉 All tests pass! Challenge complete.</b></p>' : '');
    if (all) progress.challenges[id] = true;
    save();
    renderSide(location.hash.slice(1) || CHAPTERS[0].id);
  };
  (box.querySelector('.hint') as HTMLButtonElement).onclick = () => { out.innerHTML = `<p>💡 ${ch.hint.replace(/</g, '&lt;')}</p>`; };
  (box.querySelector('.sol') as HTMLButtonElement).onclick = () => { ta.value = ch.solution; ta.rows = Math.max(ta.rows, ch.solution.split('\n').length + 1); out.innerHTML = '<p>Here\'s one way to do it. Press ▶ Run to check it, then try changing it!</p>'; };
  (box.querySelector('.reset') as HTMLButtonElement).onclick = () => { ta.value = ch.starter; out.innerHTML = ''; };
}

// ---------------------------------------------------------------------------
// Routing: #chapter-id in the address bar
// ---------------------------------------------------------------------------
const route = () => renderChapter(location.hash.slice(1) || CHAPTERS[0].id);
window.addEventListener('hashchange', route);
route();
if (import.meta.env.DEV) Object.assign(window, { __academyReset: () => { progress = { quizzes: {}, challenges: {}, visited: {}, code: {} }; save(); route(); } });
