// options.js
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyEl = document.getElementById('apiKey');
  const modelEl = document.getElementById('model');
  const saveBtn = document.getElementById('saveBtn');

  // Load saved
  chrome.storage.sync.get(['apiKey', 'model'], (cfg) => {
    if (cfg.apiKey) apiKeyEl.value = cfg.apiKey;
    if (cfg.model) modelEl.value = cfg.model;
  });

  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyEl.value.trim();
    const model = modelEl.value;
    chrome.storage.sync.set({ apiKey, model }, () => {
      saveBtn.textContent = 'Saved';
      setTimeout(() => (saveBtn.textContent = 'Save'), 1200);
    });
  });
});
