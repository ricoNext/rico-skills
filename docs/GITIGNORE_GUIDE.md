# 推荐的 .gitignore 配置

将以下内容添加到项目的 `.gitignore`：

```gitignore
# YApi Sync Cookie 和日志
.yapi-sync/cookie.json          # ⚠️ 包含 Cookie，不要提交
.yapi-sync/logs/                # 运行日志

# 生成的 API 代码（可选，取决于你的工作流）
# 如果希望生成的代码受版本控制，删除这些行
# src/api/                      # 生成的 API 文件

# 临时文件
*.tmp
*.temp
/temp
/tmp
interfaces.json                 # 临时接口定义文件
```

## 建议的配置

### 如果生成的代码需要版本控制

```gitignore
# 只忽略 Cookie 和日志
.yapi-sync/cookie.json
.yapi-sync/logs/
interfaces.json
```

这样生成的 `src/api/` 会被追踪，团队可以看到 API 的变化。

### 如果生成的代码不需要版本控制（纯粹作为构建产物）

```gitignore
# 忽略所有 .yapi-sync 内容和生成的代码
.yapi-sync/
src/api/
```

生成代码作为构建步骤的输出。

## 最佳实践

✅ **应该提交**：
- `SKILL.md` - Skill 定义
- `.yapi-sync/config.json` - YApi 基础配置（不包含 Cookie）
- `.yapi-sync/api-style.md` - 代码规范
- `package.json` - 脚本依赖

❌ **不应该提交**：
- `.yapi-sync/cookie.json` - 包含 Cookie
- `.yapi-sync/logs/*` - 本地日志
- 未提交到代码库的生成文件

## 为什么 Cookie 不能提交？

1. **安全风险**：Cookie 是认证凭证，泄露可能导致账号被盗
2. **环境差异**：不同环境的 Cookie 不同
3. **时间限制**：Cookie 有过期时间

## 环境变量替代方案（高级）

如果需要在 CI/CD 中自动化，使用环境变量：

```bash
export YAPI_COOKIE="_yapi_token=xxx; _yapi_uid=xxx"
export YAPI_BASE_URL="https://yapi.example.com"

# 脚本读取环境变量而不是文件
```

## 查看 Git 是否跟踪了 Cookie

```bash
# 检查是否意外提交了 cookie.json
git log --all -- .yapi-sync/cookie.json

# 如果已提交，立即重置 Cookie
# 并从 Git 历史中删除该文件
git rm --cached .yapi-sync/cookie.json
git commit -m "Remove accidentally committed cookie"
```
