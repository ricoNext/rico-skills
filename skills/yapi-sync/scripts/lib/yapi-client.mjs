import { spawn } from "node:child_process";
import path from "node:path";
import { readConfig, scriptsDir } from "./config.mjs";

export const AUTH_ERROR_CODES = new Set([40_011, 401]);

export const isAuthError = (response) => {
    if (!response || typeof response !== "object") {
        return false;
    }

    const errcode = response.errcode;
    if (AUTH_ERROR_CODES.has(errcode)) {
        return true;
    }

    const errmsg = String(response.errmsg || "");
    return errmsg.includes("登录") || errmsg.includes("未登录");
};

export const formatCookie = (cookies) => {
    const token = cookies.find((item) => item.name === "_yapi_token");
    const uid = cookies.find((item) => item.name === "_yapi_uid");

    if (!(token?.value && uid?.value)) {
        return "";
    }

    return `_yapi_token=${token.value}; _yapi_uid=${uid.value}`;
};

export const runGetCookie = () =>
    new Promise((resolve, reject) => {
        const scriptPath = path.join(scriptsDir, "get-cookie.mjs");
        const child = spawn(process.execPath, [scriptPath], {
            stdio: "inherit",
        });

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve(readConfig());
                return;
            }

            reject(new Error(`get-cookie.mjs exited with code ${code ?? "unknown"}`));
        });
    });

export const fetchJson = (url, cookie) =>
    fetch(url, {
        headers: {
            Cookie: cookie,
        },
    }).then((response) => response.json());

export const listCatInterfaces = (catId, options = {}) => {
    const config = readConfig();
    const baseUrl = options.baseUrl || config.baseUrl;
    const cookie = options.cookie || config.cookie;
    const limit = options.limit || 100;

    const fetchPage = (page, accumulated) => {
        const url = `${baseUrl}/api/interface/list_cat?catid=${catId}&page=${page}&limit=${limit}`;

        return fetchJson(url, cookie).then((result) => {
            if (isAuthError(result)) {
                const error = new Error(result.errmsg || "YApi cookie 已失效，请重新登录");
                error.code = "YAPI_AUTH_REQUIRED";
                error.response = result;
                throw error;
            }

            if (result.errcode !== 0) {
                const error = new Error(result.errmsg || `YApi 分类列表请求失败: ${catId}`);
                error.code = "YAPI_REQUEST_FAILED";
                error.response = result;
                throw error;
            }

            const list = result.data?.list || [];
            const total = result.data?.total ?? list.length;
            const merged = accumulated.concat(list);

            if (merged.length < total && list.length > 0) {
                return fetchPage(page + 1, merged);
            }

            return merged;
        });
    };

    return fetchPage(1, []);
};

export const getInterfaceDetail = (interfaceId, options = {}) => {
    const config = readConfig();
    const baseUrl = options.baseUrl || config.baseUrl;
    const cookie = options.cookie || config.cookie;
    const url = `${baseUrl}/api/interface/get?id=${interfaceId}`;

    return fetchJson(url, cookie).then((result) => {
        if (isAuthError(result)) {
            const error = new Error(result.errmsg || "YApi cookie 已失效，请重新登录");
            error.code = "YAPI_AUTH_REQUIRED";
            error.response = result;
            throw error;
        }

        if (result.errcode !== 0) {
            const error = new Error(result.errmsg || `YApi 请求失败: ${interfaceId}`);
            error.code = "YAPI_REQUEST_FAILED";
            error.response = result;
            throw error;
        }

        return result.data;
    });
};

export const ensureValidCookie = (options = {}) => {
    const config = readConfig();
    const testId = options.testInterfaceId;
    const testCatId = options.testCatId;

    if (!config.cookie) {
        return runGetCookie();
    }

    if (!(testId || testCatId)) {
        return Promise.resolve(config);
    }

    const testRequest = testId ? getInterfaceDetail(testId, config) : listCatInterfaces(testCatId, config);

    return testRequest
        .then(() => config)
        .catch((error) => {
            if (error.code !== "YAPI_AUTH_REQUIRED") {
                throw error;
            }

            return runGetCookie();
        });
};
