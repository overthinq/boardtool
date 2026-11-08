# BoardTool

A prototyping environment where an AI agent works only on a design system, its components and HTML boards, while a separate tool, which the agent never sees, provides navigation and an overview of the whole app. Prototypes are made of the same material as the final product, at a fraction of the token cost of an agent reading a canvas.

**Status:** 0.3.0. Pages and live board previews in the browser, small or large and scrollable, with notes, tags, frame sizes and moves between pages; DTCG tokens generate `tokens.css` and the catalog. Two design system pages: tokens, with alias chains, usages and text contrast; components, with guidelines, API from JSDoc and live examples. A lint checks boards, components and their stylesheets against the design system rules, and the agent can screenshot a board to see what it built.

## Requirements

No `npm install`, no build step. Tested on Linux (Fedora) with Node 22, Chrome and Claude Code 2.1.311; macOS and Windows are expected to work but are untested.

> **Trust the workspace.** With Claude Code, start it once in `project/` and accept the trust dialog before working. Until then Claude Code ignores the permissions in `project/.claude/settings.json`: the agent has to ask for every lint and screenshot, and in non-interactive runs (`claude -p`) those commands are refused, so the agent cannot check or see its work.

| Requirement | Minimum | Recommended | Why |
| --- | --- | --- | --- |
| Node.js | 20 | 22 or later | Runs the tool and the lint |
| Browser for the tool | Chrome or Edge 123, Firefox 121, Safari 17.5 | Current Chrome or Edge | The tool's pages use recent CSS and JavaScript (`light-dark()`, `:has()`, `Map.groupBy`) |
| Coding agent | Any agent that reads `AGENTS.md` and runs shell commands (Codex, Cursor, Copilot) | Claude Code 2.1.277 or later, with a recent large model | Claude Code reads `AGENTS.md` natively; tested with Claude Opus 5.5 |
| Agent sees what it builds | Chrome, Chromium, Edge or Firefox installed, used headless by `app/shot.js` | The same, plus the agent's own browser tool (Claude in Chrome, Chrome DevTools MCP, the browser built into the Claude desktop app) | Without a view of the result, layout mistakes slip through: in tests, screenshots removed the alignment defects |
| Workspace trust (Claude Code) | Required: start Claude Code once in `project/` and accept the trust dialog | — | Activates the permissions for the lint and the screenshots in `project/.claude/settings.json` (see the note above) |
| Git | None (download the archive) | Git | To clone and to track the project |

## Usage

| Task | How |
| --- | --- |
| Start the tool | `node app/server.js`, then open `http://127.0.0.1:4800/__app/` |
| Prototyping session | Start the agent in `project/` |
| Tool development session | Start the agent at the repository root and have it read `app/AGENTS.md` first |
| Lint | `node ../app/lint.js` from `project/` checks the whole project; pass boards, component `.js` or `.css` files to check only those |
| Screenshot a board | `node ../app/shot.js boards/<page>/<file> [--height N]` from `project/`; uses the installed Chrome, Chromium, Edge or Firefox, or `BOARDTOOL_BROWSER` |

## Structure

| Path | Content |
| --- | --- |
| `app/` | The tool: server, lint, screenshots, `lib/` shared with the browser, `ui/` |
| `app/config.json` | Defaults you can change: `frame`, the board size until a page or board has its own; `previews`, the maximum width in px of small and large previews in the index (narrower boards keep their own width) |
| `project/` | The work of one project: server root and folder where prototyping sessions start |
| `project/board.json` | Notes, tags and frame sizes of the boards; written by the tool |
| `project/ds/tokens/` | DTCG tokens: `primitive/`, `semantic/`, `component/` |
| `project/ds/components/` | Custom Elements, one folder each: `<name>.js`, `<name>.css`, `<name>.md` |
| `project/ds/base.css` | Rules shared by components: normalization, page font and colors, color contexts |
| `project/ds/tokens.css`, `catalog.md` | Generated |
| `project/.shots/` | Latest screenshot of each board; ignored by git |
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
