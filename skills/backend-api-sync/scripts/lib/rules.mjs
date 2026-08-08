import fs from 'node:fs';
import path from 'node:path';

export const defaultRules = Object.freeze({
  schema_version: 1,
  apiDir: 'src/api',
  requestImport: '@/api',
  requestIdentifier: 'request',
  requestImportStyle: 'named',
  responseMode: 'wrapped',
  responseWrapper: 'Response<T>',
  typeStyle: 'interface',
  typePlacement: 'same-file',
  typeDir: '',
  paramStyle: 'separate',
  naming: 'camelCase',
  formatter: '',
  typecheck: '',
});

const REQUIRED_KEYS = Object.keys(defaultRules);

export function validateRules(rules) {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new Error('rules 必须是对象');
  }

  for (const key of Object.keys(rules)) {
    if (!REQUIRED_KEYS.includes(key)) {
      throw new Error(`rules 包含未知字段: ${key}`);
    }
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in rules)) {
      throw new Error(`rules 缺少字段: ${key}`);
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
  for (const key of ['apiDir', 'typeDir']) {
    if (rules[key] && (path.isAbsolute(rules[key]) || path.relative('.', rules[key]).startsWith('..'))) {
      throw new Error(`rules.${key} 必须是项目内相对路径`);
    }
  }
  if (!['default', 'named'].includes(rules.requestImportStyle)) {
    throw new Error('rules.requestImportStyle 必须是 default 或 named');
  }
  if (rules.responseMode !== 'wrapped' && rules.responseMode !== 'unwrapped') {
    throw new Error('rules.responseMode 必须是 wrapped 或 unwrapped');
  }
  if (!rules.responseWrapper) throw new Error('rules.responseWrapper 不能为空');
  if (rules.typeStyle !== 'interface' && rules.typeStyle !== 'type') {
    throw new Error('rules.typeStyle 必须是 interface 或 type');
  }
  if (rules.typePlacement !== 'same-file' && rules.typePlacement !== 'separate-file') {
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

export function readRulesDocument(rulesPath) {
  if (!fs.existsSync(rulesPath)) {
    throw new Error(
      `未找到 API 与 TypeScript 规则文件: ${rulesPath}。请立即按 api-typescript-style skill 自动创建该文件，完成后继续同步；不要结束对话。`,
    );
  }
  const content = fs.readFileSync(rulesPath, 'utf8');
  try {
    return validateRules(parseMarkdownRuleFields(content, rulesPath));
  } catch (error) {
    throw new Error(`规则文件格式无效: ${error.message}`);
  }
}
