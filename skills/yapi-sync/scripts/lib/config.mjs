import fs from "node:fs";
import path from "node:path";

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
 * 获取 .rico-skill/yapi-sync 目录路径
 * @param {string} projectRoot - 用户项目根目录（可选，默认使用当前工作目录）
 * @returns {string} .rico-skill/yapi-sync 目录路径
 */
export const getYapiSyncDir = (projectRoot) => {
  if (projectRoot) {
    return path.join(projectRoot, ".rico-skill", "yapi-sync");
  }
  // 未指定项目根目录时，使用当前工作目录作为项目根目录
  return path.join(process.cwd(), ".rico-skill", "yapi-sync");
};

/**
 * 获取配置文件路径
 * @param {string} projectRoot - 用户项目根目录（可选，默认使用当前工作目录）
 * @returns {string} 配置文件路径
 */
export const getConfigPath = (projectRoot) => path.join(getYapiSyncDir(projectRoot), "config.json");

/**
 * 获取 Cookie 文件路径
 * @param {string} projectRoot - 用户项目根目录（可选，默认使用当前工作目录）
 * @returns {string} Cookie 文件路径
 */
export const getCookiePath = (projectRoot) => path.join(getYapiSyncDir(projectRoot), "cookie.txt");

export const COOKIE_GITIGNORE_ENTRY = ".rico-skill/yapi-sync/cookie.txt";

const defaultConfig = {
    baseUrl: "https://yapi.iotbull.com",
    cookieGitignoreUpdated: false,
};

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const readConfigFile = (projectRoot) => {
    const configPath = getConfigPath(projectRoot);

    if (!fs.existsSync(configPath)) {
        return {};
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
};

const normalizeConfig = (config) => ({
    baseUrl: config.baseUrl || defaultConfig.baseUrl,
    cookieGitignoreUpdated: Boolean(config.cookieGitignoreUpdated),
});

const writeConfigFile = (config, projectRoot) => {
    const configPath = getConfigPath(projectRoot);
    ensureDir(path.dirname(configPath));

    const nextConfig = normalizeConfig(config);
    fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
    return nextConfig;
};

const gitignoreAlreadyCoversCookie = (content) => {
    const entries = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

    return entries.some((entry) =>
        [
            COOKIE_GITIGNORE_ENTRY,
            `/${COOKIE_GITIGNORE_ENTRY}`,
        ].includes(entry)
    );
};

/**
 * 确保用户项目的 .gitignore 忽略 Cookie 文件，并在 config 中记录状态
 * @param {string} projectRoot - 用户项目根目录（可选，支持环境变量）
 * @param {object} config - 已读取的配置对象（可选，避免重复读取）
 * @returns {boolean} 是否已确保忽略规则存在
 */
export const ensureCookieGitignore = (projectRoot, config) => {
    const root = getProjectRoot(projectRoot);
    if (!root) {
        return false;
    }

    const currentConfig = normalizeConfig(config || readConfigFile(root));

    const gitignorePath = path.join(root, ".gitignore");
    const currentContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf-8") : "";
    let nextContent = currentContent;

    const isIgnored = gitignoreAlreadyCoversCookie(currentContent);
    if (!isIgnored) {
        const prefix = currentContent && !currentContent.endsWith("\n") ? "\n" : "";
        nextContent = `${currentContent}${prefix}${COOKIE_GITIGNORE_ENTRY}\n`;
        fs.writeFileSync(gitignorePath, nextContent);
    }

    if (!currentConfig.cookieGitignoreUpdated || !isIgnored) {
        writeConfigFile({ ...currentConfig, cookieGitignoreUpdated: true }, root);
    }
    return true;
};

/**
 * 读取 Cookie 文件
 * @param {string} projectRoot - 用户项目根目录（可选，支持环境变量）
 * @returns {string} Cookie 字符串
 */
export const readCookie = (projectRoot) => {
    const root = getProjectRoot(projectRoot);
    const cookiePath = getCookiePath(root);

    if (!fs.existsSync(cookiePath)) {
        return "";
    }

    return fs.readFileSync(cookiePath, "utf-8").trim();
};

/**
 * 写入 Cookie 文件
 * @param {string} cookie - Cookie 字符串
 * @param {string} projectRoot - 用户项目根目录（可选，支持环境变量）
 * @returns {string} 写入后的 Cookie 字符串
 */
export const writeCookie = (cookie, projectRoot) => {
    const root = getProjectRoot(projectRoot);
    const cookiePath = getCookiePath(root);
    ensureDir(path.dirname(cookiePath));

    const nextCookie = String(cookie || "").trim();
    fs.writeFileSync(cookiePath, nextCookie);
    ensureCookieGitignore(root);
    return nextCookie;
};

/**
 * 读取配置文件
 * @param {string} projectRoot - 用户项目根目录（可选，支持环境变量）
 * @returns {object} 配置对象
 */
export const readConfig = (projectRoot) => {
    const root = getProjectRoot(projectRoot);
    const parsed = readConfigFile(root);
    const nextConfig = normalizeConfig(parsed);
    let cookie = readCookie(root);

    if (!cookie && parsed.cookie) {
        cookie = writeCookie(parsed.cookie, root);
    }

    if (root && !nextConfig.cookieGitignoreUpdated) {
        nextConfig.cookieGitignoreUpdated = ensureCookieGitignore(root, nextConfig);
    }

    if (
        !fs.existsSync(getConfigPath(root)) ||
        Object.hasOwn(parsed, "cookie") ||
        parsed.baseUrl !== nextConfig.baseUrl ||
        Boolean(parsed.cookieGitignoreUpdated) !== nextConfig.cookieGitignoreUpdated
    ) {
        writeConfigFile(nextConfig, root);
    }

    return {
        ...nextConfig,
        cookie,
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
    const currentConfig = normalizeConfig(readConfigFile(root));

    if (Object.hasOwn(config, "cookie")) {
        writeCookie(config.cookie, root);
    }

    const nextConfig = {
        baseUrl: config.baseUrl || currentConfig.baseUrl,
        cookieGitignoreUpdated: Object.hasOwn(config, "cookieGitignoreUpdated")
            ? Boolean(config.cookieGitignoreUpdated)
            : currentConfig.cookieGitignoreUpdated,
    };

    if (root && !nextConfig.cookieGitignoreUpdated) {
        nextConfig.cookieGitignoreUpdated = ensureCookieGitignore(root, nextConfig);
    }

    return {
        ...writeConfigFile(nextConfig, root),
        cookie: readCookie(root),
    };
};
