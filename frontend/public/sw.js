const C='pos-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.add('/')));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api'))return;
 const k=r.mode==='navigate'?'/':r;e.respondWith(fetch(r).then(x=>{const cp=x.clone();if(x.ok)caches.open(C).then(c=>c.put(k,cp));return x}).catch(()=>caches.match(k)))});
