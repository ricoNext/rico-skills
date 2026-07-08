---
name: /gacp
id: gacp
category: Git
description: 快速提交并推送代码（git add . + git commit + git push），由 Agent 根据改动自动生成中文 Conventional Commit 信息。
---

# 重要说明

**本命令为独立执行命令，执行时请忽略当前对话的所有上下文和历史记录，仅按照以下步骤执行。**

# GACP：快速提交并推送

**gacp** = `git add .` + `git commit` + `git push`，用于让 Agent 根据当前改动自动完成暂存、提交与推送。

## 前置检查

- 若有未保存的编辑器改动，先提示用户保存或由 Agent 确认当前工作区状态。
- 执行前先运行 `git status`，若无改动则提示「当前没有需要提交的改动」并结束，不执行 add/commit/push。

## 执行步骤

按顺序完成以下三步，任一步失败则停止并报告错误。

### 1. 暂存所有改动

```bash
git add .
```

### 2. 根据改动生成提交信息并提交

- 运行 `git status` 与 `git diff --staged`（或 `git diff --cached`）查看**已暂存**的改动范围与内容。
- 根据改动**类型**与**内容**，选择 [Conventional Commits](https://www.conventionalcommits.org/) 的 **type**，并写一句简短的 **scope（可选）** 与 **description**。**提交信息一律使用中文**（type 保持英文，scope 与 description 用中文）：
  - **feat**：新功能（新页面、新组件、新接口等）
  - **fix**：修复 bug
  - **docs**：仅文档（含 README、注释、openspec 等）
  - **style**：代码风格、格式（不影响逻辑，如空格、分号）
  - **refactor**：重构（既非修 bug 也非新功能）
  - **perf**：性能优化
  - **test**：测试相关
  - **chore**：构建、脚本、依赖、配置、openspec 归档等杂项
- 提交信息格式：`<type>(<scope>): <中文描述>` 或 `type: <中文描述>`。  
  示例：`feat(exam-questions): 新增分析文件上传`、`chore(openspec): 归档变更并更新规范`。
- 若改动包含多个不相关模块，可用一条概括性 message，或拆成多 commit（由 Agent 根据改动量判断）。
- 执行提交（需 **git_write** 权限）：

```bash
git commit -m "<type>(<scope>): <中文描述>"
```

- 本项目启用 **commitlint**，message 必须符合上述规范，否则 pre-commit 会拒绝提交。

### 3. 推送到远程

```bash
git push
```

需要 **network** 权限。若当前分支未设置上游，使用 `git push -u origin <当前分支名>`。

## 权限与注意事项

- **git_write**：用于 `git add`、`git commit`。
- **network**：用于 `git push`。
- 若 pre-commit 钩子（如 format/lint）失败，先根据提示修复后再重新执行 gacp，或先单独运行 `npx ultracite format` 后再次 gacp。

## 执行后反馈

- 成功：简要列出「已暂存 → 已提交（commit hash 与 message）→ 已推送」。
- 失败：输出失败步骤与错误信息，并说明下一步可采取的操作。
