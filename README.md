# ToneMatch MK-300

Do nome da música ao timbre pronto na **M-VAVE MK-300**. Você escreve artista e música, o app monta a cadeia com os modelos da pedaleira, toca na hora (sem gravar) e salva no slot que você escolher. Também gera a ficha do timbre para copiar em qualquer pedaleira, guarda uma biblioteca de músicas com backing track, tem tocar junto/gravar junto e um modo Ao vivo que transforma o celular no controle da MK-300.

Versão pessoal: sem ativação, sem conta, sem pagamento. Tudo fica no celular.

## Como rodar

O app é estático (HTML, CSS e módulos JavaScript), sem etapa de build e sem dependências.

**No computador, para testar**

```bash
npm start          # http://localhost:5173
npm test           # testes do protocolo, do preset, do motor e da pedaleira simulada
npm run check      # confere imports e a lista offline do service worker
```

Precisa do Node 20 ou mais novo. No Chrome do computador o USB MIDI funciona em `localhost`.

**No celular (Android + Chrome)**

USB e Bluetooth só são liberados pelo navegador em endereço `https`. O jeito mais simples é o GitHub Pages:

1. Crie um repositório no GitHub e envie esta pasta inteira.
2. Em Settings › Pages, escolha a branch `main` e a pasta `/ (root)`.
3. Abra o endereço `https://SEU-USUARIO.github.io/NOME-DO-REPO/` no Chrome do Android.
4. Menu ⋮ › Instalar app (ou Adicionar à tela inicial). Depois de aberto uma vez, funciona sem internet.

Ligue a MK-300 com um cabo **USB OTG** e toque em **USB** na faixa de conexão. Sem a pedaleira, use Ajustes › Modo demonstração.

## O que funciona e o que ainda não foi conferido

- Conferido byte a byte contra capturas do editor M-EFCS: todos os quadros que o app envia (ver `tests/protocol.test.js`).
- Conferido contra a pedaleira simulada: ouvir sem salvar, salvar no slot com releitura, ler os 160 nomes, controle ao vivo.
- Ainda não testado numa MK-300 de verdade por este app: o primeiro uso confirma. Comece com **Ouvir sem salvar**, que não grava nada.
- Bluetooth é experimental: o protocolo foi medido pelo USB.
- Os nomes de modelos MW- do catálogo foram deduzidos da ordem da lista; corrija em Ajustes › Nomes dos modelos se o visor mostrar outro. O som não muda, porque a pedaleira usa a posição do modelo.

## Estrutura

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) para as camadas e o fluxo, e [docs/PROTOCOLO.md](docs/PROTOCOLO.md) para o protocolo da MK-300.

## Créditos

Protocolo USB da MK-300 por engenharia reversa do projeto aberto [jpfaria/mvave](https://github.com/jpfaria/mvave) (licença MIT). M-VAVE e MK-300 são marcas dos seus proprietários; este app não tem vínculo com a M-VAVE.
