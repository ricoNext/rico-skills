#!/usr/bin/env node
import path from 'node:path';

import { getStylePath, readStyleDocument } from './lib/style-document.mjs';

function main() {
  const projectRoot = process.argv[2];
  if (!projectRoot || !path.isAbsolute(projectRoot)) {
    throw new Error('用法: validate-style.mjs <前端项目绝对路径>');
  }

  const stylePath = getStylePath(projectRoot);
  const rules = readStyleDocument(stylePath);
  console.log(JSON.stringify({ stylePath, rules }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`校验失败：${error.message}`);
  process.exit(1);
}
