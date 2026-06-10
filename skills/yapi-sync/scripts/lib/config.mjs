import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libDir = path.dirname(fileURLToPath(import.meta.url));
export const scriptsDir = path.resolve(libDir, "..");
export const skillDir = path.resolve(scriptsDir, "..");

/**
 * 获取项目根目录（支持环境变量或参数）
 */
export const getProjectRoot = (explicit) => {
  if (explicit) {
    return explicit;
  }
  return process.env.YAPI_PROJECT_ROOT || null;
};

/**
 * 获取配置文件路径
 * @param {string} projectRoot - 用户项目根目录（可选，默认使用 skill 目录）
 * @returns {string} 配置文件路径
 */
export const getConfigPath = (projectRoot) => {
  if (projectRoot) {
    return path.join(projectRoot, ".yapi-sync", "config.json");
  }
  // 向后兼容：如果未指定项目根目录，使用 skill 目录
  return path.join(skillDir, "config.json");
};

const defaultConfig = {
    baseUrl: "https://yapi.iotbull.com",
    cookie: "",
};

/**
 * 读取配置文件
 * @param {string} projectRoot - 用户项目根目录（可选，支持环境变量）
 * @returns {object} 配置对象
 */
export const readConfig = (projectRoot) => {
    const root = getProjectRoot(projectRoot);
    const configPath = getConfigPath(root);

    if (!fs.existsSync(configPath)) {
        return { ...defaultConfig };
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
        baseUrl: parsed.baseUrl || defaultConfig.baseUrl,
        cookie: parsed.cookie || "",
    };
};

/**
 * 写入配置文件
 * @param {object} config - 配置对象
 * @param {string} projectRoot - 用户项目根目录（可选，支持环境变量）
 * @returns {object} 写入后的配置
 */
export const writeConfig = (config, projectRoot) => {
    const root = getProjectRoot(projectRoot);
    const configPath = getConfigPath(root);
    const configDir = path.dirname(configPath);

    // 确保目录存在
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    const nextConfig = {
        baseUrl: config.baseUrl || defaultConfig.baseUrl,
        cookie: config.cookie || "",
    };
    fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
    return nextConfig;
};
