import { parseYapiInput } from "./lib/parse-input.mjs";
import { ensureValidCookie, getInterfaceDetail, listCatInterfaces } from "./lib/yapi-client.mjs";

const printUsage = () => {
    console.log(`用法:
  node fetch-interface.mjs [--project <projectRoot>] <input> [input...]
  node fetch-interface.mjs --project /path/to/project 18430,18431
  node fetch-interface.mjs --project /path/to/project https://yapi.iotbull.com/project/52/interface/api/cat_1686
  node fetch-interface.mjs --resolve-only --project /path/to/project cat_1686

输入支持:
  - 单个/多个接口 ID 或接口 URL
  - 分类 URL（/interface/api/cat_{catId}）或 cat_{catId} / cat:{catId}

选项:
  --project <projectRoot>  用户项目根目录，配置读写到 .rico-skill/yapi-sync/config.json，Cookie 读写到 .rico-skill/yapi-sync/cookie.txt
  --resolve-only           仅解析并展开分类，输出接口 ID 列表，不拉取详情`);
};

const resolveInputs = (parsedItems) => {
    const categories = [];
    const interfaceMap = new Map();

    const addInterface = (item, source) => {
        const id = item._id ?? item.id;
        if (!id) {
            return;
        }

        if (!interfaceMap.has(id)) {
            interfaceMap.set(id, {
                id,
                method: item.method,
                path: item.path,
                source,
                title: item.title,
            });
        }
    };

    return parsedItems
        .reduce(
            (chain, item) =>
                chain.then((state) => {
                    if (item.type === "interface") {
                        addInterface({ _id: item.id, title: `接口 ${item.id}` }, item.raw);
                        return state;
                    }

                    return listCatInterfaces(item.id)
                        .then((list) => {
                            const interfaces = list
                                .map((entry) => ({
                                    id: entry._id,
                                    method: entry.method,
                                    path: entry.path,
                                    title: entry.title,
                                }))
                                .filter((entry) => entry.id);

                            categories.push({
                                catId: item.id,
                                count: interfaces.length,
                                interfaces,
                                raw: item.raw,
                            });

                            for (const entry of list) {
                                addInterface(entry, item.raw);
                            }

                            return state;
                        })
                        .catch((error) => {
                            if (error.code === "YAPI_AUTH_REQUIRED") {
                                throw error;
                            }

                            categories.push({
                                catId: item.id,
                                error: error.message,
                                interfaces: [],
                                raw: item.raw,
                            });
                            return state;
                        });
                }),
            Promise.resolve()
        )
        .then(() => ({
            categories,
            interfaceIds: [...interfaceMap.keys()],
            interfaces: [...interfaceMap.values()],
        }));
};

const fetchInterfaceDetails = (interfaceIds) => {
    const results = [];

    return interfaceIds
        .reduce(
            (chain, interfaceId) =>
                chain.then(() =>
                    getInterfaceDetail(interfaceId)
                        .then((data) => {
                            results.push({
                                data,
                                id: interfaceId,
                                ok: true,
                            });
                        })
                        .catch((error) => {
                            if (error.code === "YAPI_AUTH_REQUIRED") {
                                throw error;
                            }

                            results.push({
                                error: error.message,
                                id: interfaceId,
                                ok: false,
                            });
                            return undefined;
                        })
                ),
            Promise.resolve()
        )
        .then(() => results);
};

const main = () => {
    const args = process.argv.slice(2);
    const resolveOnly = args.includes("--resolve-only");
    const inputArgs = args.filter((item) => item !== "--resolve-only");

    // 检查是否传入项目根目录
    let projectRoot = null;
    const yapiProjectRootIdx = inputArgs.findIndex((arg) => arg === "--project");
    if (yapiProjectRootIdx >= 0 && yapiProjectRootIdx < inputArgs.length - 1) {
        projectRoot = inputArgs[yapiProjectRootIdx + 1];
        inputArgs.splice(yapiProjectRootIdx, 2);
    }

    // 设置环境变量供 lib 使用
    if (projectRoot) {
        process.env.YAPI_PROJECT_ROOT = projectRoot;
    }

    if (inputArgs.length === 0) {
        printUsage();
        process.exit(1);
    }

    const parsedItems = parseYapiInput(inputArgs.join(","));
    if (parsedItems.length === 0) {
        console.error("未解析到有效的 YApi 接口或分类输入");
        process.exit(1);
    }

    const testInterfaceId = parsedItems.find((item) => item.type === "interface")?.id;
    const testCatId = parsedItems.find((item) => item.type === "category")?.id;

    const run = () =>
        resolveInputs(parsedItems).then((resolved) => {
            if (resolveOnly) {
                const payload = {
                    categories: resolved.categories,
                    failedCategories: resolved.categories.filter((item) => item.error).length,
                    inputs: parsedItems,
                    interfaces: resolved.interfaces,
                    total: resolved.interfaceIds.length,
                };
                console.log(JSON.stringify(payload, null, 2));
                if (payload.failedCategories > 0) {
                    process.exit(2);
                }
                return undefined;
            }

            if (resolved.interfaceIds.length === 0) {
                console.error("分类下未找到可同步的接口");
                process.exit(1);
            }

            return fetchInterfaceDetails(resolved.interfaceIds).then((results) => {
                const payload = {
                    failed: results.filter((item) => !item.ok).length,
                    resolved: {
                        categories: resolved.categories,
                        inputs: parsedItems,
                        interfaceIds: resolved.interfaceIds,
                    },
                    results,
                    success: results.filter((item) => item.ok).length,
                    total: results.length,
                };

                console.log(JSON.stringify(payload, null, 2));
                if (payload.failed > 0) {
                    process.exit(2);
                }
            });
        });

    return ensureValidCookie({ testCatId, testInterfaceId })
        .then(() => run());
};

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
