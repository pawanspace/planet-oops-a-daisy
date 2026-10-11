// Oops Academy: the course. Each chapter is a list of blocks (text, real code, demos, quizzes, challenges).
// To add a chapter, add an entry here: the page builds itself from this data.

export type Block =
  | { t: 'p'; html: string }
  | { t: 'nav'; html: string }                                   // NAV-9000 says...
  | { t: 'grown'; html: string }                                 // "For grown-ups" fold-out
  | { t: 'try'; html: string }                                   // a 🧪 TRY IT in the real code
  | { t: 'code'; file: string; region: string; note?: string }   // a real snippet from the game
  | { t: 'demo'; id: string; title: string }
  | { t: 'quiz'; q: string; options: string[]; answer: number; why: string }
  | { t: 'challenge'; id: string };

export interface Chapter { id: string; emoji: string; title: string; blurb: string; blocks: Block[] }

export const CHAPTERS: Chapter[] = [
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'loop', emoji: '🔁', title: 'What is a game?', blurb: 'The game loop: look, think, draw, 60 times a second.',
    blocks: [
      { t: 'nav', html: 'Hello, future game developer! I am NAV-9000. I have never once made a mistake, so you are in safe hands. Probably.' },
      { t: 'p', html: `A video game is like a <b>flip-book</b>. Every page is a tiny bit different from the last, and when you flip them fast
        it looks like things are moving. A game draws about <b>60 pages every second</b>. For each page it does three things:` },
      { t: 'p', html: `<ol><li><b>Look</b>: which keys are pressed?</li><li><b>Think</b>: move everyone a tiny bit and check the rules (did an
        alien see Leo? did he grab the key?).</li><li><b>Draw</b>: paint everything in its new place.</li></ol>
        Then it does it all again. Forever. This is called the <b>game loop</b>.` },
      { t: 'code', file: 'sim/world.ts', region: 'step', note: 'This is the "think" part: one step of the world. Read the comments!' },
      { t: 'p', html: `Notice <code>dt</code>: that's the length of one step, <b>1/60 of a second</b>. When Leo walks at 150 pixels per second,
        each step he moves 150 × 1/60 = <b>2.5 pixels</b>.` },
      { t: 'demo', id: 'gameloop', title: 'The game loop at different screen speeds' },
      { t: 'p', html: `Try the different screen speeds. A 15 Hz screen draws only 15 pages a second, so it looks jumpy, but Leo still arrives at
        the same time! That's because the world always steps in exact 1/60 s slices, using a "time bank":` },
      { t: 'code', file: 'game/GameScene.ts', region: 'gameloop' },
      { t: 'grown', html: `This is a <b>fixed-timestep loop with an accumulator</b> ("Fix your timestep!"). Because the simulation never
        sees a variable dt and never uses <code>Math.random</code> or the clock, it is fully deterministic: identical inputs produce
        identical results. That's what makes the replay-style tests and the look-ahead bots possible.` },
      { t: 'quiz', q: 'Leo runs at 240 px per second. How far does he move in ONE step (1/60 s)?', options: ['240 px', '4 px', '60 px', '2.5 px'], answer: 1, why: '240 × 1/60 = 4 px.' },
      { t: 'quiz', q: 'On a 120 Hz iPad, how many world steps happen every second?', options: ['120', '60', '30', 'It depends on the level'], answer: 1, why: 'Always 60: the time bank only releases a step when 1/60 s has built up.' },
      { t: 'quiz', q: 'Which part of the game decides whether Leo got hugged?', options: ['The drawing code', 'The world rules (world.ts)', 'The music', 'The browser'], answer: 1, why: 'The rules decide; the drawing code only shows what happened.' },
      { t: 'try', html: 'Open <code>src/sim/config.ts</code>, change <code>walkSpeed</code> to 300, save, and play a level.' },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'grid', emoji: '🗺️', title: 'Grids & maps', blurb: 'Tiles, coordinates, and how a level is stored.',
    blocks: [
      { t: 'p', html: `Every level is a <b>grid</b> of squares called <b>tiles</b>, like squared paper. Each tile is <b>48 pixels</b> wide.
        We count tiles by <b>column</b> (c, left → right) and <b>row</b> (r, top → bottom), starting from 0 in the top-left corner.` },
      { t: 'p', html: `Careful: on a computer screen, <b>y grows downwards</b>! Row 0 is at the top.` },
      { t: 'demo', id: 'grid', title: 'Grid explorer' },
      { t: 'p', html: 'To turn a pixel into a tile, divide by 48 and round down:' },
      { t: 'code', file: 'sim/grid.ts', region: 'tileOf' },
      { t: 'p', html: `The computer stores the whole map as <b>one long list</b> of numbers, row after row. Tile (c, r) is at position
        <code>r × width + c</code>. A wall is the number 2, floor is 1, a hedge is 3...` },
      { t: 'quiz', q: 'Which tile is pixel 100 in?', options: ['Tile 1', 'Tile 2', 'Tile 3', 'Tile 100'], answer: 1, why: '100 ÷ 48 = 2.08, rounded down = 2.' },
      { t: 'quiz', q: 'A level is 20 tiles wide. Where in the list is tile (c=4, r=2)?', options: ['6', '24', '44', '80'], answer: 2, why: '2 × 20 + 4 = 44.' },
      { t: 'quiz', q: 'Row 0 is at the...', options: ['Top of the map', 'Bottom of the map', 'Middle', 'Left edge'], answer: 0, why: 'Screens count y downwards from the top.' },
      { t: 'challenge', id: 'tileOf' },
      { t: 'grown', html: `Levels are authored as Tiled <code>.tmj</code> JSON (or drafted as ASCII by <code>tools/gen-campaign.py</code>) and loaded
        by <code>loadTiled()</code> in <code>src/sim/level.ts</code>, which validates everything so a typo in a level fails loudly.` },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'move', emoji: '🏃', title: 'Moving Leo', blurb: 'Speed × time, collision boxes, sliding along walls.',
    blocks: [
      { t: 'p', html: `To move: <b>new position = old position + direction × speed × time</b>. Pressing right gives direction (1, 0);
        up-left gives (−1, −1).` },
      { t: 'p', html: `Problem: (−1, −1) is <b>longer</b> than (1, 0)! Its length is √2 ≈ 1.41, so Leo would walk 41% faster diagonally. We fix
        it by dividing by the length ("normalising"), so every direction has length 1.` },
      { t: 'code', file: 'sim/world.ts', region: 'movePlayer' },
      { t: 'p', html: `Leo has a <b>collision box</b>: a 28 × 28 px square. Before moving, we check whether the box would overlap a wall
        (<code>canStand</code>). Left/right and up/down are checked <b>separately</b>, so if only one is blocked he slides along the wall.` },
      { t: 'code', file: 'sim/grid.ts', region: 'canStand' },
      { t: 'demo', id: 'movement', title: 'Drive Leo (click the map, then use the arrow keys)' },
      { t: 'p', html: `Try setting <b>corner assist</b> to 0 and slipping into the gaps. Hard, isn't it? Corner assist gently nudges Leo
        into an opening when he's almost lined up.` },
      { t: 'quiz', q: 'Without normalising, how fast would Leo walk diagonally at 150 px/s?', options: ['150 px/s', 'About 212 px/s', '300 px/s', '75 px/s'], answer: 1, why: '150 × √2 ≈ 212.' },
      { t: 'quiz', q: 'Why check x and y movement separately?', options: ['It is faster', 'So Leo slides along walls instead of getting stuck', 'Because the screen is flat', 'No reason'], answer: 1, why: 'If only one direction is blocked, the other still moves: sliding!' },
      { t: 'challenge', id: 'move' },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'brain', emoji: '🧠', title: 'Alien brains', blurb: 'States: patrol → suspicious → chase → search → return.',
    blocks: [
      { t: 'p', html: `An alien is always in one <b>state</b>: a mood or a job. In each state it behaves differently, and certain things make it
        switch to another state. This is called a <b>state machine</b>, and almost every game character works this way.` },
      { t: 'p', html: `<b>patrol</b> (walk the route) → sees Leo → <b>suspicious</b> (stop and stare, "?" meter fills) → meter full →
        <b>chase</b> → loses Leo or gets tired → <b>search</b> (look around) → <b>return</b> → <b>patrol</b>.
        Plus: hears a noise → <b>investigate</b>; honked → <b>stunned</b>; donut → <b>toDonut</b> → <b>eating</b>.` },
      { t: 'demo', id: 'states', title: 'Drag Leo into the alien\'s view and watch its state' },
      { t: 'code', file: 'sim/world.ts', region: 'suspicion', note: 'The "?" meter: it fills faster when Leo is close.' },
      { t: 'code', file: 'sim/world.ts', region: 'patrol' },
      { t: 'quiz', q: 'An alien is eating a donut. Can it see Leo?', options: ['Yes', 'No: eating aliens don\'t use their eyes', 'Only at night', 'Only if Leo runs'], answer: 1, why: "'eating' isn't one of the awake, calm states that check the eyes." },
      { t: 'quiz', q: 'What happens when the "?" meter drains back to 0?', options: ['The alien chases', 'The alien goes back to what it was doing', 'The game ends', 'The alien falls asleep'], answer: 1, why: 'It "resumes" its previous state.' },
      { t: 'challenge', id: 'nextState' },
      { t: 'try', html: 'In <code>src/sim/config.ts</code>, set <code>suspicionFillTime</code> to 3. Aliens become very slow to notice you!' },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'see', emoji: '👀', title: 'Seeing', blurb: 'Angles, vision cones and line of sight. And backwards eyes!',
    blocks: [
      { t: 'p', html: `The big joke of the game: locals' eyes point <b>backwards</b>, the opposite way to where they walk. An alien can see you if
        all three are true: you're <b>close enough</b>, you're <b>inside its cone</b>, and there's <b>nothing in the way</b>.` },
      { t: 'p', html: `Angles: 0° is right, 90° is <b>down</b> (because y grows downwards), 180° is left, 270° (or −90°) is up.
        <code>Math.atan2(dy, dx)</code> turns a direction into an angle.` },
      { t: 'demo', id: 'vision', title: 'The three tests (drag Leo, try the sliders)' },
      { t: 'code', file: 'sim/world.ts', region: 'canSee' },
      { t: 'p', html: 'Angles wrap around (350° and 10° are only 20° apart), so we need a helper:' },
      { t: 'code', file: 'sim/world.ts', region: 'angleDiff' },
      { t: 'p', html: '"Nothing in the way" walks along the line from the alien to Leo, tile by tile:' },
      { t: 'code', file: 'sim/grid.ts', region: 'lineOfSight' },
      { t: 'code', file: 'sim/world.ts', region: 'lookAlong', note: 'The backwards-eyes rule itself!' },
      { t: 'quiz', q: 'A Stroller walks to the RIGHT. Where does it look?', options: ['Right', 'Left', 'Up', 'All around'], answer: 1, why: 'Backwards eyes: it looks the opposite way to where it walks.' },
      { t: 'quiz', q: 'An alien looks left (180°) with a 40° half-angle. Leo is straight above it (270°). Seen?', options: ['Yes', 'No'], answer: 1, why: '270° − 180° = 90°, more than 40°.' },
      { t: 'quiz', q: 'Where is it safest to stand near a walking alien?', options: ['Right behind it', 'In front of it (but out of its way!)', 'Next to it, touching', 'There is no safe place'], answer: 1, why: 'Its eyes point behind it, so in front is invisible. Just don\'t get walked into!' },
      { t: 'challenge', id: 'inCone' },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'path', emoji: '🧭', title: 'Finding the way', blurb: 'Pathfinding with a breadth-first search ripple.',
    blocks: [
      { t: 'p', html: `How does an alien find its way around walls to where it heard a noise? Imagine dropping a stone in a pond at the goal:
        the ripple spreads out one step at a time. Every tile gets a number: how many steps it is from the goal. This is called
        <b>Breadth-First Search</b> (BFS).` },
      { t: 'p', html: `To walk to the goal from anywhere, just keep stepping onto a neighbour with a <b>smaller number</b>. It's like walking
        downhill.` },
      { t: 'demo', id: 'pathfinding', title: 'Pathfinding playground (click to add walls)' },
      { t: 'code', file: 'sim/grid.ts', region: 'distField' },
      { t: 'code', file: 'sim/grid.ts', region: 'stepDown' },
      { t: 'grown', html: `BFS gives shortest paths on an unweighted 4-connected grid in O(tiles). Many aliens share one field per goal tile,
        cached in <code>World.fieldTo</code> and invalidated when the map changes (gates, lasers, shields). A* would be faster for a
        single long query, but a cached distance field answers every alien heading to the same target at once.` },
      { t: 'quiz', q: 'A tile has the number 7. Its neighbours have 6, 8 and 8. Which way leads to the goal?', options: ['The 6', 'An 8', 'Stay still', 'Any of them'], answer: 0, why: 'Always step to a smaller number.' },
      { t: 'quiz', q: 'What number does a tile you can\'t reach get?', options: ['0', '-1', 'Infinity', '99'], answer: 2, why: 'Infinity: no number of steps gets you there. (In the challenge we use -1, which is easier to print.)' },
      { t: 'challenge', id: 'bfs' },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'chase', emoji: '💨', title: 'Chases & skids', blurb: 'Speed, acceleration, and why corners save you.',
    blocks: [
      { t: 'p', html: `A chasing Stroller runs at 225 px/s and Leo walks at 150, so in a straight hallway it <b>always catches him</b>. But
        backwards legs are bad at corners: at every turn the chaser has to skid to a stop, untangle its legs, and speed up again.` },
      { t: 'demo', id: 'chase', title: 'Race: straight hallway vs zig-zag' },
      { t: 'code', file: 'sim/world.ts', region: 'moveToward' },
      { t: 'code', file: 'sim/world.ts', region: 'chase' },
      { t: 'quiz', q: 'Being chased in a long, straight hallway. What should Leo do?', options: ['Keep walking straight', 'Turn a corner as soon as possible', 'Stop and wait', 'Walk backwards'], answer: 1, why: 'Corners cost the chaser about a second each. Straights are where it wins.' },
      { t: 'quiz', q: 'The gap is 240 px, Leo walks at 150, the alien runs at 225. How long until it catches him on a straight?', options: ['1.6 s', '3.2 s', '10 s', 'Never'], answer: 1, why: 'The gap shrinks 75 px every second: 240 ÷ 75 = 3.2 s.' },
      { t: 'challenge', id: 'catches' },
      { t: 'try', html: 'In the demo, set <b>Untangle time</b> to 0. Can Leo still escape through the zig-zag?' },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'noise', emoji: '🎺', title: 'Noise & gadgets', blurb: 'Events, radiuses and trade-offs.',
    blocks: [
      { t: 'p', html: `Running makes <b>noise</b>: a circle around Leo. Every alien inside the circle (even behind walls!) walks over to
        investigate. Squeaky floors squeak even when you walk; carpets are silent.` },
      { t: 'demo', id: 'noise', title: 'Click to make noises' },
      { t: 'code', file: 'sim/world.ts', region: 'noise' },
      { t: 'p', html: `Good gadgets are <b>trade-offs</b>, not free passes. The honk stuns aliens right next to you, but it's LOUD, so
        everyone nearby comes running.` },
      { t: 'code', file: 'sim/world.ts', region: 'honk' },
      { t: 'code', file: 'sim/world.ts', region: 'throwDonut' },
      { t: 'quiz', q: 'Noise reaches aliens...', options: ['Only in the same corridor', 'Through walls, within the radius', 'Only if they can see you', 'Everywhere on the map'], answer: 1, why: 'Noise uses straight-line distance, so walls don\'t stop it.' },
      { t: 'quiz', q: 'Why did we make honking loud?', options: ['To annoy parents', 'So it isn\'t a free pass: it has a cost', 'Because horns are loud', 'It was a bug'], answer: 1, why: 'In the first version, honking froze everyone and made the game too easy.' },
      { t: 'challenge', id: 'hears' },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'draw', emoji: '🎨', title: 'Drawing it', blurb: 'Shapes, layers, the camera, and walking with sine waves.',
    blocks: [
      { t: 'p', html: `There are no picture files for the characters: they're drawn from circles and lines every frame. A walk is just a
        <b>sine wave</b>. <code>Math.sin(phase)</code> swings smoothly between −1 and +1; each foot sits at
        <code>x + toe × sin(phase) × stride</code>. The second leg adds π (half a turn), so it's always opposite.` },
      { t: 'demo', id: 'walk', title: 'Sine-wave legs' },
      { t: 'code', file: 'game/art/characters.ts', region: 'legs' },
      { t: 'p', html: `The game draws in <b>layers</b>, like tracing paper: floor, then vision cones, then characters (sorted so lower ones are
        drawn last and appear in front), then effects on top. The cones come from shooting a fan of rays that stop at walls:` },
      { t: 'code', file: 'game/draw.ts', region: 'conePoints' },
      { t: 'quiz', q: 'What does Math.sin(phase + Math.PI) give compared to Math.sin(phase)?', options: ['The same', 'The opposite (negative)', 'Double', 'Zero'], answer: 1, why: 'Adding π (half a circle) flips a sine wave.' },
      { t: 'quiz', q: 'Why are characters lower on the screen drawn LAST?', options: ['Random', 'They\'re "closer", so they should appear in front', 'They\'re more important', 'To save battery'], answer: 1, why: 'The painter\'s algorithm: paint the far things first.' },
      { t: 'challenge', id: 'foot' },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'juice', emoji: '✨', title: 'Juice & sound', blurb: 'Particles, freeze frames, and sounds made from maths.',
    blocks: [
      { t: 'p', html: `"Juice" is the little stuff that makes a game feel great without changing the rules: confetti, camera shakes, a
        split-second freeze when you get hugged, dust when you run.` },
      { t: 'p', html: `Sound effects are generated, not recorded: an <b>oscillator</b> wiggles the speaker <i>frequency</i> times per second.
        440 wiggles per second is the note A. The honk plays two notes at once: 440 Hz and 554 Hz.` },
      { t: 'demo', id: 'juice', title: 'Sound board and confetti' },
      { t: 'code', file: 'game/sound.ts', region: 'tone' },
      { t: 'quiz', q: 'Doubling a frequency makes the note...', options: ['Louder', 'One octave higher', 'Slower', 'Quieter'], answer: 1, why: '880 Hz is A one octave above 440 Hz.' },
      { t: 'quiz', q: 'Particles use random numbers. Does that break the "same input → same result" rule?', options: ['Yes', 'No: they\'re only decoration, the rules don\'t use them'], answer: 1, why: 'Only the rules have to be deterministic.' },
      { t: 'challenge', id: 'notes' },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'bots', emoji: '🤖', title: 'Testing with bots', blurb: 'Robots that imagine the future to prove every level can be beaten.',
    blocks: [
      { t: 'p', html: `How do we know every level can be beaten? Robots play them! The careful robot <b>copies</b> the whole world, imagines what
        happens if it walks, waits or dodges for the next 1.6 seconds, and picks something safe. Then it does it again, 10 times a second.` },
      { t: 'demo', id: 'bot', title: 'Watch the robot imagine its futures' },
      { t: 'p', html: `The tests run this robot on all 12 levels on Easy, Normal and Hard. If anyone makes a level impossible, the tests go red.
        A second "rush" robot just runs at the goal spamming gadgets; the tests check it never gets a perfect run.` },
      { t: 'quiz', q: 'Why does the robot copy the world before trying a move?', options: ['To save memory', 'So imagining a move doesn\'t really do it', 'It\'s faster', 'To draw it'], answer: 1, why: 'Testing on the real world would really move Leo, maybe into a hug!' },
      { t: 'quiz', q: 'Why can a robot imagine the future at all?', options: ['It\'s magic', 'Because the rules are deterministic: same input, same result', 'It reads your mind', 'It cheats'], answer: 1, why: 'No randomness in the rules means the imagined future is exactly what will happen.' },
      { t: 'grown', html: `See <code>tests/bot.ts</code> (careful + rush bots) and <code>tests/playthrough.ts</code>. The careful bot is a greedy
        receding-horizon planner over cloned worlds, with detours when stuck. It's not optimal, but it's a strong "is this solvable
        by a patient player" oracle, and it found several real level bugs during development.` },
    ],
  },
  // -----------------------------------------------------------------------------------------------------------
  {
    id: 'make', emoji: '🛠️', title: 'Make it yours', blurb: 'Design a level, then change the rules.',
    blocks: [
      { t: 'p', html: 'Your turn! Draw a level with letters, play it, then ask the robot whether it can be beaten.' },
      { t: 'demo', id: 'editor', title: 'Level workshop' },
      { t: 'p', html: `<b>Bigger ideas to try in the real code</b>:<ul>
        <li><b>A new alien kind</b>: copy the <code>stroller</code> line in <code>KINDS</code> (src/sim/config.ts), give it a new name and
        numbers, add it to <code>AlienKind</code>, and give it a colour in <code>src/game/art/characters.ts</code>.</li>
        <li><b>A new gadget</b>: add a button in <code>src/game/controls.ts</code>, a field in <code>Input</code>, and a function like
        <code>honk()</code> in world.ts.</li>
        <li><b>A new level for the campaign</b>: add it to <code>tools/gen-campaign.py</code>, run it, then add the id to
        <code>src/sim/campaign.ts</code>. Then run <code>npm test</code> to see if the robot can beat it!</li></ul>` },
      { t: 'nav', html: 'Congratulations, graduate! I always knew you could do it. I calculated it. Probably.' },
    ],
  },
];
