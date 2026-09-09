// Service worker: network-first per i file dell'app (così gli aggiornamenti
// arrivano subito, al primo caricamento online), con fallback alla cache per
// l'uso offline. CACHE_NAME va comunque aggiornato ad ogni release.
var CACHE_NAME = "schedine-cache-v14";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./css/style.css",
  "./js/app.js",
  "./js/sync.js",
  "./js/register-sw.js"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return;

  var url = new URL(req.url);
  // risorse esterne (SDK Firebase su gstatic, ecc.): lascia gestire al browser
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function(response){
      // aggiorna la cache con la copia fresca
      if(response && response.ok){
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
      }
      return response;
    }).catch(function(){
      // offline: usa la cache, con l'index come ultima spiaggia per le navigazioni
      return caches.match(req).then(function(cached){
        return cached || caches.match("./index.html");
      });
    })
  );
});
