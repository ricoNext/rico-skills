# 故障排查指南

遇到问题？查看这里找解决方案。

## 🔴 常见错误

### 1. `YApi cookie 已失效，请重新登录`

**原因**：Cookie 过期了

**解决**：
手动更新 `.yapi-sync/cookie.json` 中的 `cookie` 字段：
1. 在浏览器中重新登录 YApi
2. 打开开发者工具 (F12) > Application > Cookies
3. 复制 `_yapi_token` 和 `_yapi_uid` 的值
4. 更新 Cookie 文件中的 `cookie` 字段

---

### 2. `未检测到 API 文件`

**原因**：
- 项目中没有 `src/api/` 或 `lib/api/` 目录
- 目录中没有 `.ts` 或 `.js` 文件

**解决**：
```bash
# 创建示例 API 文件
mkdir -p src/api
cat > src/api/example.ts << 'EOF'
import request from "@/api";
export const getExample = () => request("/example");
EOF

# 重新检测
node scripts/detect-codegen-style.mjs /path/to/project
```

---

### 3. `未找到可同步的接口`

**原因**：
- 接口 ID 或分类 ID 无效
- 没有权限访问该接口
- YApi 接口已删除

**解决**：
- 检查接口 ID 是否正确
- 确认 Cookie 有访问权限
- 尝试访问 YApi 网页版确认接口存在

---

### 4. `项目根目录不存在`

**原因**：
- 传入了错误的项目路径

**解决**：
```bash
# 确保路径存在
ls -la /path/to/project

# 使用绝对路径
node scripts/detect-codegen-style.mjs $(pwd)
```

---

### 5. `分类下未找到可同步的接口`

**原因**：
- 分类确实没有接口
- 权限不足

**解决**：
```bash
# 尝试拉取分类预览
node scripts/fetch-interface.mjs --resolve-only --project /path/to/project cat_123
```

查看返回的接口列表是否为空。

---

## 🟡 性能和超时问题

### 接口请求超时

**原因**：
- 网络不稳定
- YApi 服务器响应慢
- 一次同步太多接口

**解决**：
```bash
# 分批同步
node scripts/fetch-interface.mjs --project /path/to/project 1 > interfaces1.json
node scripts/fetch-interface.mjs --project /path/to/project 2 > interfaces2.json

# 或简单地重试
node scripts/fetch-interface.mjs --project /path/to/project 123,456
```

---

### 大量接口生成很慢

**原因**：
- 接口数量太多
- 磁盘 I/O 慢

**解决**：
- 分批生成（见上面）
- 或耐心等待

---

## 🟠 配置问题

### 规范检测结果不对

**症状**：检测到的规范与实际代码风格不符

**原因**：
- 现有代码风格不一致
- 脚本的正则匹配有局限

**解决**：
手动编辑 `.yapi-sync/api-style.md`：

```markdown
### 类型定义风格

[样本代码]

```typescript
// 修改成你想要的风格
export const getUser = (data: GetUserRequest) =>
  request<UserResponse>("/user/detail");
```
```

---

### Cookie 保存位置错误

**症状**：`cookie.json` 保存到了错误的位置

**原因**：
- 项目路径有误
- 目录权限问题

**解决**：
```bash
# 检查 .yapi-sync 目录位置
ls -la /path/to/project/.yapi-sync/

# 手动创建
mkdir -p /path/to/project/.yapi-sync
```

---

## 🔵 调试技巧

### 查看详细日志

```bash
# 查看脚本输出
node scripts/fetch-interface.mjs --project /path/to/project 123 2>&1 | tee debug.log

# 查看返回的 JSON
cat interfaces.json | jq .
```

### 手动测试连接

```bash
# 测试 YApi 连接
curl -H "Cookie: $(cat /path/to/project/.yapi-sync/cookie.json | jq -r '.cookie')" \
  "$(cat /path/to/project/.yapi-sync/config.json | jq -r '.baseUrl')/api/interface/get?id=123"
```

### 查看生成的代码

```bash
# 检查是否正确生成
ls -la generated-api/
head -20 generated-api/user.ts
```

---

## 📋 检查清单

遇到问题时，逐一检查：

- [ ] Node.js 版本 >= 18
- [ ] 依赖已安装：`npm install --prefix skills/yapi-sync/scripts`
- [ ] Cookie 已配置：`cat .yapi-sync/cookie.json`
- [ ] Cookie 有效（登录新的没有过期）
- [ ] 接口 ID/分类 ID 正确
- [ ] 项目路径正确
- [ ] 有读写权限：`ls -la .yapi-sync/`
- [ ] YApi 服务可访问

---

## 🆘 仍未解决？

1. 检查日志文件：`.yapi-sync/logs/`
2. 查看完整错误信息
3. 尝试手动步骤（见快速开始）
4. 提交 Issue：[GitHub Issues](https://github.com/ricoNext/rico-skills/issues)

**提交 Issue 时，请提供**：
- 完整的错误信息
- 你运行的命令
- 操作系统和 Node.js 版本
- `.yapi-sync/config.json` 中的 baseUrl（不要提交 `.yapi-sync/cookie.json`）
