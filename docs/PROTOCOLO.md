# Protocolo da MK-300

Medido pelo projeto aberto [jpfaria/mvave](https://github.com/jpfaria/mvave) (MIT), observando o editor M-EFCS falar com uma MK-300 no firmware V73 pelo USB. A implementação está em `src/device/protocol.js` e os vetores de teste em `tests/protocol.test.js`.

## Quadro

```
F0 00 32 | CLS | CMD (4) | 02 | CAMPO (4) | SUB (4) | pack7(payload + ck8) | F7
```

- `00 32`: fabricante.
- `CLS`: `09` escrita, `0D` leitura (e toda resposta com dados), `01` confirmação.
- `CMD`: `41` ler, `49` escrever 1 byte, `51` escrever 2 bytes. Quatro dígitos de 7 bits, little-endian.
- `CAMPO`: deslocamento em bytes dentro do espaço de memória.
- `SUB`: `(tamanho << 4) | espaço`.
- Payload e checksum vão empacotados 7 bits por byte, bit menos significativo primeiro.
- `ck8 = 0xFB − (Σpayload + Σbytes(CAMPO) + Σbytes((tamanho << 8) | (espaço << 4))) mod 256`. A pedaleira confere: quadro com checksum errado não recebe resposta.
- Confirmação de escrita: `F0 00 32 01 08 00 00 00 00 7F 01 F7`.

## Espaços de memória

- `0` banco de presets: 160 × 448 bytes; o slot N começa em `N × 448`. A gravação do slot inteiro usa `CMD = 41` com o segundo dígito igual a 448/16 = 28, seguida de COMMIT.
- `1` buffer de edição: o preset que está tocando.
- `2` status, 86 bytes: byte 0 = preset atual.
- `E` comandos: escrever `01` no campo N carrega o preset N (0 = [001]).
- `F` commit da gravação no banco.

## Preset (448 bytes)

- `0x00` nome, 20 bytes. O visor só relê o nome ao ligar.
- `0x18` volume (u16), `0x1A` BPM (u16), `0x1C` pan (i16).
- `0x20` ordem da cadeia: 11 ids de bloco na ordem do sinal.
- `0x2B` liga/desliga, um byte por bloco.
- `0x36` modelo, um byte por bloco. Ao trocar, a pedaleira volta os controles ao padrão do modelo (DS, AMP e CAB mantêm).
- `0x42` controles: 11 blocos × 12 valores i16. Controle k do bloco b em `0x42 + 24b + 2k`.
- `0x14A` em diante: footswitches e expressão (não decodificado; o app preserva).

Ids dos blocos: 0 WAH, 1 FX, 2 GATE, 3 DS, 4 AMP, 5 CAB, 6 EQ, 7 MOD, 8 DLY, 9 REV, 10 VOL.

Valores: 0–100 na maioria; `Speed` ×10 (2,5 Hz = 25); `Time` em ms; EQ e limiar do gate em dB (negativo em complemento de dois).

## Control Change (tabela oficial, firmware V73)

Canal 1. Valor ≥ 64 liga/executa, < 64 desliga.

- 21 looper: gravar → tocar → sobrepor (127) / parar (0)
- 22 bateria play/stop · 23 bateria segue o BPM
- 32 looper parar · 33 looper desfazer/apagar · 36 posição do looper (127 pós, 0 pré)
- 50–53 FS1, FS2, CTRL A, CTRL B pisada curta · 54–57 pisada longa
- 58 saída R: 0 normal, 1 seco, 2 sem CAB
- 59 áudio USB: 0 normal, 1 desligado, 2 resample, 3 seco
- 60 volume BT/USB 0–100 · 61 retorno da gravação USB 0–100

## Bluetooth

O app manda os mesmos quadros pelo BLE MIDI (serviço `03b80e5a-…`), dividindo SysEx longo em pacotes de 20 bytes. Isso ainda não foi medido numa MK-300; o USB é o caminho garantido.
