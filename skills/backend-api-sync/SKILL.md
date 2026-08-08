---
name: backend-api-sync
description: Use when a frontend project needs API functions and TypeScript types generated from Java Spring MVC Controller RequestMapping paths, including a controller route or a single endpoint route.
---

# 后端接口同步

根据调用者提供的接口路径，从已配置后端源码定位 Java Spring MVC
Controller，生成符合当前前端项目规则的 API 函数与完整 TypeScript 类型。

将本 Skill 目录记为 `{baseDir}`，当前前端项目根目录记为
`{frontendRoot}`。

## 首次使用

先检查 `{frontendRoot}/.rico-skill/backend-api-sync/config.json`，
**此步骤必须在安装依赖、扫描规则、解析路由或生成代码之前执行**。

配置不存在时，只执行下列命令：

```bash
node {baseDir}/scripts/ensure-config.mjs {frontendRoot}
```

然后告知用户已创建配置文件，要求其填写后端项目；
**立即停止本次执行**。不得安装脚本依赖、修改 `.gitignore`、扫描项目规则、
读取 Controller 或生成任何前端文件。

模板格式：

```json
{
  "projects": []
}
```

要求用户将 `projects` 填写为一个或多个
`{ name, language, path }` 对象。`path` 必须是存在的绝对路径；首版
`language` 填 `java`。Java 项目的 `path` 可以是 Controller 所在 Maven
子模块，也可以是 Maven 聚合根；聚合根会检索其本地子模块中的 Controller。
API 与 TypeScript 规则不写入该配置文件。

配置文件存在时，必须先执行 `projects` 预检：

```bash
node {baseDir}/scripts/validate-config.mjs {frontendRoot}
```

该预检会校验配置 JSON、`projects` 非空、项目字段、重复名称，以及每个后端
`path` 是否为存在的绝对目录。命令返回错误时，直接把错误报告给用户并停止；
不得安装依赖、扫描规则或解析路由。

## 规则文件

`projects` 预检成功后，检查公共规范文件：

```text
{frontendRoot}/.rico-skill/api-typescript-style.md
```

- **文件已存在**：读取并校验其中的「配置字段」列表。
- **文件不存在或无效**：
  1. **立即**读取并执行同级的 **api-typescript-style** skill
     （`../api-typescript-style/SKILL.md`，或当前环境已安装的同名 skill）。
  2. 按该 skill 流程创建或修复规范文件。
  3. 创建成功后，**继续**本 skill 后续步骤，不要结束对话。
  4. **禁止**仅提示用户「请先使用 api-typescript-style」后停止。

本 skill **不直接手写**该规范文件的内容，但必须自动委托
api-typescript-style 完成创建。配置文件包含本机绝对路径，应将
`.rico-skill/backend-api-sync/config.json` 加入 `.gitignore`；规则文件可提交。

可选校验命令：

```bash
node {baseDir}/scripts/finalize-config.mjs {frontendRoot}
```

该命令只读取并校验已有配置与规范文件。若报错提示规范缺失，
Agent 应按上方步骤自动执行 api-typescript-style，完成后再次校验并继续同步。

## 已配置项目

只有配置与规则文件已就绪后，才安装脚本依赖（如果缺失）：

```bash
npm install --prefix {baseDir}/scripts
```

## 同步流程

1. 调用者只需要给出路由，例如 `/orders` 或 `/orders/{id}`，不要要求项目名。
2. 运行路由解析：

```bash
node {baseDir}/scripts/resolve-route.mjs --project-root {frontendRoot} --route '{route}'
```

唯一命中时继续。多个后端项目命中时，列出候选项目并要求调用者选择；
无命中时报告检索项目，不生成代码。
3. 将所选候选项的 `contract` 保存为临时 JSON，然后预览：

```bash
node {baseDir}/scripts/generate-api.mjs \
  --frontend-root {frontendRoot} \
  --contract {contractJson}
```

默认只输出生成文件和内容，不写入文件。
4. 对预览中每个已存在的目标文件，询问用户选择“覆盖”或“跳过”。
   不得自动合并、覆盖或跳过。将决定保存为：

```json
{ "src/api/orders.ts": "overwrite" }
```

随后执行：

```bash
node {baseDir}/scripts/generate-api.mjs \
  --frontend-root {frontendRoot} \
  --contract {contractJson} \
  --decisions {decisionsJson}
```

新文件可直接写入；已有文件只能在明确 `overwrite` 时写入，`skip` 保持原样。
5. 如果 `.rico-skill/api-typescript-style.md` 定义了格式化或类型检查命令，
   仅执行该规则明确指定的命令；未定义时报告跳过。不要修改后端源码。

## 解析范围

- 路由与参数通过 Java CST 解析，不用正则识别 Java 源码结构。
- Controller 类级 `@RequestMapping` 命中时同步该 Controller 全部接口；
  完整端点路径命中时仅同步该端点。
- 生成完整本地类型闭包，包括 DTO、嵌套 DTO、继承、枚举、集合、Map、
  Optional 与泛型容器。发现不能消解的本地类型时停止生成并报告引用链。
- Maven 聚合工程中，类型解析仅读取命中 Controller 所在模块及其本地
  `compile` 或 `runtime` 依赖模块的 `src/main/java`。支持直接与传递依赖；
  不扫描无关模块，也不读取外部 JAR 或网络依赖。
- 跨模块类型按全限定名、显式 `import`、同包、通配 `import` 与唯一简单类名
  顺序消解；存在同名歧义或输出名称冲突时停止生成并报告候选源码位置。
