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
});
