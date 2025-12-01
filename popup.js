// popup.js
// Gets current page selection, lets user summarize or run a custom prompt.

document.addEventListener('DOMContentLoaded', () => {
  const selEl = document.getElementById('selection');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const runPromptBtn = document.getElementById('runPromptBtn');
  const promptInput = document.getElementById('promptInput');
  const outputEl = document.getElementById('output');
  const optionsLink = document.getElementById('optionsLink');

  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Helper: get selection from active tab
  async function getSelectionFromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return '';
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });
      const text = (results && results[0] && results[0].result) || '';
      return text;
    } catch (e) {
      console.error('selection exec error', e);
      return '';
    }
  }

  // Populate selection on open
  getSelectionFromActiveTab().then(text => { selEl.value = text; });

  summarizeBtn.addEventListener('click', async () => {
    const selection = selEl.value.trim();
    if (!selection) { outputEl.textContent = 'No selection'; return; }
    outputEl.textContent = 'Working...';

    // Use dedicated summarization action so background uses the HF summarizer
    chrome.runtime.sendMessage({ action: 'summarize', selection }, (resp) => {
      // our summarize action uses sendResponse to return { ok:true, result }
      if (!resp) { outputEl.textContent = 'No response from background'; return; }
      if (resp.ok) outputEl.textContent = resp.result;
      else outputEl.textContent = `Error: ${resp.error}`;
    });
  });

  runPromptBtn.addEventListener('click', async () => {
    const selection = selEl.value.trim();
    const userPrompt = promptInput.value.trim();
    if (!selection) { outputEl.textContent = 'No selection'; return; }
    if (!userPrompt) { outputEl.textContent = 'Please enter a prompt'; return; }
    outputEl.textContent = 'Working...';

    chrome.runtime.sendMessage({ action: 'call_api', prompt: userPrompt, selection }, (resp) => {
      if (!resp) { outputEl.textContent = 'No response from background'; return; }
      if (resp.ok) outputEl.textContent = resp.result;
      else outputEl.textContent = `Error: ${resp.error}`;
    });
  });
});
