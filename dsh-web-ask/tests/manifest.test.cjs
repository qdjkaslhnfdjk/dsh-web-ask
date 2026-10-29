const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'bridge', 'manifest.json'), 'utf8'));

test('bridge manifest uses local scripts and restricted hosts', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['tabs']);
  assert.ok(manifest.host_permissions.includes('https://chat.deepseek.com/*'));
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  for (const script of manifest.content_scripts) {
    for (const file of script.js) assert.ok(fs.existsSync(path.join(root, 'bridge', file)));
  }
});

test('plugin package contains every declared runtime file', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const file of pkg.files) assert.ok(fs.existsSync(path.join(root, file)), file);
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(pkg.exports['./client'], './client.js');
});
