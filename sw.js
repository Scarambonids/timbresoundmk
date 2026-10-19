/* Service worker: guarda o app para funcionar sem internet.
   Ao mudar arquivos, aumente VERSION; `npm run check` confere se a lista está completa. */
const VERSION = 'tonematch-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon.svg',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './css/tokens.css',
  './src/main.js',
  './src/data/artists.js',
  './src/data/cabFamily.js',
  './src/data/catalog.js',
  './src/data/songs.js',
  './src/data/styles.js',
  './src/device/midiMap.js',
  './src/device/pedal.js',
  './src/device/protocol.js',
  './src/domain/blocks.js',
  './src/domain/catalog.js',
  './src/domain/music.js',
  './src/domain/preset.js',
  './src/engine/aiEngine.js',
  './src/engine/ficha.js',
  './src/engine/knowledge.js',
  './src/engine/localEngine.js',
  './src/engine/resolver.js',
  './src/engine/rig.js',
  './src/lib/db.js',
  './src/lib/dom.js',
  './src/lib/secret.js',
  './src/lib/storage.js',
  './src/lib/text.js',
  './src/services/library.js',
  './src/services/player.js',
  './src/services/recorder.js',
  './src/state/pedal.js',
  './src/state/store.js',
  './src/ui/components.js',
  './src/ui/connection.js',
  './src/ui/router.js',
  './src/device/transports/bleMidi.js',
  './src/device/transports/emulator.js',
  './src/device/transports/usbMidi.js',
  './src/engine/audio/analysis.js',
  './src/engine/audio/fft.js',
  './src/ui/screens/blockEditor.js',
  './src/ui/screens/criar.js',
  './src/ui/screens/library.js',
  './src/ui/screens/live.js',
  './src/ui/screens/preset.js',
  './src/ui/screens/settings.js',
  './src/ui/screens/song.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* arquivos do app: cache primeiro; fontes do Google: rede e guarda; APIs de IA: sempre rede */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      const res = await fetch(e.request); if (res.ok) c.put(e.request, res.clone()); return res;
    }));
  }
});
