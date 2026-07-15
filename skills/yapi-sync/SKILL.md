---
name: yapi-sync
id: yapi-sync
description: 从 YApi 读取接口定义并生成/更新项目中的 API 和 TypeScript 类型，支持单个、批量及分类列表同步
---

# YApi 接口同步

从 YApi 平台读取接口定义，自动生成符合项目规范的 API 和 TypeScript 类型代码。支持单个接口、多个接口，以及**分类页面**（如 `cat_1686`）下全部接口的批量同步。

## CLI 准备

**重要**：Cookie 获取、接口拉取、代码生成、规范检测脚本位于 `{baseDir}/scripts/`。

所有脚本都支持在用户项目的 `.yapi-sync/` 目录中读写配置、Cookie 和规范文件。

**Agent 执行说明**：

1. 将本 SKILL.md 所在目录记为 `{baseDir}`
2. 将用户项目根目录记为 `{projectRoot}`
3. 若 `{baseDir}/scripts/node_modules` 不存在，执行 `npm install --prefix {baseDir}/scripts`（使用系统已安装的 Chrome/Edge，无需下载 Chromium）
4. `${FETCH_INTERFACE}` = `node {baseDir}/scripts/fetch-interface.mjs --project {projectRoot}`
5. `${RESOLVE_ONLY}` = `node {baseDir}/scripts/fetch-interface.mjs --resolve-only --project {projectRoot}`（仅展开分类，拉取接口 ID 列表，不获取详情）
6. `${DETECT_CODEGEN}` = `node {baseDir}/scripts/detect-codegen-style.mjs {projectRoot}`（扫描项目代码规范，生成 `{projectRoot}/.yapi-sync/api-style.md`）
7. `${GENERATE_API}` = `node {baseDir}/scripts/generate-api.mjs`（根据规范生成 API 代码）
8. 下文中的 `${FETCH_INTERFACE}`、`${RESOLVE_ONLY}`、`${DETECT_CODEGEN}`、`${GENERATE_API}` 均替换为上述命令

## 执行流程

### 0. 解析与验证 YApi 路径

#### 0.1 解析输入

支持多种输入格式：

**单个接口**：
```
https://yapi.example.com/project/{projectId}/interface/api/{interfaceId}
{interfaceId}
```

**多个接口（换行分隔）**：
```
https://yapi.example.com/project/{projectId}/interface/api/{interfaceId1}
https://yapi.example.com/project/{projectId}/interface/api/{interfaceId2}
https://yapi.example.com/project/{projectId}/interface/api/{interfaceId3}
```

**多个接口（逗号分隔）**：
```
https://yapi.example.com/project/{projectId}/interface/api/{interfaceId1}, https://yapi.example.com/project/{projectId}/interface/api/{interfaceId2}
{interfaceId1}, {interfaceId2}, {interfaceId3}
```

**多个接口（数组格式）**：
```
[{interfaceId1}, {interfaceId2}, {interfaceId3}]
["https://yapi.example.com/project/{projectId}/interface/api/{interfaceId1}", "https://yapi.example.com/project/{projectId}/interface/api/{interfaceId2}"]
```

**分类（接口列表页）**：

当用户提供的是 YApi **分类页面**而非单个接口时，应识别为分类输入并展开为接口列表：

```
https://yapi.example.com/project/{projectId}/interface/api/cat_{categoryId}
cat_{categoryId}
cat:{categoryId}
```

分类 URL 特征：路径中包含 `/interface/api/cat_{分类ID}`，**不是**普通接口 ID。

可与接口 ID/URL 混用，例如同时传入一个分类和两个单独接口。

#### 0.2 解析输入类型

对每条输入，按以下优先级解析（**分类必须先于纯数字接口匹配**）：

| 输入模式 | 类型 | 提取结果 |
|---------|------|---------|
| `.../interface/api/cat_{n}` | 分类 | `catId = n` |
| `cat_{n}` / `cat:{n}` | 分类 | `catId = n` |
| `.../interface/api/{n}` | 接口 | `interfaceId = n` |
| 纯数字 `{n}` | 接口 | `interfaceId = n` |

去重规则：同一分类或同一接口 ID 只处理一次。

**禁止**：将 `cat_{categoryId}` 当作接口 ID 处理。

#### 0.3 展开分类为接口列表

完成 Cookie 校验（步骤 1）后，对每个分类调用 YApi 接口：

```
GET {baseUrl}/api/interface/list_cat?catid={catId}&page={page}&limit=100
```

脚本 `${FETCH_INTERFACE}` / `${RESOLVE_ONLY}` 会自动分页，直到取完该分类下全部接口。

从响应 `data.list` 中提取每项的 `_id`（接口 ID）、`title`、`path`、`method`，合并到待同步队列。

**优先使用 `${RESOLVE_ONLY}` 预览**（步骤 0 输出用）：

```bash
${RESOLVE_ONLY} https://yapi.example.com/project/{projectId}/interface/api/cat_{categoryId}
```

输出示例：

```json
{
  "total": 6,
  "categories": [
    {
      "catId": {categoryId},
      "count": 6,
      "interfaces": [
        { "id": {interfaceId}, "title": "根据deviceName获取语音类型", "path": "/platform/v1/trace/voice/type", "method": "POST" }
      ]
    }
  ],
  "interfaces": [ ... ]
}
```

#### 0.4 验证结果

- **无有效输入**（既无接口 ID 也无分类 ID）→ 抛出错误并退出
- **分类展开后接口数为 0** → 提示该分类下没有接口，退出
- **有有效接口** → 继续执行步骤 1.1

**输出接口列表**（告知用户即将同步的内容）：

```
检测到分类「示例分类」(cat_{categoryId})，共 6 个接口需要同步：
- {interfaceId1}: 接口1说明
- {interfaceId2}: 接口2说明
- {interfaceId3}: 接口3说明
- {interfaceId4}: 接口4说明
- {interfaceId5}: 接口5说明
- {interfaceId6}: 接口6说明
```

若同时包含直接指定的接口与分类展开的接口，合并去重后统一输出。

### 1. Cookie 配置与验证

#### 1.1 检查配置文件、Cookie 文件与代码规范

读取 `{projectRoot}/.yapi-sync/config.json` 和 `{projectRoot}/.yapi-sync/cookie.json`：
- **配置文件不存在** → 创建默认配置文件，执行步骤 1.1.5
- **Cookie 文件不存在或 cookie 为空** → 执行步骤 1.2
- **Cookie 已配置** → 验证 cookie 有效性，无效则执行步骤 1.2，有效则继续执行步骤 2.1
- **`cookieGitignoreUpdated` 为 `false`** → 自动将 `.yapi-sync/cookie.json` 添加到 `{projectRoot}/.gitignore`，然后把该字段更新为 `true`

配置文件格式：
```json
{
	"baseUrl": "https://yapi.example.com",
	"cookieGitignoreUpdated": true
}
```

Cookie 文件格式：
```json
{
	"cookie": "yapi的cookie值"
}
```

`config.json` 可提交到仓库；`cookie.json` 保存本地鉴权信息，不应提交。

#### 1.1.5 首次运行：自动检测代码规范

若用户项目中不存在 `{projectRoot}/.yapi-sync/api-style.md`，执行：

```bash
${DETECT_CODEGEN} = node {baseDir}/scripts/detect-codegen-style.mjs {projectRoot}
```

**脚本检测流程（优先级从高到低）**：

1. **尝试从项目文档提取规范**
   - 检查 `AGENTS.md` / `CLAUDE.md` / `CODEBUDDY.md`
   - 查找包含 API 规范的章节（关键词：API、接口、规范、convention 等）
   - 提取规范说明并生成 `api-style.md`

2. **文档中无规范时，脚本返回退出码 1**
   - Agent 需要**自己分析项目代码**
   - 检查项目中现有 API 文件（可能在 `src/api`、`lib/api`、`services`、`app/api` 等目录）
   - 分析现有代码的风格（命名、类型定义、响应包装等）
   - **手动创建** `{projectRoot}/.yapi-sync/api-style.md` 文件

**路径 A：从文档提取成功（退出码 0）**

示例输出：
```
🔍 检测项目 API 代码规范...
   项目根目录：/path/to/project

📄 检查项目文档...
   - 发现 CLAUDE.md
   ✅ 从 CLAUDE.md 中找到 API 规范（章节：API 接口规范）

📝 生成代码规范文件...
   ✅ 已保存至：/path/to/project/.yapi-sync/api-style.md

📖 请检查生成的文件，必要时编辑「[样本代码]」块来调整规范。
```

生成的 `api-style.md` 包含：
- 从文档提取的原始规范说明
- 可编辑的「[样本代码]」块（存放位置、类型风格、响应包装、命名规范）
- Agent 补充说明（如果原始规范不够明确，需要检查现有代码）

**路径 B：文档中无规范（退出码 1，需要 Agent 介入）**

示例输出：
```
🔍 检测项目 API 代码规范...
   项目根目录：/path/to/project

📄 检查项目文档...
   ⚠️  未在文档中找到 API 规范说明

⚙️  退出码：1（需要 Agent 分析项目代码）

提示：Agent 应该：
  1. 检查项目中现有的 API 文件（可能在 src/api、lib/api、services 等目录）
  2. 分析现有代码的风格（命名、类型定义、响应包装等）
  3. 手动创建 .yapi-sync/api-style.md 文件

或者在 AGENTS.md / CLAUDE.md / CODEBUDDY.md 中添加 API 规范章节，再重新运行本脚本。
```

**Agent 处理退出码 1 的步骤**：

1. 检查用户项目中是否有现有 API 文件：
   - 用 `find {projectRoot} -type f \( -name "*.ts" -o -name "*.js" \) | grep -E "(api|service)" | head -10`
   - 或问用户："你的项目 API 文件通常放在哪里？"

2. 如果找到现有文件，读取 2-3 个样本文件，分析：
   - API 存放目录（如 `src/api`、`services`、`app/api`）
   - 类型定义风格（内联 vs 独立 types 文件）
   - 响应包装方式（`Response<T>`、`ApiResponse<T>` 等）
   - 命名规范（camelCase vs snake_case）
   - 使用的请求库（axios / fetch / 自定义 request）

3. 如果项目无现有 API 文件：
   - 询问用户偏好的代码规范
   - 或使用默认规范（`src/api`、内联类型、camelCase）

4. 手动创建 `{projectRoot}/.yapi-sync/api-style.md` 文件，填写分析出的规范

**文件位置**（用户项目中）：
```
project/
├── .yapi-sync/
│   ├── config.json           # YApi 基础配置，可提交
│   ├── cookie.json           # Cookie 本地文件，不提交
│   └── api-style.md          # 从文档提取或 Agent 手动创建
├── src/
│   └── api/                  # 现有 API 文件（如果有）
└── CLAUDE.md                 # 可选：包含 API 规范章节
```

**用户可以**：
- 在项目文档（`AGENTS.md` / `CLAUDE.md` / `CODEBUDDY.md`）中添加 API 规范章节，脚本会自动提取
- 直接编辑 `.yapi-sync/api-style.md` 中的「[样本代码]」块来调整规范
- 删除该文件后重新运行脚本以重新检测

#### 1.2 获取 Cookie（手动方式）

当 cookie 未配置或失效时，直接提示用户手动提供 Cookie：

```
YApi Cookie 未配置或已失效，请手动获取 Cookie 并写入 Cookie 文件。
  1. 在浏览器中访问 {baseUrl} 并登录
  2. 打开开发者工具 (F12) > Application > Cookies
  3. 复制 _yapi_token 和 _yapi_uid 的值，格式：_yapi_token=xxx; _yapi_uid=xxx
  4. 写入 .yapi-sync/cookie.json 的 cookie 字段
```

**步骤 1**: 引导用户获取 Cookie

提示用户：
```
请按以下步骤获取 Cookie：
1. 访问 {baseUrl}（从 config.json 中读取）
2. 使用账号登录
3. 打开浏览器开发者工具 (F12 或右键 > 检查)
4. 切换到「Application」或「Storage」标签
5. 在 Cookies 中查找 _yapi_token 和 _yapi_uid
6. 复制整个 Cookie 字符串（Cookie: 后面的内容）
```

**步骤 2**: 使用 `ask_user_question` 显示表单，让用户粘贴 Cookie：

```typescript
ask_user_question({
  questions: [{
    header: "YApi Cookie",
    multiSelect: false,
    options: [
      { label: "已复制，继续", description: "我已获取 Cookie，准备粘贴" }
    ],
    question: "请将 Cookie 粘贴到下方（包含 _yapi_token 和 _yapi_uid）："
  }]
})
```

**步骤 3**: 接收用户输入的 Cookie，验证包含必要字段（`_yapi_token` 和 `_yapi_uid`）

- **验证失败** → 提示格式错误，重新要求粘贴
- **验证成功** → 写入 `{projectRoot}/.yapi-sync/cookie.json`，并确保 `.gitignore` 已包含 `.yapi-sync/cookie.json`

**步骤 4**: 继续执行步骤 2.1

### 2. 批量获取接口详情

#### 2.1 批量请求 YApi 接口

优先使用 `${FETCH_INTERFACE}` 批量拉取接口详情。该脚本会：
- 自动识别分类 URL，先调用 `list_cat` 展开为接口 ID 列表
- 再逐个调用 `interface/get` 获取完整接口定义
- 在请求前自动校验 cookie（分类输入用 `list_cat` 探测，接口输入用 `interface/get` 探测）
- 遇到 `errcode=40011` 或「请登录」类错误时，抛出 `YAPI_AUTH_REQUIRED` 错误，提示用户手动更新 Cookie
- 输出 JSON 结果，包含 `resolved`（展开信息）及每个接口的 `data` 或失败原因

也可手动请求：

```
GET {baseUrl}/api/interface/get?id={interfaceId}
```

判断响应状态：
- **cookie 失效** (`errcode=40011` / `请登录`) → 执行步骤 1.2，提示用户手动提供 Cookie
- **请求成功** → 解析接口信息，加入处理队列
- **请求失败** → 记录失败原因，继续处理下一个

#### 2.2 提取接口信息

从 YApi 响应中提取接口信息：

| 字段 | 来源 | 说明 |
|------|------|------|
| 标题 | `data.title` | 接口标题 |
| 路径 | `data.path` | 接口路径 |
| 方法 | `data.method` | 请求方法 (GET/POST 等) |
| 请求参数 | `data.req_body_other` | 解析 JSON Schema，包含字段名、类型、说明 |
| 响应字段 | `data.res_body` | 解析 JSON Schema，包含字段名、类型、说明 |
| 项目 ID | `data.project_id` | 所属项目 ID |

响应示例：
```json
{
	"errcode": 0,
	"data": {
		"title": "后台用户列表",
		"path": "/v1/mis-user/getBgFullList",
		"method": "POST",
		"req_body_type": "json",
		"req_body_other": "{...schema...}",
		"res_body_type": "json",
		"res_body": "{...schema...}",
		"project_id": 112
	}
}
```

### 3. 检查接口是否存在及覆盖策略

#### 3.1 检查已存在接口

根据 **路径 path** 和 **方法 method** 在项目中查询是否存在接口定义。

查询方式（参考 `./reference/api-definition.md`）：
1. 在 `src/api/` 目录下搜索包含该路径的文件
2. 检查对应的请求方法是否匹配
3. 使用 `search_file_content` 搜索路径字符串

统计结果：
- 新增接口数量
- 已存在接口数量（需覆盖）

#### 3.2 确定覆盖策略

根据已存在接口数量，选择覆盖策略：

**全部新增** → 直接执行步骤 4.1

**存在已定义接口** → 使用 `ask_user_question` 询问覆盖策略：

```typescript
ask_user_question({
  questions: [{
    header: "覆盖策略",
    multiSelect: false,
    options: [
      { label: "全部覆盖", description: "覆盖所有已存在的接口定义" },
      { label: "仅新增", description: "跳过已存在的接口，只添加新接口" },
      { label: "逐个确认", description: "每个已存在的接口单独确认是否覆盖" },
      { label: "取消", description: "取消本次批量操作" }
    ],
    question: "检测到 3 个接口已存在，请选择处理方式："
  }]
})
```

- **全部覆盖** → 执行步骤 4.1，覆盖所有接口
- **仅新增** → 执行步骤 4.1，跳过已存在接口
- **逐个确认** → 执行步骤 3.3，逐个询问
- **取消** → 退出本次操作

#### 3.3 逐个确认（可选）

当用户选择「逐个确认」时，对每个已存在的接口单独询问：

```typescript
ask_user_question({
  questions: [{
    header: "接口覆盖",
    multiSelect: false,
    options: [
      { label: "覆盖", description: "覆盖该接口定义" },
      { label: "跳过", description: "保留现有定义" },
      { label: "全部覆盖", description: "覆盖剩余所有已存在接口" },
      { label: "全部跳过", description: "跳过剩余所有已存在接口" }
    ],
    question: "接口「后台用户列表」已存在，是否覆盖？"
  }]
})
```

#### 4.0 应用检测到的代码规范

在代码生成前，系统自动读取用户项目中的 `{projectRoot}/.yapi-sync/api-style.md`，提取用户定义的规范：

- **API 存放位置**：从文件中的「[样本代码]」块读取目录（默认 `src/api/`）
- **类型定义风格**：内联 vs 分离式
- **响应包装方式**：`Response<T>`、`ApiResponse<T>` 等
- **命名规范**：camelCase vs snake_case

若用户项目中不存在规范文件，首先执行步骤 1.1.5 自动检测。

#### 4.1 按 API 定义规范生成代码

遍历接口列表，为每个接口生成代码。

**示例输出** (基于检测到的规范)：

**API 文件** (`src/api/{module}.ts`)：
```typescript
import request from "@/api";

/**
 * {接口标题}
 * https://yapi.iotbull.com/project/{projectId}/interface/api/{interfaceId}
 */
export const getXxx = (data: {
	/** 字段说明 */
	fieldName: string;
}) =>
	request<TXxxResponse>("/v1/xxx/xxx", { data });
```

**生成流程**：
1. 读取 `detected-api-style.md` 中的规范配置
2. 从接口路径推断模块名（如 `/user/detail` → `user.ts`）
3. 根据规范生成函数名、参数类型、返回类型
4. 生成函数代码并按模块合并

**关键规范** (可在 Markdown 中调整)：
1. **入参类型**：根据 `typeStyle` 选择内联或分离定义
2. **返回类型**：根据 `responseWrapper` 应用包装方式
3. **命名**：根据 `naming` 选择 camelCase 或 snake_case
4. **注释**：包含接口说明和 YApi 地址（两行）

**类型转换规则**：

| YApi 类型 | TypeScript 类型 |
|-----------|----------------|
| string | string |
| integer | number |
| number | number |
| boolean | boolean |
| array | T[] |
| object | Record<string, any> |

#### 4.2 文件组织策略

- **同模块接口**：合并到同一个 API 文件中
- **新增文件**：根据接口路径推断模块名，创建新文件
- **导入整理**：自动整理 import 语句，去除未使用的导入

#### 4.3 生成代码的工作流（Agent 执行）

**步骤 1**：拉取接口详情

```bash
${FETCH_INTERFACE} {interfaceIds} > interfaces.json
```

输出包含所有接口的完整定义和元数据。

**步骤 2**：生成 API 代码

```bash
node {baseDir}/scripts/generate-api.mjs interfaces.json {projectRoot} {outputDir}
```

脚本会：
- 读取 `{projectRoot}/.yapi-sync/api-style.md` 中的规范
- 根据规范生成 API 函数
- 按模块写入 `{outputDir}` 中的 `.ts` 文件

**步骤 3**：代码质量检查（由 Agent 执行）

在项目中运行代码检查工具：
```bash
# TypeScript 检查
tsc --noEmit

# 格式和 lint 检查
biome check {outputDir}
```

若有错误，自动修复或提示用户手动处理。

### 5. 代码质量检查

批量接口定义后，统一检查代码质量：

1. **Biome 检查**：运行 `pnpm biome check` 确保无格式和 lint 错误
2. **TypeScript 检查**：确保无类型错误
3. 如有报错，自动修复或提示用户手动处理

### 6. 输出处理结果

生成处理结果汇总：

```
✅ 批量同步完成

📊 处理统计：
- 总计：5 个接口
- 新增：3 个
- 更新：2 个
- 跳过：0 个
- 失败：0 个

📝 变更文件：
- src/api/user.ts (+3, ~2)
- src/api/account.ts (+1)

⚠️ 注意事项：
- 接口「用户详情」的响应类型较为复杂，建议手动检查
- 接口「创建用户」包含枚举字段，请确认枚举值
```

## 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| 无有效 YApi 路径 | 抛出错误并退出 |
| 分类 ID 无效或无权访问 | 记录失败原因，若仅含该分类则退出 |
| 分类下无接口 | 提示后退出 |
| Cookie 未配置/失效 | 提示用户手动获取 Cookie 并写入 `.yapi-sync/cookie.json` |
| 自动登录失败 | 根据原因提示：凭证错误/MFA 要求/表单变更/网络问题，建议手动获取 Cookie |
| 单个接口请求失败 | 记录失败，继续处理其他接口 |
| 类型冲突 | 提示用户选择处理方式 |
| Biome/TS 报错 | 自动修复或提示手动处理 |

## 示例

**示例 1：单个接口同步**

**输入**：
```
同步接口 https://yapi.example.com/project/{projectId}/interface/api/{interfaceId}
```

**执行过程**：
1. 解析得到接口 ID: {interfaceId}
2. 检查 cookie 配置
3. 请求接口详情
4. 检查接口是否存在
5. 生成/更新 API 定义
6. 运行代码质量检查

**输出**：
- 更新 `src/api/user.ts`，添加接口函数

---

**示例 2：批量接口同步**

**输入**：
```
同步以下接口：
https://yapi.example.com/project/{projectId}/interface/api/{interfaceId1}
https://yapi.example.com/project/{projectId}/interface/api/{interfaceId2}
{interfaceId3}, {interfaceId4}
```

**执行过程**：
1. 解析得到 4 个接口 ID
2. 检查 cookie 配置
3. 批量请求接口详情
4. 检测到 2 个接口已存在
5. 用户选择「全部覆盖」
6. 批量生成 API 定义
7. 运行代码质量检查
8. 输出处理结果汇总

**输出**：
- 更新 `src/api/user.ts`，添加 4 个接口函数
- 代码通过 Biome 和 TypeScript 检查

---

**示例 3：分类页面批量同步**

**输入**：
```
同步分类 https://yapi.example.com/project/{projectId}/interface/api/cat_{categoryId}
```

**执行过程**：
1. 解析得到分类 ID: {categoryId}（**不是**接口 {categoryId}）
2. 检查 cookie 配置
3. 调用 `list_cat` 展开分类，得到 6 个接口 ID
4. 输出待同步接口列表，供用户确认
5. 批量请求 6 个接口详情
6. 检查项目中是否已存在，询问覆盖策略
7. 生成 API 定义并运行代码质量检查

**输出**：
- 新建或更新 `src/api/trace.ts`（按路径推断模块名），添加 6 个接口函数

## 注意事项

- YApi 的 JSON Schema 可能不完整，需要人工确认
- 枚举类型需要手动完善
- 复杂嵌套结构建议生成后检查
- 分页响应统一使用 `Response.PageData<T>` 包装
- 批量处理时，建议先用少量接口测试，确认无误后再大批量同步
- 分类 URL 与接口 URL 可混用；`cat_{id}` 与 `/interface/api/cat_{id}` 等价
- 大分类接口较多时，可先用 `${RESOLVE_ONLY}` 预览数量，再执行完整同步
