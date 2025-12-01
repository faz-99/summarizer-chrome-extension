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

  const resp = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
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
