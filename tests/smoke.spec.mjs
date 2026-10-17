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
  await page.route(/https:\/\/fonts\.(loli\.net|googleapis\.com|gstatic\.com)\//, route => route.abort());
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
  await page.locator("#dimensions summary").click();
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

test("首页：模型查找支持名称与 slug，未知模型给出提示，能力卡支持键盘", async ({ page }) => {
  await intercept(page);
  await page.goto("/");
  await page.waitForFunction(() => window.MB && window.MB.D.catalog);
  await expect(page.locator("#kings .king")).toHaveCount(3);
  await expect(page.locator("#dimensions")).not.toHaveAttribute("open");

  const query = page.locator("#model-query");
  const slug = await page.locator("#model-options option").first().getAttribute("value");
  const name = await page.evaluate(s => window.MB.nameOf(s), slug);
  for (const value of [slug, `  ${name.toUpperCase()}  `]) {
    await query.fill(value);
    await query.press("Enter");
    await expect(page.locator("#modal")).toBeVisible();
    await expect(page.locator(".m-name")).toContainText(name);
    await page.keyboard.press("Escape");
    await expect(query).toBeFocused();
  }
  await query.fill("unknown-model");
  await query.press("Enter");
  await expect(query).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#model-search-status")).toContainText("未找到");
  await expect(page.locator("#modal")).toBeHidden();

  await page.locator("#kings .king").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#modal")).toBeVisible();
});

test("导航：工具箱直达会展开，深链接打开后仍能收起", async ({ page }) => {
  await intercept(page);
  await page.goto("/");
  await page.locator('.section-nav a[href="#sec-tools"]').click();
  await expect(page).toHaveURL(/#sec-tools$/);
  await expect(page.locator("#tools-body")).toBeVisible();
  await expect(page.locator("#tools-toggle")).toHaveAttribute("aria-expanded", "true");
  await page.reload();
  await expect(page.locator("#tools-body")).toBeVisible();
  await page.locator("#tools-toggle").click();
  await expect(page.locator("#tools-body")).toBeHidden();
});

test("内嵌：导航在自适应高度 iframe 中把目标区带入视口", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await intercept(page);
  await page.route("**/__embedded__", route => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html><body style="margin:0"><iframe title="墨榜" src="/" style="width:100%;height:900px;border:0" sandbox="allow-scripts allow-same-origin"></iframe></body></html>',
  }));
  await page.goto("/__embedded__");
  const frame = page.frameLocator("iframe");
  await expect(frame.locator("#kings .king")).toHaveCount(3);
  await expect.poll(() => page.locator("iframe").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(2500);
  await frame.locator('.section-nav a[href="#sec-capability"]').click();
  const topInViewport = () => frame.locator("#sec-capability").evaluate(el =>
    el.getBoundingClientRect().top + window.frameElement.getBoundingClientRect().top);
  await expect.poll(topInViewport).toBeGreaterThanOrEqual(0);
  await expect.poll(topInViewport).toBeLessThan(300);
  await frame.locator('.section-nav a[href="#sec-tools"]').click();
  await expect(frame.locator("#tools-body")).toBeVisible();
  const toolsTop = () => frame.locator("#sec-tools").evaluate(el =>
    el.getBoundingClientRect().top + window.frameElement.getBoundingClientRect().top);
  await expect.poll(toolsTop).toBeGreaterThanOrEqual(0);
  const toolsBottom = () => frame.locator("#sec-tools").evaluate(el =>
    el.getBoundingClientRect().bottom + window.frameElement.getBoundingClientRect().top);
  await expect.poll(toolsBottom).toBeLessThanOrEqual(960);
});

for (const width of [1440, 900, 640, 390, 320]) {
  test(`布局：${width}px 无页面横向溢出，导航与图表可用`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await intercept(page);
    await page.goto("/");
    await page.waitForFunction(() => window.MB && window.MB.D.catalog);
    const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await noOverflow()).toBe(true);
    if (width === 1440 || width === 390) {
      expect(await page.evaluate(() => window.MB.chart('chart-usage').getOption().animation)).toBe(false);
      await page.screenshot({ path: `_probe/layout-${width}.png` });
    }
    await page.locator('.section-nav a[href="#sec-capability"]').click();
    const top = await page.locator("#sec-capability").evaluate(el => el.getBoundingClientRect().top);
    const headerBottom = await page.locator(".topbar").evaluate(el => el.getBoundingClientRect().bottom);
    expect(top).toBeGreaterThanOrEqual(headerBottom);
    await page.locator("#dimensions summary").click();
    await expect(page.locator("#dimtable tbody tr").first()).toBeVisible();
    if (width === 1440 || width === 390) {
      await page.locator("#sec-capability").screenshot({ path: `_probe/capability-${width}.png` });
    }
    expect(await noOverflow()).toBe(true);
    await page.locator("#dimtable tbody tr").first().press("Enter");
    await expect(page.locator("#modal")).toBeVisible();
    expect(await noOverflow()).toBe(true);
    await page.keyboard.press("Escape");
    await page.locator('.section-nav a[href="#sec-category"]').click();
    await page.locator('#cat-tabs button[data-cat="video"]').click();
    await expect(page.locator("#cat-sub")).toContainText("视频");
    expect(await noOverflow()).toBe(true);
    await page.locator('.section-nav a[href="#sec-usage"]').click();
    await page.locator('#usage-tabs button[data-metric="requests"]').click();
    await expect(page.locator("#usage-sub")).toContainText("请求次数");
    await expect(page.locator("#chart-usage")).toHaveAttribute("aria-label", /次请求/);
    await page.locator('.section-nav a[href="#sec-tools"]').click();
    await page.locator('#tool-tabs button[data-tool="calc"]').click();
    await expect(page.locator("#calc-out .t-table")).toBeVisible();
    expect(await noOverflow()).toBe(true);
  });
}

test("降级：数据源失败时页面不崩、失败被记录进调试钩子", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e));
  await intercept(page, "abort");
  await page.goto("/");
  await page.waitForFunction(() => (window.__errs || []).length > 0, null, { timeout: 20000 });
  expect(await page.title()).toContain("墨榜");
  expect(pageErrors).toEqual([]);
});
