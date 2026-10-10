# 🚀 Planet Oops-a-Daisy: The Confused Alien Crossing
### *Complete Project Plan, Backstory, Decisions & Technical Architecture*

---

## 📌 1. Project Overview & Origin Story

This project is a collaborative game creation based on a funny story made up by a parent and their kid. 

### The Core Premise & Joke
* A human lands on a strange alien planet.
* **The Anatomical Twist:** The aliens' upper bodies (head, eyes, mouth, arms, torso) face forward normally, smiling and talking directly to you. **However, their lower bodies (legs, knees, and feet) are completely reversed!** Their knees bend backward, their feet face the opposite direction, and when they try to walk forward, they kick in reverse.
* When an alien runs toward you to greet you, their legs sprint at full speed in the opposite direction!
* To the locals of this planet, **the human is the weird alien freak** because *"your nose and toes point in the exact same direction!"*

```mermaid
flowchart LR
    subgraph Human ["Normal Human Anatomy"]
        H_Head["Eyes & Nose: Facing Forward ➡️"]
        H_Torso["Chest & Arms: Facing Forward ➡️"]
        H_Legs["Knees & Toes: Facing Forward ➡️"]
        H_Walk["Walks Forward ➡️"]
        H_Head --> H_Torso --> H_Legs --> H_Walk
    end

    subgraph Alien ["Planet Oops-a-Daisy Local"]
        A_Head["Eyes: Looking at You ➡️\nSmile: 'HELLO FRIEND!'"]
        A_Torso["Chest & Arms: Waving ➡️"]
        A_Legs["Knees & Feet: Pointing BACKWARDS ⬅️"]
        A_Walk["Sprints in Reverse ⬅️\n💥 CRASH INTO MAILBOX!"]
        A_Head --> A_Torso --> A_Legs --> A_Walk
    end

    Human -. "Alien reaction: 'GASP! Your nose and toes point the same way?!'" .-> Alien
```

---

## 📖 2. The Storyline & World-Building

### Setting: **Planet Oops-a-Daisy**
A colorful, bustling alien world characterized by wobbly architecture, lavender lawns, backwards crosswalks, and constant accidental collisions.

### Characters:
1. **Leo the Tourist (Player):** 
   - An accidental tourist wearing a vacation Hawaiian shirt over a round-helmet spacesuit.
   - Normal human anatomy with forward-facing sneakers.
2. **NAV-9000 (Spaceship AI Autopilot):**
   - The reason Leo is here! The AI took a "scenic shortcut" around Jupiter, suffered a glitch, and made an emergency landing on Planet Oops-a-Daisy.
   - Speaks through Leo’s helmet/wrist communicator. Overly cheerful, deadpan GPS personality that never admits making a mistake.
   - Gives Leo comical, unhelpful survival tips.
3. **Blorp (The First Encounter):**
   - A friendly alien receptionist who shouts *"WELCOME TRAVELER!"* and tries to hug Leo, but immediately sprints backward into a mailbox.
4. **The Citizens of Oops-a-Daisy:**
   - Texting commuters who walk backward into trashcans.
   - Kids at the alien school running recess tag in reverse.
   - Commuters riding backwards kick-scooters while sipping alien smoothies.
   - Mayor Oopsie, leader of the planet, riding a backwards parade float.

```mermaid
flowchart TD
    Start["Spaceship Autopilot Glitch\nNAV-9000: 'Shortcut calculated!'"] --> Landing["Emergency Landing on\nPlanet Oops-a-Daisy!"]
    Landing --> Scattering["💥 Impact knocks ship parts\nacross 4 alien city zones!"]
    Scattering --> MeetBlorp["Meet Blorp the Alien\nTries to hug you, sprints backward into mailbox!"]
    
    MeetBlorp --> L1["Level 1: Suburban Oops-a-Daisy\nRetrieve Spark Plug from alien front lawn"]
    L1 --> L2["Level 2: Oops-a-Daisy Elementary\nRetrieve Hyper-Battery from school Show-and-Tell"]
    L2 --> L3["Level 3: Downtown & Scooter Alley\nRetrieve Steering Wheel from busy market"]
    L3 --> L4["Level 4: Rush Hour & Mayor's Parade\nCross 6-lane Grand Boulevard to Launchpad"]
    
    L4 --> Victory["🚀 Ship Reassembled!\nBlast off before aliens ask you to dance!"]
```

---

## 🗺️ 3. The 4-Level Maze Adventure & Unique Puzzle Mechanics

Instead of a simple road crossing, each level is a **2D Top-Down Maze Labyrinth** with walls, corridors, dead ends, and a **completely new puzzle mechanic to solve**:

```mermaid
flowchart TD
    M1["Level 1: Suburban Hedge Maze\n🗝️ Keycards & Alcoves\nFind Bronze Key to unlock Garden Gate"]
    M2["Level 2: Oops-a-Daisy Elementary\n🔄 Reverse Conveyors & Wall Switches\nFlip hallway belts to reach Principal's Office"]
    M3["Level 3: Downtown Neon Market\n⚡ Laser Gates & Pressure Plates\nLure heavy alien with Donut to stand on plate"]
    M4["Level 4: The Grand Spaceport\n🖥️ 3 Power Terminals & Guard Patrols\nHack Terminals A, B, C to drop Rocket Shield"]

    M1 --> M2 --> M3 --> M4
```

| Level | Maze Setting | Primary Item | Unique Puzzle Mechanic |
| :--- | :--- | :--- | :--- |
| **Level 1** | **Suburban Hedge Maze** | ⚡ Spark Plug | **Keycards & Nooks:** Find the hidden Bronze Keycard in garden alcoves to unlock the electronic gate. Hide in cutouts when backward neighbors patrol past. |
| **Level 2** | **Oops-a-Daisy Elementary** | 🔋 Hyper-Battery | **Reverse Conveyors & Wall Levers:** Hallway moving walkways pull you backward unless you flip the wall switch or use Moonwalk Shoes. |
| **Level 3** | **Downtown Neon Market** | 🛞 Steering Wheel | **Laser Barriers & Pressure Plates:** Laser forcefields block paths. Toss a Donut onto floor plates to lure heavy aliens to hold the gates open! |
| **Level 4** | **The Grand Spaceport** | 🔑 Launchpad Rocket | **3 Terminal Codes & Searchlights:** Hack Energy Terminals A, B, and C in 3 quadrants of the high-security complex to lower the rocket forcefield! |

---

## ⏱️ 4. Difficulty Modes & Time Limits

Players can choose their challenge level directly from the Title Screen:

| Setting | 🟢 Easy Mode | 🟡 Medium Mode | 🔴 Hard Mode |
| :--- | :--- | :--- | :--- |
| **Time Limit** | 180 seconds (3 mins) | 90 seconds (1.5 mins) | 50 seconds (Intense!) |
| **"Oops!" Hearts** | 5 Hearts | 3 Hearts | 2 Hearts |
| **Patrol Speed** | Slow & relaxed | Normal rhythm | Fast & sharp turns |
| **Gadget Cooldowns** | Quick recharge (4s) | Standard (6-8s) | Longer recharge (10s) |
| **Recommended For** | Younger kids / exploration | Standard arcade fun | Brainy speedrunners! |


---

## 🕹️ 4. Gameplay Mechanics & Controls

### Movement & Arcade Decision Loop
```mermaid
flowchart TD
    Player["Player on Safe Zone (Sidewalk/Bench)"] --> Observe["Look at Traffic:\nEyes face Right, but feet kick Left!"]
    Observe --> ChooseAction{"Action?"}
    
    ChooseAction -->|Normal Hop| Hop["Hop Up/Down/Left/Right into Lane"]
    ChooseAction -->|🎺 Squeaky Honk| Honk["Aliens freeze & scratch heads (2s)"]
    ChooseAction -->|👟 Moonwalk Shoes| Moonwalk["Flip shoes backward: walk through crowd (3s)"]
    ChooseAction -->|🍩 Throw Donut| Donut["Toss pastry: aliens gather around it (3s)"]
    
    Hop --> CheckCollision{"Collision Check"}
    CheckCollision -->|Clear| SafeTile["Advance toward Stage Objective!"]
    CheckCollision -->|Hit Backwards Knees| Bump["💥 BONK! Knock back 1 tile\nLose 1 of 3 'Oops!' Hearts"]
    
    Bump --> CheckHearts{"Hearts Remaining?"}
    CheckHearts -->|> 0| KeepGoing["Continue playing!"]
    CheckHearts -->|0 Hearts| Restart["Friendly Restart of Current Level"]
    
    SafeTile --> CheckGoal{"Reached Goal Item?"}
    CheckGoal -->|Yes| NextStage["🎉 Level Complete! Collect Part!"]
    CheckGoal -->|No| Observe
```

### Leo’s Tourist Utility Belt (All 3 Abilities Included)
1. **🎺 Squeaky Honk (Key: `1` or `Space` / Mobile Button):**
   - Leo honks an absurd rubber clown horn.
   - Nearby aliens freeze and scratch their heads in utter confusion for 2 seconds.
2. **👟 Reverse Shoes / Moonwalk (Key: `2` or `Shift` / Mobile Button):**
   - Leo puts on backward slip-on shoes for 3 seconds.
   - Leo blends in! Aliens don't bump you, and you can slip right through traffic unharmed.
3. **🍩 Space Donut Toss (Key: `3` or `E` / Mobile Button):**
   - Throw a sparkling alien donut onto a lane.
   - Distracts alien kids, dogs, and commuters who gather around the pastry for 3 seconds.

### Lives & Fail State ("Oops!" Hearts)
* **3 "Oops!" Hearts per level:**
  * Bumping into an alien's backwards knees triggers a cartoon *"BONK!"* sound, dizzy stars above Leo's helmet, and gently knocks him back one lane.
  * Losing 3 hearts restarts the current level (encouraging, kid-friendly, no punishing game-overs).
  * Floating heart pickups occasionally appear on safe islands to restore health.

---

## ⚙️ 5. Engineering Architecture (Muratori / Acton / Blow Principles)

```mermaid
flowchart TD
    subgraph Inputs ["Input Layer (Zero Latency)"]
        KBD["Keyboard (WASD / Arrows)"]
        TOUCH["iPad Touch (Virtual D-Pad)"]
        PAD["Bluetooth Gamepad API"]
        IBUF["Buffered Input Queue (Next Hop)"]
        KBD --> IBUF
        TOUCH --> IBUF
        PAD --> IBUF
    end

    subgraph Simulation ["Deterministic Simulation (Fixed dt = 1/60s)"]
        ACC["Accumulator Clock"] --> TICK["sim_update(state, dt)"]
        IBUF --> TICK
        TICK --> FLAT["Flat Arrays (Zero Allocation)\naliens_x[], aliens_vx[], aliens_dir[]\nparticles[], floating_text[]"]
        FLAT --> AABB["Explicit AABB Collision & Lane Math"]
    end

    subgraph Output ["Output Pipelines"]
        FLAT --> DRAW["Procedural 2D Retina Canvas\nScales to devicePixelRatio"]
        AABB --> AUDIO["Web Audio API Synthesizer\nOscillators: sine, square, sawtooth"]
    end
```

### Key Architectural Tenets:
1. **Zero Garbage Collection Allocation in the Hot Loop (Mike Acton / Data-Oriented):**
   * Pre-allocated static arrays for all entities (`aliens_x`, `aliens_vx`, `particles`).
   * Zero `new` inside `requestAnimationFrame`: avoids garbage collection frame drops.
2. **Fixed-Step Deterministic Simulation (Jonathan Blow):**
   * Decoupled physics clock from display refresh rate: moves identically on 60Hz and 120Hz screens.
3. **Explicit Axis-Aligned Bounding Box Math (Casey Muratori):**
   * Direct, readable collision calculations with no physics middleware bloat.

---

## 📱 6. Multi-Device & iPad Touch Controls

```mermaid
flowchart LR
    subgraph iPadScreen ["iPad / Mobile Touchscreen Layout"]
        direction LR
        LeftZone["Bottom-Left:\n🕹️ Virtual 4-Way D-Pad\n(⬆️ ⬇️ ⬅️ ➡️)"]
        CenterZone["Center Canvas:\nGame Action & Animated Lanes"]
        RightZone["Bottom-Right:\n🎺 HONK\n👟 MOONWALK\n🍩 DONUT"]
    end
```

* **Desktop / Mac:** Keyboard (`WASD` / Arrow keys + numbers `1, 2, 3` / `Spacebar`).
* **iPad / Mobile:** Two-thumb touch controls (D-Pad on left, 3 gadget buttons on right).
* **"Add to Home Screen":** Opens in full-screen standalone mode with zero browser address bars!

---

## 🎨 7. Art & Sound Design

### Visual Art Style (Procedural Retina Vector Graphics)
* Crisp vector paths rendered directly to Canvas, scaling dynamically to `devicePixelRatio`.
* **Alien Procedural Animation:**
  - Torso faces forward, arms wave, big expressive eyes.
  - Legs bend backwards and pedal in reverse.
  - Comical thought-bubble arrow over their heads showing where they *intend* to go vs where their feet take them.

### Real-Time Web Audio Synthesizer (Zero External Audio Files)
* All sounds generated via Web Audio API oscillators:
  - **Hop:** Upward chirping blip.
  - **Bonk:** Downward cartoon slide-whistle + dizzy tone.
  - **🎺 Squeaky Honk:** Dual-frequency clown horn squeak.
  - **👟 Moonwalk:** Retro slide groove tone.
  - **🍩 Donut:** Cartoon whoosh + crunch.
  - **Victory Fanfare:** Upbeat 8-bit brass arpeggio.
  - **Music:** Toggleable goofy walking chiptune bassline.
