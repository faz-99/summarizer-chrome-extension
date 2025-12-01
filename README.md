# Quick Summarizer & Prompt Runner (Chrome Extension)

This is a lightweight Chrome extension that lets you highlight text on any web page and either summarize it or run a custom prompt through a free LLM backend (OpenRouter). It uses Manifest V3.

Features
- Highlight text on a webpage and use the context menu to "Summarize selection" (shows an overlay).
- Open the extension popup to view the highlighted text, summarize it, or run a custom prompt.
- Stores API key and model selection in Chrome sync storage via the Options page.

How to load
1. Open Chrome and go to chrome://extensions
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked" and select the `d:/summarizer-chrome-extension` folder

Configure API key
1. Click the extension icon -> Options OR right-click the extension and choose "Options".
2. Paste your OpenRouter API key (starts with `sk-...`) and select model (default: `mistralai/mistral-7b-instruct`).
3. Save.

Notes
- This extension calls OpenRouter's Chat Completions endpoint: `https://api.openrouter.ai/v1/chat/completions`.
- Make sure your OpenRouter plan/model allows the chosen model. If you don't have an OpenRouter key, sign up at https://openrouter.ai and follow their docs.
- The extension stores your key in `chrome.storage.sync`.

Files
- `manifest.json` - extension manifest (v3)
- `background.js` - service worker, context menus, API calls
- `content.js` - overlay injection
- `popup.html` / `popup.js` - popup UI and logic
- `options.html` / `options.js` - options to save API key and model
- `styles.css` - popup/options/overlay styling

Troubleshooting
- If results aren't showing, open DevTools for the extension service worker (chrome://extensions -> Service Worker) and check console logs.
- If the API returns errors, verify your API key and model in Options.
