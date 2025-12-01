// simulate_message_flow.js
// Node-based simulated test for background.js message flow.
// This script loads background.js into a VM with a mocked `chrome` and `fetch`.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const backgroundPath = path.resolve(__dirname, '..', 'background.js');
const backgroundSrc = fs.readFileSync(backgroundPath, 'utf8');

// Collector to capture messages sent via chrome.tabs.sendMessage
const sentMessages = [];

// Minimal mock for chrome APIs used by background.js
const chrome = {
  contextMenus: {
    _onClicked: null,
    removeAll(cb) { if (cb) cb(); },
    create(opt) { /* noop */ },
    onClicked: { addListener(fn) { this._onClicked = fn; } }
  },
  runtime: {
    onInstalled: { addListener(fn) { /* background will register; call later if needed */ } },
    onMessage: { addListener(fn) { /* not used in this test */ } },
    openOptionsPage() { /* noop */ }
  },
  action: { openPopup() { /* noop */ } },
  storage: {
    sync: {
      get(keys, cb) {
        // Return a fake API key and model
        const result = { apiKey: 'testkey', model: 'mistralai/mistral-7b-instruct' };
        if (typeof keys === 'string') cb({ [keys]: result[keys] });
        else cb(result);
      }
    }
  },
  tabs: {
    sendMessage(tabId, msg) {
      sentMessages.push({ tabId, msg });
    }
  }
};

// Mock fetch to simulate OpenRouter response
function mockFetch(url, opts) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ choices: [ { message: { content: 'SIMULATED MODEL OUTPUT: Short summary' } } ] })
  });
}

// Run background.js in a VM context with mocked globals
const context = vm.createContext({ console, chrome, fetch: mockFetch, setTimeout, clearTimeout, Promise });
vm.runInContext(backgroundSrc, context, { filename: 'background.js' });

// Find the registered onClicked listener (our mock stored it on chrome.contextMenus._onClicked)
const onClicked = chrome.contextMenus._onClicked;
if (!onClicked) {
  console.error('No contextMenus.onClicked listener registered by background.js');
  process.exit(2);
}

(async () => {
  // Simulate right-click -> 'summarize_selection' with some sample text
  const info = { menuItemId: 'summarize_selection', selectionText: 'This is a test selection.' };
  const tab = { id: 42 };

  try {
    await onClicked(info, tab);

    // Wait briefly for async actions
    await new Promise((r) => setTimeout(r, 200));

    if (sentMessages.length === 0) {
      console.error('Test failed: no message sent via chrome.tabs.sendMessage');
      process.exit(3);
    }

    const last = sentMessages[sentMessages.length - 1];
    console.log('Captured sendMessage:', JSON.stringify(last, null, 2));
    if (last.msg && last.msg.action === 'show_overlay' && last.msg.content && last.msg.content.includes('SIMULATED MODEL OUTPUT')) {
      console.log('Test passed: background -> API -> tabs.sendMessage flow works (simulated)');
      process.exit(0);
    } else {
      console.error('Test failed: unexpected message content', last.msg);
      process.exit(4);
    }
  } catch (err) {
    console.error('Error during test run', err);
    process.exit(1);
  }
})();
