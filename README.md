# Hands-Free Browsing

A browser extension that lets you browse the web without a mouse or keyboard — using **head movement, facial gestures, and voice**.

The webcam feed never leaves your machine: face tracking runs entirely on-device with [MediaPipe FaceLandmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (bundled WASM + model). Only derived cursor coordinates and gesture scores are passed between extension contexts.

---

## Quick start

```bash
cd hands-free-browsing
npm install
npm run build
```

The build writes the extension to `dist/`.

> **Important:** load `dist/` — not the repository root. The root contains source files that browsers cannot run directly as an extension.
>
> `npm run dev` and `npm run build` are currently the same command. There is no HMR/watch server for the extension contexts: after changing source, rebuild, reload the extension, and refresh open tabs.

### Load in Chrome or Edge

1. Run `npm run build`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the generated `dist` folder.
6. Pin the extension, open its popup, and click **Start Tracking**.
7. Allow camera access when prompted (and microphone access if you want voice).

### Load in Firefox

Firefox has no offscreen document API, so tracking runs in a small companion popup window instead.

**Option A — temporary install (fastest):**

1. Run `npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select `dist/manifest.json`.
5. Open the extension popup → **Start Tracking** → allow camera access in the companion window.
6. Keep the companion window open (it may be minimised) while browsing.

Temporary add-ons are removed when Firefox restarts; repeat these steps after a restart.

**Option B — `web-ext`:**

```bash
npm run start:firefox
```

This launches Firefox with the extension loaded. The script in `package.json` assumes the Firefox binary is at `/usr/bin/firefox`; adjust or remove `--firefox=...` on Windows/macOS.

### First run checklist

1. Popup shows **Tracking** and the engine mode (`Background Offscreen` on Chrome, `Firefox Companion` on Firefox).
2. The tracker preview shows your camera and an FPS counter.
3. A status pill appears at the top-left of every page; the cursor appears once a face is detected.
4. Set your neutral position: look straight ahead; the cursor should sit near the centre of the screen.
5. Keep one face in frame, with reasonable lighting.

After every rebuild, click **Reload** on the extension card (`chrome://extensions`) or reload the temporary add-on, then refresh any page you are testing.

---

## Using it

- **Start/stop tracking** from the popup, or the **Start Tracker / Stop Tracker** button in the on-page HUD.
- **Voice** is toggled with the mic button in the top-right overlay.
- **Media dock** appears automatically on YouTube or any page with a `<video>`; it can be minimised.
- **Pause** by closing both eyes for 1.5 s. While paused the OS cursor comes back so you can use the mouse normally. Close both eyes for 1.5 s again to resume.
- **Stop tracking** before closing the browser or unplugging the camera, so the native cursor is restored cleanly.

---

- **Face cursor** on every website
- **Dwell-to-click** with magnetic snapping and target highlighting
- **Facial gestures** for click, scroll, mute, play/pause
- **Edge navigation** for browser back/forward
- **Voice search, dictation, and media control**
- **Pause mode** via a long blink
- Works in **Chrome, Edge, and Firefox** (MV3)

---

## Feature tour

| Feature             | What it does                                                                           |
| ------------------- | -------------------------------------------------------------------------------------- |
| Head-tracked cursor | Nose tip drives a high-contrast cursor with adaptive smoothing                         |
| Magnetic snapping   | Interactive elements within 45 px are detected, outlined, labelled, and gently centred |
| Dwell click         | Hover a target for 2 s total and it clicks automatically, with a circular countdown    |
| Gesture clicks      | A left wink clicks instantly                                                           |
| Scrolling           | Right wink / brow raise scroll up; open jaw scrolls down                               |
| Media control       | Smile mutes; double blink toggles play/pause                                           |
| Edge navigation     | Hold the cursor at the far left/right edge to go back/forward                          |
| Disengage           | Close both eyes for 1.5 s to pause tracking; repeat to resume                          |
| Voice               | Say "search cats", "pause", "scroll down", or dictate into any focused field           |
| Media dock          | Auto-appearing YouTube/HTML5 video controls                                            |
| Mouse fallback      | If tracking data stops for 1.8 s, the cursor follows the normal mouse                  |

---

## Gesture cheat sheet

| Gesture                         | Action                                 |
| ------------------------------- | -------------------------------------- |
| Move your head                  | Move the cursor                        |
| Hover a target for 2 s          | Click (0.3 s settle + 1.7 s countdown) |
| Left wink                       | Click immediately                      |
| Right wink                      | Scroll up                              |
| Raise eyebrows                  | Scroll up                              |
| Open jaw                        | Scroll down                            |
| Smile                           | Toggle mute                            |
| Double blink (two quick blinks) | Play / pause media                     |
| Both eyes closed 1.5 s          | Pause tracking; repeat to resume       |
| Hold left screen edge           | Browser back                           |
| Hold right screen edge          | Browser forward                        |

Interaction rules:

- Edge navigation needs a 900 ms hold and only fires once per entry.
- Edge navigation is ignored when the cursor is snapped to a real element, so sidebar buttons still work.
- All gestures share an 800 ms debounce.
- Clicks and edge navigation are disabled while both eyes are closed.
- A long blink cannot accidentally click or skip media.

---

## Voice commands

Voice uses the browser's Web Speech API. It is available in Chrome/Edge; Firefox does not implement `SpeechRecognition` by default, so the microphone button will be disabled there.

| Say                                      | Result                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| "search for cats" / "search cats"        | Fills the page search box and submits, or opens Google/YouTube results |
| "play" / "pause"                         | Toggle media playback                                                  |
| "rewind" / "skip back"                   | −10 seconds                                                            |
| "forward" / "fast forward"               | +10 seconds                                                            |
| "mute" / "unmute"                        | Toggle audio                                                           |
| "fullscreen"                             | Toggle fullscreen                                                      |
| "next video"                             | Next YouTube video                                                     |
| "scroll down" / "scroll up"              | Smooth page scroll                                                     |
| "go top" / "scroll to top"               | Jump to the top                                                        |
| "enter" / "submit"                       | Press Enter in the focused field                                       |
| "clear" / "clear input"                  | Clear the focused input                                                |
| anything else, while an input is focused | Dictate the text into it                                               |

Click the 🎤 button in the top-right overlay to start or stop listening.

---

## Requirements

- **Node.js 20.19+ or 22.12+** and npm (required by Vite 8)
- **Chrome / Edge 109+** (uses the offscreen document API), or **Firefox 115+** (uses a companion window instead)
- A webcam
- Internet access **once during the build** to download the MediaPipe model, unless `public/models/face_landmarker.task` already exists

No backend, account, or API key is required.

## How it works

The extension runs in four isolated contexts connected by extension messaging:

```
Popup (React)                    ← start/stop, status, cheat sheets
    │ runtime messages
    ▼
Background service worker        ← lifecycle, message relay, tab injection
    │ creates                          │ tabs.sendMessage
    ▼                                  ▼
Tracker document                 Content script (every http/https tab)
(offscreen or companion window)   React overlay in an open Shadow DOM
webcam → MediaPipe → FACE_DATA     cursor, HUDs, gestures, voice
```

**Frame pipeline**

1. `getUserMedia` captures 640×480 video (with a video-only fallback if the mic is denied).
2. MediaPipe `FaceLandmarker` runs in `VIDEO` mode, GPU delegate with a CPU fallback.
3. Nose-tip coordinates and blendshape scores are posted as `FACE_DATA` at camera frame rate.
4. The background relays each frame to the active tab of every window.
5. `CursorOverlay` maps face coordinates to screen coordinates, smooths them, and runs gesture, dwell, edge, and pause logic.
6. If no frame arrives for 1.8 s, the overlay switches to mouse fallback.

**Coordinate mapping**

```js
nx = 0.5 + (x - 0.5) * 2.0; // 2× gain around the calibrated centre
ny = 0.5 + (y - 0.5) * 1.5 * 2.0;
targetX = (1 - nx) * innerWidth; // mirrored horizontally
targetY = ny * innerHeight;
```

Adaptive EMA smoothing uses a 1.8 px deadzone with `alpha = 0.14` for small movements and `0.26` for large jumps.

**Clicking** is done with synthetic `pointerdown`/`mousedown`/`pointerup`/`mouseup`/`click` events plus an `element.click()` fallback. Text insertion uses native property setters plus `input`/`change` events for framework compatibility.

**Isolation:** the overlay lives in a single open Shadow DOM on a `pointer-events: none` full-viewport host, so page CSS cannot break it and hit-testing still reaches the real page.

---

## Project structure

```
hands-free-browsing/
├── manifest.json              MV3 manifest
├── index.html                 Popup page
├── offscreen.html             Tracker page (offscreen document / companion window)
│
├── scripts/
│   ├── build.js               Four-stage Vite build + verification
│   └── copy-assets.js         Copies WASM, downloads the face model once
│
├── public/
│   ├── wasm/                  MediaPipe runtime (generated from node_modules)
│   └── models/face_landmarker.task
│
└── src/
    ├── background.js          Service worker: lifecycle, relay, injection
    ├── offscreen.js           Webcam + MediaPipe loop
    ├── content.jsx            Mounts the overlay in a Shadow DOM
    ├── CursorOverlay.jsx      Cursor, gestures, dwell, edge nav, pause
    ├── App.jsx / main.jsx     Popup UI
    ├── components/            OnscreenHUD, VoiceHUD, MediaHUD,
    │                          ElementHighlighter, DwellIndicator,
    │                          EdgeNavigator, DisengageBanner
    ├── speech/                Speech recognition + command routing
    ├── adapters/              YouTube and HTML5 video adapters
    └── utils/                 DOM probing, synthetic events, text insertion
```

Build artifacts are written to `dist/`. Load only that folder in the browser.

---

## Scripts

| Command                 | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `npm run dev`           | Build (alias of `build`; no watch mode)               |
| `npm run build`         | Full four-stage production build into `dist/`         |
| `npm run lint`          | oxlint over the project (includes bundled WASM noise) |
| `npm run lint:ext`      | `web-ext lint` against `dist/`                        |
| `npm run start:firefox` | Launch Firefox with the built extension via `web-ext` |
| `npx oxlint src`        | Lint just the source files (cleaner output)           |

Build stages:

1. Ensure `public/wasm` and `public/models/face_landmarker.task` exist.
2. Vite-build `index.html` (popup) and `offscreen.html` (tracker).
3. Vite-build `src/content.jsx` as a single IIFE `content.js`.
4. Vite-build `src/background.js` as an IIFE.
5. Fail the build if `process.env` leaks into a browser bundle, then copy `manifest.json`.

---

## Configuration

All behaviour is tuned with constants at the top of `src/CursorOverlay.jsx`:

| Constant                               | Default        | Effect                                       |
| -------------------------------------- | -------------- | -------------------------------------------- |
| `HEAD_SENSITIVITY`                     | `2.0`          | Cursor gain; lower = slower, steadier        |
| `DWELL_DURATION_MS`                    | `1700`         | Visible dwell countdown                      |
| `HOVER_CLICK_DELAY_MS`                 | `300`          | Settle time before the countdown (2 s total) |
| `EDGE_ZONE_RATIO` / `EDGE_ZONE_MIN_PX` | `0.035` / `28` | Edge hot-zone width                          |
| `EDGE_NAV_HOLD_MS`                     | `900`          | Hold before back/forward                     |
| `DISENGAGE_HOLD_MS`                    | `1500`         | Pause/resume long-blink duration             |
| `DOUBLE_BLINK_MAX_MS` / `_GAP_MS`      | `450` / `650`  | Double-blink detection                       |
| `WINK_CLICK_THRESHOLD`                 | `0.6`          | Wink sensitivity                             |
| `JAW_SCROLL_DOWN_THRESHOLD`            | `0.35`         | Jaw scroll sensitivity                       |
| `BROW_SCROLL_UP_THRESHOLD`             | `0.55`         | Brow scroll sensitivity                      |
| `SMILE_MUTE_THRESHOLD`                 | `0.65`         | Smile mute sensitivity                       |

Camera resolution and the GPU→CPU fallback live in `src/offscreen.js`. Per-gesture display thresholds are also defined there for the tracker preview.

---

## Troubleshooting

**The extension loads but nothing appears on pages**

- Reload the tab. The content script runs at `document_idle`; tabs open before installation are patched best-effort but may need a refresh.
- Confirm the site is `http(s)://`; extension and `about:` pages are intentionally skipped.

**No camera prompt / camera blocked**

- Start tracking again and check for a permission prompt on the tracker page.
- Check the OS camera privacy settings for the browser.
- On Chrome, close any other app using the camera exclusively.

**Tracking runs but the cursor does not move**

- Check the FPS counter in the tracker window; if it stays `-- FPS`, the model or camera failed. Open the tracker's console for details.
- Ensure exactly one face is visible and reasonably lit.
- Look at the tracker preview: the purple dot should move with your nose.

**Firefox stops tracking**

- The companion window was closed. Reopen it from the popup.
- Temporary add-ons do not survive a browser restart.

**Voice button is disabled**

- Firefox does not support `SpeechRecognition` by default. Use Chrome/Edge.
- Grant microphone permission for the site, not only for the extension.

**Gestures are too sensitive / not sensitive enough**

- Adjust the thresholds in `src/CursorOverlay.jsx`, rebuild, reload the extension, refresh the tab.
- Lighting and camera distance strongly affect MediaPipe blink/jaw scores.

**Build fails downloading the model**

- Network issue during `copy-assets.js`. Download
  `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
  manually into `public/models/face_landmarker.task`, then rebuild.

**Rebuilds do not take effect**

- Reload the extension card, then refresh the page. Content scripts already running in a tab keep their old copy until reload.

**Page cursor stays hidden after a crash**

- Refresh the page. The overlay restores `cursor` on unmount and on tracker stop, but a hard renderer crash can skip cleanup.

---

## Permissions and privacy

| Permission   | Why                                                |
| ------------ | -------------------------------------------------- |
| `tabs`       | Broadcast tracking data/state and find active tabs |
| `scripting`  | Inject the overlay into already-open tabs          |
| `activeTab`  | Interact with the current tab from the popup       |
| `<all_urls>` | The cursor must work on any website                |
| `storage`    | Reserved for future settings; currently unused     |

- Face tracking is **local**: WASM and the model ship with the extension; no video frames or images leave the device.
- Only cursor coordinates and blendshape scores are messaged between extension contexts.
- There is no analytics, telemetry, or runtime network request.
- Voice is the exception: it uses the browser's built-in speech service, which may process audio remotely (Chrome). Voice is entirely optional.

The extension's CSP allows local scripts and `wasm-unsafe-eval` for MediaPipe.

---

## Current limitations

- No settings UI or calibration flow; behaviour is tuned in source.
- Voice is effectively Chrome/Edge only.
- Face data is sent only to the active tab of each window; background tabs hold stale cursor state.
- Gesture and dwell state are per tab (pause state is synchronized).
- Synthetic events may be ignored by some highly managed editors.
- `dist/` must be rebuilt after every source change; there is no watch mode yet.
- Firefox support relies on a companion window and a temporary install for development.

---

## Credits

- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe) for face landmarks and blendshapes
- [React](https://react.dev/) and [Vite](https://vite.dev/)
- Icon assets in `public/`
