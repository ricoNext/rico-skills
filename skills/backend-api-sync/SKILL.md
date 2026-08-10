---
name: backend-api-sync
description: >-
  Use when a frontend project needs API functions and TypeScript types generated
  from Java Spring MVC Controller RequestMapping paths, including a controller
  route or a single endpoint route.
---

# 后端接口同步

根据调用者提供的接口路由，直接读取已配置后端 Java 项目源码，定位 Spring MVC Controller，提取路由、参数与返回类型，生成**符合当前前端项目** `api-typescript-style.md` 的 API 函数与 TypeScript 类型。

本 skill **不绑定**某一公司、仓库或业务域。路径、包名、请求客户端、类型命名与文件落点均以目标前端项目的规范文档与配置为准；正文中的示例仅为说明流程，禁止原样写入目标仓库。

将当前前端项目根目录记为 `{frontendRoot}`。

---

## 一、读取配置

读取 `{frontendRoot}/.rico-skill/backend-api-sync/config.json`。

**文件不存在时**：创建以下模板并告知用户填写，然后**立即停止**：

```json
{
  "projects": []
}
```

要求用户将 `projects` 填写为一个或多个对象，格式：

```json
{ "name": "项目名", "language": "java", "path": "/绝对/路径/到/java后端项目" }
```

`path` 可以是某个 Maven 子模块目录，也可以是聚合根目录。**不要继续执行后续步骤。**

**文件存在时**：

- 验证 `projects` 非空，且每个 `path` 是真实存在的绝对目录；否则报错停止。
- 检查 `{frontendRoot}/.gitignore`，确保包含 `.rico-skill/backend-api-sync/config.json` 这一行；如未包含则追加。

---

## 二、读取 API 规范

读取 `{frontendRoot}/.rico-skill/api-typescript-style.md`：

- **文件已存在**：读取全文，理解其中描述的 API 与 TypeScript 定义规范——包括但不限于文件存放位置、请求客户端导入方式、类型声明风格、响应解包方式、命名规范、分页类型名等；将这些规则作为后续代码生成的**唯一风格依据**。不依赖固定字段名，通过阅读文档内容智能推断。
- **文件不存在**：立即执行同级 `api-typescript-style` skill 自动创建规范文件，创建成功后继续；**禁止**仅提示用户后停止。

若规范文档与下文「默认类型映射」冲突，**以规范文档为准**。

---

## 三、定位 Controller

在所有配置的 Java 项目路径下找到处理目标路由的 Controller 文件。

**步骤：**

1. 对每个配置项目，列出其下所有 `src/main/java` 目录（Maven 聚合根会有多个子模块各自的 `src/main/java`）。
2. 用路由关键词（取路由末段，如 `/api/orders` 取 `orders`）在这些目录下 grep `@RequestMapping`、`@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping`、`@PatchMapping` 等注解，缩小候选范围。
3. 读取候选文件，判断：
   - 类级 `@RequestMapping` 前缀 + 方法级 mapping value 拼接后是否匹配目标路由；
   - 或目标路由完整出现在某方法 mapping 注解中。
4. 收集所有真正匹配的 Controller 文件。

**唯一命中** → 继续。  
**多个命中** → 列出候选文件，要求调用者选择，选定后继续。  
**未命中** → 报告搜索了哪些路径，不生成代码，停止。

---

## 四、分析 Controller

读取命中 Controller 文件的全文，提取：

- **类级路由前缀**：`@RequestMapping` 的 `value`/`path`
- **每个方法**（public 方法，带 HTTP mapping 注解）：
  - 完整路由 = 类级前缀 + 方法级 mapping value
  - HTTP 方法（GET / POST / PUT / DELETE / PATCH）
  - 请求参数：
    - `@RequestBody SomeDto dto` → 请求体，整体对象
    - `@RequestParam String name` → URL 查询参数，单个字段
    - `@PathVariable Long id` → 路径参数
    - `@RequestPart MultipartFile file` → 文件上传
  - 返回类型（见「类型映射规则」，响应包装类要解包）

**同步范围**：

- 目标路由精确匹配某方法 → 仅同步该方法
- 目标路由匹配类级前缀（如路由为 `/api/orders`，类级为 `/api/orders`）→ 同步该 Controller 所有方法

---

## 五、追踪类型

对步骤四中收集到的所有非基础 Java 类型（DTO、VO、枚举、内部类等），递归读取其源文件。

**定位规则（按顺序尝试，命中即停）：**

1. 查看 Controller 文件顶部 `import` 语句，找到精确匹配简单类名的 import（非通配）。
2. 将全限定名转为文件路径：例如 `com.example.order.vo.OrderVO` → 在所有 `src/main/java` 根中找 `com/example/order/vo/OrderVO.java`。
3. 若无精确 import，在 Controller 同包下查找同名文件。
4. 若有通配 import（如 `import com.example.order.vo.*`），在对应包目录下查找同名文件。
5. 若类型来自配置路径之外的 sibling 模块（常见于 Maven 多模块里的 `*-common` / `*-api`），向上查找 Maven 聚合根，在 sibling 模块的 `src/main/java` 中搜索。
6. 同名多个候选（歧义）→ 停止并报告候选文件路径，询问用户确认后继续。
7. 完全找不到 → 报告引用链，询问用户是否用 `unknown` 替代后继续。

读到类型文件后：

- 提取字段（`private`/`protected`/`public` 修饰的实例字段）
- 提取继承（`extends`）→ 递归追踪父类字段
- 提取嵌套类/枚举 → 一并纳入类型闭包
- 跳过：接口（`interface`）类型不写入前端类型文件

---

## 六、类型映射规则

将 Java 类型转换为 TypeScript 时，先查 `api-typescript-style.md` 是否已写明映射；未写明时使用下列**默认**规则。

### 基础类型

| Java | TypeScript（默认） |
|------|-------------------|
| `boolean` / `Boolean` | `boolean` |
| `byte` `short` `int` `float` `double` 及其包装类 | `number` |
| `long` / `Long` / `BigDecimal` / `BigInteger` | `string`（避免 JS 大数精度丢失；若规范文档另有约定则从其约定） |
| `String` / `UUID` | `string` |
| `LocalDate` / `LocalDateTime` / `OffsetDateTime` / `Instant` / `Date` | `string` |
| `Object` / `?` / 无法解析的类型 | `unknown` |
| `void` / `Void` | `void` |

### 容器类型

| Java | TypeScript（默认） |
|------|-------------------|
| `List<T>` / `Set<T>` / `Collection<T>` | `T[]` |
| `T[]` | `T[]` |
| `Map<K, V>` | `Record<string, V>`（key 统一为 string） |
| `Optional<T>` | `T \| undefined` |
| `Page<T>` / `IPage<T>` | 使用规范文档中的**分页类型**（常见如项目全局的 `PageData` / `PageResult` 等）；规范未写明则询问用户 |

### 响应包装（解包，不写入类型文件）

遇到统一响应包装（常见命名如 `Result`、`R`、`ApiResult`、`ResponseEntity`，以及各项目自定义的 `*Result`）→ 取内层业务类型 `T`，包装类型本身不生成 TypeScript 类型。具体有哪些包装类、是否已在 HTTP 层解包，以规范文档为准。

### 枚举

Java `enum` → TypeScript `union type`（命名风格以规范文档为准）：

```typescript
// Java: enum StatusEnum { ENABLE, DISABLE }
// 示例：具体前缀/导出方式以 api-typescript-style.md 为准
type StatusEnum = "ENABLE" | "DISABLE";
```

---

## 七、生成 TypeScript 代码

依据步骤二中对 `api-typescript-style.md` 的理解生成目标文件内容。

下列仅为**流程示意**（中性示例），**不得**当作目标项目的固定模板；实际 import 路径、请求函数名、类型前缀、文件落点、URL 风格、分页泛型名均须来自规范文档与本仓库实况。

**类型定义示意：**

```typescript
/** 订单信息 */
export type OrderVO = {
	/** 订单 ID */
	id: number;
	/** 订单号 */
	orderNo: string;
	status: StatusEnum;
};

export type StatusEnum = "ENABLE" | "DISABLE";
```

**API 函数示意：**

```typescript
// import 与 request 调用形态以规范文档为准，勿照抄本示例路径
/** 获取订单列表 */
export const getOrderList = (data: {
	/** 订单号（模糊查询） */
	orderNo?: string;
	pageNum: number;
	pageSize: number;
}) => request<PageData<OrderVO>>("/api/orders/list", { data });

/** 获取订单详情 */
export const getOrderDetail = (data: { id: number }) =>
	request<OrderVO>("/api/orders/detail", { data });
```

**规则：**

- 所有命名、文件位置、类型声明形式、入参风格均以步骤二理解的规范为准
- 禁止使用 `any`，无法解析的类型用 `unknown`

先向用户**完整展示**生成的文件内容作为预览，再执行写入。

---

## 八、写入文件

对每个目标文件：

- **文件不存在** → 直接写入
- **文件已存在** → 询问用户选择「覆盖」或「跳过」，不得自动决定

写入后，若 `api-typescript-style.md` 中描述了格式化命令，执行该命令；未提及则跳过并告知。

---

## 注意事项

- **不运行任何脚本**，直接用文件读取工具和 shell 搜索命令（`grep`、`find`）定位文件，用 AI 阅读理解 Java 源码结构。
- 不修改后端源码。
- 静态内部类、继承字段、泛型参数都必须完整追踪，不能遗漏。
- 遇到不确定的情况（类型歧义、找不到文件）先报告，再询问用户决策，不要静默跳过。
- 生成结果必须可迁移到任意前端仓库：禁止把本文示例中的包名、路由、请求客户端或类型命名习惯硬编码进产物。
