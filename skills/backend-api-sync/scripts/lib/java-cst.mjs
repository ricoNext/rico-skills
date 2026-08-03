import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'java-parser';

import { createEndpoint } from './contract.mjs';
import { resolveTypeClosure } from './java-types.mjs';
import { resolveMavenWorkspace } from './maven-workspace.mjs';

function javaFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return javaFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.java') ? [absolute] : [];
  });
}

function descendants(node, name) {
  if (!node || !node.children) return [];
  const result = node.name === name ? [node] : [];
  for (const children of Object.values(node.children)) {
    for (const child of children) result.push(...descendants(child, name));
  }
  return result;
}

function sourceAt(source, node) {
  return source.slice(node.location.startOffset, node.location.endOffset + 1);
}

function annotationsIn(source, node) {
  return descendants(node, 'annotation').map((annotation) => sourceAt(source, annotation));
}

function annotationName(annotation) {
  return annotation.match(/^@([\w.]+)/)?.[1]?.split('.').at(-1);
}

function quotedValue(annotation, key) {
  const named = key && annotation.match(new RegExp(`\\b${key}\\s*=\\s*"([^"]*)"`));
  return named?.[1] ?? annotation.match(/\(\s*"([^"]*)"\s*\)/)?.[1] ?? '';
}

function normalizeRoute(base = '', child = '') {
  const route = `/${`${base}/${child}`.replaceAll('\\', '/').split('/').filter(Boolean).join('/')}`;
  return route === '/' ? '/' : route.replace(/\/$/, '');
}

function mapping(annotations) {
  for (const annotation of annotations) {
    const name = annotationName(annotation);
    if (name === 'GetMapping') return { method: 'GET', path: quotedValue(annotation, 'value') || quotedValue(annotation, 'path') };
    if (name === 'PostMapping') return { method: 'POST', path: quotedValue(annotation, 'value') || quotedValue(annotation, 'path') };
    if (name === 'PutMapping') return { method: 'PUT', path: quotedValue(annotation, 'value') || quotedValue(annotation, 'path') };
    if (name === 'DeleteMapping') return { method: 'DELETE', path: quotedValue(annotation, 'value') || quotedValue(annotation, 'path') };
    if (name === 'PatchMapping') return { method: 'PATCH', path: quotedValue(annotation, 'value') || quotedValue(annotation, 'path') };
    if (name === 'RequestMapping') {
      const method = annotation.match(/RequestMethod\.([A-Z]+)/)?.[1] || 'GET';
      return { method, path: quotedValue(annotation, 'value') || quotedValue(annotation, 'path') };
    }
  }
  return null;
}

function typeAndName(fragment) {
  const withoutAnnotations = fragment.replace(/@[\w.]+(?:\([^)]*\))?\s*/g, '').replace(/\bfinal\s+/g, '').trim();
  const match = withoutAnnotations.match(/^(.+?)\s+(\w+)$/s);
  return match ? { type: match[1].trim(), name: match[2] } : { type: 'unknown', name: 'unknown' };
}

function parameters(source, methodNode) {
  return descendants(methodNode, 'formalParameter').map((node) => {
    const fragment = sourceAt(source, node);
    const annotations = [...fragment.matchAll(/@([\w.]+)(?:\(([^)]*)\))?/g)];
    const { type, name: variableName } = typeAndName(fragment);
    for (const annotation of annotations) {
      const kind = annotation[1].split('.').at(-1);
      const value = annotation[2] || '';
      const name = value.match(/(?:name|value)\s*=\s*"([^"]+)"/)?.[1] || value.match(/"([^"]+)"/)?.[1] || variableName;
      if (kind === 'PathVariable') return { in: 'path', name, type };
      if (kind === 'RequestParam') return { in: 'query', name, type };
      if (kind === 'RequestHeader') return { in: 'header', name, type };
      if (kind === 'RequestBody') return { in: 'body', name, type };
    }
    return { in: 'query', name: variableName, type };
  });
}

function methodInfo(source, methodNode) {
  const header = sourceAt(source, descendants(methodNode, 'methodHeader')[0]);
  const match = header.match(/^\s*(.*?)\s+(\w+)\s*\(/s);
  return { responseType: match?.[1]?.trim() || 'void', javaMethod: match?.[2] || 'unknown' };
}

function parseController(source, absoluteFile, sourceRoot, typeSourceRoots) {
  const cst = parse(source);
  const classDeclaration = descendants(cst, 'classDeclaration').find((node) => descendants(node, 'normalClassDeclaration').length > 0);
  if (!classDeclaration) return null;
  const classAnnotations = annotationsIn(source, classDeclaration);
  if (!classAnnotations.some((annotation) => ['RestController', 'Controller'].includes(annotationName(annotation)))) return null;
  const classNode = descendants(classDeclaration, 'normalClassDeclaration')[0];
  const controller = sourceAt(source, descendants(classNode, 'typeIdentifier')[0]).trim();
  const base = mapping(classAnnotations)?.path || '';
  const relative = path.relative(sourceRoot, absoluteFile).split(path.sep).join('/');
  const endpoints = descendants(classNode, 'methodDeclaration').flatMap((methodNode) => {
    const route = mapping(annotationsIn(source, methodNode));
    if (!route) return [];
    const info = methodInfo(source, methodNode);
    const allParameters = parameters(source, methodNode);
    const requestBody = allParameters.find((parameter) => parameter.in === 'body') || null;
    return [createEndpoint({
      controller,
      source: relative,
      javaMethod: info.javaMethod,
      method: route.method,
      path: normalizeRoute(base, route.path),
      parameters: allParameters.filter((parameter) => parameter.in !== 'body'),
      requestBody,
      responseType: info.responseType,
    })];
  });
  return { controller, source: relative, basePath: normalizeRoute(base), endpoints, absoluteFile, typeSourceRoots };
}

export { normalizeRoute };

export function parseJavaSpring(backendRoot, route) {
  const workspace = resolveMavenWorkspace(backendRoot);
  const controllers = workspace.controllerModules.flatMap(({ sourceRoot, typeSourceRoots }) => javaFiles(sourceRoot)
    .map((file) => parseController(fs.readFileSync(file, 'utf8'), file, sourceRoot, typeSourceRoots))
    .filter(Boolean));
  const matches = controllers.flatMap((controller) => {
    if (controller.basePath === normalizeRoute(route)) return [controller];
    const endpointMatches = controller.endpoints.filter((endpoint) => endpoint.path === route);
    if (endpointMatches.length) return [{ ...controller, endpoints: endpointMatches }];
    return [];
  });
  const types = new Map();
  const unresolved = [];
  for (const match of matches) {
    const roots = match.endpoints.flatMap((endpoint) => [endpoint.responseType, endpoint.requestBody?.type]
      .filter(Boolean)
      .map((type) => ({ type, contextFile: match.absoluteFile })));
    const closure = resolveTypeClosure(match.typeSourceRoots, roots);
    unresolved.push(...closure.unresolved);
    for (const type of closure.types.values()) {
      const existing = types.get(type.name);
      if (existing && existing.qualifiedName !== type.qualifiedName) {
        unresolved.push({ type: type.name, chain: [type.name], candidates: [existing, type].map(({ qualifiedName, absoluteFile }) => ({ qualifiedName, source: absoluteFile })) });
        continue;
      }
      types.set(type.name, type);
    }
  }
  return {
    matches: matches.map(({ absoluteFile, typeSourceRoots, ...match }) => match),
    types: [...types.values()],
    unresolved,
  };
}
