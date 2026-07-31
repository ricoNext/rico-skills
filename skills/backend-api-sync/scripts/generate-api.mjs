import fs from 'node:fs';
import path from 'node:path';

import { renderApiFiles, writePreview } from './lib/typescript.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const frontendRoot = argument('--frontend-root');
const contractPath = argument('--contract');
const decisionsPath = argument('--decisions');
if (!frontendRoot || !contractPath || !path.isAbsolute(frontendRoot) || !path.isAbsolute(contractPath)) {
  throw new Error('用法: generate-api.mjs --frontend-root <绝对路径> --contract <绝对 json 路径> [--decisions <绝对 json 路径>]');
}
const preview = renderApiFiles(JSON.parse(fs.readFileSync(contractPath, 'utf8')), frontendRoot);
if (decisionsPath) writePreview(preview, JSON.parse(fs.readFileSync(decisionsPath, 'utf8')));
console.log(JSON.stringify({ ...preview, files: preview.files.map(({ content, ...file }) => ({ ...file, content })) }, null, 2));
