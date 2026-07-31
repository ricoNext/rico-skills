---
name: backend-api-sync
description: Use when a frontend project needs API functions and TypeScript types generated from Java Spring MVC Controller RequestMapping paths, including a controller route or a single endpoint route.
---

# 后端接口同步

根据调用者提供的接口路径，从已配置后端源码定位 Java Spring MVC Controller，生成符合当前前端项目规则的 API 函数与完整 TypeScript 类型。

将本 Skill 目录记为 `{baseDir}`，当前前端项目根目录记为 `{frontendRoot}`。脚本依赖位于 `{baseDir}/scripts`；若 `node_modules` 不存在，执行 `npm install --prefix {baseDir}/scripts`。

## 首次使用

1. 确认当前工作目录是前端项目根目录。运行时文件必须写到 `{frontendRoot}/.rico-skill/`，不写入 Skill 安装目录。
2. 检查 `.rico-skill/backend-api-sync.config`：不存在时，逐项询问后端项目的名称、语言和**绝对路径**。首版仅接受 Java Spring MVC，但保留 `language` 以便扩展。
3. 创建配置：

```bash
node {baseDir}/scripts/init-config.mjs --project-root {frontendRoot} --projects '<json-array>'
```

配置格式固定为：

```json
{
  "projects": [{ "name": "order-service", "language": "java", "path": "/absolute/path/to/order-service" }],
  "rulePath": ".rico-skill/backend-api-sync-rules.md"
}
```

`projects[*].path` 必须是存在的绝对路径；`rulePath` 必须相对前端项目根目录。配置文件含本机路径，脚本会只将 `.rico-skill/backend-api-sync.config` 加入前端项目 `.gitignore`。

脚本优先从 `AGENTS.md`、`CLAUDE.md`、`CODEBUDDY.md` 发现 API 约定；没有可用约定时，生成 `.rico-skill/backend-api-sync-rules.md`。该规则文档可提交，生成前允许用户检查或调整。

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
