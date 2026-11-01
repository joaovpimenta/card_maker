# Card Maker browser capabilities

The deployed app is a static single-page application at `https://joaovpimenta.github.io/card_maker/`. Browser automation may access its API after the page has loaded. There is no remote MCP server, server-side project API, account, secret key, or backend.

## Readiness and project data

The page exposes `window.cardMaker`:

- `ready: Promise<void>` resolves after the editor's persisted browser state has hydrated. Await it before reading or changing project state.
- `getProject(): Project` returns the current project: `version`, `template`, `cards`, and `processRules`. It returns card values normalized to strings (including `null` as `""`).
- `validateProject(input)` accepts a project object or JSON string and returns `{ ok: true, errors: [] }` or `{ ok: false, errors: [{ message, path? }] }`. It catches JSON parse errors too.
- `execute(command)` applies one supported command and returns a structured success or error result. It does not throw for ordinary command validation failures.
- `exportCards(options?)` waits for readiness, renders the deck, and resolves to `{ filename, blob, count }`. Downloads are enabled by default; pass `{ download: false }` to suppress the download. `onProgress(current,total)` reports progress. Rendering failures reject the promise with an error.

Project shape and exact element fields are defined in [project.schema.json](project.schema.json). Input card values may be strings, numbers, booleans, or `null`; the runtime converts each to a string and converts `null` to the empty string. Card fields and process-rule source and target keys named `__proto__`, `constructor`, or `prototype` fail validation. Element IDs must be nonempty and unique within a template. Images can use a URL or data URI. Remote image URLs require the browser to be able to load them and may be affected by cross-origin restrictions.

See the [machine-readable capabilities catalog](capabilities.json) for a structured list of methods, command input fields, result shapes, and export limitations.

## Commands

`execute` supports these command objects:

| Command | Fields |
| --- | --- |
| `newProject` | none |
| `importProject` | `project` |
| `addElement` | `element` |
| `updateElement` | `id`, `updates` |
| `deleteElement` | `id` |
| `setDataset` | `cards` |
| `setTemplate` | `template` |
| `setProcessRules` | `processRules` |
| `addProcessRule` | `rule` |
| `updateProcessRule` | `index`, `updates` |
| `removeProcessRule` | `index` |
| `setCardSize` | `width`, `height` |
| `undo`, `redo` | none |

Array indexes are zero-based. Project import accepts scalar card values and normalizes them to strings; the typed `setDataset` command accepts rows typed as `Record<string,string>`.

Example browser automation:

```js
await page.goto("https://joaovpimenta.github.io/card_maker/");
const result = await page.evaluate(async (project) => {
  await window.cardMaker.ready;
  const validation = window.cardMaker.validateProject(project);
  if (!validation.ok) return validation;
  return window.cardMaker.execute({ type: "importProject", project });
}, projectJson);
```

Use the command discriminant `type` as shown. Errors have the shape `{ ok: false, errors: [{ message, path? }], warnings? }`; command errors currently include a message and may omit `path`. Successful calls return `{ ok: true, data: Project, warnings? }`. Check `ok` before continuing. Import or create projects in the browser, then use `getProject()` to inspect the resulting state.

## Browser limits

The API operates only in the loaded page and local browser storage. It cannot access a user's filesystem except through browser file/download flows, and it has no server persistence. An agent should create JSON that validates against the schema, then import it in the app. Do not describe this interface as MCP or call it remotely.
