import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = path.dirname(path.dirname(skillRoot));

test('skill metadata is discoverable from repository indexes', () => {
  assert.match(fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8'), /^---\nname: backend-api-sync\ndescription: /);
  assert.match(fs.readFileSync(path.join(repositoryRoot, 'skills/catalog.yaml'), 'utf8'), /id: backend-api-sync/);
  assert.match(fs.readFileSync(path.join(repositoryRoot, '.claude-plugin/marketplace.json'), 'utf8'), /"\.\/skills\/backend-api-sync"/);
});
