/* 墨榜工具箱：模型对比 / 白嫖榜 / 国产对决 / 降价榜 / 算笔账
 * 消费 js/app.js 暴露的 window.MB（零构建按序加载），数据仍全在浏览器端。
 * 工具箱默认折叠，点开 tab 才渲染；MB.subscribers 在每次 renderAll 后触发刷新。 */
(() => {
'use strict';
const { D, esc, fmtTok, fmtReq, fmtUsd, nameOf, authorName, authorOf, authorColor, baseSlug, chart, modelFacts, isNarrow } = window.MB;
const $ = s => document.querySelector(s);
const CN_AUTHORS = new Set(['deepseek', 'z-ai', 'moonshotai', 'qwen', 'minimax', 'bytedance', 'tencent',
  'baidu', 'xiaomi', 'alibaba', 'inclusionai', 'stepfun', 'thudm', 'kwaivgi', 'nexai']);
let activeTool = 'vs';
let priceCache = { t: 0 };   // 降价榜 10 分钟内存缓存，避免自动刷新重复拉快照

/* ---------------- 折叠 & tab ---------------- */
function openTools() {
  const body = $('#tools-body');
  if (!body.hidden) return;
  body.hidden = false;
  $('#tools-toggle').textContent = '收起 ▴';
  $('#tools-toggle').setAttribute('aria-expanded', 'true');
}
function showTool(key) {
  activeTool = key;
  document.querySelectorAll('#tool-tabs .tab').forEach(b => {
    const on = b.dataset.tool === key;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  });
  document.querySelectorAll('.tool-pane').forEach(p => { p.hidden = p.id !== 'tool-' + key; });
  renderTool(key);
}
function renderTool(key) {
  if (!D.usage.length && key !== 'price') return;   // 数据未就绪时等 subscribers 再渲染
  ({ free: renderFree, cn: renderCn, price: renderPrice, calc: renderCalc, vs: renderVs })[key]();
}

/* ---------------- usage 按 base 聚合 ---------------- */
function usageByBase() {
  const m = {};
  D.usage.forEach(r => {
    const b = baseSlug(r.model_permaslug);
    const o = m[b] || (m[b] = { tok: 0, req: 0, free: false, slug: r.model_permaslug });
    o.tok += r.total_prompt_tokens + r.total_completion_tokens;
    o.req += r.count || 0;
    if (r.variant === 'free') { o.free = true; }
  });
  return m;
}

/* ---------------- 模型对比 ---------------- */
const VS_ROWS = [
  ['厂商', f => esc(authorName(f.author))],
  ['24h Token', f => f.tok24h ? fmtTok(f.tok24h) : '--', f => f.tok24h],
  ['24h 请求', f => f.req24h ? fmtReq(f.req24h) : '--', f => f.req24h],
  ['单请求成本', f => f.cost != null ? fmtUsd(f.cost) : '--', f => f.cost == null ? null : -f.cost],
  ['综合智能 /100', f => f.aa.intelligence != null ? f.aa.intelligence.toFixed(1) : '--', f => f.aa.intelligence],
  ['编程分 /100', f => f.aa.coding != null ? f.aa.coding.toFixed(1) : '--', f => f.aa.coding],
  ['智能体分 /100', f => f.aa.agentic != null ? f.aa.agentic.toFixed(1) : '--', f => f.aa.agentic],
  ['网页开发 ELO', f => f.da['models-website'] ? String(Math.round(f.da['models-website'].elo)) : '--', f => f.da['models-website'] && f.da['models-website'].elo],
  ['数据可视化 ELO', f => f.da['models-dataviz'] ? String(Math.round(f.da['models-dataviz'].elo)) : '--', f => f.da['models-dataviz'] && f.da['models-dataviz'].elo],
  ['游戏开发 ELO', f => f.da['models-gamedev'] ? String(Math.round(f.da['models-gamedev'].elo)) : '--', f => f.da['models-gamedev'] && f.da['models-gamedev'].elo],
  ['P50 延迟', f => f.p50 ? (f.p50/1000).toFixed(2)+' s' : '--', f => f.p50 ? -f.p50 : null],
  ['P50 吞吐', f => f.tps ? Math.round(f.tps)+' tok/s' : '--', f => f.tps],
  ['上下文', f => f.ctx ? (f.ctx >= 1e6 ? (f.ctx/1e6).toFixed(1).replace(/\.0$/, '')+'M' : Math.round(f.ctx/1000)+'K') : '--', f => f.ctx],
  ['免费变体', f => f.hasFree ? '有' : '--', f => f.hasFree ? 1 : 0],
];
function slugFromInput(s) {
  s = (s || '').trim();
  if (!s) return null;
  const b = baseSlug(s);
  if (D.catalog) {
    if (D.catalog.bySlug[s]) return s;
    if (D.catalog.byBase[b]) return b;
    const low = s.toLowerCase();
    const hit = D.catalog.raw.find(m => !m.hidden &&
      ((m.short_name || '').toLowerCase() === low || (m.name || '').toLowerCase() === low));
    if (hit) return baseSlug(hit.slug);
  }
  return b;
}
function syncVsUrl() {
  const a = $('#vs-a').value.trim(), b = $('#vs-b').value.trim();
  try {
    const p = new URLSearchParams(location.search);
    if (a || b) p.set('vs', [a, b].filter(Boolean).join(','));
    else p.delete('vs');
    const q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
  } catch {}   // Streamlit srcdoc iframe 里 replaceState 抛 SecurityError；URL 同步仅静态版可用
}
function renderVs() {
  syncVsUrl();
  const out = $('#vs-out');
  const sa = slugFromInput($('#vs-a').value), sb = slugFromInput($('#vs-b').value);
  if (!sa && !sb) { out.innerHTML = '<div class="ph">选两个模型开始对比，或点击任意榜单里的模型 → 详情 → 加入对比</div>'; return; }
  const fa = sa ? modelFacts(sa) : null, fb = sb ? modelFacts(sb) : null;
  out.innerHTML = `<table class="t-table"><thead><tr><th></th>
      <th>${fa ? esc(fa.name) : '模型 A'}</th><th>${fb ? esc(fb.name) : '模型 B'}</th></tr></thead><tbody>` +
    VS_ROWS.map(([label, show, get]) => {
      const va = fa ? show(fa) : '--', vb = fb ? show(fb) : '--';
      const winA = fa && fb && get && (() => { const x = get(fa), y = get(fb); return x != null && y != null && x > y; })();
      const winB = fa && fb && get && (() => { const x = get(fa), y = get(fb); return x != null && y != null && y > x; })();
      return `<tr><td class="td-cat">${label}</td><td${winA ? ' class="win"' : ''}>${va}</td><td${winB ? ' class="win"' : ''}>${vb}</td></tr>`;
    }).join('') + '</tbody></table>' +
    (fa || fb ? '<p class="tool-note">点开折叠面板输入 slug/名称即可对比；橙红 = 该行占优。</p>' : '');
}

/* ---------------- 白嫖榜 ---------------- */
function renderFree() {
  const m = usageByBase();
  const rows = Object.entries(m).filter(([, o]) => o.free).sort((a, b) => b[1].tok - a[1].tok).slice(0, 12);
  if (!rows.length) { $('#chart-free').innerHTML = '<div class="ph">当前 24h 无 free 变体调用</div>'; return; }
  const c = chart('chart-free');
  if (!c) return;
  c.setOption({
    tooltip: { trigger:'axis', axisPointer:{type:'shadow'}, confine:true,
      formatter(ps) {
        const f = modelFacts(rows[ps[0].dataIndex][0]);
        return `<b>${esc(f.name)}</b><br>free Token：${fmtTok(rows[ps[0].dataIndex][1].tok)}<br>综合智能：${f.aa.intelligence != null ? f.aa.intelligence.toFixed(1) : '--'}`;
      } },
    grid: { left:8, right: isNarrow()?54:90, top:10, bottom:10, containLabel:true },
    xAxis: { type:'value', axisLine:{lineStyle:{color:'#454036'}}, axisTick:{show:false}, axisLabel:{ color:'#a89f8a', fontSize:11, formatter:fmtTok }, splitLine:{lineStyle:{color:'#322d25'}} },
    yAxis: { type:'category', inverse:true, data:rows.map(r => nameOf(r[0])), axisLine:{lineStyle:{color:'#454036'}}, axisTick:{show:false}, axisLabel:{ color:'#ddd6c4', fontSize:12, width: isNarrow()?104:170, overflow:'truncate' } },
    series: [{ type:'bar', data:rows.map(r => r[1].tok), barWidth:'56%',
      label: { show:true, position:'right', color:'#a89f8a', fontSize:11, formatter:p => fmtTok(p.value) },
      itemStyle: { borderRadius:[0, 2, 2, 0], color:'#7a9a8e' } }],
  }, { notMerge: true });
  c.off('click'); c.on('click', p => { if (p.componentType === 'series') window.MB.openCardSlug(rows[p.dataIndex][0], c.getDom()); });
}

/* ---------------- 国产对决 ---------------- */
function renderCn() {
  const m = usageByBase();
  const g = { cn: { tok: 0, rows: [] }, intl: { tok: 0, rows: [] } };
  Object.entries(m).forEach(([b, o]) => {
    const side = CN_AUTHORS.has(authorOf(o.slug)) ? g.cn : g.intl;
    side.tok += o.tok; side.rows.push([b, o]);
  });
  const total = g.cn.tok + g.intl.tok;
  if (!total) { $('#tool-cn').innerHTML = '<div class="ph">暂无数据</div>'; return; }
  const max = Math.max(...g.cn.rows.map(r => r[1].tok), ...g.intl.rows.map(r => r[1].tok), 1);
  const side = (title, s) => `<div class="duel-side"><h3>${title}</h3>` +
    s.rows.sort((a, b) => b[1].tok - a[1].tok).slice(0, 5).map(([b, o], i) =>
      `<div class="duel-row" data-slug="${esc(o.slug)}"><span class="duel-rank">${['壹','贰','叁','肆','伍'][i]}</span>` +
      `<span class="duel-name">${esc(nameOf(b))}</span>` +
      `<span class="duel-bar"><i style="width:${(o.tok/max*100).toFixed(1)}%;background:${authorColor(authorOf(o.slug))}"></i></span>` +
      `<span class="duel-tok">${fmtTok(o.tok)}</span></div>`).join('') + '</div>';
  $('#tool-cn').innerHTML =
    `<div class="duel-share">中国模型 24h Token 份额 <b>${(g.cn.tok/total*100).toFixed(1)}%</b><small>（海外 ${(g.intl.tok/total*100).toFixed(1)}%）</small></div>` +
    `<div class="duel-grid">${side('🇨🇳 国产 Top 5', g.cn)}${side('🌍 海外 Top 5', g.intl)}</div>` +
    '<p class="tool-note">口径：厂商 slug 属于国产集合（deepseek/z-ai/moonshotai/qwen/minimax/bytedance/tencent/baidu/xiaomi/alibaba 等）即计入国产。</p>';
}

/* ---------------- 降价榜（每日 CI 快照 diff） ---------------- */
async function loadSnapshots() {
  if (priceCache.data && Date.now() - priceCache.t < 600000) return priceCache.data;
  const idx = await (await fetch('data/snapshots/index.json', { cache: 'no-cache' })).json();
  const files = idx.files.sort().slice(-8);
  if (files.length < 2) throw new Error('快照不足两份');
  const prev = await (await fetch('data/snapshots/' + files[files.length - 2], { cache: 'no-cache' })).json();
  const cur = await (await fetch('data/snapshots/' + files[files.length - 1], { cache: 'no-cache' })).json();
  priceCache = { t: Date.now(), data: { prev, cur } };
  return priceCache.data;
}
async function renderPrice() {
  const el = $('#tool-price');
  let d;
  try { d = await loadSnapshots(); }
  catch {
    el.innerHTML = '<div class="ph">快照积累中：每日 CI 自动存一份成本快照，攒够两份后这里会出现降价榜。<br>（Streamlit 内嵌版读不到静态文件，请用静态版查看）</div>';
    return;
  }
  const rows = Object.entries(d.cur.cost)
    .filter(([k, v]) => d.prev.cost[k] != null && d.prev.cost[k] > 0 && v > 0)
    .map(([k, v]) => ({ k, v, prev: d.prev.cost[k], pct: (v - d.prev.cost[k]) / d.prev.cost[k] }));
  const falls = rows.filter(r => r.pct < -0.001).sort((a, b) => a.pct - b.pct).slice(0, 10);
  const rises = rows.filter(r => r.pct > 0.001).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const table = list => `<table class="t-table"><thead><tr><th>模型</th><th>上期</th><th>本期</th><th>变化</th></tr></thead><tbody>` +
    list.map(r => `<tr data-slug="${esc(r.k)}"><td>${esc(nameOf(r.k))}</td><td>${fmtUsd(r.prev)}</td><td>${fmtUsd(r.v)}</td>` +
      `<td class="${r.pct < 0 ? 'down' : 'up'}">${r.pct > 0 ? '+' : ''}${(r.pct*100).toFixed(1)}%</td></tr>`).join('') + '</tbody></table>';
  el.innerHTML = `<div class="duel-share">对比区间 <b>${esc(d.prev.date)}</b> → <b>${esc(d.cur.date)}</b></div>` +
    (falls.length ? `<h3 class="tool-h">降价 Top 10</h3>${table(falls)}` : '<div class="ph">区间内无降价记录</div>') +
    (rises.length ? `<h3 class="tool-h">涨价 Top 5</h3>${table(rises)}` : '');
}

/* ---------------- 算笔账 ---------------- */
function renderCalc() {
  const req = Math.max(0, +$('#calc-req').value || 0);
  const aa = ((D.bench || {}).aaData || {}).intelligence || [];
  const rows = aa.slice(0, 60)
    .map(m => modelFacts(m.permaslug))
    .filter(f => f.cost != null)
    .map(f => ({ f, month: f.cost * req * 30 }))
    .sort((a, b) => a.month - b.month).slice(0, 20);
  $('#calc-out').innerHTML = !rows.length ? '<div class="ph">暂无成本数据</div>' :
    `<table class="t-table"><thead><tr><th>模型</th><th>智能分</th><th>单次</th><th>月成本</th></tr></thead><tbody>` +
    rows.map(r => `<tr data-slug="${esc(r.f.base)}"><td>${esc(r.f.name)}</td>` +
      `<td>${r.f.aa.intelligence != null ? r.f.aa.intelligence.toFixed(1) : '--'}</td>` +
      `<td>${fmtUsd(r.f.cost)}</td><td class="${r.month === 0 ? 'down' : ''}">${r.month === 0 ? 'FREE' : '$' + (r.month < 10 ? r.month.toFixed(2) : Math.round(r.month).toLocaleString())}</td></tr>`).join('') +
    '</tbody></table><p class="tool-note">按单请求真实成本（流量加权）线性外推，未含缓存折扣；智能分取 Artificial Analysis。</p>';
}

/* ---------------- 候选列表（对比输入的 datalist） ---------------- */
function fillList() {
  const dl = $('#vs-list');
  if (dl.options.length) return;
  const m = usageByBase();
  const slugs = Object.entries(m).sort((a, b) => b[1].tok - a[1].tok).map(([, o]) => o.slug).slice(0, 200);
  dl.innerHTML = slugs.map(s => `<option value="${esc(s)}">${esc(nameOf(s))}</option>`).join('');
}

/* ---------------- 接线 ---------------- */
$('#tools-toggle').addEventListener('click', () => {
  const body = $('#tools-body');
  const open = body.hidden;
  body.hidden = !open;
  $('#tools-toggle').textContent = open ? '收起 ▴' : '展开 ▾';
  $('#tools-toggle').setAttribute('aria-expanded', String(open));
  if (open) showTool(activeTool);   // 必须走 showTool：解除当前 tab 面板的 hidden，只 renderTool 的话面板仍不可见
});
$('#tool-tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab');
  if (b) showTool(b.dataset.tool);
});
['vs-a', 'vs-b'].forEach(id => $('#' + id).addEventListener('input', () => renderVs()));
['calc-req'].forEach(id => $('#' + id).addEventListener('input', renderCalc));

/* 详情弹层「加入对比」：填到空位，两个都满则替换 B */
window.MB.toolsFillVS = base => {
  openTools(); showTool('vs');
  const a = $('#vs-a');
  if (!a.value.trim()) a.value = base;
  else $('#vs-b').value = base;
  renderVs();
};

const initVs = new URLSearchParams(location.search).get('vs');
if (initVs) {
  const [a, b] = initVs.split(',');
  $('#vs-a').value = a || '';
  $('#vs-b').value = b || '';
  openTools(); showTool('vs');
}
window.MB.subscribers.push(() => { fillList(); renderTool(activeTool); });
})();
