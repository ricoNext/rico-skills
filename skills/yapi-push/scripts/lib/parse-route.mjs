export const normalizeUserRoute = (input) => {
    let text = String(input || "").trim().replace(/^['"]|['"]$/g, "");
    if (!text) {
        return "";
    }

    if (/^https?:\/\//i.test(text)) {
        try {
            text = decodeURIComponent(new URL(text).pathname);
        } catch {
            text = text.replace(/^https?:\/\/[^/]+/i, "");
        }
    }

    text = text.split("?")[0].split("#")[0];
    if (!text.startsWith("/")) {
        text = `/${text}`;
    }

    if (text.length > 1) {
        text = text.replace(/\/+$/, "");
    }

    return text;
};

export const isRouteLike = (input) => {
    const text = String(input || "").trim();
    if (!text || text === "-" || text.endsWith(".json")) {
        return false;
    }

    if (text.startsWith("{") || text.startsWith("[")) {
        return false;
    }

    return /^https?:\/\//i.test(text) || text.startsWith("/") || /^[\w-]+(?:\/[\w{}._-]+)+$/.test(text);
};

export const lastRouteSegment = (route) => {
    const parts = normalizeUserRoute(route).split("/").filter(Boolean);
    const last = parts.at(-1) || "";
    if (/^\{.*\}$/.test(last) || last.length < 2) {
        return parts.at(-2) || last;
    }

    return last.replace(/[{}]/g, "");
};

export const routeNeedles = (route) => {
    const normalized = normalizeUserRoute(route);
    const parts = normalized.split("/").filter(Boolean);
    const last = lastRouteSegment(normalized);
    const lastTwo = parts.slice(-2).join("/");
    return [...new Set([normalized, last, lastTwo].filter((item) => item && item.length >= 2))];
};

export const normalizeBasepath = (basepath) => {
    const text = normalizeUserRoute(basepath || "");
    return text === "/" ? "" : text;
};

export const stripProjectBasepath = (apiPath, basepath) => {
    const path = normalizeUserRoute(apiPath);
    const base = normalizeBasepath(basepath);
    if (!base) {
        return path;
    }

    if (path === base) {
        return "/";
    }

    if (path.startsWith(`${base}/`)) {
        return path.slice(base.length) || "/";
    }

    return path;
};

export const pathAliases = (apiPath, basepath) => {
    const full = normalizeUserRoute(apiPath);
    const stripped = stripProjectBasepath(full, basepath);
    return [...new Set([full, stripped].filter(Boolean))];
};
