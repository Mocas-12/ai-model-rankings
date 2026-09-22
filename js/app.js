/* LLMRANKS · AI 大模型实时战力榜
 * 数据源：OpenRouter 公开前端接口（CORS 全开，纯静态可跑）
 *  - rankings/models?view=day   24h 逐模型用量
 *  - rankings/benchmarks        AA 智能/编程/智能体分 + Design Arena 各项 ELO + 成本
 *  - rankings/model-rankings-chart  30 天头部模型趋势
 *  - rankings/discovery         周涨幅/爆发/厂商份额
 *  - rankings/task-spend        30 天任务花费占比
 *  - rankings/performance       P50 延迟 / 吞吐
 *  - rankings/<category>        编程/自然语言/长上下文/图像/工具/视频 分类用量
 *  - catalog/models             全量模型目录（懒加载：名称/上架时间/上下文）
 */
(() => {
'use strict';

const API = 'https://openrouter.ai/api/frontend/v1/';
const ENDPOINTS = {
  usage:     API + 'rankings/models?view=day',
  bench:     API + 'rankings/benchmarks',
  trend:     API + 'rankings/model-rankings-chart',
  disc:      API + 'rankings/discovery',
  spend:     API + 'rankings/task-spend',
  perf:      API + 'rankings/performance',
  prog:      API + 'rankings/programming-language',
  nl:        API + 'rankings/natural-language',
  ctx:       API + 'rankings/context-length',
  images:    API + 'rankings/images',
  tools:     API + 'rankings/tools',
  video:     API + 'rankings/video-output-hours',
};
const CATALOG_URL = API + 'catalog/models';
const REFRESH_SEC = 300;

/* ---------------- 小工具 ---------------- */
const $ = s => document.querySelector(s);
const PAL = [
  '#6f9bc4', // 花青
  '#e0b04a', // 藤黄
  '#63a583', // 石绿
  '#a87ab0', // 紫棠
  '#c99a5f', // 赭石
  '#a0a858', // 苔绿
  '#7ec8c0', // 青碧
  '#9aa8d4', // 青金
  '#d4c9a2', // 月白
];
const TIP = { backgroundColor:'#26221b', borderColor:'#454036', textStyle:{color:'#ddd6c4',fontSize:12}, confine:true, extraCssText:'box-shadow:0 4px 16px rgba(0,0,0,.45);' };
const AXIS_C = line => ({ axisLine:{lineStyle:{color:'#454036'}}, axisTick:{show:false}, axisLabel:{color:'#a89f8a',fontSize:11}, splitLine: line?{lineStyle:{color:'#322d25'}}:{show:false} });

const fmtTok  = n => n >= 1e12 ? (n/1e12).toFixed(2)+' 万亿' : n >= 1e8 ? (n/1e8).toFixed(1)+' 亿' : n >= 1e4 ? (n/1e4).toFixed(1)+' 万' : String(Math.round(n));
const fmtTokS = n => n >= 1e12 ? (n/1e12).toFixed(1)+'万亿' : n >= 1e8 ? (n/1e8).toFixed(0)+'亿' : fmtTok(n);
const fmtReq  = n => n >= 1e8 ? (n/1e8).toFixed(2)+'亿' : n >= 1e4 ? (n/1e4).toFixed(1)+'万' : String(Math.round(n));
const fmtUsd  = n => n >= 1 ? '$'+n.toFixed(2) : '$'+n.toFixed(4);
const bjTime  = () => new Date().toLocaleString('zh-CN', { timeZone:'Asia/Shanghai', hour12:false });
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------------- 名称/ slug 解析 ---------------- */
const AUTHORS = {
  openai:'OpenAI', deepseek:'DeepSeek', 'z-ai':'Z.ai', 'x-ai':'xAI', google:'Google', anthropic:'Anthropic',
  moonshotai:'Moonshot AI', qwen:'Qwen', meta:'Meta', mistralai:'Mistral AI', minimax:'MiniMax',
  bytedance:'ByteDance', 'alibaba':'Alibaba', tencent:'Tencent', baidu:'Baidu', xiaomi:'Xiaomi',
  nvidia:'NVIDIA', microsoft:'Microsoft', 'amazon':'Amazon', cohere:'Cohere', ai21:'AI21',
  perplexity:'Perplexity', openrouter:'OpenRouter', inclusionai:'InclusionAI', stepfun:'StepFun',
  thudm:'THUDM', nexai:'Nex AI', 'stealth':'Stealth', sakana:'Sakana AI', kwaivgi:'Kuaishou',
};
const authorName  = a => AUTHORS[a] || (a ? a.charAt(0).toUpperCase()+a.slice(1) : '');
const authorColor = a => { let h=0; for (const c of String(a)) h=(h*31+c.charCodeAt(0))>>>0; return PAL[h%PAL.length]; };
const baseSlug = s => String(s||'').split(':')[0].replace(/-(19|20)\d{6}.*$/, '');

/* ---------------- 全局数据 ---------------- */
const D = { usage:[], bench:null, trend:[], disc:null, spend:null, perf:[], cats:{}, catalog:null };
if (typeof window !== 'undefined') window.__D = D;
const nameIdx = { base2aa:{}, base2da:{}, cost:{}, wip:{}, cat2name:{} };   // 由 bench 填充
let chartInstances = {};
let usageMetric = 'tokens';
let activeCat = 'prog';
let countdown = REFRESH_SEC;
let loading = false;

function nameOf(slug) {
  const cat = D.catalog;
  if (cat) {
    const hit = cat.bySlug[slug] || cat.byBase[baseSlug(slug)];
    if (hit) return hit;
  }
  const b = baseSlug(slug);
  if (nameIdx.base2aa[b]) {
    const e = nameIdx.base2aa[b];
    const any = e.intelligence || e.coding || e.agentic;
    if (any && any.name) return any.name;
  }
  if (nameIdx.base2da[b]) {
    const any = Object.values(nameIdx.base2da[b])[0];
    if (any && any.name) return any.name;
  }
  const [auth, ...rest] = String(slug).split('/');
  const toks = rest.join('/').split('-').filter(t => t && !/^(19|20)\d{6}/.test(t) && !/^\d{3,8}$/.test(t));
  const pretty = toks.map(t => /^\d/.test(t) || /[.\d]/.test(t) ? t.toUpperCase() : t.charAt(0).toUpperCase()+t.slice(1)).join(' ');
  return (rest.length ? authorName(auth)+' ' : '') + (pretty || slug);
}
function authorOf(slug) { return String(slug).includes('/') ? String(slug).split('/')[0] : ''; }
const shortName = nameOf;

/* ---------------- 加载 ---------------- */
function unwrap(j) { const d = j && j.data !== undefined ? j.data : j; return Array.isArray(d) ? d : (d && d.data !== undefined ? d.data : d); }
function emptyPayload(j) {
  const d = unwrap(j);
  if (d == null) return true;
  if (Array.isArray(d)) return d.length === 0;
  if (typeof d === 'object') return Object.keys(d).length === 0;
  return false;
}
async function getJSON(url, tries = 3, validate) {
  for (let a = 1; a <= tries; a++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30000);
    try {
      const r = await fetch(url, { cache:'no-cache', signal: ac.signal });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      if (validate && validate(j)) throw new Error('空数据响应');
      return j;
    } catch (e) {
      if (a === tries) throw e;
      await new Promise(res => setTimeout(res, 600*a));
    } finally { clearTimeout(timer); }
  }
}
async function pool(items, fn, limit = 3) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = { status:'fulfilled', value: await fn(items[idx]) }; }
      catch (e) { out[idx] = { status:'rejected', reason: e }; }
    }
  }));
  return out;
}
function loadbar(p) { const b = $('#loadbar'); b.style.opacity = 1; b.style.width = (p*100)+'%'; if (p >= 1) setTimeout(() => { b.style.opacity = 0; b.style.width = 0; }, 400); }

function cacheGet() {
  try {
    const c = JSON.parse(sessionStorage.getItem('llmranks') || 'null');
    if (c && Date.now()-c.t < 120000) return c.d;
  } catch (e) {}
  return null;
}
function cachePut(d) { try { sessionStorage.setItem('llmranks', JSON.stringify({ t:Date.now(), d })); } catch (e) {} }

async function fetchAll(force) {
  if (loading) return;
  loading = true; $('#btn-refresh').classList.add('spin');
  if (!force) { const c = cacheGet(); if (c) { Object.assign(D, c); afterPrimary(); loading=false; $('#btn-refresh').classList.remove('spin'); lazyCatalog(); return; } }
  try {
    loadbar(0.05);
    const keys = Object.keys(ENDPOINTS);
    const results = await pool(keys.map(k => ENDPOINTS[k]), u => getJSON(u, 3, emptyPayload));
    loadbar(0.7);
    keys.forEach((k, i) => {
      if (results[i].status === 'fulfilled') D[k] = unwrap(results[i].value);
      else window.__errs = (window.__errs || []).concat('fetch '+k+': '+results[i].reason);
    });
    D.cats = { prog:D.prog, nl:D.nl, ctx:D.ctx, images:D.images, tools:D.tools, video:D.video };
    prepareBench();
    // 缓存合并后的完整快照：部分接口失败时，缺口沿用上次的好数据
    cachePut({ usage:D.usage, bench:D.bench, trend:D.trend, disc:D.disc, spend:D.spend, perf:D.perf, cats:D.cats });
    afterPrimary();
    loadbar(1);
  } catch (e) {
    console.error(e);
  } finally {
    loading = false; $('#btn-refresh').classList.remove('spin');
  }
}

/* bench 归一化：aa 榜 / DA 榜 / 成本 全部按 baseSlug 建索引 */
function prepareBench() {
  const b = D.bench || {};
  const aa = b.aaData || {};
  nameIdx.base2aa = {};
  ['intelligence','coding','agentic'].forEach(k => {
    (aa[k] || []).forEach(m => {
      const base = baseSlug(m.permaslug || m.uid);
      const name = (m.aa_name || '').replace(/\s*\([^)]*\)\s*$/, '');
      if (!nameIdx.base2aa[base]) nameIdx.base2aa[base] = {};
      nameIdx.base2aa[base][k] = { score:m.score, name };
    });
  });
  nameIdx.percentile = aa.percentilesBySlug || {};
  nameIdx.base2da = {};
  const da = b.daData || {};
  Object.keys(da).forEach(k => {
    da[k].forEach(m => {
      const base = baseSlug(m.permaslug || m.openrouter_id);
      if (!nameIdx.base2da[base]) nameIdx.base2da[base] = {};
      nameIdx.base2da[base][k] = { score:m.score, name:m.display_name, win:m.win_rate };
    });
  });
  nameIdx.cost = b.costPerRequest || {};
  nameIdx.wip  = b.weightedInputPrices || {};
  nameIdx.base2cost = {};
  Object.entries(nameIdx.cost).forEach(([k, v]) => {
    const kb = baseSlug(k);
    if (nameIdx.base2cost[kb] == null || v < nameIdx.base2cost[kb]) nameIdx.base2cost[kb] = v;
  });
}

/* catalog 懒加载 → 名称升级后重渲染 */
async function lazyCatalog() {
  if (D.catalog) return;
  try {
    const list = await getJSON(CATALOG_URL);
    const arr = Array.isArray(list) ? list : (list.data || []);
    const bySlug = {}, byBase = {};
    arr.forEach(m => {
      if (m.hidden) return;
      const n = m.short_name || m.name || '';
      if (n) { bySlug[m.slug] = n; if (m.permaslug) bySlug[m.permaslug] = n; byBase[baseSlug(m.slug)] = n; }
    });
    D.catalog = { bySlug, byBase, raw: arr };
    renderNewModels();
    renderAll();
  } catch (e) { console.warn('catalog 加载失败', e); }
}

/* ---------------- 图表注册 ---------------- */
function chart(id) {
  if (typeof echarts === 'undefined') { $('#'+id).innerHTML = '<div class="ph">图表库加载失败，请检查网络后刷新</div>'; return null; }
  if (!chartInstances[id]) {
    const el = $('#'+id);
    el.innerHTML = '';
    chartInstances[id] = echarts.init(el, null, { renderer:'canvas' });
  }
  return chartInstances[id];
}
function safe(name, fn) { try { fn(); } catch (e) { console.error('[llmranks]', name, e); window.__errs = (window.__errs || []).concat(name+': '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }

/* ---------- KPI ---------- */
function renderKPI() {
  const rows = D.usage; if (!rows.length) return;
  const tok  = rows.reduce((s, r) => s + r.total_prompt_tokens + r.total_completion_tokens, 0);
  const req  = rows.reduce((s, r) => s + (r.count || 0), 0);
  const freeTok = rows.filter(r => r.variant === 'free').reduce((s, r) => s + r.total_prompt_tokens + r.total_completion_tokens, 0);
  const bases = new Set(rows.map(r => baseSlug(r.model_permaslug)));
  const top = [...rows].sort((a, b) => (b.total_prompt_tokens+b.total_completion_tokens)-(a.total_prompt_tokens+a.total_completion_tokens))[0];
  const cards = $('#kpis').children;
  cards[0].classList.remove('skeleton'); cards[0].querySelector('.kpi-value').textContent = fmtTok(tok);
  cards[0].querySelector('.kpi-sub').textContent = '免费变体占 '+(freeTok/tok*100).toFixed(1)+'%';
  cards[1].classList.remove('skeleton'); cards[1].querySelector('.kpi-value').textContent = fmtReq(req);
  cards[1].querySelector('.kpi-sub').textContent = '≈ '+fmtReq(req/86400)+' 次/秒';
  cards[2].classList.remove('skeleton'); cards[2].querySelector('.kpi-value').textContent = bases.size;
  cards[2].querySelector('.kpi-sub').textContent = '24h 内有调用的模型';
  cards[3].classList.remove('skeleton'); cards[3].querySelector('.kpi-value').textContent = shortName(top.model_permaslug);
  cards[3].querySelector('.kpi-sub').textContent = authorName(authorOf(top.model_permaslug))+' · '+fmtTok(top.total_prompt_tokens+top.total_completion_tokens);
}

/* ---------- 用量总榜 ---------- */
function renderUsage() {
  const c = chart('chart-usage'); if (!c || !D.usage.length) return;
  const byTok = r => r.total_prompt_tokens + r.total_completion_tokens;
  const rows = [...D.usage].sort((a, b) => (usageMetric === 'tokens' ? byTok(b)-byTok(a) : (b.count||0)-(a.count||0))).slice(0, 12);
  const total = D.usage.reduce((s, r) => s + byTok(r), 0);
  const names = rows.map(r => shortName(r.model_permaslug) + (r.variant === 'free' ? ' ·免费' : r.variant === 'batch' ? ' ·batch' : ''));
  const vals  = rows.map(r => usageMetric === 'tokens' ? byTok(r) : (r.count||0));
  const fmtr  = usageMetric === 'tokens' ? fmtTok : fmtReq;
  c.setOption({
    tooltip: Object.assign({ trigger:'axis', axisPointer:{type:'shadow'}, formatter(ps) {
      const r = rows[ps[0].dataIndex];
      return `<b>${esc(nameOf(r.model_permaslug))}</b>${r.variant !== 'standard' ? ' <span style="color:#7a9a8e">'+r.variant+'</span>' : ''}<br>` +
        `${esc(r.model_permaslug)}<br>Token：${fmtTok(byTok(r))}（占全平台 ${(byTok(r)/total*100).toFixed(1)}%）<br>请求：${fmtReq(r.count||0)} 次<br>厂商：${esc(authorName(authorOf(r.model_permaslug)))}`;
    } }, TIP),
    grid: { left:8, right:90, top:10, bottom:10, containLabel:true },
    xAxis: Object.assign(AXIS_C(true), { type:'value', axisLabel:{ color:'#a89f8a', fontSize:11, formatter:fmtr } }),
    yAxis: Object.assign(AXIS_C(false), { type:'category', inverse:true, data:names, axisLabel:{ color:'#ddd6c4', fontSize:12, formatter(v, i) { return rows[i].variant === 'free' ? '{fr|'+v+'}' : v; }, rich:{ fr:{ color:'#7a9a8e', fontWeight:600, fontSize:12, width:170, overflow:'truncate' } }, width:170, overflow:'truncate' } }),
    series: [{
      type:'bar', data:vals, barWidth:'56%',
      label: { show:true, position:'right', color:'#a89f8a', fontSize:11, formatter: p => fmtr(p.value) },
      itemStyle: { borderRadius:[0, 2, 2, 0], color: p => authorColor(authorOf(rows[p.dataIndex].model_permaslug)) },
    }],
  }, { notMerge:true });
}

/* ---------- 分项王者 ---------- */
function kingCard(cat, src, model, scoreLine, slug, opts) {
  const variant = opts && opts.variant;
  const chip = variant === 'free' ? '<span class="k-chip free">FREE</span>' : variant === 'batch' ? '<span class="k-chip batch">BATCH</span>' : '';
  return `<div class="king${opts && opts.top1 ? ' top1' : ''}">
    <div class="k-cat">${esc(cat)}<span class="k-src">${esc(src)}</span></div>
    <div class="k-model">${esc(model)}${chip}</div>
    <div class="k-score">${scoreLine}</div>
  </div>`;
}
function renderKings() {
  const b = D.bench || {}; const aa = b.aaData || {}; const da = b.daData || {};
  const el = $('#kings'); let html = '';
  const aaMeta = { intelligence:['综合智能', 'AA 智能指数'], coding:['编程', 'AA 编程分'], agentic:['智能体任务', 'AA 智能体分'] };
  ['intelligence','coding','agentic'].forEach(k => {
    const list = [...(aa[k] || [])].sort((a, b2) => b2.score-a.score);
    if (!list.length) return;
    const m = list[0];
    html += kingCard(aaMeta[k][0], aaMeta[k][1], nameOf(m.permaslug || m.uid), `分数 <b>${m.score.toFixed(1)}</b><small>/100</small>`, m.permaslug, { top1:k === 'intelligence' });
  });
  const daMeta = { 'models-website':'网页开发', 'models-uicomponent':'UI 组件', 'models-dataviz':'数据可视化', 'models-gamedev':'游戏开发', 'models-svg':'SVG 绘图', 'models-3d':'3D 建模', 'agents-agenticslides(html)':'演示幻灯片' };
  Object.keys(daMeta).forEach(k => {
    const list = [...(da[k] || [])].sort((a, b2) => b2.score-a.score);
    if (!list.length) return;
    const m = list[0];
    html += kingCard(daMeta[k], 'Design Arena', m.display_name || nameOf(m.permaslug), `ELO <b>${Math.round(m.score)}</b><small> · 胜率 ${m.win_rate != null ? m.win_rate.toFixed(1)+'%' : '--'}</small>`, m.permaslug, {});
  });
  // 性价比之王：智能指数 top30 里单请求成本最低
  const aaList = [...(aa.intelligence || [])].sort((a, b2) => b2.score-a.score).slice(0, 30)
    .map(m => ({ ...m, cost: nameIdx.cost[m.permaslug] ?? nameIdx.cost[baseSlug(m.permaslug)] }))
    .filter(m => m.cost != null).sort((a, b2) => a.cost-b2.cost);
  if (aaList.length) {
    const m = aaList[0];
    html += kingCard('性价比之王', '成本×智能', nameOf(m.permaslug), `<b>${fmtUsd(m.cost)}</b><small>/次 · 智能 ${m.score.toFixed(1)}</small>`, m.permaslug, {});
  }
  // 本周黑马
  const cl = (D.disc && D.disc.climbing || []).filter(x => x.weeklyTokens > 1e11).sort((a, b2) => b2.changePercent-a.changePercent)[0];
  if (cl) html += kingCard('本周黑马', '周用量涨幅', nameOf(cl.variantPermaslug), `周 Token <b>${fmtTok(cl.weeklyTokens)}</b><small> · +${(cl.changePercent*100).toFixed(0)}%</small>`, cl.variantPermaslug, { top1:false });
  if (html) el.innerHTML = html;
}

/* ---------- 维度之最：每个维度只列最强的那个模型 ---------- */
function renderDimTable() {
  if (!D.usage.length || !D.bench) return;
  const b = D.bench || {}; const aa = b.aaData || {}; const da = b.daData || {};
  const byTok = r => r.total_prompt_tokens + r.total_completion_tokens;
  const usageBase = {};
  D.usage.forEach(r => { const k = baseSlug(r.model_permaslug); usageBase[k] = (usageBase[k] || 0)+byTok(r); });
  const top1 = arr => [...(arr || [])].sort((a, b2) => b2.score-a.score)[0];
  const rows = [];
  const uTop = Object.keys(usageBase).sort((a, b2) => usageBase[b2]-usageBase[a])[0];
  if (uTop) rows.push(['24h 用量', uTop, fmtTok(usageBase[uTop]), '真实 Token']);
  [['intelligence','综合智能'], ['coding','编程'], ['agentic','智能体任务']].forEach(([k, label]) => {
    const m = top1(aa[k]);
    if (m) rows.push([label, m.permaslug || m.uid, m.score.toFixed(1)+' / 100', 'Artificial Analysis']);
  });
  [['models-website','网页开发'], ['models-dataviz','数据可视化'], ['models-gamedev','游戏开发'], ['models-uicomponent','UI 组件']].forEach(([k, label]) => {
    const m = top1(da[k]);
    if (m) rows.push([label, m.permaslug, 'ELO '+Math.round(m.score)+' · 胜率 '+(m.win_rate != null ? m.win_rate.toFixed(0)+'%' : '--'), 'Design Arena']);
  });
  const best = [...(aa.intelligence || [])].sort((a, b2) => b2.score-a.score).slice(0, 30)
    .map(m => ({ ...m, cost: nameIdx.cost[m.permaslug] ?? nameIdx.cost[baseSlug(m.permaslug)] }))
    .filter(m => m.cost != null).sort((a, b2) => a.cost-b2.cost)[0];
  if (best) rows.push(['性价比', best.permaslug, fmtUsd(best.cost)+' / 次 · 智能 '+best.score.toFixed(1), '成本 × 智能']);
  const cl = (D.disc && D.disc.climbing || []).filter(x => x.weeklyTokens > 1e11).sort((a, b2) => b2.changePercent-a.changePercent)[0];
  if (cl) rows.push(['周涨幅', cl.variantPermaslug, '+'+(cl.changePercent*100).toFixed(0)+'% · 周 '+fmtTok(cl.weeklyTokens), 'OpenRouter']);
  $('#dimtable').innerHTML = `<table class="dim-t"><thead><tr><th>维度</th><th>最强模型</th><th>数值</th><th class="th-src">数据源</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td class="td-cat">${esc(r[0])}</td><td class="td-model">${esc(nameOf(r[1]))}<span class="td-author">${esc(authorName(authorOf(r[1])))}</span></td><td class="td-val">${esc(r[2])}</td><td class="td-src">${esc(r[3])}</td></tr>`).join('') +
    `</tbody></table>`;
}

/* ---------- 性价比散点 ---------- */
function renderValue() {
  const c = chart('chart-value'); if (!c || !D.bench) return;
  const pts = [...((D.bench.aaData || {}).intelligence || [])]
    .map(m => {
      const base = baseSlug(m.permaslug);
      return { slug:m.permaslug, score:m.score, cost:nameIdx.cost[m.permaslug] ?? nameIdx.cost[base] };
    })
    .filter(m => m.cost != null && m.cost > 0);
  if (!pts.length) return;
  const usageBase = {};
  D.usage.forEach(r => { usageBase[baseSlug(r.model_permaslug)] = (usageBase[baseSlug(r.model_permaslug)] || 0)+r.total_prompt_tokens+r.total_completion_tokens; });
  const data = pts.map(m => ({
    name:m.slug, value:[m.cost, m.score, usageBase[baseSlug(m.slug)] || 0],
  }));
  const yMax = Math.max(...data.map(d => d.value[1]));
  const labelSet = new Set([...data].sort((a, b) => b.value[1]-a.value[1]).slice(0, 5).map(d => d.name)
    .concat([...data].sort((a, b) => a.value[0]-b.value[0]).slice(0, 3).map(d => d.name)));
  // 顶部点的标签放下方，避免被画布上缘裁剪
  data.forEach((d, i) => { if (pts[i].score >= yMax-4) d.label = { position:'bottom' }; });
  const labTxt = s => shortName(s).replace(/\s*\([^)]*\)/g, '').slice(0, 18);
  c.setOption({
    tooltip: Object.assign({ formatter(p) {
      const v = p.value;
      return `<b>${esc(nameOf(p.name))}</b><br>单请求成本：${fmtUsd(v[0])}<br>智能指数：${v[1].toFixed(1)}<br>24h Token：${fmtTok(v[2])}`;
    } }, TIP),
    grid: { left:10, right:110, top:30, bottom:10, containLabel:true },
    legend: { show:false },
    xAxis: Object.assign(AXIS_C(true), { type:'log', min:0.0005, max:100, axisLabel:{ color:'#a89f8a', fontSize:10.5, formatter:v => '$'+v } }),
    yAxis: Object.assign(AXIS_C(true), { type:'value', min:'dataMin', max:'dataMax', axisLabel:{ color:'#a89f8a', fontSize:10.5 } }),
    series: [{
      type:'scatter', data,
      symbolSize: d => Math.min(34, 6+Math.sqrt(d[2])/32000),
      itemStyle: { color: p => authorColor(authorOf(p.name)), borderColor:'rgba(221,214,196,.45)', borderWidth: p => labelSet.has(p.name) ? 2 : 1 },
      label: { show:true, fontSize:10.5, color:'#b5ad99', formatter:p => labelSet.has(p.name) ? labTxt(p.name) : '' },
      labelLayout: { hideOverlap:true, moveOverlap:'shiftY' },
      emphasis: { scale:1.15 },
    }],
  }, { notMerge:true });
}

/* ---------- 速度榜 ---------- */
function renderSpeed() {
  const c = chart('chart-speed'); if (!c || !D.perf.length) return;
  const rows = [...D.perf].filter(p => p.p50_latency && p.p50_throughput).sort((a, b) => (b.request_count||0)-(a.request_count||0)).slice(0, 24);
  if (!rows.length) return;
  const maxReq = rows[0].request_count || 1;
  const labelSet = new Set([...rows].sort((a, b) => b.p50_throughput-a.p50_throughput).slice(0, 3).map(r => r.slug)
    .concat([...rows].sort((a, b) => a.p50_latency-b.p50_latency).slice(0, 2).map(r => r.slug)));
  const tMax = Math.max(...rows.map(r => r.p50_throughput));
  c.setOption({
    tooltip: Object.assign({ formatter(p) {
      const r = rows[p.dataIndex];
      return `<b>${esc(nameOf(r.slug))}</b><br>P50 延迟：${(r.p50_latency/1000).toFixed(2)} s<br>P50 吞吐：${Math.round(r.p50_throughput)} tok/s<br>请求数：${fmtReq(r.request_count||0)}<br>最快线路：${esc(r.best_latency_provider || '--')}（${fmtUsd(r.best_latency_price||0)}/M）`;
    } }, TIP),
    grid: { left:10, right:90, top:30, bottom:10, containLabel:true },
    xAxis: Object.assign(AXIS_C(true), { type:'log', axisLabel:{ color:'#a89f8a', fontSize:10.5, formatter:v => v >= 1000 ? (v/1000)+'s' : v } }),
    yAxis: Object.assign(AXIS_C(true), { type:'value', axisLabel:{ color:'#a89f8a', fontSize:10.5 } }),
    series: [{
      type:'scatter',
      data: rows.map(r => ({ value:[r.p50_latency, r.p50_throughput, r.request_count], name:r.slug,
        label:{ position: r.p50_throughput >= tMax-8 ? 'bottom' : 'top' },
        itemStyle:{ color: authorColor(authorOf(r.slug)), borderColor: labelSet.has(r.slug) ? '#c74a3c' : 'rgba(221,214,196,.45)', borderWidth: labelSet.has(r.slug) ? 2 : 1 } })),
      symbolSize: d => 7+Math.sqrt(d[2]/maxReq)*22,
      label: { show:true, fontSize:10.5, color:'#b5ad99', formatter:p => labelSet.has(p.name) ? shortName(p.name).replace(/\s*\([^)]*\)/g, '').slice(0, 18) : '' },
      labelLayout: { hideOverlap:true, moveOverlap:'shiftY' },
    }],
  }, { notMerge:true });
}

/* ---------- 趋势 ---------- */
function renderTrend() {
  const c = chart('chart-trend'); if (!c || !Array.isArray(D.trend) || !D.trend.length) return;
  let rows = D.trend;
  // 末尾当天数据未跑完（总量 < 峰值 30%）则不画，避免全线坠零
  const dayTotals = rows.map(d => Object.values(d.ys || {}).reduce((s, v) => s+v, 0));
  const mxDay = Math.max(...dayTotals, 1);
  while (rows.length > 1 && dayTotals[rows.length-1] < mxDay*0.3) rows = rows.slice(0, -1);
  const dates = rows.map(d => d.x.slice(5));
  const sums = {};
  rows.forEach(d => Object.entries(d.ys || {}).forEach(([s, v]) => { if (s !== 'Others') sums[s] = (sums[s] || 0)+v; }));
  const top = Object.keys(sums).sort((a, b) => sums[b]-sums[a]).slice(0, 6);
  c.setOption({
    tooltip: Object.assign({ trigger:'axis' }, TIP),
    legend: { type:'scroll', top:0, textStyle:{ color:'#b5ad99', fontSize:11 }, pageIconColor:'#c74a3c', pageTextStyle:{color:'#a89f8a'} },
    grid: { left:10, right:20, top:38, bottom:6, containLabel:true },
    xAxis: Object.assign({ type:'category', boundaryGap:false, data:dates }, AXIS_C(true)),
    yAxis: Object.assign(AXIS_C(true), { type:'value', axisLabel:{ color:'#a89f8a', fontSize:11, formatter:fmtTok } }),
    series: top.map(s => ({
      name: shortName(s), type:'line', smooth:true, showSymbol:false,
      data: rows.map(d => d.ys[s] || null),
      lineStyle:{ width:1.8, color:authorColor(authorOf(s)) }, itemStyle:{ color:authorColor(authorOf(s)) },
      emphasis:{ focus:'series' },
    })),
  }, { notMerge:true });
}

/* ---------- 厂商份额 ---------- */
function renderVendors() {
  const c = chart('chart-vendors'); if (!c || !D.disc || !Array.isArray(D.disc.authors)) return;
  const rows = [...D.disc.authors].sort((a, b) => b.weeklyTokens-a.weeklyTokens).slice(0, 10);
  c.setOption({
    tooltip: Object.assign({ trigger:'item', formatter(p) {
      const r = rows[p.dataIndex];
      const g = r.changePercent != null ? (r.changePercent >= 0 ? '<span style="color:#c74a3c">+'+(r.changePercent*100).toFixed(1)+'%</span>' : '<span style="color:#8d8677">'+(r.changePercent*100).toFixed(1)+'%</span>') : '';
      return `<b>${esc(authorName(r.author))}</b><br>周 Token：${fmtTok(r.weeklyTokens)}<br>份额：${(r.share*100).toFixed(1)}% ${g ? '· 环比 '+g : ''}`;
    } }, TIP),
    legend: { orient:'vertical', right:0, top:'middle', textStyle:{ color:'#b5ad99', fontSize:11 }, itemWidth:10, itemHeight:10 },
    series: [{
      type:'pie', center:['32%', '52%'], radius:['48%', '72%'],
      data: rows.map(r => ({ name:authorName(r.author), value:r.weeklyTokens, itemStyle:{ color:authorColor(r.author) } })),
      label: { show:true, position:'center', formatter:'厂商\n格局', fontSize:14, color:'#a89f8a', lineHeight:20 },
      itemStyle: { borderColor:'#1d1a15', borderWidth:2, borderRadius:4 },
      emphasis: { scaleSize:5 },
    }],
  }, { notMerge:true });
}

/* ---------- 任务花费 ---------- */
const TASK_CN = { code:'代码', data:'数据', agent:'智能体', general:'通用', creative:'创意', research:'研究', marketing:'营销', education:'教育' };
function renderSpendTask() {
  const c = chart('chart-spend'); if (!c || !D.spend || !D.spend.spend) return;
  const rows = D.spend.spend.macroCategories || [];
  c.setOption({
    tooltip: Object.assign({ trigger:'item', formatter:p => `<b>${esc(p.name)}</b><br>占 30 天花费 ${p.value}%` }, TIP),
    legend: { orient:'vertical', right:0, top:'middle', textStyle:{ color:'#b5ad99', fontSize:11 }, itemWidth:10, itemHeight:10 },
    series: [{
      type:'pie', center:['32%', '52%'], radius:['48%', '72%'],
      data: rows.map((r, i) => ({ name:TASK_CN[r.key] || r.label || r.key, value:+(r.spendShare*100).toFixed(1), itemStyle:{ color:PAL[(i+1)%PAL.length] } })),
      label: { show:true, position:'center', formatter:'30 天\n任务花费', fontSize:14, color:'#a89f8a', lineHeight:20 },
      itemStyle: { borderColor:'#1d1a15', borderWidth:2, borderRadius:4 },
      emphasis: { scaleSize:5 },
    }],
  }, { notMerge:true });
}

/* ---------- 分类用量榜 ---------- */
const CATS = [
  { key:'prog',   label:'编程' },
  { key:'nl',     label:'自然语言' },
  { key:'ctx',    label:'长上下文' },
  { key:'images', label:'图像' },
  { key:'tools',  label:'工具调用' },
  { key:'video',  label:'视频生成', unit:'小时' },
];
function renderCatTabs() {
  $('#cat-tabs').innerHTML = CATS.map(c2 => `<button class="tab${c2.key === activeCat ? ' on' : ''}" data-cat="${c2.key}">${c2.label}</button>`).join('');
  $('#cat-tabs').querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    activeCat = btn.dataset.cat;
    $('#cat-tabs').querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b === btn));
    renderCat();
  }));
}
function renderCat() {
  const def = CATS.find(c2 => c2.key === activeCat);
  const arr = D.cats[activeCat];
  const c = chart('chart-cat'); if (!c || !Array.isArray(arr) || !arr.length) return;
  const last = arr[arr.length-1];
  const total = Object.values(last.ys || {}).reduce((s, v) => s+v, 0);
  const rows = Object.entries(last.ys || {}).filter(([s]) => s !== 'Others').sort((a, b) => b[1]-a[1]).slice(0, 8);
  const fmtr = def.unit ? (v => v.toFixed(0)+' '+def.unit) : fmtTok;
  $('#cat-sub').textContent = `${def.label} · ${last.x}（北京时间）· 当日总量 ${fmtr(total)}`;
  c.setOption({
    tooltip: Object.assign({ trigger:'axis', axisPointer:{type:'shadow'}, formatter(ps) {
      const r = rows[ps[0].dataIndex];
      return `<b>${esc(nameOf(r[0]))}</b><br>${def.unit ? '时长' : 'Token'}：${fmtr(r[1])}<br>占${esc(def.label)}类：${(r[1]/total*100).toFixed(1)}%`;
    } }, TIP),
    grid: { left:8, right:90, top:10, bottom:10, containLabel:true },
    xAxis: Object.assign(AXIS_C(true), { type:'value', axisLabel:{ color:'#a89f8a', fontSize:11, formatter:fmtr } }),
    yAxis: Object.assign(AXIS_C(false), { type:'category', inverse:true, data:rows.map(r => shortName(r[0])), axisLabel:{ color:'#211d16', fontSize:12, width:170, overflow:'truncate' } }),
    series: [{
      type:'bar', data:rows.map(r => r[1]), barWidth:'56%',
      label: { show:true, position:'right', color:'#a89f8a', fontSize:11, formatter:p => fmtr(p.value) },
      itemStyle: { borderRadius:[0, 2, 2, 0], color: p => authorColor(authorOf(rows[p.dataIndex][0])) },
    }],
  }, { notMerge:true });
}

/* ---------- 本周黑马 ---------- */
function sparkline(series, color) {
  const vs = series.map(s => s.tokens || 0);
  if (vs.length < 2) return '';
  const w = 220, h = 34, mx = Math.max(...vs, 1);
  const pts = vs.map((v, i) => `${(i/(vs.length-1)*w).toFixed(1)},${(h-3-(v/mx)*(h-8)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}
function renderRisers() {
  const d = D.disc;
  const el = $('#risers');
  if (!d) { el.innerHTML = '<div class="ph">暂无数据</div>'; return; }
  const items = [];
  (d.climbing || []).filter(x => x.weeklyTokens > 1e11).sort((a, b) => b.changePercent-a.changePercent).slice(0, 4)
    .forEach(x => items.push({ ...x, tag:'黑马', tagCls:'r-tag' }));
  (d.breakouts || []).slice(0, 2).forEach(x => items.push({ ...x, tag:'爆发', tagCls:'r-tag' }));
  if (!items.length) { el.innerHTML = '<div class="ph">暂无数据</div>'; return; }
  el.innerHTML = items.map(x => {
    const g = x.changePercent >= 0 ? '+'+(x.changePercent*100).toFixed(0)+'%' : (x.changePercent*100).toFixed(0)+'%';
    return `<div class="riser">
      <div class="r-head"><span class="r-name">${esc(shortName(x.variantPermaslug))}<span class="r-tag">${x.tag}</span></span>
      <span class="r-grow">${g}</span></div>
      <div class="r-tok">周 Token ${fmtTok(x.weeklyTokens)} · 上周 ${fmtTok(x.prevWeeklyTokens || 0)}</div>
      ${sparkline(x.series || x.dailySeries || [], '#c74a3c')}
    </div>`;
  }).join('');
}

/* ---------- 新模型（懒加载 catalog 后） ---------- */
function renderNewModels() {
  if (!D.catalog) return;
  const cut = Date.now()-14*86400000;
  const rows = D.catalog.raw
    .filter(m => !m.hidden && new Date(m.created_at).getTime() > cut && m.name && !/batch|free/i.test(m.name))
    .sort((a, b) => new Date(b.created_at)-new Date(a.created_at)).slice(0, 12);
  if (!rows.length) return;
  $('#sec-new').hidden = false;
  $('#newmodels').innerHTML = rows.map(m => {
    const ctx = m.context_length ? (m.context_length >= 1e6 ? (m.context_length/1e6).toFixed(1).replace(/\.0$/, '')+'M' : Math.round(m.context_length/1000)+'K') : '--';
    const mod = (m.output_modalities || []).filter(x => x !== 'text').join('/');
    return `<div class="nm">
      <div class="n-name">${esc(m.short_name || m.name)}</div>
      <div class="n-meta"><span>${esc(m.author_display_name || authorName(m.author))}</span><span>${m.created_at.slice(5, 10)} 上架</span><span>上下文 ${ctx}</span>${mod ? `<span class="n-mod">${esc(mod)}</span>` : ''}</div>
    </div>`;
  }).join('');
}

/* ---------- 汇总渲染 ---------- */
function afterPrimary() {
  prepareBench();
  renderAll();
  $('#updated-time').textContent = bjTime();
  countdown = REFRESH_SEC;
}
function renderAll() {
  safe('kpi', renderKPI); safe('usage', renderUsage); safe('kings', renderKings); safe('dimtable', renderDimTable);
  safe('value', renderValue); safe('speed', renderSpeed); safe('trend', renderTrend);
  safe('vendors', renderVendors); safe('spend', renderSpendTask); safe('cat', renderCat); safe('risers', renderRisers);
}

/* ---------- 事件 & 启动 ---------- */
$('#usage-tabs').querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  usageMetric = btn.dataset.metric;
  $('#usage-tabs').querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b === btn));
  renderUsage();
}));
$('#btn-refresh').addEventListener('click', () => { countdown = REFRESH_SEC; fetchAll(true); });

let rsz;
window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => Object.values(chartInstances).forEach(c => c.resize()), 200); });

setInterval(() => {
  countdown--;
  $('#countdown').textContent = countdown > 0 ? Math.floor(countdown/60)+':'+String(countdown%60).padStart(2, '0') : '刷新中…';
  if (countdown <= 0) { countdown = REFRESH_SEC; fetchAll(true); }
}, 1000);
$('#foot-time').textContent = bjTime();

fetchAll(false).then(() => lazyCatalog());
if (typeof window !== 'undefined') window.__render = () => { prepareBench(); renderAll(); };
})();
