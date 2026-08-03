import fs from 'node:fs';
import path from 'node:path';
import { isAbsoluteExistingDirectory, getRuntimePaths } from './paths.mjs';
import { ensureRulesDocument, readRulesDocument } from './rules.mjs';

const PROJECT_KEYS = new Set(['name', 'language', 'path']);
const CONFIG_KEYS = new Set(['projects']);

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} 包含未知字段: ${key}`);
  }
}

export function validateProjects(projects) {
  if (!Array.isArray(projects) || projects.length === 0) throw new Error('projects 必须是非空数组');
  const names = new Set();
  for (const project of projects) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('项目必须是对象');
    assertOnlyKeys(project, PROJECT_KEYS, '项目');
    if (typeof project.name !== 'string' || !project.name.trim()) throw new Error('项目 name 必须是非空字符串');
    if (names.has(project.name)) throw new Error(`项目 name 重复: ${project.name}`);
    if (typeof project.language !== 'string' || !project.language.trim()) throw new Error(`项目 ${project.name} 缺少 language`);
    if (!isAbsoluteExistingDirectory(project.path)) throw new Error(`项目 ${project.name} 的 path 必须是存在的绝对目录`);
    names.add(project.name);
  }
}

function ensureGitignoreEntry(projectRoot, entry) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const current = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  if (current.split(/\r?\n/).includes(entry)) return;
  fs.writeFileSync(gitignorePath, `${current}${current && !current.endsWith('\n') ? '\n' : ''}${entry}\n`);
}

export function ensureConfigTemplate(projectRoot) {
  const { configDir, configPath } = getRuntimePaths(projectRoot);
  if (fs.existsSync(configPath)) return { created: false, configPath };
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify({ projects: [] }, null, 2)}\n`);
  return { created: true, configPath };
}

export function initializeConfig(projectRoot, projects) {
  validateProjects(projects);
  const paths = getRuntimePaths(projectRoot);
  fs.mkdirSync(paths.configDir, { recursive: true });
  const config = { projects };
  fs.writeFileSync(paths.configPath, `${JSON.stringify(config, null, 2)}\n`);
  ensureGitignoreEntry(projectRoot, '.rico-skill/backend-api-sync/config.json');
  return config;
}

export function finalizeConfig(projectRoot) {
  const { configPath, rulesPath } = getRuntimePaths(projectRoot);
  if (!fs.existsSync(configPath)) throw new Error(`未找到配置文件: ${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('配置文件必须是对象');
  assertOnlyKeys(config, CONFIG_KEYS, '配置文件');
  validateProjects(config.projects);
  const rules = ensureRulesDocument(projectRoot, rulesPath);
  ensureGitignoreEntry(projectRoot, '.rico-skill/backend-api-sync/config.json');
  return { projects: config.projects, rules };
}

export function validateConfiguredProjects(projectRoot) {
  const { configPath } = getRuntimePaths(projectRoot);
  if (!fs.existsSync(configPath)) throw new Error(`未找到配置文件: ${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('配置文件必须是对象');
  assertOnlyKeys(config, CONFIG_KEYS, '配置文件');
  validateProjects(config.projects);
  return config.projects;
}

export function readConfig(projectRoot) {
  const { configPath } = getRuntimePaths(projectRoot);
  if (!fs.existsSync(configPath)) throw new Error(`未找到配置文件: ${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('配置文件必须是对象');
  assertOnlyKeys(config, CONFIG_KEYS, '配置文件');
  validateProjects(config.projects);
  return { projects: config.projects };
}

export function readConfiguredRules(projectRoot) {
  return readRulesDocument(getRuntimePaths(projectRoot).rulesPath);
}
