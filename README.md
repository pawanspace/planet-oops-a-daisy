# 🚀 Planet Oops-a-Daisy: The Confused Alien Crossing

A comedic arcade crossing game born from a funny story made up by a parent and their kid!

---

## 🎮 How to Play

### Option 1: Instantly on your Mac
Simply run the helper script (which opens the browser and starts the server):
```bash
/Users/pawanc/planet-oops-a-daisy/run_server.sh
```

Or just double-click `index.html` directly in Finder!

---

### Option 2: Play on an iPad or Tablet
Run the script on your Mac:
```bash
/Users/pawanc/planet-oops-a-daisy/run_server.sh
```
The script will display your Mac's Wi-Fi IP address:
```text
📱 Play on your iPad: http://<YOUR-MAC-IP>:8000
```
Open that address in Safari on your iPad connected to the same Wi-Fi network.

4. **Pro Tip for Kids:** In iPad Safari, tap the **Share** button $\rightarrow$ **"Add to Home Screen"**. It will install a real game icon on the iPad that opens full-screen without any browser bars!

---

## 🕹️ Controls Guide

### Desktop / Laptop (Keyboard)
| Action | Primary Key | Alternate Key |
| :--- | :--- | :--- |
| **Hop Up / Down / Left / Right** | Arrow Keys | `W`, `S`, `A`, `D` |
| **🎺 Squeaky Honk (Freeze Aliens)** | `1` | `Spacebar` |
| **👟 Moonwalk (Slip Through Traffic)** | `2` | `Shift` |
| **🍩 Space Donut Toss (Distract Crowd)** | `3` | `E` |
| **Mute / Unmute Audio** | Click the `🔊 SOUND` button in the top HUD |

### iPad / Touchscreen
* **Left Thumb:** Tap the 4-way arrow buttons on the virtual D-Pad.
* **Right Thumb:** Tap the big round action buttons:
  * 🎺 **HONK** (Freezes nearby aliens in confusion)
  * 👟 **WALK** (Puts shoes backwards to walk through crowds unharmed)
  * 🍩 **DONUT** (Tosses an alien treat onto a lane to distract crowds)

---

## 📖 The 4 Stages
1. **Stage 1: Suburban Oops-a-Daisy** — Retrieve the lost **⚡ Spark Plug** from an alien lawn.
2. **Stage 2: Oops-a-Daisy Elementary** — Retrieve the **🔋 Hyper-Battery** from the playground Show-and-Tell table during chaotic recess!
3. **Stage 3: Downtown Market & Scooter Alley** — Cross the busy avenue with backwards scooters to grab the **🛞 Steering Wheel**.
4. **Stage 4: Rush Hour & The Mayor's Parade** — Cross the 6-lane Grand Boulevard with Mayor Oopsie's float to grab the **🔑 Rocket Launch Key** and blast off!

---

## ⚙️ Technical Architecture
Built in the spirit of **Casey Muratori**, **Mike Acton**, and **Jonathan Blow**:
* **Fixed-step deterministic simulation loop** (60 Hz accumulator decoupled from display refresh rate).
* **Zero GC allocations in the hot loop:** Pre-allocated flat typed arrays for all entities.
* **Procedural Retina vector rendering:** Razor-sharp geometry scaled to `devicePixelRatio`.
* **Zero external dependencies:** Real-time Web Audio API procedural sound synthesizer.
