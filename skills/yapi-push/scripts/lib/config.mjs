import fs from "node:fs";
import path from "node:path";

import { normalizeUserRoute } from "./parse-route.mjs";

export const COOKIE_GITIGNORE_ENTRY = ".rico-skill/yapi-sync/cookie.txt";

const defaultYapiSyncConfig = {
    baseUrl: "https://yapi.iotbull.com",
    cookieGitignoreUpdated: false,
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

/**
 * 规范化 catIds 映射：
 * { "1788": ["/v1/mis-hq-project"] }
 * key = YApi 分类 ID；value = Controller 类级 @RequestMapping 路径列表
 */
export const normalizeCatIds = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return {};
    }

    const next = {};
    for (const [key, paths] of Object.entries(raw)) {
        const catId = toNullableNumber(key);
        if (!catId) {
            continue;
        }

        const list = Array.isArray(paths) ? paths : [];
        const normalized = [...new Set(
            list
                .map((item) => normalizeUserRoute(item))
                .filter((item) => item && item !== "/")
        )].sort();

        if (normalized.length > 0) {
            next[String(catId)] = normalized;
        }
    }

    return next;
};

export const findCatIdByControllerPath = (catIds, controllerPath) => {
    const target = normalizeUserRoute(controllerPath);
    if (!target || target === "/") {
        return null;
    }

    for (const [catId, paths] of Object.entries(normalizeCatIds(catIds))) {
        if (paths.includes(target)) {
            return Number(catId);
        }
    }

    return null;
};

export const bindControllerPathToCatId = (catIds, catId, controllerPath) => {
    const target = normalizeUserRoute(controllerPath);
    const id = toNullableNumber(catId);
    if (!target || target === "/" || !id) {
        return normalizeCatIds(catIds);
    }

    const next = {};
    for (const [key, paths] of Object.entries(normalizeCatIds(catIds))) {
        const filtered = paths.filter((item) => item !== target);
        if (filtered.length > 0) {
            next[key] = filtered;
        }
    }

    const bucket = next[String(id)] || [];
    if (!bucket.includes(target)) {
        bucket.push(target);
    }

    next[String(id)] = bucket.sort();
    return next;
};

export const readPushConfig = (projectRoot) => {
    const parsed = readJsonFile(getPushConfigPath(projectRoot));
    const projectId = toNullableNumber(parsed.projectId ?? parsed.project_id);
    // 旧版单 catId 不再作为全局默认；需按 Controller 路径重新绑定到 catIds
    const catIds = normalizeCatIds(parsed.catIds);

    return {
        catIds,
        projectId,
    };
};

export const writePushConfig = (config, projectRoot) => {
    const current = readPushConfig(projectRoot);
    let catIds = Object.hasOwn(config, "catIds")
        ? normalizeCatIds(config.catIds)
        : { ...current.catIds };

    const bindCatId = toNullableNumber(config.catId ?? config.catid);
    const controllerPaths = [
        ...(Array.isArray(config.controllerPaths) ? config.controllerPaths : []),
        ...(config.controllerPath ? [config.controllerPath] : []),
    ];

    if (bindCatId && controllerPaths.length > 0) {
        for (const controllerPath of controllerPaths) {
            catIds = bindControllerPathToCatId(catIds, bindCatId, controllerPath);
        }
    }

    const nextConfig = {
        catIds,
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
        catIds: push.catIds,
        cookie: yapiSync.cookie,
        cookieGitignoreUpdated: yapiSync.cookieGitignoreUpdated,
        projectId: push.projectId,
    };
};
