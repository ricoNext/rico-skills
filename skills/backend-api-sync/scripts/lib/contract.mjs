export function createEndpoint({ controller, source, javaMethod, method, path, parameters = [], requestBody = null, responseType = 'void' }) {
  return { controller, source, javaMethod, method, path, parameters, requestBody, responseType };
}

export function assertContract(contract) {
  if (!contract || !Array.isArray(contract.matches)) throw new Error('契约缺少 matches 数组');
  if (!Array.isArray(contract.types) || !Array.isArray(contract.unresolved)) throw new Error('契约缺少 types 或 unresolved 数组');
  for (const match of contract.matches) {
    if (!Array.isArray(match.endpoints) || match.endpoints.length === 0) throw new Error('匹配项没有端点');
  }
  return contract;
}
