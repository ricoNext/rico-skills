const HTTP_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

const ARRAY_KEYS = ["interfaces", "list", "apis", "items", "data"];

const REQ_SCHEMA_KEYS = ["req_schema", "requestSchema", "request", "req", "req_body"];
const RES_SCHEMA_KEYS = ["res_schema", "responseSchema", "response", "res"];

export const stripJsonFence = (text) => {
    const trimmed = String(text || "").trim();
    const match = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
    return match ? match[1].trim() : trimmed;
};

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toPositiveNumber = (value) => {
    if (value === null || value === undefined || value === "") {
        return undefined;
    }

    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
};

const stringifyJsonField = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value);
};

const looksLikeJsonSchema = (value) => {
    if (!isPlainObject(value)) {
        return false;
    }

    return Boolean(value.type || value.properties || value.$schema || value.items || value.$ref);
};

const looksLikeInterface = (value) => {
    if (!isPlainObject(value)) {
        return false;
    }

    return Boolean(value.path || value.title || value.method || value.uri || value.url);
};

const firstDefined = (source, keys) => {
    for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
            return source[key];
        }
    }

    return undefined;
};

const normalizeMethod = (method, fallback = "POST") => {
    const next = String(method || fallback).trim().toUpperCase();
    return HTTP_METHODS.has(next) ? next : fallback;
};

const normalizePath = (path) => {
    const raw = String(path || "").trim();
    if (!raw) {
        return "";
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
};

const normalizeTag = (tag) => {
    if (!tag) {
        return undefined;
    }

    if (Array.isArray(tag)) {
        return tag.map((item) => String(item).trim()).filter(Boolean);
    }

    return String(tag)
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
};

const pickSchema = (source, keys) => {
    for (const key of keys) {
        if (source[key] !== undefined) {
            return source[key];
        }
    }

    return undefined;
};

const ensureJsonContentType = (headers, method, reqBodyType) => {
    const nextHeaders = Array.isArray(headers) ? [...headers] : [];
    const needsJson = reqBodyType === "json" && ["POST", "PUT", "PATCH"].includes(method);
    if (!needsJson) {
        return nextHeaders;
    }

    const hasContentType = nextHeaders.some((item) => String(item?.name || "").toLowerCase() === "content-type");
    if (!hasContentType) {
        nextHeaders.push({
            name: "Content-Type",
            required: "1",
            value: "application/json",
        });
    }

    return nextHeaders;
};

export const parseYapiTarget = (input) => {
    const text = String(input || "").trim();
    if (!text) {
        return {};
    }

    const catUrlMatch = text.match(/\/project\/(\d+)\/interface\/api\/cat_(\d+)/i);
    if (catUrlMatch) {
        return {
            catId: Number(catUrlMatch[2]),
            projectId: Number(catUrlMatch[1]),
        };
    }

    const projectUrlMatch = text.match(/\/project\/(\d+)/);
    if (projectUrlMatch) {
        return { projectId: Number(projectUrlMatch[1]) };
    }

    const catDirectMatch = text.match(/^cat[_:](\d+)$/i);
    if (catDirectMatch) {
        return { catId: Number(catDirectMatch[1]) };
    }

    return {};
};

const unwrapRoot = (value) => {
    if (Array.isArray(value)) {
        return { defaults: {}, items: value };
    }

    if (!isPlainObject(value)) {
        return { defaults: {}, items: [] };
    }

    if (Object.hasOwn(value, "errcode") && value.data !== undefined) {
        return unwrapRoot(value.data);
    }

    for (const key of ARRAY_KEYS) {
        if (Array.isArray(value[key])) {
            return {
                defaults: {
                    catId: value.catid ?? value.catId ?? value.cat_id,
                    cat_name: value.cat_name ?? value.catName ?? value.category,
                    projectId: value.project_id ?? value.projectId,
                },
                items: value[key],
            };
        }
    }

    return { defaults: {}, items: [value] };
};

const normalizeInterface = (raw, defaults = {}) => {
    if (!isPlainObject(raw)) {
        return {
            error: "接口定义必须是对象",
            raw,
        };
    }

    const schemaOnly = looksLikeJsonSchema(raw) && !looksLikeInterface(raw);
    const source = schemaOnly ? {} : raw;
    const schemaAs = defaults.schemaAs || "res";

    const title = String(firstDefined(source, ["title", "name"]) || defaults.title || "").trim();
    const path = normalizePath(firstDefined(source, ["path", "uri", "url"]) || defaults.path);
    const method = normalizeMethod(firstDefined(source, ["method", "httpMethod"]) || defaults.method);
    const projectId = toPositiveNumber(firstDefined(source, ["project_id", "projectId"]) ?? defaults.projectId);
    const catId = toPositiveNumber(firstDefined(source, ["catid", "catId", "cat_id"]) ?? defaults.catId);
    const existingId = toPositiveNumber(firstDefined(source, ["id", "_id", "api_id", "interface_id"]));

    if (!title || !path) {
        return {
            error: "缺少 title 或 path",
            raw,
        };
    }

    let reqBodyOther = stringifyJsonField(source.req_body_other);
    let resBody = stringifyJsonField(source.res_body);

    const reqSchema = pickSchema(source, REQ_SCHEMA_KEYS);
    const resSchema = pickSchema(source, RES_SCHEMA_KEYS);

    if (reqBodyOther === undefined && reqSchema !== undefined) {
        reqBodyOther = stringifyJsonField(reqSchema);
    }

    if (resBody === undefined && resSchema !== undefined) {
        resBody = stringifyJsonField(resSchema);
    }

    if (schemaOnly) {
        const schemaText = stringifyJsonField(raw);
        if (schemaAs === "req" || schemaAs === "both") {
            reqBodyOther = schemaText;
        }
        if (schemaAs === "res" || schemaAs === "both") {
            resBody = schemaText;
        }
    }

    const reqBodyType = String(source.req_body_type || "json").toLowerCase();
    const resBodyType = String(source.res_body_type || (resBody ? "json" : "json")).toLowerCase();

    const payload = {
        cat_name: firstDefined(source, ["cat_name", "catName", "category", "categoryName"]) || defaults.cat_name,
        catid: catId,
        desc: source.desc || source.description || "",
        markdown: source.markdown || "",
        method,
        path,
        project_id: projectId,
        req_body_form: Array.isArray(source.req_body_form) ? source.req_body_form : [],
        req_body_is_json_schema: source.req_body_is_json_schema !== false,
        req_body_other: reqBodyOther,
        req_body_type: reqBodyType,
        req_headers: ensureJsonContentType(source.req_headers, method, reqBodyType),
        req_params: Array.isArray(source.req_params) ? source.req_params : [],
        req_query: Array.isArray(source.req_query) ? source.req_query : [],
        res_body: resBody,
        res_body_is_json_schema: source.res_body_is_json_schema !== false,
        res_body_type: resBodyType,
        status: source.status || "undone",
        tag: normalizeTag(source.tag),
        title,
    };

    if (existingId) {
        payload.id = existingId;
    }

    return { payload };
};

export const parseDefinitionInput = (input, defaults = {}) => {
    let raw = input;

    if (typeof raw === "string") {
        const text = stripJsonFence(raw);
        if (!text) {
            return { errors: ["输入为空"], interfaces: [] };
        }

        try {
            raw = JSON.parse(text);
        } catch (error) {
            return { errors: [`JSON 解析失败: ${error.message}`], interfaces: [] };
        }
    }

    const { defaults: wrapperDefaults, items } = unwrapRoot(raw);
    const mergedDefaults = {
        ...defaults,
        catId: defaults.catId ?? wrapperDefaults.catId,
        projectId: defaults.projectId ?? wrapperDefaults.projectId,
    };
    if (!mergedDefaults.cat_name && wrapperDefaults.cat_name) {
        mergedDefaults.cat_name = wrapperDefaults.cat_name;
    }

    const interfaces = [];
    const errors = [];

    items.forEach((item, index) => {
        const result = normalizeInterface(item, mergedDefaults);
        if (result.error) {
            errors.push({
                error: result.error,
                index,
            });
            return;
        }

        interfaces.push(result.payload);
    });

    return { errors, interfaces };
};

export const buildYapiPayload = (definition, options = {}) => {
    const projectId = toPositiveNumber(options.projectId ?? definition.project_id);
    const catId = toPositiveNumber(options.catId ?? definition.catid);

    const payload = {
        catid: catId,
        desc: definition.desc || "",
        markdown: definition.markdown || "",
        method: definition.method,
        path: definition.path,
        project_id: projectId,
        req_body_form: definition.req_body_form || [],
        req_body_is_json_schema: definition.req_body_is_json_schema !== false,
        req_body_type: definition.req_body_type || "json",
        req_headers: definition.req_headers || [],
        req_params: definition.req_params || [],
        req_query: definition.req_query || [],
        res_body_is_json_schema: definition.res_body_is_json_schema !== false,
        res_body_type: definition.res_body_type || "json",
        status: definition.status || "undone",
        title: definition.title,
    };

    if (definition.req_body_other !== undefined) {
        payload.req_body_other = definition.req_body_other;
    }

    if (definition.res_body !== undefined) {
        payload.res_body = definition.res_body;
    }

    if (definition.tag) {
        payload.tag = definition.tag;
    }

    if (options.id) {
        payload.id = options.id;
    }

    return payload;
};
