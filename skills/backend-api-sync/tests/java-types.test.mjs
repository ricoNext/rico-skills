import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveTypeClosure, toTypeScript } from '../scripts/lib/java-types.mjs';

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/java/order-service');

test('resolves nested DTOs, inherited fields and enum types', () => {
  const result = resolveTypeClosure(backendRoot, ['ResponseEntity<ApiResponse<OrderDto>>']);
  assert.deepEqual([...result.types.keys()].sort(), ['ApiResponse', 'AuditedDto', 'OrderDto', 'OrderItemDto', 'OrderStatus']);
  assert.equal(result.types.get('OrderStatus').kind, 'enum');
  assert.deepEqual(result.types.get('OrderStatus').values, ['CREATED', 'PAID', 'CANCELLED']);
  assert.equal(toTypeScript('Map<String, BigDecimal>'), 'Record<string, string>');
  assert.equal(toTypeScript('List<OrderItemDto>'), 'OrderItemDto[]');
  assert.equal(toTypeScript('Optional<OrderStatus>'), 'OrderStatus | undefined');
});
