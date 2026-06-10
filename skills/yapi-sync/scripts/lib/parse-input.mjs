const splitSegments = (input) =>
    input
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);

/**
 * 解析单条 YApi 输入，区分接口 ID 与分类 ID。
 * 分类 URL 形如 /interface/api/cat_1686，必须先于纯数字接口 ID 匹配。
 */
export const parseSegment = (segment) => {
    const trimmed = segment.trim();
    if (!trimmed) {
        return null;
    }

    const catUrlMatch = trimmed.match(/\/interface\/api\/cat_(\d+)/i);
    if (catUrlMatch) {
        return { id: Number(catUrlMatch[1]), type: "category" };
    }

    const catDirectMatch = trimmed.match(/^cat[_:](\d+)$/i);
    if (catDirectMatch) {
        return { id: Number(catDirectMatch[1]), type: "category" };
    }

    const ifaceUrlMatch = trimmed.match(/\/interface\/api\/(\d+)/);
    if (ifaceUrlMatch) {
        return { id: Number(ifaceUrlMatch[1]), type: "interface" };
    }

    if (/^\d+$/.test(trimmed)) {
        return { id: Number(trimmed), type: "interface" };
    }

    return null;
};

export const parseYapiInput = (input) => {
    const segments = splitSegments(input);
    const parsed = [];
    const seenKeys = new Set();

    for (const segment of segments) {
        const item = parseSegment(segment);
        if (!(item && Number.isFinite(item.id)) || item.id <= 0) {
            continue;
        }

        const key = `${item.type}:${item.id}`;
        if (seenKeys.has(key)) {
            continue;
        }

        seenKeys.add(key);
        parsed.push({
            ...item,
            raw: segment,
        });
    }

    return parsed;
};

export const parseInterfaceIds = (input) =>
    parseYapiInput(input)
        .filter((item) => item.type === "interface")
        .map((item) => item.id);
