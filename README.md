# BoardTool

A prototyping environment where an AI agent works only on a design system, its components and HTML boards, while a separate tool, which the agent never sees, provides navigation and an overview of the whole app. Prototypes are made of the same material as the final product, at a fraction of the token cost of an agent reading a canvas.

**Status:** alpha 0.1.0, the first usable version. Pages and live board previews in the browser, with notes, tags, frame sizes and moves between pages; DTCG tokens generate `tokens.css` and the catalog. Two design system pages: tokens, with alias chains, usages and text contrast; components, with guidelines, API from JSDoc and live examples. A lint checks boards against the design system rules.

## Requirements

Node 20+. No `npm install`, no build step.

## Usage

| Task | How |
| --- | --- |
| Start the tool | `node app/server.js`, then open `http://127.0.0.1:4800/__app/` |
| Prototyping session | Start the agent in `project/` |
| Tool development session | Start the agent at the repository root and have it read `app/AGENTS.md` first |
| Lint a board | `node ../app/lint.js boards/<page>/<file>` from `project/` |

## Structure

| Path | Content |
| --- | --- |
| `app/` | The tool: server, lint, `lib/` shared with the browser, `ui/` |
| `project/` | The work of one project: server root and folder where prototyping sessions start |
| `project/board.json` | Notes, tags and frame sizes of the boards; written by the tool |
| `project/ds/tokens/` | DTCG tokens: `primitive/`, `semantic/`, `component/` |
| `project/ds/components/` | Custom Elements, one folder each: `<name>.js`, `<name>.css`, `<name>.md` |
| `project/ds/tokens.css`, `catalog.md` | Generated |
| `project/boards/` | Boards; each subfolder is a page, numeric prefixes set the order |

## What sets it apart

HTML boards in a folder, shown in iframes and refreshed by a watcher, already exist. BoardTool is a combination of opinionated, standards-based choices:

- **Zero dependencies.** Node 20+ only: clone and start.
- **Standards, not proprietary formats.** DTCG tokens, native Web Components, JSDoc compatible with the Custom Elements Manifest.
- **Shared components, not isolated frames.** Boards compose central custom elements: change a component, every board using it changes.
- **Token cost as a design requirement.** Per-folder rules, a compact generated catalog, a template copied without reading it, lint instead of prose rules.
- **Agent and tool kept apart.** The agent works only on the DS and boards; the tool never writes to sources.
- **First-class design system.** Three tiers, alias chains and usages, component pages with live examples, all generated from sources.
- **Accessibility built in.** Contrast checked on semantic pairs; lint on non-native interactive elements, images without `alt`, unlabeled fields.
- **The prototype is product material.** Tokens and components are standard code that can move into the product.
- **Agent-agnostic.** Rules are Markdown files and the lint is a command.
