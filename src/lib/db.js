/* IndexedDB: músicas (com áudio), gravações e chaves internas. */
const NAME = 'tonematch-mk300';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('songs', { keyPath: 'id' });
      d.createObjectStore('recs', { keyPath: 'id' });
      d.createObjectStore('kv');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
export const DB = {
  get: (store, key) => tx(store, 'readonly', s => s.get(key)),
  put: (store, value, key) => tx(store, 'readwrite', s => (key === undefined ? s.put(value) : s.put(value, key))),
  del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
  all: store => tx(store, 'readonly', s => s.getAll()),
  wipe: () => { dbp = null; return new Promise(r => { const q = indexedDB.deleteDatabase(NAME); q.onsuccess = q.onerror = q.onblocked = () => r(); }); },
};
