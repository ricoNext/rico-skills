import { launchBrowser } from "./lib/browser.mjs";
import { readConfig, writeConfig } from "./lib/config.mjs";
import { formatCookie } from "./lib/yapi-client.mjs";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 1000;

const sleep = (ms) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const waitForLoginCookie = (page, deadline) => {
    const poll = () =>
        page.cookies().then((cookies) => {
            const cookie = formatCookie(cookies);
            if (cookie) {
                return cookie;
            }

            if (Date.now() >= deadline) {
                throw new Error("等待登录超时（5 分钟），请重新运行脚本");
            }

            return sleep(POLL_INTERVAL_MS).then(poll);
        });

    return poll();
};

const main = () => {
    const config = readConfig();
    const baseUrl = config.baseUrl;

    console.log(`正在打开浏览器，请在页面中登录 YApi：${baseUrl}`);

    return launchBrowser().then((browser) => {
        const deadline = Date.now() + LOGIN_TIMEOUT_MS;

        return browser
            .newPage()
            .then((page) => page.goto(baseUrl, { waitUntil: "domcontentloaded" }).then(() => page))
            .then((page) => waitForLoginCookie(page, deadline))
            .then((cookie) => {
                const nextConfig = writeConfig({
                    ...config,
                    cookie,
                });

                console.log("YApi Cookie 已自动获取并写入 config.json");
                return nextConfig;
            })
            .finally(() => browser.close());
    });
};

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
