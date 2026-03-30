const CACHE = 'mi-agenda-v1';
const ASSETS = [
'./',
'./index.html',
'./style.css',
'./app.js',
'./manifest.json',
'./icons/icon-192.png',
'./icons/icon-512.png',
'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', e => {
e.waitUntil(
caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(() => {})
);
self.skipWaiting();
});

self.addEventListener('activate', e => {
e.waitUntil(
caches.keys().then(keys =>
Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
)
);
self.clients.claim();
});

self.addEventListener('fetch', e => {
e.respondWith(
caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
);
});

// Push notification click
self.addEventListener('notificationclick', e => {
e.notification.close();
if (e.action === 'snooze') {
// Snooze: re-show after 10 min
setTimeout(() => {
self.registration.showNotification(e.notification.title, e.notification.options);
}, 10 * 60 * 1000);
}
e.waitUntil(
clients.matchAll({ type: 'window' }).then(list => {
if (list.length) return list[0].focus();
return clients.openWindow('./');
})
);
});
