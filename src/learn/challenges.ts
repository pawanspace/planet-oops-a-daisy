// Oops Academy: small coding challenges. You write one JavaScript function; we run it against test cases.
// (The code runs only in your own browser, on your own computer.)

export interface Case { args: unknown[]; expect: unknown; label: string }
export interface Challenge {
  id: string;
  title: string;
  prompt: string;     // HTML
  fn: string;         // the function name we call
  starter: string;
  hint: string;
  solution: string;
  cases: Case[];
}

const approx = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6 || (a === Infinity && b === Infinity);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => approx(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => approx((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
};

export interface CaseResult { label: string; ok: boolean; got: string; want: string }

/** Compile the learner's code and run every case. Errors become a failed result with the message. */
export function runChallenge(ch: Challenge, code: string): { results: CaseResult[]; error?: string } {
  let fn: (...a: unknown[]) => unknown;
  try {
    fn = new Function(`${code}\nreturn ${ch.fn};`)() as typeof fn;
    if (typeof fn !== 'function') throw new Error(`I couldn't find a function called ${ch.fn}`);
  } catch (e) {
    return { results: [], error: (e as Error).message };
  }
  const show = (v: unknown) => JSON.stringify(v, (_k, x) => (x === Infinity ? '∞' : x));
  const results = ch.cases.map(c => {
    try {
      const got = fn(...structuredClone(c.args));
      return { label: c.label, ok: approx(got, c.expect), got: show(got), want: show(c.expect) };
    } catch (e) {
      return { label: c.label, ok: false, got: `💥 ${(e as Error).message}`, want: show(c.expect) };
    }
  });
  return { results };
}

const TILE = 48;

export const CHALLENGES: Record<string, Challenge> = {
  tileOf: {
    id: 'tileOf', title: 'Which tile am I in?', fn: 'tileOf',
    prompt: `Write <code>tileOf(px)</code>: given a pixel position, return the tile number. Tiles are <b>48</b> px wide, so pixels 0–47 are
      tile 0, 48–95 are tile 1, and so on. <br>Hint: divide, then round <i>down</i> with <code>Math.floor</code>.`,
    starter: `function tileOf(px) {\n  // your code here\n  return 0;\n}`,
    hint: 'Math.floor(px / 48)',
    solution: `function tileOf(px) {\n  return Math.floor(px / ${TILE});\n}`,
    cases: [
      { args: [0], expect: 0, label: 'tileOf(0)' }, { args: [47], expect: 0, label: 'tileOf(47)' },
      { args: [48], expect: 1, label: 'tileOf(48)' }, { args: [130], expect: 2, label: 'tileOf(130)' },
      { args: [1000], expect: 20, label: 'tileOf(1000)' },
    ],
  },
  move: {
    id: 'move', title: 'Move Leo one step', fn: 'move',
    prompt: `Write <code>move(x, y, inputX, inputY, speed, dt)</code> that returns Leo's new position <code>{ x, y }</code>.
      <br>• new x = x + inputX × speed × dt (same for y).
      <br>• ⭐ Bonus (needed for the last tests): if the arrow is longer than 1 (a diagonal), divide inputX and inputY by its length
      <code>Math.hypot(inputX, inputY)</code> first, so diagonals aren't faster.`,
    starter: `function move(x, y, inputX, inputY, speed, dt) {\n  // your code here\n  return { x: x, y: y };\n}`,
    hint: 'const len = Math.hypot(inputX, inputY); if (len > 1) { inputX /= len; inputY /= len; } then use the formula.',
    solution: `function move(x, y, inputX, inputY, speed, dt) {\n  const len = Math.hypot(inputX, inputY);\n  if (len > 1) { inputX /= len; inputY /= len; }\n  return { x: x + inputX * speed * dt, y: y + inputY * speed * dt };\n}`,
    cases: [
      { args: [100, 100, 1, 0, 150, 1 / 60], expect: { x: 102.5, y: 100 }, label: 'walk right for one step' },
      { args: [100, 100, 0, -1, 240, 0.5], expect: { x: 100, y: -20 }, label: 'run up for half a second' },
      { args: [0, 0, 0, 0, 150, 1], expect: { x: 0, y: 0 }, label: 'no keys pressed' },
      { args: [0, 0, 1, 1, 100, 1], expect: { x: 100 / Math.SQRT2, y: 100 / Math.SQRT2 }, label: 'diagonal is NOT faster' },
    ],
  },
  nextState: {
    id: 'nextState', title: 'An alien brain', fn: 'nextState',
    prompt: `Write <code>nextState(state, seesLeo, meter)</code> for a tiny alien brain. Return the new state:
      <br>• <code>'patrol'</code> + sees Leo → <code>'suspicious'</code>
      <br>• <code>'suspicious'</code> + meter is 1 or more → <code>'chase'</code>
      <br>• <code>'suspicious'</code> + meter is 0 or less → <code>'patrol'</code>
      <br>• anything else → stay in the same state.`,
    starter: `function nextState(state, seesLeo, meter) {\n  // your code here\n  return state;\n}`,
    hint: "if (state === 'patrol' && seesLeo) return 'suspicious'; ...",
    solution: `function nextState(state, seesLeo, meter) {\n  if (state === 'patrol' && seesLeo) return 'suspicious';\n  if (state === 'suspicious' && meter >= 1) return 'chase';\n  if (state === 'suspicious' && meter <= 0) return 'patrol';\n  return state;\n}`,
    cases: [
      { args: ['patrol', true, 0], expect: 'suspicious', label: 'patrol + sees Leo' },
      { args: ['patrol', false, 0], expect: 'patrol', label: 'patrol, nobody around' },
      { args: ['suspicious', true, 1], expect: 'chase', label: 'meter full' },
      { args: ['suspicious', false, 0], expect: 'patrol', label: 'meter drained' },
      { args: ['suspicious', true, 0.5], expect: 'suspicious', label: 'still staring' },
      { args: ['chase', false, 1], expect: 'chase', label: 'already chasing' },
    ],
  },
  inCone: {
    id: 'inCone', title: 'Can the alien see Leo?', fn: 'canSee',
    prompt: `Write <code>canSee(ax, ay, lookDeg, px, py, halfDeg, range)</code>: is point (px, py) inside the alien's cone? (Ignore walls.)
      <br>1. distance = <code>Math.hypot(px - ax, py - ay)</code> must be ≤ range.
      <br>2. the angle to Leo is <code>Math.atan2(py - ay, px - ax)</code> (in radians; × 180 / Math.PI for degrees).
         The difference from lookDeg, wrapped into −180..180, must be ≤ halfDeg (use the absolute value).
      <br>Angles: 0° = right, 90° = down, 180° = left (screen y grows downwards).`,
    starter: `function canSee(ax, ay, lookDeg, px, py, halfDeg, range) {\n  // your code here\n  return false;\n}`,
    hint: 'let diff = angleToLeo - lookDeg; while (diff > 180) diff -= 360; while (diff < -180) diff += 360; return Math.abs(diff) <= halfDeg && dist <= range;',
    solution: `function canSee(ax, ay, lookDeg, px, py, halfDeg, range) {\n  const dist = Math.hypot(px - ax, py - ay);\n  if (dist > range) return false;\n  const angle = Math.atan2(py - ay, px - ax) * 180 / Math.PI;\n  let diff = angle - lookDeg;\n  while (diff > 180) diff -= 360;\n  while (diff < -180) diff += 360;\n  return Math.abs(diff) <= halfDeg;\n}`,
    cases: [
      { args: [100, 100, 180, 40, 100, 40, 240], expect: true, label: 'looking left, Leo to the left' },
      { args: [100, 100, 180, 160, 100, 40, 240], expect: false, label: 'looking left, Leo to the RIGHT (behind it)' },
      { args: [100, 100, 180, 40, 110, 40, 240], expect: true, label: 'slightly off-centre' },
      { args: [100, 100, 180, 100, 40, 40, 240], expect: false, label: 'straight above (90° off)' },
      { args: [100, 100, 0, 400, 100, 40, 240], expect: false, label: 'too far away' },
      { args: [0, 0, 170, -10, -3, 40, 240], expect: true, label: 'angle wrap-around (170° vs about -163°)' },
    ],
  },
  bfs: {
    id: 'bfs', title: 'Pathfinding ripple', fn: 'steps',
    prompt: `Write <code>steps(map, sc, sr)</code>: <code>map</code> is a list of strings ('#' = wall, '.' = floor). Return a list of the same
      shape where every floor tile holds its walking distance from (sc, sr), and walls / unreachable tiles hold <code>-1</code>.
      <br>Use Breadth-First Search: a queue starting with the start tile at distance 0; take tiles from the front, give each open
      neighbour (up/down/left/right) without a number yet the distance + 1, and add it to the back.`,
    starter: `function steps(map, sc, sr) {\n  const h = map.length, w = map[0].length;\n  const dist = map.map(row => [...row].map(() => -1));\n  // your code here\n  return dist;\n}`,
    hint: 'const queue = [[sc, sr]]; dist[sr][sc] = 0; while (queue.length) { const [c, r] = queue.shift(); for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) { ... } }',
    solution: `function steps(map, sc, sr) {\n  const h = map.length, w = map[0].length;\n  const dist = map.map(row => [...row].map(() => -1));\n  dist[sr][sc] = 0;\n  const queue = [[sc, sr]];\n  while (queue.length) {\n    const [c, r] = queue.shift();\n    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {\n      const nc = c + dc, nr = r + dr;\n      if (nr < 0 || nc < 0 || nr >= h || nc >= w) continue;\n      if (map[nr][nc] === '#' || dist[nr][nc] !== -1) continue;\n      dist[nr][nc] = dist[r][c] + 1;\n      queue.push([nc, nr]);\n    }\n  }\n  return dist;\n}`,
    cases: [
      { args: [['...'], 0, 0], expect: [[0, 1, 2]], label: 'a straight line' },
      { args: [['.#.', '...'], 0, 0], expect: [[0, -1, 4], [1, 2, 3]], label: 'around a wall' },
      { args: [['.#.'], 0, 0], expect: [[0, -1, -1]], label: 'unreachable tile' },
    ],
  },
  catches: {
    id: 'catches', title: 'Will the chaser catch Leo?', fn: 'catchTime',
    prompt: `In a straight hallway, Leo walks away at <code>leoSpeed</code> and the alien runs after him at <code>alienSpeed</code>, starting
      <code>gap</code> px behind. Write <code>catchTime(gap, leoSpeed, alienSpeed)</code> returning how many seconds until it catches up,
      or <code>Infinity</code> if it never does.<br>Hint: every second the gap shrinks by (alienSpeed − leoSpeed).`,
    starter: `function catchTime(gap, leoSpeed, alienSpeed) {\n  // your code here\n  return 0;\n}`,
    hint: 'const closing = alienSpeed - leoSpeed; if (closing <= 0) return Infinity; return gap / closing;',
    solution: `function catchTime(gap, leoSpeed, alienSpeed) {\n  const closing = alienSpeed - leoSpeed;\n  if (closing <= 0) return Infinity;\n  return gap / closing;\n}`,
    cases: [
      { args: [240, 150, 225], expect: 3.2, label: 'Stroller chasing a walking Leo' },
      { args: [240, 240, 225], expect: Infinity, label: 'Leo is running' },
      { args: [96, 150, 250], expect: 0.96, label: 'Blorp the hugger' },
      { args: [100, 150, 140], expect: Infinity, label: 'a slow Heavy' },
    ],
  },
  hears: {
    id: 'hears', title: 'Who hears the honk?', fn: 'whoHears',
    prompt: `Write <code>whoHears(aliens, nx, ny, radius)</code>: <code>aliens</code> is a list of <code>{ x, y, hears }</code>. Return the
      list of <b>indexes</b> of aliens that can hear (<code>hears</code> is true) and are within <code>radius</code> px of the noise
      at (nx, ny). Remember: noise goes through walls, so only distance matters!`,
    starter: `function whoHears(aliens, nx, ny, radius) {\n  const out = [];\n  // your code here\n  return out;\n}`,
    hint: 'aliens.forEach((a, i) => { if (a.hears && Math.hypot(a.x - nx, a.y - ny) <= radius) out.push(i); });',
    solution: `function whoHears(aliens, nx, ny, radius) {\n  const out = [];\n  aliens.forEach((a, i) => {\n    if (a.hears && Math.hypot(a.x - nx, a.y - ny) <= radius) out.push(i);\n  });\n  return out;\n}`,
    cases: [
      { args: [[{ x: 0, y: 0, hears: true }, { x: 500, y: 0, hears: true }], 0, 0, 336], expect: [0], label: 'one near, one far' },
      { args: [[{ x: 100, y: 0, hears: false }, { x: 0, y: 100, hears: true }], 0, 0, 336], expect: [1], label: 'a Heavy wears headphones' },
      { args: [[], 0, 0, 100], expect: [], label: 'nobody around' },
    ],
  },
  foot: {
    id: 'foot', title: 'Backwards feet', fn: 'footX',
    prompt: `Write <code>footX(x, toe, phase, stride, leg)</code>: where is a foot? It's <code>x + toe × sin(p) × stride</code>, where
      <code>p</code> is <code>phase</code> for leg 0 and <code>phase + π</code> for leg 1 (<code>Math.PI</code>), so the legs are always
      opposite. <code>toe</code> is +1 (toes point right) or −1 (left).`,
    starter: `function footX(x, toe, phase, stride, leg) {\n  // your code here\n  return x;\n}`,
    hint: 'const p = phase + leg * Math.PI; return x + toe * Math.sin(p) * stride;',
    solution: `function footX(x, toe, phase, stride, leg) {\n  const p = phase + leg * Math.PI;\n  return x + toe * Math.sin(p) * stride;\n}`,
    cases: [
      { args: [100, 1, Math.PI / 2, 7, 0], expect: 107, label: 'leg 0 fully forward' },
      { args: [100, 1, Math.PI / 2, 7, 1], expect: 93, label: 'leg 1 is opposite' },
      { args: [100, -1, Math.PI / 2, 7, 0], expect: 93, label: 'backwards toes (a local!)' },
      { args: [50, 1, 0, 7, 0], expect: 50, label: 'mid-step' },
    ],
  },
  notes: {
    id: 'notes', title: 'Make music with maths', fn: 'noteHz',
    prompt: `Musical notes are evenly spaced on a multiply scale: going up 12 notes (an octave) doubles the frequency. The note A is 440 Hz.
      Write <code>noteHz(n)</code> giving the frequency <code>n</code> notes above A: <code>440 × 2^(n / 12)</code>
      (in JavaScript, "to the power" is <code>**</code> or <code>Math.pow</code>).`,
    starter: `function noteHz(n) {\n  // your code here\n  return 440;\n}`,
    hint: 'return 440 * 2 ** (n / 12);',
    solution: `function noteHz(n) {\n  return 440 * 2 ** (n / 12);\n}`,
    cases: [
      { args: [0], expect: 440, label: 'A' }, { args: [12], expect: 880, label: 'A, one octave up' },
      { args: [-12], expect: 220, label: 'A, one octave down' }, { args: [4], expect: 440 * 2 ** (4 / 12), label: 'C# (the honk\'s 2nd note!)' },
    ],
  },
};
