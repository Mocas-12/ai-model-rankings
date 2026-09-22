# LLMRANKS · AI 大模型实时战力榜

一个纯静态的 AI 大模型实时排名网站。数据全部来自 [OpenRouter](https://openrouter.ai/rankings) 公开接口（浏览器直连，无需后端），每 5 分钟自动刷新，一眼看清**当下哪个模型、哪方面最强**。

![tech](https://img.shields.io/badge/tech-%E7%BA%AF%E9%9D%99%E6%80%81%20%2B%20ECharts-7c5cff) ![source](https://img.shields.io/badge/%E6%95%B0%E6%8D%AE-OpenRouter-22d3ee)

## 看什么

| 区块 | 内容 | 数据来源 |
|---|---|---|
| KPI 概览 | 24h Token 总量 / 请求次数 / 活跃模型数 / 用量冠军 | rankings/models |
| 用量总榜 | 24 小时真实 Token 消耗 Top 15（可切请求次数） | rankings/models?view=day |
| 分项王者 | 综合智能 / 编程 / 智能体 / 网页 / UI / 可视化 / 游戏 / SVG / 3D / 幻灯片 各维度 No.1 + 性价比之王 + 本周黑马 | AA · Design Arena · discovery |
| 能力矩阵 | 热门模型 × 9 维度相对强度热力图 | benchmarks + costPerRequest |
| 性价比图 | 单请求成本 vs 智能指数散点（气泡=用量） | benchmarks |
| 速度榜 | P50 延迟 vs 吞吐散点 | rankings/performance |
| 30 天趋势 | 头部模型每日 Token 曲线 | model-rankings-chart |
| 厂商格局 / 钱花在哪 | 周厂商份额环形图 / 30 天任务花费占比 | discovery · task-spend |
| 分类用量榜 | 编程 / 自然语言 / 长上下文 / 图像 / 工具调用 / 视频生成 | rankings/<category> |
| 本周黑马 & 新上架 | 周涨幅最大的模型（带迷你走势）/ 近 14 天新模型 | discovery · catalog/models |

> 智能指数 / 编程 / 智能体分数来自 Artificial Analysis，网页 / 可视化 / 游戏开发等分数来自 Design Arena ELO，均由 OpenRouter 官方 rankings 页聚合提供。

## 本地运行

纯静态，无任何构建与依赖：

```bash
cd ai-model-rankings
python -m http.server 8124
# 打开 http://127.0.0.1:8124
```

OpenRouter 所有引用接口均返回 `access-control-allow-origin: *`，直接双击 `index.html`（file://）通常也能跑。

## 部署

任意静态托管即可（Cloudflare Pages / Vercel / GitHub Pages）：把整个目录拖上去就行，无需环境变量、无需 Serverless 函数。

## 接口清单

```
GET https://openrouter.ai/api/frontend/v1/rankings/models?view=day
GET https://openrouter.ai/api/frontend/v1/rankings/benchmarks
GET https://openrouter.ai/api/frontend/v1/rankings/model-rankings-chart
GET https://openrouter.ai/api/frontend/v1/rankings/discovery
GET https://openrouter.ai/api/frontend/v1/rankings/task-spend
GET https://openrouter.ai/api/frontend/v1/rankings/performance
GET https://openrouter.ai/api/frontend/v1/rankings/{programming-language|natural-language|context-length|images|tools|video-output-hours}
GET https://openrouter.ai/api/frontend/v1/catalog/models
```

无需 API Key。站点内置：3 次重试 + 空数据重试（OpenRouter 边缘节点偶发返回 `data:null`）、3 路并发池、120s 会话缓存、失败区块自动沿用上次好数据。

## 免责

排名反映 OpenRouter 平台真实用量与第三方评测，仅供选型参考。
