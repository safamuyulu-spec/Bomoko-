// Bomoko – service worker : permet d'ouvrir l'app sans internet.
// L'app est toujours chargée depuis le réseau en priorité (donc à jour) ;
// la copie gardée sur le téléphone ne sert que lorsque le réseau manque ou est trop lent.
const CACHE = "bomoko-v2";
const SHELL = ["index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const CDN = ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await Promise.all(CDN.map(async u => {
      try { const r = await fetch(u, { mode: "cors" }); if (r.ok) await c.put(u, r); } catch (err) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.searchParams.has("_")) return; // vérification de version : toujours le réseau

    // Page de l'app : réseau d'abord (4 s maximum), sinon la copie du téléphone
    if (req.mode === "navigate") {
      e.respondWith((async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await Promise.race([fetch(req), timeout(4000)]);
          if (res.ok) cache.put("index.html", res.clone());
          return res;
        } catch (err) {
          return (await cache.match("index.html")) || Response.error();
        }
      })());
      return;
    }

    // Icônes et fichiers de l'app : copie du téléphone, mise à jour en arrière-plan
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
    return;
  }

  // Bibliothèque Supabase : copie du téléphone en priorité (version figée)
  if (CDN.includes(req.url)) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      const cp = res.clone();
      caches.open(CACHE).then(c => c.put(req, cp));
      return res;
    })());
  }
});
