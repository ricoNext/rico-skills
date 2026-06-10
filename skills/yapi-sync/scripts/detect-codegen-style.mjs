import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 扫描目标目录
const SCAN_DIRS = ["src", "lib"];

async function findApiFiles(projectRoot) {
  const apiFiles = [];
  for (const dir of SCAN_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const apiPath = path.join(fullPath, "api");
      if (fs.existsSync(apiPath)) {
        const files = fs.readdirSync(apiPath);
        for (const file of files) {
          if (file.endsWith(".ts") || file.endsWith(".js")) {
            apiFiles.push(path.join(apiPath, file));
          }
        }
      }
    }
  }
  return apiFiles;
}

async function analyzeApiFiles(files) {
  if (files.length === 0) {
    return null;
  }

  const stats = {
    typeStyle: { inline: 0, separate: 0 },
    responseWrapper: {},
    naming: { camelCase: 0, snake_case: 0 },
    apiDir: null,
  };

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");

    // 检测存放位置
    const match = file.match(/\/(src|lib)\/api\//);
    if (match) {
      stats.apiDir = `${match[1]}/api`;
    }

    // 检测类型风格（参数中是否有内联类型定义）
    const inlineTypeRegex = /\(data:\s*\{[\s\S]*?\}\)/;
    const separateTypeRegex = /\(data:\s*\w+\)/;
    if (inlineTypeRegex.test(content)) {
      stats.typeStyle.inline++;
    } else if (separateTypeRegex.test(content)) {
      stats.typeStyle.separate++;
    }

    // 检测响应包装方式
    const responseRegex = /request<([^>]+)>/g;
    let responseMatch;
    while ((responseMatch = responseRegex.exec(content)) !== null) {
      let responseType = responseMatch[1].trim();
      // 提取顶层响应类型，忽略内层泛型参数复杂度
      responseType = responseType.split("<")[0];
      stats.responseWrapper[responseType] = (stats.responseWrapper[responseType] || 0) + 1;
    }

    // 检测命名规范
    const functionRegex = /export\s+const\s+(\w+)\s*=/g;
    let funcMatch;
    while ((funcMatch = functionRegex.exec(content)) !== null) {
      const funcName = funcMatch[1];
      if (/^[a-z]+([A-Z][a-z]+)*$/.test(funcName)) {
        stats.naming.camelCase++;
      } else if (/^[a-z_]+$/.test(funcName)) {
        stats.naming.snake_case++;
      }
    }
  }

  return stats;
}

function generateMarkdown(stats, projectRoot, scanTime) {
  const apiDir = stats.apiDir || "src/api";
  const typeStyle =
    stats.typeStyle.inline >= stats.typeStyle.separate ? "inline" : "separate";
  const responseWrappers = Object.entries(stats.responseWrapper)
    .sort(([, a], [, b]) => b - a)
    .map(([type]) => type);
  const mainWrapper =
    responseWrappers.length > 0 ? responseWrappers[0] : "Response<T>";
  const naming =
    stats.naming.camelCase >= stats.naming.snake_case ? "camelCase" : "snake_case";

  const confidence =
    (stats.typeStyle.inline + stats.naming.camelCase) /
    (stats.typeStyle.inline +
      stats.typeStyle.separate +
      stats.naming.camelCase +
      stats.naming.snake_case || 1);

  const typeStyleExamples =
    typeStyle === "inline"
      ? `\`\`\`typescript
export const getUser = (data: {
  /** 用户 ID */
  id: number;
}) => request<UserResponse>("/user/detail");
\`\`\``
      : `\`\`\`typescript
// user.ts
import { GetUserRequest, UserResponse } from "./types";

export const getUser = (data: GetUserRequest) =>
  request<UserResponse>("/user/detail", { data });
\`\`\``;

  return `# YApi 同步 - 代码生成规范

本文档由 \`detect-codegen-style.mjs\` 自动生成于 \`${projectRoot}\`。
您可以编辑本文档来自定义代码生成规范。

## 项目结构检测结果

**扫描时间**：${scanTime}
**扫描范围**：\`src/\`, \`lib/\`
**检测置信度**：${(confidence * 100).toFixed(0)}%

### API 存放位置

根据扫描的现有 API 文件，推断为：

\`\`\`
${apiDir}/{module}.ts
\`\`\`

---

### 类型定义风格

**推断风格**：${typeStyle === "inline" ? "内联类型定义" : "分离式类型定义"}

${typeStyle === "inline" ? "示例：" : "示例："}
${typeStyleExamples}

若要改变风格，编辑下方「[样本代码]」块，后续生成会采用新风格。

---

### 响应类型包装

**推断包装方式**：\`${mainWrapper}\`

现有响应类型分布：
${Object.entries(stats.responseWrapper)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 3)
  .map(([type, count]) => `- \`${type}\` (${count} 处)`)
  .join("\n")}

---

### 命名规范

| 项目 | 规范 |
|------|------|
| **函数命名** | ${naming === "camelCase" ? "camelCase（如 \`getUser\`、\`createProduct\`）" : "snake_case（如 \`get_user\`、\`create_product\`）"} |
| **文件命名** | 按路由模块（如 \`/user/*\` → \`user.ts\`） |
| **类型命名** | PascalCase（如 \`UserResponse\`、\`ProductList\`） |

---

## 手动调整

如需改变代码生成规范，编辑下方对应的「[样本代码]」块，保存后重新运行即可。

### 存放位置

[样本代码]
\`\`\`
${apiDir}/{module}.ts
\`\`\`

要改为其他位置（如 \`lib/api\`、\`services\`），编辑上方路径。

---

### 类型定义风格

[样本代码]

${typeStyleExamples}

---

### 响应类型包装

[样本代码]

\`\`\`typescript
// 若返回 { code: 0, data: T, message: string }
export const getUser = (data: ...) =>
  request<ApiResponse<User>>("/user/detail");
\`\`\`

---

## 检测日志

若需重新检测项目规范，运行：

\`\`\`bash
node skills/yapi-sync/scripts/detect-codegen-style.mjs <projectRoot> --update
\`\`\`

**检测的文件数**：${stats.typeStyle.inline + stats.typeStyle.separate}
**函数总数**：${stats.naming.camelCase + stats.naming.snake_case}
`;
}

async function detectStyle() {
  const projectRoot = process.argv[2] || process.cwd();
  const update = process.argv.includes("--update");

  console.log(`🔍 扫描项目代码规范...`);
  console.log(`   项目根目录：${projectRoot}`);

  const apiFiles = await findApiFiles(projectRoot);

  if (apiFiles.length === 0) {
    console.log(`⚠️  未检测到 API 文件，使用默认规范`);
    return;
  }

  console.log(`   找到 ${apiFiles.length} 个 API 文件`);

  const stats = await analyzeApiFiles(apiFiles);

  if (!stats) {
    console.log(`⚠️  无法分析 API 文件，使用默认规范`);
    return;
  }

  const now = new Date();
  const scanTime = now.toISOString().split("T")[0];
  const markdown = generateMarkdown(stats, projectRoot, scanTime);

  // 确保 .yapi-sync 目录存在
  const yapiSyncDir = path.join(projectRoot, ".yapi-sync");
  if (!fs.existsSync(yapiSyncDir)) {
    fs.mkdirSync(yapiSyncDir, { recursive: true });
  }

  const styleFile = path.join(yapiSyncDir, "api-style.md");
  fs.writeFileSync(styleFile, markdown, "utf-8");
  console.log(`✅ 规范检测完成，已保存至：`);
  console.log(`   ${styleFile}`);
  console.log(`\n📖 您可以编辑文件中的「[样本代码]」块来调整规范`);
}

detectStyle().catch((err) => {
  console.error("❌ 检测失败：", err.message);
  process.exit(1);
});
