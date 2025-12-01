Simulated test for message flow

Run with Node (requires Node 14+):

```bash
node test/simulate_message_flow.js
```

What it does:
- Loads `background.js` into a VM with a minimal mocked `chrome` API and a mocked `fetch` that returns a simulated model response.
- Simulates the context menu click for `summarize_selection` and verifies that `chrome.tabs.sendMessage` is called with an overlay action and the simulated model output.

This is a simulation for local verification only — it doesn't run inside Chrome.
