---
name: api-typescript-style
description: >-
  检测、创建或校验前端项目的 API 与 TypeScript 代码生成规范，写入
  `.rico-skill/api-typescript-style.md`。
  在用户要求检测 API 规范、生成 TypeScript 代码风格文件、归纳接口生成规则，
  或 yapi-sync / backend-api-sync 发现规范文件缺失时使用。
  本 skill 只负责创建与校验规范文件；接口同步请用 yapi-sync 或
  backend-api-sync。
---

# API TypeScript 规范

为前端项目创建或校验统一的 API / TypeScript 代码生成规范文件。

将本 Skill 目录记为 `{baseDir}`，前端项目根目录记为 `{projectRoot}`。

## 输出位置

固定写入：

```text
{projectRoot}/.rico-skill/api-typescript-style.md
```

该文件可提交到仓库，供 **yapi-sync** 与 **backend-api-sync** 共同读取。

## CLI

```bash
node {baseDir}/scripts/detect-style.mjs {projectRoot}
node {baseDir}/scripts/detect-style.mjs {projectRoot} --infer
node {baseDir}/scripts/detect-style.mjs {projectRoot} --rules /tmp/style-rules.json
node {baseDir}/scripts/validate-style.mjs {projectRoot}
```

## 执行流程

1. **检查已有文件**
   - 文件存在：调用 `validate-style.mjs` 校验；通过则结束，不覆盖。
   - 文件损坏或「配置字段」无效：停止并报告错误，请用户修复后再继续。
2. **优先从项目文档提取**
   - 按顺序检查 `AGENTS.md`、`CLAUDE.md`、`CODEBUDDY.md`。
   - 查找包含 API / 接口 / 规范 / convention 等关键词的章节。
   - 找到可用说明后，写入规范文件，并保留原始章节内容。
3. **文档不足时由 Agent 补全**
   - 脚本退出码 `1` 时，检查现有 API / TypeScript 文件。
   - 常见目录：`src/api`、`src/services`、`lib/api`、`services`、`app/api`。
   - 归纳存放目录、请求客户端导入、响应包装、类型声明形式、类型存放方式、
     参数类型风格与命名习惯。
   - 将结果写成 JSON，执行 `--rules`；或直接执行 `--infer`。
4. **回复用户**
   - 给出写入路径、来源（文档 / 推断 / 显式规则）与需要人工确认的字段。

## 规范字段

脚本只解析文件末尾的「配置字段」列表，格式为：

```markdown
## 配置字段

- schema_version: `1`
- apiDir: `src/api`
- requestImport: `@/api`
```

空字符串写作一对空反引号。`schema_version` 必须是 `1`，字段如下：

| 字段 | 含义 | 允许值 |
| --- | --- | --- |
| `apiDir` | API 输出目录 | 项目内相对路径 |
| `requestImport` | 请求客户端模块路径 | 如 `@/api` |
| `requestIdentifier` | 请求函数名 | 如 `request` |
| `requestImportStyle` | 导入方式 | `default` / `named` |
| `responseMode` | 是否包装响应 | `wrapped` / `unwrapped` |
| `responseWrapper` | 包装类型 | 如 `Response<T>` |
| `typeStyle` | 类型声明形式 | `interface` / `type` |
| `typePlacement` | 类型存放方式 | `same-file` / `separate-file` |
| `typeDir` | 独立类型目录 | `separate-file` 时必填 |
| `paramStyle` | 请求参数类型风格 | `inline` / `separate` |
| `naming` | 函数命名 | `camelCase` / `snake_case` |
| `formatter` | 格式化命令 | 可空 |
| `typecheck` | 类型检查命令 | 可空 |

## 质量要求

- 文件已存在时不得覆盖。
- 不得静默回退到默认值来掩盖无效文件。
- 生成的 Markdown 必须可被 `validate-style.mjs` 解析。
- 只写可复用的生成规则，不复制大段业务代码。
- 本 skill 不生成业务 API 文件；那是 yapi-sync / backend-api-sync 的职责。

## 与其它 Skill 的关系

- **yapi-sync**：规范缺失时委托本 skill；自身只读取并生成 YApi API 代码。
- **backend-api-sync**：规范缺失时委托本 skill；自身只读取并生成后端源码对应的 API 代码。
