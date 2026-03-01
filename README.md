# 🟩 The Green Square
A beautifully minimal, fully offline life and semester tracker. No ads, no cloud servers, no 3D gradients. Just you, your daily tasks, and the green squares.
## 📖 The Vibe
I wanted a tracker that feels like a vintage academic diary or a ledger. It's completely 2D, flat, and uses warm cream colors with strict serif and monospace typography. It's designed to track your long-term journey (like a 4-year degree) week by week, visualizing your consistency just like a GitHub contribution graph.
## ✨ Features
* **The Journey Map:** A GitHub-style heatmap of your entire journey. Do your tasks, the week turns dark green. Slack off, it stays white (or turns red).
* **Brutally Honest Scoring (0 to 10):**
  * Do a task = +1
  * Do it partially = +0.5
  * Leave it pending = 0
  * **Miss it completely (let the day pass) = -1 (Negative penalty)**
* **100% Offline & Private:** There is no database. Everything lives in your browser's `localStorage`. Your data is strictly yours.
* **Installable App (PWA):** You can download it directly to your phone or desktop.
* **Android Widgets:** Comes with 3 native home screen widgets (Today's Tasks, Scoreboard, and Journey Map) when installed on Android!
* **Double-Tap / Long-Press:** Quickly cycle through task statuses without clunky menus.
## 💾 Data & Backups (Important!)
Because this app has **no cloud storage**, if you clear your browser data or lose your phone, your tracker is gone. 
**Please maintain a weekly backup!** Go to Settings (⚙️) -> Export Backup to download your JSON file. Keep the latest one and delete your old ones.
## 🚀 How to run it locally
If you want to run the code on your own machine:
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
## 🙋‍♂️ About the Creator
I'm an independent creator who built this to have a simpler, cleaner way to track progress without the noise of modern productivity apps. 
Say hi: [sayhitosuman.pages.dev](https://sayhitosuman.pages.dev)
---
*No rigid Terms and Conditions. Use it, modify it, and keep your squares green.*
