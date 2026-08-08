import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ensureConfigTemplate,
  finalizeConfig,
  initializeConfig,
  readConfig,
  validateConfiguredProjects,
  validateProjects,
} from '../scripts/lib/config.mjs';
import { readRulesDocument } from '../scripts/lib/rules.mjs';

const fixtureRules = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/frontend/.rico-skill/api-typescript-style.md',
);

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-api-sync-'));
  const frontendRoot = path.join(root, 'frontend');
  const backendRoot = path.join(root, 'order-service');
  fs.mkdirSync(frontendRoot);
  fs.mkdirSync(backendRoot);
  return { root, frontendRoot, backendRoot };
}

function installRules(frontendRoot) {
  const target = path.join(frontendRoot, '.rico-skill/api-typescript-style.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(fixtureRules, target);
}

test('initializeConfig writes a project-local config and ignores only that config', () => {
  const { frontendRoot, backendRoot } = makeProject();
  const config = initializeConfig(frontendRoot, [
    { name: 'order-service', language: 'java', path: backendRoot },
  ]);

  assert.deepEqual(readConfig(frontendRoot), config);
  assert.match(
    fs.readFileSync(path.join(frontendRoot, '.gitignore'), 'utf8'),
    /^\.rico-skill\/backend-api-sync\/config\.json$/m,
  );
});

test('ensureConfigTemplate only creates an editable configuration template on first use', () => {
  const { frontendRoot } = makeProject();
  const result = ensureConfigTemplate(frontendRoot);
  const configPath = path.join(
    frontendRoot,
    '.rico-skill/backend-api-sync/config.json',
  );

  assert.equal(result.created, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, 'utf8')), {
    projects: [],
  });
  assert.equal(
    fs.existsSync(path.join(frontendRoot, '.rico-skill/api-typescript-style.md')),
    false,
  );
  assert.equal(fs.existsSync(path.join(frontendRoot, '.gitignore')), false);
  assert.deepEqual(ensureConfigTemplate(frontendRoot), {
    created: false,
    configPath,
  });
});

test('finalizeConfig requires an existing shared style document', () => {
  const { frontendRoot, backendRoot } = makeProject();
  ensureConfigTemplate(frontendRoot);
  const configPath = path.join(
    frontendRoot,
    '.rico-skill/backend-api-sync/config.json',
  );
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      projects: [{ name: 'backend', language: 'java', path: backendRoot }],
    }),
  );

  assert.throws(() => finalizeConfig(frontendRoot), /api-typescript-style/);
  installRules(frontendRoot);
  const finalized = finalizeConfig(frontendRoot);
  assert.equal(finalized.rules.apiDir, 'src/api');
  assert.equal(
    readRulesDocument(
      path.join(frontendRoot, '.rico-skill/api-typescript-style.md'),
    ).requestIdentifier,
    'request',
  );
});

test('validateConfiguredProjects checks an existing config before later work', () => {
  const { frontendRoot, backendRoot } = makeProject();
  ensureConfigTemplate(frontendRoot);
  const configPath = path.join(
    frontendRoot,
    '.rico-skill/backend-api-sync/config.json',
  );
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      projects: [{ name: 'backend', language: 'java', path: backendRoot }],
    }),
  );
  assert.deepEqual(validateConfiguredProjects(frontendRoot), [
    { name: 'backend', language: 'java', path: backendRoot },
  ]);

  fs.writeFileSync(
    configPath,
    JSON.stringify({
      projects: [{ name: 'backend', language: 'java', path: './relative' }],
    }),
  );
  assert.throws(() => validateConfiguredProjects(frontendRoot), /绝对目录/);
});

test('validateProjects rejects invalid paths, duplicate names, and unknown fields', () => {
  const { backendRoot } = makeProject();
  assert.throws(() => validateProjects([]), /非空数组/);
  assert.throws(
    () => validateProjects([{ name: 'x', language: 'java', path: 'relative' }]),
    /绝对目录/,
  );
  assert.throws(
    () =>
      validateProjects([
        { name: 'x', language: 'java', path: backendRoot },
        { name: 'x', language: 'java', path: backendRoot },
      ]),
    /重复/,
  );
  assert.throws(
    () =>
      validateProjects([
        { name: 'x', language: 'java', path: backendRoot, extra: true },
      ]),
    /未知字段/,
  );
});

test('readConfig rejects unknown config fields', () => {
  const { frontendRoot, backendRoot } = makeProject();
  initializeConfig(frontendRoot, [
    { name: 'backend', language: 'java', path: backendRoot },
  ]);
  fs.writeFileSync(
    path.join(frontendRoot, '.rico-skill/backend-api-sync/config.json'),
    JSON.stringify({
      projects: [{ name: 'backend', language: 'java', path: backendRoot }],
      rulePath: '../outside.md',
    }),
  );
  assert.throws(() => readConfig(frontendRoot), /未知字段/);
});
