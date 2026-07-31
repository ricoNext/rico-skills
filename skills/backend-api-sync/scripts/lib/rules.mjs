import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_RULE_PATH = '.rico-skill/backend-api-sync-rules.md';
const DOCUMENT_NAMES = ['AGENTS.md', 'CLAUDE.md', 'CODEBUDDY.md'];
const CONVENTION_PATTERN = /API|接口|request|axios|fetch|src\/api|services/i;

export const defaultRules = Object.freeze({
  apiDir: 'src/api',
  requestImport: '@/api',
  requestIdentifier: 'request',
  responseMode: 'wrapped',
  typeStyle: 'interface',
  formatter: '',
  typecheck: '',
});

function ruleDocument(rules) {
  return `# 后端接口同步规则\n\n## API 目录\n\n生成文件默认放在 \`${rules.apiDir}\`。可按项目实际结构修改下方规则块。\n\n## 生成规则\n\n\`\`\`json\n${JSON.stringify(rules, null, 2)}\n\`\`\`\n`;
}

function sourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) return sourceFiles(absolute);
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

function inferRules(projectRoot) {
  const apiDir = ['src/api', 'src/services', 'services', 'api'].find((candidate) => fs.existsSync(path.join(projectRoot, candidate))) || defaultRules.apiDir;
  const firstSource = sourceFiles(path.join(projectRoot, apiDir))[0];
  if (!firstSource) return { ...defaultRules, apiDir };
  const content = fs.readFileSync(firstSource, 'utf8');
  const requestImport = content.match(/import\s+\{\s*(\w*request\w*)\s*\}\s+from\s+['"]([^'"]+)['"]/i);
  return {
    ...defaultRules,
    apiDir,
    requestIdentifier: requestImport?.[1] || defaultRules.requestIdentifier,
    requestImport: requestImport?.[2] || defaultRules.requestImport,
  };
}

export function discoverRules(projectRoot, defaultRulePath = DEFAULT_RULE_PATH) {
  for (const name of DOCUMENT_NAMES) {
    const absolutePath = path.join(projectRoot, name);
    if (fs.existsSync(absolutePath) && CONVENTION_PATTERN.test(fs.readFileSync(absolutePath, 'utf8'))) {
      return { rulePath: name, source: 'document' };
    }
  }

  const absoluteRulePath = path.join(projectRoot, defaultRulePath);
  if (!fs.existsSync(absoluteRulePath)) {
    fs.mkdirSync(path.dirname(absoluteRulePath), { recursive: true });
    fs.writeFileSync(absoluteRulePath, ruleDocument(inferRules(projectRoot)));
  }
  return { rulePath: defaultRulePath, source: 'generated' };
}

export function readRules(projectRoot, rulePath) {
  const content = fs.readFileSync(path.join(projectRoot, rulePath), 'utf8');
  const match = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return inferRules(projectRoot);

  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`规则文件中的 JSON 无效: ${error.message}`);
  }
  return { ...defaultRules, ...parsed };
}
