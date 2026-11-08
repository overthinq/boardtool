// Markdown subset for the component guidelines: headings, paragraphs, lists,
// fenced code, tables, and inline code, bold, italic and links. Anything else
// shows as text; HTML in the source is escaped, never rendered.

import { el } from "./el.js";

const FENCE = /^```\s*(\S*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^\s*(?:[-*+]|(\d+)\.)\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const escapeHtml = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Code spans first, so their content is left as written.
function inline(text) {
  return text
    .split(/(`[^`]+`)/)
    .map((part, i) => {
      if (i % 2) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      return escapeHtml(part)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    })
    .join("");
}

const block = (tag, text) => el(tag, { innerHTML: inline(text) });

const cells = (row) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

const isTableStart = (line, next) =>
  line.includes("|") && TABLE_DIVIDER.test(next ?? "");

const startsBlock = (line, next) =>
  FENCE.test(line) ||
  HEADING.test(line) ||
  LIST_ITEM.test(line) ||
  isTableStart(line, next);

// codeBlock(language, source) returns the nodes for a fenced block, or null
// to show it as code.
export function renderMarkdown(text, codeBlock) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const nodes = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const end = lines.findIndex((l, j) => j > i && /^```\s*$/.test(l));
      const close = end === -1 ? lines.length : end;
      const source = lines.slice(i + 1, close).join("\n");
      const code = el("pre", {}, el("code", { textContent: source }));
      nodes.push(...(codeBlock(fence[1], source) ?? [code]));
      i = close + 1;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      nodes.push(block(`h${heading[1].length}`, heading[2]));
      i++;
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const list = el(LIST_ITEM.exec(line)[1] ? "ol" : "ul");
      for (; i < lines.length && LIST_ITEM.test(lines[i]); i++) {
        list.append(block("li", LIST_ITEM.exec(lines[i])[2]));
      }
      nodes.push(list);
      continue;
    }
    if (isTableStart(line, lines[i + 1])) {
      const head = cells(line).map((cell) => block("th", cell));
      const rows = [];
      for (i += 2; i < lines.length && lines[i].includes("|"); i++) {
        rows.push(el("tr", {}, ...cells(lines[i]).map((c) => block("td", c))));
      }
      nodes.push(
        el(
          "table",
          {},
          el("thead", {}, el("tr", {}, ...head)),
          el("tbody", {}, ...rows),
        ),
      );
      continue;
    }
    const paragraph = [];
    for (; i < lines.length && lines[i].trim(); i++) {
      if (paragraph.length && startsBlock(lines[i], lines[i + 1])) break;
      paragraph.push(lines[i].trim());
    }
    nodes.push(block("p", paragraph.join(" ")));
  }
  return nodes;
}
