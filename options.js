// options.js
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyEl = document.getElementById('apiKey');
  const modelEl = document.getElementById('model');
  const saveBtn = document.getElementById('saveBtn');
  const clearKeyBtn = document.getElementById('clearKeyBtn');

  // Load saved. If an apiKey exists, mask the input and disable direct editing to avoid accidental exposure
  chrome.storage.sync.get(['apiKey', 'model'], (cfg) => {
    if (cfg && cfg.apiKey) {
      apiKeyEl.value = '************';
      apiKeyEl.disabled = true;
    }
    if (cfg && cfg.model) modelEl.value = cfg.model;
  });

  saveBtn.addEventListener('click', () => {
    const raw = apiKeyEl.value.trim();
    const model = modelEl.value;
    // If input is masked and disabled, user must clear to enter a new key
    if (apiKeyEl.disabled && raw === '************') {
      // Nothing changed
      chrome.storage.sync.set({ model }, () => {
        saveBtn.textContent = 'Saved';
        setTimeout(() => (saveBtn.textContent = 'Save'), 1200);
      });
      return;
    }

    chrome.storage.sync.set({ apiKey: raw, model }, () => {
      saveBtn.textContent = 'Saved';
      // After saving, mask and disable the input
      apiKeyEl.value = '************';
      apiKeyEl.disabled = true;
      setTimeout(() => (saveBtn.textContent = 'Save'), 1200);
    });
  });

  clearKeyBtn.addEventListener('click', () => {
    chrome.storage.sync.remove(['apiKey'], () => {
      apiKeyEl.value = '';
      apiKeyEl.disabled = false;
      apiKeyEl.focus();
    });
  });

  // Test connection button: asks background to run a tiny test prompt using stored key
  const testConnBtn = document.getElementById('testConnBtn');
  const testResult = document.getElementById('testResult');
  if (testConnBtn) {
    testConnBtn.addEventListener('click', () => {
      testResult.textContent = 'Testing...';
      // We send a short prompt to the background which will perform the fetch using stored apiKey
      chrome.runtime.sendMessage({ action: 'call_api', prompt: 'Please reply with: CONNECTION_OK', selection: '' }, (resp) => {
        if (!resp) {
          testResult.textContent = 'No response from background (check service worker console)';
          return;
        }
        if (resp.ok) {
          testResult.textContent = `OK — API returned:\n\n${resp.result}`;
        } else {
          testResult.textContent = `ERROR — ${resp.error}`;
        }
      });
    });
  }
});
