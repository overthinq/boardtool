# BoardTool — tool development
- Node 20+, built-in modules only (`node:*`). Zero npm dependencies, no `npm install`, no build step, no framework.
- ES modules everywhere.
- `app/lib/` is shared by server and browser: no Node-only APIs there.
- The tool writes only to `project/board.json`, to generated files (`project/ds/tokens.css`, `project/ds/catalog.md`) and to screenshots in `project/.shots/`. Only exception: moving a board between pages, started by the user.
- Generated files start with a "generated, do not edit" comment.
- The server listens on `127.0.0.1` only and answers only to the hosts `127.0.0.1` and `localhost`. Write endpoints take JSON bodies only and accept only `project/board.json` and, for moves, paths inside `project/boards/`.
- Never add an `AGENTS.md` or `CLAUDE.md` at the repository root: agents started in `project/` would load it as a parent.
