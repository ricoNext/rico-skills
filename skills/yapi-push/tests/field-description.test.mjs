import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { extractFields } from "../scripts/lib/java-types.mjs";
import { javaTypeToSchema } from "../scripts/lib/java-to-schema.mjs";

test("提取 Javadoc、ApiModelProperty 与校验注解说明", () => {
    const fields = extractFields(`
public class CreateStandardApplyDTO {
	@NotBlank(message = "对象类型不能为空")
	private String objectType;

	/** 申请类型：1-新增 2-修改 3-停用 4-启用 */
	@NotNull(message = "申请类型不能为空")
	private Integer applyType;

	@ApiModelProperty("目标正式表ID；新增为空，修改/停用/启用必填")
	private Long targetId;

	private String name;
}
`);

    const byName = Object.fromEntries(fields.map((item) => [item.name, item]));
    assert.equal(byName.objectType.description, "对象类型不能为空");
    assert.equal(byName.objectType.required, true);
    assert.equal(byName.applyType.description, "申请类型：1-新增 2-修改 3-停用 4-启用");
    assert.equal(byName.applyType.required, true);
    assert.equal(byName.targetId.description, "目标正式表ID；新增为空，修改/停用/启用必填");
    assert.equal(byName.name.description, "");
    assert.equal(byName.name.required, false);
});

test("读取 fixture DTO 文件中的字段说明", () => {
    const dtoPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "fixtures/java/order-service/src/main/java/com/example/order/CreateOrderRequest.java"
    );
    const source = fs.readFileSync(dtoPath, "utf8");
    const byName = Object.fromEntries(extractFields(source).map((item) => [item.name, item]));
    assert.equal(byName.sku.description, "商品 SKU");
    assert.equal(byName.quantity.description, "购买数量");
});

test("JSON Schema 写入 description 和 required", () => {
    const schema = javaTypeToSchema("CreateStandardApplyDTO", new Map([["CreateStandardApplyDTO", {
        fields: [
            { description: "对象类型不能为空", name: "objectType", required: true, type: "String" },
            { description: "申请类型：1-新增 2-修改 3-停用 4-启用", name: "applyType", required: true, type: "Integer" },
        ],
        kind: "dto",
        name: "CreateStandardApplyDTO",
        qualifiedName: "com.example.CreateStandardApplyDTO",
    }]]));

    assert.equal(schema.properties.objectType.description, "对象类型不能为空");
    assert.equal(schema.properties.applyType.description, "申请类型：1-新增 2-修改 3-停用 4-启用");
    assert.deepEqual(schema.required, ["objectType", "applyType"]);
});
