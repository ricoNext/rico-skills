import fs from 'node:fs';
import path from 'node:path';

export const defaultRules = Object.freeze({
  apiDir: 'src/api',
  requestImport: '@/api',
  requestIdentifier: 'request',
  responseMode: 'wrapped',
  typeStyle: 'interface',
  typePlacement: 'same-file',
  typeDir: '',
  formatter: '',
  typecheck: '',
});

function sourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', '.rico-skill', 'dist', 'build'].includes(entry.name)) return sourceFiles(absolute);
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
  return ['src/types', 'src/api/types', 'types'].find((candidate) => fs.existsSync(path.join(projectRoot, candidate))) || '';
}

export function summarizeProjectRules(projectRoot) {
  const apiDir = ['src/api', 'src/services', 'services', 'api'].find((candidate) => fs.existsSync(path.join(projectRoot, candidate))) || defaultRules.apiDir;
  const apiFiles = sourceFiles(path.join(projectRoot, apiDir));
  const allSourceFiles = sourceFiles(path.join(projectRoot, 'src'));
  const requestImport = firstMatch(apiFiles, /import\s+\{\s*(\w*request\w*)\s*\}\s+from\s+['"]([^'"]+)['"]/i);
  const firstSource = apiFiles[0] ? fs.readFileSync(apiFiles[0], 'utf8') : '';
  const typeDir = inferTypeDirectory(projectRoot, firstSource);
  const usesSeparateTypes = Boolean(typeDir && firstMatch(apiFiles, /import\s+type\s+/));
  const usesTypeAliases = Boolean(firstMatch([...apiFiles, ...allSourceFiles], /export\s+type\s+\w+(?:<[^>]+>)?\s*=\s*\{/));
  return {
    ...defaultRules,
    apiDir,
    requestIdentifier: requestImport?.[1] || defaultRules.requestIdentifier,
    requestImport: requestImport?.[2] || defaultRules.requestImport,
    typeStyle: usesTypeAliases ? 'type' : defaultRules.typeStyle,
    typePlacement: usesSeparateTypes ? 'separate-file' : defaultRules.typePlacement,
    typeDir: usesSeparateTypes ? typeDir : '',
  };
}

export function validateRules(rules) {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) throw new Error('rules 必须是对象');
  const keys = Object.keys(defaultRules);
  for (const key of Object.keys(rules)) {
    if (!keys.includes(key)) throw new Error(`rules 包含未知字段: ${key}`);
  }
  for (const key of keys) {
    if (typeof rules[key] !== 'string') throw new Error(`rules.${key} 必须是字符串`);
  }
  if (!rules.apiDir) throw new Error('rules.apiDir 不能为空');
  for (const key of ['apiDir', 'typeDir']) {
    if (rules[key] && (path.isAbsolute(rules[key]) || path.relative('.', rules[key]).startsWith('..'))) {
      throw new Error(`rules.${key} 必须是项目内相对路径`);
    }
  }
  if (rules.responseMode !== 'wrapped' && rules.responseMode !== 'unwrapped') throw new Error('rules.responseMode 必须是 wrapped 或 unwrapped');
  if (rules.typeStyle !== 'interface' && rules.typeStyle !== 'type') throw new Error('rules.typeStyle 必须是 interface 或 type');
  if (rules.typePlacement !== 'same-file' && rules.typePlacement !== 'separate-file') throw new Error('rules.typePlacement 必须是 same-file 或 separate-file');
  if (rules.typePlacement === 'separate-file' && !rules.typeDir) throw new Error('独立类型文件必须配置 rules.typeDir');
  return rules;
}
