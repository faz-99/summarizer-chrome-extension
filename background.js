// background.js - service worker
// Creates context menus, handles API calls to OpenRouter, and routes results to popup/content.

const OPENROUTER_URL = 'https://api.openrouter.ai/v1/chat/completions';

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'summarize_selection',
      title: 'Summarize selection',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'run_custom_prompt',
      title: 'Run custom prompt',
      contexts: ['selection']
    });
  });
  // If no API key is set, store a preset key so users don't need to paste it.
  // NOTE: This embeds a key into the extension's storage on install. Remove or change if you don't want
  // the key persisted in users' Chrome sync storage.
  const PRESET_API_KEY = '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';
  try {
    chrome.storage.sync.get(['apiKey'], (cfg) => {
      if (!cfg || !cfg.apiKey) {
        chrome.storage.sync.set({ apiKey: PRESET_API_KEY }, () => {
          console.log('Preset API key stored into chrome.storage.sync');
        });
      }
    });
  } catch (e) {
    console.warn('Could not set preset API key on install:', e);
  }
});

// Helper: call OpenRouter chat completions
async function callOpenRouter(apiKey, model, userPrompt) {
  if (!apiKey) throw new Error('API key not set in Options');

  const body = {
    model: model,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 1024
  };

  let resp;
  try {
    resp = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    // This usually surfaces as "TypeError: Failed to fetch" when fetch cannot reach the host
    console.error('Network/fetch error calling OpenRouter:', networkErr);
    throw new Error(`Network error when calling OpenRouter: ${networkErr.message || networkErr}`);
  }

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('OpenRouter returned non-OK:', resp.status, txt);
    throw new Error(`OpenRouter error ${resp.status}: ${txt}`);
  }

  const data = await resp.json();
  // Expect choices[0].message.content
  try {
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return content || JSON.stringify(data);
  } catch (e) {
    return JSON.stringify(data);
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (!tab || !info) return;

    if (info.menuItemId === 'summarize_selection') {
      const selection = info.selectionText || '';
      if (!selection) return;

      // get API key & model
      const cfg = await chrome.storage.sync.get(['apiKey', 'model']);
      const apiKey = cfg.apiKey;
      const model = cfg.model || 'mistralai/mistral-7b-instruct';

      const prompt = `Summarize the following text:\n\n${selection}`;
      // call API
      const result = await callOpenRouter(apiKey, model, prompt);

      // send to content script to show overlay
      chrome.tabs.sendMessage(tab.id, { action: 'show_overlay', content: result });
    }

    if (info.menuItemId === 'run_custom_prompt') {
      // Open popup so user can enter prompt and run it on current selection
      // This gives the user a chance to type a custom prompt
      try { chrome.action.openPopup(); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('Context menu handler error', err);
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'show_overlay', content: `Error: ${err.message}` });
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  if (msg.action === 'call_api') {
    // msg: { prompt, selection }
    (async () => {
      try {
        const cfg = await chrome.storage.sync.get(['apiKey', 'model']);
        const apiKey = cfg.apiKey;
        const model = cfg.model || 'mistralai/mistral-7b-instruct';

        const combined = msg.prompt ? `${msg.prompt}\n\n${msg.selection || ''}` : (msg.selection || '');
        const result = await callOpenRouter(apiKey, model, combined);
        sendResponse({ ok: true, result });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    // Indicate we'll call sendResponse asynchronously
    return true;
  }
});
