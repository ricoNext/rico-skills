import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libDir = path.dirname(fileURLToPath(import.meta.url));
export const scriptsDir = path.resolve(libDir, "..");
export const skillDir = path.resolve(scriptsDir, "..");
export const configPath = path.join(skillDir, "config.json");

const defaultConfig = {
    baseUrl: "https://yapi.iotbull.com",
    cookie: "",
};

export const readConfig = () => {
    if (!fs.existsSync(configPath)) {
        return { ...defaultConfig };
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
        baseUrl: parsed.baseUrl || defaultConfig.baseUrl,
        cookie: parsed.cookie || "",
    };
};

export const writeConfig = (config) => {
    const nextConfig = {
        baseUrl: config.baseUrl || defaultConfig.baseUrl,
        cookie: config.cookie || "",
    };
    fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
    return nextConfig;
};
