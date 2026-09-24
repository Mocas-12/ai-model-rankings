/* 墨榜模型详情弹层 + 水墨拓印卡
 * 弹层：点击任意 [data-slug] / 图形元素弹出单模型全维度数据卡；
 * 拓印：canvas 把「今日 Top 5」或单个模型画成水墨卡片直接下载。
 * 消费 js/app.js 的 window.MB；卡片风格与站点绢本夜山水墨一致。 */
(() => {
'use strict';
const { D, esc, fmtTok, fmtReq, fmtUsd, nameOf, authorName, authorOf, authorColor, bjTime, modelFacts } = window.MB;
const $ = s => document.querySelector(s);
const CN_NUM = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'];
const DA_LABEL = { 'models-website': '网页开发', 'models-uicomponent': 'UI 组件', 'models-dataviz': '数据可视化',
  'models-gamedev': '游戏开发', 'models-svg': 'SVG', 'models-3d': '3D', 'agents-agenticslides(html)': '幻灯片' };
let lastFacts = null;

/* ---------------- 详情弹层 ---------------- */
function stat(label, val, cls) {
  return `<div class="m-stat${cls ? ' ' + cls : ''}"><small>${label}</small><b>${val}</b></div>`;
}
function openCard(slug) {
  const f = modelFacts(slug);
  lastFacts = f;
  const ctx = f.ctx ? (f.ctx >= 1e6 ? (f.ctx/1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.round(f.ctx/1000) + 'K') : '--';
  const chips = (f.hasFree ? '<span class="k-chip free">FREE</span>' : '') + (f.hasBatch ? '<span class="k-chip batch">BATCH</span>' : '');
  const daRows = Object.entries(f.da).map(([k, v]) =>
    stat(DA_LABEL[k] || k, Math.round(v.elo) + (v.win != null ? ' <small>胜' + v.win.toFixed(0) + '%</small>' : ''))).join('');
  $('#modal-body').innerHTML =
    `<h3 class="m-name" style="color:${authorColor(f.author)}">${esc(f.name)}${chips}</h3>` +
    `<p class="m-slug">${esc(f.slug)} · ${esc(authorName(f.author))}${f.created ? ' · ' + esc(f.created.slice(0, 10)) + ' 上架' : ''}</p>` +
    '<div class="m-grid">' +
    stat('综合智能', f.aa.intelligence != null ? f.aa.intelligence.toFixed(1) : '--') +
    stat('编程分', f.aa.coding != null ? f.aa.coding.toFixed(1) : '--') +
    stat('智能体', f.aa.agentic != null ? f.aa.agentic.toFixed(1) : '--') +
    stat('单请求成本', f.cost != null ? fmtUsd(f.cost) : '--') +
    stat('24h Token', f.tok24h ? fmtTok(f.tok24h) : '--') +
    stat('24h 请求', f.req24h ? fmtReq(f.req24h) : '--') +
    stat('P50 延迟', f.p50 ? (f.p50/1000).toFixed(2) + ' s' : '--') +
    stat('P50 吞吐', f.tps ? Math.round(f.tps) + ' tok/s' : '--') +
    stat('上下文', ctx) +
    (f.fastProv ? stat('最快线路', esc(f.fastProv) + ' ' + fmtUsd(f.fastPrice || 0) + '/M') : '') +
    '</div>' + (daRows ? `<div class="m-grid m-da">${daRows}</div>` : '');
  $('#modal').hidden = false;
  $('#modal-close').focus();
}
function closeCard() {
  $('#modal').hidden = true;
  $('#btn-refresh').focus();
}
$('#modal-close').addEventListener('click', closeCard);
$('#modal-mask').addEventListener('click', closeCard);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeCard(); });
$('#modal-vs').addEventListener('click', () => {
  if (!lastFacts) return;
  closeCard();
  window.MB.toolsFillVS(lastFacts.base);
});
$('#modal-stamp').addEventListener('click', () => { if (lastFacts) stamp('single', lastFacts); });

/* ---------------- 水墨拓印卡 ---------------- */
function inkBase(c, W, H) {
  c.fillStyle = '#1d1a15'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(232,226,210,.05)';
  for (let i = 0; i < 900; i++) c.fillRect(Math.random()*W, Math.random()*H, 1.2, 1.2);
  c.strokeStyle = 'rgba(199,74,60,.75)'; c.lineWidth = 3; c.strokeRect(26, 26, W-52, H-52);
  c.strokeStyle = 'rgba(221,214,196,.28)'; c.lineWidth = 1; c.strokeRect(38, 38, W-76, H-76);
}
function inkSeal(c, x, y, size, text) {
  c.fillStyle = '#b03a2e'; c.fillRect(x, y, size, size);
  c.fillStyle = '#f7f3ea'; c.font = `bold ${size*0.62}px KaiTi, serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, x + size/2, y + size/2 + 2);
}
async function stamp(mode, f) {
  await document.fonts.load('100px "Ma Shan Zheng"').catch(() => {});
  const cv = $('#stamp-canvas'), W = 1000, H = 1250;
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  inkBase(c, W, H);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#e8e2d2'; c.font = '100px "Ma Shan Zheng", KaiTi, serif';
  c.fillText('墨榜', W/2, 190);
  inkSeal(c, W - 132, 92, 64, '战力');
  c.fillStyle = '#a89f8a'; c.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  c.fillText('AI 大模型实时战力谱 · 北京时间 ' + bjTime().replace(/\//g, '-'), W/2, 240);

  if (mode === 'single' && f) {
    c.fillStyle = '#e0654f'; c.font = '54px "Ma Shan Zheng", KaiTi, serif';
    c.fillText(nameOf(f.slug).slice(0, 14), W/2, 360);
    c.fillStyle = '#a89f8a'; c.font = '26px sans-serif';
    c.fillText(authorName(f.author) + (f.hasFree ? ' · 有免费变体' : ''), W/2, 408);
    const items = [
      ['综合智能', f.aa.intelligence != null ? f.aa.intelligence.toFixed(1) : '--'],
      ['单请求', f.cost != null ? fmtUsd(f.cost) : '--'],
      ['24h Token', f.tok24h ? fmtTok(f.tok24h) : '--'],
      ['P50 延迟', f.p50 ? (f.p50/1000).toFixed(2) + 's' : '--'],
    ];
    items.forEach(([label, val], i) => {
      const x = W/2 + (i - (items.length-1)/2) * 210;
      c.fillStyle = '#a89f8a'; c.font = '22px sans-serif'; c.fillText(label, x, 520);
      c.fillStyle = '#ddd6c4'; c.font = 'bold 40px Georgia, serif'; c.fillText(String(val), x, 572);
    });
    c.fillStyle = '#7a7260'; c.font = '22px sans-serif';
    c.fillText('数据 · openrouter.ai 24h 真实用量 · AA 评分', W/2, H - 120);
  } else {
    const rows = [...D.usage].sort((a, b) =>
      (b.total_prompt_tokens+b.total_completion_tokens)-(a.total_prompt_tokens+a.total_completion_tokens)).slice(0, 5);
    const mx = Math.max(...rows.map(r => r.total_prompt_tokens+r.total_completion_tokens), 1);
    c.fillStyle = '#ddd6c4'; c.font = '34px KaiTi, serif'; c.textAlign = 'left';
    c.fillText('今日 Token 五强', 100, 340);
    rows.forEach((r, i) => {
      const y = 430 + i * 130, tok = r.total_prompt_tokens + r.total_completion_tokens;
      c.fillStyle = '#e0654f'; c.font = '30px KaiTi, serif'; c.textAlign = 'left';
      c.fillText(CN_NUM[i], 100, y);
      c.fillStyle = '#ddd6c4'; c.font = '28px "PingFang SC", "Microsoft YaHei", sans-serif';
      c.fillText(nameOf(r.model_permaslug).slice(0, 16), 155, y);
      c.fillStyle = authorColor(authorOf(r.model_permaslug));
      c.fillRect(155, y + 22, Math.max(30, (tok/mx) * 560), 18);
      c.fillStyle = '#a89f8a'; c.font = '22px Georgia, serif'; c.textAlign = 'right';
      c.fillText(fmtTok(tok), W - 100, y);
      c.textAlign = 'left';
    });
    c.fillStyle = '#7a7260'; c.font = '22px sans-serif'; c.textAlign = 'center';
    c.fillText('openrouter.ai 24h 真实用量 · 墨榜出品', W/2, H - 120);
  }
  inkSeal(c, W/2 - 34, H - 100, 68, '榜');
  cv.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'mubang-' + (mode === 'single' ? nameOf(f.slug).toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'top5') + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }, 'image/png');
}
$('#btn-stamp').addEventListener('click', () => stamp('board'));

window.MB.openCard = openCard;
window.MB.stamp = stamp;
})();
