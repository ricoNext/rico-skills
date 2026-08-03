import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'java-parser';

const JAVA_SCALAR_TYPES = new Map([
  ['boolean', 'boolean'], ['Boolean', 'boolean'],
  ['byte', 'number'], ['Byte', 'number'], ['short', 'number'], ['Short', 'number'],
  ['int', 'number'], ['Integer', 'number'], ['float', 'number'], ['Float', 'number'], ['double', 'number'], ['Double', 'number'],
  ['long', 'string'], ['Long', 'string'], ['BigDecimal', 'string'], ['BigInteger', 'string'],
  ['String', 'string'], ['UUID', 'string'], ['LocalDate', 'string'], ['LocalDateTime', 'string'], ['OffsetDateTime', 'string'], ['Instant', 'string'], ['Date', 'string'],
]);
const CONTAINER_TYPES = new Set(['List', 'Set', 'Collection', 'Iterable', 'ResponseEntity', 'Optional', 'Map']);

function javaFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return javaFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.java') ? [absolute] : [];
  });
}

function shortName(type) {
  return type.trim().split('.').at(-1).replace(/\[\]$/, '');
}

function splitArguments(input) {
  const result = [];
  let level = 0;
  let start = 0;
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === '<') level += 1;
    if (input[index] === '>') level -= 1;
    if (input[index] === ',' && level === 0) {
      result.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = input.slice(start).trim();
  if (last) result.push(last);
  return result;
}

function typeParts(type) {
  const normalized = type.trim().replace(/\?\s+extends\s+/g, '').replace(/\?\s+super\s+/g, '').trim();
  const open = normalized.indexOf('<');
  if (open === -1) return { name: normalized.replace(/\[\]$/, ''), args: normalized.endsWith('[]') ? [normalized.slice(0, -2)] : [] };
  return { name: normalized.slice(0, open).trim(), args: splitArguments(normalized.slice(open + 1, -1)) };
}

export function toTypeScript(type) {
  const { name: rawName, args } = typeParts(type);
  const name = shortName(rawName);
  if (name === 'void' || name === 'Void') return 'void';
  if (JAVA_SCALAR_TYPES.has(name)) return JAVA_SCALAR_TYPES.get(name);
  if (name === 'Optional') return `${toTypeScript(args[0])} | undefined`;
  if (name === 'Map') return `Record<string, ${toTypeScript(args[1])}>`;
  if (['List', 'Set', 'Collection', 'Iterable'].includes(name) || type.endsWith('[]')) return `${toTypeScript(args[0])}[]`;
  if (['ResponseEntity', 'ApiResponse'].includes(name)) return toTypeScript(args[0]);
  return name;
}

function sourceRoots(backendRootOrRoots) {
  if (Array.isArray(backendRootOrRoots)) return backendRootOrRoots;
  return [path.join(backendRootOrRoots, 'src', 'main', 'java')];
}

function indexTypes(backendRootOrRoots) {
  const roots = sourceRoots(backendRootOrRoots);
  const byQualifiedName = new Map();
  const bySimpleName = new Map();
  const byFile = new Map();
  for (const root of roots) {
    for (const file of javaFiles(root)) {
    const source = fs.readFileSync(file, 'utf8');
    parse(source); // Source structure must be accepted by the Java CST parser before indexing it.
    const packageName = source.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1] || '';
    const imports = [...source.matchAll(/^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm)].map((match) => match[1]);
    const declaration = source.match(/\b(public\s+)?(class|enum)\s+(\w+)(?:\s*<([^>]+)>)?(?:\s+extends\s+([\w.<>]+))?/);
    if (!declaration) continue;
    const [, , kind, name, generics = '', extendsType] = declaration;
    const fields = [...source.matchAll(/\b(?:private|protected|public)\s+(?:static\s+)?(?:final\s+)?([\w.$]+(?:\s*<[^;=(){}]+>)?(?:\[\])?)\s+(\w+)\s*;/g)]
      .map((match) => ({ name: match[2], type: match[1].trim() }));
    const values = kind === 'enum'
      ? (source.match(/\benum\s+\w+[^{]*\{\s*([^;}]+)/s)?.[1].split(',').map((value) => value.trim().match(/^\w+/)?.[0]).filter(Boolean) || [])
      : undefined;
    const definition = {
      name,
      packageName,
      qualifiedName: packageName ? `${packageName}.${name}` : name,
      kind: kind === 'enum' ? 'enum' : 'dto',
      fields,
      values,
      extends: extendsType?.trim(),
      genericParameters: generics.split(',').map((value) => value.trim()).filter(Boolean),
      source: path.relative(root, file).split(path.sep).join('/'),
      absoluteFile: file,
      imports,
    };
    byQualifiedName.set(definition.qualifiedName, definition);
    bySimpleName.set(name, [...(bySimpleName.get(name) || []), definition]);
    byFile.set(file, definition);
    }
  }
  return { byQualifiedName, bySimpleName, byFile };
}

function referencedNames(type) {
  const { name, args } = typeParts(type);
  return [name, ...args.flatMap(referencedNames)];
}

export function resolveTypeClosure(backendRoot, roots) {
  const index = indexTypes(backendRoot);
  const types = new Map();
  const unresolved = [];
  const queue = roots.map((root) => (typeof root === 'string' ? { type: root, contextFile: null, chain: [root] } : { ...root, chain: [root.type] }));
  const visited = new Set();
  const resolveDefinition = (type, contextFile) => {
    const rawName = typeParts(type).name;
    if (rawName.includes('.') && index.byQualifiedName.has(rawName)) return index.byQualifiedName.get(rawName);
    const context = contextFile && index.byFile.get(contextFile);
    const simple = shortName(rawName);
    const exactImport = context?.imports.find((value) => !value.endsWith('.*') && shortName(value) === simple);
    if (exactImport && index.byQualifiedName.has(exactImport)) return index.byQualifiedName.get(exactImport);
    if (context?.packageName && index.byQualifiedName.has(`${context.packageName}.${simple}`)) return index.byQualifiedName.get(`${context.packageName}.${simple}`);
    const wildcardMatches = (context?.imports || [])
      .filter((value) => value.endsWith('.*'))
      .map((value) => `${value.slice(0, -2)}.${simple}`)
      .filter((value) => index.byQualifiedName.has(value));
    if (wildcardMatches.length === 1) return index.byQualifiedName.get(wildcardMatches[0]);
    const candidates = index.bySimpleName.get(simple) || [];
    return candidates.length === 1 ? candidates[0] : null;
  };
  while (queue.length) {
    const { type, contextFile, chain } = queue.shift();
    for (const name of referencedNames(type)) {
      const simpleName = shortName(name);
      if (JAVA_SCALAR_TYPES.has(simpleName) || CONTAINER_TYPES.has(simpleName) || simpleName === 'void' || simpleName === 'Void') continue;
      const definition = resolveDefinition(name, contextFile);
      if (!definition) {
        if (/^[A-Z]\w*$/.test(simpleName)) {
          const candidates = index.bySimpleName.get(simpleName) || [];
          unresolved.push({ type: name, chain, candidates: candidates.map(({ qualifiedName, absoluteFile }) => ({ qualifiedName, source: absoluteFile })) });
        }
        continue;
      }
      if (visited.has(definition.qualifiedName)) continue;
      if (types.has(definition.name) && types.get(definition.name).qualifiedName !== definition.qualifiedName) {
        unresolved.push({ type: definition.name, chain, candidates: [types.get(definition.name), definition].map(({ qualifiedName, absoluteFile }) => ({ qualifiedName, source: absoluteFile })) });
        continue;
      }
      visited.add(definition.qualifiedName);
      types.set(definition.name, definition);
      if (definition.extends) queue.push({ type: definition.extends, contextFile: definition.absoluteFile, chain: [...chain, definition.extends] });
      for (const field of definition.fields) {
        if (definition.genericParameters.includes(field.type)) continue;
        queue.push({ type: field.type, contextFile: definition.absoluteFile, chain: [...chain, `${definition.name}.${field.name}`] });
      }
    }
  }
  return { types, unresolved };
}
