import fs from "node:fs";
import puppeteer from "puppeteer-core";

const browserCandidates = [
    {
        darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        linux: "/usr/bin/google-chrome",
        name: "Google Chrome",
        win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },
    {
        darwin: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        linux: "/usr/bin/microsoft-edge",
        name: "Microsoft Edge",
        win32: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    },
    {
        darwin: "/Applications/Chromium.app/Contents/MacOS/Chromium",
        linux: "/usr/bin/chromium-browser",
        name: "Chromium",
        win32: "C:\\Program Files\\Chromium\\Application\\chrome.exe",
    },
];

export const resolveBrowserExecutable = () => {
    const platformKey = process.platform;
    const matched = browserCandidates
        .map((item) => item[platformKey])
        .filter((item) => typeof item === "string" && fs.existsSync(item));

    if (matched.length === 0) {
        throw new Error("未找到可用的 Chrome/Edge/Chromium，请先安装 Google Chrome");
    }

    return matched[0];
};

export const launchBrowser = () =>
    puppeteer.launch({
        args: ["--start-maximized"],
        defaultViewport: null,
        executablePath: resolveBrowserExecutable(),
        headless: false,
    });
