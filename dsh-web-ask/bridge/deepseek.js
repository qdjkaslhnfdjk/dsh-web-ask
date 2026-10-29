(() => {
  const ANSWER_SELECTOR = '.ds-markdown, [data-testid="assistant-message"] .markdown, [class*="assistant"] .markdown';
  const COMPOSER_SELECTOR = 'textarea#chat-input, textarea[placeholder], textarea';
  const WAIT_FOR_COMPOSER_MS = 45000;
  const WAIT_FOR_ANSWER_MS = 240000;
  let queue = Promise.resolve();

  const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const visible = element => element instanceof HTMLElement && element.getClientRects().length > 0 && !element.disabled;

  function composer() {
    return [...document.querySelectorAll(COMPOSER_SELECTOR)].find(visible) || null;
  }

  function answers() {
    return [...new Set([...document.querySelectorAll(ANSWER_SELECTOR)])]
      .filter(element => element instanceof HTMLElement && element.getClientRects().length > 0);
  }

  async function waitForComposer() {
    const deadline = Date.now() + WAIT_FOR_COMPOSER_MS;
    while (Date.now() < deadline) {
      const input = composer();
      if (input) return input;
      await sleep(400);
    }
    throw new Error('未检测到 DeepSeek 输入框。请在打开的页面完成登录或人机验证后重试。');
  }

  function setComposerValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  }

  function sendButton() {
    const candidates = [...document.querySelectorAll('button, [role="button"]')];
    return candidates.find(element => {
      if (!visible(element) || element.getAttribute('aria-disabled') === 'true') return false;
      const label = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('data-testid') || ''}`.toLowerCase();
      return label.includes('发送') || label.includes('send');
    }) || null;
  }

  async function submit(input) {
    const button = sendButton();
    if (button) {
      button.click();
      return;
    }
    const init = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    input.dispatchEvent(new KeyboardEvent('keydown', init));
    input.dispatchEvent(new KeyboardEvent('keypress', init));
    input.dispatchEvent(new KeyboardEvent('keyup', init));
  }

  function generationVisible() {
    return [...document.querySelectorAll('button, [role="button"]')].some(element => {
      if (!visible(element)) return false;
      const label = `${element.getAttribute('aria-label') || ''} ${element.textContent || ''}`.toLowerCase();
      return label.includes('停止') || label.includes('stop') || label.includes('generating');
    });
  }

  async function waitForNewAnswer(before) {
    const previous = new Set(before);
    const deadline = Date.now() + WAIT_FOR_ANSWER_MS;
    let candidate = null;
    let lastText = '';
    let lastChange = Date.now();

    while (Date.now() < deadline) {
      const current = answers().filter(element => !previous.has(element));
      const latest = current.at(-1) || null;
      const text = latest?.innerText.trim() || '';
      if (latest && text) {
        if (latest !== candidate || text !== lastText) {
          candidate = latest;
          lastText = text;
          lastChange = Date.now();
        }
        const stableFor = Date.now() - lastChange;
        if ((!generationVisible() && stableFor >= 1800) || stableFor >= 5000) return text;
      }
      await sleep(350);
    }
    throw new Error('等待 DeepSeek 回答超时。请检查网页是否要求登录、验证或手动重试。');
  }

  async function ask(prompt) {
    const input = await waitForComposer();
    const before = answers();
    setComposerValue(input, prompt);
    await sleep(150);
    await submit(input);
    return waitForNewAnswer(before);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.source !== 'dsh-web-ask-extension') return false;
    if (message.type === 'deepseek-ping') {
      sendResponse({ ok: true, ready: Boolean(composer()) });
      return false;
    }
    if (message.type !== 'deepseek-ask') return false;
    queue = queue.then(() => ask(message.prompt));
    queue.then(
      answer => sendResponse({ ok: true, answer }),
      error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
    return true;
  });
})();
