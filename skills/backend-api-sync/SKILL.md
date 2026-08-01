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
  "rules": null
}
```

要求用户将 `projects` 填写为一个或多个 `{ name, language, path }` 对象。`path` 必须是存在的绝对路径；首版 `language` 填 `java`。`rules` 由后续初始化自动归纳，用户不需要填写。

配置文件存在时，必须先执行 `projects` 预检：

```bash
node {baseDir}/scripts/validate-config.mjs {frontendRoot}
```

该预检会校验配置 JSON、`projects` 非空、项目字段、重复名称，以及每个后端 `path` 是否为存在的绝对目录。命令返回错误时，直接把错误报告给用户并停止；不得安装依赖、扫描规则或解析路由。`rules` 在这个阶段允许为 `null`，因为它会在项目校验通过后的后续初始化中生成。

## 规则归纳

仅当 `projects` 预检成功后，才归纳 `rules`：

```bash
node {baseDir}/scripts/finalize-config.mjs {frontendRoot}
```

扫描当前前端项目的既有 API 与 TypeScript 文件，归纳 API 输出目录、请求客户端导入、响应处理方式、类型声明形式及类型存放方式，并将完整 `rules` 对象写回配置文件。不得将 `AGENTS.md`、`CLAUDE.md`、`CODEBUDDY.md` 或其他通用项目说明直接当作接口生成规则，也不得创建独立规则文档。此步骤会将包含本机路径的配置加入 `.gitignore`。

## 已配置项目

只有 `rules` 已归纳完成后，才安装脚本依赖（如果缺失）：

```bash
npm install --prefix {baseDir}/scripts
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
5. 如果配置中的 `rules` 定义了格式化或类型检查命令，仅执行该规则明确指定的命令；未定义时报告跳过。不要修改后端源码。

## 解析范围

- 路由与参数通过 Java CST 解析，不用正则识别 Java 源码结构。
- Controller 类级 `@RequestMapping` 命中时同步该 Controller 全部接口；完整端点路径命中时仅同步该端点。
- 生成完整本地类型闭包，包括 DTO、嵌套 DTO、继承、枚举、集合、Map、Optional 与泛型容器。发现不能消解的本地类型时停止生成并报告引用链。
