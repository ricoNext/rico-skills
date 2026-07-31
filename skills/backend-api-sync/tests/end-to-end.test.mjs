import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { initializeConfig } from '../scripts/lib/config.mjs';
import { parseJavaSpring } from '../scripts/lib/java-cst.mjs';
import { renderApiFiles, writePreview } from '../scripts/lib/typescript.mjs';

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url));

test('parses a controller and writes nothing until the preview is confirmed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-api-sync-'));
  const frontendRoot = path.join(root, 'frontend');
  const backendRoot = path.join(root, 'order-service');
  fs.mkdirSync(frontendRoot);
  fs.cpSync(path.join(fixtureRoot, 'fixtures/java/order-service'), backendRoot, { recursive: true });
  initializeConfig(frontendRoot, [{ name: 'order-service', language: 'java', path: backendRoot }]);
  fs.copyFileSync(path.join(fixtureRoot, 'fixtures/frontend/.rico-skill/backend-api-sync-rules.md'), path.join(frontendRoot, '.rico-skill/backend-api-sync-rules.md'));

  const contract = parseJavaSpring(backendRoot, '/orders');
  const preview = renderApiFiles(contract, frontendRoot);
  const target = path.join(frontendRoot, 'src/api/orders.ts');
  assert.equal(contract.unresolved.length, 0);
  assert.equal(fs.existsSync(target), false);
  writePreview(preview, new Map());
  assert.match(fs.readFileSync(target, 'utf8'), /OrderStatus = "CREATED" \| "PAID" \| "CANCELLED"/);
});
