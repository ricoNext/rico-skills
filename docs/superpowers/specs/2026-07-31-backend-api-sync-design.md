# backend-api-sync 设计

## 目标

新增 `backend-api-sync` Skill，供前端项目从已登记的后端源码同步 API 契约。首版仅解析 Java Spring MVC；调用者只提供路由路径，Skill 自动定位后端项目、解析端点和完整的类型依赖闭包，并按当前前端项目的既有规范生成接口函数与 TypeScript 类型。

支持两种输入语义：

- 类级 `@RequestMapping` 路径：生成该 Controller 下的全部端点。
- 完整端点路径：只生成匹配端点。

未来可以新增 Go 等语言的解析器，但不改变配置格式、契约 JSON 或前端生成器。

## 非目标

- 首版不解析 Go、Python 或其他后端语言。
- 不依赖 Maven 或 Gradle 编译后端项目，也不要求后端依赖完整可用。
- 不自动合并已有前端文件，不静默覆盖用户代码。
- 不为无法安全解析的后端类型伪造 `any` 或猜测字段。

## 前端项目配置

所有运行时配置都写入调用 Skill 的前端项目根目录，不写入 Skill 安装目录：

```text
<frontend-root>/.rico-skill/backend-api-sync.config
<frontend-root>/.rico-skill/backend-api-sync-rules.md
```

配置使用 JSON，格式固定如下：

```json
{
  "projects": [
    {
      "name": "order-service",
      "language": "java",
      "path": "/absolute/path/to/order-service"
    }
  ],
  "rulePath": ".rico-skill/backend-api-sync-rules.md"
}
```

规则：

- `projects` 可登记多个后端接口项目。
- `name` 在配置中唯一，用于多项目路由冲突时让用户选择。
- `language` 预留扩展；首版只有 `java` 可解析，其他语言项目保留但跳过。
- `path` 必须是存在的绝对路径。
- `rulePath` 相对于前端项目根目录，必须指向已有规则文档。
- 配置含有机器本地绝对路径，首次创建时把 `.rico-skill/backend-api-sync.config` 加入前端项目 `.gitignore`。规则文档不忽略，可提交给团队共享。

## 首次初始化

当配置不存在时，Skill 依次引导用户填写每个后端项目的名称、语言和绝对路径，并在写入前验证目录存在。

随后确定 `rulePath`：

1. 扫描前端项目中的 `AGENTS.md`、`CLAUDE.md` 等项目说明，以及已有 API 代码。
2. 若找到足以指导接口函数、类型定义、请求客户端、响应包装或输出目录的规范文档，将相对路径写入 `rulePath`。
3. 若没有可用规范，扫描项目现有 API 文件与请求工具，生成 `.rico-skill/backend-api-sync-rules.md`，再写入 `rulePath`。
4. 若项目没有现有 API 代码，规则文档记录默认输出位置 `src/api/{module}.ts`、请求客户端待确认项和默认 TypeScript 风格；首次生成前将这些默认项展示给用户。

若已存在配置但路径无效、JSON 无效或 `rulePath` 无法读取，停止生成并引导用户修正对应字段。

## 路由定位

Skill 接收一个路由路径，并只检索配置中 `language: "java"` 的项目。

Java 解析器遍历源码中的 Spring Controller，规范化路径后建立索引：去除重复斜杠、确保前导斜杠，并拼接类级和方法级映射。

- 输入匹配某个类级映射时，选中该 Controller 的全部端点。
- 输入匹配某个完整方法映射时，只选中该端点。
- 唯一项目命中时直接继续。
- 多个项目命中时，展示项目名、Controller 和候选端点，要求用户选择项目。
- 没有命中时，报告已检索项目与路径，不写入前端代码。

## Java Spring MVC 解析

使用 Java AST 解析，不使用正则作为源码结构解析手段。解析器识别：

- `@RequestMapping`、`@GetMapping`、`@PostMapping`、`@PutMapping`、`@PatchMapping`、`@DeleteMapping`。
- 类级和方法级 `path` 或 `value`，以及 HTTP 方法。
- `@PathVariable`、`@RequestParam`、`@RequestBody`、`@RequestHeader`。
- 方法名、源码文件与行号、参数可选性、返回类型。

解析器输出语言无关的中间契约 JSON。前端生成器只消费该契约和 `rulePath`，因此新增其他语言时只需实现同一契约格式的解析器。

## 类型闭包

从端点参数与返回类型开始，递归解析同一后端项目中的 DTO、枚举、泛型与父类字段，直到没有新的本地类型依赖。

类型映射至少覆盖：

- Java 基础类型和包装类型。
- `String`、日期时间类型、`BigDecimal`、`BigInteger`。
- `List`、`Set`、`Collection`、数组、`Map`、`Optional` 与嵌套泛型。
- `ResponseEntity<T>` 和项目内常见的泛型响应包装。
- DTO 嵌套字段、继承字段、枚举和本地类型引用。

枚举根据 Java 定义生成字符串字面量联合类型；DTO 按 `rulePath` 规定的风格生成具名 `interface` 或 `type`。响应包装是否由前端请求客户端拆包，也由 `rulePath` 和现有项目代码决定。

若类型源码缺失、存在同名歧义或序列化形式无法安全确定，生成在写入前停止，并报告未解析类型、引用链和源码位置。

## 前端生成与更新

生成前读取 `rulePath`，确定 API 目录、请求客户端、文件命名、函数命名、参数传递、类型声明位置、响应包装和格式化命令。

每次只生成本次选中的 Controller 或端点及其完整类型闭包。生成器应避免重复的函数和类型定义，并遵循规则文档指定的导入和导出形式。

若目标前端文件已存在：

1. 展示将生成的接口与类型摘要以及目标文件路径。
2. 让用户选择覆盖该文件或跳过该文件。
3. 仅在用户明确选择覆盖时写入；跳过时不修改该文件，继续处理其他目标文件。

生成后执行项目已有的格式化命令和 TypeScript 类型检查；没有可用命令时至少校验生成 TypeScript 的语法与导入引用。

## 错误处理

- 配置缺失或无效：进入初始化或指出具体字段。
- 后端项目路径不存在：不检索该项目，要求修正。
- 语言尚未支持：说明项目被跳过，不把它算作未命中。
- 路由无匹配：展示检索范围，不创建前端文件。
- 多项目匹配：必须选择项目，禁止任意取第一个结果。
- 类型无法完整解析：不写入该端点，输出可操作的诊断。
- 目标文件已存在：仅由用户选择覆盖或跳过。

## Skill 结构

```text
skills/backend-api-sync/
  SKILL.md
  agents/openai.yaml
  scripts/
    package.json
    init-config.mjs
    discover-rules.mjs
    parse-java-spring.mjs
    generate-api.mjs
    lib/
  tests/
    fixtures/
```

解析脚本使用成熟的 Java AST 库。`SKILL.md` 保持精简，负责引导、冲突确认和项目内写入；脚本承担配置校验、规则发现、语法解析和确定性的契约输出。

实现时还需要将新 Skill 加入 `skills/catalog.yaml`、`.claude-plugin/marketplace.json` 和项目 README。

## 验证

测试覆盖：

- 首次初始化、绝对路径校验、规则发现与 `rulePath` 回填。
- 类级路径与完整端点路径匹配。
- 多项目同路由冲突和无命中诊断。
- 各类 Spring 映射注解及参数注解。
- DTO 嵌套、继承、枚举、集合、Map 与嵌套泛型的完整类型闭包。
- 未解析类型和不支持语言的阻断行为。
- 已有前端目标文件的覆盖或跳过选择。
- 按模拟 `rulePath` 生成的 TypeScript 通过语法和类型检查。
