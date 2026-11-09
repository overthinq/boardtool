import { el } from "./el.js";
import { newTagId } from "./lib/tags.js";
import "./sidebar.js";

const COLUMNS_KEY = "boardtool:columns";

const nav = document.querySelector("#pages");
const grid = document.querySelector("#boards");
const empty = document.querySelector("#empty");
const statusLine = document.querySelector("#status");
const toolbar = document.querySelector("#toolbar");
const pageFrame = document.querySelector("#page-frame");
const filter = document.querySelector("#filter");
const columnControls = document.querySelector("#columns");
const boardTemplate = document.querySelector("#board");
const frameDialog = document.querySelector("#frame-dialog");
const boardTagsDialog = document.querySelector("#board-tags-dialog");
const pageDialog = document.querySelector("#page-dialog");
const noteDialog = document.querySelector("#note-dialog");
const tagsDialog = document.querySelector("#tags-dialog");

const search = document.querySelector("#board-search");
const filterBar = document.querySelector("#filter-bar");
const filterToggle = document.querySelector("#toggle-filter");
const inputToggle = document.querySelector("#forward-input");
let forwardInput = false;
let filtersVisible = false;
let preset = null;
let pageDir;
let pages = [];
// board.json: tags, notes and frames, written only through the server.
let data = { tags: [], pages: {}, boards: {} };
// Selected tags: a board shows when it has any of them; none shows all.
const tagFilters = new Set();
let columns = localStorage.getItem(COLUMNS_KEY) === "3" ? 3 : 2;

// config.json is edited by hand: say what is wrong instead of a blank page.
const config = await fetch("/__app/config.json")
  .then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  })
  .catch((err) => {
    statusLine.textContent = err.message;
    statusLine.hidden = false;
    throw err;
  });

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function write(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}

// The page shows what the server sends back through its events, so a failed
// write only needs a message.
async function attempt(action) {
  statusLine.hidden = true;
  try {
    await action();
  } catch (err) {
    statusLine.textContent = `Not saved: ${err.message}`;
    statusLine.hidden = false;
  }
}

// Metadata is tied to a board's path: a board moved, renamed or deleted
// outside the tool loses it with the next save.
function updateData(change) {
  const next = structuredClone(data);
  const paths = new Set(
    pages.flatMap((page) => page.boards.map((board) => board.path)),
  );
  for (const path of Object.keys(next.boards)) {
    if (!paths.has(path)) delete next.boards[path];
  }
  change(next);
  return attempt(() => write("PUT", "/__api/board", next));
}

// Changes the metadata of one board; an empty entry is removed.
function updateEntry(path, change) {
  return updateData((next) => {
    const entry = { ...next.boards[path] };
    change(entry);
    if (Object.keys(entry).length) next.boards[path] = entry;
    else delete next.boards[path];
  });
}

const structure = (tree) =>
  tree
    .flatMap((page) => [page.dir, ...page.boards.map((board) => board.path)])
    .join("\n");

const boardUrl = (path) =>
  "/boards/" + path.split("/").map(encodeURIComponent).join("/");

const frameOfPage = (dir) => data.pages[dir]?.frame ?? config.frame;

const tagsOf = (ids = []) => data.tags.filter((tag) => ids.includes(tag.id));

function currentPage() {
  const dir = decodeURIComponent(location.hash.slice(1));
  return pages.find((page) => page.dir === dir) ?? pages[0];
}

function pageLink(page) {
  const link = el("a", {
    href: `#${encodeURIComponent(page.dir)}`,
    textContent: page.name,
  });
  return el("li", {}, link);
}

function renderNav() {
  nav.replaceChildren(...pages.map(pageLink));
}

// Keep the wheel inside a board, including at the ends of its content.
function scrollPreview(event, preview) {
  if (event.ctrlKey) return;
  event.preventDefault();
  const view = preview.contentDocument?.scrollingElement;
  if (!view) return;
  const scale = preview.getBoundingClientRect().width / preview.offsetWidth;
  view.scrollBy({
    top: event.deltaY / scale,
    left: event.deltaX / scale,
    behavior: "instant",
  });
}

function boardCard(board, page) {
  const card = boardTemplate.content.firstElementChild.cloneNode(true);
  const meta = data.boards[board.path] ?? {};
  const frame = preset ?? meta.frame ?? frameOfPage(page.dir);
  card.style.setProperty("--frame-width", frame.width);
  card.style.setProperty("--frame-height", frame.height);
  const preview = card.querySelector("iframe");
  preview.inert = !forwardInput;
  preview.src = boardUrl(board.path);
  preview.dataset.path = board.path;
  // Without a scrollbar the board is laid out at its full frame width.
  preview.addEventListener("load", () => {
    const doc = preview.contentDocument;
    if (!doc) return;
    doc.documentElement.style.scrollbarWidth = "none";
    doc.documentElement.style.overscrollBehavior = "contain";
    if (doc.body) doc.body.style.overscrollBehavior = "contain";
  });
  card.addEventListener("wheel", (event) => scrollPreview(event, preview), {
    passive: false,
  });
  const link = card.querySelector("a");
  link.href = boardUrl(board.path);
  link.textContent = board.name;
  const tags = tagsOf(meta.tags);
  card.querySelector(".board-tags").hidden = tags.length === 0;
  card.querySelector(".tag-summary").textContent = tags[0]?.label ?? "";
  card.querySelector(".tags").replaceChildren(
    ...tags.map((tag) =>
      el("li", { className: "pill", textContent: tag.label }),
    ),
  );
  card.querySelector(".note").textContent = meta.note ?? "";
  const actions = [
    [".frame-button", "Override frame of", () => openFrameDialog(board, page)],
    [".note-button", "Edit note of", () => openNoteDialog(board)],
    [".tags-button", "Edit tags of", () => openBoardTagsDialog(board)],
  ];
  for (const [selector, label, open] of actions) {
    const button = card.querySelector(selector);
    button.ariaLabel = `${label} ${board.name}`;
    button.addEventListener("click", open);
  }
  return card;
}

function renderToolbar(page) {
  const frame = frameOfPage(page.dir);
  pageFrame.textContent = `${frame.width} × ${frame.height}`;
  document.querySelector("#edit-page").ariaPressed = String(!preset);
  document.querySelector("#breakpoints").replaceChildren(...config.breakpoints.map((item) => {
    const button = el("button", { type: "button", title: `${item.label} ${item.width} × ${item.height}` });
    button.ariaLabel = button.title;
    button.ariaPressed = String(preset === item);
    button.append(el("span", { className: `icon icon-${item.icon}` }));
    if (preset === item) button.append(`${item.width} × ${item.height}`);
    button.addEventListener("click", () => { preset = item; showPage(); });
    return button;
  }));
  for (const id of tagFilters) {
    if (!data.tags.some((tag) => tag.id === id)) tagFilters.delete(id);
  }
  const all = el("button", {
    type: "button",
    className: "pill",
    textContent: "All",
  });
  all.ariaPressed = String(tagFilters.size === 0);
  all.addEventListener("click", () => {
    tagFilters.clear();
    showPage();
  });
  const tags = data.tags.map((tag) => {
    const button = el("button", {
      type: "button",
      className: "pill",
      textContent: tag.label,
    });
    button.ariaPressed = String(tagFilters.has(tag.id));
    button.addEventListener("click", () => {
      if (!tagFilters.delete(tag.id)) tagFilters.add(tag.id);
      showPage();
    });
    return button;
  });
  filter.replaceChildren(all, ...tags);
}

function showPage() {
  const page = currentPage();
  for (const link of nav.querySelectorAll("a")) {
    const isCurrent = decodeURIComponent(link.hash.slice(1)) === page?.dir;
    link.ariaCurrent = isCurrent ? "page" : null;
  }
  if (pageDir !== page?.dir) preset = null;
  pageDir = page?.dir;
  for (const control of toolbar.querySelectorAll("[data-page-tools]")) {
    control.hidden = !page;
  }
  filterToggle.hidden = !page;
  filterBar.hidden = !page || !filtersVisible;
  filterToggle.ariaExpanded = String(!filterBar.hidden);
  filterToggle.ariaPressed = String(!filterBar.hidden);
  if (page) renderToolbar(page);
  const boards = (page?.boards ?? []).filter(
    (board) =>
      !filtersVisible || (
        board.name.toLowerCase().includes(search.value.trim().toLowerCase()) &&
        (tagFilters.size === 0 || data.boards[board.path]?.tags?.some((id) => tagFilters.has(id)))
      ),
  );
  grid.replaceChildren(...boards.map((board) => boardCard(board, page)));
  empty.hidden = (page?.boards.length ?? 0) > 0;
  document.querySelector("#no-results").hidden = !page?.boards.length || boards.length > 0;
}

// A dialog saves when closed by its Save button; Esc and Cancel discard.
function openDialog(dialog, onSave) {
  dialog.returnValue = "";
  dialog.onclose = () => {
    if (dialog.returnValue === "save") onSave(dialog.querySelector("form"));
  };
  dialog.showModal();
}

function openFrameDialog(board, page) {
  const meta = data.boards[board.path] ?? {};
  const fields = frameDialog.querySelector("form").elements;
  const pageSize = frameOfPage(page.dir);
  frameDialog.querySelector("h2").textContent = `Frame override · ${board.name}`;
  fields.width.value = meta.frame?.width ?? "";
  fields.height.value = meta.frame?.height ?? "";
  fields.width.placeholder = pageSize.width;
  fields.height.placeholder = pageSize.height;
  openDialog(frameDialog, () =>
    updateEntry(board.path, (entry) => {
      if (!fields.width.value && !fields.height.value) {
        delete entry.frame;
        return;
      }
      entry.frame = {
        width: Number(fields.width.value) || pageSize.width,
        height: Number(fields.height.value) || pageSize.height,
      };
    }),
  );
}

function openBoardTagsDialog(board) {
  const meta = data.boards[board.path] ?? {};
  const choices = boardTagsDialog.querySelector(".tag-choices");
  boardTagsDialog.querySelector("h2").textContent = `Tags of ${board.name}`;
  choices.replaceChildren(
    ...data.tags.map((tag) => {
      const button = el("button", {
        type: "button", className: "pill", value: tag.id, textContent: tag.label,
      });
      button.ariaPressed = String(meta.tags?.includes(tag.id) ?? false);
      button.addEventListener("click", () => {
        button.ariaPressed = String(button.ariaPressed !== "true");
      });
      return button;
    }),
  );
  openDialog(boardTagsDialog, () =>
    updateEntry(board.path, (entry) => {
      const selected = [...choices.querySelectorAll('button[aria-pressed="true"]')];
      if (selected.length) entry.tags = selected.map((button) => button.value);
      else delete entry.tags;
    }),
  );
}

function openNoteDialog(board) {
  const field = noteDialog.querySelector("textarea");
  noteDialog.querySelector("h2").textContent = `Note on ${board.name}`;
  field.value = data.boards[board.path]?.note ?? "";
  openDialog(noteDialog, () =>
    updateEntry(board.path, (entry) => {
      const note = field.value.trim();
      if (note) entry.note = note;
      else delete entry.note;
    }),
  );
}

function openPageDialog(page) {
  const fields = pageDialog.querySelector("form").elements;
  const frame = frameOfPage(page.dir);
  pageDialog.querySelector("h2").textContent = `Frame of ${page.name}`;
  fields.width.value = frame.width;
  fields.height.value = frame.height;
  openDialog(pageDialog, () =>
    updateData((next) => {
      const width = Number(fields.width.value);
      const height = Number(fields.height.value);
      const frame = { width, height };
      preset = null;
      next.pages[page.dir] = { ...next.pages[page.dir], frame };
    }),
  );
}

function tagRow(tag) {
  const name = el("input", { value: tag.label, required: true });
  name.ariaLabel = "Tag name";
  name.dataset.id = tag.id;
  const remove = el("button", {
    type: "button", className: "remove-tag", title: "Remove tag", ariaLabel: "Remove tag",
  }, el("span", { className: "icon icon-trash", ariaHidden: "true" }));
  const row = el("li", {}, name, " ", remove);
  remove.addEventListener("click", () => row.remove());
  return row;
}

function openTagsDialog() {
  const list = tagsDialog.querySelector(".tag-list");
  list.replaceChildren(...data.tags.map(tagRow));
  openDialog(tagsDialog, () => {
    const names = [...list.querySelectorAll("input")];
    const taken = new Set(names.map((name) => name.dataset.id).filter(Boolean));
    const tags = names.map((name) => ({
      id: name.dataset.id || newTagId(name.value, taken),
      label: name.value.trim(),
    }));
    const kept = new Set(tags.map((tag) => tag.id));
    updateData((next) => {
      next.tags = tags;
      for (const entry of Object.values(next.boards)) {
        entry.tags = entry.tags?.filter((id) => kept.has(id));
        if (!entry.tags?.length) delete entry.tags;
      }
    });
  });
}

function fitPreviews() {
  const available = grid.clientWidth;
  const effective = Math.min(columns, Math.max(1, Math.floor((available + 24) / 304)));
  const edges = 2;
  grid.style.setProperty("--columns", effective);
  grid.style.setProperty("--card", Math.max(1, (available - (effective - 1) * 24) / effective - edges));
  for (const button of columnControls.querySelectorAll("button")) {
    button.ariaPressed = String(Number(button.value) === columns);
    button.title = `${button.value} columns`;
    if (Number(button.value) === columns && effective !== columns) {
      button.title += ` (${effective} currently shown)`;
    }
  }
}

columnControls.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  columns = Number(button.value);
  localStorage.setItem(COLUMNS_KEY, columns);
  fitPreviews();
});
fitPreviews();
new ResizeObserver(fitPreviews).observe(grid);

tagsDialog.querySelector(".add-tag").addEventListener("click", () => {
  const row = tagRow({ id: "", label: "" });
  tagsDialog.querySelector(".tag-list").append(row);
  row.querySelector("input").focus();
});
document.querySelector("#edit-page").addEventListener("click", () => {
  openPageDialog(currentPage());
});
document.querySelector("#edit-tags").addEventListener("click", openTagsDialog);

async function load() {
  [pages, data] = await Promise.all([
    fetchJson("/__api/tree"),
    fetchJson("/__api/board"),
  ]);
  renderNav();
  showPage();
}

function reload(frame) {
  // Reassigning src reloads the frame, also before a lazy frame has loaded.
  frame.src = frame.src;
}

async function onBoardChange({ data: path }) {
  const tree = await fetchJson("/__api/tree");
  if (structure(tree) !== structure(pages)) {
    pages = tree;
    renderNav();
    showPage();
    return;
  }
  for (const frame of grid.querySelectorAll("iframe")) {
    if (frame.dataset.path === path) reload(frame);
  }
}

const events = new EventSource("/__api/events");
// Reconnecting means the server restarted, maybe with a newer tool: reload
// the whole page, not only the data.
let hasConnected = false;
events.addEventListener("open", () => {
  if (hasConnected) return location.reload();
  hasConnected = true;
  load();
});
events.addEventListener("board", onBoardChange);
events.addEventListener("metadata", load);
events.addEventListener("ds", () => {
  for (const frame of grid.querySelectorAll("iframe")) reload(frame);
});
window.addEventListener("hashchange", showPage);

search.addEventListener("input", showPage);
filterToggle.addEventListener("click", () => {
  filtersVisible = !filtersVisible;
  showPage();
});
for (const dialog of document.querySelectorAll("dialog")) {
  let startedOutside = false;
  const outside = (event) => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener("pointerdown", (event) => {
    startedOutside = event.target === dialog && outside(event);
  });
  dialog.addEventListener("pointerup", (event) => {
    if (startedOutside && event.target === dialog && outside(event)) dialog.close("cancel");
    startedOutside = false;
  });
  dialog.querySelector('[value="cancel"]').addEventListener("click", () => dialog.close("cancel"));
}

inputToggle.addEventListener("click", () => {
  forwardInput = !forwardInput;
  inputToggle.ariaPressed = String(forwardInput);
  document.body.classList.toggle("forward-input", forwardInput);
  for (const preview of grid.querySelectorAll("iframe")) {
    preview.inert = !forwardInput;
  }
});
