# 路由解析与类型映射

## 输入

用户给接口地址，不需要手写 JSON Schema。

| 输入 | 结果 |
| --- | --- |
| `/v1/user/detail` | 精确匹配该端点 |
| `https://api.example.com/v1/user/detail?x=1` | 去掉域名和 query 后匹配 |
| `/v1/mis-quotation-space` | 匹配 Controller 类级 `@RequestMapping`，同步其全部端点 |
| 网关前缀 + 真实 path | 若完整 path 以 Controller 路径结尾，仍可命中 |

## 源码匹配

在 Maven 聚合根下扫描 `*Controller.java`：

1. 类上 `@RestController` / `@Controller` + `@RequestMapping`
2. 方法上 `@GetMapping` / `@PostMapping` / `@PutMapping` / `@DeleteMapping` / `@PatchMapping`
3. 完整 path = 类级 path + 方法级 path
4. 接口标题取方法 Javadoc 首行；没有则用 Java 方法名

## 参数

| 注解 | YApi 位置 |
| --- | --- |
| `@RequestBody` | `req_body_other`（JSON Schema） |
| `@RequestParam` | `req_query` |
| `@PathVariable` | `req_params` |
| `@RequestHeader` | `req_headers` |
| 无注解的简单参数 | `req_query` |

## Java → JSON Schema

| Java | Schema |
| --- | --- |
| String / UUID / 日期时间 | string（日期带 format） |
| int / Integer / long / Long | integer |
| float / double / BigDecimal | number |
| boolean | boolean |
| List / Set / 数组 | array |
| Map | object + additionalProperties |
| enum | string + enum |
| DTO / 继承父类字段 | object.properties，字段 `description` 来自注释 |
| `GoneoResult<T>` | `{ success, code, msg, cnMsg, data: T }` |
| `GoneoResult<?>` | 从 `GoneoResult.ok(service.method())` 或 `Map.of(...)` 推断 `data` |
| `Page<T>` / `IPage<T>` | `{ records, total, size, current, pages }` |
| `ResponseEntity<T>` | 展开为 `T` |
| 找不到的类型 | `{ "type": "object", "description": "Java type: Xxx" }` |

字段说明优先级：`@ApiModelProperty` / `@Schema(description)` → Javadoc / `/** ... */` → `@NotBlank`/`@NotNull` 的 `message` → `//` 行注释。

`@NotNull`、`@NotBlank`、`@NotEmpty` 会进入 JSON Schema 的 `required`。

## 配置

| 文件 | 用途 |
| --- | --- |
| `.rico-skill/yapi-sync/config.json` | `baseUrl` |
| `.rico-skill/yapi-sync/cookie.txt` | 登录 Cookie |
| `.rico-skill/yapi-push/config.json` | 默认 `projectId`、`catId` |

## YApi 写入

- 新增 `POST /api/interface/add`
- 更新 `POST /api/interface/up`
- 是否已存在：同一项目下 method 相同，且 path 在去掉项目 `basepath` 后相同
  （例如项目 basepath 为 `/v1` 时，`/v1/user/create` 与 `/user/create` 视为同一接口）
