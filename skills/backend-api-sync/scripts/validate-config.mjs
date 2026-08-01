import path from 'node:path';

import { validateConfiguredProjects } from './lib/config.mjs';

const projectRoot = process.argv[2];
if (!projectRoot || !path.isAbsolute(projectRoot)) throw new Error('用法: validate-config.mjs <前端项目绝对路径>');
console.log(JSON.stringify(validateConfiguredProjects(projectRoot), null, 2));
