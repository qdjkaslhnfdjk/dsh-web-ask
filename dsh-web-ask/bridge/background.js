const DEEPSEEK_HOME = 'https://chat.deepseek.com/';
const MAX_PROMPT_LENGTH = 80000;

function isHarnessSender(sender) {
  if (!sender.tab || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === 'http:'
      && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
      && url.port === '3080';
  } catch {
    return false;
  }
}

async function getDeepSeekTab() {
  const tabs = await chrome.tabs.query({ url: 'https://chat.deepseek.com/*' });
  const existing = tabs.find(tab => tab.id !== undefined);
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return existing.id;
  }
  const created = await chrome.tabs.create({ url: DEEPSEEK_HOME, active: true });
  if (created.id === undefined) throw new Error('无法打开 DeepSeek 网页版。');
  return created.id;
}

async function waitForDeepSeekContent(tabId) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, {
        source: 'dsh-web-ask-extension',
        type: 'deepseek-ping',
      });
      if (result?.ok) return;
    } catch {
      // A newly created tab injects its content script after document idle.
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error('DeepSeek 页面尚未就绪，请稍后重试。');
}

async function relayAnswer(originTabId, message) {
  try {
    await chrome.tabs.sendMessage(originTabId, message);
  } catch {
    // The Harness tab may have been closed while DeepSeek was answering.
  }
}

async function handleAsk(message, sender) {
  const originTabId = sender.tab.id;
  try {
    const deepseekTabId = await getDeepSeekTab();
    await waitForDeepSeekContent(deepseekTabId);
    const result = await chrome.tabs.sendMessage(deepseekTabId, {
      source: 'dsh-web-ask-extension',
      type: 'deepseek-ask',
      requestId: message.requestId,
      prompt: message.prompt,
    });
    await relayAnswer(originTabId, {
      source: 'dsh-web-ask-extension',
      type: 'deepseek-result',
      requestId: message.requestId,
      ...result,
    });
  } catch (error) {
    await relayAnswer(originTabId, {
      source: 'dsh-web-ask-extension',
      type: 'deepseek-result',
      requestId: message.requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.source !== 'dsh-web-ask-content') return false;
  if (message.type === 'ping' && isHarnessSender(sender)) {
    sendResponse({ ok: true, version: '1.0.0' });
    return false;
  }
  if (message.type !== 'ask' || !isHarnessSender(sender)) return false;
  if (typeof message.prompt !== 'string' || message.prompt.trim() === '') {
    sendResponse({ ok: false, error: '问题不能为空。' });
    return false;
  }
  if (message.prompt.length > MAX_PROMPT_LENGTH) {
    sendResponse({ ok: false, error: '上下文过长，请缩短后重试。' });
    return false;
  }
  if (typeof message.requestId !== 'string' || message.requestId.length > 100) {
    sendResponse({ ok: false, error: '请求标识无效。' });
    return false;
  }
  void handleAsk(message, sender);
  sendResponse({ ok: true, accepted: true });
  return false;
});
