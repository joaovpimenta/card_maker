# Card Maker

Card Maker is a visual editor for designing and generating card sets for board game prototypes. Design a template, bind its elements to card data, preview the deck, and export the rendered cards.

Try the static app at [joaovpimenta.github.io/card_maker](https://joaovpimenta.github.io/card_maker/). It runs in the browser and requires no account or server. Projects are stored in local browser storage; export project JSON to keep a portable copy.

## Quick start

```sh
npm ci
npm run dev
```

Import a project JSON or a JSON/CSV data set, edit the card template, preview the cards, then export the template or rendered deck.

## Browser automation and agent docs

The loaded page exposes `window.cardMaker` for browser automation. Await `window.cardMaker.ready`, validate project JSON, then import it or use commands to edit the current project. This is a browser API provided by the static app; there is no remote MCP endpoint, server-side API, or API key.

Start with the [agent guide](public/agents/README.md), [capabilities summary](public/agents/capabilities.md), [machine-readable capabilities catalog](public/agents/capabilities.json), [project JSON Schema](public/agents/project.schema.json), and [sample project](public/agents/sample-project.json). The same documents are published at `/card_maker/agents/`; the discovery index is [`llms.txt`](https://joaovpimenta.github.io/card_maker/llms.txt).

## Deployment

GitHub Actions builds and deploys the static `dist/` directory to GitHub Pages on pushes to `main`. Pull requests run validation without publishing. The app is served under `/card_maker/`, configured through Vite's base path.

For the first deployment, select **Settings → Pages → Build and deployment → Source: GitHub Actions** in this repository. Merge the change into `main`, or run the GitHub Pages workflow manually from `main`.

## Validation

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e # serves the production build under /card_maker/
```

Browser tests cover phone/tablet/desktop layouts, touch selection, pan/zoom, image export, project round trips, font restoration, and recovery from corrupt saved data. Uploaded data, images, and project edits stay in the browser; external image URLs and Google Fonts still require a network connection and appropriate CORS support. Legacy custom JavaScript rules are disabled; declarative rules remain available.

## License

MIT. See [LICENSE.md](LICENSE.md).

## Criar uma carta rapidamente

Escolha um modelo **Fantasia**, **Personagem**, **Educativo** ou **Produto**,
preencha o formulário e toque em **Baixar carta** para obter um PNG. A prévia
acompanha as alterações. No celular, **Ver carta** amplia a prévia sem perder
sua posição no formulário.

Envie uma imagem pela galeria ou câmera; no desktop, também é possível arrastar
ou colar. **Preencher**, **Mostrar inteira**, zoom e posição ajustam a arte sem
distorção. As imagens locais são incorporadas ao projeto salvo.

**Abrir arquivo** reconhece projetos completos e tabelas CSV, TSV ou JSON.
Projetos restauram layout, imagens e dados; tabelas permitem escolher o modelo
e conferir o mapeamento das colunas. **Salvar projeto** baixa uma cópia editável;
o salvamento automático fica apenas no dispositivo atual.

Use **Nova carta**, **Duplicar carta** e **Baixar todas** para trabalhar em lote.
Modelo, cores e enquadramento são compartilhados pelo conjunto; textos e imagens
pertencem a cada carta. **Personalizar layout** abre o editor livre existente.
Ao fazer isso, o layout é materializado e deixa de reorganizar os campos
automaticamente. A ação pode ser desfeita.
