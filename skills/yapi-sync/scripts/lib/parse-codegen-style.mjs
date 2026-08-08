import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_KEYS = [
  'schema_version',
  'apiDir',
  'requestImport',
  'requestIdentifier',
  'requestImportStyle',
  'responseMode',
  'responseWrapper',
  'typeStyle',
  'typePlacement',
  'typeDir',
  'paramStyle',
  'naming',
  'formatter',
  'typecheck',
];

/**
 * 严格读取公共规范文件的 Markdown「配置字段」列表。
 * 缺失或无效时抛错，不回退默认值。
 */
export function parseCodegenStyle(projectRoot) {
  const styleFile = path.join(projectRoot, '.rico-skill', 'api-typescript-style.md');
  if (!fs.existsSync(styleFile)) {
    throw new Error(
      `未找到 API 与 TypeScript 规则文件: ${styleFile}。请立即按 api-typescript-style skill 自动创建该文件，完成后继续同步；不要结束对话。`,
    );
  }

  const content = fs.readFileSync(styleFile, 'utf8');
  return validateCodegenRules(parseMarkdownRuleFields(content, styleFile), styleFile);
}

function parseMarkdownRuleFields(content, filePath) {
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

  return parsed;
}

function validateCodegenRules(rules, styleFile) {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new Error(`规则文件格式无效: ${styleFile}`);
  }

  for (const key of Object.keys(rules)) {
    if (!REQUIRED_KEYS.includes(key)) {
      throw new Error(`rules 包含未知字段: ${key}`);
    }
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in rules)) {
      throw new Error(`规则文件缺少字段 ${key}: ${styleFile}`);
    }
  }
  if (rules.schema_version !== 1) {
    throw new Error('rules.schema_version 必须是 1');
  }
  for (const key of REQUIRED_KEYS.filter((item) => item !== 'schema_version')) {
    if (typeof rules[key] !== 'string') {
      throw new Error(`rules.${key} 必须是字符串`);
    }
  }
  if (!rules.apiDir) throw new Error('rules.apiDir 不能为空');
  if (!['default', 'named'].includes(rules.requestImportStyle)) {
    throw new Error('rules.requestImportStyle 必须是 default 或 named');
  }
  if (!['wrapped', 'unwrapped'].includes(rules.responseMode)) {
    throw new Error('rules.responseMode 必须是 wrapped 或 unwrapped');
  }
  if (!rules.responseWrapper) throw new Error('rules.responseWrapper 不能为空');
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

  return rules;
}

/**
 * 根据规范配置生成函数名
 */
export function generateFunctionName(apiPath, method, naming = 'camelCase') {
  const parts = apiPath
    .split('/')
    .filter((part) => part && part !== 'v1' && part !== 'v2' && !part.match(/^\{/));

  if (parts.length === 0) {
    parts.push('request');
  }

  const verbMap = {
    get: 'get',
    post: 'create',
    put: 'update',
    patch: 'update',
    delete: 'delete',
  };

  const verb = verbMap[method.toLowerCase()] || 'request';
  const actionWords = [
    'create',
    'update',
    'delete',
    'list',
    'detail',
    'info',
    'get',
    'set',
  ];

  let resource;
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].toLowerCase();
    resource = actionWords.includes(lastPart)
      ? parts[parts.length - 2]
      : parts[parts.length - 1];
  } else {
    resource = parts[0];
  }

  let name = verb + resource.charAt(0).toUpperCase() + resource.slice(1);
  if (naming === 'snake_case') {
    name = name.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
  return name;
}

export function renderRequestImport(config) {
  if (config.requestImportStyle === 'named') {
    return `import { ${config.requestIdentifier} } from "${config.requestImport}";`;
  }
  return `import ${config.requestIdentifier} from "${config.requestImport}";`;
}

export default {
  parseCodegenStyle,
  generateFunctionName,
  renderRequestImport,
};
