# Estudo de violão

Aplicação estática para aprender e praticar violão. O painel inicial reúne nove módulos, uma rotina sugerida de 15 minutos, meta diária e diário de prática. O projeto usa HTML, CSS e JavaScript, sem framework. Os arquivos de execução já estão incluídos no repositório.

## Executar

Clone o repositório e entre na pasta:

```sh
git clone https://github.com/pedrosatin/guitar-study.git
cd guitar-study
```

Com Python 3 instalado, execute:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Abra http://127.0.0.1:4173/. Também é possível executar `npm run dev`.
Não abra os HTML diretamente por `file://`: os módulos JavaScript e o acesso à mídia precisam de um servidor. Microfone e câmera funcionam em localhost ou HTTPS, após permissão explícita.

## Páginas

| Página | O que fazer |
| --- | --- |
| [Meu estudo](index.html) | Definir meta diária, escolher um módulo e consultar/exportar o diário |
| [Fundamentos](poc/m1-theory-foundation/index.html) | Seguir a primeira aula, tocar uma corda solta e a primeira casa, conferir a prática e responder cinco perguntas |
| [Acordes e trocas](poc/m2-chords-diagram/index.html) | Montar Em e Am, conferir cordas, trocar sem relógio e depois experimentar um minuto de treino |
| [Cifras e metrônomo](poc/m3-chordpro-player/index.html) | Contar cliques, tocar Em e trocar Em/Am com preparação, pausa e autoavaliação |
| [Afinador](poc/m4-pitch-detect/index.html) | Identificar cordas e tarraxas, ajustar uma corda por vez e acompanhar as seis conferências |
| [Espelho de prática](poc/m5-mediapipe-mirror/index.html) | Observar cinco trocas Em/Am, conferir as cordas e revisar a prática com câmera opcional |
| [Mapa do braço](poc/m6-fretdetection-marks/index.html) | Contar casas no desenho, conferir cinco posições e marcar referências com câmera opcional |
| [Treino de ritmo](poc/m7-onset-rhythm/index.html) | Praticar por 30 segundos com preparação e conferir velocidade e regularidade por toques ou microfone |
| [Plano de estudo](poc/m8-lesson-curator/index.html) | Organizar sessões de 5, 10 ou 20 minutos, retomar aulas e anotar o que repetir |
| [Áudio para tablatura](poc/m9-audio-tabs/index.html) | Abrir ou gravar áudio, transcrever até 30 segundos, revisar posições e exportar TXT/MIDI |

Comece por Fundamentos e Plano de estudo. Use o afinador antes de tocar e pratique trocas em um andamento em que consiga manter o som limpo.

## Progresso e privacidade

O diário registra minutos informados por você e anotações. O treino completo de 60 segundos em Acordes adiciona um minuto automaticamente quando você salva o resultado. Evite registrar esse mesmo minuto novamente no formulário do fim da página.

Dados ficam no armazenamento local deste navegador e desta origem. Limpar os dados do site apaga o progresso. O painel exporta meta e diário em JSON; resultados de quiz, autoavaliação de Fundamentos, recordes de trocas e conclusão das aulas têm armazenamento próprio e não entram nessa exportação. Não há sincronização entre dispositivos nem importação do arquivo.

Áudio e vídeo são processados no dispositivo. A câmera abre apenas por ação do estudante. Os pontos da mão usam MediaPipe, baixado de jsDelivr e Google quando solicitado. Falha no download permite continuar com o espelho e a marcação manual.

## Limites atuais

- Os sons de referência são sintetizados.
- O afinador analisa uma nota isolada. Acordes, ruído e harmônicos podem produzir leituras erradas.
- Ritmo estima andamento e regularidade por aumentos de volume. Não mede a sincronização exata com uma gravação.
- Cifras usam duração fixa por acorde para exercícios, sem inferir o ritmo de uma música.
- Câmera e marcações são referências visuais experimentais. Não avaliam postura, pressão dos dedos, corda tocada ou correção de acordes.
- Som limpo e conclusão dos exercícios dependem de autoavaliação.
- Testes com mídia simulada não comprovam precisão com um instrumento real.

## Testes

Use Node.js 20 ou superior e npm para as ferramentas de teste. A aplicação funciona com os recursos já incluídos. O reconhecedor tem um bundle JavaScript gerado e um modelo local.

```sh
npm ci
npm test
# Com o servidor ligado em outro terminal e Chromium instalado:
npm run test:browser
npm run test:a11y
npm run test:transcriber
# Opcional, sessão gráfica Linux/X11 com xdotool:
npm run test:zoom
```

Os testes de navegador usam `/usr/bin/chromium`. Para outro caminho, defina `CHROMIUM_PATH`. Para outro servidor, defina `TEST_BASE_URL`. Capturas ficam em `test-results/`.

## Estrutura e desenvolvimento

- `index.html`: painel, meta e histórico de prática.
- `poc/`: nove módulos independentes, com HTML, estilos, scripts e recursos próprios.
- `shared/`: catálogo de módulos, navegação, diário, armazenamento, câmera e estilos comuns.
- `tests/`: testes de lógica, áudio e integração no navegador.

O arquivo `shared/study.css` reúne os estilos compartilhados. Cores, tipografia e espaçamentos ficam em `shared/tokens.css`. Os estilos específicos de cada exercício permanecem no diretório do módulo.

A navegação é montada por `shared/shell.js` a partir de `shared/catalog.js`. O diário usa `shared/progress.js`; os módulos podem manter estados próprios de exercícios. Preserve as chaves de armazenamento ao alterar o formato dos dados ou implemente uma migração.

Para contribuir, crie uma branch, implemente a alteração e execute os testes afetados. Mudanças em componentes compartilhados devem passar por `npm test` e `npm run test:browser`. Use `npm run test:visual` para conferir o percurso entre páginas em desktop e mobile emulado.

Os testes usam perfis de navegador descartáveis. Áudio e câmera são exercitados com dados sintéticos; a precisão com instrumento real e a compreensão das instruções precisam de validação com pessoas.

## Deploy

Acesse https://pedrosatin.github.io/guitar-study/.

O GitHub Actions publica automaticamente cada push na branch `main`. Também é possível executar o workflow "Deploy GitHub Pages" manualmente. O repositório permanece privado; o site e seus arquivos de execução são públicos.

O script `python3 scripts/package-site.py` prepara `_site/` apenas com arquivos rastreados da aplicação, em `index.html`, `shared/` e `poc/`. Não há compilação, backend ou banco de dados no servidor. Para incluir novos recursos, adicione-os ao Git e confira as extensões aceitas pelo script. O diretório `_site/` é gerado e ignorado pelo Git.

GitHub Pages fornece HTTPS. Microfone e câmera continuam sujeitos à permissão do navegador. O progresso fica no navegador de cada pessoa; os registros feitos em localhost não são transferidos para o site publicado.

## Transcrição experimental

O módulo `poc/m9-audio-tabs/` usa Basic Pitch 1.0.1 e TensorFlow.js 3.21.0, com licença Apache-2.0. `engine.js` e `model/` são servidos pelo próprio site somente ao iniciar a análise. A execução usa JavaScript e CPU em um Web Worker, sem WebAssembly ou envio de áudio. Cada análise encerra o worker para liberar o modelo e os tensores.

Para regenerar o bundle e copiar o modelo após mudanças no motor:

```sh
npm ci
npm run build:transcriber
npm run test:transcriber
```

O código-fonte do worker fica em `scripts/transcription-worker.js`; o build fica em `scripts/build-transcriber.cjs`. Versione o bundle gerado, o modelo e suas licenças junto com as alterações. O deploy apenas copia esses arquivos.

Arquivos aceitos dependem dos codecs do navegador, até 20 MB e 5 minutos. A análise usa um trecho de 0,5 a 30 segundos convertido para mono a 22050 Hz. Há cancelamento e limite de 3 minutos de processamento. A gravação para em 30 segundos, ao ocultar a aba ou sair da página. Áudio e resultados não são persistidos; exporte antes de fechar.

`tablature.js` sugere posições na afinação padrão, evita ocupar uma corda com notas sobrepostas e deixa notas sem posição disponíveis para revisão. Mudanças manuais conflitantes são sinalizadas. A revisão permite trocar corda/casa e excluir notas; não inclui inserção de notas nem edição de altura/duração. TXT exibe segundos sem notação rítmica; MIDI preserva os tempos detectados, sem inferir compassos ou técnicas de execução. Banda completa não passa por separação de instrumentos.
