import fs from 'node:fs';
import path from 'node:path';

export const STYLE_FILE_NAME = 'api-typescript-style.md';
export const DOC_FILES = ['AGENTS.md', 'CLAUDE.md', 'CODEBUDDY.md'];

export const defaultRules = Object.freeze({
  schema_version: 1,
  apiDir: 'src/api',
  requestImport: '@/api',
  requestIdentifier: 'request',
  requestImportStyle: 'default',
  responseMode: 'wrapped',
  responseWrapper: 'Response<T>',
  typeStyle: 'interface',
  typePlacement: 'same-file',
  typeDir: '',
  paramStyle: 'inline',
  naming: 'camelCase',
  formatter: '',
  typecheck: '',
});

const STRING_KEYS = Object.keys(defaultRules).filter((key) => key !== 'schema_version');
const FIELD_ORDER = Object.keys(defaultRules);

export function getStylePath(projectRoot) {
  return path.join(path.resolve(projectRoot), '.rico-skill', STYLE_FILE_NAME);
}

export function validateRules(rules) {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new Error('rules 必须是对象');
  }

  for (const key of Object.keys(rules)) {
    if (!(key in defaultRules)) {
      throw new Error(`rules 包含未知字段: ${key}`);
    }
  }

  if (rules.schema_version !== 1) {
    throw new Error('rules.schema_version 必须是 1');
  }

  for (const key of STRING_KEYS) {
    if (typeof rules[key] !== 'string') {
      throw new Error(`rules.${key} 必须是字符串`);
    }
  }

  if (!rules.apiDir) {
    throw new Error('rules.apiDir 不能为空');
  }

  for (const key of ['apiDir', 'typeDir']) {
    if (rules[key] && (path.isAbsolute(rules[key]) || path.relative('.', rules[key]).startsWith('..'))) {
      throw new Error(`rules.${key} 必须是项目内相对路径`);
    }
  }

  if (!['default', 'named'].includes(rules.requestImportStyle)) {
    throw new Error('rules.requestImportStyle 必须是 default 或 named');
  }
  if (!['wrapped', 'unwrapped'].includes(rules.responseMode)) {
    throw new Error('rules.responseMode 必须是 wrapped 或 unwrapped');
  }
  if (!rules.responseWrapper) {
    throw new Error('rules.responseWrapper 不能为空');
  }
  if (!['interface', 'type'].includes(rules.typeStyle)) {
    throw new Error('rules.typeStyle 必须是 interface 或 type');
  }
  if (!['same-file', 'separate-file'].includes(rules.typePlacement)) {
    throw new Error('rules.typePlacement 必须是 same-file 或 separate-file');
  }
  if (rules.typePlacement === 'separate-file' && !rules.typeDir) {
    throw new Error('独立类型文件必须配置 rules.typeDir');
  }
  if (!['inline', 'separate'].includes(rules.paramStyle)) {
    throw new Error('rules.paramStyle 必须是 inline 或 separate');
  }
  if (!['camelCase', 'snake_case'].includes(rules.naming)) {
    throw new Error('rules.naming 必须是 camelCase 或 snake_case');
  }

  return {
    ...defaultRules,
    ...rules,
  };
}

export function normalizeRules(partial = {}) {
  return validateRules({
    ...defaultRules,
    ...partial,
    schema_version: 1,
  });
}

function typeLocationText(rules) {
  if (rules.typePlacement === 'same-file') {
    return '与 API 函数放在同一个文件';
  }
  return `存放在 \`${rules.typeDir}\``;
}

function requestImportSample(rules) {
  if (rules.requestImportStyle === 'named') {
    return `import { ${rules.requestIdentifier} } from "${rules.requestImport}";`;
  }
  return `import ${rules.requestIdentifier} from "${rules.requestImport}";`;
}

function paramSample(rules) {
  if (rules.paramStyle === 'separate') {
    return `import type { GetUserRequest, UserResponse } from "./types";

export const getUser = (data: GetUserRequest) =>
  ${rules.requestIdentifier}<${rules.responseWrapper.replace('<T>', '<UserResponse>')}>("/user/detail", { data });`;
  }

  return `export const getUser = (data: {
  /** 用户 ID */
  id: number;
}) => ${rules.requestIdentifier}<${rules.responseWrapper.replace('<T>', '<UserResponse>')}>("/user/detail");`;
}

function renderConfigFields(rules) {
  return FIELD_ORDER.map((key) => {
    const value = key === 'schema_version' ? String(rules[key]) : rules[key];
    return `- ${key}: \`${value}\``;
  }).join('\n');
}

/**
 * 从 Markdown「配置字段」列表解析规则。
 * 约定：`- key: \`value\``；空字符串写作 `- key: \`\``。
 */
export function parseMarkdownRuleFields(content, filePath = STYLE_FILE_NAME) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`规则文件为空: ${filePath}`);
  }

  const sectionMatch = content.match(
    /## 配置字段\s*\n([\s\S]*?)(?=\n## |\n---\s*$|$)/,
  );
  if (!sectionMatch) {
    throw new Error(`规则文件缺少「配置字段」章节: ${filePath}`);
  }

  const parsed = {};
  const fieldPattern = /^- ([A-Za-z_]+):\s*`([^`]*)`\s*$/gm;
  let match;
  while ((match = fieldPattern.exec(sectionMatch[1])) !== null) {
    const [, key, value] = match;
    if (parsed[key] !== undefined) {
      throw new Error(`规则字段重复: ${key}`);
    }
    parsed[key] = key === 'schema_version' ? Number(value) : value;
  }

  for (const key of FIELD_ORDER) {
    if (!(key in parsed)) {
      throw new Error(`规则文件缺少字段 ${key}: ${filePath}`);
    }
  }

  for (const key of Object.keys(parsed)) {
    if (!FIELD_ORDER.includes(key)) {
      throw new Error(`rules 包含未知字段: ${key}`);
    }
  }

  return validateRules(parsed);
}

export function renderStyleDocument(rulesInput, meta = {}) {
  const rules = normalizeRules(rulesInput);
  const sourceLine = meta.source
    ? `本文档来源：\`${meta.source}\`${meta.section ? `，章节：「${meta.section}」` : ''}。`
    : '本文档由 api-typescript-style skill 根据项目文档或现有代码归纳生成。';
  const originalSection = meta.originalContent
    ? `## 原始规范说明\n\n${meta.originalContent.trim()}\n\n---\n\n`
    : '';

  return `# API 与 TypeScript 定义规则

${sourceLine}
您可以编辑本文档来调整代码生成规范；修改后请保持下方
「配置字段」与说明一致。脚本只解析「配置字段」列表。

---

${originalSection}## 规范摘要

### 存放位置

- API 文件目录：\`${rules.apiDir}\`

[样本代码]

\`\`\`text
${rules.apiDir}/{module}.ts
\`\`\`

### 请求客户端

- 导入方式：\`${rules.requestImportStyle}\`
- 标识符：\`${rules.requestIdentifier}\`
- 模块路径：\`${rules.requestImport}\`

[样本代码]

\`\`\`typescript
${requestImportSample(rules)}
\`\`\`

### 类型定义风格

- 声明形式：\`${rules.typeStyle}\`
- 存放方式：\`${rules.typePlacement}\`
- 类型目录：\`${rules.typeDir || '（与 API 同文件）'}\`
- 参数类型风格：\`${rules.paramStyle}\`
- 说明：${typeLocationText(rules)}

[样本代码]

\`\`\`typescript
${paramSample(rules)}
\`\`\`

### 响应类型包装

- 响应模式：\`${rules.responseMode}\`
- 包装类型：\`${rules.responseWrapper}\`

[样本代码]

\`\`\`typescript
export const getUser = (data: ...) =>
  ${rules.requestIdentifier}<${rules.responseWrapper}>("/user/detail");
\`\`\`

### 命名规范

| 项目 | 规范 |
| --- | --- |
| **函数命名** | ${rules.naming} |
| **文件命名** | 按路由模块（如 \`/user/*\` → \`user.ts\`） |
| **类型命名** | PascalCase |

### 质量检查命令

- 格式化：\`${rules.formatter || '（未配置）'}\`
- 类型检查：\`${rules.typecheck || '（未配置）'}\`

---

## 配置字段

修改规则时，直接编辑下列字段。
每行格式：短横线、字段名、冒号，以及反引号包裹的值。

${renderConfigFields(rules)}
`;
}

export function parseStyleDocument(content, filePath = STYLE_FILE_NAME) {
  return parseMarkdownRuleFields(content, filePath);
}

export function readStyleDocument(stylePath) {
  if (!fs.existsSync(stylePath)) {
    throw new Error(`未找到 API 与 TypeScript 规则文件: ${stylePath}`);
  }
  return parseStyleDocument(fs.readFileSync(stylePath, 'utf8'), stylePath);
}

export function writeStyleDocument(stylePath, rules, meta = {}) {
  const markdown = renderStyleDocument(rules, meta);
  parseStyleDocument(markdown, stylePath);
  fs.mkdirSync(path.dirname(stylePath), { recursive: true });
  fs.writeFileSync(stylePath, markdown, 'utf8');
  return readStyleDocument(stylePath);
}

export function extractApiStyleFromDoc(content, filename) {
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headerMatch) {
      if (currentSection && currentContent.length > 0) {
        sections.push({
          title: currentSection,
          content: currentContent.join('\n'),
        });
      }
      currentSection = headerMatch[2].trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection && currentContent.length > 0) {
    sections.push({
      title: currentSection,
      content: currentContent.join('\n'),
    });
  }

  const apiKeywords = [
    /api/i,
    /接口/,
    /代码规范/,
    /coding\s+style/i,
    /convention/i,
    /生成规范/,
    /codegen/i,
  ];

  for (const section of sections) {
    const matchesKeyword = apiKeywords.some((regex) => regex.test(section.title));
    if (!matchesKeyword) continue;

    const hasApiInfo =
      /request|axios|fetch/i.test(section.content) ||
      /camelCase|snake_case/i.test(section.content) ||
      /src\/api|lib\/api|services/i.test(section.content) ||
      /Response|ApiResponse/i.test(section.content);

    if (hasApiInfo) {
      return {
        source: filename,
        section: section.title,
        content: section.content.trim(),
      };
    }
  }

  return null;
}

export function inferRulesFromProject(projectRoot) {
  const apiDir =
    ['src/api', 'src/services', 'services', 'api'].find((candidate) =>
      fs.existsSync(path.join(projectRoot, candidate)),
    ) || defaultRules.apiDir;

  const apiFiles = collectSourceFiles(path.join(projectRoot, apiDir));
  const requestImport = firstMatch(
    apiFiles,
    /import\s+(?:\{\s*(\w*request\w*)\s*\}|(\w*request\w*))\s+from\s+['"]([^'"]+)['"]/i,
  );

  const firstSource = apiFiles[0] ? fs.readFileSync(apiFiles[0], 'utf8') : '';
  const typeDir = inferTypeDirectory(projectRoot, firstSource);
  const usesSeparateTypes = Boolean(typeDir && firstMatch(apiFiles, /import\s+type\s+/));
  const usesTypeAliases = Boolean(
    firstMatch(apiFiles, /export\s+type\s+\w+(?:<[^>]+>)?\s*=\s*\{/),
  );
  const usesInlineParams = /=\s*\(\s*data\s*:\s*\{/.test(firstSource);
  const namedImport = Boolean(requestImport?.[1]);
  const identifier =
    requestImport?.[1] || requestImport?.[2] || defaultRules.requestIdentifier;
  const responseWrapperMatch = firstSource.match(
    new RegExp(`${identifier}\\s*<\\s*([A-Za-z0-9_]+)\\s*<`),
  );
  const responseWrapper = responseWrapperMatch
    ? `${responseWrapperMatch[1]}<T>`
    : defaultRules.responseWrapper;

  return normalizeRules({
    apiDir,
    requestIdentifier:
      requestImport?.[1] || requestImport?.[2] || defaultRules.requestIdentifier,
    requestImport: requestImport?.[3] || defaultRules.requestImport,
    requestImportStyle: namedImport ? 'named' : defaultRules.requestImportStyle,
    responseWrapper,
    typeStyle: usesTypeAliases ? 'type' : defaultRules.typeStyle,
    typePlacement: usesSeparateTypes ? 'separate-file' : defaultRules.typePlacement,
    typeDir: usesSeparateTypes ? typeDir : '',
    paramStyle: usesInlineParams ? 'inline' : usesSeparateTypes ? 'separate' : 'inline',
  });
}

function collectSourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (
      entry.isDirectory() &&
      !['node_modules', '.git', '.rico-skill', 'dist', 'build'].includes(entry.name)
    ) {
      return collectSourceFiles(absolute);
    }
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

function firstMatch(files, expression) {
  for (const file of files) {
    const match = fs.readFileSync(file, 'utf8').match(expression);
    if (match) return match;
  }
  return null;
}

function inferTypeDirectory(projectRoot, source) {
  const imported = source.match(/from\s+['"](?:@\/)?((?:types|type)(?:\/[^'"]*)?)['"]/i)?.[1];
  if (imported) return `src/${imported.split('/')[0]}`;
  return (
    ['src/types', 'src/api/types', 'types'].find((candidate) =>
      fs.existsSync(path.join(projectRoot, candidate)),
    ) || ''
  );
}

export function ensureStyleDocument(projectRoot, options = {}) {
  const stylePath = getStylePath(projectRoot);
  if (fs.existsSync(stylePath)) {
    return {
      status: 'exists',
      stylePath,
      rules: readStyleDocument(stylePath),
    };
  }

  if (options.rules) {
    const rules = writeStyleDocument(stylePath, options.rules, options.meta || {});
    return { status: 'created', stylePath, rules, source: 'provided' };
  }

  if (options.infer) {
    const rules = writeStyleDocument(stylePath, inferRulesFromProject(projectRoot), {
      source: 'project-source',
    });
    return { status: 'created', stylePath, rules, source: 'inferred' };
  }

  for (const docFile of DOC_FILES) {
    const docPath = path.join(projectRoot, docFile);
    if (!fs.existsSync(docPath)) continue;
    const extracted = extractApiStyleFromDoc(fs.readFileSync(docPath, 'utf8'), docFile);
    if (!extracted) continue;
    const rules = writeStyleDocument(stylePath, defaultRules, {
      source: extracted.source,
      section: extracted.section,
      originalContent: extracted.content,
    });
    return {
      status: 'created',
      stylePath,
      rules,
      source: 'document',
      extracted,
    };
  }

  return {
    status: 'missing',
    stylePath,
    docsChecked: DOC_FILES,
  };
}
