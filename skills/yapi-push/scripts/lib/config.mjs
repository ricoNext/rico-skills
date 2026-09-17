import fs from "node:fs";
import path from "node:path";

export const COOKIE_GITIGNORE_ENTRY = ".rico-skill/yapi-sync/cookie.txt";

const defaultYapiSyncConfig = {
    baseUrl: "https://yapi.iotbull.com",
    cookieGitignoreUpdated: false,
};

const defaultPushConfig = {
    catId: null,
    projectId: null,
};

export const getProjectRoot = (explicit) => {
    if (explicit) {
        return explicit;
    }

    return process.env.YAPI_PROJECT_ROOT || process.cwd();
};

export const getYapiSyncDir = (projectRoot) =>
    path.join(getProjectRoot(projectRoot), ".rico-skill", "yapi-sync");

export const getPushDir = (projectRoot) =>
    path.join(getProjectRoot(projectRoot), ".rico-skill", "yapi-push");

export const getConfigPath = (projectRoot) => path.join(getYapiSyncDir(projectRoot), "config.json");

export const getCookiePath = (projectRoot) => path.join(getYapiSyncDir(projectRoot), "cookie.txt");

export const getPushConfigPath = (projectRoot) => path.join(getPushDir(projectRoot), "config.json");

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const readJsonFile = (filePath) => {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writeJsonFile = (filePath, value) => {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const gitignoreAlreadyCoversCookie = (content) => {
    const entries = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

    return entries.some((entry) => [COOKIE_GITIGNORE_ENTRY, `/${COOKIE_GITIGNORE_ENTRY}`].includes(entry));
};

export const ensureCookieGitignore = (projectRoot) => {
    const root = getProjectRoot(projectRoot);
    const gitignorePath = path.join(root, ".gitignore");
    const currentContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";

    if (!gitignoreAlreadyCoversCookie(currentContent)) {
        const prefix = currentContent && !currentContent.endsWith("\n") ? "\n" : "";
        fs.writeFileSync(gitignorePath, `${currentContent}${prefix}${COOKIE_GITIGNORE_ENTRY}\n`);
    }

    const currentConfig = readJsonFile(getConfigPath(root));
    writeJsonFile(getConfigPath(root), {
        baseUrl: currentConfig.baseUrl || defaultYapiSyncConfig.baseUrl,
        cookieGitignoreUpdated: true,
    });
};

export const readCookie = (projectRoot) => {
    const cookiePath = getCookiePath(projectRoot);
    if (!fs.existsSync(cookiePath)) {
        return "";
    }

    return fs.readFileSync(cookiePath, "utf8").trim();
};

export const writeCookie = (cookie, projectRoot) => {
    const cookiePath = getCookiePath(projectRoot);
    ensureDir(path.dirname(cookiePath));
    const nextCookie = String(cookie || "").trim();
    fs.writeFileSync(cookiePath, nextCookie);
    ensureCookieGitignore(projectRoot);
    return nextCookie;
};

const normalizeYapiSyncConfig = (config) => ({
    baseUrl: config.baseUrl || defaultYapiSyncConfig.baseUrl,
    cookieGitignoreUpdated: Boolean(config.cookieGitignoreUpdated),
});

export const readYapiSyncConfig = (projectRoot) => {
    const root = getProjectRoot(projectRoot);
    const parsed = readJsonFile(getConfigPath(root));
    const nextConfig = normalizeYapiSyncConfig(parsed);
    let cookie = readCookie(root);

    if (!cookie && parsed.cookie) {
        cookie = writeCookie(parsed.cookie, root);
    }

    if (!nextConfig.cookieGitignoreUpdated) {
        ensureCookieGitignore(root);
        nextConfig.cookieGitignoreUpdated = true;
    }

    if (!fs.existsSync(getConfigPath(root)) || Object.hasOwn(parsed, "cookie")) {
        writeJsonFile(getConfigPath(root), {
            baseUrl: nextConfig.baseUrl,
            cookieGitignoreUpdated: nextConfig.cookieGitignoreUpdated,
        });
    }

    return {
        ...nextConfig,
        cookie,
    };
};

export const writeYapiSyncConfig = (config, projectRoot) => {
    const root = getProjectRoot(projectRoot);
    const current = readYapiSyncConfig(root);

    if (Object.hasOwn(config, "cookie")) {
        writeCookie(config.cookie, root);
    }

    const nextConfig = {
        baseUrl: config.baseUrl || current.baseUrl,
        cookieGitignoreUpdated: true,
    };
    writeJsonFile(getConfigPath(root), nextConfig);
    ensureCookieGitignore(root);

    return {
        ...nextConfig,
        cookie: readCookie(root),
    };
};

const toNullableNumber = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
};

export const readPushConfig = (projectRoot) => {
    const parsed = readJsonFile(getPushConfigPath(projectRoot));
    return {
        catId: toNullableNumber(parsed.catId ?? parsed.catid),
        projectId: toNullableNumber(parsed.projectId ?? parsed.project_id),
    };
};

export const writePushConfig = (config, projectRoot) => {
    const current = readPushConfig(projectRoot);
    const nextConfig = {
        catId: toNullableNumber(config.catId ?? config.catid) ?? current.catId,
        projectId: toNullableNumber(config.projectId ?? config.project_id) ?? current.projectId,
    };
    writeJsonFile(getPushConfigPath(projectRoot), nextConfig);
    return nextConfig;
};

export const readConfig = (projectRoot) => {
    const yapiSync = readYapiSyncConfig(projectRoot);
    const push = readPushConfig(projectRoot);

    return {
        baseUrl: yapiSync.baseUrl,
        catId: push.catId,
        cookie: yapiSync.cookie,
        cookieGitignoreUpdated: yapiSync.cookieGitignoreUpdated,
        projectId: push.projectId,
    };
};
