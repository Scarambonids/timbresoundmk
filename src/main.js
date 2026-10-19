/* Ponto de entrada: monta o catálogo, restaura a sessão, liga roteador e conexão, registra o service worker. */
import { buildCatalog } from './domain/catalog.js';
import { restoreSessionAudio, saveSession } from './state/store.js';
import { initRouter, renderAll } from './ui/router.js';
import { initConnection } from './ui/connection.js';
import { toast } from './ui/components.js';

buildCatalog();
initRouter();
initConnection();
await restoreSessionAudio();
renderAll();

window.addEventListener('beforeunload', saveSession);
document.addEventListener('visibilitychange', () => document.hidden && saveSession());

if (!window.isSecureContext) toast('Abra o app por um endereço https para conectar a pedaleira (USB e Bluetooth precisam disso).', true);
if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
