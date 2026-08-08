import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { generateApiCode } from '../scripts/lib/generate-code.mjs';
import {
  generateFunctionName,
  parseCodegenStyle,
} from '../scripts/lib/parse-codegen-style.mjs';

function writeStyle(projectRoot, overrides = {}) {
  const rules = {
    schema_version: 1,
    apiDir: 'src/api',
    requestImport: '@/api',
    requestIdentifier: 'request',
    requestImportStyle: 'default',
    responseMode: 'wrapped',
    responseWrapper: 'Response<T>',
    typeStyle: 'interface',
    typePlacement: 'same-file',
    typeDir: '',
    paramStyle: 'inline',
    naming: 'camelCase',
    formatter: '',
    typecheck: '',
    ...overrides,
  };
  const stylePath = path.join(projectRoot, '.rico-skill', 'api-typescript-style.md');
  const fields = Object.entries(rules)
    .map(([key, value]) => `- ${key}: \`${value}\``)
    .join('\n');
  fs.mkdirSync(path.dirname(stylePath), { recursive: true });
  fs.writeFileSync(
    stylePath,
    `# API 与 TypeScript 定义规则\n\n## 配置字段\n\n${fields}\n`,
  );
  return rules;
}

test('parseCodegenStyle reads Markdown 配置字段 strictly', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yapi-style-'));
  const rules = writeStyle(projectRoot, {
    apiDir: 'src/services',
    requestImportStyle: 'named',
    requestIdentifier: 'httpRequest',
    requestImport: '@/lib/http',
  });
  assert.deepEqual(parseCodegenStyle(projectRoot), rules);
});

test('parseCodegenStyle fails when the style file is missing', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yapi-style-'));
  assert.throws(() => parseCodegenStyle(projectRoot), /未找到/);
});

test('generateFunctionName respects naming rules', () => {
  assert.equal(generateFunctionName('/user/detail', 'GET'), 'getUser');
  assert.equal(
    generateFunctionName('/user/detail', 'GET', 'snake_case'),
    'get_user',
  );
});

test('generateApiCode consumes request import and api style rules', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yapi-gen-'));
  writeStyle(projectRoot, {
    requestImportStyle: 'named',
    requestIdentifier: 'httpRequest',
    requestImport: '@/lib/http',
    responseWrapper: 'ApiResponse<T>',
  });

  const { files, config } = await generateApiCode(
    [
      {
        ok: true,
        data: {
          title: '用户详情',
          path: '/user/detail',
          method: 'GET',
          project_id: 1,
          _id: 2,
          req_body_other: JSON.stringify({
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'integer', description: '用户 ID' },
            },
          }),
        },
      },
    ],
    projectRoot,
  );

  assert.equal(config.requestIdentifier, 'httpRequest');
  assert.match(files.user, /import \{ httpRequest \} from "@\/lib\/http";/);
  assert.match(files.user, /export const getUser/);
  assert.match(files.user, /httpRequest<ApiResponse<T>>/);
  assert.match(files.user, /\/\*\* 用户 ID \*\//);
});
