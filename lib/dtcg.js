// DTCG 2025.10 token files → CSS custom properties.
// https://www.designtokens.org/tr/2025.10/format/
// Shared by server and browser: no Node APIs.

export const TIERS = ["primitive", "semantic", "component"];

const CURLY = /^\{([^{}]+)\}$/;
const CSS_COLOR_FUNCTIONS = ["hsl", "hwb", "lab", "lch", "oklab", "oklch"];
const CSS_COLOR_SPACES = [
  "srgb",
  "srgb-linear",
  "display-p3",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
  "xyz-d65",
  "xyz-d50",
];
const FONT_WEIGHTS = new Map(
  Object.entries({
    thin: 100,
    hairline: 100,
    "extra-light": 200,
    "ultra-light": 200,
    light: 300,
    normal: 400,
    regular: 400,
    book: 400,
    medium: 500,
    "semi-bold": 600,
    "demi-bold": 600,
    bold: 700,
    "extra-bold": 800,
    "ultra-bold": 800,
    black: 900,
    heavy: 900,
    "extra-black": 950,
    "ultra-black": 950,
  }),
);
const STROKE_STYLES = [
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "outset",
  "inset",
];
const LINE_CAPS = ["round", "butt", "square"];
const GENERIC_FONT_FAMILIES = [
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
];

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isToken = (node) =>
  Object.hasOwn(node, "$value") || Object.hasOwn(node, "$ref");

function fail(where, message) {
  throw new Error(`${where}: ${message}`);
}

const invalid = (ctx, type) => fail(ctx.where, `invalid ${type} value`);

// "color.accent.$root" → "--color-accent"
const cssName = (segments) =>
  "--" +
  segments
    .filter((segment) => segment !== "$root")
    .join("-")
    .replace(/[^\p{L}\p{N}_-]/gu, "-");

// Tokens and groups of a group; other $-prefixed keys are group properties.
function childEntries(group, path) {
  const entries = [];
  for (const [key, node] of Object.entries(group)) {
    if (key.startsWith("$") && key !== "$root") continue;
    const where = [...path, key].join(".");
    if (/[{}.]/.test(key)) fail(where, "names cannot contain {, } or .");
    if (!isObject(node)) fail(where, "is neither a token nor a group");
    entries.push([key, node]);
  }
  return entries;
}

function markTier(node, tier, tiers, path) {
  tiers.set(node, tier);
  if (isToken(node)) return;
  for (const [key, child] of childEntries(node, path)) {
    markTier(child, tier, tiers, [...path, key]);
  }
}

function mergeGroup(target, source, path, file) {
  for (const [key, node] of Object.entries(source)) {
    const where = `${file}: ${[...path, key].join(".")}`;
    if (!Object.hasOwn(target, key)) {
      target[key] = node;
    } else if (key === "$type" && target.$type !== node) {
      fail(where, `conflicts with $type "${target.$type}" in another file`);
    } else if (key.startsWith("$") && key !== "$root") {
      target[key] = node;
    } else if (isToken(node) || isToken(target[key])) {
      fail(where, "is defined in more than one file");
    } else {
      mergeGroup(target[key], node, [...path, key], file);
    }
  }
}

// Walks groups, and arrays too for JSON Pointers into values.
function lookup(root, segments) {
  let node = root;
  for (const segment of segments) {
    if (typeof node !== "object" || node === null) return undefined;
    if (!Object.hasOwn(node, segment)) return undefined;
    node = node[segment];
  }
  return node;
}

// Deep merge where the extending group wins: its tokens replace inherited
// tokens entirely. Inherited tokens belong to the tier of the extending group.
function inherit(group, base, tier, tiers) {
  for (const [key, node] of Object.entries(base)) {
    if (!Object.hasOwn(group, key)) {
      group[key] = structuredClone(node);
      if (isObject(node)) markTier(group[key], tier, tiers, []);
    } else if (
      isObject(node) &&
      !isToken(node) &&
      isObject(group[key]) &&
      !isToken(group[key])
    ) {
      inherit(group[key], node, tier, tiers);
    }
  }
}

function expandExtends(root, tiers) {
  const expanded = new Set();
  const expanding = new Set();
  const expand = (group, path) => {
    if (expanded.has(group)) return;
    if (expanding.has(group)) fail(path.join("."), "circular $extends");
    expanding.add(group);
    if (Object.hasOwn(group, "$extends")) {
      const basePath = CURLY.exec(group.$extends)?.[1].split(".");
      const base = basePath && lookup(root, basePath);
      if (!isObject(base) || isToken(base)) {
        const target = group.$extends;
        fail(path.join("."), `$extends must reference a group: ${target}`);
      }
      expand(base, basePath);
      inherit(group, base, tiers.get(group), tiers);
      delete group.$extends;
    }
    for (const [key, child] of childEntries(group, path)) {
      if (!isToken(child)) expand(child, [...path, key]);
    }
    expanding.delete(group);
    expanded.add(group);
  };
  expand(root, []);
}

function flatten(group, path, inherited, tiers, tokens) {
  const type = group.$type ?? inherited.type;
  const deprecated = group.$deprecated ?? inherited.deprecated;
  for (const [key, node] of childEntries(group, path)) {
    const segments = [...path, key];
    if (!isToken(node)) {
      flatten(node, segments, { type, deprecated }, tiers, tokens);
      continue;
    }
    if (Object.keys(node).some((name) => !name.startsWith("$"))) {
      fail(segments.join("."), "a token cannot contain tokens or groups");
    }
    tokens.push({
      path: segments.join("."),
      name: cssName(segments),
      tier: tiers.get(node),
      description: node.$description ?? "",
      deprecated: node.$deprecated ?? deprecated,
      ownType: node.$type,
      groupType: type,
      value: Object.hasOwn(node, "$value") ? node.$value : { $ref: node.$ref },
      references: new Set(),
    });
  }
}

// { token } for a reference to a whole token, { value } for a JSON Pointer
// into a value, null for anything else.
function reference(value, ctx) {
  if (typeof value === "string") {
    const match = CURLY.exec(value);
    if (!match) return null;
    const token = ctx.index.get(match[1]);
    if (!token) fail(ctx.where, `${value} does not reference a token`);
    return { token };
  }
  if (!isObject(value) || !Object.hasOwn(value, "$ref")) return null;
  return pointer(value.$ref, ctx);
}

function pointer(ref, ctx) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    fail(ctx.where, `only references within the token files work: ${ref}`);
  }
  const segments = ref
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  const valueAt = segments.indexOf("$value");
  const tokenPath = valueAt === -1 ? segments : segments.slice(0, valueAt);
  const token = ctx.index.get(tokenPath.join("."));
  if (!token) fail(ctx.where, `${ref} does not reference a token`);
  const inside = valueAt === -1 ? [] : segments.slice(valueAt + 1);
  if (inside.length === 0) return { token };
  const value = lookup(concrete(token.value, ctx), inside);
  if (value === undefined) fail(ctx.where, `${ref} does not exist`);
  return { value };
}

// Follows JSON Pointers into values until a literal or a whole-token reference.
function resolve(value, ctx) {
  const seen = new Set();
  for (;;) {
    const ref = reference(value, ctx);
    if (!ref) return { value };
    if (ref.token) return ref;
    if (seen.has(ref.value)) fail(ctx.where, "circular $ref");
    seen.add(ref.value);
    value = ref.value;
  }
}

// The literal behind a value, following every reference.
function concrete(value, ctx) {
  const resolved = resolve(value, ctx);
  return resolved.token ? concrete(resolved.token.value, ctx) : resolved.value;
}

// For parts that are not tokens on their own, like color components.
function literal(value, ctx) {
  const resolved = resolve(value, ctx);
  if (resolved.token) {
    fail(ctx.where, `${resolved.token.path} can only replace a whole value`);
  }
  return resolved.value;
}

function resolveType(token, index, chain = []) {
  if (token.type) return token.type;
  if (chain.includes(token)) {
    const cycle = [...chain, token].map((link) => link.path).join(" → ");
    fail(token.path, `circular reference: ${cycle}`);
  }
  const target = resolve(token.value, { index, where: token.path }).token;
  const targetType = target && resolveType(target, index, [...chain, token]);
  if (token.ownType && targetType && token.ownType !== targetType) {
    const types = `${token.ownType}, ${target.path} is a ${targetType}`;
    fail(token.path, `is a ${types}`);
  }
  token.type = token.ownType ?? targetType ?? token.groupType;
  if (!token.type) fail(token.path, "has no $type");
  if (!Object.hasOwn(FORMATS, token.type)) {
    fail(token.path, `unknown $type "${token.type}"`);
  }
  return token.type;
}

function format(value, type, ctx) {
  const resolved = resolve(value, ctx);
  if (!resolved.token) return FORMATS[type](resolved.value, ctx);
  const { token } = resolved;
  if (token.type !== type) {
    fail(ctx.where, `expects a ${type}, ${token.path} is a ${token.type}`);
  }
  ctx.references.add(token);
  return `var(${token.name})`;
}

function unitValue(value, units, type, ctx) {
  const amount = literal(value?.value, ctx);
  if (!isNumber(amount) || !units.includes(value.unit)) invalid(ctx, type);
  return `${amount}${value.unit}`;
}

function gradientStop(stop, ctx) {
  if (!isObject(stop)) invalid(ctx, "gradient");
  const position = format(stop.position, "number", ctx);
  // Positions are clamped to [0, 1]; CSS clamps referenced ones.
  const percent = isNumber(Number(position))
    ? `${+(Math.min(1, Math.max(0, Number(position))) * 100).toFixed(4)}%`
    : `calc(clamp(0, ${position}, 1) * 100%)`;
  return `${format(stop.color, "color", ctx)} ${percent}`;
}

const FORMATS = {
  color(value, ctx) {
    if (!isObject(value)) invalid(ctx, "color");
    const { colorSpace: space, components, alpha = 1 } = value;
    const parts = Array.isArray(components)
      ? components.map((component) => literal(component, ctx))
      : [];
    const opacity = literal(alpha, ctx);
    if (
      ![...CSS_COLOR_FUNCTIONS, ...CSS_COLOR_SPACES].includes(space) ||
      parts.length !== 3 ||
      !parts.every((part) => part === "none" || isNumber(part)) ||
      !isNumber(opacity)
    ) {
      invalid(ctx, "color");
    }
    if (space === "hsl" || space === "hwb") {
      for (const i of [1, 2]) if (isNumber(parts[i])) parts[i] += "%";
    }
    const args = parts.join(" ") + (opacity === 1 ? "" : ` / ${opacity}`);
    return CSS_COLOR_FUNCTIONS.includes(space)
      ? `${space}(${args})`
      : `color(${space} ${args})`;
  },

  dimension: (value, ctx) => unitValue(value, ["px", "rem"], "dimension", ctx),

  duration: (value, ctx) => unitValue(value, ["ms", "s"], "duration", ctx),

  number(value, ctx) {
    if (!isNumber(value)) invalid(ctx, "number");
    return String(value);
  },

  fontFamily(value, ctx) {
    const names = typeof value === "string" ? [value] : value;
    if (
      !Array.isArray(names) ||
      names.length === 0 ||
      !names.every((name) => typeof name === "string")
    ) {
      invalid(ctx, "fontFamily");
    }
    return names
      .map((name) =>
        GENERIC_FONT_FAMILIES.includes(name) ? name : JSON.stringify(name),
      )
      .join(", ");
  },

  fontWeight(value, ctx) {
    const weight = FONT_WEIGHTS.get(value) ?? value;
    if (!isNumber(weight) || weight < 1 || weight > 1000) {
      invalid(ctx, "fontWeight");
    }
    return String(weight);
  },

  cubicBezier(value, ctx) {
    const points = Array.isArray(value)
      ? value.map((point) => literal(point, ctx))
      : [];
    if (
      points.length !== 4 ||
      !points.every(isNumber) ||
      [points[0], points[2]].some((x) => x < 0 || x > 1)
    ) {
      invalid(ctx, "cubicBezier");
    }
    return `cubic-bezier(${points.join(", ")})`;
  },

  // A dash pattern becomes a stroke-dasharray value; its line cap gets a
  // property of its own (see declarations).
  strokeStyle(value, ctx) {
    if (STROKE_STYLES.includes(value)) return value;
    const dashes = value?.dashArray;
    if (
      !Array.isArray(dashes) ||
      dashes.length === 0 ||
      !LINE_CAPS.includes(literal(value.lineCap, ctx))
    ) {
      invalid(ctx, "strokeStyle");
    }
    return dashes.map((dash) => format(dash, "dimension", ctx)).join(" ");
  },

  border(value, ctx) {
    if (!isObject(value)) invalid(ctx, "border");
    // CSS borders cannot draw a custom dash pattern: dashed is the closest.
    const style = isObject(concrete(value.style, ctx))
      ? "dashed"
      : format(value.style, "strokeStyle", ctx);
    const width = format(value.width, "dimension", ctx);
    return `${width} ${style} ${format(value.color, "color", ctx)}`;
  },

  transition(value, ctx) {
    if (!isObject(value)) invalid(ctx, "transition");
    return [
      format(value.duration, "duration", ctx),
      format(value.timingFunction, "cubicBezier", ctx),
      format(value.delay, "duration", ctx),
    ].join(" ");
  },

  shadow(value, ctx) {
    if (Array.isArray(value)) {
      return value.map((item) => format(item, "shadow", ctx)).join(", ");
    }
    if (!isObject(value)) invalid(ctx, "shadow");
    const inset = literal(value.inset ?? false, ctx) === true ? "inset " : "";
    return (
      inset +
      [
        format(value.offsetX, "dimension", ctx),
        format(value.offsetY, "dimension", ctx),
        format(value.blur, "dimension", ctx),
        format(value.spread, "dimension", ctx),
        format(value.color, "color", ctx),
      ].join(" ")
    );
  },

  // The spec leaves the gradient kind open: the property holds the color
  // stops, to use as linear-gradient(var(--x)) or radial-gradient(var(--x)).
  gradient(value, ctx) {
    if (!Array.isArray(value)) invalid(ctx, "gradient");
    return value
      .map((stop) =>
        resolve(stop, ctx).token
          ? format(stop, "gradient", ctx)
          : gradientStop(concrete(stop, ctx), ctx),
      )
      .join(", ");
  },

  // Used as font: var(--x); letter-spacing has no place in the shorthand and
  // gets a property of its own (see declarations).
  typography(value, ctx) {
    if (!isObject(value)) invalid(ctx, "typography");
    const weight = format(value.fontWeight, "fontWeight", ctx);
    const size = format(value.fontSize, "dimension", ctx);
    const lineHeight = format(value.lineHeight, "number", ctx);
    const family = format(value.fontFamily, "fontFamily", ctx);
    return `${weight} ${size}/${lineHeight} ${family}`;
  },
};

function declarations(token, ctx) {
  const result = [[token.name, format(token.value, token.type, ctx)]];
  const { alias } = token;
  const value = concrete(token.value, ctx);
  if (token.type === "typography") {
    result.push([
      `${token.name}-letter-spacing`,
      alias
        ? `var(${alias.name}-letter-spacing)`
        : format(value.letterSpacing, "dimension", ctx),
    ]);
  }
  if (token.type === "strokeStyle" && isObject(value)) {
    result.push([
      `${token.name}-line-cap`,
      alias ? `var(${alias.name}-line-cap)` : literal(value.lineCap, ctx),
    ]);
  }
  return result;
}

function checkCycles(tokens) {
  const visited = new Set();
  const visit = (token, chain) => {
    if (chain.includes(token)) {
      const cycle = [...chain, token].map((link) => link.path).join(" → ");
      fail(token.path, `circular reference: ${cycle}`);
    }
    if (visited.has(token)) return;
    for (const target of token.references) visit(target, [...chain, token]);
    visited.add(token);
  };
  for (const token of tokens) visit(token, []);
}

function checkNames(tokens) {
  const owners = new Map();
  for (const token of tokens) {
    for (const [name] of token.declarations) {
      if (owners.has(name)) {
        fail(token.path, `${name} is also produced by ${owners.get(name)}`);
      }
      owners.set(name, token.path);
    }
  }
}

// files: [{ tier, name, json }] in tier order. Throws on the first error.
export function buildTokens(files) {
  const root = {};
  const tiers = new WeakMap();
  for (const file of files) {
    if (!isObject(file.json)) fail(file.name, "must contain a JSON object");
    markTier(file.json, file.tier, tiers, []);
    mergeGroup(root, file.json, [], file.name);
  }
  expandExtends(root, tiers);
  const tokens = [];
  flatten(root, [], { deprecated: false }, tiers, tokens);
  const index = new Map(tokens.map((token) => [token.path, token]));
  for (const token of tokens) resolveType(token, index);
  for (const token of tokens) {
    const ctx = { index, where: token.path, references: token.references };
    token.alias = resolve(token.value, ctx).token ?? null;
    token.declarations = declarations(token, ctx);
  }
  checkCycles(tokens);
  checkNames(tokens);
  return tokens.sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
}

export function toCss(tokens) {
  const lines = tokens.flatMap((token) =>
    token.declarations.map(([name, value]) => `  ${name}: ${value};`),
  );
  return [
    "/* Generated by BoardTool from ds/tokens/. Do not edit. */",
    ":root {",
    ...lines,
    "}",
    "",
  ].join("\n");
}

// "- color: surface-base, text-primary": semantic and component tokens,
// grouped by the first path segment. Deprecated tokens are left out.
export function catalogTokens(tokens) {
  const groups = new Map();
  for (const token of tokens) {
    if (token.tier === "primitive" || token.deprecated) continue;
    const prefix = cssName(token.path.split(".").slice(0, 1));
    const names = groups.get(prefix) ?? [];
    names.push(token.name.slice(prefix.length + 1));
    groups.set(prefix, names);
  }
  return [...groups].map(
    ([prefix, names]) => `- ${prefix.slice(2)}: ${names.join(", ")}`,
  );
}

// Plain data for the token viewer: final CSS values, alias chains, usages.
export function describeTokens(tokens) {
  const values = new Map(tokens.flatMap((token) => token.declarations));
  const resolveVars = (css) =>
    css.replace(/var\((--[^)]+)\)/g, (_, name) =>
      resolveVars(values.get(name)),
    );
  const usedBy = new Map(tokens.map((token) => [token, []]));
  for (const token of tokens) {
    for (const target of token.references) usedBy.get(target).push(token.name);
  }
  return tokens.map((token) => {
    const chain = [];
    for (let link = token.alias; link; link = link.alias) chain.push(link.name);
    return {
      path: token.path,
      name: token.name,
      tier: token.tier,
      type: token.type,
      description: token.description,
      deprecated: token.deprecated,
      declarations: token.declarations.map(([name, css]) => ({
        name,
        value: resolveVars(css),
      })),
      chain,
      references: [...token.references].map((target) => target.name),
      usedBy: usedBy.get(token),
    };
  });
}
