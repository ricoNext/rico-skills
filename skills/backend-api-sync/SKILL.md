---
name: backend-api-sync
description: Use when a frontend project needs API functions and TypeScript types generated from Java Spring MVC Controller RequestMapping paths, including a controller route or a single endpoint route.
---

# 后端接口同步

根据调用者提供的接口路径，从已配置后端源码定位 Java Spring MVC Controller，生成符合当前前端项目规则的 API 函数与完整 TypeScript 类型。

将本 Skill 目录记为 `{baseDir}`，当前前端项目根目录记为 `{frontendRoot}`。

## 首次使用

先检查 `{frontendRoot}/.rico-skill/backend-api-sync.config`，**此步骤必须在安装依赖、扫描规则、解析路由或生成代码之前执行**。

配置不存在时，只执行下列命令：

```bash
node {baseDir}/scripts/ensure-config.mjs {frontendRoot}
```

然后告知用户已创建配置文件，要求其填写后端项目；**立即停止本次执行**。不得安装脚本依赖、修改 `.gitignore`、扫描项目规则、读取 Controller 或生成任何前端文件。

模板格式：

```json
{
  "projects": [],
  "rulePath": ""
}
```

要求用户将 `projects` 填写为一个或多个 `{ name, language, path }` 对象。`path` 必须是存在的绝对路径；首版 `language` 填 `java`。`rulePath` 由后续初始化自动生成，用户不需要填写。

配置文件存在但 `projects` 为空或不完整时，同样只引导用户补全并停止。

## 已配置项目

仅当配置已包含有效后端项目时，才安装脚本依赖（如果缺失）：

```bash
npm install --prefix {baseDir}/scripts
```

随后根据配置中的项目生成并回填 `rulePath`，脚本会将含本机绝对路径的配置文件加入 `.gitignore`，并优先从 `AGENTS.md`、`CLAUDE.md`、`CODEBUDDY.md` 或现有 API 代码发现规则；没有可用规范时才生成 `.rico-skill/backend-api-sync-rules.md`。规则文档可提交。

```bash
node {baseDir}/scripts/finalize-config.mjs {frontendRoot}
```

## 同步流程

1. 调用者只需要给出路由，例如 `/orders` 或 `/orders/{id}`，不要要求项目名。
2. 运行路由解析：

```bash
node {baseDir}/scripts/resolve-route.mjs --project-root {frontendRoot} --route '{route}'
```

唯一命中时继续。多个后端项目命中时，列出候选项目并要求调用者选择；无命中时报告检索项目，不生成代码。
3. 将所选候选项的 `contract` 保存为临时 JSON，然后预览：

```bash
node {baseDir}/scripts/generate-api.mjs --frontend-root {frontendRoot} --contract {contractJson}
```

默认只输出生成文件和内容，不写入文件。
4. 对预览中每个已存在的目标文件，询问用户选择“覆盖”或“跳过”。不得自动合并、覆盖或跳过。将决定保存为：

```json
{ "src/api/orders.ts": "overwrite" }
```

随后执行：

```bash
node {baseDir}/scripts/generate-api.mjs --frontend-root {frontendRoot} --contract {contractJson} --decisions {decisionsJson}
```

新文件可直接写入；已有文件只能在明确 `overwrite` 时写入，`skip` 保持原样。
5. 如果规则文档定义了格式化或类型检查命令，仅执行该规则明确指定的命令；未定义时报告跳过。不要修改后端源码。

## 解析范围

- 路由与参数通过 Java CST 解析，不用正则识别 Java 源码结构。
- Controller 类级 `@RequestMapping` 命中时同步该 Controller 全部接口；完整端点路径命中时仅同步该端点。
- 生成完整本地类型闭包，包括 DTO、嵌套 DTO、继承、枚举、集合、Map、Optional 与泛型容器。发现不能消解的本地类型时停止生成并报告引用链。
