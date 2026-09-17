import { parse } from "java-parser";
import fs from "node:fs";
import path from "node:path";

import { createEndpoint } from "./contract.mjs";
import { inferResponseType } from "./infer-response.mjs";
import { extractFields, resolveTypeClosure } from "./java-types.mjs";
import { resolveMavenWorkspace } from "./maven-workspace.mjs";
import { lastRouteSegment, normalizeUserRoute, routeNeedles } from "./parse-route.mjs";

function javaFiles(root) {
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
}

function descendants(node, name) {
    if (!node || !node.children) {
        return [];
    }

    const result = node.name === name ? [node] : [];
    for (const children of Object.values(node.children)) {
        for (const child of children) {
            result.push(...descendants(child, name));
        }
    }

    return result;
}

function sourceAt(source, node) {
    return source.slice(node.location.startOffset, node.location.endOffset + 1);
}

function annotationsIn(source, node) {
    return descendants(node, "annotation").map((annotation) => sourceAt(source, annotation));
}

function annotationName(annotation) {
    return annotation.match(/^@([\w.]+)/)?.[1]?.split(".").at(-1);
}

function quotedValue(annotation, key) {
    const named = key && annotation.match(new RegExp(`\\b${key}\\s*=\\s*"([^"]*)"`));
    return named?.[1] ?? annotation.match(/\(\s*"([^"]*)"\s*\)/)?.[1] ?? "";
}

export function normalizeRoute(base = "", child = "") {
    const route = `/${`${base}/${child}`.replaceAll("\\", "/").split("/").filter(Boolean).join("/")}`;
    return route === "/" ? "/" : route.replace(/\/$/, "");
}

function mapping(annotations) {
    for (const annotation of annotations) {
        const name = annotationName(annotation);
        if (name === "GetMapping") {
            return { method: "GET", path: quotedValue(annotation, "value") || quotedValue(annotation, "path") };
        }
        if (name === "PostMapping") {
            return { method: "POST", path: quotedValue(annotation, "value") || quotedValue(annotation, "path") };
        }
        if (name === "PutMapping") {
            return { method: "PUT", path: quotedValue(annotation, "value") || quotedValue(annotation, "path") };
        }
        if (name === "DeleteMapping") {
            return { method: "DELETE", path: quotedValue(annotation, "value") || quotedValue(annotation, "path") };
        }
        if (name === "PatchMapping") {
            return { method: "PATCH", path: quotedValue(annotation, "value") || quotedValue(annotation, "path") };
        }
        if (name === "RequestMapping") {
            const method = annotation.match(/RequestMethod\.([A-Z]+)/)?.[1] || "GET";
            return { method, path: quotedValue(annotation, "value") || quotedValue(annotation, "path") };
        }
    }

    return null;
}

function typeAndName(fragment) {
    const withoutAnnotations = fragment.replace(/@[\w.]+(?:\([^)]*\))?\s*/g, "").replace(/\bfinal\s+/g, "").trim();
    const match = withoutAnnotations.match(/^(.+?)\s+(\w+)$/s);
    return match ? { name: match[2], type: match[1].trim() } : { name: "unknown", type: "unknown" };
}

function parameters(source, methodNode) {
    return descendants(methodNode, "formalParameter").map((node) => {
        const fragment = sourceAt(source, node);
        const annotations = [...fragment.matchAll(/@([\w.]+)(?:\(([^)]*)\))?/g)];
        const { type, name: variableName } = typeAndName(fragment);
        for (const annotation of annotations) {
            const kind = annotation[1].split(".").at(-1);
            const value = annotation[2] || "";
            const name = value.match(/(?:name|value)\s*=\s*"([^"]+)"/)?.[1] || value.match(/"([^"]+)"/)?.[1] || variableName;
            if (kind === "PathVariable") {
                return { in: "path", name, type };
            }
            if (kind === "RequestParam") {
                return { in: "query", name, type };
            }
            if (kind === "RequestHeader") {
                return { in: "header", name, type };
            }
            if (kind === "RequestBody") {
                return { in: "body", name, type };
            }
        }

        return { in: "query", name: variableName, type };
    });
}

function methodInfo(source, methodNode) {
    const header = sourceAt(source, descendants(methodNode, "methodHeader")[0]);
    const cleaned = header
        .replace(/@[\w.]+(?:\([^)]*\))?\s*/g, "")
        .replace(/\b(public|protected|private|static|final|synchronized|native|default|strictfp)\b/g, "")
        .trim();
    const match = cleaned.match(/^\s*(.*?)\s+(\w+)\s*\(/s);
    return { javaMethod: match?.[2] || "unknown", responseType: match?.[1]?.trim() || "void" };
}

function javadocTitle(source, node) {
    const before = source.slice(Math.max(0, node.location.startOffset - 1200), node.location.startOffset);
    const match = before.match(/\/\*\*([\s\S]*?)\*\/\s*$/);
    if (!match) {
        return "";
    }

    return (
        match[1]
            .split("\n")
            .map((line) => line.replace(/^\s*\*\s?/, "").trim())
            .find((line) => line && !line.startsWith("@")) || ""
    );
}

function parseController(source, absoluteFile, sourceRoot, typeSourceRoots) {
    const cst = parse(source);
    const classDeclaration = descendants(cst, "classDeclaration").find(
        (node) => descendants(node, "normalClassDeclaration").length > 0
    );
    if (!classDeclaration) {
        return null;
    }

    const classAnnotations = annotationsIn(source, classDeclaration);
    if (!classAnnotations.some((annotation) => ["RestController", "Controller"].includes(annotationName(annotation)))) {
        return null;
    }

    const classNode = descendants(classDeclaration, "normalClassDeclaration")[0];
    const controller = sourceAt(source, descendants(classNode, "typeIdentifier")[0]).trim();
    const base = mapping(classAnnotations)?.path || "";
    const relative = path.relative(sourceRoot, absoluteFile).split(path.sep).join("/");
    const injectedFields = extractFields(source);
    const endpoints = descendants(classNode, "methodDeclaration").flatMap((methodNode) => {
        const route = mapping(annotationsIn(source, methodNode));
        if (!route) {
            return [];
        }

        const info = methodInfo(source, methodNode);
        const allParameters = parameters(source, methodNode);
        const requestBody = allParameters.find((parameter) => parameter.in === "body") || null;
        const bodyNode = descendants(methodNode, "methodBody")[0];
        const methodBody = bodyNode ? sourceAt(source, bodyNode) : "";
        const inferred = inferResponseType(info.responseType, methodBody, injectedFields, typeSourceRoots, {
            inlineName: `${info.javaMethod}Data`,
        });
        return [
            createEndpoint({
                controller,
                inlineTypes: inferred.inlineTypes,
                javaMethod: info.javaMethod,
                method: route.method,
                parameters: allParameters.filter((parameter) => parameter.in !== "body"),
                path: normalizeRoute(base, route.path),
                requestBody,
                responseType: inferred.responseType,
                source: relative,
                title: javadocTitle(source, methodNode) || info.javaMethod,
            }),
        ];
    });

    return {
        absoluteFile,
        basePath: normalizeRoute(base),
        controller,
        endpoints,
        source: relative,
        typeSourceRoots,
    };
}

function fileLooksRelevant(source, needles) {
    if (!(source.includes("@RestController") || source.includes("@Controller"))) {
        return false;
    }

    if (needles.length === 0) {
        return true;
    }

    return needles.some((needle) => source.includes(needle));
}

function endpointMatchesRoute(endpoint, target) {
    if (endpoint.path === target) {
        return true;
    }

    const endpointParts = endpoint.path.split("/").filter(Boolean);
    if (endpointParts.length >= 2 && target.endsWith(endpoint.path)) {
        return true;
    }

    if (endpointParts.length >= 2 && endpoint.path.endsWith(target) && target.split("/").filter(Boolean).length >= 2) {
        return true;
    }

    return false;
}

export function parseJavaSpring(backendRoot, route) {
    const target = normalizeRoute(normalizeUserRoute(route));
    const needles = routeNeedles(target);
    const workspace = resolveMavenWorkspace(backendRoot);
    const controllers = workspace.controllerModules.flatMap(({ sourceRoot, typeSourceRoots }) =>
        javaFiles(sourceRoot)
            .filter((file) => /Controller\.java$/i.test(file))
            .filter((file) => {
                const source = fs.readFileSync(file, "utf8");
                return fileLooksRelevant(source, needles);
            })
            .map((file) => parseController(fs.readFileSync(file, "utf8"), file, sourceRoot, typeSourceRoots))
            .filter(Boolean)
    );

    const matches = controllers.flatMap((controller) => {
        if (controller.basePath === target) {
            return [controller];
        }

        const endpointMatches = controller.endpoints.filter((endpoint) => endpointMatchesRoute(endpoint, target));
        if (endpointMatches.length) {
            return [{ ...controller, endpoints: endpointMatches }];
        }

        return [];
    });

    const types = new Map();
    const unresolved = [];
    for (const match of matches) {
        const roots = match.endpoints
            .flatMap((endpoint) => [
                endpoint.responseType,
                endpoint.requestBody?.type,
                ...(endpoint.parameters || []).map((item) => item.type),
                ...(endpoint.inlineTypes || []).flatMap((type) => type.fields.map((field) => field.type)),
            ])
            .filter(Boolean)
            .map((type) => ({ contextFile: match.absoluteFile, type }));
        const closure = resolveTypeClosure(match.typeSourceRoots, roots);
        unresolved.push(...closure.unresolved);
        for (const type of [...closure.types.values(), ...(match.endpoints || []).flatMap((endpoint) => endpoint.inlineTypes || [])]) {
            const existing = types.get(type.name);
            if (existing && existing.qualifiedName !== type.qualifiedName) {
                unresolved.push({
                    candidates: [existing, type].map(({ absoluteFile, qualifiedName }) => ({
                        qualifiedName,
                        source: absoluteFile,
                    })),
                    chain: [type.name],
                    type: type.name,
                });
                continue;
            }

            types.set(type.name, type);
        }
    }

    return {
        matches: matches.map(({ absoluteFile, typeSourceRoots, ...match }) => match),
        needles,
        route: target,
        segment: lastRouteSegment(target),
        types: [...types.values()],
        unresolved,
    };
}
