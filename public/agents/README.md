# Agent guide

Card Maker can be operated by browser automation through the page's `window.cardMaker` API. It is a client-side API available only after the static app loads; it is not an MCP endpoint or a server API. See the [machine-readable capabilities catalog](capabilities.json) for the API transport, command contracts, result shapes, and limitations.

## Recommended workflow

1. Create a version 1 project JSON that follows [project.schema.json](project.schema.json). Use [sample-project.json](sample-project.json) as a complete starting point.
2. Open the deployed site and await `window.cardMaker.ready`.
3. Call `validateProject(project)` and correct every reported error.
4. Import it with `execute({ type: "importProject", project })` and inspect `getProject()`.
5. Make edits with `execute` commands or in the visual editor. Read [capabilities.md](capabilities.md) for command names and result formats.
6. Preview the deck in the app. Export with `exportCards({ download: true })` when the user wants files.

## Project contract

A project contains `version: 1`, a template, cards, and process rules. A template includes positive width and height, an array of typed elements, and `customFonts`. Supported element types are `text`, `image`, `staticText`, and `staticImage`; see the schema for required fields. Each card is a row of scalar values. Field bindings on elements should match card property names. The optional `processRules` array supports conditional creation or replacement of fields. A process rule with `key: "*"` compares its value against the card's field values joined into one string. Process-rule keys `__proto__`, `constructor`, and `prototype` are invalid.

## Safety and portability

The API only changes this browser's current editor state. Export project JSON to preserve or transfer work. The static app needs no credentials, API keys, or backend. Use same-origin app URLs and relative documentation links because GitHub Pages serves this project below `/card_maker/`.
