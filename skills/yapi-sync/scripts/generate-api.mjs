import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateApiCode } from "./lib/generate-code.mjs";
import { skillDir } from "./lib/config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 使用方式：
 * node generate-api.mjs <input-json-file> [output-dir]
 *
 * 其中 input-json-file 是 fetch-interface.mjs 的输出 JSON
 * output-dir 默认为 ./generated-api
 */

const main = async () => {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`用法:
  node generate-api.mjs <input-json-file> [output-dir]

参数:
  <input-json-file>  fetch-interface.mjs 的输出 JSON 文件
  [output-dir]       生成代码的输出目录（默认: ./generated-api）

示例:
  node generate-api.mjs interfaces.json
  node generate-api.mjs interfaces.json ./src/api`);
    process.exit(1);
  }

  const inputFile = args[0];
  const outputDir = args[1] || "./generated-api";

  // 读取输入 JSON
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ 输入文件不存在: ${inputFile}`);
    process.exit(1);
  }

  console.log(`📖 读取接口定义: ${inputFile}`);
  const inputData = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
  const interfaces = inputData.results || [];

  if (interfaces.length === 0) {
    console.error("❌ 未找到可生成的接口");
    process.exit(1);
  }

  console.log(`🔍 检测代码规范...`);
  const styleFile = path.join(skillDir, "reference/detected-api-style.md");
  if (!fs.existsSync(styleFile)) {
    console.warn(`⚠️  未检测到代码规范文件: ${styleFile}`);
    console.log(`   请先运行: node detect-codegen-style.mjs <projectRoot>`);
  }

  console.log(`✨ 生成 API 代码...`);
  const generated = await generateApiCode(interfaces);

  // 创建输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 写入生成的文件
  let fileCount = 0;
  for (const [moduleName, content] of Object.entries(generated)) {
    const filePath = path.join(outputDir, `${moduleName}.ts`);
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`   ✅ ${moduleName}.ts`);
    fileCount++;
  }

  console.log(`\n✅ 生成完成`);
  console.log(`   文件数: ${fileCount}`);
  console.log(`   输出目录: ${path.resolve(outputDir)}`);
};

main().catch((error) => {
  console.error("❌ 生成失败:", error.message || error);
  process.exit(1);
});
