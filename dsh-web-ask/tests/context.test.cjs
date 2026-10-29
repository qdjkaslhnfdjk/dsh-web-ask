const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadClient() {
  let definition;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(value) { definition = value; },
      },
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'client.js'), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: 'client.js' });
  assert.equal(definition.id, '@local/dsh-web-ask');
  return definition.factory(() => ({})).__test;
}

const core = loadClient();

test('extractMessages keeps user and visible assistant text only', () => {
  const nodes = [
    { kind: 'user', seq: 1, content: [{ type: 'text', text: '请创建模块。' }, { type: 'image', image: 'secret.png' }] },
    { kind: 'assistant', seq: 2, blocks: [{ kind: 'reasoning', text: '隐藏推理' }, { kind: 'text', text: '模块已创建。' }, { kind: 'tool-call', name: 'write' }] },
    { kind: 'tool-result', seq: 3, content: [{ type: 'text', text: '工具结果' }] },
    { kind: 'steering', seq: 4, content: [{ type: 'text', text: '再补一个测试。' }] },
  ];
  const messages = core.extractMessages(nodes);
  assert.equal(messages.length, 3);
  assert.deepEqual(Array.from(messages, message => message.role), ['user', 'assistant', 'user']);
  assert.equal(messages[1].text, '模块已创建。');
  assert.ok(!JSON.stringify(messages).includes('隐藏推理'));
  assert.ok(!JSON.stringify(messages).includes('工具结果'));
});

test('formatTranscript retains chronological order and truncates older content', () => {
  const messages = [
    { role: 'user', text: '最早的问题' },
    { role: 'assistant', text: '较早的回答' },
    { role: 'user', text: '最近的问题' },
    { role: 'assistant', text: '最近的回答' },
  ];
  const full = core.formatTranscript(messages, 10000);
  assert.ok(full.indexOf('最早的问题') < full.indexOf('最近的回答'));
  const limited = core.formatTranscript(messages, 35);
  assert.ok(limited.includes('最近'));
  assert.ok(limited.includes('省略'));
});

test('buildPrompt binds the project question to the extracted context', () => {
  const prompt = core.buildPrompt('这个模块有什么作用？', '用户：实现登录\n\nAgent：已经实现登录模块');
  assert.ok(prompt.includes('已经实现登录模块'));
  assert.ok(prompt.endsWith('我的问题：这个模块有什么作用？'));
  assert.ok(prompt.includes('不要继续修改项目'));
});
