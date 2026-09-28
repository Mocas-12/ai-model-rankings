// Streamlit Community Cloud 保活：用无头 Chromium 真实访问各应用，
// 发现休眠页（"Zzzz … gone to sleep"）就自动点击唤醒按钮并等待冷启动完成。
// 必须走真实浏览器：应用域名对匿名请求一律 303 到 share.streamlit.io 做
// 游客 session 握手，纯 HTTP ping 到不了应用容器。
import { chromium } from "@playwright/test";

const APPS = [
  "https://ai-model-rankings.streamlit.app/",
  "https://steam-live-charts.streamlit.app/",
  "https://baiduhotsearch-d9ysnhxbkzeskrnd5apnn5.streamlit.app/",
  "https://gh-pain-intel-8egvafff3urokytzxa63x2.streamlit.app/",
];

const SLEEP_RE = /gone to sleep/i;
const GOTO_TIMEOUT = 60_000;
// 冷启动实测 ~60-90s，给足余量
const WAKE_TIMEOUT = 150_000;

// 注意：evaluate 的函数体序列化后在页面上下文执行，
// 引用不到 Node 侧变量，正则必须写成字面量
const pageState = (page) =>
  page.evaluate(() => ({
    title: document.title,
    sleeping: /gone to sleep/i.test(document.body?.innerText || ""),
    iframes: document.querySelectorAll("iframe").length,
    excerpt: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 200),
  }));

const browser = await chromium.launch();
let failed = [];

for (const url of APPS) {
  const host = new URL(url).hostname;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: GOTO_TIMEOUT });
    // 静默握手可能连跳几次 303，等它落定
    await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(8_000);

    let state = await pageState(page);
    if (state.sleeping) {
      console.log(`${host}: asleep — clicking wake button…`);
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) =>
          /get this app back up/i.test(b.textContent || ""),
        );
        if (btn) btn.click();
      });
      // 休眠文案消失 = 容器开始启动
      await page
        .waitForFunction((re) => !new RegExp(re, "i").test(document.body?.innerText || ""), SLEEP_RE.source, {
          timeout: WAKE_TIMEOUT,
        })
        .catch(() => {});
      await page.waitForTimeout(15_000); // 等 shell 渲染
      state = await pageState(page);
    }

    const ok = !state.sleeping && state.iframes > 0;
    console.log(`${host}: ${ok ? "AWAKE" : "STILL DOWN"} — "${state.title}", iframes=${state.iframes}${ok ? "" : ` | ${state.excerpt}`}`);
    if (!ok) failed.push(host);
  } catch (err) {
    console.log(`${host}: ERROR — ${err.message.split("\n")[0]}`);
    failed.push(host);
  } finally {
    await context.close();
  }
}

await browser.close();

if (failed.length) {
  console.error(`FAILED: ${failed.join(", ")}`);
  process.exit(1);
}
console.log("All apps awake.");
