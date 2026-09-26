/* 墨榜模型详情弹层 + 水墨拓印卡
 * 弹层：点击任意 [data-slug] / 图形元素弹出单模型全维度数据卡；
 * 拓印：canvas 把「今日 Top 5」或单个模型画成水墨卡片直接下载。
 * 消费 js/app.js 的 window.MB；卡片风格与站点绢本夜山水墨一致。 */
(() => {
'use strict';
const { esc, fmtTok, fmtReq, fmtUsd, nameOf, authorName, authorOf, authorColor, bjTime, modelFacts } = window.MB;
const $ = s => document.querySelector(s);
const CN_NUM = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'];
const DA_LABEL = { 'models-website': '网页开发', 'models-uicomponent': 'UI 组件', 'models-dataviz': '数据可视化',
  'models-gamedev': '游戏开发', 'models-svg': 'SVG', 'models-3d': '3D', 'agents-agenticslides(html)': '幻灯片' };
let lastFacts = null;
let lastFocus = null;   // 打开弹层前的焦点元素：关闭时还原，避免 focus 把页面滚回顶部
let lastScroll = 0;     // 打开前的滚动位置，开启期间每帧钉住（focus 的 scroll-into-view 动画在部分环境绕不过 preventScroll）
let pinRaf = 0;
let anchored = false;   // Streamlit 撑高 iframe 模式：fixed 相对整个文档顶，需锚定到触发元素附近
function pinScroll() {
  if ($('#modal').hidden) return;
  if (anchored) return;   // 锚定模式下父页滚动已锁，无需钉
  if (Math.abs(window.scrollY - lastScroll) > 2) window.scrollTo({ top: lastScroll, behavior: 'instant' });
  pinRaf = requestAnimationFrame(pinScroll);
}
function parentViewportH() {
  try { return window.parent !== window ? window.parent.innerHeight : window.innerHeight; } catch { return 700; }
}
function lockParentScroll(on) {
  try {
    if (window.parent === window) return;
    window.parent.document.documentElement.style.overflow = on ? 'hidden' : '';
  } catch {}   // 跨源兜底：拿不到父页就放弃锁定
}

/* ---------------- 详情弹层 ---------------- */
function stat(label, val, cls) {
  return `<div class="m-stat${cls ? ' ' + cls : ''}"><small>${label}</small><b>${val}</b></div>`;
}
function openCard(slug, anchorEl) {
  const f = modelFacts(slug);
  lastFacts = f;
  const ctx = f.ctx ? (f.ctx >= 1e6 ? (f.ctx/1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.round(f.ctx/1000) + 'K') : '--';
  const chips = (f.hasFree ? '<sup class="m-chip free">FREE</sup>' : '') + (f.hasBatch ? '<sup class="m-chip batch">BATCH</sup>' : '');
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
  const modal = $('#modal');
  modal.hidden = false;
  lastFocus = document.activeElement;
  lastScroll = window.scrollY;
  /* Streamlit 撑高 iframe：fixed 钉在整个文档顶（用户视口之外）。改为 absolute，
   * top 锚到触发元素的文档位置、高度=父页真实视口，弹层出现在用户眼前。 */
  anchored = window.parent !== window;
  if (anchored) {
    const vh = parentViewportH();
    const rect = anchorEl && anchorEl.getBoundingClientRect();
    let top = rect ? rect.top + window.scrollY : lastScroll;
    top = Math.max(0, top - 60);
    const docH = document.documentElement.scrollHeight;
    modal.classList.add('modal-anchored');
    modal.style.top = Math.min(top, Math.max(0, docH - vh)) + 'px';
    modal.style.height = vh + 'px';
    lockParentScroll(true);
  } else {
    modal.classList.remove('modal-anchored');
    modal.style.top = modal.style.height = '';
    document.documentElement.style.overflow = 'hidden';
  }
  try { $('#modal-close').focus({ preventScroll: true }); } catch { $('#modal-close').focus(); }
  cancelAnimationFrame(pinRaf); pinRaf = requestAnimationFrame(pinScroll);
}
function closeCard() {
  $('#modal').hidden = true;
  $('#modal').classList.remove('modal-anchored');
  $('#modal').style.top = $('#modal').style.height = '';
  document.documentElement.style.overflow = '';
  if (anchored) lockParentScroll(false);
  anchored = false;
  cancelAnimationFrame(pinRaf);
  if (lastFocus && lastFocus.focus) {
    try { lastFocus.focus({ preventScroll: true }); } catch { lastFocus.focus(); }
  }
  requestAnimationFrame(() => {
    if (!anchored && Math.abs(window.scrollY - lastScroll) > 5) window.scrollTo({ top: lastScroll, behavior: 'instant' });
  });
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
  const chars = [...String(text)];
  const vertical = chars.length > 1;   // 多字印章竖排（战力），单字方印（榜）
  const w = vertical ? size * 0.66 : size;
  const h = vertical ? (size * 0.66 + 8) * chars.length : size;
  c.fillStyle = '#b03a2e'; c.fillRect(x, y, w, h);
  c.fillStyle = '#f7f3ea';
  c.font = `bold ${Math.round(size * 0.4)}px KaiTi, serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  chars.forEach((ch, i) => c.fillText(ch, x + w / 2, y + (i + 0.5) * (h / chars.length)));
}
function fitText(c, text, maxW) {   // 按像素截断，避免 slice 出残词
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
const bjDate = () => {
  const m = bjTime().match(/(\d+)\/(\d+)\/(\d+)\s*(\d+):(\d+)/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')} ${m[4].padStart(2, '0')}:${m[5]}` : bjTime();
};
async function stamp(mode, f) {
  await document.fonts.load('100px "Ma Shan Zheng"').catch(() => {});
  const cv = $('#stamp-canvas'), W = 1000, H = 1250;
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  inkBase(c, W, H);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#e8e2d2'; c.font = '100px "Ma Shan Zheng", KaiTi, serif';
  c.fillText('墨榜', W/2, 190);
  inkSeal(c, W - 118, 90, 62, '战力');
  c.fillStyle = '#a89f8a'; c.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  c.fillText('AI 大模型实时战力谱 · 北京时间 ' + bjDate(), W/2, 240);

  if (mode === 'single' && f) {
    c.fillStyle = authorColor(f.author); c.font = 'bold 52px "PingFang SC", "Microsoft YaHei", sans-serif';
    c.fillText(fitText(c, nameOf(f.slug).replace(/\s*\([^)]*\)/g, ''), 760), W/2, 380);
    c.fillStyle = '#a89f8a'; c.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
    c.fillText(esc(authorName(f.author)) + (f.hasFree ? ' · 有免费变体' : '') + (f.hasBatch ? ' · 支持 batch' : ''), W/2, 430);
    c.strokeStyle = 'rgba(221,214,196,.25)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(120, 486);
    c.bezierCurveTo(360, 478, 640, 494, 880, 484); c.stroke();
    const items = [
      ['综合智能', f.aa.intelligence != null ? f.aa.intelligence.toFixed(1) : '--'],
      ['单请求成本', f.cost != null ? fmtUsd(f.cost) : '--'],
      ['24h Token', f.tok24h ? fmtTok(f.tok24h) : '--'],
      ['P50 延迟', f.p50 ? (f.p50/1000).toFixed(2) + ' s' : '--'],
    ];
    items.forEach(([label, val], i) => {
      const x = W/2 + (i % 2 - 0.5) * 420, y = 586 + ((i / 2) | 0) * 140;
      c.fillStyle = '#a89f8a'; c.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif'; c.fillText(label, x, y);
      c.fillStyle = '#ddd6c4'; c.font = 'bold 42px Georgia, serif'; c.fillText(String(val), x, y + 52);
    });
    const meta = [f.req24h ? '24h 请求 ' + fmtReq(f.req24h) : '', f.ctx ? '上下文 ' + (f.ctx >= 1e6 ? (f.ctx/1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.round(f.ctx/1000) + 'K') : '', f.tps ? Math.round(f.tps) + ' tok/s' : ''].filter(Boolean).join(' · ');
    if (meta) { c.fillStyle = '#a89f8a'; c.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif'; c.fillText(meta, W/2, 900); }
  } else {
    const { aggregateUsage } = window.MB;
    const rows = aggregateUsage().sort((a, b) => b.tok-a.tok).slice(0, 5);
    const mx = Math.max(...rows.map(r => r.tok), 1);
    c.fillStyle = '#ddd6c4'; c.font = '34px KaiTi, serif'; c.textAlign = 'left';
    c.fillText('今日 Token 五强', 100, 340);
    rows.forEach((r, i) => {
      const y = 430 + i * 130;
      c.fillStyle = '#e0654f'; c.font = '30px KaiTi, serif'; c.textAlign = 'left';
      c.fillText(CN_NUM[i], 100, y);
      c.fillStyle = '#ddd6c4'; c.font = '28px "PingFang SC", "Microsoft YaHei", sans-serif';
      c.fillText(fitText(c, nameOf(r.slug), 480), 155, y);
      c.fillStyle = authorColor(authorOf(r.slug));
      c.fillRect(155, y + 22, Math.max(30, (r.tok/mx) * 560), 18);
      c.fillStyle = '#a89f8a'; c.font = '22px Georgia, serif'; c.textAlign = 'right';
      c.fillText(fmtTok(r.tok), W - 100, y);
      c.textAlign = 'left';
    });
    c.fillStyle = '#7a7260'; c.font = '22px sans-serif'; c.textAlign = 'center';
  }
  /* 两类卡统一的题款与落款 */
  c.fillStyle = '#7a7260'; c.font = '26px KaiTi, serif'; c.textAlign = 'center';
  c.fillText('榜如水墨，浓淡随时', W/2, H - 210);
  c.fillStyle = '#7a7260'; c.font = '20px sans-serif';
  c.fillText('数据 · openrouter.ai 24h 真实用量' + (mode === 'single' ? ' · AA 评分' : '') + ' · 墨榜出品', W/2, H - 120);
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
