import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { initializeConfig } from '../scripts/lib/config.mjs';
import { renderApiFiles, writePreview } from '../scripts/lib/typescript.mjs';

const fixtureRules = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/frontend/.rico-skill/backend-api-sync-rules.md');
const contract = {
  matches: [{ endpoints: [{ controller: 'OrderController', source: 'com/example/order/OrderController.java', javaMethod: 'getOrder', method: 'GET', path: '/orders/{id}', parameters: [{ in: 'path', name: 'id', type: 'String' }], requestBody: null, responseType: 'ResponseEntity<OrderDto>' }] }],
  types: [
    { name: 'OrderDto', kind: 'dto', fields: [{ name: 'id', type: 'String' }], genericParameters: [] },
    { name: 'ApiResponse', kind: 'dto', fields: [{ name: 'data', type: 'T' }], genericParameters: ['T'] },
    { name: 'OrderStatus', kind: 'enum', values: ['CREATED', 'PAID', 'CANCELLED'], fields: [], genericParameters: [] },
  ],
  unresolved: [],
};

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-api-sync-'));
  const frontendRoot = path.join(root, 'frontend');
  const backendRoot = path.join(root, 'backend');
  fs.mkdirSync(frontendRoot);
  fs.mkdirSync(backendRoot);
  initializeConfig(frontendRoot, [{ name: 'backend', language: 'java', path: backendRoot }]);
  fs.copyFileSync(fixtureRules, path.join(frontendRoot, '.rico-skill/backend-api-sync-rules.md'));
  return frontendRoot;
}

test('renderApiFiles previews generated API files without writing them', () => {
  const frontendRoot = setup();
  const preview = renderApiFiles(contract, frontendRoot);
  assert.deepEqual(preview.files.map(({ path: filePath, exists }) => [filePath, exists]), [['src/api/orders.ts', false]]);
  assert.match(preview.files[0].content, /export interface OrderDto/);
  assert.match(preview.files[0].content, /export interface ApiResponse<T>/);
  assert.match(preview.files[0].content, /export const getOrder/);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'src/api/orders.ts')), false);
});

test('writePreview requires an explicit choice for existing files', () => {
  const frontendRoot = setup();
  const target = path.join(frontendRoot, 'src/api/orders.ts');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'export const old = true;\n');
  const preview = renderApiFiles(contract, frontendRoot);
  assert.throws(() => writePreview(preview, new Map()), /缺少覆盖确认/);
  writePreview(preview, new Map([['src/api/orders.ts', 'skip']]));
  assert.match(fs.readFileSync(target, 'utf8'), /old = true/);
  writePreview(preview, new Map([['src/api/orders.ts', 'overwrite']]));
  assert.match(fs.readFileSync(target, 'utf8'), /export const getOrder/);
});
