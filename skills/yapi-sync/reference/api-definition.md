---
description: 全局接口定义规范，用于统一 src/api 下 API 的写法与类型约定
globs: src/api/**/*.ts
alwaysApply: false
---

# 接口定义规则（API Definition）

在 `src/api/` 下新增或修改接口时，须遵守以下规范。

## 1. 文件与模块

- 接口按**业务域**组织在 `src/api/` 下，单文件对应一个业务模块（如 `training.ts`、`stat.ts`）。
- **参数类型**：不需要在 `src/types` 下单独定义；入参类型**直接在当前函数中定义**即可（见下文「类型约定」与 `stat.ts` 中 `statOrderOverview` 示例）。若类型在多处复用，可再抽到 `src/types/` 的 `*.biz.ts` 文件中。

## 2. 请求方式

- 统一从 `@/api` 引入 `request`，不使用裸 `fetch` 或其它请求库。
- 默认使用 **POST**，入参通过 `{ data }` 传递；无入参时传 `{ data: {} }`。
- 返回类型通过泛型声明：`request<TResponse>(url, { data })`。

```ts
import request from "@/api";
import type { TListParams, TListItem } from "@/types/xxx.biz";

/** 获取列表 */
export const getXxxList = (data: TListParams) =>
	request<Response.PageData<TListItem>>("/v1/xxx/list", { data });

/** 获取统计（无参） */
export const getXxxStat = () => request<TXxxStat>("/v1/xxx/stat", { data: {} });
```

## 3. 类型约定

- **入参**：**优先在函数签名处内联定义**（对象字面量类型 + 字段 JSDoc），无需在 `src/types` 下单独声明；仅当类型在多处复用时再抽到 `src/types/*.biz.ts` 文件中。示例见 `stat.ts` 中 `statOrderOverview`：

```ts
/**
 * B - 销售统计总览
 * https://yapi.iotbull.com/project/112/interface/api/28045
 */
export const statOrderOverview = (data: {
	/** 按区域或门店搜索 */
	levelId?: any;
	/** 按省份CODE搜索 */
	provinceCode?: string;
	/** 按城市CODE搜索 */
	cityCode?: string;
	/** 按用户搜索 */
	userId?: any;
}) =>
	request<TSaleStat>("/v1/mis-stat/statOrderOverview", { data });
```

- **返回**：列表且分页使用 `Response.PageData<T>`；单条或非分页使用具体类型如 `TItem`、`TXxxStat`；返回类型可从 `@/types/*.biz` 引入。
- 抽到 `src/types/*.biz.ts` 的类型遵循项目 TS 规范：`type` 用 `T` 前缀，`interface` 用 `I` 前缀。

## 4. 命名

- 接口函数命名：**动词 + 名词**，语义清晰。
  - 查询：`getXxxList`、`getXxxDetail`、`getXxxStat`
  - 创建：`createXxx`
  - 更新：`updateXxx`
  - 删除：`deleteXxx`
- URL 路径与后端约定一致，一般为 `/v1/模块/方法`。

## 5. 注释

每个导出的接口函数上方**必须**有 JSDoc 注释，且包含两行：

1. **第一行**：接口作用说明（如「获取省级列表」「获取培训列表（B-培训列表查询）」）。
2. **第二行**：该接口在 YAPI 上的定义地址，完整 URL，便于联调与回溯。

格式示例（与 `address.ts` 中 `getProvinceAllList` 一致）：

```ts
/**
 * 获取省级列表
 * https://yapi.iotbull.com/project/112/interface/api/17400
 */
export const getProvinceAllList = () =>
	request<TAddressItem[]>("/v1/mis-address-province/getProvinceAllList", { method: "get" });
```

```ts
/**
 * 获取培训列表（B-培训列表查询）
 * https://yapi.iotbull.com/project/112/interface/api/32640
 */
export const getTrainingList = (data: TTrainingAdminListParams) =>
	request<Response.PageData<TTrainingListItem>>("/v1/mis-training/getTrainingList", { data });
```

## 6. 其它

- 不在此规则范围内的请求（如 GET、FormData 上传）仍使用 `request`，并按需传 `method`、`data` 等，类型与注释同样遵守上述约定。
