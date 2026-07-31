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

function stripPackage(type) {
  return type.trim().replace(/\b(?:java\.[\w.]+|[a-z][\w]*(?:\.[\w]+)+)\./g, '');
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
  const normalized = stripPackage(type).replace(/\?\s+extends\s+/g, '').replace(/\?\s+super\s+/g, '').trim();
  const open = normalized.indexOf('<');
  if (open === -1) return { name: normalized.replace(/\[\]$/, ''), args: normalized.endsWith('[]') ? [normalized.slice(0, -2)] : [] };
  return { name: normalized.slice(0, open).trim(), args: splitArguments(normalized.slice(open + 1, -1)) };
}

export function toTypeScript(type) {
  const { name, args } = typeParts(type);
  if (name === 'void' || name === 'Void') return 'void';
  if (JAVA_SCALAR_TYPES.has(name)) return JAVA_SCALAR_TYPES.get(name);
  if (name === 'Optional') return `${toTypeScript(args[0])} | undefined`;
  if (name === 'Map') return `Record<string, ${toTypeScript(args[1])}>`;
  if (['List', 'Set', 'Collection', 'Iterable'].includes(name) || type.endsWith('[]')) return `${toTypeScript(args[0])}[]`;
  if (['ResponseEntity', 'ApiResponse'].includes(name)) return toTypeScript(args[0]);
  return name;
}

function indexTypes(backendRoot) {
  const root = path.join(backendRoot, 'src', 'main', 'java');
  const index = new Map();
  for (const file of javaFiles(root)) {
    const source = fs.readFileSync(file, 'utf8');
    parse(source); // Source structure must be accepted by the Java CST parser before indexing it.
    const packageName = source.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1] || '';
    const declaration = source.match(/\b(public\s+)?(class|enum)\s+(\w+)(?:\s*<([^>]+)>)?(?:\s+extends\s+([\w.<>]+))?/);
    if (!declaration) continue;
    const [, , kind, name, generics = '', extendsType] = declaration;
    const fields = [...source.matchAll(/\b(?:private|protected|public)\s+(?:static\s+)?(?:final\s+)?([\w.$]+(?:\s*<[^;=(){}]+>)?(?:\[\])?)\s+(\w+)\s*;/g)]
      .map((match) => ({ name: match[2], type: stripPackage(match[1]) }));
    const values = kind === 'enum'
      ? (source.match(/\benum\s+\w+[^\{]*\{\s*([^;}]+)/s)?.[1].split(',').map((value) => value.trim().match(/^\w+/)?.[0]).filter(Boolean) || [])
      : undefined;
    index.set(name, { name, packageName, kind: kind === 'enum' ? 'enum' : 'dto', fields, values, extends: extendsType && stripPackage(extendsType), genericParameters: generics.split(',').map((value) => value.trim()).filter(Boolean), source: path.relative(root, file).split(path.sep).join('/') });
  }
  return index;
}

function referencedNames(type) {
  const { name, args } = typeParts(type);
  return [name, ...args.flatMap(referencedNames)];
}

export function resolveTypeClosure(backendRoot, roots) {
  const index = indexTypes(backendRoot);
  const types = new Map();
  const unresolved = [];
  const queue = roots.map((type) => ({ type, chain: [type] }));
  const visited = new Set();
  while (queue.length) {
    const { type, chain } = queue.shift();
    for (const name of referencedNames(type)) {
      if (JAVA_SCALAR_TYPES.has(name) || CONTAINER_TYPES.has(name) || name === 'void' || name === 'Void' || visited.has(name)) continue;
      const definition = index.get(name);
      if (!definition) {
        if (/^[A-Z]\w*$/.test(name)) unresolved.push({ type: name, chain });
        continue;
      }
      visited.add(name);
      types.set(name, definition);
      if (definition.extends) queue.push({ type: definition.extends, chain: [...chain, definition.extends] });
      for (const field of definition.fields) {
        if (definition.genericParameters.includes(field.type)) continue;
        queue.push({ type: field.type, chain: [...chain, `${definition.name}.${field.name}`] });
      }
    }
  }
  return { types, unresolved };
}
