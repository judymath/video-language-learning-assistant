# LinguaLoop — Chrome Extension 

**Stop skimming. Start looping.** LinguaLoop turns YouTube into a language-immersion workspace—tailored for **intermediate learners**.  
Install the extension, choose your language and CEFR level, and (optionally) activate on-device AI with **Chrome’s Built-in AI / Gemini Nano** or your **Gemini API key**.

> **Privacy first:** When on-device AI is available/enabled, your learning data (what you save, how you study) stays on your device.

---

## Team

- **Jiahua Tang** — Frontend Engineer  
  UI implementation for popup/options/content overlays; subtitles & inject CSS; hotkeys UI; light/dark variants.
- **Xinyu Lai** — Backend Engineer  
  MV3 background service worker, AI orchestration (Built-in AI / Gemini Nano / Gemini API), storage (IndexedDB), exports.
- **Ru Jia** — Product Manager  
  Requirements, user flows, roadmap, QA, and release coordination.

---

## Features

- **One-click sentence looping** with adjustable playback speed.
- **Movable vocabulary pop-up**: translation + key-word highlighting suited to your level.
- **Built-in translation** and **on-device keyword selection** (AI).
- **One-click save** to a private, in-browser **Vocabulary Book** (review mode generates fresh example sentences).
- **Keyboard shortcuts** for flow (Prev sentence / Repeat / Speed / Add word).
- **Fixed-size UI** (no responsive/screen adaptation), matching the provided hi-fi mocks.

---

## Requirements

- **Chrome (Manifest V3)** with permission to run on `youtube.com`.
- Optional: **Chrome’s Built-in AI / Gemini Nano** (if available on your device).
- Optional fallback: **Gemini API key** (set in Options).

---

## Install (Load Unpacked)

1. `chrome://extensions` → **Developer mode** → **Load unpacked**  
2. Select the project folder (where `manifest.json` lives).
3. Pin **LinguaLoop** to the toolbar for quick access.

---

## Configure

1. Click the toolbar icon → **Options**.
2. Set **Target language** and **CEFR level**.
3. (Optional) Paste your **Gemini API key**, or toggle **On-device AI only**.
4. Grant **host permissions** when prompted (YouTube). If you missed it, open `chrome://extensions` → LinguaLoop → **Site access**.

---

## File Overview

### `manifest.json`

Defines the extension's metadata, permissions, and resources. It specifies the background script, content script, and popup interface.

### `background.js`

Handles communication with the Gemini API and manages local storage for subtitles. It processes requests from the content script and popup.

### `content.js`

Runs on YouTube pages to manage subtitle display. It listens for messages from the background script and popup, loads stored subtitles, and updates the UI.

### `popup.html`

Defines the structure and layout of the popup interface.

### `popup.js`

Manages the popup interface. It allows users to input their Gemini API key, check for existing subtitles, and request new subtitles.

### `subtitles.css`

Contains styles for the subtitle display on YouTube videos.

### `README.md`

Provides documentation for the project.

<<<<<<< HEAD
---

## Usage

1. Open a YouTube video (works even without subtitles).
2. **Pause** on a sentence that deserves attention → one-click **Loop**.
3. Use the vocabulary **pop-up** to read translation and highlighted key words for your level.
4. Press **A** to save a word/phrase to the **Vocabulary Book**.
5. Review saved items; AI generates **fresh example sentences** tailored to you.

---


## Privacy

- On-device AI mode keeps data on your machine.  
- If you enable Gemini API, text needed for AI is sent to Gemini.  
- No analytics and no third-party trackers.

---
=======
>>>>>>> 263c1e7 (copy from yt)

## Contributing

Feel free to fork this repository and submit pull requests for improvements or new features.

<<<<<<< HEAD

---

=======
>>>>>>> 263c1e7 (copy from yt)
## License

This project is licensed under the MIT License. See the LICENSE file for details.
