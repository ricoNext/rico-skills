import path from 'node:path';

import { ensureConfigTemplate } from './lib/config.mjs';

const projectRoot = process.argv[2];
if (!projectRoot || !path.isAbsolute(projectRoot)) {
  throw new Error('用法: ensure-config.mjs <前端项目绝对路径>');
}
console.log(JSON.stringify(ensureConfigTemplate(projectRoot), null, 2));
