import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  defaultRules,
  ensureStyleDocument,
  getStylePath,
  normalizeRules,
  parseStyleDocument,
  readStyleDocument,
  renderStyleDocument,
  validateRules,
  writeStyleDocument,
} from '../scripts/lib/style-document.mjs';

function makeProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'api-typescript-style-'));
}

test('validateRules accepts the default schema', () => {
  assert.deepEqual(validateRules({ ...defaultRules }), { ...defaultRules });
});

test('validateRules rejects unknown fields and invalid enums', () => {
  assert.throws(() => validateRules({ ...defaultRules, extra: true }), /未知字段/);
  assert.throws(
    () => validateRules({ ...defaultRules, typeStyle: 'inline' }),
    /interface 或 type/,
  );
  assert.throws(
    () =>
      validateRules({
        ...defaultRules,
        typePlacement: 'separate-file',
        typeDir: '',
      }),
    /typeDir/,
  );
});

test('renderStyleDocument round-trips through parseStyleDocument', () => {
  const rules = normalizeRules({
    apiDir: 'src/services',
    requestImport: '@/lib/http',
    requestIdentifier: 'httpRequest',
    requestImportStyle: 'named',
    responseWrapper: 'ApiResponse<T>',
    typeStyle: 'type',
    typePlacement: 'separate-file',
    typeDir: 'src/types',
    paramStyle: 'separate',
    naming: 'snake_case',
    formatter: 'pnpm biome check --write',
    typecheck: 'tsc --noEmit',
  });
  const markdown = renderStyleDocument(rules, {
    source: 'CLAUDE.md',
    section: 'API 规范',
    originalContent: '使用 httpRequest 和 ApiResponse。',
  });
  assert.match(markdown, /## 配置字段/);
  assert.match(markdown, /- apiDir: `src\/services`/);
  assert.match(markdown, /原始规范说明/);
  assert.deepEqual(parseStyleDocument(markdown), rules);
});

test('parseStyleDocument reads empty backtick values as empty strings', () => {
  const markdown = `# API

## 配置字段

- schema_version: \`1\`
- apiDir: \`src/api\`
- requestImport: \`@/api\`
- requestIdentifier: \`request\`
- requestImportStyle: \`default\`
- responseMode: \`wrapped\`
- responseWrapper: \`Response<T>\`
- typeStyle: \`interface\`
- typePlacement: \`same-file\`
- typeDir: \`\`
- paramStyle: \`inline\`
- naming: \`camelCase\`
- formatter: \`\`
- typecheck: \`\`
`;
  assert.deepEqual(parseStyleDocument(markdown).typeDir, '');
  assert.deepEqual(parseStyleDocument(markdown).formatter, '');
});

test('ensureStyleDocument keeps an existing valid file', () => {
  const projectRoot = makeProject();
  const stylePath = getStylePath(projectRoot);
  writeStyleDocument(stylePath, defaultRules);
  const before = fs.readFileSync(stylePath, 'utf8');
  const result = ensureStyleDocument(projectRoot, { infer: true });
  assert.equal(result.status, 'exists');
  assert.equal(fs.readFileSync(stylePath, 'utf8'), before);
});

test('ensureStyleDocument creates from project documents', () => {
  const projectRoot = makeProject();
  fs.writeFileSync(
    path.join(projectRoot, 'CLAUDE.md'),
    '## API 接口规范\n\n使用 request 和 src/api，返回 ApiResponse。\n',
  );
  const result = ensureStyleDocument(projectRoot);
  assert.equal(result.status, 'created');
  assert.equal(result.source, 'document');
  assert.equal(readStyleDocument(result.stylePath).apiDir, 'src/api');
  assert.match(fs.readFileSync(result.stylePath, 'utf8'), /原始规范说明/);
});

test('ensureStyleDocument can infer from existing API files', () => {
  const projectRoot = makeProject();
  const apiDir = path.join(projectRoot, 'src/services');
  fs.mkdirSync(apiDir, { recursive: true });
  fs.writeFileSync(
    path.join(apiDir, 'orders.ts'),
    `import { httpRequest } from '@/lib/http';

export const getOrder = (data: { id: number }) =>
  httpRequest<ApiResponse<Order>>('/orders/detail');
`,
  );
  const result = ensureStyleDocument(projectRoot, { infer: true });
  assert.equal(result.status, 'created');
  assert.deepEqual(result.rules.apiDir, 'src/services');
  assert.equal(result.rules.requestIdentifier, 'httpRequest');
  assert.equal(result.rules.requestImport, '@/lib/http');
  assert.equal(result.rules.requestImportStyle, 'named');
  assert.equal(result.rules.responseWrapper, 'ApiResponse<T>');
});

test('ensureStyleDocument reports missing when docs and inference are unavailable', () => {
  const projectRoot = makeProject();
  const result = ensureStyleDocument(projectRoot);
  assert.equal(result.status, 'missing');
  assert.equal(fs.existsSync(getStylePath(projectRoot)), false);
});
