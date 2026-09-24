/* @live 线上 shape 冒烟：不拦截网络，直连 OpenRouter 验证响应结构未被改版。
 *  fixture 回放测不出源站结构漂移（漂移时线上会静默空榜），本文件就是那条护栏。
 *  跑法：npm run test:live（CI 里仅每周 schedule job 触发）。
 *  标记用 @live 而非 [live]：方括号在 bash 下是字符类正则，会误伤 grep 过滤。 */
import { test, expect } from "@playwright/test";

test("@live OpenRouter 线上接口 shape 冒烟", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e));
  await page.goto("/");

  await page.waitForFunction(
    () => window.__render && (document.querySelector("#updated-time") || {}).textContent !== "--",
    null, { timeout: 60000 },
  );

  const shape = await page.evaluate(() => {
    const D = window.__D;
    const arr = v => Array.isArray(v) && v.length > 0;
    return {
      errs: window.__errs || [],
      // 主干三接口：字段与结构严格验证
      usage: arr(D.usage) && "total_prompt_tokens" in D.usage[0] && "model_permaslug" in D.usage[0],
      bench: !!(D.bench?.aaData?.intelligence?.length && D.bench?.costPerRequest &&
        Object.keys(D.bench.costPerRequest).length),
      cats: ["prog", "nl", "ctx", "images", "tools", "video"].map(k =>
        arr(D.cats[k]) && !!D.cats[k][D.cats[k].length - 1].ys),
      // 次要接口：只验证可解析（偶发 200 空响应已在 getJSON 内重试过）
      trend: Array.isArray(D.trend),
      perf: Array.isArray(D.perf),
      disc: typeof D.disc === "object" && D.disc !== null,
      spend: typeof D.spend === "object" && D.spend !== null,
    };
  });

  expect(shape.usage, "usage 接口结构变了").toBe(true);
  expect(shape.bench, "benchmarks 接口结构变了").toBe(true);
  expect(shape.cats.every(Boolean), "分类接口结构变了: " + JSON.stringify(shape.cats)).toBe(true);
  expect(shape.trend && shape.perf && shape.disc && shape.spend, "次要接口结构变了").toBe(true);
  expect(pageErrors, "页面运行时异常").toEqual([]);
  // 核心接口失败才留 errs；次要接口偶发失败属已知边缘节点问题，不拦
  const fatal = shape.errs.filter(e => /fetch (usage|bench|prog|nl|ctx|images|tools|video):/.test(e));
  expect(fatal, "核心接口抓取失败: " + JSON.stringify(fatal)).toEqual([]);
});
