# LinguaLoop — Chrome Extension 

**Stop skimming. Start looping.** LinguaLoop turns YouTube into a language-immersion workspace—tailored for **intermediate learners**.  
Install the extension, choose your language and CEFR level, and activate on-device AI with **Chrome’s Built-in AI / Gemini Nano**(Prompt API, Translator API) and **Gemini API key**（only for generate subtitles).

> **Privacy first:** When on-device AI is available/enabled, your learning data (what you save, how you study) stays on your device.

---

## Team

- **Jiahua Tang** — Developer  
  UI implementation and CSS injection; interaction logic development across popup, options, and content scripts.
- **Xinyu Lai** — Developer  
  MV3 background service worker, AI orchestration (Built-in AI / Gemini Nano / Gemini API), storage (IndexedDB), exports.
- **Ru Jia** — Product Manager  
  Requirements, user flows, roadmap, QA, and release coordination.

---

## Features

- **One-click sentence looping** with adjustable playback speed.
- **Movable vocabulary pop-up**: translation + key-word highlighting suited to your level.
- **Built-in translation** and **on-device keyword selection** (AI).
- **One-click save** to a private, in-browser **Vocabulary Book** (review mode generates fresh example sentences).
- **Fixed-size UI** (no responsive/screen adaptation), matching the provided hi-fi mocks.

---

## Requirements

- **Chrome (Manifest V3)** with permission to run on `youtube.com`.
- **Chrome’s Built-in AI / Gemini Nano**.
- **Apply for Gemini API key** ：Go to https://aistudio.google.com to create the **Gemini API key**.

---

## Install (Load Unpacked)

1. `chrome://extensions` → **Developer mode** → **Load unpacked**  
2. Select the project folder (where `manifest.json` lives).
3. Pin **LinguaLoop** to the toolbar for quick access.

---

## Configure

1. Click the toolbar icon → **Options**.
2. Set **Target language** and **CEFR level**.
3. Paste your **Gemini API key**.
4. Grant **host permissions** when prompted (YouTube). If you missed it, open `chrome://extensions` → LinguaLoop → **Site access**.

---

## File Overview

### `manifest.json`

Defines the extension's metadata, permissions, and resources. It specifies the background script, content script, and popup interface.

### `background.js`

Handles communication with the Gemini API and manages local storage for subtitles. It processes requests from the content script and popup.

### `content.js`

Runs on YouTube pages to manage subtitle display. It listens for messages from the background script and popup, loads stored subtitles, operate single sentence loop, playback speed adjustment, reverse to previous sentence, save new words to notebook, vocabulary-based sentence generation, and full sentence translation.

### `popup.html`

Defines the structure and layout of the popup interface.

### `popup.js`

Manages the popup interface. It allows users to input their Gemini API key, check for existing subtitles, and request new subtitles.

### `subtitles.css`

Contains styles for the subtitle display on YouTube videos.

### `README.md`

Provides documentation for the project.


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

## Credits and Attributions

This project uses code from the following open-source library:

## [yt-subtitle-extension](https://github.com/za01br/yt-subtitle-extension)

**Author:** [za01br](https://github.com/za01br)
**License:** [MIT License](https://github.com/za01br/yt-subtitle-extension/blob/main/LICENSE)

We have utilized and adapted portions of the source code from this project to handle the core functionality of downloading and processing YouTube subtitles.

The original copyright notice and license terms are reproduced below:

---
Copyright (c) <year> za01br

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
---

## Contributing

Feel free to fork this repository and submit pull requests for improvements or new features.


## License

This project is licensed under the MIT License. See the LICENSE file for details.
