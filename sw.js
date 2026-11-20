/* Almanaque Plus — service worker: funciona sin internet y avisa cuando hay versión nueva.
   VERSION se cambia en cada publicación; eso hace que los teléfonos detecten la actualización. */
const VERSION = "202611201611";
const CACHE = "almanaque-plus-" + VERSION;
const BASE = [
  "./", "index.html", "pwa.js", "campo.js", "almanaque.js", "siembra.js", "santoral.js", "manifest.webmanifest",
  "emblema.svg", "favicon.png", "icono-192.png", "icono-512.png", "apple-touch-icon.png",
  "lib/suncalc.js", "lib/satellite.min.js", "lib/leaflet.js", "lib/leaflet.css",
  "lib/fonts/playfair-display-latin-400-normal.woff2", "lib/fonts/playfair-display-latin-700-normal.woff2",
  "lib/fonts/playfair-display-latin-900-normal.woff2", "lib/fonts/playfair-display-latin-400-italic.woff2",
  "lib/fonts/old-standard-tt-latin-400-normal.woff2", "lib/fonts/old-standard-tt-latin-700-normal.woff2",
  "lib/fonts/old-standard-tt-latin-400-italic.woff2", "tles.txt",
  "lib/fonts/source-sans-3-latin-400-normal.woff2", "lib/fonts/source-sans-3-latin-700-normal.woff2", "lib/fonts/source-sans-3-latin-400-italic.woff2",
];
self.addEventListener("install", e => {
  // se activa sola apenas termina de bajar: la página se recarga con la edición nueva
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("almanaque-plus-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "actualizar") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // clima, mapas y buscador van siempre por internet
  const pagina = req.mode === "navigate" || url.pathname.endsWith("tles.txt") || url.pathname.endsWith("focos.json") || /\.(js|css|webmanifest)$/.test(url.pathname);
  if (pagina) {   // página y órbitas: primero internet, si no hay, lo guardado
    e.respondWith(fetch(req).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
    return;
  }
  // el resto (programas, letras, íconos): lo guardado, y si no está, internet
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return res;
  })));
});
