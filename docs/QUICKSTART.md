# YApi Sync Skill - 快速开始

5 分钟内在你的项目中同步 YApi 接口！

## 📋 前置要求

- Node.js v18+
- 已在项目中有 API 定义文件（或创建 `src/api/` 目录）

## 🚀 快速开始

### 1. 初始化项目规范

```bash
node skills/yapi-sync/scripts/detect-codegen-style.mjs /path/to/your/project
```

这会创建 `.yapi-sync/api-style.md`，自动检测你的代码规范。

**查看生成的规范**：
```bash
cat /path/to/your/project/.yapi-sync/api-style.md
```

### 2. 配置 YApi Cookie

在浏览器中访问你的 YApi 地址并登录，然后：

1. 打开开发者工具 (F12) > Application > Cookies
2. 复制 `_yapi_token` 和 `_yapi_uid` 的值

创建配置文件：
```bash
mkdir -p /path/to/your/project/.yapi-sync
cat > /path/to/your/project/.yapi-sync/config.json << 'EOF'
{
  "baseUrl": "https://your-yapi.com",
  "cookie": "_yapi_token=xxx; _yapi_uid=xxx"
}
EOF
```

### 3. 拉取接口定义

```bash
node skills/yapi-sync/scripts/fetch-interface.mjs --project /path/to/your/project 123,456 > interfaces.json
```

支持：
- 单个接口：`123`
- 多个接口：`123,456,789`
- 分类：`cat_1234`
- URL：`https://yapi.com/project/12/interface/api/123`

### 4. 生成 API 代码

```bash
node skills/yapi-sync/scripts/generate-api.mjs interfaces.json /path/to/your/project ./src/api
```

生成的代码会自动遵循你的项目规范！

## 📁 项目结构

生成后的样子：

```
your-project/
├── .yapi-sync/
│   ├── config.json          # ⚠️ 不要提交到 Git
│   └── api-style.md         # ✅ 可以提交
├── src/
│   └── api/
│       ├── user.ts          # 生成的文件
│       └── product.ts       # 生成的文件
└── .gitignore              # 添加: .yapi-sync/config.json
```

## ⚙️ 自定义代码规范

编辑 `.yapi-sync/api-style.md` 中的「[样本代码]」块来调整：

```markdown
### 类型定义风格

[样本代码]

```typescript
// 改成分离式类型定义
import { GetUserRequest, UserResponse } from "./types";
export const getUser = (data: GetUserRequest) =>
  request<UserResponse>("/user/detail", { data });
```
```

下次生成时会自动使用新规范。

## 🆘 常见问题

### Cookie 过期了？
手动更新 `.yapi-sync/config.json` 中的 `cookie` 字段即可：
1. 重新在浏览器中登录 YApi
2. 复制新的 `_yapi_token` 和 `_yapi_uid`
3. 更新配置文件

### 需要重新检测规范？
删除 `.yapi-sync/api-style.md`，然后重新运行 `detect-codegen-style.mjs`

### 生成的代码风格不对？
编辑 `.yapi-sync/api-style.md`，修改「[样本代码]」块中的示例

### 需要批量同步？
直接传入多个 ID 或分类：
```bash
node skills/yapi-sync/scripts/fetch-interface.mjs --project /path/to/project cat_123,456,789 > interfaces.json
```

## 📖 更多信息

- [完整文档](./docs/API.md)
- [故障排查](./docs/TROUBLESHOOTING.md)
- [最佳实践](./docs/BEST_PRACTICES.md)

---

**提示**：添加这些到 `.gitignore`：
```
.yapi-sync/config.json
.yapi-sync/logs/
```
