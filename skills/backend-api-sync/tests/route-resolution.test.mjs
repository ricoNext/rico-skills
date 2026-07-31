import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { initializeConfig } from '../scripts/lib/config.mjs';
import { resolveConfiguredRoute } from '../scripts/lib/route-resolution.mjs';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/java/order-service');

test('route resolution only asks when multiple configured projects match', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-api-sync-'));
  const frontendRoot = path.join(root, 'frontend');
  const serviceOne = path.join(root, 'order-service');
  const serviceTwo = path.join(root, 'order-service-v2');
  fs.mkdirSync(frontendRoot);
  fs.cpSync(fixture, serviceOne, { recursive: true });
  fs.cpSync(fixture, serviceTwo, { recursive: true });
  initializeConfig(frontendRoot, [
    { name: 'order-service', language: 'java', path: serviceOne },
    { name: 'order-service-v2', language: 'java', path: serviceTwo },
  ]);

  const multiple = resolveConfiguredRoute(frontendRoot, '/orders');
  assert.equal(multiple.status, 'multiple');
  assert.deepEqual(multiple.candidates.map(({ project }) => project), ['order-service', 'order-service-v2']);
  assert.equal(resolveConfiguredRoute(frontendRoot, '/missing').status, 'not_found');
});
