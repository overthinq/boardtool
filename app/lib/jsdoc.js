// Component API from JSDoc, with the tags of the Custom Elements Manifest
// analyzer, so the same comments can later produce a custom-elements.json.
// Shared by server and browser: no Node APIs.

const TAGS = {
  attr: "attributes",
  attribute: "attributes",
  slot: "slots",
  cssprop: "cssProperties",
  cssproperty: "cssProperties",
  fires: "events",
  event: "events",
};

// "@attr {string} heading - Title" → { kind, type, name, description }
function parseTag(line) {
  const [, kind, type = "", rest] = /^@(\w+)\s*(?:\{([^}]*)\})?\s*(.*)$/.exec(
    line,
  );
  const named = /^(\S*)\s*-\s+(.*)$/.exec(rest);
  const [name, description] = named ? [named[1], named[2]] : [rest, ""];
  return { kind, type, name, description };
}

// The first JSDoc block with an @element tag, or null.
export function parseComponent(source) {
  for (const [, block] of source.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
    const lines = block
      .split("\n")
      .map((line) => line.replace(/^\s*\*?\s*/, "").trimEnd());
    const component = {
      tag: "",
      description: "",
      attributes: [],
      slots: [],
      cssProperties: [],
      events: [],
    };
    let last = null;
    for (const line of lines) {
      if (!line.startsWith("@")) {
        // Text continues the description, or the tag above it.
        if (last) last.description = `${last.description} ${line}`.trim();
        else component.description = `${component.description} ${line}`.trim();
        continue;
      }
      const tag = parseTag(line);
      last = null;
      if (tag.kind === "element" || tag.kind === "tagname") {
        component.tag = tag.name;
      } else if (Object.hasOwn(TAGS, tag.kind)) {
        last = { name: tag.name, type: tag.type, description: tag.description };
        component[TAGS[tag.kind]].push(last);
      }
    }
    if (component.tag) return component;
  }
  return null;
}

// "- ds-card — heading:string, variant:default|raised, slot:default — Card."
export function catalogComponent(component) {
  const api = [
    ...component.attributes.map(({ name, type }) =>
      type ? `${name}:${type.replaceAll('"', "")}` : name,
    ),
    ...component.slots.map(({ name }) => `slot:${name || "default"}`),
    ...component.events.map(({ name }) => `event:${name}`),
  ];
  const summary = component.description.split(/(?<=\.)\s/)[0];
  return `- ${component.tag} — ${api.join(", ")} — ${summary}`;
}

// Global HTML attributes, which mean the same on every element, plus
// `align`: the one old presentational attribute that browsers still apply to
// custom elements (it aligns their text). ARIA ones change what assistive
// technology announces.
const RESERVED_ATTRIBUTES = [
  "accesskey",
  "align",
  "autocapitalize",
  "autofocus",
  "class",
  "contenteditable",
  "dir",
  "draggable",
  "enterkeyhint",
  "hidden",
  "id",
  "inert",
  "inputmode",
  "is",
  "itemprop",
  "lang",
  "nonce",
  "part",
  "popover",
  "role",
  "slot",
  "spellcheck",
  "style",
  "tabindex",
  "title",
  "translate",
];

export const reservedAttributes = (component) =>
  component.attributes
    .map(({ name }) => name)
    .filter(
      (name) => RESERVED_ATTRIBUTES.includes(name) || name.startsWith("aria-"),
    );
