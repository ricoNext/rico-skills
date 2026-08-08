#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  DOC_FILES,
  ensureStyleDocument,
  getStylePath,
} from './lib/style-document.mjs';

function printUsage() {
  console.log(`用法:
  node detect-style.mjs <project-root> [--infer] [--rules <json-file>]

说明:
  检测并创建 {projectRoot}/.rico-skill/api-typescript-style.md。
  文件已存在时只校验，不覆盖。

选项:
  --infer           文档中无规范时，根据现有 API/TS 源码推断并写入
  --rules <file>    使用指定 JSON 规则文件写入（供 Agent 分析后调用）
`);
}

function parseArgs(argv) {
  const args = {
    projectRoot: null,
    infer: false,
    rulesPath: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--infer') {
      args.infer = true;
      continue;
    }
    if (item === '--rules') {
      args.rulesPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (item === '--help' || item === '-h') {
      printUsage();
      process.exit(0);
    }
    if (!args.projectRoot) {
      args.projectRoot = item;
      continue;
    }
    throw new Error(`未知参数: ${item}`);
  }

  if (!args.projectRoot || !path.isAbsolute(args.projectRoot)) {
    throw new Error('请提供前端项目绝对路径');
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const stylePath = getStylePath(args.projectRoot);

  console.log('检测项目 API 代码规范...');
  console.log(`   项目根目录：${args.projectRoot}`);
  console.log(`   规范文件：${stylePath}`);
  console.log();

  let rules;
  if (args.rulesPath) {
    rules = JSON.parse(fs.readFileSync(args.rulesPath, 'utf8'));
  }

  const result = ensureStyleDocument(args.projectRoot, {
    infer: args.infer,
    rules,
  });

  if (result.status === 'exists') {
    console.log(`   使用已有代码规范文件：${result.stylePath}`);
    console.log('   校验通过');
    return;
  }

  if (result.status === 'created') {
    console.log(`   已保存至：${result.stylePath}`);
    console.log(`   来源：${result.source}`);
    if (result.extracted) {
      console.log(
        `   文档章节：${result.extracted.source} / ${result.extracted.section}`,
      );
    }
    console.log();
    console.log('请检查生成的文件，必要时编辑「配置字段」列表。');
    return;
  }

  console.log('   未在文档中找到 API 规范说明');
  console.log();
  console.log('退出码：1（需要 Agent 分析项目代码）');
  console.log();
  console.log('提示：Agent 应该：');
  console.log(
    '  1. 检查项目中现有的 API 文件（可能在 src/api、lib/api、services 等目录）',
  );
  console.log('  2. 分析现有代码的风格（命名、类型定义、响应包装等）');
  console.log(
    '  3. 将推断结果写成 JSON，再执行：',
  );
  console.log(
    `     node detect-style.mjs ${args.projectRoot} --rules /tmp/style-rules.json`,
  );
  console.log('  或直接：');
  console.log(`     node detect-style.mjs ${args.projectRoot} --infer`);
  console.log();
  console.log(
    `也可以在 ${DOC_FILES.join(' / ')} 中添加 API 规范章节后重跑本脚本。`,
  );
  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`检测失败：${error.message}`);
  process.exit(1);
}
