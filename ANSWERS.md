# 🧠 Quiz answers

Answers to the `🧠 QUIZ` questions hidden in the code comments. Try them first!

| # | Where | Answer |
|---|---|---|
| Q1 | config.ts | 240 ÷ 48 = **5 tiles per second**. |
| Q2 | config.ts | 2 × 48 = **96 px**. |
| Q3 | config.ts | Walking (150) **can't** beat a belt (200), so you have to pull a lever, moonwalk, or run. Running (240) beats it, but only by 40 px/s, and running is noisy. The numbers make the lever the smart choice. |
| Q4 | config.ts | The **Scooter** rider can't see (vision 0). The **Heavy**, **Scooter** and **Drone** can't hear (hears: false). |
| Q5 | config.ts | **No**: 150 is faster than 140, so a walking Leo stays ahead on a straight. If he stops, it catches up. |
| Q6 | config.ts | 8 × 0.75 = **6 seconds**. |
| Q7 | level.ts | index = r × width + c = 2 × 20 + 4 = **44**. |
| Q8 | level.ts | tileOf(47) = 0 and tileOf(49) = 1, so tile (0, 1), whose centre is **(24, 72)**. |
| Q9 | level.ts | 90 × π / 180 = **π/2 ≈ 1.571 radians**. Because screen y grows downwards, it looks **down** the screen. |
| Q10 | grid.ts | b's tile is where Leo is standing, which is floor. We only care whether something **between** them blocks the view. |
| Q11 | grid.ts | The neighbour with the smaller number: **the "5"** to its right. |
| Q12 | grid.ts | **5**. centre(5) = 264, and 264 ÷ 48 = 5.5, which rounds down to 5. The centre of a tile is always half a tile inside it. |
| Q13 | world.ts | Random numbers would make every test run different. A failure might not happen again, so you couldn't reproduce and fix it. The bots' "imagine the future" would also stop matching what really happens. |
| Q14 | world.ts | **No.** 'eating' isn't in AWAKE_CALM, so the eyes are never checked. Eating aliens are blind, which is why donuts work! |
| Q15 | world.ts | 150 × √2 ≈ **212 px/s**, which is 41% faster than walking straight. |
| Q16 | world.ts | If Leo is touching the alien, it notices him whichever way it's looking. (The angle maths also gets wobbly at tiny distances.) |
| Q17 | world.ts | Fill rate at the edge = (1 ÷ 0.7) × (1.5 − 1) ≈ 0.71 per second, so about **1.4 seconds**. |
| Q18 | world.ts | Straight hallway: the **Stroller** (225 vs 150). Zig-zag: **Leo**, because every corner costs the chaser about a second of skidding and untangling. The test "a walking player escapes through a zig-zag" proves it. |
| Q19 | world.ts | **2 stars**: finishing plus the par time (if you're fast enough). |
| Q20 | GameScene.ts | **world.ts** decides there's a hug; **GameScene.ts** plays the sound and shows the hearts. |
| Q21 | GameScene.ts | 0.1 s ÷ (1/60 s) = **6 steps** (we never add more than 0.1 s, so the game can't fly ahead after a long pause). |
| Q22 | controls.ts | So a thumb resting lightly near the middle doesn't make Leo slowly drift around. |
| Q23 | fx.ts | They're only decoration and never change what happens in the game, so the rules stay deterministic. |
| Q24 | sound.ts | 1000 × 0.1 = **100 times**. |
| Q25 | draw.ts | 0x00ff00 is **pure green**; 0xffffff is **white** (all colours at full). |
| Q26 | characters.ts | Both legs would swing together, like a kangaroo hopping (or both feet sliding in sync). |
| Q27 | scenery.ts | **(0, 1)**: cos 90° = 0, sin 90° = 1. On screen that points **down**. |
| Q28 | StoryScene.ts | lerp(0, 10, 0.5) = **5**. lerp(50, 0, 0.2) = 50 + (0 − 50) × 0.2 = **40**. |
| Q29 | progress.ts | **15 stars**. |
| Q30 | bot.ts | Trying a move on the real world would actually DO it (Leo would really walk into the hug). A clone lets the bot imagine a move and then throw the copy away. |
