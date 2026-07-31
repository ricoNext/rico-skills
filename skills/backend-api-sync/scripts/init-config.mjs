import path from 'node:path';

import { initializeConfig } from './lib/config.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const projectRoot = argument('--project-root');
const projects = argument('--projects');
if (!projectRoot || !projects || !path.isAbsolute(projectRoot)) {
  throw new Error('用法: init-config.mjs --project-root <绝对路径> --projects <json-array>');
}
console.log(JSON.stringify(initializeConfig(projectRoot, JSON.parse(projects)), null, 2));
