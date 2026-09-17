import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { contractToYapiInterfaces } from "../scripts/lib/contract-to-yapi.mjs";
import { parseJavaSpring } from "../scripts/lib/java-cst.mjs";
import { javaTypeToSchema } from "../scripts/lib/java-to-schema.mjs";
import { isRouteLike, normalizeUserRoute, stripProjectBasepath } from "../scripts/lib/parse-route.mjs";

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/java/order-service");

test("normalizeUserRoute 去掉域名和 query", () => {
    assert.equal(
        normalizeUserRoute("https://mis.example.com/v1/mis-quotation-space/getQuotationSpaceList?x=1"),
        "/v1/mis-quotation-space/getQuotationSpaceList"
    );
    assert.equal(normalizeUserRoute("v1/user/detail"), "/v1/user/detail");
    assert.equal(isRouteLike("/v1/user/detail"), true);
    assert.equal(isRouteLike("interfaces.json"), false);
    assert.equal(stripProjectBasepath("/v1/mis-standard-apply/create", "/v1"), "/mis-standard-apply/create");
    assert.equal(stripProjectBasepath("/mis-standard-apply/create", "/v1"), "/mis-standard-apply/create");
});

test("GoneoResult 展开为包装 schema", () => {
    const schema = javaTypeToSchema("GoneoResult<List<OrderDto>>", new Map([["OrderDto", {
        fields: [{ name: "id", type: "String" }],
        kind: "dto",
        name: "OrderDto",
        qualifiedName: "com.example.order.OrderDto",
    }]]));

    assert.equal(schema.type, "object");
    assert.equal(schema.properties.success.type, "boolean");
    assert.equal(schema.properties.data.type, "array");
    assert.equal(schema.properties.data.items.properties.id.type, "string");
});

test("从 Controller 路由解析入参和返回类型", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yapi-push-"));
    const backendRoot = path.join(root, "order-service");
    fs.cpSync(fixtureRoot, backendRoot, { recursive: true });

    const contract = parseJavaSpring(backendRoot, "/orders");
    assert.ok(contract.matches[0].endpoints.length >= 2);

    const create = contract.matches[0].endpoints.find((item) => item.path === "/orders" && item.method === "POST");
    assert.equal(create.path, "/orders");
    assert.equal(create.requestBody.type, "CreateOrderRequest");

    const get = contract.matches[0].endpoints.find((item) => item.method === "GET");
    assert.equal(get.path, "/orders/{id}");
    assert.equal(get.parameters.some((item) => item.in === "path" && item.name === "id"), true);

    const interfaces = contractToYapiInterfaces(contract);
    const createApi = interfaces.find((item) => item.method === "POST");
    const req = JSON.parse(createApi.req_body_other);
    const res = JSON.parse(createApi.res_body);
    assert.equal(req.properties.sku.type, "string");
    assert.equal(req.properties.sku.description, "商品 SKU");
    assert.equal(req.properties.quantity.description, "购买数量");
    assert.equal(res.properties.id.type, "string");
    assert.equal(res.properties.items.type, "array");
});

test("完整 URL 也能命中端点", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yapi-push-"));
    const backendRoot = path.join(root, "order-service");
    fs.cpSync(fixtureRoot, backendRoot, { recursive: true });

    const contract = parseJavaSpring(backendRoot, "https://api.example.com/gateway/orders/{id}");
    assert.equal(contract.matches[0].endpoints.length, 1);
    assert.equal(contract.matches[0].endpoints[0].method, "GET");
});

test("GoneoResult<?> 从 service 调用推断 Page 返回类型", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yapi-push-"));
    const backendRoot = path.join(root, "order-service");
    fs.cpSync(fixtureRoot, backendRoot, { recursive: true });

    const contract = parseJavaSpring(backendRoot, "/orders/page");
    const endpoint = contract.matches[0].endpoints[0];
    assert.equal(endpoint.responseType, "GoneoResult<Page<OrderDto>>");

    const interfaces = contractToYapiInterfaces(contract);
    const res = JSON.parse(interfaces[0].res_body);
    assert.equal(res.properties.data.properties.records.type, "array");
    assert.equal(res.properties.data.properties.records.items.properties.id.type, "string");
    assert.equal(res.properties.data.properties.total.type, "integer");
});

test("GoneoResult.ok(Map.of) 推断 data 字段", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yapi-push-"));
    const backendRoot = path.join(root, "order-service");
    fs.cpSync(fixtureRoot, backendRoot, { recursive: true });

    const contract = parseJavaSpring(backendRoot, "/orders/quick");
    const endpoint = contract.matches[0].endpoints[0];
    assert.equal(endpoint.responseType, "GoneoResult<createQuickData>");
    const interfaces = contractToYapiInterfaces(contract);
    const res = JSON.parse(interfaces[0].res_body);
    assert.equal(res.properties.data.properties.id.type, "integer");
});
