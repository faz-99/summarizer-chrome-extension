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
  // No preset API key is stored on install. Please set your API key in Options or via the
  // service worker console using chrome.storage.sync.set({ apiKey: 'sk-...' }).
});

// Helper: call OpenRouter chat completions (or forward via a user-provided proxyUrl)
// If proxyUrl is provided, the request will be POSTed to that URL and the proxy should
// forward the request to OpenRouter using a server-side API key.
// DoH resolver using Cloudflare's JSON DNS API
async function resolveDoH(host) {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`;
    const resp = await fetch(url, { headers: { Accept: 'application/dns-json' } });
    if (!resp.ok) {
      console.warn('DoH lookup returned non-OK', resp.status);
      return null;
    }
    const data = await resp.json();
    // data.Answer may contain records with "data" as IPs
    const answers = (data && data.Answer && Array.isArray(data.Answer)) ? data.Answer.map(a => a.data) : [];
    return answers;
  } catch (err) {
    console.warn('DoH resolve error', err);
    return null;
  }
}

async function callOpenRouter(apiKey, model, userPrompt, proxyUrl, useDoH) {
  // If no apiKey and no proxyUrl, we can't call OpenRouter
  if (!apiKey && !proxyUrl) throw new Error('API key not set in Options and no proxy configured');

  // Optionally perform a DoH resolution and log the results. This can help detect ISP DNS poisoning.
  if (useDoH) {
    try {
      const host = (proxyUrl && proxyUrl.length) ? new URL(proxyUrl).hostname : new URL(OPENROUTER_URL).hostname;
      const addresses = await resolveDoH(host);
      if (addresses && addresses.length) {
        console.log(`DoH resolved ${host} ->`, addresses);
      } else {
        console.log('DoH did not return addresses for', host);
      }
    } catch (err) {
      console.warn('DoH pre-resolve failed', err);
    }
  }

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
    const endpoint = proxyUrl || OPENROUTER_URL;
    const headers = { 'Content-Type': 'application/json' };
    if (!proxyUrl) headers['Authorization'] = 'Bearer ' + apiKey;

    resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    // This usually surfaces as "TypeError: Failed to fetch" when fetch cannot reach the host
    console.error('Network/fetch error calling OpenRouter:', networkErr);
    // Try fallback to Hugging Face Inference API as a quick workaround
    try {
      const hf = await callHuggingFaceFallback(model, userPrompt);
      console.warn('Falling back to Hugging Face inference API result');
      return hf;
    } catch (hfErr) {
      console.error('Hugging Face fallback also failed:', hfErr);
      throw new Error(`Network error when calling OpenRouter: ${networkErr.message || networkErr}`);
    }
  }

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('OpenRouter returned non-OK:', resp.status, txt);
    // If OpenRouter returns a server error or other non-OK, attempt HF fallback
    try {
      const hf = await callHuggingFaceFallback(model, userPrompt);
      console.warn('OpenRouter non-OK; falling back to Hugging Face inference API result');
      return hf;
    } catch (hfErr) {
      console.error('Hugging Face fallback also failed after non-OK OpenRouter:', hfErr);
      throw new Error(`OpenRouter error ${resp.status}: ${txt}`);
    }
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

// Hugging Face inference fallback
async function callHuggingFaceFallback(model, userPrompt) {
  // Map OpenRouter model names to Hugging Face model IDs where reasonable
  const modelMap = {
    'mistralai/mistral-7b-instruct': 'mistralai/Mistral-7B-Instruct-v0.2'
  };
  const hfModel = modelMap[model] || model.replace('/', '/');
  // New router endpoint (replacement for api-inference):
  const HF_ROUTER_URL = `https://router.huggingface.co/models/${hfModel}/infer`;

  const body = {
    inputs: userPrompt,
    parameters: { max_new_tokens: 512, temperature: 0.2 }
  };

  try {
    // Try to get an optional HF token from storage (if present) to include in Authorization
    let hfToken = null;
    try { const s = await chrome.storage.sync.get(['hfToken']); hfToken = s.hfToken; } catch (e) { /* ignore */ }

    const headers = { 'Content-Type': 'application/json' };
    if (hfToken) headers['Authorization'] = 'Bearer ' + hfToken;

    const resp = await fetch(HF_ROUTER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Hugging Face returned non-OK:', resp.status, txt);
      throw new Error(`Hugging Face error ${resp.status}: ${txt}`);
    }

    const data = await resp.json();

    // Router may return different shapes. Common ones:
    // - { generated_text: '...' }
    // - [{ generated_text: '...' }]
    // - { data: [ { generated_text: '...' } ] }
    // - { outputs: [...] }
    if (!data) return JSON.stringify(data);

    // If top-level generated_text
    if (data.generated_text && typeof data.generated_text === 'string') return data.generated_text;

    // If array
    if (Array.isArray(data)) {
      if (data[0] && data[0].generated_text) return data[0].generated_text;
      if (typeof data[0] === 'string') return data[0];
      return JSON.stringify(data);
    }

    // If data.data or outputs
    if (data.data && Array.isArray(data.data) && data.data[0] && data.data[0].generated_text) return data.data[0].generated_text;
    if (data.outputs && Array.isArray(data.outputs) && data.outputs[0] && data.outputs[0].generated_text) return data.outputs[0].generated_text;

    // Fallback: stringify whole response
    return JSON.stringify(data);
  } catch (err) {
    console.error('Error calling Hugging Face inference API:', err);
    throw err;
  }
}

// Dedicated Hugging Face summarizer using facebook/bart-large-cnn
async function callHFSummarizer(hfToken, userText) {
  if (!hfToken) throw new Error('Hugging Face token not set in Options');

  // Helper to call router for a given input and return extracted text
  async function callRouter(inputText) {
    const modelId = 'facebook/bart-large-cnn';
    const url = `https://router.huggingface.co/models/${modelId}/infer`;
    const body = { inputs: `Summarize the following text in 3 concise sentences:\n${inputText}` };

    const headers = { 'Content-Type': 'application/json' };
    if (hfToken) headers['Authorization'] = 'Bearer ' + hfToken;

    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Hugging Face summarizer error ${resp.status}: ${txt}`);
    }
    const data = await resp.json();

    // Extract summary text from common shapes
    if (!data) return '';
    if (typeof data === 'string') return data;
    if (data.generated_text) return data.generated_text;
    if (Array.isArray(data) && data[0]) {
      if (typeof data[0] === 'string') return data[0];
      if (data[0].generated_text) return data[0].generated_text;
      if (data[0].summary_text) return data[0].summary_text;
      if (data[0].data && data[0].data[0] && data[0].data[0].generated_text) return data[0].data[0].generated_text;
    }
    if (data.summary_text) return data.summary_text;
    if (data.data && Array.isArray(data.data) && data.data[0] && data.data[0].summary_text) return data.data[0].summary_text;

    return JSON.stringify(data);
  }

  // Respect input size: split into chunks if very large (simple character-based split)
  const MAX_CHUNK_CHARS = 4000; // conservative default
  const chunks = [];
  for (let i = 0; i < userText.length; i += MAX_CHUNK_CHARS) {
    chunks.push(userText.slice(i, i + MAX_CHUNK_CHARS));
  }

  try {
    // If single chunk, call once
    if (chunks.length === 1) {
      const s = await callRouter(chunks[0]);
      return s;
    }

    // Multiple chunks: summarize each, then summarize the concatenation
    const partials = [];
    for (const c of chunks) {
      const p = await callRouter(c);
      partials.push(p);
    }

    const combined = partials.join('\n\n');
    // Final pass to get unified 3-sentence summary
    const final = await callRouter(combined);
    return final;
  } catch (err) {
    // Bubble up a clearer error
    throw new Error(`Hugging Face summarizer failed: ${err.message || err}`);
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (!tab || !info) return;

    if (info.menuItemId === 'summarize_selection') {
      const selection = info.selectionText || '';
      if (!selection) return;
        // get HF token and prefer using HF summarizer for dedicated summarization
        const cfg = await chrome.storage.sync.get(['hfToken', 'apiKey', 'model', 'proxyUrl', 'useDoH']);
        const hfToken = cfg.hfToken;
        // Use HF summarizer for dedicated summaries
        let result;
        try {
          result = await callHFSummarizer(hfToken, selection);
        } catch (hfErr) {
          // fallback to OpenRouter/other flow if HF summarizer fails
          console.warn('HF summarizer failed, falling back to OpenRouter/other:', hfErr);
          const apiKey = cfg.apiKey;
          const model = cfg.model || 'mistralai/mistral-7b-instruct';
          const proxyUrl = cfg.proxyUrl;
          const useDoH = !!cfg.useDoH;
          const prompt = `Summarize the following text:\n\n${selection}`;
          result = await callOpenRouter(apiKey, model, prompt, proxyUrl, useDoH);
        }

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

  if (msg.action === 'summarize') {
    (async () => {
      try {
        const cfg = await chrome.storage.sync.get(['hfToken']);
        const hfToken = cfg.hfToken;
        const selection = msg.selection || '';
        const result = await callHFSummarizer(hfToken, selection);
        sendResponse({ ok: true, result });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.action === 'call_api') {
    // msg: { prompt, selection }
    (async () => {
      try {
        const cfg = await chrome.storage.sync.get(['hfToken', 'apiKey', 'model', 'proxyUrl', 'useDoH']);
        const hfToken = cfg.hfToken;
        const apiKey = cfg.apiKey;
        const model = cfg.model || 'mistralai/mistral-7b-instruct';
        const proxyUrl = cfg.proxyUrl;
        const useDoH = !!cfg.useDoH;

        const combined = msg.prompt ? `${msg.prompt}\n\n${msg.selection || ''}` : (msg.selection || '');

        // If the incoming request is a summarization-style prompt (we detect by leading Summarize phrase),
        // prefer the dedicated HF summarizer. Otherwise use existing callOpenRouter flow.
        let result;
        const isSummarize = typeof msg.prompt === 'string' && msg.prompt.trim().toLowerCase().startsWith('summarize');
        if (isSummarize) {
          try {
            result = await callHFSummarizer(hfToken, msg.selection || '');
          } catch (e) {
            console.warn('HF summarizer failed in message flow, falling back to OpenRouter:', e);
            result = await callOpenRouter(apiKey, model, combined, proxyUrl, useDoH);
          }
        } else {
          result = await callOpenRouter(apiKey, model, combined, proxyUrl, useDoH);
        }
        sendResponse({ ok: true, result });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    // Indicate we'll call sendResponse asynchronously
    return true;
  }
});
