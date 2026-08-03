import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 尝试从项目文档中提取 API 代码规范
 * 优先级：AGENTS.md > CLAUDE.md > CODEBUDDY.md
 *
 * 如果文档中没有规范，返回状态码让 agent 自己分析项目
 */

const DOC_FILES = ['AGENTS.md', 'CLAUDE.md', 'CODEBUDDY.md'];

/**
 * 从文档中提取 API 规范章节
 * 查找包含关键词的章节：API、接口、规范、Style、Convention 等
 */
function extractApiStyleFromDoc(content, filename) {
  // 查找可能包含 API 规范的章节
  const sections = [];
  const lines = content.split('\n');

  let currentSection = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测章节标题（## 或 ###）
    const headerMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headerMatch) {
      // 保存上一个章节
      if (currentSection && currentContent.length > 0) {
        sections.push({
          title: currentSection,
          content: currentContent.join('\n')
        });
      }

      // 开始新章节
      currentSection = headerMatch[2].trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // 保存最后一个章节
  if (currentSection && currentContent.length > 0) {
    sections.push({
      title: currentSection,
      content: currentContent.join('\n')
    });
  }

  // 查找 API 相关章节（关键词匹配）
  const apiKeywords = [
    /api/i,
    /接口/,
    /代码规范/,
    /coding\s+style/i,
    /convention/i,
    /生成规范/,
    /codegen/i
  ];

  for (const section of sections) {
    const titleLower = section.title.toLowerCase();
    const matchesKeyword = apiKeywords.some(regex => regex.test(section.title));

    if (matchesKeyword) {
      // 检查内容是否包含实际的规范描述
      const hasApiInfo =
        /request|axios|fetch/i.test(section.content) ||
        /camelCase|snake_case/i.test(section.content) ||
        /src\/api|lib\/api|services/i.test(section.content) ||
        /Response|ApiResponse/i.test(section.content);

      if (hasApiInfo) {
        return {
          source: filename,
          section: section.title,
          content: section.content.trim()
        };
      }
    }
  }

  return null;
}

/**
 * 将提取的规范转换为 api-typescript-style.md 格式
 */
function generateStyleMarkdown(extracted, projectRoot) {
  const now = new Date().toISOString().split('T')[0];

  return `# YApi 同步 - 代码生成规范

本文档从 \`${extracted.source}\` 中提取，章节：「${extracted.section}」。
提取时间：${now}

您可以编辑本文档来调整代码生成规范。

---

## 原始规范说明

${extracted.content}

---

## 规范摘要（供代码生成使用）

**注意**：如果上方原始规范不够明确，请编辑下方的「[样本代码]」块来精确指定生成规范。

### 存放位置

[样本代码]
\`\`\`
src/api/{module}.ts
\`\`\`

如需改为其他位置（如 \`lib/api\`、\`services\`、\`app/api\`），请编辑上方路径。

---

### 类型定义风格

[样本代码]

\`\`\`typescript
// 内联风格示例（参数类型直接写在函数签名中）
export const getUser = (data: {
  /** 用户 ID */
  id: number;
}) => request<UserResponse>("/user/detail");
\`\`\`

若采用分离式类型定义（独立 types 文件），请修改为：

\`\`\`typescript
// 分离式风格示例
import { GetUserRequest, UserResponse } from "./types";

export const getUser = (data: GetUserRequest) =>
  request<UserResponse>("/user/detail", { data });
\`\`\`

---

### 响应类型包装

[样本代码]

\`\`\`typescript
// 若返回 { code: 0, data: T, message: string }
export const getUser = (data: ...) =>
  request<ApiResponse<User>>("/user/detail");
\`\`\`

常见包装类型：
- \`Response<T>\`
- \`ApiResponse<T>\`
- \`Result<T>\`
- 直接返回数据类型（无包装）

---

### 命名规范

| 项目 | 规范 |
|------|------|
| **函数命名** | camelCase（如 \`getUser\`、\`createProduct\`） |
| **文件命名** | 按路由模块（如 \`/user/*\` → \`user.ts\`） |
| **类型命名** | PascalCase（如 \`UserResponse\`、\`ProductList\`） |

若采用 snake_case，请编辑上表。

---

## 需要 Agent 补充的信息

如果从文档中提取的规范不够明确，Agent 需要：

1. 检查项目现有 API 文件（若有），确认实际使用的：
   - 存放目录
   - 请求库（axios / fetch / 自定义 request）
   - 类型定义方式
   - 响应包装方式

2. 基于发现的模式，编辑上方「[样本代码]」块，使其与项目一致。

3. 如果项目没有现有 API 文件，按上方默认规范生成即可。
`;
}

async function detectStyle() {
  const projectRoot = process.argv[2] || process.cwd();
  const ricoSkillDir = path.join(projectRoot, ".rico-skill");
  const styleFile = path.join(ricoSkillDir, "api-typescript-style.md");

  console.log(`🔍 检测项目 API 代码规范...`);
  console.log(`   项目根目录：${projectRoot}`);
  console.log();

  if (fs.existsSync(styleFile)) {
    console.log(`   ✅ 使用已有代码规范文件：${styleFile}`);
    return;
  }

  // 第一步：尝试从文档中提取规范
  console.log(`📄 检查项目文档...`);

  let extracted = null;
  for (const docFile of DOC_FILES) {
    const docPath = path.join(projectRoot, docFile);

    if (fs.existsSync(docPath)) {
      console.log(`   - 发现 ${docFile}`);
      const content = fs.readFileSync(docPath, 'utf-8');
      extracted = extractApiStyleFromDoc(content, docFile);

      if (extracted) {
        console.log(`   ✅ 从 ${docFile} 中找到 API 规范（章节：${extracted.section}）`);
        break;
      }
    }
  }

  if (!extracted) {
    console.log(`   ⚠️  未在文档中找到 API 规范说明`);
    console.log();
    console.log(`⚙️  退出码：1（需要 Agent 分析项目代码）`);
    console.log();
    console.log(`提示：Agent 应该：`);
    console.log(`  1. 检查项目中现有的 API 文件（可能在 src/api、lib/api、services 等目录）`);
    console.log(`  2. 分析现有代码的风格（命名、类型定义、响应包装等）`);
    console.log(`  3. 手动创建 .rico-skill/api-typescript-style.md 文件`);
    console.log();
    console.log(`或者在 ${DOC_FILES.join(' / ')} 中添加 API 规范章节，再重新运行本脚本。`);
    process.exit(1);
  }

  // 第二步：生成 api-typescript-style.md
  console.log();
  console.log(`📝 生成代码规范文件...`);

  if (!fs.existsSync(ricoSkillDir)) {
    fs.mkdirSync(ricoSkillDir, { recursive: true });
  }

  const markdown = generateStyleMarkdown(extracted, projectRoot);
  fs.writeFileSync(styleFile, markdown, 'utf-8');

  console.log(`   ✅ 已保存至：${styleFile}`);
  console.log();
  console.log(`📖 请检查生成的文件，必要时编辑「[样本代码]」块来调整规范。`);
  console.log(`   如果原始规范不够明确，Agent 需要检查项目现有代码并补充。`);
}

detectStyle().catch((err) => {
  console.error('❌ 检测失败：', err.message);
  process.exit(1);
});
