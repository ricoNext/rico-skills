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
    configPath: path.join(root, '.rico-skill', 'backend-api-sync.config'),
    defaultRulePath: '.rico-skill/backend-api-sync-rules.md',
  });
});

test('isAbsoluteExistingDirectory rejects relative and missing directories', () => {
  assert.equal(isAbsoluteExistingDirectory('relative/service'), false);
  assert.equal(isAbsoluteExistingDirectory('/missing/service'), false);
  assert.equal(isAbsoluteExistingDirectory(null), false);
});
