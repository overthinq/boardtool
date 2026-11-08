// Usage: node app/lint.js [board.html | component.js | stylesheet.css]...
// Without arguments it checks the whole project: every component with its
// stylesheet, ds/base.css and every board. Prints one line per error, nothing
// for a correct file. Exit code 1 on errors, 2 when the lint cannot run. Reads
// tokens and components from their sources, so it is right whether the server
// runs or not.

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { buildTokens } from "./lib/dtcg.js";
import { parseComponent, reservedAttributes } from "./lib/jsdoc.js";
import {
  BOARDS,
  byName,
  DS,
  isListed,
  readComponents,
  readTokenFiles,
} from "./sources.js";

const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUTE = /([^\s=/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
// The second group is the comma of a fallback value.
const VAR = /var\(\s*(--[^\s,)]+)\s*(,?)/g;
const DECLARED = /(--[^\s:;{},()]+)\s*:/g;
// Declaration values end with ";" or "}", selectors and at-rules with "{".
const VALUE = /:([^;{}]*)(?=[;}])/g;
// Parts of a value where "#" or "rgb(" is not a hard-coded color.
const NOT_COLORS = /(?:var|url)\([^)]*\)|"[^"]*"|'[^']*'/g;
const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const SIZE = /(?<![\w-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|vh|vw|vmin|vmax|%)/;
const COLOR_ATTRIBUTES = ["fill", "stroke", "color", "bgcolor", "stop-color"];
const INTERACTIVE = ["a", "button", "input", "select", "textarea", "summary"];
const UNLABELLED_INPUTS = ["hidden", "submit", "button", "reset", "image"];

// Same length and line breaks, so positions keep pointing at the right line.
const blank = (text) => text.replace(/[^\n]/g, " ");
const lineAt = (text, index) => text.slice(0, index).split("\n").length;

function attributes(source) {
  const result = new Map();
  for (const [, name, value = ""] of source.matchAll(ATTRIBUTE)) {
    result.set(name.toLowerCase(), value.replace(/^["']|["']$/g, ""));
  }
  return result;
}

// reportAt(index) returns the reporter for a position in the CSS text.
function checkCss(css, reportAt, tiers) {
  for (const match of css.matchAll(VAR)) {
    const name = match[1];
    if (!tiers.has(name)) reportAt(match.index)(`var(${name}) is not a token`);
    else if (tiers.get(name) === "primitive") {
      reportAt(match.index)(`${name} is a primitive token: use a semantic one`);
    }
  }
  const literals = css.replace(/var\([^)]*\)/g, blank);
  const color = COLOR.exec(literals);
  if (color) reportAt(color.index)("hard-coded color: use a token");
  const size = SIZE.exec(literals);
  if (size) reportAt(size.index)("hard-coded size: use a token");
}

function checkElement(element, context) {
  const { name, attrs, report } = element;
  const { tiers, tags, labelledIds } = context;
  if (attrs.has("style")) {
    report("inline style: use DS components and tokens");
    checkCss(attrs.get("style"), () => report, tiers);
  }
  if (name.startsWith("ds-") && !tags.has(name)) {
    report(`<${name}> is not a registered component`);
  }
  const isClickable =
    attrs.has("onclick") || ["button", "link"].includes(attrs.get("role"));
  if (isClickable && !INTERACTIVE.includes(name)) {
    report(`clickable <${name}>: use a native <button> or <a>`);
  }
  if (name === "img" && !attrs.has("alt")) report("image without alt");
  const isField =
    ["select", "textarea"].includes(name) ||
    (name === "input" && !UNLABELLED_INPUTS.includes(attrs.get("type")));
  const hasLabel =
    element.insideLabel ||
    attrs.has("aria-label") ||
    attrs.has("aria-labelledby") ||
    labelledIds.has(attrs.get("id"));
  if (isField && !hasLabel) report(`<${name}> without a label`);
  for (const attribute of ["href", "src"]) {
    if (/^(?:\.\.?\/)*ds\//.test(attrs.get(attribute) ?? "")) {
      const absolute = `/${attrs.get(attribute).replace(/^[./]*/, "")}`;
      report(`relative path to ds/: use ${absolute}`);
    }
  }
  for (const attribute of COLOR_ATTRIBUTES) {
    if (COLOR.test(attrs.get(attribute) ?? "")) {
      report(`hard-coded color in ${attribute}: use a token`);
    }
  }
}

function lintBoard(html, context) {
  const errors = [];
  const reporter = (index) => (message) =>
    errors.push({ line: lineAt(html, index), message });
  let source = html.replace(/<!--[\s\S]*?-->/g, blank);
  for (const match of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    reporter(match.index)("<style> block: use DS components and tokens");
    const start = match.index + match[0].indexOf(">") + 1;
    checkCss(match[1], (index) => reporter(start + index), context.tiers);
  }
  source = source.replace(
    /(<(?:script|style)\b[^>]*>)([\s\S]*?)(?=<\/(?:script|style)>)/gi,
    (_, open, body) => open + blank(body),
  );
  const elements = [...source.matchAll(TAG)].map((match) => ({
    isClosing: match[1] === "/",
    name: match[2].toLowerCase(),
    attrs: attributes(match[3]),
    report: reporter(match.index),
  }));
  const labelledIds = new Set(
    elements
      .filter((element) => element.name === "label" && !element.isClosing)
      .map((element) => element.attrs.get("for"))
      .filter(Boolean),
  );
  const elementContext = { ...context, labelledIds };
  let openLabels = 0;
  for (const element of elements) {
    if (element.name === "label") openLabels += element.isClosing ? -1 : 1;
    if (element.isClosing) continue;
    element.insideLabel = openLabels > 0;
    checkElement(element, elementContext);
  }
  return errors.sort((a, b) => a.line - b.line);
}

// The DS may add its own variables, declared in its stylesheets or documented
// with @cssprop, and decide its own sizes: only tokens and colors are checked.
function lintStylesheet(css, { tiers, variables }) {
  const errors = [];
  const report = (index, message) =>
    errors.push({ line: lineAt(css, index), message });
  const source = css.replace(/\/\*[\s\S]*?\*\//g, blank);
  for (const match of source.matchAll(VAR)) {
    const [, name, fallback] = match;
    const tier = tiers.get(name);
    if (tier === "primitive") {
      report(match.index, `${name} is a primitive token: use a semantic one`);
    } else if (!tier && !fallback && !variables.has(name)) {
      report(
        match.index,
        `var(${name}) is not a token or a declared variable`,
      );
    }
  }
  for (const match of source.matchAll(VALUE)) {
    const color = COLOR.exec(match[1].replace(NOT_COLORS, blank));
    if (color) {
      report(match.index + 1 + color.index, "hard-coded color: use a token");
    }
  }
  return errors.sort((a, b) => a.line - b.line);
}

function lintComponent(source) {
  const component = parseComponent(source);
  if (!component) return [{ line: 1, message: "no JSDoc block with @element" }];
  return reservedAttributes(component).map((name) => {
    const tag = new RegExp(`@attr(?:ibute)?\\s*(?:\\{[^}]*\\}\\s*)?${name}\\b`);
    return {
      line: lineAt(source, source.search(tag)),
      message: `attribute "${name}" is an HTML attribute: rename it`,
    };
  });
}

async function loadContext() {
  const tokens = buildTokens(await readTokenFiles());
  const tiers = new Map(
    tokens.flatMap((token) =>
      token.declarations.map(([name]) => [name, token.tier]),
    ),
  );
  const components = await readComponents();
  const tags = new Set(components.map((component) => component.tag));
  const paths = components.map(({ folder }) =>
    join(DS, "components", folder, folder),
  );
  const stylesheets = [];
  const variables = new Set(
    components.flatMap(({ cssProperties = [] }) =>
      cssProperties.map(({ name }) => name),
    ),
  );
  const candidates = [
    join(DS, "base.css"),
    ...paths.map((path) => `${path}.css`),
  ];
  for (const file of candidates) {
    const css = await readFile(file, "utf8").catch(() => null);
    if (css === null) continue;
    stylesheets.push(file);
    for (const [, name] of css.matchAll(DECLARED)) variables.add(name);
  }
  const scripts = paths.map((path) => `${path}.js`);
  return { tiers, tags, variables, scripts, stylesheets };
}

async function readBoards() {
  const pages = (await readdir(BOARDS, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && isListed(entry))
    .sort(byName);
  const boards = [];
  for (const page of pages) {
    const entries = await readdir(join(BOARDS, page.name), {
      withFileTypes: true,
    });
    for (const entry of entries.sort(byName)) {
      if (entry.isFile() && isListed(entry) && entry.name.endsWith(".html")) {
        boards.push(join(BOARDS, page.name, entry.name));
      }
    }
  }
  return boards;
}

const LINTERS = { ".js": lintComponent, ".css": lintStylesheet };

const context = await loadContext().catch((err) => {
  console.error(`The design system has an error. ${err.message}`);
  process.exit(2);
});
const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : [...context.scripts, ...context.stylesheets, ...(await readBoards())];
let hasErrors = false;
for (const file of files) {
  const path = relative(process.cwd(), resolve(file));
  const source = await readFile(file, "utf8").catch((err) => {
    console.error(`${path}: ${err.message}`);
    process.exit(2);
  });
  const errors = (LINTERS[extname(file)] ?? lintBoard)(source, context);
  for (const { line, message } of errors) {
    console.log(`${path}:${line}: ${message}`);
    hasErrors = true;
  }
}
process.exitCode = hasErrors ? 1 : 0;
