import fs from "node:fs";
import path from "node:path";

function readPom(directory) {
	const file = path.join(directory, "pom.xml");
	if (!fs.existsSync(file)) return null;
	return { file, source: stripComments(fs.readFileSync(file, "utf8")) };
}

function stripComments(source) {
	return source.replace(/<!--[\s\S]*?-->/g, "");
}

function section(source, name) {
	return (
		source.match(
			new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"),
		)?.[1] || ""
	);
}

function blocks(source, name) {
	return [
		...source.matchAll(
			new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "gi"),
		),
	].map((match) => match[1]);
}

function directTag(source, name) {
	return (
		source
			.match(
				new RegExp(`<${name}\\b[^>]*>\\s*([^<]*?)\\s*</${name}>`, "i"),
			)?.[1]
			?.trim() || ""
	);
}

function withoutSections(source, names) {
	return names.reduce(
		(result, name) =>
			result.replace(
				new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?</${name}>`, "gi"),
				"",
			),
		source,
	);
}

function projectInfo(directory, inherited = {}) {
	const pom = readPom(directory);
	if (!pom) return null;
	const parent = section(pom.source, "parent");
	const projectBody = withoutSections(pom.source, [
		"parent",
		"modules",
		"dependencies",
		"dependencyManagement",
		"properties",
		"build",
		"profiles",
	]);
	const groupId =
		directTag(projectBody, "groupId") ||
		directTag(parent, "groupId") ||
		inherited.groupId ||
		"";
	const artifactId = directTag(projectBody, "artifactId");
	const dependencySource = withoutSections(pom.source, [
		"dependencyManagement",
		"build",
		"profiles",
	]);
	return {
		directory,
		pomPath: pom.file,
		sourceRoot: path.join(directory, "src", "main", "java"),
		groupId,
		artifactId,
		key: groupId && artifactId ? `${groupId}:${artifactId}` : "",
		modules: blocks(section(pom.source, "modules"), "module")
			.map((module) => module.trim())
			.filter(Boolean),
		dependencies: blocks(
			section(dependencySource, "dependencies"),
			"dependency",
		)
			.map((dependency) => ({
				groupId: directTag(dependency, "groupId"),
				artifactId: directTag(dependency, "artifactId"),
				scope: directTag(dependency, "scope") || "compile",
			}))
			.filter(({ groupId, artifactId }) => groupId && artifactId),
	};
}

function collectModules(directory, inherited, seen = new Set()) {
	const absoluteDirectory = path.resolve(directory);
	if (seen.has(absoluteDirectory)) return [];
	seen.add(absoluteDirectory);
	const info = projectInfo(absoluteDirectory, inherited);
	if (!info) return [];
	const children = info.modules.flatMap((modulePath) =>
		collectModules(path.resolve(absoluteDirectory, modulePath), info, seen),
	);
	return [info, ...children];
}

function contains(directory, target) {
	const relative = path.relative(directory, target);
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

function findAggregateRoot(directory) {
	let current = path.resolve(directory);
	while (true) {
		const info = projectInfo(current);
		if (info?.modules.length) return { directory: current, info };
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

function dependencyModules(module, byKey) {
	const result = [];
	const visited = new Set();
	const visit = (current) => {
		for (const dependency of current.dependencies) {
			if (["test", "provided", "system"].includes(dependency.scope)) continue;
			const target = byKey.get(
				`${dependency.groupId}:${dependency.artifactId}`,
			);
			if (!target || visited.has(target.directory)) continue;
			visited.add(target.directory);
			result.push(target);
			visit(target);
		}
	};
	visit(module);
	return result;
}

export function resolveMavenWorkspace(backendRoot) {
	const requestedDirectory = path.resolve(backendRoot);
	const aggregate = findAggregateRoot(requestedDirectory);
	if (!aggregate) {
		const module = projectInfo(requestedDirectory) || {
			directory: requestedDirectory,
			pomPath: "",
			sourceRoot: path.join(requestedDirectory, "src", "main", "java"),
			groupId: "",
			artifactId: path.basename(requestedDirectory),
			key: "",
			modules: [],
			dependencies: [],
		};
		module.typeSourceRoots = [module.sourceRoot];
		return {
			aggregateRoot: null,
			modules: [module],
			controllerModules: [module],
		};
	}

	const modules = collectModules(aggregate.directory, aggregate.info);
	const byKey = new Map(
		modules
			.filter((module) => module.key)
			.map((module) => [module.key, module]),
	);
	for (const module of modules) {
		const dependencies = dependencyModules(module, byKey);
		module.typeSourceRoots = [
			module.sourceRoot,
			...dependencies.map(({ sourceRoot }) => sourceRoot),
		];
	}
	const requestedModule = modules.find(
		(module) =>
			module.modules.length === 0 &&
			contains(module.directory, requestedDirectory) &&
			contains(requestedDirectory, module.directory),
	);
	const controllerModules = requestedModule
		? [requestedModule]
		: modules.filter(({ sourceRoot }) => fs.existsSync(sourceRoot));
	return { aggregateRoot: aggregate.directory, modules, controllerModules };
}
