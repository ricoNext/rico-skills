import assert from "node:assert/strict";
import test from "node:test";

import {
    buildYapiPayload,
    parseDefinitionInput,
    parseYapiTarget,
    stripJsonFence,
} from "../scripts/lib/parse-definition.mjs";

test("stripJsonFence 去掉 markdown 代码块", () => {
    const text = stripJsonFence("```json\n{\"title\":\"t\"}\n```");
    assert.equal(text, "{\"title\":\"t\"}");
});

test("解析完整 YApi interface/get 响应", () => {
    const input = {
        errcode: 0,
        data: {
            _id: 18430,
            title: "后台用户列表",
            path: "v1/mis-user/getBgFullList",
            method: "post",
            project_id: 112,
            catid: 1686,
            req_body_type: "json",
            req_body_other: { type: "object", properties: { keyword: { type: "string" } } },
            res_body_type: "json",
            res_body: { type: "object", properties: { list: { type: "array" } } },
            uid: 1,
            add_time: 1,
        },
    };

    const parsed = parseDefinitionInput(input);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.interfaces.length, 1);
    assert.equal(parsed.interfaces[0].title, "后台用户列表");
    assert.equal(parsed.interfaces[0].path, "/v1/mis-user/getBgFullList");
    assert.equal(parsed.interfaces[0].method, "POST");
    assert.equal(parsed.interfaces[0].id, 18430);
    assert.equal(parsed.interfaces[0].project_id, 112);
    assert.match(parsed.interfaces[0].req_body_other, /keyword/);
    assert.equal(
        parsed.interfaces[0].req_headers.some((item) => item.name === "Content-Type"),
        true
    );
});

test("解析 interfaces 包装对象", () => {
    const parsed = parseDefinitionInput({
        project_id: 112,
        catid: 1686,
        interfaces: [
            {
                title: "查询详情",
                path: "/user/detail",
                method: "GET",
                res: { type: "object", properties: { id: { type: "integer" } } },
            },
        ],
    });

    assert.equal(parsed.interfaces.length, 1);
    assert.equal(parsed.interfaces[0].title, "查询详情");
    assert.equal(parsed.interfaces[0].project_id, 112);
    assert.equal(parsed.interfaces[0].catid, 1686);
    assert.match(parsed.interfaces[0].res_body, /integer/);
});

test("解析接口数组与简化 schema 字段", () => {
    const parsed = parseDefinitionInput([
        {
            title: "创建用户",
            path: "/user/create",
            method: "POST",
            req_schema: { type: "object", properties: { name: { type: "string" } } },
            res_schema: { type: "object", properties: { id: { type: "integer" } } },
        },
    ]);

    assert.equal(parsed.interfaces.length, 1);
    assert.match(parsed.interfaces[0].req_body_other, /name/);
    assert.match(parsed.interfaces[0].res_body, /id/);
});

test("纯 JSON Schema 配合默认 title/path", () => {
    const parsed = parseDefinitionInput(
        { type: "object", properties: { id: { type: "integer" } } },
        { title: "查询详情", path: "/user/detail", method: "GET", schemaAs: "res" }
    );

    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.interfaces[0].title, "查询详情");
    assert.equal(parsed.interfaces[0].method, "GET");
    assert.match(parsed.interfaces[0].res_body, /integer/);
    assert.equal(parsed.interfaces[0].req_body_other, undefined);
});

test("缺少 title/path 时报错", () => {
    const parsed = parseDefinitionInput({ method: "POST" });
    assert.equal(parsed.interfaces.length, 0);
    assert.equal(parsed.errors[0].error, "缺少 title 或 path");
});

test("解析项目与分类 URL", () => {
    assert.deepEqual(parseYapiTarget("https://yapi.iotbull.com/project/112/interface/api/cat_1686"), {
        catId: 1686,
        projectId: 112,
    });
    assert.deepEqual(parseYapiTarget("https://yapi.iotbull.com/project/112"), {
        projectId: 112,
    });
});

test("buildYapiPayload 只保留可写入字段", () => {
    const payload = buildYapiPayload(
        {
            title: "创建用户",
            path: "/user/create",
            method: "POST",
            project_id: 112,
            catid: 1686,
            req_body_other: "{\"type\":\"object\"}",
            res_body: "{\"type\":\"object\"}",
            req_headers: [{ name: "Content-Type", value: "application/json" }],
        },
        { id: 99 }
    );

    assert.equal(payload.id, 99);
    assert.equal(payload.project_id, 112);
    assert.equal(payload.catid, 1686);
    assert.equal(payload.req_body_is_json_schema, true);
    assert.equal(payload.uid, undefined);
});
