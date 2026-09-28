/* 墨榜 Service Worker：数据接口一律直连（实时性）；断网兜底靠页面自身的 sessionStorage 快照。
 * 缓存策略分级：html/js/css/manifest 走 network-first（部署后首访即最新代码），
 * echarts/图标等大静态走 cache-first + 后台更新。版本号递增触发旧缓存清理。 */
const CACHE = 'mubang-shell-v2';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/tools.js',
  './js/card.js',
  './vendor/echarts.min.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;   // OpenRouter 数据/字体/CDN 一律直连
  const p = url.pathname;
  const isCore = e.request.mode === 'navigate' || p.endsWith('.html') ||
                 p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.webmanifest');
  if (isCore) {
    // 核心资源：网络优先，断网才回退缓存——保证发版后第一时间是新代码
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // 大静态（echarts/图标）：缓存优先 + 后台更新
    e.respondWith(
      caches.match(e.request).then(hit => {
        const net = fetch(e.request)
          .then(res => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});
