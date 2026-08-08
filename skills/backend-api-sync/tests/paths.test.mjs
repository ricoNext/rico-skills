import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  getRuntimePaths,
  isAbsoluteExistingDirectory,
} from '../scripts/lib/paths.mjs';

test('getRuntimePaths returns runtime paths relative to the resolved project root', () => {
  const root = path.resolve('/workspace/frontend');

  assert.deepEqual(getRuntimePaths('/workspace/frontend'), {
    runtimeDir: path.join(root, '.rico-skill'),
    configDir: path.join(root, '.rico-skill', 'backend-api-sync'),
    configPath: path.join(root, '.rico-skill', 'backend-api-sync', 'config.json'),
    rulesPath: path.join(root, '.rico-skill', 'api-typescript-style.md'),
  });
});

test('isAbsoluteExistingDirectory rejects relative and missing directories', () => {
  assert.equal(isAbsoluteExistingDirectory(process.cwd()), true);
  assert.equal(isAbsoluteExistingDirectory('relative/service'), false);
  assert.equal(isAbsoluteExistingDirectory('/missing/service'), false);
  assert.equal(isAbsoluteExistingDirectory(null), false);
  assert.equal(isAbsoluteExistingDirectory(42), false);
});
