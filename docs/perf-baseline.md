# 性能基线（Lighthouse 12 · desktop preset）

> 复跑：`npm run serv`（或 `node tests/static-server.mjs`）后执行——
> `npx lighthouse@12 http://localhost:8938 --preset=desktop --only-categories=performance,accessibility,best-practices,seo --output=json --port=0 --quiet --chrome-flags="--headless=new"`
> CI 每次推送也会跑（smoke job 的 Lighthouse step，非阻塞，分数写入 Job Summary）。

## 基线（2026-09-25，本地 · Windows · Chrome stable）

| 类别 | desktop（目标用户体验） | mobile（Lighthouse 默认 Slow 4G 模拟） |
|------|------|------|
| Performance | **88** | 36 |
| Accessibility | **100** | 100 |
| Best Practices | **100** | 100 |
| SEO | **100** | 100 |

desktop 关键指标：FCP 1.3s · LCP 1.3s · TBT 20ms · CLS 0.085。

## 瓶颈分析与决策记录

- **mobile 档 36 分的主因是 1MB `vendor/echarts.min.js` 在模拟 Slow 4G 下的传输**（FCP 被拉到 16s）。这是 vendor 全量包 + 零构建的已知代价：echarts 按需打包需要引入构建步骤，与本项目「零构建、整目录可跑」的卖点冲突，**决策：不做**，以 desktop 档（真实用户是桌面看板场景）为验收口径。
- `unused-javascript ~598KiB`、`unused-css`：同上，echarts 全量包固有，不做。
- `valid-source-maps`：echarts.min.js 的 source map 约 3-4MB，不进仓库，不做。
- `bf-cache`：由测试服务器 `Cache-Control: no-store` 触发（`tests/static-server.mjs` 专用），真实部署（Streamlit Cloud / 静态托管）无此响应头，不适用。
- `uses-passive-event-listeners`：ECharts 内部 touch 监听，第三方内部实现，不修。
- 总量 ~1.3MB（其中 echarts 1MB）：gzip 后约 330KB（静态托管与 Streamlit 均默认压缩），可接受。

## a11y 达标手段（历史记录）

- 淡墨辅助字 `--txt3` 提亮至 `#978f7b`、朱砂文字 `--red-bright` 提亮至 `#e0654f`、新增印泥深朱砂 `--red-deep: #b03a2e` 仅用于印面白字——三个 token 均以满足 WCAG AA（4.5:1）为下限微调，主朱砂 `--red` 未动。
- 图表容器 `role="img"` + 动态 aria-label（渲染后写入榜首摘要）；tab 组方向键导航；刷新按钮 accessible name 即可见文本。
