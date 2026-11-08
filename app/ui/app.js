import { el } from "./el.js";

const DRAG_TYPE = "application/x-boardtool-board";
const PREVIEW_SIZE_KEY = "boardtool:preview-size";

const nav = document.querySelector("#pages");
const grid = document.querySelector("#boards");
const empty = document.querySelector("#empty");
const statusLine = document.querySelector("#status");
const orphans = document.querySelector("#orphans");
const toolbar = document.querySelector("#toolbar");
const pageFrame = document.querySelector("#page-frame");
const filter = document.querySelector("#filter");
const previewSizes = document.querySelector("#preview-size");
const boardTemplate = document.querySelector("#board");
const boardDialog = document.querySelector("#board-dialog");
const pageDialog = document.querySelector("#page-dialog");
const tagsDialog = document.querySelector("#tags-dialog");

let pages = [];
// board.json: tags, notes and frames, written only through the server.
let data = { tags: [], pages: {}, boards: {} };
let tagFilter = null;
let previewSize = localStorage.getItem(PREVIEW_SIZE_KEY) ?? "large";

// app/config.json is edited by hand: say what is wrong instead of a blank
// page.
const config = await fetchJson("/__app/config.json").catch((err) => {
  statusLine.textContent = `app/config.json: ${err.message}`;
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

function updateData(change) {
  const next = structuredClone(data);
  change(next);
  return attempt(() => write("PUT", "/__api/board", next));
}

function moveBoard(from, to) {
  if (from.split("/")[0] === to) return;
  attempt(() => write("POST", "/__api/move", { from, to }));
}

const structure = (tree) =>
  tree
    .flatMap((page) => [page.dir, ...page.boards.map((board) => board.path)])
    .join("\n");

const boardUrl = (path) =>
  "/boards/" + path.split("/").map(encodeURIComponent).join("/");

const frameOfPage = (dir) => data.pages[dir]?.frame ?? config.frame;

const tagLabels = (ids = []) =>
  data.tags.filter((tag) => ids.includes(tag.id)).map((tag) => tag.label);

function currentPage() {
  const dir = decodeURIComponent(location.hash.slice(1));
  return pages.find((page) => page.dir === dir) ?? pages[0];
}

// Each page in the sidebar takes the boards dropped on it.
function pageLink(page) {
  const link = el("a", {
    href: `#${encodeURIComponent(page.dir)}`,
    textContent: page.name,
  });
  link.addEventListener("dragover", (event) => {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    link.classList.add("drop-target");
  });
  link.addEventListener("dragleave", () => {
    link.classList.remove("drop-target");
  });
  link.addEventListener("drop", (event) => {
    event.preventDefault();
    link.classList.remove("drop-target");
    moveBoard(event.dataTransfer.getData(DRAG_TYPE), page.dir);
  });
  return el("li", {}, link);
}

function renderNav() {
  nav.replaceChildren(...pages.map(pageLink));
}

// The wheel scrolls the board inside its preview; at either end it scrolls
// the index, so a preview never traps the wheel.
function scrollPreview(event, preview) {
  const view = preview.contentDocument?.scrollingElement;
  if (!view || !event.deltaY) return;
  // scrollTop can be fractional.
  const atEnd =
    event.deltaY < 0
      ? view.scrollTop <= 0
      : view.scrollHeight - view.clientHeight - view.scrollTop < 1;
  if (atEnd) return;
  event.preventDefault();
  const scale = preview.getBoundingClientRect().width / preview.offsetWidth;
  view.scrollBy({ top: event.deltaY / scale, behavior: "instant" });
}

function boardCard(board, page) {
  const card = boardTemplate.content.firstElementChild.cloneNode(true);
  const meta = data.boards[board.path] ?? {};
  const frame = meta.frame ?? frameOfPage(page.dir);
  card.style.setProperty("--frame-width", frame.width);
  card.style.setProperty("--frame-height", frame.height);
  const preview = card.querySelector("iframe");
  preview.src = boardUrl(board.path);
  preview.dataset.path = board.path;
  // Without a scrollbar the board is laid out at its full frame width.
  preview.addEventListener("load", () => {
    preview.contentDocument.documentElement.style.scrollbarWidth = "none";
  });
  card.addEventListener("wheel", (event) => scrollPreview(event, preview), {
    passive: false,
  });
  const link = card.querySelector("a");
  link.href = boardUrl(board.path);
  link.textContent = board.name;
  card.querySelector(".tags").textContent = tagLabels(meta.tags).join(", ");
  card.querySelector(".note").textContent = meta.note ?? "";
  const edit = card.querySelector(".edit");
  edit.ariaLabel = `Edit ${board.name}`;
  edit.addEventListener("click", () => openBoardDialog(board, page));
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData(DRAG_TYPE, board.path);
  });
  return card;
}

function orphanItem(path, freeBoards) {
  const item = el("li", {}, "Metadata for ", el("code", { textContent: path }));
  item.append(" has no board. ");
  if (freeBoards.length) {
    // Boards of the same page come first: a rename usually stays in its page.
    // No board is preselected, a wrong guess would move the metadata.
    const inPage = (board) => board.startsWith(`${path.split("/")[0]}/`);
    const samePageFirst = [
      ...freeBoards.filter(inPage),
      ...freeBoards.filter((board) => !inPage(board)),
    ];
    const options = samePageFirst.map((free) =>
      el("option", { value: free, textContent: free }),
    );
    const choose = el("option", { value: "", textContent: "Choose a board…" });
    const target = el("select", { ariaLabel: "Board" }, choose, ...options);
    const reassign = el("button", { type: "button", textContent: "Reassign" });
    reassign.addEventListener("click", () => {
      if (!target.value) return target.focus();
      updateData((next) => {
        next.boards[target.value] = next.boards[path];
        delete next.boards[path];
      });
    });
    item.append(target, " ", reassign, " ");
  }
  const discard = el("button", { type: "button", textContent: "Discard" });
  discard.addEventListener("click", () =>
    updateData((next) => {
      delete next.boards[path];
    }),
  );
  item.append(discard);
  return item;
}

// Metadata whose board was renamed or deleted outside the tool.
function renderOrphans() {
  const paths = pages.flatMap((page) => page.boards.map((board) => board.path));
  const lost = Object.keys(data.boards).filter((path) => !paths.includes(path));
  const free = paths.filter((path) => !Object.hasOwn(data.boards, path));
  orphans.hidden = lost.length === 0;
  orphans.replaceChildren(...lost.map((path) => orphanItem(path, free)));
}

function renderToolbar(page) {
  const frame = frameOfPage(page.dir);
  pageFrame.textContent = `Frame ${frame.width} × ${frame.height}`;
  if (!data.tags.some((tag) => tag.id === tagFilter)) tagFilter = null;
  const choices = [{ id: null, label: "All" }, ...data.tags];
  filter.replaceChildren(
    ...choices.map((tag) => {
      const button = el("button", { type: "button", textContent: tag.label });
      button.ariaPressed = String(tag.id === tagFilter);
      button.addEventListener("click", () => {
        tagFilter = tag.id;
        showPage();
      });
      return button;
    }),
  );
}

function showPage() {
  const page = currentPage();
  for (const link of nav.querySelectorAll("a")) {
    const isCurrent = decodeURIComponent(link.hash.slice(1)) === page?.dir;
    link.ariaCurrent = isCurrent ? "page" : null;
  }
  renderOrphans();
  toolbar.hidden = !page;
  if (page) renderToolbar(page);
  const boards = (page?.boards ?? []).filter(
    (board) =>
      !tagFilter || data.boards[board.path]?.tags?.includes(tagFilter),
  );
  grid.replaceChildren(...boards.map((board) => boardCard(board, page)));
  empty.hidden = (page?.boards.length ?? 0) > 0;
}

// A dialog saves when closed by its Save button; Esc and Cancel discard.
function openDialog(dialog, onSave) {
  dialog.returnValue = "";
  dialog.onclose = () => {
    if (dialog.returnValue === "save") onSave(dialog.querySelector("form"));
  };
  dialog.showModal();
}

function openBoardDialog(board, page) {
  const meta = data.boards[board.path] ?? {};
  const fields = boardDialog.querySelector("form").elements;
  const pageSize = frameOfPage(page.dir);
  boardDialog.querySelector("h2").textContent = `Edit ${board.name}`;
  boardDialog.querySelector(".tag-choices").replaceChildren(
    ...data.tags.map((tag) => {
      const checked = meta.tags?.includes(tag.id) ?? false;
      const box = el("input", { type: "checkbox", value: tag.id, checked });
      return el("label", {}, box, ` ${tag.label}`);
    }),
  );
  fields.note.value = meta.note ?? "";
  fields.width.value = meta.frame?.width ?? "";
  fields.height.value = meta.frame?.height ?? "";
  fields.width.placeholder = pageSize.width;
  fields.height.placeholder = pageSize.height;
  fields.page.replaceChildren(
    ...pages.map((option) =>
      el("option", {
        value: option.dir,
        textContent: option.name,
        selected: option === page,
      }),
    ),
  );
  openDialog(boardDialog, (form) => {
    const entry = {};
    const tags = [...form.querySelectorAll(".tag-choices input:checked")];
    if (tags.length) entry.tags = tags.map((box) => box.value);
    const note = fields.note.value.trim();
    if (note) entry.note = note;
    if (fields.width.value || fields.height.value) {
      entry.frame = {
        width: Number(fields.width.value) || pageSize.width,
        height: Number(fields.height.value) || pageSize.height,
      };
    }
    const to = fields.page.value;
    attempt(async () => {
      const next = structuredClone(data);
      if (Object.keys(entry).length) next.boards[board.path] = entry;
      else delete next.boards[board.path];
      await write("PUT", "/__api/board", next);
      if (to !== page.dir) {
        await write("POST", "/__api/move", { from: board.path, to });
      }
    });
  });
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
      next.pages[page.dir] = { ...next.pages[page.dir], frame };
    }),
  );
}

function tagRow(tag) {
  const name = el("input", { value: tag.label, required: true });
  name.ariaLabel = "Tag name";
  name.dataset.id = tag.id;
  const remove = el("button", { type: "button", textContent: "Remove" });
  const row = el("li", {}, name, " ", remove);
  remove.addEventListener("click", () => row.remove());
  return row;
}

// "In review" → "in-review", unique among the ids in use.
function newTagId(label, taken) {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tag";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
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

// Previews keep their width while it fits, then shrink with the window.
// Narrower boards keep their own width (app.css).
function fitPreviews() {
  const width = config.previews[previewSize];
  // 2: the border of the preview.
  grid.style.setProperty("--card", Math.min(width, grid.clientWidth - 2));
}

function renderPreviewSize() {
  for (const button of previewSizes.querySelectorAll("button")) {
    button.ariaPressed = String(button.value === previewSize);
  }
  fitPreviews();
}

previewSizes.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  previewSize = button.value;
  localStorage.setItem(PREVIEW_SIZE_KEY, previewSize);
  renderPreviewSize();
});
renderPreviewSize();
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
// Runs on the first connection and after every reconnection, when files may
// have changed while the server was down.
events.addEventListener("open", load);
events.addEventListener("board", onBoardChange);
// A move changes board.json and the tree together: reload both.
events.addEventListener("metadata", load);
events.addEventListener("ds", () => {
  for (const frame of grid.querySelectorAll("iframe")) reload(frame);
});
window.addEventListener("hashchange", showPage);
