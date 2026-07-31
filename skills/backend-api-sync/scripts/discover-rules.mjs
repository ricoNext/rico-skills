import path from 'node:path';

import { discoverRules } from './lib/rules.mjs';

const projectRoot = process.argv[2];
if (!projectRoot || !path.isAbsolute(projectRoot)) throw new Error('用法: discover-rules.mjs <前端项目绝对路径>');
console.log(JSON.stringify(discoverRules(projectRoot), null, 2));
