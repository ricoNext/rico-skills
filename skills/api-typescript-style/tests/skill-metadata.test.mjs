import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = path.dirname(path.dirname(skillRoot));

test('skill metadata is discoverable from repository indexes', () => {
  assert.match(
    fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8'),
    /^---\nname: api-typescript-style\ndescription: /,
  );
  assert.match(
    fs.readFileSync(path.join(repositoryRoot, 'skills/catalog.yaml'), 'utf8'),
    /id: api-typescript-style/,
  );
  assert.match(
    fs.readFileSync(
      path.join(repositoryRoot, '.claude-plugin/marketplace.json'),
      'utf8',
    ),
    /"\.\/skills\/api-typescript-style"/,
  );
});
