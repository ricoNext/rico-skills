# rico-skills

[English](./README.en.md) | 中文

Rico 维护的 **Agent Skills** 集合，以 **GitHub 公开仓库 + 插件市场（marketplace）** 形式分发，可在 Claude Code 等支持 Skill / Plugin 市场的工具中订阅安装，用于提升写作与内容工作流效率。

机器可读索引见 [skills/catalog.yaml](skills/catalog.yaml)。

## 前置要求

- 已安装 **Node.js**（用于可选的快速安装命令 `npx skills …`，以对应 CLI 官方说明为准）。
- 已安装 **Claude Code**（或其它支持「从 GitHub 添加插件市场」的 Agent 客户端），且能访问 **GitHub**。

## 安装

### 快速安装（推荐）

若你使用的环境提供与模板相同的 `**skills` CLI**（以该工具文档为准）：

```bash
npx skills add ricoNext/rico-skills
```

可先执行 `npx skills add ricoNext/rico-skills --list` 预览；当前仓库仅包含 `**author-writing-style**` 一项可安装 skill。

### 发布到 ClawHub / OpenClaw

本仓库**当前未**附带 `scripts/sync-clawhub.sh` 或按 skill 拆分的 ClawHub 发布脚本；若后续将 `skills/`* 作为独立条目发布到 ClawHub，将在此节补充 `clawhub install <skill-name>` 等说明。

### 注册插件市场

在 **Claude Code** 中运行（将本仓库注册为 marketplace 源）：

```bash
/plugin marketplace add ricoNext/rico-skills
```

具体子命令以 Anthropic / Claude Code **当前版本文档**为准。

### 安装技能

**方式一：通过浏览界面**

1. 选择 **Browse and install plugins**
2. 在市场中选择 **rico-skills**（或显示为 `ricoNext/rico-skills` 的源）
3. 选择 **rico-skills** 插件（若市场仅暴露聚合插件，名称以界面为准）
4. 选择 **Install now**

**方式二：直接安装**

```bash
# 安装该 marketplace 中的聚合插件（名称以 /plugin 提示为准）
/plugin install rico-skills@rico-skills
```

若安装命令与上不同，请以 Claude Code 在 `/plugin` 中列出的**实际插件 ID** 为准。

**方式三：告诉 Agent**

直接告诉 Claude Code：

> 请帮我安装 github.com/ricoNext/rico-skills 中的 Skills

### 可用插件

当前 marketplace 设计为暴露**一个聚合插件**，避免同一 skill 被重复注册；其中包含本仓库内全部可分发 skill。


| 插件              | 说明                | 包含内容                                 |
| --------------- | ----------------- | ------------------------------------ |
| **rico-skills** | 写作与作者风格类 Agent 技能 | 仓库 `skills/` 下全部可安装 skill（见下文「可用技能」） |


## 更新技能

将技能更新到最新版本：

1. 在 Claude Code 中运行 `/plugin`
2. 切换到 **Marketplaces** 标签页（方向键或 Tab）
3. 选择 **rico-skills**（或你添加源时显示的名称）
4. 选择 **Update marketplace**

也可选择 **Enable auto-update**，在每次启动时自动拉取默认分支上的最新版本。

## 可用技能

本仓库技能以 **目录 + `SKILL.md`** 形式提供；安装后由 Agent 根据 `SKILL.md` 中 `description` 的语义匹配场景，也可由你在对话中显式说明要使用哪一项。

### 写作与风格 (Writing)

#### author-writing-style

从用户提供的**纯文本**或 **HTTP(S) 网页 URL**（抓取正文后）归纳作者行文习惯，将规范合并写入固定目录 `~/.rico-skills/author-writing-style/profiles/<author_slug>.md`；或依据已有档案**改写**/**生成**中文内容。不向 skill 安装目录内的 `profiles/` 写入个人数据。

**典型用法（自然语言，无固定 slash 命令）**：

- 「用 **author-writing-style** skill，根据我下面这段文字更新默认作者的行文档案」
- 「总结下面链接文章里的写法，并合并进 `ruan-yifeng` 作者档案」
- 「按 default 作者档案，把下面这段改写成同一风格」

详细步骤、网页抓取边界与档案模板见 `[skills/author-writing-style/SKILL.md](skills/author-writing-style/SKILL.md)`。

## 环境配置

本仓库中的 `**author-writing-style`** 以 Markdown 技能为主，**不强制**配置 API 密钥。运行时作者档案写入用户主目录：

- `~/.rico-skills/author-writing-style/profiles/`

请确保运行 Agent 的用户对该路径有读写权限；该目录**不会**随 Git 克隆进入本仓库。

若 Agent 在抓取网页时需要代理或额外工具，请按你所用客户端与网络环境的说明自行配置。

## 自定义扩展

若某个 skill 支持通过侧车文件扩展（例如 `EXTEND.md`），以各 `skills/<skill-id>/SKILL.md` 正文为准。当前 **author-writing-style** 以 `SKILL.md` 为单一事实来源，无单独扩展文件名要求。

## 免责声明

- 从网页归纳文风时，请遵守目标站点服务条款与版权法；本仓库 skill 仅提供**操作指引**，使用者需自行判断合法性与合规性。
- Agent 行为依赖具体模型与客户端版本，以各厂商文档为准。

## 许可证

[MIT](./LICENSE)

## Star History

[Star History Chart](https://www.star-history.com/#ricoNext/rico-skills&Date)