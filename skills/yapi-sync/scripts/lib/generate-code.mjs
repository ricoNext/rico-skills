import path from "path";
import { fileURLToPath } from "url";
import { parseCodegenStyle, generateFunctionName } from "./parse-codegen-style.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 根据 YApi 接口定义和规范配置生成 API 代码
 * @param {Array} interfaces - YApi 接口对象数组
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 按模块名组织的生成代码
 */
export async function generateApiCode(interfaces, projectRoot) {
  const config = parseCodegenStyle(projectRoot);

  const moduleMap = new Map();

  for (const iface of interfaces) {
    if (!iface.ok || !iface.data) {
      continue;
    }

    const interfaceData = iface.data;
    const { path: apiPath, method, title } = interfaceData;

    // 推断模块名（从路径推断）
    const moduleName = inferModuleName(apiPath);
    if (!moduleName) {
      continue;
    }

    // 生成函数名
    const functionName = generateFunctionName(apiPath, method, config.naming);

    // 生成函数代码
    const functionCode = generateFunctionCode(
      functionName,
      apiPath,
      method,
      title,
      interfaceData,
      config
    );

    // 按模块归类
    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, []);
    }
    moduleMap.get(moduleName).push({
      code: functionCode,
      functionName,
      path: apiPath,
    });
  }

  // 生成模块文件
  const output = {};
  for (const [moduleName, functions] of moduleMap) {
    output[moduleName] = generateModuleFile(moduleName, functions, config);
  }

  return output;
}

/**
 * 从 API 路径推断模块名
 * 例如: /user/detail -> user
 *      /v1/product/list -> product
 */
function inferModuleName(apiPath) {
  const parts = apiPath.split("/").filter((p) => p && !p.match(/^v\d+$/));

  if (parts.length === 0) {
    return null;
  }

  // 取第一个路径段作为模块名
  return parts[0];
}

/**
 * 生成单个函数代码
 */
function generateFunctionCode(functionName, apiPath, method, title, interfaceData, config) {
  const params = extractRequestParams(interfaceData, config.typeStyle);
  const responseType = extractResponseType(interfaceData, config.responseWrapper);

  let signature = "";
  if (params.length > 0) {
    if (config.typeStyle === "inline") {
      const fields = params
        .map((p) => `  /** ${p.description || p.name} */\n  ${p.name}${p.required ? "" : "?"}: ${p.type};`)
        .join("\n");
      signature = `(data: {\n${fields}\n})`;
    } else {
      signature = `(data: ${functionName}Request)`;
    }
  } else {
    signature = `()`;
  }

  const yApiUrl = `https://yapi.example.com/project/{projectId}/interface/api/{interfaceId}`;

  return `/**
 * ${title}
 * ${yApiUrl}
 */
export const ${functionName} = ${signature} =>
  request<${responseType}>("${apiPath}");`;
}

/**
 * 从 YApi 接口定义中提取请求参数
 */
function extractRequestParams(interfaceData, typeStyle) {
  const params = [];

  // 尝试解析 req_body_other (JSON Schema)
  if (interfaceData.req_body_other) {
    try {
      const schema = JSON.parse(interfaceData.req_body_other);
      if (schema.properties) {
        for (const [name, prop] of Object.entries(schema.properties)) {
          params.push({
            name,
            type: mapYapiTypeToTs(prop.type),
            description: prop.description || "",
            required: schema.required?.includes(name) ?? false,
          });
        }
      }
    } catch (e) {
      // 解析失败，忽略
    }
  }

  return params;
}

/**
 * 从 YApi 接口定义中提取响应类型
 */
function extractResponseType(interfaceData, responseWrapper) {
  // 简化版：返回通用响应类型
  // 实际应用中应根据 res_body 分析具体的响应结构

  if (responseWrapper.includes("PageData")) {
    return `${responseWrapper}<T>`;
  }

  return responseWrapper;
}

/**
 * 映射 YApi 类型到 TypeScript
 */
function mapYapiTypeToTs(yapiType) {
  const typeMap = {
    string: "string",
    integer: "number",
    number: "number",
    boolean: "boolean",
    array: "any[]",
    object: "Record<string, any>",
  };

  return typeMap[yapiType] || "any";
}

/**
 * 生成整个模块文件的内容
 */
function generateModuleFile(moduleName, functions, config) {
  const header = `import request from "@/api";\n\n`;

  const functionCodes = functions.map((f) => f.code).join("\n\n");

  return header + functionCodes;
}

export default {
  generateApiCode,
  inferModuleName,
};
