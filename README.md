# Workout Tracker — Web App

Run and test in Chrome on your Windows desktop. No Expo, no phone needed.

---

## Setup (one time only)

### Step 1 — Install Node.js
Go to https://nodejs.org → download LTS → run installer, click all defaults.

### Step 2 — Open Command Prompt in this folder
- Put the `WorkoutWeb` folder on your Desktop
- Open File Explorer → navigate into the `WorkoutWeb` folder
- Click the address bar at the top → type `cmd` → press Enter
- A Command Prompt opens already inside the folder

### Step 3 — Install dependencies
```
npm install
```
Takes 1-2 minutes. Only needed once.

### Step 4 — Start the app
```
npm start
```
Chrome opens automatically at http://localhost:3000

---

## Daily use
Just open Command Prompt in the folder and run:
```
npm start
```

## Making changes
Edit any file in `src/screens/` — the browser auto-refreshes instantly when you save.

## For the best testing view
1. Press F12 in Chrome to open DevTools
2. Click the phone icon (Toggle Device Toolbar) — top left of DevTools
3. Select "iPhone 14 Pro" from the device dropdown
4. Now it looks exactly like it will on your phone

---

## When ready for iPhone
Use the `WorkoutTracker` (React Native) zip with Expo EAS Build to create an actual .ipa file for the App Store. The web version is your testing ground.
