import { indexContractTypes, javaTypeToSchema } from "./java-to-schema.mjs";

const yapiParam = (item, schema) => ({
    desc: schema.description || "",
    example: "",
    name: item.name,
    required: item.required === false ? "0" : "1",
    type: schema.type || "string",
});

export const contractToYapiInterfaces = (contract, defaults = {}) => {
    const typesByName = indexContractTypes(contract.types);
    const interfaces = [];

    for (const match of contract.matches || []) {
        for (const endpoint of match.endpoints || []) {
            const reqQuery = [];
            const reqParams = [];
            const reqHeaders = [];
            const reqSchema = endpoint.requestBody
                ? javaTypeToSchema(endpoint.requestBody.type, typesByName)
                : undefined;
            const resSchema = javaTypeToSchema(endpoint.responseType, typesByName);

            if (reqSchema && ["POST", "PUT", "PATCH"].includes(endpoint.method)) {
                reqHeaders.push({
                    name: "Content-Type",
                    required: "1",
                    value: "application/json",
                });
            }

            for (const parameter of endpoint.parameters || []) {
                const schema = javaTypeToSchema(parameter.type, typesByName);
                const param = yapiParam(parameter, schema);
                if (parameter.in === "path") {
                    reqParams.push(param);
                } else if (parameter.in === "header") {
                    reqHeaders.push(param);
                } else {
                    reqQuery.push(param);
                }
            }

            interfaces.push({
                catid: defaults.catId,
                controller: match.controller,
                desc: `<p>${endpoint.title || endpoint.javaMethod}</p><p>${match.source}#${endpoint.javaMethod}</p>`,
                javaMethod: endpoint.javaMethod,
                markdown: `${endpoint.title || endpoint.javaMethod}\n\n\`${match.source}#${endpoint.javaMethod}\``,
                method: endpoint.method,
                path: endpoint.path,
                project_id: defaults.projectId,
                req_body_is_json_schema: true,
                req_body_other: reqSchema ? JSON.stringify(reqSchema) : undefined,
                req_body_type: reqSchema ? "json" : "raw",
                req_headers: reqHeaders,
                req_params: reqParams,
                req_query: reqQuery,
                res_body: JSON.stringify(resSchema),
                res_body_is_json_schema: true,
                res_body_type: "json",
                source: match.source,
                title: endpoint.title || endpoint.javaMethod,
            });
        }
    }

    return interfaces;
};
