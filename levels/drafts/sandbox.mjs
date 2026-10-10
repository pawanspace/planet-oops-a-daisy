// Sandbox: a gray-box map for tuning the core mechanics (not a campaign level).
export default {
  id: 'sandbox',
  name: 'Sandbox Lawn',
  hint: 'Their eyes look BACKWARDS. Sneak up from the front! Grab the key, open the gate, get the spark plug.',
  parTime: 75,
  grid: [
    '##################################',
    '#..........################.....K#',
    '#.P..............................#',
    '#...HH.....################.H..H.#',
    '#..........##.HH....HH....#......#',
    '#..........##.HH.HH.HH.HH.#......#',
    '#......HH.....HH.HH.HH.HH.#......#',
    '#..........##.HH.HH.HH.HH.#.H....#',
    '#############.HH.HH.HH.HH........#',
    '#############....HH....HH.#......#',
    '##############################C###',
    '##..~~~~~~~~~~~~~~~~~~~~~~~~~~...#',
    '##....!..!..!..!..!..!..!..!.....#',
    '##...............................#',
    '##.###############################',
    '##..............................##',
    '#..C....##########################',
    '#.......#.....####################',
    '#...H...G...I.####################',
    '#.......#.....####################',
    '#.......#.....####################',
    '##################################',
  ],
  aliens: [
    // Lawn: one walks a line, one guards both exits
    { kind: 'stroller', route: [[3, 5], [9, 5]] },
    { kind: 'stroller', route: [[10, 1], [10, 7]], speed: 60 },
    // Straight hallway: fast route, but Blorp is asleep in it
    { kind: 'hugger', name: 'Blorp', route: [[22, 2]], facing: 180 },
    // Lookout room guarding the key
    { kind: 'lookout', route: [[29, 5]], facing: 0, turnEvery: 2.5 },
    // Behind the school wall: hears running on the floor rows, not on carpet
    { kind: 'stroller', route: [[6, 15], [30, 15]], speed: 80 },
    // Gate yard
    { kind: 'stroller', route: [[1, 16], [7, 16], [7, 20], [1, 20]], loop: true },
  ],
};
