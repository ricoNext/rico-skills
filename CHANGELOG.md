# Changelog

## 0.2.0 - 2026-06-22

### 新功能

- 新增 author-writing-style 技能，支持写作风格分析和档案管理
- 新增 yapi-sync 代码规范自动检测功能，扫描项目现有 API 文件推断规范
- 完成 yapi-sync 代码生成集成，支持从 YApi 接口定义自动生成 TypeScript 代码

### 重构

- yapi-sync 规范文件迁移到用户项目目录（`.yapi-sync/api-style.md`）
- yapi-sync 配置文件迁移到用户项目目录（`.yapi-sync/config.json`）
- yapi-sync 移除浏览器自动获取 Cookie 功能，改为手动方式：Cookie 未配置或失效时提示用户手动获取并写入配置文件，不再自动打开浏览器

### 文档

- 更新 README 并移除模板脚手架
- 添加用户文档和指南
- 添加项目交付总结

### 其他

- 添加 skills 目录脚手架和模板
- 更新 author-writing-style 存储路径和 URL 工作流
- 移除不再需要的文件
- 删除测试生成的文件
- 添加完整的测试脚本
