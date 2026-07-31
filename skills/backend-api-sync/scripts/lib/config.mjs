import fs from 'node:fs';
import path from 'node:path';

import { isAbsoluteExistingDirectory, getRuntimePaths } from './paths.mjs';
import { discoverRules } from './rules.mjs';

const PROJECT_KEYS = new Set(['name', 'language', 'path']);
const CONFIG_KEYS = new Set(['projects', 'rulePath']);

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
  const { runtimeDir, configPath } = getRuntimePaths(projectRoot);
  if (fs.existsSync(configPath)) return { created: false, configPath };
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify({ projects: [], rulePath: '' }, null, 2)}\n`);
  return { created: true, configPath };
}

export function initializeConfig(projectRoot, projects) {
  validateProjects(projects);
  const paths = getRuntimePaths(projectRoot);
  fs.mkdirSync(paths.runtimeDir, { recursive: true });
  const rule = discoverRules(projectRoot, paths.defaultRulePath);
  const config = { projects, rulePath: rule.rulePath };
  fs.writeFileSync(paths.configPath, `${JSON.stringify(config, null, 2)}\n`);
  ensureGitignoreEntry(projectRoot, '.rico-skill/backend-api-sync.config');
  return config;
}

function resolveConfiguredRulePath(projectRoot, rulePath) {
  if (rulePath) {
    const resolvedProjectRoot = path.resolve(projectRoot);
    const resolvedRulePath = typeof rulePath === 'string' ? path.resolve(projectRoot, rulePath) : '';
    if (typeof rulePath !== 'string' || path.isAbsolute(rulePath) || !(resolvedRulePath === resolvedProjectRoot || resolvedRulePath.startsWith(`${resolvedProjectRoot}${path.sep}`))) {
      throw new Error('rulePath 必须是相对前端项目根目录的路径');
    }
    if (fs.existsSync(resolvedRulePath) && fs.statSync(resolvedRulePath).isFile()) return rulePath;
  }
  return discoverRules(projectRoot, getRuntimePaths(projectRoot).defaultRulePath).rulePath;
}

export function finalizeConfig(projectRoot) {
  const { configPath } = getRuntimePaths(projectRoot);
  if (!fs.existsSync(configPath)) throw new Error(`未找到配置文件: ${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('配置文件必须是对象');
  assertOnlyKeys(config, CONFIG_KEYS, '配置文件');
  validateProjects(config.projects);
  const finalized = { projects: config.projects, rulePath: resolveConfiguredRulePath(projectRoot, config.rulePath) };
  fs.writeFileSync(configPath, `${JSON.stringify(finalized, null, 2)}\n`);
  ensureGitignoreEntry(projectRoot, '.rico-skill/backend-api-sync.config');
  return finalized;
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
  const resolvedRulePath = typeof config.rulePath === 'string' ? path.resolve(projectRoot, config.rulePath) : '';
  const resolvedProjectRoot = path.resolve(projectRoot);
  if (typeof config.rulePath !== 'string' || !config.rulePath || path.isAbsolute(config.rulePath) || !(resolvedRulePath === resolvedProjectRoot || resolvedRulePath.startsWith(`${resolvedProjectRoot}${path.sep}`))) {
    throw new Error('rulePath 必须是相对前端项目根目录的路径');
  }
  return config;
}
