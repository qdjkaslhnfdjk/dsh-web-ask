(() => {
  const isHarness = location.protocol === 'http:'
    && (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
    && location.port === '3080';
  if (!isHarness) return;

  function announce() {
    window.postMessage({
      source: 'dsh-web-ask-bridge',
      type: 'ready',
      version: '1.0.0',
    }, location.origin);
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.source !== 'dsh-web-ask-page') return;
    if (message.type === 'ping') {
      announce();
      return;
    }
    if (message.type !== 'ask') return;
    if (typeof message.prompt !== 'string' || typeof message.requestId !== 'string') return;
    chrome.runtime.sendMessage({
      source: 'dsh-web-ask-content',
      type: 'ask',
      requestId: message.requestId,
      prompt: message.prompt,
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.source !== 'dsh-web-ask-extension' || message.type !== 'deepseek-result') return false;
    window.postMessage({
      source: 'dsh-web-ask-bridge',
      type: 'answer',
      requestId: message.requestId,
      ok: message.ok === true,
      answer: typeof message.answer === 'string' ? message.answer : '',
      error: typeof message.error === 'string' ? message.error : '',
    }, location.origin);
    sendResponse({ ok: true });
    return false;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', announce, { once: true });
  } else {
    announce();
  }
})();
