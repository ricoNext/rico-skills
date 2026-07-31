import path from 'node:path';

import { parseJavaSpring } from './lib/java-cst.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const backendRoot = argument('--backend-root');
const route = argument('--route');
if (!backendRoot || !route || !path.isAbsolute(backendRoot)) throw new Error('用法: parse-java-spring.mjs --backend-root <绝对路径> --route <路径>');
const contract = parseJavaSpring(backendRoot, route);
if (contract.matches.length === 0) {
  console.error(`未在 ${backendRoot} 中找到路由: ${route}`);
  process.exitCode = 2;
} else {
  console.log(JSON.stringify(contract, null, 2));
}
