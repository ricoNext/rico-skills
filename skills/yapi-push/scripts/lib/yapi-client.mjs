import { readConfig } from "./config.mjs";
import { pathAliases } from "./parse-route.mjs";

export const AUTH_ERROR_CODES = new Set([40_011, 401]);

export const isAuthError = (response) => {
    if (!response || typeof response !== "object") {
        return false;
    }

    if (AUTH_ERROR_CODES.has(response.errcode)) {
        return true;
    }

    const errmsg = String(response.errmsg || "");
    return errmsg.includes("登录") || errmsg.includes("未登录");
};

const throwYapiError = (result, fallback, code = "YAPI_REQUEST_FAILED") => {
    if (isAuthError(result)) {
        const error = new Error(result.errmsg || "YApi cookie 已失效，请手动更新 Cookie");
        error.code = "YAPI_AUTH_REQUIRED";
        error.response = result;
        throw error;
    }

    const error = new Error(result?.errmsg || fallback);
    error.code = code;
    error.response = result;
    throw error;
};

export const fetchJson = (url, cookie) =>
    fetch(url, {
        headers: {
            Cookie: cookie,
        },
    }).then((response) => response.json());

export const postJson = (url, cookie, body) =>
    fetch(url, {
        body: JSON.stringify(body),
        headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
        },
        method: "POST",
    }).then((response) => response.json());

const withConfig = (options = {}) => {
    const config = options.config || readConfig();
    return {
        baseUrl: options.baseUrl || config.baseUrl,
        cookie: options.cookie || config.cookie,
    };
};

export const getProject = (projectId, options = {}) => {
    const { baseUrl, cookie } = withConfig(options);
    const url = `${baseUrl}/api/project/get?id=${projectId}`;

    return fetchJson(url, cookie).then((result) => {
        if (result.errcode !== 0) {
            throwYapiError(result, `读取 YApi 项目失败: ${projectId}`);
        }

        return result.data;
    });
};

export const getCatMenu = (projectId, options = {}) => {
    const { baseUrl, cookie } = withConfig(options);
    const url = `${baseUrl}/api/interface/getCatMenu?project_id=${projectId}`;

    return fetchJson(url, cookie).then((result) => {
        if (result.errcode !== 0) {
            throwYapiError(result, `读取分类失败: ${projectId}`);
        }

        return result.data || [];
    });
};

export const getListMenu = (projectId, options = {}) => {
    const { baseUrl, cookie } = withConfig(options);
    const url = `${baseUrl}/api/interface/list_menu?project_id=${projectId}`;

    return fetchJson(url, cookie).then((result) => {
        if (result.errcode !== 0) {
            throwYapiError(result, `读取接口菜单失败: ${projectId}`);
        }

        return result.data || [];
    });
};

export const flattenMenu = (menu) => {
    const interfaces = [];

    for (const category of menu || []) {
        for (const item of category.list || []) {
            interfaces.push({
                catName: category.name,
                catid: category._id,
                id: item._id,
                method: String(item.method || "").toUpperCase(),
                path: item.path,
                title: item.title,
            });
        }
    }

    return interfaces;
};

export const findExisting = (menu, path, method, basepath) => {
    const candidates = new Set(pathAliases(path, basepath));
    const targetMethod = String(method || "").toUpperCase();
    return flattenMenu(menu).find((item) => {
        if (item.method !== targetMethod) {
            return false;
        }

        return pathAliases(item.path, basepath).some((alias) => candidates.has(alias));
    });
};

export const findCategoryByName = (cats, name) => {
    const target = String(name || "").trim();
    if (!target) {
        return undefined;
    }

    return (cats || []).find((item) => String(item.name || "").trim() === target);
};

export const addInterface = (payload, options = {}) => {
    const { baseUrl, cookie } = withConfig(options);
    const url = `${baseUrl}/api/interface/add`;

    return postJson(url, cookie, payload).then((result) => {
        if (result.errcode !== 0) {
            throwYapiError(result, `新增接口失败: ${payload.method} ${payload.path}`);
        }

        return result.data;
    });
};

export const updateInterface = (payload, options = {}) => {
    const { baseUrl, cookie } = withConfig(options);
    const url = `${baseUrl}/api/interface/up`;

    return postJson(url, cookie, payload).then((result) => {
        if (result.errcode !== 0) {
            throwYapiError(result, `更新接口失败: ${payload.method} ${payload.path}`);
        }

        return result.data;
    });
};

export const addCategory = (payload, options = {}) => {
    const { baseUrl, cookie } = withConfig(options);
    const url = `${baseUrl}/api/interface/add_cat`;

    return postJson(url, cookie, payload).then((result) => {
        if (result.errcode !== 0) {
            throwYapiError(result, `新增分类失败: ${payload.name}`);
        }

        return result.data;
    });
};

const throwAuthRequired = (config) => {
    const error = new Error(
        `YApi Cookie 未配置或已失效，请手动获取 Cookie 并写入 Cookie 文件。\n` +
            `  1. 在浏览器中访问 ${config.baseUrl} 并登录\n` +
            `  2. 打开开发者工具 (F12) > Application > Cookies\n` +
            `  3. 复制 _yapi_token 和 _yapi_uid 的值，格式：_yapi_token=xxx; _yapi_uid=xxx\n` +
            `  4. 将 Cookie 原始值写入 .rico-skill/yapi-sync/cookie.txt`
    );
    error.code = "YAPI_AUTH_REQUIRED";
    throw error;
};

export const ensureValidCookie = (options = {}) => {
    const config = readConfig();

    if (!config.cookie) {
        return throwAuthRequired(config);
    }

    if (!options.projectId) {
        return Promise.resolve(config);
    }

    return getProject(options.projectId, config)
        .then(() => config)
        .catch((error) => {
            if (error.code !== "YAPI_AUTH_REQUIRED") {
                throw error;
            }

            throwAuthRequired(config);
        });
};

export const buildInterfaceUrl = (baseUrl, projectId, interfaceId) =>
    `${String(baseUrl).replace(/\/$/, "")}/project/${projectId}/interface/api/${interfaceId}`;
