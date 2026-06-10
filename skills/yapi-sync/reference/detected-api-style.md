# 检测到的 API 代码规范

本文档由 `detect-codegen-style.mjs` 自动生成。
您可以编辑本文档的「[样本代码]」块来调整代码生成的规范。

## 项目结构检测结果

**扫描时间**：2026-06-10
**扫描范围**：`src/`, `lib/`
**检测置信度**：100%

### API 存放位置

根据扫描的现有 API 文件，推断为：

```
src/api/{module}.ts
```

---

### 类型定义风格

**推断风格**：内联类型定义

示例：
```typescript
export const getUser = (data: {
  /** 用户 ID */
  id: number;
}) => request<UserResponse>("/user/detail");
```

若要改变风格，编辑下方「[样本代码]」块，后续生成会采用新风格。

---

### 响应类型包装

**推断包装方式**：`Response`

现有响应类型分布：
- `Response` (2 处)

---

### 命名规范

| 项目 | 规范 |
|------|------|
| **函数命名** | camelCase（如 `getUser`、`createProduct`） |
| **文件命名** | 按路由模块（如 `/user/*` → `user.ts`） |
| **类型命名** | PascalCase（如 `UserResponse`、`ProductList`） |

---

## 手动调整

如需改变代码生成规范，编辑下方对应的「[样本代码]」块，保存后重新运行即可。

### 存放位置

[样本代码]
```
src/api/{module}.ts
```

要改为其他位置（如 `lib/api`、`services`），编辑上方路径。

---

### 类型定义风格

[样本代码]

```typescript
export const getUser = (data: {
  /** 用户 ID */
  id: number;
}) => request<UserResponse>("/user/detail");
```

---

### 响应类型包装

[样本代码]

```typescript
// 若返回 { code: 0, data: T, message: string }
export const getUser = (data: ...) =>
  request<ApiResponse<User>>("/user/detail");
```

---

## 检测日志

若需重新检测项目规范，运行：

```bash
node skills/yapi-sync/scripts/detect-codegen-style.mjs <projectRoot> --update
```

**检测的文件数**：1
**函数总数**：2
