/* Tabela oficial "MK300 MIDI Control Mapping Table" (firmware V73). Canal 1 por padrão.
   Valor ≥ 64 = liga / executa; < 64 = desliga. */
export const CC = {
  LOOPER_TOGGLE: 21,      // 127: gravar → tocar → sobrepor · 0: parar
  DRUM_PLAY: 22,          // play / stop
  DRUM_FOLLOW_BPM: 23,
  LOOPER_STOP: 32,
  LOOPER_UNDO: 33,        // desfazer / apagar
  LOOPER_AUTOREC_ONE: 34,
  LOOPER_AUTOREC_HOLD: 35,
  LOOPER_POSITION: 36,    // 127 pós-efeitos (tail) · 0 pré-efeitos (head)
  DRUM_SYNC_1: 37, DRUM_SYNC_2: 39,
  FS_SHORT: { FS1: 50, FS2: 51, CTRL_A: 52, CTRL_B: 53 },
  FS_LONG: { FS1: 54, FS2: 55, CTRL_A: 56, CTRL_B: 57 },
  OUTPUT_R: 58,           // 0 Nor · 1 Dry · 2 NoCAB
  USB_AUDIO: 59,          // 0 Nor · 1 No · 2 Resample · 3 Dry
  PLAYBACK_VOL: 60,       // volume BT e USB 0–100
  USB_RETURN_VOL: 61,     // retorno da gravação USB 0–100 (50 = 0 dB)
};
