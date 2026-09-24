/* 冒烟测试：拦截 OpenRouter 接口回放真实 fixture，让测试走完整真实渲染管线
 *  （getJSON → unwrap → prepareBench → renderAll），不依赖线上接口可用性。 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const fx = n => JSON.parse(readFileSync(join(HERE, "fixtures", n + ".json"), "utf-8"));

/* URL 片段 → fixture 文件名（与 app.js ENDPOINTS 一一对应） */
const FIXTURES = {
  "rankings/models?view=day": "usage",
  "rankings/benchmarks": "bench",
  "rankings/model-rankings-chart": "trend",
  "rankings/discovery": "disc",
  "rankings/task-spend": "spend",
  "rankings/performance": "perf",
  "rankings/programming-language": "prog",
  "rankings/natural-language": "nl",
  "rankings/context-length": "ctx",
  "rankings/images": "images",
  "rankings/tools": "tools",
  "rankings/video-output-hours": "video",
  "catalog/models": "catalog",
};

async function intercept(page, mode = "replay") {
  await page.route("**/openrouter.ai/**", async route => {
    if (mode === "abort") return route.abort();
    const url = route.request().url();
    for (const [needle, name] of Object.entries(FIXTURES)) {
      if (url.includes(needle)) {
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(fx(name)) });
      }
    }
    return route.fulfill({ status: 404, body: "{}", contentType: "application/json" });
  });
}

test("冒烟：数据管线走通、渲染零异常、分类榜可切换", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e));
  await intercept(page);
  await page.goto("/");

  // afterPrimary 跑完的标志：更新时间已写入真实北京时间（初始占位是 "--"）
  await page.waitForFunction(
    () => window.__render && (document.querySelector("#updated-time") || {}).textContent !== "--",
    null, { timeout: 20000 },
  );

  // 12 个数据接口全部成功 + 全部渲染器 safe() 零异常
  expect(await page.evaluate(() => window.__errs || [])).toEqual([]);
  expect(pageErrors).toEqual([]);

  // 分类榜切换（回归：renderCatTabs 曾漏调用导致按钮永不渲染）
  const tabs = page.locator("#cat-tabs .tab");
  await expect(tabs).toHaveCount(6);
  await page.locator('#cat-tabs button[data-cat="nl"]').click();
  await expect(page.locator("#cat-sub")).toContainText("自然语言");
  await expect(page.locator('#cat-tabs .tab.on')).toHaveAttribute("data-cat", "nl");

  // ECharts 真渲染出 canvas（不是空占位）
  expect(await page.locator("#chart-cat canvas").count()).toBeGreaterThan(0);
  expect(await page.locator("#chart-usage canvas").count()).toBeGreaterThan(0);

  // 无「加载中」残留：核心分区全部有内容
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("加载中…");

  // 工具箱：展开即见默认面板（回归：曾只 renderTool 不 showTool，展开后空空如也）
  await page.locator("#tools-toggle").click();
  await expect(page.locator("#tools-body")).toBeVisible();
  await expect(page.locator("#tool-vs")).toBeVisible();
  await expect(page.locator("#tool-vs")).not.toContainText("加载中…");
  await page.locator('#tool-tabs button[data-tool="cn"]').click();
  await expect(page.locator("#tool-cn")).not.toContainText("加载中…");
  await expect(page.locator(".duel-share")).toContainText("份额");
  await page.locator('#tool-tabs button[data-tool="calc"]').click();
  await expect(page.locator("#calc-out .t-table")).toBeVisible();

  // 详情弹层：点击维度之最行 → 弹出 → 加入对比 → 对比表出现 → ESC 关闭
  const slug = await page.locator("#dimtable tbody tr").first().getAttribute("data-slug");
  await page.locator("#dimtable tbody tr").first().click();
  await expect(page.locator("#modal")).toBeVisible();
  await expect(page.locator(".m-name")).toBeVisible();
  await page.locator("#modal-vs").click();
  await expect(page.locator("#vs-a")).toHaveValue(slug.split(":")[0].replace(/-(19|20)\d{6}.*$/, ""));
  await expect(page.locator("#vs-out .t-table")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal")).toBeHidden();

  // 拓印：canvas 绘制不抛错（下载行为不在冒烟内断言）
  await page.locator("#btn-stamp").click();
  await page.waitForTimeout(300);
});

test("降级：数据源失败时页面不崩、失败被记录进调试钩子", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e));
  await intercept(page, "abort");
  await page.goto("/");
  await page.waitForFunction(() => (window.__errs || []).length > 0, null, { timeout: 20000 });
  expect(await page.title()).toContain("墨榜");
  expect(pageErrors).toEqual([]);
});
