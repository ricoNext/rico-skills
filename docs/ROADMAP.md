# rico-skills 开发路线

本文档记录已规划的优化需求与待实现的功能。

## yapi-sync Skill

### [进行中] 添加用户名密码自动登录选项

**优先级**: Medium  
**状态**: Pending (任务 #1)  
**发起日期**: 2026-06-10

#### 概述

为 yapi-sync skill 的 Cookie 获取流程添加第三种选项，允许用户提供用户名和密码进行自动登录，无需手动打开浏览器或复制 Cookie。

#### 需求

在 1.2 获取 Cookie 步骤中，添加第三种选项「自动登录（用户名+密码）」，允许用户提供以下信息：
- YApi 基础 URL（baseUrl）
- 用户名
- 密码

#### 实现内容

1. 修改 `ask_user_question` 选项，添加「自动登录（用户名+密码）」选项
2. 接收用户输入的用户名和密码
3. 通过 Puppeteer/Playwright 或类似工具自动打开浏览器
4. 自动填充登录表单（通常是 email/username 和 password 字段）
5. 提交登录表单
6. 等待登录成功（通常是页面导航或特定 DOM 元素出现）
7. 自动提取 Cookie （`_yapi_token` 和 `_yapi_uid`）
8. 保存 Cookie 到 `config.json`

#### 交互流程

```
选择 Cookie 获取方式：
1. 自动打开浏览器
2. 手动提供 Cookie  
3. 自动登录（用户名+密码）← 新增

选择 3 后：
- 询问基础 URL（可预填 config.json 中的值）
- 询问用户名
- 询问密码（隐藏输入）
- 执行自动登录
- 提取并保存 Cookie
```

#### 文件修改

- `skills/yapi-sync/SKILL.md` - 更新第 1.2 节 Cookie 获取流程说明（✅ 已完成）
- `skills/yapi-sync/scripts/login.mjs` - 新建自动登录脚本

#### 风险考虑

- 需要**安全地处理密码**（不保存到文件，仅内存传递）
- 需要**处理登录失败情况**（账号错误、验证码、MFA 等）
  - 建议在失败时提示用户切换其他方式（浏览器或手动 Cookie）
- 需要**适配不同 YApi 部署版本**的登录表单
  - 不同部署可能使用不同的表单选择器和登录流程
  - 需要支持 URL 路由变化（如 `/login`、`/user/login` 等）

#### 依赖关系

- Puppeteer 或 Playwright（已在 `scripts/package.json` 中有 puppeteer-core）
- 当前已支持的两种方式：浏览器自动化、手动 Cookie 输入

#### 验收标准

- [ ] 新增第三种 Cookie 获取选项
- [ ] 自动登录脚本正确处理用户名/密码输入
- [ ] Cookie 自动提取与保存
- [ ] 登录失败时友好提示与降级方案
- [ ] 密码不被持久化存储
- [ ] 支持至少两个 YApi 部署版本的测试

---

## 其他规划

（待补充更多优化需求）
