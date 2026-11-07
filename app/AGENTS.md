# BoardTool — tool development
- Spec: `docs/spec.md`. Implement one phase at a time; never start the next phase unasked.
- Node 20+, built-in modules only (`node:*`). Zero npm dependencies, no `npm install`, no build step, no framework.
- ES modules everywhere.
- `app/lib/` is shared by server and browser: no Node-only APIs there.
- The tool writes only to `app/data/` and to generated files (`project/ds/tokens.css`, `project/ds/catalog.md`). Only exception: moving a board between pages, started by the user.
- Generated files start with a "generated, do not edit" comment.
- The server listens on `127.0.0.1` only. Write endpoints accept only paths inside `app/data/` and, for moves, inside `project/boards/`.
- Never add an `AGENTS.md` or `CLAUDE.md` at the repository root: agents started in `project/` would load it as a parent.
