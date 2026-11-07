const FRAME = { width: 1440, height: 900 };
const PREVIEW_WIDTH = 320;

const nav = document.querySelector("#pages");
const grid = document.querySelector("#boards");
const empty = document.querySelector("#empty");
const boardTemplate = document.querySelector("#board");

let pages = [];

async function fetchTree() {
  const res = await fetch("/__api/tree");
  return res.json();
}

const structure = (tree) =>
  tree
    .flatMap((page) => [page.dir, ...page.boards.map((board) => board.path)])
    .join("\n");

const boardUrl = (path) =>
  "/boards/" + path.split("/").map(encodeURIComponent).join("/");

function renderNav() {
  nav.replaceChildren(
    ...pages.map((page) => {
      const link = document.createElement("a");
      link.href = "#" + encodeURIComponent(page.dir);
      link.textContent = page.name;
      const item = document.createElement("li");
      item.append(link);
      return item;
    }),
  );
}

function boardCard(board) {
  const card = boardTemplate.content.firstElementChild.cloneNode(true);
  card.style.setProperty("--width", `${FRAME.width}px`);
  card.style.setProperty("--height", `${FRAME.height}px`);
  card.style.setProperty("--scale", PREVIEW_WIDTH / FRAME.width);
  const frame = card.querySelector("iframe");
  frame.src = boardUrl(board.path);
  frame.dataset.path = board.path;
  const link = card.querySelector("a");
  link.href = boardUrl(board.path);
  link.textContent = board.name;
  return card;
}

function showPage() {
  const dir = decodeURIComponent(location.hash.slice(1));
  const page = pages.find((candidate) => candidate.dir === dir) ?? pages[0];
  for (const link of nav.querySelectorAll("a")) {
    const isCurrent = decodeURIComponent(link.hash.slice(1)) === page?.dir;
    link.ariaCurrent = isCurrent ? "page" : null;
  }
  const boards = page?.boards ?? [];
  grid.replaceChildren(...boards.map(boardCard));
  empty.hidden = boards.length > 0;
}

async function load() {
  pages = await fetchTree();
  renderNav();
  showPage();
}

function reload(frame) {
  // Reassigning src reloads the frame, also before a lazy frame has loaded.
  frame.src = frame.src;
}

async function onBoardChange({ data: path }) {
  const tree = await fetchTree();
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
events.addEventListener("ds", () => {
  for (const frame of grid.querySelectorAll("iframe")) reload(frame);
});
window.addEventListener("hashchange", showPage);
