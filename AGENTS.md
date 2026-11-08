# BoardTool — tool development
- Node 20+, built-in modules only (`node:*`). Zero npm dependencies, no `npm install`, no build step, no framework.
- ES modules everywhere.
- `lib/` is shared by server and browser: no Node-only APIs there.
- The project folder is the one in `config.json`, a sibling of the tool by default. The tool writes there only `board.json`, generated files (`ds/tokens.css`, `ds/catalog.md`) and screenshots in `.shots/`. Only `init.js` and `reset.js` create the folder or rewrite its `AGENTS.md` rules; `reset.js` renames the old folder, never deletes it.
- Questions in the terminal live in `setup/prompt.js`. `setup/template/` is copied into every new project, `setup/demo/` on top of it on request: keep the demo free of lint errors.
- The `AGENTS.md` files in `setup/template/` keep the marker line and `{TOOL}` where the tool's path goes.
- Generated files start with a "generated, do not edit" comment.
- The server listens on `127.0.0.1` only and answers only to the hosts `127.0.0.1` and `localhost`. The only write endpoint takes a JSON body and writes only `board.json`.
