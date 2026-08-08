import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'scripts',
);

function runDetect(projectRoot, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [path.join(scriptsDir, 'detect-style.mjs'), projectRoot, ...extraArgs],
    { encoding: 'utf8' },
  );
}

test('detect-style exits 1 when no document convention exists', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'api-style-cli-'));
  const result = runDetect(projectRoot);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /退出码：1/);
});

test('detect-style writes rules from --rules json', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'api-style-cli-'));
  const rulesPath = path.join(projectRoot, 'rules.json');
  fs.writeFileSync(
    rulesPath,
    JSON.stringify({
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
    }),
  );
  const result = runDetect(projectRoot, ['--rules', rulesPath]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /已保存至/);
  assert.equal(
    fs.existsSync(path.join(projectRoot, '.rico-skill/api-typescript-style.md')),
    true,
  );
});
