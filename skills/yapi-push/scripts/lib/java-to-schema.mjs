const JAVA_SCALAR = new Map([
    ["String", { type: "string" }],
    ["UUID", { type: "string" }],
    ["LocalDate", { type: "string", format: "date" }],
    ["LocalDateTime", { type: "string", format: "date-time" }],
    ["OffsetDateTime", { type: "string", format: "date-time" }],
    ["Instant", { type: "string", format: "date-time" }],
    ["Date", { type: "string", format: "date-time" }],
    ["boolean", { type: "boolean" }],
    ["Boolean", { type: "boolean" }],
    ["int", { type: "integer" }],
    ["Integer", { type: "integer" }],
    ["short", { type: "integer" }],
    ["Short", { type: "integer" }],
    ["byte", { type: "integer" }],
    ["Byte", { type: "integer" }],
    ["long", { type: "integer" }],
    ["Long", { type: "integer" }],
    ["BigInteger", { type: "integer" }],
    ["float", { type: "number" }],
    ["Float", { type: "number" }],
    ["double", { type: "number" }],
    ["Double", { type: "number" }],
    ["BigDecimal", { type: "number" }],
    ["Object", { type: "object" }],
]);

const WRAPPER_TYPES = new Set(["GoneoResult", "R", "Result", "ApiResponse", "ResponseEntity", "CommonResult"]);
const LIST_TYPES = new Set(["List", "Set", "Collection", "Iterable"]);
const PAGE_TYPES = new Set(["Page", "IPage"]);

const shortName = (type) => type.trim().split(".").at(-1).replace(/\[\]$/, "");

const splitArguments = (input) => {
    const result = [];
    let level = 0;
    let start = 0;
    for (let index = 0; index < input.length; index += 1) {
        if (input[index] === "<") {
            level += 1;
        }
        if (input[index] === ">") {
            level -= 1;
        }
        if (input[index] === "," && level === 0) {
            result.push(input.slice(start, index).trim());
            start = index + 1;
        }
    }

    const last = input.slice(start).trim();
    if (last) {
        result.push(last);
    }

    return result;
};

export const typeParts = (type) => {
    const normalized = String(type || "")
        .trim()
        .replace(/\?\s+extends\s+/g, "")
        .replace(/\?\s+super\s+/g, "")
        .replace(/\s*\?\s*/g, "")
        .trim();
    if (!normalized) {
        return { args: [], name: "Object" };
    }

    const open = normalized.indexOf("<");
    if (open === -1) {
        return {
            args: normalized.endsWith("[]") ? [normalized.slice(0, -2)] : [],
            name: normalized.replace(/\[\]$/, ""),
        };
    }

    return {
        args: splitArguments(normalized.slice(open + 1, -1)),
        name: normalized.slice(0, open).trim(),
    };
};

const wrapperSchema = (dataSchema) => ({
    properties: {
        cnMsg: { description: "中文提示", type: "string" },
        code: { description: "状态码", type: "integer" },
        data: { ...(dataSchema || { type: "object" }), description: dataSchema?.description || "业务数据" },
        msg: { description: "提示信息", type: "string" },
        success: { description: "是否成功", type: "boolean" },
    },
    type: "object",
});

export const javaTypeToSchema = (type, typesByName = new Map(), visiting = new Set()) => {
    const { args, name: rawName } = typeParts(type);
    const name = shortName(rawName);

    if (!name || name === "void" || name === "Void") {
        return { type: "null" };
    }

    if (JAVA_SCALAR.has(name)) {
        return { ...JAVA_SCALAR.get(name) };
    }

    if (name === "Optional") {
        return javaTypeToSchema(args[0] || "Object", typesByName, visiting);
    }

    if (LIST_TYPES.has(name) || String(type).endsWith("[]")) {
        return {
            items: javaTypeToSchema(args[0] || "Object", typesByName, visiting),
            type: "array",
        };
    }

    if (PAGE_TYPES.has(name)) {
        const item = javaTypeToSchema(args[0] || "Object", typesByName, visiting);
        return {
            description: "分页结果",
            properties: {
                current: { description: "当前页", type: "integer" },
                pages: { description: "总页数", type: "integer" },
                records: { description: "当前页数据", items: item, type: "array" },
                size: { description: "每页条数", type: "integer" },
                total: { description: "总记录数", type: "integer" },
            },
            type: "object",
        };
    }

    if (name === "Map") {
        return {
            additionalProperties: javaTypeToSchema(args[1] || "Object", typesByName, visiting),
            type: "object",
        };
    }

    if (WRAPPER_TYPES.has(name)) {
        const inner = args[0] ? javaTypeToSchema(args[0], typesByName, visiting) : { type: "object" };
        if (name === "ResponseEntity") {
            return inner;
        }

        return wrapperSchema(inner);
    }

    const definition = typesByName.get(name);
    if (!definition) {
        return {
            description: `Java type: ${type}`,
            type: "object",
        };
    }

    if (definition.kind === "enum") {
        return {
            enum: definition.values || [],
            type: "string",
        };
    }

    if (visiting.has(definition.qualifiedName || name)) {
        return {
            description: `Recursive type: ${name}`,
            type: "object",
        };
    }

    visiting.add(definition.qualifiedName || name);
    const properties = {};
    const required = [];
    const parent = definition.extends ? javaTypeToSchema(definition.extends, typesByName, visiting) : null;
    if (parent?.properties) {
        Object.assign(properties, parent.properties);
    }
    if (parent?.required) {
        required.push(...parent.required);
    }

    for (const field of definition.fields || []) {
        if ((definition.genericParameters || []).includes(field.type)) {
            continue;
        }

        const schema = javaTypeToSchema(field.type, typesByName, visiting);
        if (field.description) {
            schema.description = field.description;
        }

        properties[field.name] = schema;
        if (field.required && !required.includes(field.name)) {
            required.push(field.name);
        }
    }

    visiting.delete(definition.qualifiedName || name);
    return {
        properties,
        required,
        type: "object",
    };
};

export const indexContractTypes = (types = []) => {
    const typesByName = new Map();
    for (const type of types) {
        typesByName.set(type.name, type);
    }

    return typesByName;
};
