# BoardTool

A prototyping environment where an AI agent works only on a design system, its components and HTML boards, while a separate tool, which the agent never sees, provides navigation and an overview of the whole app. Prototypes are made of the same material as the final product, at a fraction of the token cost of an agent reading a canvas.

**Status:** 0.4.1. `init.js` creates a project next to the tool, with an optional demo, and `reset.js` starts it over. Pages and live board previews in the browser, small or large and scrollable, with notes, tags and frame sizes; DTCG tokens generate `tokens.css` and the catalog. Two design system pages: tokens, with alias chains, usages and text contrast; components, with guidelines, API from JSDoc and live examples. A lint checks boards, components and their stylesheets against the design system rules, and the agent can screenshot a board to see what it built.

## Requirements

No `npm install`, no build step. Tested on Linux (Fedora) with Node 22, Chrome and Claude Code 2.1.311; macOS and Windows are expected to work but are untested.

> **Allow the lint and the screenshots.** The agent runs them often: at the first request, allow them for good (in Claude Code, "Yes, and don't ask again"). In non-interactive runs, pass them as allowed tools (`claude -p --allowedTools`).

| Requirement | Minimum | Recommended | Why |
| --- | --- | --- | --- |
| Node.js | 20 | 22 or later | Runs the tool and the lint |
| Browser for the tool | Chrome or Edge 123, Firefox 121, Safari 17.5 | Current Chrome or Edge | The tool's pages use recent CSS and JavaScript (`light-dark()`, `:has()`, `Map.groupBy`) |
| Coding agent | Any agent that reads `AGENTS.md` and runs shell commands (Codex, Cursor, Copilot) | Claude Code 2.1.277 or later, with a recent large model | Claude Code reads `AGENTS.md` natively; tested with Claude Opus 5.5 |
| Agent sees what it builds | Chrome, Chromium, Edge or Firefox installed, used headless by `shot.js` | The same, plus the agent's own browser tool (Claude in Chrome, Chrome DevTools MCP, the browser built into the Claude desktop app) | Without a view of the result, layout mistakes slip through: in tests, screenshots removed the alignment defects |
| Git | None (download the archive) | Git | To clone and to track the project |

## Usage

| Task | How |
| --- | --- |
| Install | Clone or unpack the tool as `boardtool/` in the folder that will hold the project, e.g. `DP8/HMI/boardtool/` |
| Create the project | With the server stopped, `node boardtool/init.js`: asks for the project folder (default `prototype/`, next to `boardtool/`) and whether to add the demo |
| Start the tool | `node boardtool/server.js`, then open `http://127.0.0.1:4800/__app/` |
| Prototyping session | Start the agent in the project folder |
| Tool development session | Start the agent in `boardtool/` |
| Update the tool | `git pull` in `boardtool/`. If the server says the rules are out of date, run `node boardtool/init.js` and confirm the same folder: it rewrites the rules above the marker line of each `AGENTS.md`, and keeps yours below it |
| Moved or renamed the project folder | `node boardtool/init.js` and type the new folder: it links it again |
| Start over | With the server stopped, `node boardtool/reset.js`: renames the project folder to `<name>.old-<date>-<time>` and creates a new one; delete the old folder yourself |
| Lint | `node ../boardtool/lint.js` from the project folder checks the whole project; pass boards, component `.js` or `.css` files to check only those |
| Screenshot a board | `node ../boardtool/shot.js boards/<page>/<file> [--height N]` from the project folder; uses the installed Chrome, Chromium, Edge or Firefox, or `BOARDTOOL_BROWSER` |

## Structure

| Path | Content |
| --- | --- |
| `boardtool/` | The tool: server, lint, screenshots, `init.js` and `reset.js`, `lib/` shared with the browser, `ui/`, `setup/` with the terminal questions, the project template and the demo |
| `boardtool/config.json` | Written by `init.js`, ignored by git, editable: `project`, the project folder, a name next to `boardtool/` or a path; `frame`, the board size until a page or board has its own; `previews`, the maximum width in px of small and large previews in the index (narrower boards keep their own width); `tags`, the tag names of a new project. Missing keys take the value in `defaults.json` |
| `prototype/` | The work of one project: server root and folder where prototyping sessions start |
| `prototype/AGENTS.md`, `ds/AGENTS.md`, `boards/AGENTS.md` | Rules for the agent. Above the marker line they are written by the tool; add your own below it |
| `prototype/board.json` | Notes, tags and frame sizes of the boards; written by the tool. Tied to each board's path: a board moved or renamed by hand loses them |
| `prototype/ds/tokens/` | DTCG tokens: `primitive/`, `semantic/`, `component/` |
| `prototype/ds/components/` | Custom Elements, one folder each: `<name>.js`, `<name>.css`, `<name>.md` |
| `prototype/ds/base.css` | Rules shared by components: normalization, page font and colors, color contexts |
| `prototype/ds/tokens.css`, `catalog.md` | Generated when the server starts and on every change |
| `prototype/.shots/` | Latest screenshot of each board; ignored by git |
| `prototype/boards/` | Boards; each subfolder is a page, numeric prefixes set the order |

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
