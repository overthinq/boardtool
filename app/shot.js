// Usage: node app/shot.js <board.html> [--height N]
// Saves a screenshot of the board at its frame size in project/.shots/ and
// prints its path. Uses a browser installed on the system, headless, so it
// works whether the tool runs or not. Exit code 2 when it cannot take it.

import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import {
  basename,
  delimiter,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { promisify } from "node:util";
import { reply, serveFile } from "./http.js";
import { BOARDS, PROJECT, readBoardData, readConfig } from "./sources.js";

const SHOTS = join(PROJECT, ".shots");

const programDirs = [
  process.env.PROGRAMFILES,
  process.env["PROGRAMFILES(X86)"],
  process.env.LOCALAPPDATA,
].filter(Boolean);

// Chromium browsers first: their screenshot options are the most reliable.
const CANDIDATES = {
  linux: [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "firefox",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Firefox.app/Contents/MacOS/firefox",
  ],
  win32: programDirs.flatMap((dir) => [
    join(dir, "Google/Chrome/Application/chrome.exe"),
    join(dir, "Microsoft/Edge/Application/msedge.exe"),
    join(dir, "Mozilla Firefox/firefox.exe"),
  ]),
};

function fail(message) {
  console.error(message);
  process.exit(2);
}

const exists = (path) => access(path).then(() => true, () => false);

async function findBrowser() {
  if (process.env.BOARDTOOL_BROWSER) return process.env.BOARDTOOL_BROWSER;
  const dirs = (process.env.PATH ?? "").split(delimiter);
  for (const candidate of CANDIDATES[process.platform] ?? []) {
    const paths = isAbsolute(candidate)
      ? [candidate]
      : dirs.map((dir) => join(dir, candidate));
    for (const path of paths) if (await exists(path)) return path;
  }
  return null;
}

function browserArgs(browser, { width, height }, profile, out, url) {
  // Firefox has no option for the visible part only: it saves the whole page.
  if (basename(browser).toLowerCase().startsWith("firefox")) {
    return [
      "--headless",
      "--no-remote",
      "--profile",
      profile,
      `--window-size=${width},${height}`,
      "--screenshot",
      out,
      url,
    ];
  }
  return [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    // Lets the components' scripts run before the picture is taken.
    "--virtual-time-budget=3000",
    `--screenshot=${out}`,
    url,
  ];
}

const [file, option, value] = process.argv.slice(2);
if (!file || (option && option !== "--height")) {
  fail("Usage: node app/shot.js <board.html> [--height N]");
}
const board = resolve(file);
if (!board.startsWith(BOARDS + sep) || !board.endsWith(".html")) {
  fail(`${file}: not a board in project/boards/`);
}
if (!(await exists(board))) fail(`${file}: no such board`);
const browser = await findBrowser();
if (!browser) {
  fail(
    "No Chrome, Chromium, Edge or Firefox found. Use the browser tool of " +
      "your environment, set BOARDTOOL_BROWSER to a browser path, or ask " +
      "the user.",
  );
}

const path = relative(BOARDS, board).split(sep).join("/");
const config = await readConfig().catch((err) => fail(err.message));
const data = await readBoardData();
const page = path.split("/")[0];
const frame =
  data.boards[path]?.frame ?? data.pages[page]?.frame ?? config.frame;
const height = option ? Number(value) : frame.height;
if (!Number.isInteger(height) || height < 1) fail("--height needs a number");

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  serveFile(res, PROJECT, decodeURIComponent(pathname)).catch(() =>
    reply(res, 500),
  );
}).listen(0, "127.0.0.1");
await new Promise((done) => server.once("listening", done));
const url = `http://127.0.0.1:${server.address().port}/boards/${path}`;

await mkdir(SHOTS, { recursive: true });
const name = path.replace("/", "--").replace(/\.html$/, "");
const out = join(SHOTS, `${name}.png`);
await rm(out, { force: true });
const profile = await mkdtemp(join(tmpdir(), "boardtool-"));
const size = { width: frame.width, height };
try {
  const args = browserArgs(browser, size, profile, out, url);
  await promisify(execFile)(browser, args, { timeout: 60_000 });
} catch (err) {
  console.error(err.stderr || err.message);
} finally {
  server.closeAllConnections();
  server.close();
  await rm(profile, { recursive: true, force: true });
}
if (!(await exists(out))) {
  fail(`${basename(browser)} did not save a screenshot`);
}
console.log(relative(process.cwd(), out));
