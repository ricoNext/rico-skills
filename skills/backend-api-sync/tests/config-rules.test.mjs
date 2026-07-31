import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeConfig, readConfig, validateProjects } from '../scripts/lib/config.mjs';
import { discoverRules, readRules } from '../scripts/lib/rules.mjs';

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-api-sync-'));
  const frontendRoot = path.join(root, 'frontend');
  const backendRoot = path.join(root, 'order-service');
  fs.mkdirSync(frontendRoot);
  fs.mkdirSync(backendRoot);
  return { root, frontendRoot, backendRoot };
}

test('initializeConfig writes a project-local config and ignores only that config', () => {
  const { frontendRoot, backendRoot } = makeProject();
  const config = initializeConfig(frontendRoot, [{ name: 'order-service', language: 'java', path: backendRoot }]);

  assert.equal(config.rulePath, '.rico-skill/backend-api-sync-rules.md');
  assert.deepEqual(readConfig(frontendRoot), config);
  assert.match(fs.readFileSync(path.join(frontendRoot, '.gitignore'), 'utf8'), /^\.rico-skill\/backend-api-sync\.config$/m);
  assert.equal(fs.existsSync(path.join(frontendRoot, config.rulePath)), true);
});

test('discoverRules preserves an existing API convention document', () => {
  const { frontendRoot } = makeProject();
  fs.writeFileSync(path.join(frontendRoot, 'AGENTS.md'), '## API 规范\n使用 src/services 和 request<T>()。\n');

  const result = discoverRules(frontendRoot);
  assert.deepEqual(result, { rulePath: 'AGENTS.md', source: 'document' });
});

test('discoverRules creates a local editable rule document when no convention exists', () => {
  const { frontendRoot } = makeProject();
  const result = discoverRules(frontendRoot);
  const rules = readRules(frontendRoot, result.rulePath);

  assert.equal(result.rulePath, '.rico-skill/backend-api-sync-rules.md');
  assert.equal(result.source, 'generated');
  assert.equal(rules.apiDir, 'src/api');
  assert.match(fs.readFileSync(path.join(frontendRoot, result.rulePath), 'utf8'), /API 目录/);
});

test('discoverRules infers an existing API directory and request client', () => {
  const { frontendRoot } = makeProject();
  const apiRoot = path.join(frontendRoot, 'src/services');
  fs.mkdirSync(apiRoot, { recursive: true });
  fs.writeFileSync(path.join(apiRoot, 'orders.ts'), "import { httpRequest } from '@/lib/http';\n");
  const result = discoverRules(frontendRoot);
  assert.deepEqual(readRules(frontendRoot, result.rulePath), {
    apiDir: 'src/services', requestImport: '@/lib/http', requestIdentifier: 'httpRequest', responseMode: 'wrapped', typeStyle: 'interface', formatter: '', typecheck: '',
  });
});

test('validateProjects rejects invalid paths, duplicate names, and unknown fields', () => {
  const { backendRoot } = makeProject();
  assert.throws(() => validateProjects([]), /非空数组/);
  assert.throws(() => validateProjects([{ name: 'x', language: 'java', path: 'relative' }]), /绝对目录/);
  assert.throws(() => validateProjects([
    { name: 'x', language: 'java', path: backendRoot },
    { name: 'x', language: 'java', path: backendRoot },
  ]), /重复/);
  assert.throws(() => validateProjects([{ name: 'x', language: 'java', path: backendRoot, extra: true }]), /未知字段/);
});

test('readConfig rejects a rule path that escapes the frontend project', () => {
  const { frontendRoot, backendRoot } = makeProject();
  initializeConfig(frontendRoot, [{ name: 'backend', language: 'java', path: backendRoot }]);
  fs.writeFileSync(path.join(frontendRoot, '.rico-skill/backend-api-sync.config'), JSON.stringify({
    projects: [{ name: 'backend', language: 'java', path: backendRoot }], rulePath: '../outside.md',
  }));
  assert.throws(() => readConfig(frontendRoot), /rulePath/);
});
