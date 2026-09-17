import fs from "node:fs";
import path from "node:path";

const WRAPPERS = ["GoneoResult", "R", "Result", "ApiResponse", "CommonResult"];
const CONTROL = new Set(["if", "for", "while", "switch", "catch", "return", "synchronized", "assert", "try", "new", "else"]);

const javaFiles = (root) => {
    if (!fs.existsSync(root)) {
        return [];
    }

    return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const absolute = path.join(root, entry.name);
        if (entry.isDirectory()) {
            return javaFiles(absolute);
        }

        return entry.isFile() && entry.name.endsWith(".java") ? [absolute] : [];
    });
};

const shortName = (type) => String(type || "").trim().split(".").at(-1).replace(/\[\]$/, "");

const splitTopLevel = (input, separator = ",") => {
    const result = [];
    let level = 0;
    let start = 0;
    const text = String(input || "");
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (char === "<" || char === "(") {
            level += 1;
        } else if (char === ">" || char === ")") {
            level -= 1;
        } else if (char === separator && level === 0) {
            result.push(text.slice(start, index).trim());
            start = index + 1;
        }
    }

    const last = text.slice(start).trim();
    if (last) {
        result.push(last);
    }

    return result;
};

const readBalanced = (source, argStart) => {
    let depth = 1;
    for (let index = argStart; index < source.length; index += 1) {
        const char = source[index];
        if (char === "(") {
            depth += 1;
        } else if (char === ")") {
            depth -= 1;
            if (depth === 0) {
                return { arg: source.slice(argStart, index), end: index + 1 };
            }
        }
    }

    return { arg: source.slice(argStart), end: source.length };
};

export const extractMethods = (source) => {
    const methods = [];
    const pattern =
        /(?:^|\n)\s+(?:@[\w.]+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|default|static|final|synchronized|native|strictfp)\s+)*([\w.$]+(?:\s*<[^;{}]+>)?(?:\[\])?)\s+(\w+)\s*\(/g;
    let match = pattern.exec(source);
    while (match) {
        const returnType = match[1].replace(/\s+/g, " ").trim();
        const name = match[2];
        if (!CONTROL.has(name) && !["class", "interface", "enum", "record"].includes(returnType)) {
            methods.push({ name, returnType });
        }

        match = pattern.exec(source);
    }

    return methods;
};

const wrapperName = (declared) => {
    const text = String(declared || "");
    return WRAPPERS.find((name) => text.startsWith(name)) || (text.startsWith("ResponseEntity") ? "ResponseEntity" : "");
};

const innerOfDeclared = (declared) => {
    const text = String(declared || "").trim();
    const open = text.indexOf("<");
    if (open < 0) {
        return "";
    }

    return text.slice(open + 1, text.endsWith(">") ? -1 : undefined).trim();
};

const isUnknownInner = (inner) => !inner || inner === "?" || inner === "Object" || inner === "T";

const wrapType = (declared, inner) => {
    const wrapper = wrapperName(declared) || "GoneoResult";
    if (wrapper === "ResponseEntity") {
        return inner;
    }

    return `${wrapper}<${inner}>`;
};

export const firstWrapperDataArg = (methodBody) => {
    const body = String(methodBody || "");
    for (const name of WRAPPERS) {
        const token = `${name}.ok(`;
        let cursor = 0;
        while (cursor < body.length) {
            const start = body.indexOf(token, cursor);
            if (start < 0) {
                break;
            }

            const { arg, end } = readBalanced(body, start + token.length);
            const args = splitTopLevel(arg);
            cursor = end;
            if (args.length === 0) {
                continue;
            }

            if (args.length >= 2 && args.every((item) => /^"/.test(item))) {
                continue;
            }

            return args[0];
        }
    }

    return undefined;
};

const localTypes = (methodBody) => {
    const map = new Map();
    const pattern = /\b([\w.$]+(?:\s*<[^;=()]+>)?)\s+(\w+)\s*=/g;
    let match = pattern.exec(methodBody);
    while (match) {
        map.set(match[2], match[1].replace(/\s+/g, " ").trim());
        match = pattern.exec(methodBody);
    }

    return map;
};

const lookupMethodReturn = (typeSourceRoots, typeName, methodName, cache) => {
    const simple = shortName(typeName);
    if (!simple || !methodName) {
        return "";
    }

    const key = `${simple}#${methodName}`;
    if (cache.has(key)) {
        return cache.get(key);
    }

    const files = (typeSourceRoots || []).flatMap((root) =>
        javaFiles(root).filter((file) => {
            const base = path.basename(file, ".java");
            return base === simple || base === `${simple}Impl`;
        })
    );
    files.sort((left, right) => Number(path.basename(right, ".java") === simple) - Number(path.basename(left, ".java") === simple));

    for (const file of files) {
        const source = fs.readFileSync(file, "utf8");
        const hit = extractMethods(source).find((item) => item.name === methodName);
        if (hit?.returnType) {
            cache.set(key, hit.returnType);
            return hit.returnType;
        }
    }

    cache.set(key, "");
    return "";
};

const inferMapOf = (expr, locals) => {
    const match = expr.match(/^(?:Map\.of|ImmutableMap\.of)\s*\(([\s\S]*)\)\s*$/);
    if (!match) {
        return null;
    }

    const parts = splitTopLevel(match[1]);
    const fields = [];
    for (let index = 0; index + 1 < parts.length; index += 2) {
        const name = parts[index].match(/^"([^"]+)"/)?.[1];
        if (!name) {
            continue;
        }

        const value = parts[index + 1].trim();
        const type = locals.get(value) || (/^\d+$/.test(value) ? "Long" : /^"/.test(value) ? "String" : "Object");
        fields.push({ description: name, name, type });
    }

    return fields.length ? fields : null;
};

const inferExpressionType = (expr, methodBody, injectedFields, typeSourceRoots, cache) => {
    const text = String(expr || "").trim().replace(/;\s*$/, "");
    const locals = localTypes(methodBody);
    const mapFields = inferMapOf(text, locals);
    if (mapFields) {
        return { fields: mapFields, inline: true, type: "InlineData" };
    }

    const call = text.match(/^(\w+)\.(\w+)\s*\(/);
    if (call) {
        const field = (injectedFields || []).find((item) => item.name === call[1]);
        if (field?.type) {
            const returnType = lookupMethodReturn(typeSourceRoots, field.type, call[2], cache);
            if (returnType && returnType !== "void") {
                return { inline: false, type: returnType };
            }
        }
    }

    if (locals.has(text)) {
        return { inline: false, type: locals.get(text) };
    }

    return null;
};

export const inferResponseType = (declared, methodBody, injectedFields, typeSourceRoots, options = {}) => {
    const cache = options.cache || new Map();
    const declaredInner = innerOfDeclared(declared);
    if (wrapperName(declared) && !isUnknownInner(declaredInner)) {
        return { inlineTypes: [], responseType: declared };
    }

    const arg = firstWrapperDataArg(methodBody);
    if (arg === undefined) {
        return { inlineTypes: [], responseType: declared };
    }

    const inferred = inferExpressionType(arg, methodBody, injectedFields, typeSourceRoots, cache);
    if (!inferred?.type) {
        return { inlineTypes: [], responseType: declared };
    }

    if (inferred.inline) {
        const name = options.inlineName || "InlineData";
        return {
            inlineTypes: [
                {
                    fields: inferred.fields,
                    kind: "dto",
                    name,
                    qualifiedName: name,
                },
            ],
            responseType: wrapType(declared, name),
        };
    }

    return { inlineTypes: [], responseType: wrapType(declared, inferred.type) };
};
