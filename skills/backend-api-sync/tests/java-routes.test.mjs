import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { parseJavaSpring } from '../scripts/lib/java-cst.mjs';

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/java/order-service');

test('a controller-level route returns every endpoint in the controller', () => {
  const all = parseJavaSpring(backendRoot, '/orders');
  assert.equal(all.matches.length, 1);
  assert.deepEqual(all.matches[0].endpoints.map(({ method, path: endpointPath }) => [method, endpointPath]), [
    ['GET', '/orders/{id}'],
    ['POST', '/orders'],
  ]);
});

test('an endpoint route returns only that endpoint with all request locations', () => {
  const one = parseJavaSpring(backendRoot, '/orders/{id}');
  assert.equal(one.matches[0].endpoints.length, 1);
  assert.deepEqual(one.matches[0].endpoints[0].parameters.map(({ in: location, name }) => [location, name]), [
    ['path', 'id'],
    ['query', 'includeItems'],
    ['header', 'X-Tenant'],
  ]);
});
