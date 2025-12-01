// content.js
// Listens for messages from background to show an overlay with the result.

function createOverlay(text) {
  // Remove existing overlay if present
  const existing = document.getElementById('quick-summarizer-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'quick-summarizer-overlay';
  overlay.style.position = 'fixed';
  overlay.style.right = '20px';
  overlay.style.top = '20px';
  overlay.style.zIndex = 2147483647;
  overlay.style.background = '#fff';
  overlay.style.color = '#111';
  overlay.style.padding = '16px';
  overlay.style.borderRadius = '10px';
  overlay.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
  overlay.style.maxWidth = '520px';
  overlay.style.maxHeight = '70vh';
  overlay.style.overflow = 'auto';
  overlay.style.fontFamily = 'Segoe UI, Arial, sans-serif';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '6px';
  closeBtn.style.right = '8px';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'transparent';
  closeBtn.style.fontSize = '20px';
  closeBtn.style.cursor = 'pointer';

  closeBtn.addEventListener('click', () => overlay.remove());

  const contentPre = document.createElement('pre');
  contentPre.style.whiteSpace = 'pre-wrap';
  contentPre.style.margin = '0';
  contentPre.style.paddingTop = '8px';
  contentPre.textContent = text;

  overlay.appendChild(closeBtn);
  overlay.appendChild(contentPre);
  document.body.appendChild(overlay);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  if (msg.action === 'show_overlay') {
    createOverlay(msg.content || '(no content)');
  }
});
