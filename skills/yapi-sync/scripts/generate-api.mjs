import fs from 'node:fs';
import path from 'node:path';
import { generateApiCode } from './lib/generate-code.mjs';
import { parseCodegenStyle } from './lib/parse-codegen-style.mjs';

/**
 * 使用方式：
 * node generate-api.mjs <input-json-file> <project-root> [output-dir]
 */

const main = async () => {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`用法:
  node generate-api.mjs <input-json-file> <project-root> [output-dir]

参数:
  <input-json-file>  fetch-interface.mjs 的输出 JSON 文件
  <project-root>     项目根目录（读取 .rico-skill/api-typescript-style.md）
  [output-dir]       输出目录；默认使用规范中的 apiDir

示例:
  node generate-api.mjs interfaces.json /path/to/project
  node generate-api.mjs interfaces.json /path/to/project ./src/api`);
    process.exit(1);
  }

  const inputFile = args[0];
  const projectRoot = args[1];
  const outputDirArg = args[2];

  if (!fs.existsSync(inputFile)) {
    console.error(`输入文件不存在: ${inputFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(projectRoot)) {
    console.error(`项目根目录不存在: ${projectRoot}`);
    process.exit(1);
  }

  console.log(`读取接口定义: ${inputFile}`);
  const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const interfaces = inputData.results || [];

  if (interfaces.length === 0) {
    console.error('未找到可生成的接口');
    process.exit(1);
  }

  const styleFile = path.join(projectRoot, '.rico-skill', 'api-typescript-style.md');
  console.log(`读取代码规范: ${styleFile}`);
  const config = parseCodegenStyle(projectRoot);
  const outputDir = outputDirArg || path.join(projectRoot, config.apiDir);

  console.log('生成 API 代码...');
  const { files } = await generateApiCode(interfaces, projectRoot);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let fileCount = 0;
  for (const [moduleName, content] of Object.entries(files)) {
    const filePath = path.join(outputDir, `${moduleName}.ts`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`   ${moduleName}.ts`);
    fileCount += 1;
  }

  console.log('\n生成完成');
  console.log(`   文件数: ${fileCount}`);
  console.log(`   输出目录: ${path.resolve(outputDir)}`);
};

main().catch((error) => {
  console.error('生成失败:', error.message || error);
  process.exit(1);
});
