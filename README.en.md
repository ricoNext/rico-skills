# rico-skills

[English](./README.en.md) | [中文](./README.md)

A public **Agent Skills** marketplace on GitHub. Install via Claude Code (or compatible clients) to use Markdown-based skills such as **author-writing-style**.

Machine-readable index: `[skills/catalog.yaml](skills/catalog.yaml)`.

## Prerequisites

- **Node.js** (optional, for `npx skills add …` if your toolchain supports it).
- **Claude Code** (or similar) with access to **GitHub**.

## Install

### Quick install (recommended)

```bash
npx skills add ricoNext/rico-skills
```

Run `npx skills add ricoNext/rico-skills --list` to preview. This repo currently ships only **`author-writing-style`**.

### Register marketplace (Claude Code)

```bash
/plugin marketplace add ricoNext/rico-skills
```

### Install the bundle

Use **Browse and install plugins**, or:

```bash
/plugin install rico-skills@rico-skills
```

Or ask the agent:

> Please install the Skills from github.com/ricoNext/rico-skills

### Plugin


| Plugin          | Contents                                                     |
| --------------- | ------------------------------------------------------------ |
| **rico-skills** | All skills under `skills/` (see Chinese README for details). |


## Update

`/plugin` → **Marketplaces** → **rico-skills** → **Update marketplace** (or enable auto-update).

## Skills

### author-writing-style

Learn writing habits from pasted text or fetched web pages; store profiles under `~/.rico-skills/author-writing-style/profiles/`; rewrite or generate Chinese text to match a profile. See `[skills/author-writing-style/SKILL.md](skills/author-writing-style/SKILL.md)`.

## License

[MIT](./LICENSE)