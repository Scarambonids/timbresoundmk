# Arquitetura

O app é dividido em camadas. Cada camada só usa as que estão abaixo dela, e as três de baixo (dados, domínio, dispositivo/motor) não tocam no DOM, por isso rodam nos testes do Node sem navegador.

```
 ui/            telas, componentes, roteador          (DOM)
 state/         estado da sessão e a pedaleira única
 services/      biblioteca, tocador, gravador          (APIs do navegador)
 engine/        motor de timbre, IA, análise de áudio, ficha
 device/        protocolo SysEx, transportes, Pedal
 domain/        blocos, catálogo, preset de 448 bytes, tons
 data/          catálogo da MK-300, estilos, artistas, músicas
 lib/           texto, armazenamento, IndexedDB, segredo, DOM
```

## Pastas e arquivos

**`index.html`** carrega os quatro CSS e um único módulo, `src/main.js`. **`sw.js`** guarda todos os arquivos para uso offline. **`manifest.webmanifest`** e `assets/` deixam o app instalável.

**`src/lib/`** — utilidades sem regra de negócio.
- `text.js`: normalização, semelhança de texto (tolera erro de digitação), `ascii20` para nomes de preset, `clamp`.
- `storage.js`: localStorage que nunca lança erro e a lista de chaves usadas (`KEYS`).
- `db.js`: IndexedDB com três lojas (`songs`, `recs`, `kv`).
- `secret.js`: chave da API cifrada com AES-GCM; a chave AES é do aparelho e não é exportável.
- `dom.js`: `$`, escape de HTML, debounce, baixar arquivo, escolher arquivo.

**`src/data/`** — só dados, sem lógica.
- `catalog.js`: os 11 blocos, todos os modelos (índice, nome, referência real) e os controles com faixa, escala e unidade. Vem da planilha V75.
- `styles.js`: timbres-base por estilo (blues, rock 70, metal…).
- `artists.js` e `songs.js`: timbre típico de cada artista e ajustes por música, com BPM e tom quando conhecidos.
- `cabFamily.js`: caixa padrão para cada família de amplificador.

**`src/domain/`** — o vocabulário da MK-300.
- `blocks.js`: os 11 blocos; a posição na lista é o id usado no protocolo.
- `catalog.js`: monta o catálogo em uso (padrão ou importado, com nomes corrigidos pelo usuário) e responde perguntas como "qual o modelo 42 do AMP".
- `preset.js`: a estrutura de 448 bytes. `decodePreset` lê; `encodeInto` escreve só os campos conhecidos sobre uma imagem existente, para não apagar footswitches e expressão.
- `music.js`: nomes de tons em português e tempo de delay por figura.

**`src/device/`** — conversa com a pedaleira.
- `protocol.js`: monta e lê os quadros SysEx (empacotamento de 7 bits e checksum).
- `midiMap.js`: a tabela oficial de Control Change (looper, bateria, footswitches, saída).
- `transports/usbMidi.js`, `transports/bleMidi.js`, `transports/emulator.js`: três formas de levar os bytes. Todas têm a mesma interface: `open(onMessage, onClose)`, `send(bytes)`, `close()`. O emulador responde como a pedaleira e serve aos testes e ao modo demonstração.
- `pedal.js`: a classe `Pedal`. Serializa os pedidos (um por vez), espera a confirmação ou a resposta, e oferece as operações: ler status, buffer, slot e nomes; carregar preset; mudar bloco, modelo, controle, volume, BPM; **ouvir** (manda só o que mudou) e **salvar** (lê o slot, grava, confere relendo, carrega).

**`src/engine/`** — de um pedido para um preset.
- `knowledge.js`: busca música, artista e estilo.
- `resolver.js`: acha o modelo da MK-300 cuja referência mais combina com um equipamento real ("Marshall Plexi 1959" → `43DS-Mar59`).
- `rig.js`: o "rig" é a descrição do equipamento em termos reais. Aqui ele recebe a intenção (solo, ritmo, ambient, seco) e as medidas do áudio, e vira preset com uma nota por bloco.
- `localEngine.js`: o motor do app, sem internet. Ordem: estilo → artista → música → intenção → áudio.
- `aiEngine.js`: a IA online opcional. Manda o catálogo real e valida a resposta (índice existe? controle dentro da faixa?) antes de virar preset.
- `audio/analysis.js` e `audio/fft.js`: BPM, tom, brilho, ganho aparente, ambiência e largura estéreo de um MP3/WAV, no celular.
- `ficha.js`: a ficha do timbre em texto.

**`src/services/`** — recursos do navegador com estado próprio.
- `library.js`: músicas e gravações no IndexedDB, exportar e importar.
- `player.js`: tocador com velocidade, trecho A–B e "reduzir guitarra".
- `recorder.js`: grava a entrada escolhida junto com a música, em áudio ou vídeo.

**`src/state/`**
- `store.js`: o estado `S` da sessão e o que é salvo ao fechar.
- `pedal.js`: a instância única de `Pedal`.

**`src/ui/`**
- `router.js`: escolhe a tela pelo estado (aba, passo, música aberta) e repassa a ela os eventos da área principal.
- `connection.js`: a faixa de conexão, a leitura dos 160 nomes e o acompanhamento do preset atual (a cada 2 s, pausado durante operações longas).
- `components.js`: aviso, folha inferior, confirmação e progresso.
- `screens/`: uma tela por arquivo. Cada uma exporta `{ view, mount?, click?, input?, change?, leave? }`.
  - `criar.js` (Timbre › 1 · Criar), `preset.js` (Timbre › 2 · Preset), `blockEditor.js` (folha Editar), `library.js`, `song.js` (tela da música, tocar e gravar junto), `live.js` (Ao vivo), `settings.js` (Ajustes).

## Fluxos principais

**Gerar um timbre.** `criar.js` monta o pedido → `localEngine.generateLocal` (ou `aiEngine.generateAI`, com cache e volta automática para o motor local se falhar) → `store.setTone` → tela Preset.

**Ouvir sem salvar.** `preset.js` → `Pedal.audition`: lê o buffer de edição, compara com o preset e manda só as diferenças. Depois disso a edição ao vivo fica ligada: cada mudança no editor vai na hora.

**Enviar e salvar.** `preset.js` lê o nome atual do slot e pede confirmação → `Pedal.save`: lê a imagem do slot, `encodeInto` troca só o que o app conhece, grava, faz o commit, relê até a imagem bater (até 15 s) e carrega o slot. Se não bater, não carrega e avisa.

**Ao vivo.** Troca de preset e módulos usam o protocolo SysEx; looper, bateria, footswitches e saída usam Control Change da tabela oficial.

## Como estender

- **Nova música ou artista:** acrescente em `src/data/songs.js` ou `artists.js`. Use referências de equipamento real; o resolvedor acha o modelo.
- **Novo comando da pedaleira:** construa o quadro em `protocol.js`, exponha em `Pedal` e acrescente um caso em `tests/protocol.test.js` com os bytes capturados do editor.
- **Nova tela:** crie `src/ui/screens/nome.js` com `view()` e registre em `router.js`.
- **Outro transporte:** implemente `open/send/close` e registre em `TRANSPORTS` de `pedal.js`.
- Depois de criar ou remover arquivos, acrescente-os em `ASSETS` no `sw.js`, aumente `VERSION` e rode `npm run check`.
