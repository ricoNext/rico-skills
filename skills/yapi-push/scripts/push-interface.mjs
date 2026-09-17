import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { contractToYapiInterfaces } from "./lib/contract-to-yapi.mjs";
import { readConfig, writePushConfig } from "./lib/config.mjs";
import { parseJavaSpring } from "./lib/java-cst.mjs";
import { buildYapiPayload, parseDefinitionInput, parseYapiTarget } from "./lib/parse-definition.mjs";
import { isRouteLike, normalizeUserRoute, stripProjectBasepath } from "./lib/parse-route.mjs";
import {
    addInterface,
    buildInterfaceUrl,
    ensureValidCookie,
    findCategoryByName,
    findExisting,
    flattenMenu,
    getCatMenu,
    getListMenu,
    getProject,
    updateInterface,
} from "./lib/yapi-client.mjs";

const printUsage = () => {
    console.log(`用法:
  node push-interface.mjs --project <projectRoot> --route <接口路径> [--dry-run]
  node push-interface.mjs --project <projectRoot> --strategy overwrite|skip --route <接口路径>
  node push-interface.mjs --project <projectRoot> --list-cats --project-id <id>
  node push-interface.mjs --project <projectRoot> --list-menu --project-id <id>

主输入是后端接口地址（Controller 上的 path，或带域名的完整 URL）。
脚本会从当前仓库的 Spring MVC Controller 解析入参/返回类型，再写入 YApi。

选项:
  --project <dir>           用户项目根目录（默认当前仓库）
  --backend-root <dir>      Java 工程根，默认与 --project 相同
  --route <path>            接口路径，可重复；也可直接把路径作为位置参数
  --project-id <id>         YApi 项目 ID
  --cat-id <id>             分类 ID
  --strategy overwrite|skip 已存在接口的处理策略；默认 overwrite
  --dry-run                 只预览，不写入
  --save-defaults           把本次 project-id/cat-id 写入 .rico-skill/yapi-push/config.json
  --list-cats               列出项目分类
  --list-menu               列出项目接口菜单`);
};

const takeFlagValue = (args, name) => {
    const index = args.indexOf(name);
    if (index < 0 || index >= args.length - 1) {
        return undefined;
    }

    const value = args[index + 1];
    args.splice(index, 2);
    return value;
};

const takeAllFlagValues = (args, name) => {
    const values = [];
    let value = takeFlagValue(args, name);
    while (value !== undefined) {
        values.push(value);
        value = takeFlagValue(args, name);
    }

    return values;
};

const hasFlag = (args, name) => {
    const index = args.indexOf(name);
    if (index < 0) {
        return false;
    }

    args.splice(index, 1);
    return true;
};

const readStdin = () =>
    new Promise((resolve, reject) => {
        const chunks = [];
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => chunks.push(chunk));
        process.stdin.on("end", () => resolve(chunks.join("")));
        process.stdin.on("error", reject);
    });

const readInputText = async (files) => {
    if (files.length === 0) {
        if (process.stdin.isTTY) {
            printUsage();
            process.exit(1);
        }

        return readStdin();
    }

    if (files.includes("-")) {
        return readStdin();
    }

    return files
        .map((file) => fs.readFileSync(path.resolve(file), "utf8"))
        .join("\n");
};

const printJson = (payload) => {
    console.log(JSON.stringify(payload, null, 2));
};

const resolveCatId = (definition, cats, fallbackCatId) => {
    if (definition.catid) {
        return definition.catid;
    }

    if (definition.cat_name) {
        const matched = findCategoryByName(cats, definition.cat_name);
        if (matched) {
            return matched._id;
        }
    }

    return fallbackCatId || undefined;
};

const resolveCatName = (catid, catName, cats) => {
    const matched = (cats || []).find((item) => item._id === catid) || findCategoryByName(cats, catName);
    return matched?.name || catName;
};

const previewItems = (interfaces, menu, cats, defaults) =>
    interfaces.map((item) => {
        const catid = resolveCatId(item, cats, defaults.catId);
        const existing = findExisting(menu, item.path, item.method, defaults.basepath);
        return {
            action: existing ? "update" : "create",
            catName: resolveCatName(catid, item.cat_name, cats),
            catid,
            controller: item.controller,
            existingId: existing?.id,
            existingPath: existing?.path,
            existingTitle: existing?.title,
            javaMethod: item.javaMethod,
            method: item.method,
            missingCat: !catid,
            path: item.path,
            project_id: item.project_id || defaults.projectId,
            source: item.source,
            title: item.title,
        };
    });

const main = async () => {
    const args = process.argv.slice(2);
    const projectRoot = takeFlagValue(args, "--project");
    if (projectRoot) {
        process.env.YAPI_PROJECT_ROOT = projectRoot;
    }

    const projectIdFlag = takeFlagValue(args, "--project-id");
    const catIdFlag = takeFlagValue(args, "--cat-id");
    const backendRoot = takeFlagValue(args, "--backend-root") || projectRoot || process.cwd();
    const title = takeFlagValue(args, "--title");
    const apiPath = takeFlagValue(args, "--path");
    const method = takeFlagValue(args, "--method");
    const schemaAs = takeFlagValue(args, "--schema-as") || "res";
    const strategy = takeFlagValue(args, "--strategy") || "overwrite";
    const routes = takeAllFlagValues(args, "--route");
    const dryRun = hasFlag(args, "--dry-run");
    const saveDefaults = hasFlag(args, "--save-defaults");
    const listCats = hasFlag(args, "--list-cats");
    const listMenu = hasFlag(args, "--list-menu");

    if (args.includes("--help") || args.includes("-h")) {
        printUsage();
        process.exit(0);
    }

    const config = readConfig(projectRoot);
    const targetFromArgs = parseYapiTarget(args.filter((item) => item.includes("/project/") || /^cat[_:]/i.test(item)).join(" "));
    const remaining = args.filter((item) => !(item.includes("/project/") || /^cat[_:]/i.test(item)));
    const positionalRoutes = remaining.filter((item) => isRouteLike(item)).map((item) => normalizeUserRoute(item));
    const jsonFiles = remaining.filter((item) => !isRouteLike(item));
    const allRoutes = [...new Set([...routes.map((item) => normalizeUserRoute(item)), ...positionalRoutes].filter(Boolean))];

    const projectId = Number(projectIdFlag || targetFromArgs.projectId || config.projectId) || undefined;
    const catId = Number(catIdFlag || targetFromArgs.catId || config.catId) || undefined;

    if (listCats || listMenu) {
        if (!projectId) {
            printJson({ error: "列出分类/菜单需要 --project-id", ok: false });
            process.exit(1);
        }

        await ensureValidCookie({ projectId });
        if (listCats) {
            const cats = await getCatMenu(projectId);
            printJson({
                cats: cats.map((item) => ({ id: item._id, name: item.name })),
                ok: true,
                projectId,
            });
            return;
        }

        const menu = await getListMenu(projectId);
        printJson({
            interfaces: flattenMenu(menu),
            ok: true,
            projectId,
        });
        return;
    }

    const parsed = { errors: [], interfaces: [], unresolved: [] };

    if (allRoutes.length > 0) {
        for (const route of allRoutes) {
            const contract = parseJavaSpring(backendRoot, route);
            if (contract.matches.length === 0) {
                parsed.errors.push({ error: `未在源码中找到接口: ${route}`, route });
                continue;
            }

            parsed.unresolved.push(...(contract.unresolved || []));
            parsed.interfaces.push(...contractToYapiInterfaces(contract, { catId, projectId }));
        }
    } else if (jsonFiles.length > 0) {
        const inputText = await readInputText(jsonFiles);
        const fromJson = parseDefinitionInput(inputText, {
            catId,
            method,
            path: apiPath,
            projectId,
            schemaAs,
            title,
        });
        parsed.errors.push(...fromJson.errors);
        parsed.interfaces.push(...fromJson.interfaces);
    } else {
        printJson({
            ok: false,
            reason: "请提供接口地址，例如 --route /v1/mis-quotation-space/getQuotationSpaceList",
        });
        process.exit(1);
    }

    if (projectIdFlag) {
        const forcedProjectId = Number(projectIdFlag);
        for (const item of parsed.interfaces) {
            item.project_id = forcedProjectId;
        }
    }

    if (catIdFlag) {
        const forcedCatId = Number(catIdFlag);
        for (const item of parsed.interfaces) {
            item.catid = forcedCatId;
        }
    }

    if (parsed.interfaces.length === 0) {
        printJson({
            errors: parsed.errors,
            ok: false,
            reason: "没有解析到有效接口定义",
        });
        process.exit(1);
    }

    const resolvedProjectId = projectId || parsed.interfaces.find((item) => item.project_id)?.project_id;
    if (!resolvedProjectId) {
        if (dryRun) {
            printJson({
                errors: parsed.errors,
                interfaces: parsed.interfaces,
                needsProjectId: true,
                ok: parsed.interfaces.length > 0,
                unresolved: parsed.unresolved,
            });
            process.exit(parsed.interfaces.length > 0 ? 0 : 1);
        }

        printJson({
            errors: parsed.errors,
            interfaces: parsed.interfaces,
            ok: false,
            reason: "已从源码解析到接口，但缺少 YApi project_id。请提供项目 URL 或 --project-id",
            unresolved: parsed.unresolved,
        });
        process.exit(1);
    }

    await ensureValidCookie({ projectId: resolvedProjectId });
    const [cats, menu, projectInfo] = await Promise.all([
        getCatMenu(resolvedProjectId),
        getListMenu(resolvedProjectId),
        getProject(resolvedProjectId),
    ]);
    const basepath = projectInfo?.basepath || "";
    const items = previewItems(parsed.interfaces, menu, cats, {
        basepath,
        catId,
        projectId: resolvedProjectId,
    });

    const missingCat = items.filter((item) => item.missingCat);
    const summary = {
        create: items.filter((item) => item.action === "create").length,
        parseErrors: parsed.errors.length,
        update: items.filter((item) => item.action === "update").length,
    };

    if (dryRun) {
        printJson({
            cats: cats.map((item) => ({ id: item._id, name: item.name })),
            errors: parsed.errors,
            items,
            ok: parsed.errors.length === 0,
            projectId: resolvedProjectId,
            summary,
            unresolved: parsed.unresolved,
        });
        if (parsed.errors.length > 0) {
            process.exit(2);
        }
        return;
    }

    if (missingCat.length > 0) {
        printJson({
            cats: cats.map((item) => ({ id: item._id, name: item.name })),
            error: "部分接口缺少 catid，请使用 --cat-id 或在定义中提供 catid / cat_name",
            items: missingCat,
            ok: false,
        });
        process.exit(1);
    }

    if (!["overwrite", "skip"].includes(strategy)) {
        printJson({ error: `不支持的 strategy: ${strategy}`, ok: false });
        process.exit(1);
    }

    if (saveDefaults) {
        writePushConfig({ catId, projectId: resolvedProjectId }, projectRoot);
    }

    const results = [];
    for (const [index, definition] of parsed.interfaces.entries()) {
        const preview = items[index];
        const shouldSkip = preview.action === "update" && strategy === "skip";
        if (shouldSkip) {
            results.push({
                action: "skip",
                id: preview.existingId,
                method: preview.method,
                ok: true,
                path: preview.path,
                title: preview.title,
                url: buildInterfaceUrl(config.baseUrl, resolvedProjectId, preview.existingId),
            });
            continue;
        }

        try {
            const payload = buildYapiPayload({
                ...definition,
                path: preview.existingPath || stripProjectBasepath(definition.path, basepath),
            }, {
                catId: preview.catid,
                id: preview.action === "update" ? preview.existingId : undefined,
                projectId: resolvedProjectId,
            });
            const data = preview.action === "update" ? await updateInterface(payload) : await addInterface(payload);
            const id = data?._id || preview.existingId;
            results.push({
                action: preview.action,
                id,
                method: preview.method,
                ok: true,
                path: preview.path,
                title: preview.title,
                url: id ? buildInterfaceUrl(config.baseUrl, resolvedProjectId, id) : undefined,
            });
        } catch (error) {
            if (error.code === "YAPI_AUTH_REQUIRED") {
                throw error;
            }

            results.push({
                action: preview.action,
                error: error.message,
                method: preview.method,
                ok: false,
                path: preview.path,
                title: preview.title,
            });
        }
    }

    const failed = results.filter((item) => !item.ok).length;
    printJson({
        ok: failed === 0,
        results,
        summary: {
            created: results.filter((item) => item.ok && item.action === "create").length,
            failed,
            skipped: results.filter((item) => item.ok && item.action === "skip").length,
            updated: results.filter((item) => item.ok && item.action === "update").length,
        },
    });

    if (failed > 0) {
        process.exit(2);
    }
};

main().catch((error) => {
    console.error(error.message || error);
    process.exit(error.code === "YAPI_AUTH_REQUIRED" ? 10 : 1);
});
