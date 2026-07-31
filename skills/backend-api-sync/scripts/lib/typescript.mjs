import fs from 'node:fs';
import path from 'node:path';

import { readConfig } from './config.mjs';
import { readRules } from './rules.mjs';
import { toTypeScript } from './java-types.mjs';

function typeMap(types) { return types instanceof Map ? types : new Map((types || []).map((type) => [type.name, type])); }

function renderFields(type) { return (type.fields || []).map((field) => `  ${field.name}: ${toTypeScript(field.type)};`).join('\n'); }

function renderType(type, types) {
  if (type.kind === 'enum') return `export type ${type.name} = ${type.values.map((value) => JSON.stringify(value)).join(' | ')};`;
  const inherited = type.extends && types.has(type.extends) ? `${renderFields(types.get(type.extends))}\n` : '';
  const genericParameters = type.genericParameters?.length ? `<${type.genericParameters.join(', ')}>` : '';
  return `export interface ${type.name}${genericParameters} {\n${inherited}${renderFields(type)}\n}`;
}

function moduleName(endpoint) { return endpoint.path.split('/').filter(Boolean)[0] || 'api'; }

function endpointCode(endpoint) {
  const pathTemplate = endpoint.path.replace(/\{([^}]+)\}/g, '${$1}');
  const pathParams = endpoint.parameters.filter((parameter) => parameter.in === 'path');
  const queryParams = endpoint.parameters.filter((parameter) => parameter.in === 'query');
  const args = pathParams.map((parameter) => `${parameter.name}: ${toTypeScript(parameter.type)}`);
  if (queryParams.length) args.push(`query?: ${endpoint.javaMethod[0].toUpperCase()}${endpoint.javaMethod.slice(1)}Query`);
  if (endpoint.requestBody) args.push(`body: ${toTypeScript(endpoint.requestBody.type)}`);
  const response = toTypeScript(endpoint.responseType);
  const options = [`  url: \`${pathTemplate}\``, `  method: '${endpoint.method}'`];
  if (queryParams.length) options.push('  params: query');
  if (endpoint.requestBody) options.push('  data: body');
  return `export const ${endpoint.javaMethod} = (${args.join(', ')}): Promise<${response}> =>\n  request<${response}>({\n${options.join(',\n')}\n  });`;
}

function renderModule(endpoints, types, rules) {
  const map = typeMap(types);
  const declarations = [...map.values()].map((type) => renderType(type, map)).join('\n\n');
  const queries = endpoints.flatMap((endpoint) => {
    const query = endpoint.parameters.filter((parameter) => parameter.in === 'query');
    if (!query.length) return [];
    return [`export interface ${endpoint.javaMethod[0].toUpperCase()}${endpoint.javaMethod.slice(1)}Query {\n${query.map((parameter) => `  ${parameter.name}?: ${toTypeScript(parameter.type)};`).join('\n')}\n}`];
  }).join('\n\n');
  return `import { ${rules.requestIdentifier} } from '${rules.requestImport}';\n\n${declarations}${queries ? `\n\n${queries}` : ''}\n\n${endpoints.map(endpointCode).join('\n\n')}\n`;
}

export function renderApiFiles(contract, frontendRoot) {
  const { rulePath } = readConfig(frontendRoot);
  const rules = readRules(frontendRoot, rulePath);
  const groups = new Map();
  for (const endpoint of contract.matches.flatMap((match) => match.endpoints)) {
    const name = moduleName(endpoint);
    groups.set(name, [...(groups.get(name) || []), endpoint]);
  }
  return {
    rules,
    frontendRoot,
    files: [...groups].map(([name, endpoints]) => {
      const relativePath = path.posix.join(rules.apiDir, `${name}.ts`);
      const absolutePath = path.join(frontendRoot, relativePath);
      return { path: relativePath, exists: fs.existsSync(absolutePath), content: renderModule(endpoints, contract.types, rules) };
    }),
  };
}

export function writePreview(preview, decisions) {
  const getDecision = (filePath) => decisions instanceof Map ? decisions.get(filePath) : decisions?.[filePath];
  for (const file of preview.files) {
    const decision = getDecision(file.path);
    if (file.exists && !['overwrite', 'skip'].includes(decision)) throw new Error(`缺少覆盖确认: ${file.path}`);
    if (file.exists && decision === 'skip') continue;
    const absolutePath = path.join(preview.frontendRoot, file.path);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, file.content);
  }
}
