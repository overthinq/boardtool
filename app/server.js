import { createServer, STATUS_CODES } from "node:http";
import { watch } from "node:fs";
import {
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTokens,
  catalogTokens,
  describeTokens,
  toCss,
} from "./lib/dtcg.js";
import { catalogComponent } from "./lib/jsdoc.js";
import {
  byName,
  DS,
  BOARD_DATA,
  BOARDS,
  isListed,
  PROJECT,
  readBoardData,
  readComponents,
  readTokenFiles,
} from "./sources.js";
import { reply, serveFile, TYPES } from "./http.js";

const PORT = 4800;
const APP = dirname(fileURLToPath(import.meta.url));
const UI = join(APP, "ui");
const HOSTS = [`127.0.0.1:${PORT}`, `localhost:${PORT}`];

const clients = new Set();
// The viewer shows the last valid tokens, plus the error of a later failure.
const designSystem = { tokens: [], tokenError: null, components: [] };

class RequestError extends Error {
  constructor(status, message = STATUS_CODES[status]) {
    super(message);
    this.status = status;
  }
}

function send(event, data) {
  for (const res of clients) res.write(`event: ${event}\ndata: ${data}\n\n`);
}

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

// Through a temporary file, so a crash never leaves half a board.json.
async function writeBoardData(data) {
  const temporary = join(PROJECT, ".board.json.tmp");
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporary, BOARD_DATA);
  send("metadata", "board.json");
}

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStrings = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const isFrame = (frame) =>
  frame === undefined ||
  (Number.isInteger(frame?.width) &&
    Number.isInteger(frame?.height) &&
    frame.width > 0 &&
    frame.height > 0);
const isTag = (tag) =>
  typeof tag?.id === "string" && typeof tag?.label === "string";
const isBoard = (board) =>
  isRecord(board) &&
  isFrame(board.frame) &&
  (board.tags === undefined || isStrings(board.tags)) &&
  (board.note === undefined || typeof board.note === "string");

function checkBoardData(data) {
  const isValid =
    isRecord(data) &&
    data.version === 1 &&
    Array.isArray(data.tags) &&
    data.tags.every(isTag) &&
    isRecord(data.pages) &&
    Object.values(data.pages).every((page) => isFrame(page?.frame)) &&
    isRecord(data.boards) &&
    Object.values(data.boards).every(isBoard);
  if (!isValid) throw new RequestError(400, "Invalid board data");
}

async function readJson(req) {
  // A JSON body makes browsers ask before sending a request from another site.
  const type = req.headers["content-type"]?.split(";")[0].trim();
  if (type !== "application/json") throw new RequestError(415);
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new RequestError(413);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new RequestError(400, "Invalid JSON");
  }
}

const exists = (path) => stat(path).then(() => true, () => false);

// The only write to boards/: a board file moves to another page, and its
// metadata moves with it.
async function moveBoard({ from, to }) {
  if (typeof from !== "string" || typeof to !== "string") {
    throw new RequestError(400);
  }
  const source = resolve(BOARDS, from);
  const page = resolve(BOARDS, to);
  const target = join(page, basename(source));
  if (
    dirname(dirname(source)) !== BOARDS ||
    dirname(page) !== BOARDS ||
    extname(source) !== ".html"
  ) {
    throw new RequestError(400, "Expected a board and a page in boards/");
  }
  if (!(await exists(source))) throw new RequestError(404, `No board ${from}`);
  // rename() would silently replace a board with the same name.
  if (await exists(target)) {
    throw new RequestError(409, `${to} already has ${basename(source)}`);
  }
  await rename(source, target);
  const data = await readBoardData();
  if (!Object.hasOwn(data.boards, from)) return;
  const moved = relative(BOARDS, target).split(sep).join("/");
  data.boards[moved] = data.boards[from];
  delete data.boards[from];
  await writeBoardData(data);
}

async function handle(req, res) {
  // Pages from other sites can reach 127.0.0.1 through DNS rebinding, but
  // they keep their own host name.
  if (!HOSTS.includes(req.headers.host)) return reply(res, 403);
  const url = new URL(req.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);
  if (path === "/__api/board" && req.method === "PUT") {
    const data = await readJson(req);
    checkBoardData(data);
    await writeBoardData(data);
    return reply(res, 204, "");
  }
  if (path === "/__api/move" && req.method === "POST") {
    await moveBoard(await readJson(req));
    return reply(res, 204, "");
  }
  if (req.method !== "GET" && req.method !== "HEAD") return reply(res, 405);
  if (path === "/__api/events") return subscribe(req, res);
  if (path === "/__api/board") {
    const data = await readBoardData();
    return reply(res, 200, JSON.stringify(data), TYPES[".json"]);
  }
  if (path === "/__api/tree") {
    return reply(res, 200, JSON.stringify(await tree()), TYPES[".json"]);
  }
  if (path === "/__api/ds") {
    return reply(res, 200, JSON.stringify(designSystem), TYPES[".json"]);
  }
  if (path === "/__app/config.json") return serveFile(res, APP, "/config.json");
  if (path.startsWith("/__app/")) {
    return serveFile(res, UI, path.slice("/__app".length));
  }
  return serveFile(res, PROJECT, path);
}


// Skipping identical writes avoids a reload of every board for nothing.
async function writeIfChanged(file, content) {
  const current = await readFile(file, "utf8").catch(() => null);
  if (current !== content) await writeFile(file, content);
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
    if (err instanceof RequestError) return reply(res, err.status, err.message);
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
