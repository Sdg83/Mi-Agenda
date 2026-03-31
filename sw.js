const C=‘ag-v1’;
const A=[’./’,’./index.html’];
self.addEventListener(‘install’,e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).catch(()=>{}));self.skipWaiting()});
self.addEventListener(‘activate’,e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener(‘fetch’,e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>r)))});
self.addEventListener(‘notificationclick’,e=>{e.notification.close();e.waitUntil(clients.matchAll({type:‘window’}).then(l=>{if(l.length)return l[0].focus();return clients.openWindow(’./’)}))});
