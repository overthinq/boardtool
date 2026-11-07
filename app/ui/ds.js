const TIERS = {
  semantic: "Semantic",
  component: "Component",
  primitive: "Primitive",
};
const SAMPLE = "Aa Bb Cc 123";
const AA = 4.5;

const sections = document.querySelector("#sections");
const content = document.querySelector("#tokens");
const error = document.querySelector("#error");
const empty = document.querySelector("#empty");

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const note = (className, text) => el("p", { className, textContent: text });
const tokenLink = (name) => el("a", { href: `#${name}`, textContent: name });
const navItem = (id, label, ...children) =>
  el("li", {}, el("a", { href: `#${id}`, textContent: label }), ...children);

function linkList(label, names) {
  const item = el("p", {}, `${label} `);
  names.forEach((name, i) => item.append(i ? ", " : "", tokenLink(name)));
  return item;
}

const SWATCHES = {
  color(node, [main]) {
    node.style.background = main.value;
  },
  dimension(node, [main]) {
    node.style.width = main.value;
  },
  fontFamily(node, [main]) {
    node.textContent = SAMPLE;
    node.style.fontFamily = main.value;
  },
  fontWeight(node, [main]) {
    node.textContent = SAMPLE;
    node.style.fontWeight = main.value;
  },
  typography(node, [main, letterSpacing]) {
    node.textContent = SAMPLE;
    node.style.font = main.value;
    node.style.letterSpacing = letterSpacing.value;
  },
  shadow(node, [main]) {
    node.style.boxShadow = main.value;
  },
  border(node, [main]) {
    node.style.border = main.value;
  },
  strokeStyle(node, [main]) {
    node.style.borderTopStyle = main.value;
  },
  gradient(node, [main]) {
    node.style.background = `linear-gradient(to right, ${main.value})`;
  },
  duration(node, [main]) {
    node.style.setProperty("--motion", `${main.value} ease-in-out`);
  },
  cubicBezier(node, [main]) {
    node.style.setProperty("--motion", `1s ${main.value}`);
  },
  transition(node, [main]) {
    node.style.setProperty("--motion", main.value);
  },
};

function swatch(token) {
  const render = SWATCHES[token.type];
  if (!render) return "";
  const node = el("div", { className: `swatch swatch-${token.type}` });
  render(node, token.declarations);
  return node;
}

function row(token) {
  const [main, ...extras] = token.declarations;
  const about = el("td", {}, el("code", { textContent: token.name }));
  if (token.description) about.append(note("muted", token.description));
  if (token.deprecated) {
    const reason = token.deprecated === true ? "" : `: ${token.deprecated}`;
    about.append(note("deprecated", `Deprecated${reason}`));
  }
  const isColor = token.type === "color";
  const shown = isColor ? hex(main.value) : readable(main.value);
  const value = el("td", {}, el("code", { textContent: shown }));
  if (isColor && !main.value.startsWith("color(srgb ")) {
    value.append(note("muted", main.value));
  }
  for (const extra of extras) {
    const property = extra.name.slice(token.name.length + 1);
    const text = `${property}: ${readable(extra.value)}`;
    value.append(el("p", {}, el("code", { textContent: text })));
  }
  const relations = el("td");
  if (token.chain.length) {
    relations.append(linkList("→", token.chain));
  } else if (token.references.length) {
    relations.append(linkList("Uses", token.references));
  }
  if (token.usedBy.length) {
    relations.append(linkList("Used by", token.usedBy));
  } else if (token.tier === "primitive") {
    relations.append(note("muted", "Not used"));
  }
  const preview = el("td", {}, swatch(token));
  return el("tr", { id: token.name }, preview, about, value, relations);
}

function tokenTable(tokens) {
  const head = ["Preview", "Token", "Value", "Relations"].map((label) =>
    el("th", { scope: "col", textContent: label }),
  );
  return el(
    "table",
    { className: "tokens" },
    el("thead", {}, el("tr", {}, ...head)),
    el("tbody", {}, ...tokens.map(row)),
  );
}

// Canvas reads any CSS color back as sRGB, whatever its color space.
const canvas = document.createElement("canvas").getContext("2d", {
  willReadFrequently: true,
});

function toRgb(color) {
  canvas.clearRect(0, 0, 1, 1);
  canvas.fillStyle = color;
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
  return { rgb: [r, g, b], alpha: a / 255 };
}

function hex(color) {
  const { rgb, alpha } = toRgb(color);
  const channels = alpha < 1 ? [...rgb, Math.round(alpha * 255)] : rgb;
  return "#" + channels.map((c) => c.toString(16).padStart(2, "0")).join("");
}

// sRGB colors read as hex. Colors in other spaces keep their notation, which
// a hex could only approximate.
const SRGB = /color\(srgb [^)]*\)/g;
const readable = (css) => css.replace(SRGB, hex);

// WCAG 2 relative luminance.
function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(text, surface) {
  const background = toRgb(surface).rgb;
  const foreground = toRgb(text);
  const blended = foreground.rgb.map(
    (c, i) => c * foreground.alpha + background[i] * (1 - foreground.alpha),
  );
  const [light, dark] = [luminance(blended), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
}

function contrastCell(text, surface) {
  const [foreground, background] = [text, surface].map(
    (token) => token.declarations[0].value,
  );
  const ratio = contrast(foreground, background);
  const sample = el("span", { className: "sample", textContent: "Aa" });
  sample.style.color = foreground;
  sample.style.background = background;
  const cell = el("td", {}, sample, ` ${ratio.toFixed(2)}:1`);
  if (ratio < AA) cell.append(note("fail", "Fails AA"));
  return cell;
}

// Pairs come from the token names: semantic colors with a "text" segment on
// those with a "surface" segment.
function contrastTable(tokens) {
  const colors = tokens.filter(
    (token) => token.tier === "semantic" && token.type === "color",
  );
  const inGroup = (segment) =>
    colors.filter((token) => token.path.split(".").includes(segment));
  const texts = inGroup("text");
  const surfaces = inGroup("surface");
  if (!texts.length || !surfaces.length) return null;
  const head = surfaces.map((surface) =>
    el("th", { scope: "col" }, tokenLink(surface.name)),
  );
  const rows = texts.map((text) =>
    el(
      "tr",
      {},
      el("th", { scope: "row" }, tokenLink(text.name)),
      ...surfaces.map((surface) => contrastCell(text, surface)),
    ),
  );
  return el(
    "table",
    { className: "contrast" },
    el("thead", {}, el("tr", {}, el("td"), ...head)),
    el("tbody", {}, ...rows),
  );
}

function tierSection(tier, label, tokens) {
  const groups = Map.groupBy(
    tokens.filter((token) => token.tier === tier),
    (token) => token.path.split(".")[0],
  );
  if (!groups.size) return null;
  const heading = el("h2", { textContent: label });
  const section = el("section", { id: tier }, heading);
  const links = el("ul");
  const pairs = tier === "semantic" && contrastTable(tokens);
  if (pairs) {
    const title = el("h3", { id: "contrast", textContent: "Contrast" });
    section.append(title, pairs);
    links.append(navItem("contrast", "Contrast"));
  }
  for (const [group, members] of groups) {
    const id = `${tier}-${group}`;
    section.append(el("h3", { id, textContent: group }), tokenTable(members));
    links.append(navItem(id, group));
  }
  return { section, link: navItem(tier, label, links) };
}

function render({ tokens, error: message }) {
  error.hidden = !message;
  error.textContent = message
    ? `The token files have an error: this is the last valid version. ${message}`
    : "";
  empty.hidden = tokens.length > 0;
  const parts = Object.entries(TIERS)
    .map(([tier, label]) => tierSection(tier, label, tokens))
    .filter(Boolean);
  sections.replaceChildren(...parts.map((part) => part.link));
  content.replaceChildren(...parts.map((part) => part.section));
}

let isFirstLoad = true;

async function load() {
  const res = await fetch("/__api/ds");
  render(await res.json());
  // The content is built after the page loads, too late for the browser to
  // scroll to the anchor in the URL.
  if (isFirstLoad && location.hash) {
    const id = decodeURIComponent(location.hash.slice(1));
    document.getElementById(id)?.scrollIntoView();
  }
  isFirstLoad = false;
}

const events = new EventSource("/__api/events");
// Runs on the first connection and after every reconnection.
events.addEventListener("open", load);
events.addEventListener("tokens", load);
