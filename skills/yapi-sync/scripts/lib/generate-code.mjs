import { parseCodegenStyle, generateFunctionName, renderRequestImport } from './parse-codegen-style.mjs';

/**
 * 根据 YApi 接口定义和规范配置生成 API 代码
 */
export async function generateApiCode(interfaces, projectRoot) {
  const config = parseCodegenStyle(projectRoot);
  const moduleMap = new Map();

  for (const iface of interfaces) {
    if (!iface.ok || !iface.data) continue;

    const interfaceData = iface.data;
    const { path: apiPath, method, title, project_id: projectId, _id: interfaceId } =
      interfaceData;
    const moduleName = inferModuleName(apiPath);
    if (!moduleName) continue;

    const functionName = generateFunctionName(apiPath, method, config.naming);
    const functionCode = generateFunctionCode(
      functionName,
      apiPath,
      method,
      title,
      interfaceData,
      config,
      projectId,
      interfaceId,
    );

    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, []);
    }
    moduleMap.get(moduleName).push({
      code: functionCode,
      functionName,
      path: apiPath,
    });
  }

  const output = {};
  for (const [moduleName, functions] of moduleMap) {
    output[moduleName] = generateModuleFile(functions, config);
  }

  return { files: output, config };
}

function inferModuleName(apiPath) {
  const parts = apiPath.split('/').filter((part) => part && !part.match(/^v\d+$/));
  if (parts.length === 0) return null;
  return parts[0];
}

function generateFunctionCode(
  functionName,
  apiPath,
  method,
  title,
  interfaceData,
  config,
  projectId,
  interfaceId,
) {
  const params = extractRequestParams(interfaceData);
  const responseType = extractResponseType(config);

  let signature = '()';
  if (params.length > 0) {
    if (config.paramStyle === 'inline') {
      const fields = params
        .map(
          (param) =>
            `  /** ${param.description || param.name} */\n  ${param.name}${
              param.required ? '' : '?'
            }: ${param.type};`,
        )
        .join('\n');
      signature = `(data: {\n${fields}\n})`;
    } else {
      signature = `(data: ${functionName[0].toUpperCase()}${functionName.slice(1)}Request)`;
    }
  }

  const yApiUrl =
    projectId && interfaceId
      ? `https://yapi.example.com/project/${projectId}/interface/api/${interfaceId}`
      : 'https://yapi.example.com/project/{projectId}/interface/api/{interfaceId}';

  const callArgs =
    params.length > 0
      ? `"${apiPath}", { data }`
      : `"${apiPath}"`;

  return `/**
 * ${title}
 * ${yApiUrl}
 */
export const ${functionName} = ${signature} =>
  ${config.requestIdentifier}<${responseType}>(${callArgs});`;
}

function extractRequestParams(interfaceData) {
  const params = [];
  if (!interfaceData.req_body_other) return params;

  try {
    const schema = JSON.parse(interfaceData.req_body_other);
    if (!schema.properties) return params;
    for (const [name, prop] of Object.entries(schema.properties)) {
      params.push({
        name,
        type: mapYapiTypeToTs(prop.type),
        description: prop.description || '',
        required: schema.required?.includes(name) ?? false,
      });
    }
  } catch {
    // ignore invalid schema
  }

  return params;
}

function extractResponseType(config) {
  if (config.responseMode === 'unwrapped') {
    return 'unknown';
  }
  return config.responseWrapper;
}

function mapYapiTypeToTs(yapiType) {
  const typeMap = {
    string: 'string',
    integer: 'number',
    number: 'number',
    boolean: 'boolean',
    array: 'any[]',
    object: 'Record<string, any>',
  };
  return typeMap[yapiType] || 'any';
}

function generateModuleFile(functions, config) {
  const header = `${renderRequestImport(config)}\n\n`;
  return header + functions.map((item) => item.code).join('\n\n');
}

export default {
  generateApiCode,
  inferModuleName,
};
