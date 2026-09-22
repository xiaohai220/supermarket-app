/* PWA Service Worker锛氱綉椤佃蛋缃戠粶浼樺厛锛堜繚璇佹洿鏂板嵆鏃剁敓鏁堬級锛岄潤鎬佽祫婧愮紦瀛樺厹搴?*/
const CACHE = 'supermarket-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 姹囩巼鎺ュ彛濮嬬粓璧扮綉缁?  if (url.hostname.includes('er-api.com')) return;
  // 鍙鐞?GET
  if (e.request.method !== 'GET') return;
  // 鏁版嵁鎺ュ彛濮嬬粓璧扮綉缁滐紝缁濅笉缂撳瓨
  if (url.pathname.startsWith('/api/')) return;

  // 椤甸潰瀵艰埅锛圚TML锛夛細缃戠粶浼樺厛锛屽け璐ュ啀鐢ㄧ紦瀛?  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then((h) => h || caches.match('./')))
    );
    return;
  }

  // 鍏朵綑闈欐€佽祫婧愶細缂撳瓨浼樺厛锛屽悗鍙版洿鏂?  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

