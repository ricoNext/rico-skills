# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**rico-skills** is a collection of Agent Skills distributed via GitHub and marketplace plugins, designed to enhance writing and content workflows. Skills are published to Claude Code and similar tools that support Skill/Plugin marketplaces.

### Key Concepts

- **Skills**: Individual agent capabilities defined by `SKILL.md` files within `skills/<skill-id>/` directories
- **Marketplace**: Aggregated distribution via `.claude-plugin/marketplace.json`, exposing all available skills as a single plugin
- **Catalog**: Machine-readable index in `skills/catalog.yaml` for scripts and CLI tools
- **Author Profiles**: User-specific writing style data stored in `~/.rico-skills/author-writing-style/profiles/` (NOT in the repo)

## Project Structure

```
rico-skills/
├── skills/                          # Skill implementations
│   ├── author-writing-style/        # Writing style learning & rewriting skill
│   │   ├── SKILL.md                # Detailed workflow & API (source of truth)
│   │   └── profiles/               # Read-only reference profiles (no runtime writes)
│   ├── yapi-sync/                  # YApi interface sync skill (in development)
│   │   ├── SKILL.md                # Cookie auth & batch API generation flow
│   │   └── scripts/                # Node.js automation scripts
│   │       ├── fetch-interface.mjs # YApi API fetching script
│   │       ├── login.mjs           # Auto-login script (planned)
│   │       └── package.json        # Script dependencies
│   └── catalog.yaml                # Machine-readable skill index
├── .claude-plugin/
│   └── marketplace.json            # Marketplace plugin configuration
├── docs/                           # Additional documentation
├── scripts/                        # (empty scaffold for future automation)
├── README.md                       # User-facing Chinese documentation
└── README.en.md                    # English variant
```

## Common Commands

### Skill Development & Validation

**Check skill definitions are valid:**
```bash
cat skills/catalog.yaml          # View catalog index
```

**Update marketplace plugin configuration:**
```bash
cat .claude-plugin/marketplace.json  # Review current config
# Edit .claude-plugin/marketplace.json to update skill listings
```

**Review individual skill workflows:**
```bash
cat skills/<skill-id>/SKILL.md   # Read detailed implementation guide
```

### YApi Sync Skill (In-Development)

**Install script dependencies (first-time setup):**
```bash
npm install --prefix skills/yapi-sync/scripts
```

**Run YApi interface fetch script:**
```bash
node skills/yapi-sync/scripts/fetch-interface.mjs <url-or-interface-id>
```

**Preview category expansion only (no detailed fetch):**
```bash
node skills/yapi-sync/scripts/fetch-interface.mjs --resolve-only <category-url>
```

**View/update runtime configuration:**
```bash
cat /path/to/project/.yapi-sync/config.json
# Stores: baseUrl and cookieGitignoreUpdated
cat /path/to/project/.yapi-sync/cookie.json
# Stores: local Cookie only; do not commit
```

## Skill Development Workflow

### Adding a New Skill

1. Create directory: `skills/<skill-id>/`
2. Write `SKILL.md` with frontmatter (name, description) and workflow steps
3. Add entry to `skills/catalog.yaml`
4. Update `.claude-plugin/marketplace.json` if needed to expose new plugin
5. Git commit with message: `feat: add <skill-name> skill`

### Skill SKILL.md Format

Each skill is documented in its own `SKILL.md` file (nested documentation pattern):
- **Frontmatter**: `name`, `id` (if needed), `description` (semantic trigger text)
- **Workflow Steps**: Numbered or named phases, with input/output specifications
- **Error Handling**: Table of failure modes and recovery strategies
- **Examples**: Real-world usage scenarios showing agent interaction

Treat `SKILL.md` as the single source of truth for that skill; future instances will read it to understand behavior.

### Author-Writing-Style Skill

- **Input**: Plain text samples and/or HTTP(S) URLs (agent extracts main body)
- **Output**: Author profiles written to `~/.rico-skills/author-writing-style/profiles/<author_slug>.md`
  - Never writes to `skills/author-writing-style/profiles/` at runtime
  - Profile location is fixed and user-controlled
- **Trigger**: Keywords like "learning my writing style", "update author profile", "apply style"
- **Usage**: Analyze text → extract stylistic rules → save to profile → rewrite new text using stored rules

### YApi Sync Skill (In Development)

- **Input**: YApi interface URLs, interface IDs, or category pages
- **Output**: Generated TypeScript API definitions in `src/api/` (user's project)
- **Authentication**: Two methods for obtaining/storing cookie
  - Method A: User manually provides Cookie string (browser dev tools)
  - Method B: User provides username/password → auto-login via Puppeteer (planned, Task #1)
- **Workflow**: Parse URLs → verify auth → fetch interface definitions → check for conflicts → generate code → lint/type-check
- **Scripts Location**: `skills/yapi-sync/scripts/` (Node.js modules using Puppeteer, ESCodeGen, etc.)

### Task Tracking

Current tasks are stored in the task system (not a file):

```bash
# View all tasks
TaskList

# Get task details
TaskGet 1

# Update task status
TaskUpdate 1 --status in_progress
TaskUpdate 1 --status completed
```

**Active Task #1**: Add username/password auto-login to yapi-sync (Method C above)

## Git Workflow & Release

**Branch Structure**:
- `main` - stable, published version
- `cursor/skills-repo-scaffold` - development branch (current active)

**Commit Messages**: Follow Conventional Commits format
- `feat: <description>` - new feature/skill
- `chore: <description>` - config/tooling updates
- `docs: <description>` - documentation changes
- `fix: <description>` - bug fixes

**Release**: Use `/release-skills` skill (or manually tag versions in `marketplace.json`)

## Important Principles

1. **Separate runtime data from repo**: User profile data lives in `~/.rico-skills/`, NOT in the repository
2. **SKILL.md is authoritative**: All workflow logic and specifications belong in the skill's `SKILL.md`, not elsewhere
3. **Marketplace aggregation**: Currently one aggregated plugin per marketplace (`.claude-plugin/marketplace.json`); individual skills are not separate marketplace entries
4. **Node.js for automation**: CLI scripts use Node.js (Puppeteer, ESCodeGen) for browser automation and code generation
5. **No strong build pipeline**: This is a distribution repo, not a compiled project; skills are delivered as-is

## Testing & Verification

- **author-writing-style**: Manually verify profile files are created in `~/.rico-skills/author-writing-style/profiles/`
- **yapi-sync**: Test with small batches first (1-2 interfaces) before bulk sync; verify generated TypeScript files compile
- **Marketplace plugin**: Validate `.claude-plugin/marketplace.json` structure before publishing

## File Patterns to Avoid

- Do **not** write personal data or user profiles to `skills/<skill-id>/profiles/` at runtime
- Do **not** commit user project `.yapi-sync/cookie.json` with real cookies or credentials
- Do **not** modify marketplace.json without understanding skill listing impact
