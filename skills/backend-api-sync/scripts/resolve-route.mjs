import path from 'node:path';

import { resolveConfiguredRoute } from './lib/route-resolution.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const projectRoot = argument('--project-root');
const route = argument('--route');
if (!projectRoot || !route || !path.isAbsolute(projectRoot)) throw new Error('用法: resolve-route.mjs --project-root <绝对路径> --route <路径>');
console.log(JSON.stringify(resolveConfiguredRoute(projectRoot, route), null, 2));
