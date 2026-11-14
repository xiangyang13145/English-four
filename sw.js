const CACHE = 'cet4-1500-v6';
const ASSETS = ['./', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 只接管本站资源。跨域请求（在线发音音频等）直接放行，绝不缓存：
  // 不同单词的音频地址只差查询参数，一旦缓存就会互相顶替，导致所有词读成同一个。
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 应用清单与 SW 自身不进缓存，保证改名 / 更新能立刻被浏览器读到
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/manifest.webmanifest')) return;

  if (req.mode === 'navigate') {
    // 页面走网络优先，保证更新能立刻看到；断网时回落缓存
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
