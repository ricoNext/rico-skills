import fs from "fs";
import path from "path";

/**
 * 从 detected-api-style.md 中解析代码生成规范
 * @param {string} styleFile - detected-api-style.md 文件路径
 * @returns {object} 代码生成规范配置
 */
export function parseCodegenStyle(styleFile) {
  const defaultConfig = {
    apiDir: "src/api",
    typeStyle: "inline",
    responseWrapper: "Response<T>",
    naming: "camelCase",
  };

  if (!fs.existsSync(styleFile)) {
    return defaultConfig;
  }

  const content = fs.readFileSync(styleFile, "utf-8");
  const config = { ...defaultConfig };

  // 解析「[样本代码]」块中的内容
  // 通过查找代码块来提取具体规范

  // 1. 解析 API 存放位置
  const apiDirMatch = content.match(
    /### 存放位置[\s\S]*?\[样本代码\][\s\S]*?```\s*\n\s*(.+?)\s*\n\s*```/
  );
  if (apiDirMatch) {
    config.apiDir = apiDirMatch[1].trim().replace("/{module}.ts", "");
  }

  // 2. 解析类型定义风格
  const typeStyleMatch = content.match(/## 项目结构检测结果[\s\S]*?**推断风格**：([^\n]+)/);
  if (typeStyleMatch) {
    const style = typeStyleMatch[1].trim();
    config.typeStyle = style.includes("分离") ? "separate" : "inline";
  }

  // 3. 解析响应类型包装
  const responseWrapperMatch = content.match(
    /### 响应类型包装[\s\S]*?**推断包装方式**：`([^`]+)`/
  );
  if (responseWrapperMatch) {
    config.responseWrapper = responseWrapperMatch[1].trim();
  }

  // 4. 解析命名规范
  const namingMatch = content.match(
    /\*\*函数命名\*\*\s+\|\s+([^\|]+)\s+\|/
  );
  if (namingMatch) {
    const naming = namingMatch[1].trim();
    config.naming = naming.includes("snake_case") ? "snake_case" : "camelCase";
  }

  return config;
}

/**
 * 根据规范配置生成函数名
 */
export function generateFunctionName(path, method, naming = "camelCase") {
  const parts = path
    .split("/")
    .filter((p) => p && p !== "v1" && p !== "v2" && !p.match(/^\{/));

  if (parts.length === 0) {
    parts.push("request");
  }

  let name = "";
  const verbMap = {
    get: "get",
    post: "create",
    put: "update",
    patch: "update",
    delete: "delete",
  };

  const verb = verbMap[method.toLowerCase()] || "request";

  // 构建函数名：verb + 资源名
  const resource = parts.slice(-1)[0];
  name = verb + resource.charAt(0).toUpperCase() + resource.slice(1);

  if (naming === "snake_case") {
    name = name.replace(/([A-Z])/g, "_$1").toLowerCase();
  }

  return name;
}

/**
 * 根据规范生成内联类型定义
 */
export function generateInlineTypeSignature(params, typeStyle = "inline") {
  if (typeStyle === "separate") {
    return "data: RequestType";
  }

  // 内联类型
  const fields = params
    .map((p) => {
      const type = mapYapiTypeToTs(p.type);
      const required = p.required ? "" : "?";
      return `  /** ${p.description || p.name} */\n  ${p.name}${required}: ${type};`;
    })
    .join("\n");

  return `data: {\n${fields}\n}`;
}

/**
 * 映射 YApi 类型到 TypeScript 类型
 */
function mapYapiTypeToTs(yapiType) {
  const typeMap = {
    string: "string",
    integer: "number",
    number: "number",
    boolean: "number", // 0/1
    array: "T[]",
    object: "Record<string, any>",
  };

  return typeMap[yapiType] || "any";
}

export default {
  parseCodegenStyle,
  generateFunctionName,
  generateInlineTypeSignature,
  mapYapiTypeToTs,
};
