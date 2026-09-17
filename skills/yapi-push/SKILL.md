---
name: yapi-push
description: 根据用户提供的接口地址，从当前仓库的 Java Spring MVC Controller 解析入参和返回类型，并同步到 YApi。当用户给出接口路径/URL、要把后端接口推到 YApi、上传接口到 YApi 时使用。
---

# 按接口地址同步到 YApi

用户只提供**接口地址**。从本仓库 Spring MVC Controller 找到对应方法，解析请求参数和返回类型，再写入 YApi。

Cookie 与 `baseUrl` 复用 `.rico-skill/yapi-sync/`。同路径 + 同方法已存在时，必须先询问覆盖策略。

## CLI 准备

1. `{baseDir}` = 本 SKILL.md 所在目录
2. `{projectRoot}` = 当前仓库根目录
3. 若 `{baseDir}/scripts/node_modules` 不存在，执行
   `npm install --prefix {baseDir}/scripts`
4. `${PUSH}` =
   `node {baseDir}/scripts/push-interface.mjs --project {projectRoot}`

## 执行流程

### 1. 解析用户给的接口地址

接受：

- `/v1/mis-quotation-space/getQuotationSpaceList`
- `https://host/v1/mis-quotation-space/getQuotationSpaceList`
- Controller 类级路径，如 `/v1/mis-quotation-space`（同步该 Controller 全部接口）
- 多条路径（换行或多次 `--route`）

去掉域名、query、hash，得到以 `/` 开头的 path。不要向用户要 JSON Schema。

### 2. 从源码解析入参和返回类型

```bash
${PUSH} --dry-run --route '{path}'
```

脚本会：

1. 在 Maven 多模块里找 `@RestController` / `@Controller`
2. 拼接类级 `@RequestMapping` 与方法级 `@GetMapping` / `@PostMapping` 等
3. 解析 `@RequestBody`、`@RequestParam`、`@PathVariable`、`@RequestHeader`
4. 展开 DTO / VO / 枚举 / 继承字段，生成 JSON Schema
5. 把字段说明写入 schema `description`：优先 `@ApiModelProperty` / `@Schema`，其次 Javadoc，再次校验注解 `message`
6. `@NotNull` / `@NotBlank` / `@NotEmpty` 写入 schema `required`
7. `GoneoResult<T>` / `ResponseEntity<T>` 按包装类型展开
8. 若声明为 `GoneoResult<?>`，从方法体 `GoneoResult.ok(service.xxx())` / `Map.of(...)` 推断 `data` 的真实类型；`Page<T>` / `IPage<T>` 展开为 `records/total/size/current/pages`

向用户展示解析结果，例如：

```text
命中 MisQuotationSpaceController#getQuotationSpaceList
POST /v1/mis-quotation-space/getQuotationSpaceList
标题：查询用户的快速报价空间 - C
请求体：GetSpaceGroupListDTO
返回：GoneoResult<?>
```

- **零命中**：报告已检索的 path，停止
- **多 Controller 命中**：列出候选项让用户选
- 未解析到的外部类型用 `Java type: Xxx` 占位，继续同步，不要因此中止

### 3. Cookie 与 YApi 目标

读取 `{projectRoot}/.rico-skill/yapi-sync/config.json` 和
`cookie.txt`。失效则按步骤 3.1 让用户粘贴 Cookie。

`project_id` / `catid` 优先级：

1. 用户给的 YApi 项目/分类 URL，或 `--project-id` / `--cat-id`
2. `{projectRoot}/.rico-skill/yapi-push/config.json`

缺少 `project_id` 时询问项目 URL。缺少 `catid` 时：

```bash
${PUSH} --list-cats --project-id {projectId}
```

列出分类让用户选。不要猜分类。

#### 3.1 获取 Cookie

```text
YApi Cookie 未配置或已失效。
1. 访问 {baseUrl} 并登录
2. 开发者工具 > Application > Cookies
3. 复制 _yapi_token 和 _yapi_uid，格式：_yapi_token=xxx; _yapi_uid=xxx
4. 写入 .rico-skill/yapi-sync/cookie.txt
```

用 AskQuestion 收集 Cookie，校验字段后写入 `cookie.txt`，然后继续。

### 4. 预览新增 / 更新

```bash
${PUSH} --dry-run --project-id {projectId} --cat-id {catId} --route '{path}'
```

```text
即将同步到 YApi 项目 {projectId}：
- [新增] POST /v1/mis-quotation-space/getQuotationSpaceList  查询用户的快速报价空间 - C
- [更新] GET /orders/{id}  getOrder（已存在 #18430）
```

### 5. 覆盖策略

全部新增 → 直接写入。

已存在 → AskQuestion：

- 全部覆盖
- 仅新增
- 逐个确认
- 取消

禁止在用户未选择时调用 `/api/interface/up`。

### 6. 写入

```bash
${PUSH} --strategy overwrite --project-id {projectId} --cat-id {catId} --route '{path}'
```

仅新增用 `--strategy skip`。

常用目标可记住：

```bash
${PUSH} --save-defaults --project-id {projectId} --cat-id {catId} --dry-run --route '{path}'
```

### 7. 输出结果

```text
同步完成
- 新增 1
- 更新 0
- 跳过 0
- 失败 0

https://yapi.example.com/project/{projectId}/interface/api/{id}
```

## 错误处理

| 情况 | 处理 |
| --- | --- |
| 源码未找到该 path | 停止并列出尝试过的地址 |
| Cookie 失效 / 退出码 10 | 步骤 3.1 |
| 缺少 project_id | 询问 YApi 项目 URL |
| 缺少 catid | `--list-cats` 后请用户选择 |
| 单条写入失败 | 记录后继续其余接口 |

## 示例

用户：把 `/v1/mis-quotation-space/getQuotationSpaceList` 同步到 YApi

1. `--dry-run --route /v1/mis-quotation-space/getQuotationSpaceList`
2. 展示 Controller、方法、入参 DTO、返回类型
3. 若缺项目/分类，询问
4. 已存在则询问覆盖
5. 写入并返回 YApi 链接

## 附加资源

- 路由匹配与类型转换：[reference.md](reference.md)
- 命令示例：[examples.md](examples.md)
