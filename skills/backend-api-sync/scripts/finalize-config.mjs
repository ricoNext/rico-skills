import path from 'node:path';

import { finalizeConfig } from './lib/config.mjs';

const projectRoot = process.argv[2];
if (!projectRoot || !path.isAbsolute(projectRoot)) throw new Error('用法: finalize-config.mjs <前端项目绝对路径>');
console.log(JSON.stringify(finalizeConfig(projectRoot), null, 2));
