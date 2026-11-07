import { createServer, STATUS_CODES } from "node:http";
import { watch } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTokens,
  catalogTokens,
  describeTokens,
  TIERS,
  toCss,
} from "./lib/dtcg.js";
import { catalogComponent, parseComponent } from "./lib/jsdoc.js";

const PORT = 4800;
const APP = dirname(fileURLToPath(import.meta.url));
const UI = join(APP, "ui");
const PROJECT = resolve(APP, "../project");
const BOARDS = join(PROJECT, "boards");
const DS = join(PROJECT, "ds");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const clients = new Set();
// The viewer shows the last valid tokens, plus the error of a later failure.
const designSystem = { tokens: [], tokenError: null, components: [] };

function send(event, data) {
  for (const res of clients) res.write(`event: ${event}\ndata: ${data}\n\n`);
}

function reply(
  res,
  status,
  body = STATUS_CODES[status],
  type = "text/plain; charset=utf-8",
) {
  // Boards must always reflect the files on disk, also after a live reload.
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

const byName = (a, b) => a.name.localeCompare(b.name, "en", { numeric: true });
const isListed = (entry) => !/^[._]/.test(entry.name);

// "01-monitoring" → "Monitoring", "02-alarm-list.html" → "Alarm list"
function label(name) {
  const words = name
    .replace(/\.html$/, "")
    .replace(/^\d+-/, "")
    .replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function readPage(page) {
  const entries = await readdir(join(BOARDS, page.name), {
    withFileTypes: true,
  });
  const files = entries
    .filter((entry) => entry.isFile() && isListed(entry))
    .filter((entry) => entry.name.endsWith(".html"))
    .sort(byName);
  const boards = await Promise.all(
    files.map(async (file) => {
      const path = `${page.name}/${file.name}`;
      const { mtimeMs } = await stat(join(BOARDS, path));
      return { path, name: label(file.name), modified: mtimeMs };
    }),
  );
  return { dir: page.name, name: label(page.name), boards };
}

async function tree() {
  const entries = await readdir(BOARDS, { withFileTypes: true });
  const pages = entries
    .filter((entry) => entry.isDirectory() && isListed(entry))
    .sort(byName);
  return Promise.all(pages.map(readPage));
}

function subscribe(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
  });
  res.flushHeaders();
  clients.add(res);
  req.on("close", () => clients.delete(res));
}

async function serveFile(res, root, path) {
  const target = path.endsWith("/") ? path + "index.html" : path;
  const file = resolve(root, "." + target);
  // Never serve anything outside root, whatever the URL contains.
  if (!file.startsWith(root + sep)) return reply(res, 404);
  try {
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    reply(res, 200, await readFile(file), type);
  } catch (err) {
    if (["ENOENT", "EISDIR", "ENOTDIR"].includes(err.code)) {
      return reply(res, 404);
    }
    throw err;
  }
}

async function handle(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return reply(res, 405);
  const url = new URL(req.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);
  if (path === "/__api/events") return subscribe(req, res);
  if (path === "/__api/tree") {
    return reply(res, 200, JSON.stringify(await tree()), TYPES[".json"]);
  }
  if (path === "/__api/ds") {
    return reply(res, 200, JSON.stringify(designSystem), TYPES[".json"]);
  }
  if (path.startsWith("/__app/")) {
    return serveFile(res, UI, path.slice("/__app".length));
  }
  return serveFile(res, PROJECT, path);
}

async function readTokenFiles() {
  const files = [];
  for (const tier of TIERS) {
    const dir = join(DS, "tokens", tier);
    const names = (await readdir(dir)).filter((name) =>
      name.endsWith(".tokens.json"),
    );
    for (const name of names.sort()) {
      const text = await readFile(join(dir, name), "utf8");
      try {
        files.push({ tier, name: `${tier}/${name}`, json: JSON.parse(text) });
      } catch (err) {
        throw new Error(`${tier}/${name}: ${err.message}`);
      }
    }
  }
  return files;
}

// Skipping identical writes avoids a reload of every board for nothing.
async function writeIfChanged(file, content) {
  const current = await readFile(file, "utf8").catch(() => null);
  if (current !== content) await writeFile(file, content);
}

// One folder per component: <name>/<name>.js with the JSDoc, <name>.md with
// the guidelines.
async function readComponents() {
  const dir = join(DS, "components");
  const entries = await readdir(dir, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory() && isListed(entry))
    .sort(byName);
  return Promise.all(
    folders.map(async ({ name }) => {
      const read = (extension) =>
        readFile(join(dir, name, `${name}.${extension}`), "utf8").catch(
          () => "",
        );
      const api = parseComponent(await read("js"));
      const error = api ? null : `${name}/${name}.js has no JSDoc @element`;
      return { folder: name, ...api, guide: await read("md"), error };
    }),
  );
}

function catalog() {
  return [
    "# Catalog (generated, do not edit)",
    "",
    "## Components",
    ...designSystem.components
      .filter((component) => component.tag)
      .map(catalogComponent),
    "",
    "## Tokens",
    ...catalogTokens(designSystem.tokens),
    "",
  ].join("\n");
}

async function generateDesignSystem() {
  try {
    const tokens = buildTokens(await readTokenFiles());
    await writeIfChanged(join(DS, "tokens.css"), toCss(tokens));
    designSystem.tokens = describeTokens(tokens);
    designSystem.tokenError = null;
  } catch (err) {
    // The last generated files stay until the token files are valid again.
    console.error(`Tokens not generated. ${err.message}`);
    designSystem.tokenError = err.message;
  }
  try {
    designSystem.components = await readComponents();
    await writeIfChanged(join(DS, "catalog.md"), catalog());
  } catch (err) {
    console.error(`Catalog not generated. ${err.message}`);
  }
  send("catalog", designSystem.tokenError ? "error" : "ok");
}

createServer((req, res) =>
  handle(req, res).catch((err) => {
    if (res.headersSent) return res.destroy();
    if (err instanceof URIError) return reply(res, 400);
    console.error(err);
    reply(res, 500);
  }),
).listen(PORT, "127.0.0.1", () => {
  console.log(`BoardTool: http://127.0.0.1:${PORT}/__app/`);
});

function notify(filename) {
  const [area, ...segments] = filename.split(sep);
  if (segments.some((segment) => segment.startsWith("."))) return;
  const path = segments.join("/");
  if (area === "ds") {
    // Token files reach the boards through tokens.css: rewriting it sends
    // the event.
    if (segments[0] !== "tokens" && path !== "catalog.md") send("ds", path);
    if (segments[0] === "tokens" || segments[0] === "components") {
      generateDesignSystem();
    }
  }
  // Pages have no extension: a board event also covers added or removed
  // pages, so the index can refresh its tree.
  const isBoard =
    [".html", ""].includes(extname(path)) &&
    !segments.some((segment) => segment.startsWith("_"));
  if (area === "boards" && isBoard) send("board", path);
}

// Editors save in several steps: wait for the last event on a path.
const pending = new Map();

watch(PROJECT, { recursive: true }, (_, filename) => {
  if (!filename) return;
  clearTimeout(pending.get(filename));
  pending.set(
    filename,
    setTimeout(() => {
      pending.delete(filename);
      notify(filename);
    }, 50),
  );
});

generateDesignSystem();
