import { el } from "./el.js";
import { renderMarkdown } from "./markdown.js";

const API_SECTIONS = {
  attributes: "Attributes",
  slots: "Slots",
  cssProperties: "CSS properties",
  events: "Events",
};

const nav = document.querySelector("#components");
const article = document.querySelector("#component");
const empty = document.querySelector("#empty");

let components = [];
let template = "";

const idOf = (component) => component.tag || component.folder;

// Examples render inside the board template, exactly as on a board.
function exampleDocument(html) {
  const doc = new DOMParser().parseFromString(template, "text/html");
  doc.querySelector("main").innerHTML = html;
  // Room for the example's edges and shadows, which a board would show.
  doc.body.style.padding = "16px";
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

function example(language, source) {
  if (language !== "html") return null;
  const frame = el("iframe", {
    className: "example",
    title: "Example",
    srcdoc: exampleDocument(source),
  });
  frame.addEventListener("load", () => {
    const root = frame.contentDocument.documentElement;
    // scrollHeight never drops below the frame height: measure the box.
    new ResizeObserver(() => {
      const height = Math.ceil(root.getBoundingClientRect().height);
      frame.style.height = `${height}px`;
    }).observe(root);
  });
  return [frame, el("pre", {}, el("code", { textContent: source }))];
}

function apiTable(entries, withType) {
  const columns = withType
    ? ["Name", "Type", "Description"]
    : ["Name", "Description"];
  const head = columns.map((label) =>
    el("th", { scope: "col", textContent: label }),
  );
  const rows = entries.map(({ name, type, description }) => {
    const cells = [el("code", { textContent: name || "(default)" })];
    if (withType) cells.push(el("code", { textContent: type }));
    cells.push(description);
    return el("tr", {}, ...cells.map((cell) => el("td", {}, cell)));
  });
  return el(
    "table",
    {},
    el("thead", {}, el("tr", {}, ...head)),
    el("tbody", {}, ...rows),
  );
}

function renderComponent(component) {
  const tag = el("code", { textContent: `<${idOf(component)}>` });
  article.replaceChildren(el("h1", {}, tag));
  if (component.error) {
    const error = { className: "fail", textContent: component.error };
    article.append(el("p", error));
  }
  if (component.description) {
    article.append(el("p", { textContent: component.description }));
  }
  article.append(...renderMarkdown(component.guide, example));
  if (!component.tag) return;
  article.append(el("h2", { textContent: "API" }));
  for (const [key, label] of Object.entries(API_SECTIONS)) {
    if (!component[key].length) continue;
    const table = apiTable(component[key], key === "attributes");
    article.append(el("h3", { textContent: label }), table);
  }
}

function showComponent() {
  const id = decodeURIComponent(location.hash.slice(1));
  const current =
    components.find((component) => idOf(component) === id) ?? components[0];
  empty.hidden = Boolean(current);
  if (!current) {
    article.replaceChildren();
    return;
  }
  for (const link of nav.querySelectorAll("a")) {
    const isCurrent = decodeURIComponent(link.hash.slice(1)) === idOf(current);
    link.ariaCurrent = isCurrent ? "page" : null;
  }
  renderComponent(current);
}

async function load() {
  const [ds, page] = await Promise.all([
    fetch("/__api/ds").then((res) => res.json()),
    fetch("/boards/_template.html").then((res) => res.text()),
  ]);
  components = ds.components;
  template = page;
  nav.replaceChildren(
    ...components.map((component) => {
      const id = idOf(component);
      const href = `#${encodeURIComponent(id)}`;
      return el("li", {}, el("a", { href, textContent: id }));
    }),
  );
  showComponent();
}

const events = new EventSource("/__api/events");
// Runs on the first connection and after every reconnection.
events.addEventListener("open", load);
events.addEventListener("catalog", load);
window.addEventListener("hashchange", showComponent);
