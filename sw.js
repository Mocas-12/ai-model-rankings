/* 墨榜 Service Worker：缓存静态外壳（echarts/css/js/图标），数据接口一律直连
 * （实时数据不缓存；断网兜底靠页面自身的 sessionStorage 快照）。
 * 版本号递增触发旧缓存清理。 */
const CACHE = 'mubang-shell-v1';
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
  // 静态外壳：缓存优先，后台更新（stale-while-revalidate）
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
});
