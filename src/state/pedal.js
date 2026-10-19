/* A pedaleira única do app. */
import { Pedal } from '../device/pedal.js';
import { lsGet, KEYS } from '../lib/storage.js';
export const pedal = new Pedal({ channel: lsGet(KEYS.midiCh, 1) });
